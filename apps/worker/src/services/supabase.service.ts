import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/env.ts';
import {
  AgentSettings,
  AgentAction,
  AuditLogEntry,
  Company,
  DealStatus,
  DiscoveryRecord,
  DiscoveryStats,
  OutboundLog,
  SuppressionEntry,
  WatchlistRule,
} from '@/packages/types/src/database.ts';
import { EquipmentRecord, InboundLead } from '@/packages/types/src/lead.ts';
import { parsePriceString } from '@/packages/types/src/swiss.ts';
import {
  getLanguageForCanton,
  isAddressSuppressed,
  isEligibleForOutbound,
  isSameSwissDay,
} from '../scheduler.ts';

const STORAGE_BUCKET = 'jimiscout-data';
const STATE_FILE = 'production-state.json';
const LOCAL_FALLBACK_FILE = path.resolve(process.cwd(), '.jimiscout-local-state.json');

export interface ProcessedMessageRecord {
  message_key: string;
  sender_email: string;
  subject?: string;
  status: 'claimed' | 'processed' | 'deleted' | 'failed';
  lead_id?: string | null;
  error_message?: string | null;
  claimed_at: string;
  processed_at?: string | null;
}

export interface PersistedSchedulerMeta {
  last_heartbeat_at?: string | null;
  last_run_at?: string | null;
  next_send_at?: string | null;
  last_error?: string | null;
}

export interface PersistedDiscoveryMeta {
  last_run_at?: string | null;
  next_run_at?: string | null;
  last_error?: string | null;
  last_canton?: string | null;
  canton_cursor?: number;
  keyword_cursor?: number;
}

export interface PersistedState {
  settings: AgentSettings;
  companies: Company[];
  leads: InboundLead[];
  logs: OutboundLog[];
  suppressions: SuppressionEntry[];
  equipment: EquipmentRecord[];
  processed_messages: Record<string, ProcessedMessageRecord>;
  deleted_fingerprints: string[];
  contact_history_by_email?: Record<string, string>;
  audit_logs: AuditLogEntry[];
  scheduler: PersistedSchedulerMeta;
  discovery_records: DiscoveryRecord[];
  discovery: PersistedDiscoveryMeta;
  agent_actions: AgentAction[];
  watchlists: WatchlistRule[];
  push_subscriptions: StoredPushSubscription[];
}

export interface StoredPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export class SupabaseDataService {
  private client: SupabaseClient | null = null;
  private sqlTablesAvailable: boolean | null = null;
  private extendedSqlColumnsAvailable: boolean | null = null;
  private discoverySqlAvailable: boolean | null = null;
  private cachedState: PersistedState | null = null;
  private stateLoadPromise: Promise<PersistedState> | null = null;

  // Atomic in-memory locks for concurrent claim protection
  private activeInboundClaims = new Set<string>();
  private activeCompanyClaims = new Set<string>();
  private isClaimingOutbound = false;
  private readonly requireCloudStorage =
    process.env.JIMISCOUT_REQUIRE_CLOUD_STORAGE === 'true' ||
    Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);

  constructor() {
    if (
      this.requireCloudStorage &&
      (!config.supabase.url || !config.supabase.serviceKey)
    ) {
      throw new Error(
        'Cloud persistence is required on Railway. Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
      );
    }
    if (
      config.supabase.url &&
      config.supabase.serviceKey &&
      process.env.JIMISCOUT_USE_MEMORY_ONLY !== 'true'
    ) {
      this.client = createClient(config.supabase.url, config.supabase.serviceKey, {
        auth: { persistSession: false },
      });
    }
  }

  getStorageMode(): 'supabase-sql' | 'supabase-storage' | 'memory' {
    if (!this.client) return 'memory';
    if (this.sqlTablesAvailable) return 'supabase-sql';
    return 'supabase-storage';
  }

  /**
   * Used by automated tests to reset in-memory state cleanly without touching production.
   */
  resetForTests(): void {
    this.client = null;
    this.sqlTablesAvailable = false;
    this.extendedSqlColumnsAvailable = false;
    this.discoverySqlAvailable = false;
    this.cachedState = {
      settings: this.getDefaultSettings(),
      companies: [],
      leads: [],
      logs: [],
      suppressions: [],
      equipment: [],
      processed_messages: {},
      deleted_fingerprints: [],
      contact_history_by_email: {},
      audit_logs: [],
      scheduler: {},
      discovery_records: [],
      discovery: {},
      agent_actions: [],
      watchlists: [],
      push_subscriptions: [],
    };
    this.stateLoadPromise = null;
    this.activeInboundClaims.clear();
    this.activeCompanyClaims.clear();
    this.isClaimingOutbound = false;
  }

  private getDefaultSettings(): AgentSettings {
    return {
      id: '00000000-0000-4000-8000-000000000001',
      is_active: false,
      discovery_active: true,
      outreach_active: true,
      discovery_daily_limit: 25,
      discovery_interval_minutes: 120,
      discovery_keywords: [
        'entreprise de terrassement',
        'Tiefbauunternehmen',
        'entreprise de démolition',
        'Baumaschinen Vermietung',
        'genio civile',
      ],
      daily_limit: 25,
      selected_cantons: ['BE', 'ZH', 'VD', 'TI', 'GE', 'VS'],
      sender_name: 'Jamal',
      sender_email: config.smtp.user || 'info@jimyexport.ch',
      sender_phone: '+41 79 123 45 67',
      tone: 'swiss_formal',
      hooks: {
        cash_settlement: true,
        transport_covered: true,
        as_is: true,
      },
      equipment_focus:
        'Pelles sur chenilles 15–30t, camions benne 4 essieux, chargeuses sur pneus, concasseurs',
      feature_controls: {
        deal_scoring: 'auto',
        follow_ups: 'approval',
        qualification: 'approval',
        price_comparison: 'auto',
        watchlists: 'auto',
        daily_briefing: 'auto',
        negotiation: 'approval',
        seller_intelligence: 'auto',
      },
      follow_up_first_business_days: 4,
      follow_up_final_business_days: 9,
      daily_briefing_hour: 7,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Inspects all core SQL tables and checks whether the extended columns migration has been applied.
   */
  async checkSqlSchema(): Promise<{
    sqlReady: boolean;
    extendedSqlReady: boolean;
    discoverySqlReady: boolean;
    tables: Record<string, boolean>;
    error?: string;
  }> {
    if (!this.client) {
      this.sqlTablesAvailable = false;
      this.extendedSqlColumnsAvailable = false;
      this.discoverySqlAvailable = false;
      return {
        sqlReady: false,
        extendedSqlReady: false,
        discoverySqlReady: false,
        tables: {
          agent_settings: false,
          companies: false,
          outbound_logs: false,
          inbound_leads: false,
          discovery_records: false,
        },
        error: 'Missing Supabase URL or Service Role Key',
      };
    }

    const [settingsRes, companiesRes, logsRes, leadsRes, extRes, discoveryRes, discoverySettingsRes] = await Promise.all([
      this.client.from('agent_settings').select('id').limit(1),
      this.client.from('companies').select('id').limit(1),
      this.client.from('outbound_logs').select('id').limit(1),
      this.client.from('inbound_leads').select('id').limit(1),
      this.client.from('outbound_logs').select('id, full_body, recipient_email').limit(1),
      this.client.from('discovery_records').select('id').limit(1),
      this.client.from('agent_settings').select('id, discovery_active, outreach_active').limit(1),
    ]);

    const tables = {
      agent_settings: !settingsRes.error,
      companies: !companiesRes.error,
      outbound_logs: !logsRes.error,
      inbound_leads: !leadsRes.error,
      discovery_records: !discoveryRes.error,
    };

    const sqlReady =
      tables.agent_settings &&
      tables.companies &&
      tables.outbound_logs &&
      tables.inbound_leads;
    const extendedSqlReady = sqlReady && !extRes.error;
    const discoverySqlReady = sqlReady && !discoveryRes.error && !discoverySettingsRes.error;

    this.sqlTablesAvailable = sqlReady;
    this.extendedSqlColumnsAvailable = extendedSqlReady;
    this.discoverySqlAvailable = discoverySqlReady;

    const firstError =
      settingsRes.error?.message ||
      companiesRes.error?.message ||
      logsRes.error?.message ||
      leadsRes.error?.message;

    return {
      sqlReady,
      extendedSqlReady,
      discoverySqlReady,
      tables,
      error: firstError,
    };
  }

  private async isSqlReady(): Promise<boolean> {
    if (this.sqlTablesAvailable !== null) return this.sqlTablesAvailable;
    const { sqlReady } = await this.checkSqlSchema();
    return sqlReady;
  }

  private normalizeState(parsed: Partial<PersistedState>, initial: PersistedState): PersistedState {
    return {
      settings: parsed.settings
        ? {
            ...initial.settings,
            ...parsed.settings,
            feature_controls: {
              ...initial.settings.feature_controls,
              ...(parsed.settings.feature_controls || {}),
            },
          }
        : initial.settings,
      companies: Array.isArray(parsed.companies) ? parsed.companies : [],
      leads: Array.isArray(parsed.leads) ? parsed.leads : [],
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      suppressions: Array.isArray(parsed.suppressions) ? parsed.suppressions : [],
      equipment: Array.isArray(parsed.equipment) ? parsed.equipment : [],
      processed_messages:
        parsed.processed_messages && typeof parsed.processed_messages === 'object'
          ? parsed.processed_messages
          : {},
      deleted_fingerprints: Array.isArray(parsed.deleted_fingerprints)
        ? parsed.deleted_fingerprints
        : [],
      contact_history_by_email:
        parsed.contact_history_by_email && typeof parsed.contact_history_by_email === 'object'
          ? parsed.contact_history_by_email
          : {},
      audit_logs: Array.isArray(parsed.audit_logs) ? parsed.audit_logs : [],
      scheduler:
        parsed.scheduler && typeof parsed.scheduler === 'object' ? parsed.scheduler : {},
      discovery_records: Array.isArray(parsed.discovery_records) ? parsed.discovery_records : [],
      discovery:
        parsed.discovery && typeof parsed.discovery === 'object' ? parsed.discovery : {},
      agent_actions: Array.isArray(parsed.agent_actions) ? parsed.agent_actions : [],
      watchlists: Array.isArray(parsed.watchlists) ? parsed.watchlists : [],
      push_subscriptions: Array.isArray(parsed.push_subscriptions)
        ? parsed.push_subscriptions.filter(
            (item: any) => item?.endpoint && item?.keys?.p256dh && item?.keys?.auth
          )
        : [],
    };
  }

  private async ensureStorageState(): Promise<PersistedState> {
    if (this.cachedState) return this.cachedState;
    if (this.stateLoadPromise) return this.stateLoadPromise;

    this.stateLoadPromise = (async () => {
      const initial: PersistedState = {
        settings: this.getDefaultSettings(),
        companies: [],
        leads: [],
        logs: [],
        suppressions: [],
        equipment: [],
        processed_messages: {},
        deleted_fingerprints: [],
        contact_history_by_email: {},
        audit_logs: [],
        scheduler: {},
        discovery_records: [],
        discovery: {},
        agent_actions: [],
        watchlists: [],
        push_subscriptions: [],
      };

      if (!this.client) {
        if (
          process.env.JIMISCOUT_USE_MEMORY_ONLY !== 'true' &&
          fs.existsSync(LOCAL_FALLBACK_FILE)
        ) {
          try {
            const raw = fs.readFileSync(LOCAL_FALLBACK_FILE, 'utf-8');
            this.cachedState = this.normalizeState(JSON.parse(raw), initial);
            return this.cachedState;
          } catch {}
        }
        this.cachedState = initial;
        return initial;
      }

      try {
        const { data: buckets } = await this.client.storage.listBuckets();
        const exists = buckets?.some((b) => b.name === STORAGE_BUCKET);
        if (!exists) {
          await this.client.storage.createBucket(STORAGE_BUCKET, { public: false });
        }

        const { data: fileData, error: downloadErr } = await this.client.storage
          .from(STORAGE_BUCKET)
          .download(STATE_FILE);

        if (!downloadErr && fileData) {
          const text = await fileData.text();
          const parsed = JSON.parse(text) as Partial<PersistedState>;
          this.cachedState = this.normalizeState(parsed, initial);
          return this.cachedState;
        }

        await this.saveStorageState(initial);
        this.cachedState = initial;
        return initial;
      } catch (err) {
        console.error('[Supabase] Storage init error:', err);
        this.cachedState = initial;
        return initial;
      } finally {
        this.stateLoadPromise = null;
      }
    })();

    return this.stateLoadPromise;
  }

  private async saveStorageState(state: PersistedState): Promise<void> {
    this.cachedState = state;
    if (!this.client) {
      if (this.requireCloudStorage) {
        throw new Error('Refusing local-file persistence in a cloud production runtime.');
      }
      if (process.env.JIMISCOUT_USE_MEMORY_ONLY !== 'true') {
        try {
          fs.writeFileSync(LOCAL_FALLBACK_FILE, JSON.stringify(state, null, 2), 'utf-8');
        } catch {}
      }
      return;
    }

    const payload = JSON.stringify(state, null, 2);
    const { error } = await this.client.storage
      .from(STORAGE_BUCKET)
      .upload(STATE_FILE, payload, {
        upsert: true,
        contentType: 'application/json',
      });
    if (error) {
      throw new Error(`Persistence failure in Supabase Storage: ${error.message}`);
    }
  }

  async recordAuditLog(
    action: string,
    entity_type: AuditLogEntry['entity_type'],
    details: string,
    entity_id?: string | null
  ): Promise<AuditLogEntry> {
    const state = await this.ensureStorageState();
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      action,
      entity_type,
      entity_id: entity_id || null,
      details,
      created_at: new Date().toISOString(),
    };
    state.audit_logs.unshift(entry);
    if (state.audit_logs.length > 300) {
      state.audit_logs = state.audit_logs.slice(0, 300);
    }
    await this.saveStorageState(state);
    return entry;
  }

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const state = await this.ensureStorageState();
    return state.audit_logs;
  }

  // =========================================================
  // 1. AGENT SETTINGS
  // =========================================================
  async getSettings(): Promise<AgentSettings> {
    const state = await this.ensureStorageState();
    if (this.client && (await this.isSqlReady())) {
      const { data, error } = await this.client
        .from('agent_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        state.settings = { ...state.settings, ...(data as AgentSettings) };
        return state.settings;
      }
    }
    return state.settings;
  }

  async updateSettings(patch: Partial<AgentSettings>): Promise<AgentSettings> {
    const state = await this.ensureStorageState();
    const current = await this.getSettings();

    const dailyLimit =
      patch.daily_limit !== undefined
        ? Math.max(5, Math.min(100, Number(patch.daily_limit) || 25))
        : current.daily_limit;

    const discoveryDailyLimit =
      patch.discovery_daily_limit !== undefined
        ? Math.max(1, Math.min(200, Number(patch.discovery_daily_limit) || 25))
        : current.discovery_daily_limit;
    const discoveryIntervalMinutes =
      patch.discovery_interval_minutes !== undefined
        ? Math.max(30, Math.min(1440, Number(patch.discovery_interval_minutes) || 120))
        : current.discovery_interval_minutes;
    const discoveryKeywords = Array.isArray(patch.discovery_keywords)
      ? patch.discovery_keywords.map((item) => String(item).trim()).filter(Boolean).slice(0, 20)
      : current.discovery_keywords;
    const isMode = (value: unknown): value is 'off' | 'approval' | 'auto' =>
      value === 'off' || value === 'approval' || value === 'auto';
    const featureControls: AgentSettings['feature_controls'] = { ...current.feature_controls };
    if (patch.feature_controls) {
      for (const key of Object.keys(featureControls) as Array<keyof typeof featureControls>) {
        const value = patch.feature_controls[key];
        if (isMode(value)) featureControls[key] = value;
      }
    }

    const updated: AgentSettings = {
      ...current,
      ...patch,
      daily_limit: dailyLimit,
      discovery_daily_limit: discoveryDailyLimit,
      discovery_interval_minutes: discoveryIntervalMinutes,
      discovery_keywords: discoveryKeywords,
      feature_controls: featureControls,
      follow_up_first_business_days:
        patch.follow_up_first_business_days !== undefined
          ? Math.max(1, Math.min(20, Math.round(Number(patch.follow_up_first_business_days) || 4)))
          : current.follow_up_first_business_days,
      follow_up_final_business_days:
        patch.follow_up_final_business_days !== undefined
          ? Math.max(2, Math.min(30, Math.round(Number(patch.follow_up_final_business_days) || 9)))
          : current.follow_up_final_business_days,
      daily_briefing_hour:
        patch.daily_briefing_hour !== undefined
          ? Math.max(0, Math.min(23, Math.round(Number(patch.daily_briefing_hour) || 7)))
          : current.daily_briefing_hour,
      updated_at: new Date().toISOString(),
    };

    if (this.client && (await this.isSqlReady())) {
      const sqlPayload: Record<string, unknown> = {
        id: updated.id,
        is_active: updated.is_active,
        daily_limit: Math.max(10, Math.min(50, updated.daily_limit)),
        selected_cantons: updated.selected_cantons,
        sender_name: updated.sender_name,
        sender_email: updated.sender_email,
        sender_phone: updated.sender_phone,
        tone: updated.tone,
        hooks: updated.hooks,
        equipment_focus: updated.equipment_focus,
        updated_at: updated.updated_at,
      };
      if (this.discoverySqlAvailable) {
        Object.assign(sqlPayload, {
          discovery_active: updated.discovery_active,
          outreach_active: updated.outreach_active,
          discovery_daily_limit: updated.discovery_daily_limit,
          discovery_interval_minutes: updated.discovery_interval_minutes,
          discovery_keywords: updated.discovery_keywords,
        });
      }
      const { error } = await this.client.from('agent_settings').upsert(sqlPayload);
      if (error) {
        console.warn('[Supabase] SQL agent_settings upsert warning:', error.message);
      }
    }

    state.settings = updated;
    await this.saveStorageState(state);
    await this.recordAuditLog(
      'settings_updated',
      'settings',
      `Active: ${updated.is_active}, Discovery: ${updated.discovery_active}, Outreach: ${updated.outreach_active}, Limit: ${updated.daily_limit}/d, Tone: ${updated.tone}, Cantons: ${updated.selected_cantons.join(',')}`,
      updated.id
    );
    return updated;
  }

  // =========================================================
  // 2. SUPPRESSION REGISTRY (PHASE 4)
  // =========================================================
  async getSuppressions(): Promise<SuppressionEntry[]> {
    const state = await this.ensureStorageState();
    if (this.client && this.extendedSqlColumnsAvailable) {
      const { data, error } = await this.client
        .from('suppression_registry')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        const byKey = new Map<string, SuppressionEntry>();
        for (const item of [...(data as SuppressionEntry[]), ...state.suppressions]) {
          const key = (item.email || item.domain || item.id).toLowerCase();
          if (!byKey.has(key)) byKey.set(key, item);
        }
        state.suppressions = Array.from(byKey.values());
      }
    }
    return state.suppressions;
  }

  async isEmailOrDomainSuppressed(emailOrDomain: string): Promise<boolean> {
    const clean = (emailOrDomain || '').trim().toLowerCase();
    if (!clean) return false;
    const suppressions = await this.getSuppressions();
    if (clean.includes('@')) {
      return isAddressSuppressed(clean, suppressions).suppressed;
    }
    return suppressions.some((s) => s.domain && s.domain.toLowerCase() === clean);
  }

  async addSuppression(params: {
    email?: string | null;
    domain?: string | null;
    companyName?: string | null;
    reason?: SuppressionEntry['reason'];
    source?: string;
    notes?: string | null;
    unsubscribed?: boolean;
  }): Promise<SuppressionEntry> {
    const cleanEmail = params.email ? params.email.trim().toLowerCase() : null;
    const cleanDomain = params.domain
      ? params.domain
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .split('/')[0]
      : null;

    if (!cleanEmail && !cleanDomain) {
      throw new Error('Either email or domain is required to create a suppression record.');
    }

    const state = await this.ensureStorageState();
    const existing = state.suppressions.find(
      (s) =>
        (cleanEmail && s.email?.toLowerCase() === cleanEmail) ||
        (cleanDomain && s.domain?.toLowerCase() === cleanDomain)
    );

    if (existing) {
      return existing;
    }

    const entry: SuppressionEntry = {
      id: crypto.randomUUID(),
      email: cleanEmail,
      domain: cleanDomain,
      companyName: params.companyName || null,
      reason: params.reason || 'unsubscribe_reply',
      source: params.source || 'manual',
      notes: params.notes || null,
      unsubscribed: params.unsubscribed ?? true,
      created_at: new Date().toISOString(),
    };

    state.suppressions.unshift(entry);

    // Also mark any matching company in the directory as unsubscribed
    for (const c of state.companies) {
      const cEmail = c.email.toLowerCase();
      const cDomain = cEmail.split('@')[1];
      if ((cleanEmail && cEmail === cleanEmail) || (cleanDomain && cDomain === cleanDomain)) {
        c.unsubscribed = true;
        if (this.client && (await this.isSqlReady())) {
          await this.client
            .from('companies')
            .update({ unsubscribed: true })
            .eq('id', c.id);
        }
      }
    }

    if (this.client && this.extendedSqlColumnsAvailable) {
      await this.client.from('suppression_registry').insert(entry);
    }

    await this.saveStorageState(state);
    await this.recordAuditLog(
      'suppression_added',
      'suppression',
      `Suppressed ${cleanEmail || `*@${cleanDomain}`} (${entry.reason} via ${entry.source})`,
      entry.id
    );
    return entry;
  }

  /**
   * Deliberate authorized action to remove an opt-out/suppression and optionally re-enable the company.
   */
  async removeSuppression(id: string, reEnableCompany = true): Promise<boolean> {
    const state = await this.ensureStorageState();
    const target = state.suppressions.find((s) => s.id === id);
    if (!target) return false;

    state.suppressions = state.suppressions.filter((s) => s.id !== id);

    if (reEnableCompany) {
      for (const c of state.companies) {
        const cEmail = c.email.toLowerCase();
        const cDomain = cEmail.split('@')[1];
        if (
          (target.email && cEmail === target.email.toLowerCase()) ||
          (target.domain && cDomain === target.domain.toLowerCase())
        ) {
          c.unsubscribed = false;
          if (this.client && (await this.isSqlReady())) {
            await this.client
              .from('companies')
              .update({ unsubscribed: false })
              .eq('id', c.id);
          }
        }
      }
    }

    if (this.client && this.extendedSqlColumnsAvailable) {
      await this.client.from('suppression_registry').delete().eq('id', id);
    }

    await this.saveStorageState(state);
    await this.recordAuditLog(
      'suppression_removed',
      'suppression',
      `Removed suppression for ${target.email || target.domain}`,
      id
    );
    return true;
  }

  // =========================================================
  // 3. COMPANIES (CONTRACTORS DIRECTORY — PRESERVING IDENTITY & SUPPRESSION)
  // =========================================================
  async getCompanies(): Promise<Company[]> {
    const state = await this.ensureStorageState();
    const suppressions = state.suppressions;

    if (this.client && (await this.isSqlReady())) {
      const { data, error } = await this.client
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const sqlCompanies = data as Company[];
        const stateByEmail = new Map(
          state.companies.map((c) => [c.email.toLowerCase(), c])
        );
        const mergedByEmail = new Map<string, Company>();

        for (const sqlComp of sqlCompanies) {
          const emailKey = sqlComp.email.toLowerCase();
          const localComp = stateByEmail.get(emailKey);
          const isSup = isAddressSuppressed(emailKey, suppressions).suppressed;

          mergedByEmail.set(emailKey, {
            ...localComp,
            ...sqlComp,
            // Preserve extended fields from localComp if SQL lacks them
            contact_person: sqlComp.contact_person ?? localComp?.contact_person ?? null,
            address: sqlComp.address ?? localComp?.address ?? null,
            postal_code: sqlComp.postal_code ?? localComp?.postal_code ?? null,
            city: sqlComp.city ?? localComp?.city ?? null,
            notes: sqlComp.notes ?? localComp?.notes ?? null,
            source: sqlComp.source ?? localComp?.source ?? 'manual',
            source_id: sqlComp.source_id ?? localComp?.source_id ?? null,
            website: sqlComp.website ?? localComp?.website ?? null,
            email_source_url:
              sqlComp.email_source_url ?? localComp?.email_source_url ?? null,
            discovered_at: sqlComp.discovered_at ?? localComp?.discovered_at ?? null,
            confidence: sqlComp.confidence ?? localComp?.confidence ?? null,
            verified_email: sqlComp.verified_email ?? localComp?.verified_email ?? true,
            language_override:
              sqlComp.language_override ?? localComp?.language_override ?? false,
            stock_status: sqlComp.stock_status ?? localComp?.stock_status ?? 'unknown',
            // Never lose unsubscribed or last_contacted_at
            unsubscribed:
              Boolean(sqlComp.unsubscribed) ||
              Boolean(localComp?.unsubscribed) ||
              isSup,
            last_contacted_at:
              sqlComp.last_contacted_at || localComp?.last_contacted_at || null,
          });
        }

        // Also include any companies in state.companies that haven't synced to SQL yet (e.g., blank email OCR drafts)
        for (const localComp of state.companies) {
          const key = (localComp.email || localComp.id).toLowerCase();
          if (!mergedByEmail.has(key)) {
            const isSup = localComp.email
              ? isAddressSuppressed(localComp.email, suppressions).suppressed
              : false;
            mergedByEmail.set(key, {
              ...localComp,
              unsubscribed: Boolean(localComp.unsubscribed) || isSup,
            });
          }
        }

        state.companies = Array.from(mergedByEmail.values());
        return state.companies;
      }
    }

    // Ensure suppression flags are reflected on all companies
    for (const c of state.companies) {
      if (c.email && isAddressSuppressed(c.email, suppressions).suppressed) {
        c.unsubscribed = true;
      }
    }
    return state.companies;
  }

  /**
   * Upserts a company while strictly preserving existing identity (id),
   * opt-out status (unsubscribed & suppression_registry), and cooldown (last_contacted_at).
   */
  async addCompany(
    company: Omit<Company, 'id' | 'created_at' | 'unsubscribed'> & {
      id?: string;
      unsubscribed?: boolean;
    }
  ): Promise<Company> {
    const state = await this.ensureStorageState();
    const allCompanies = await this.getCompanies();
    const suppressions = await this.getSuppressions();

    const cleanEmail = (company.email || '').trim().toLowerCase();
    const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
    const verifiedEmail =
      company.verified_email !== undefined ? company.verified_email && hasValidEmail : hasValidEmail;

    // Find existing company by email or by id
    const existing = allCompanies.find(
      (c) =>
        (cleanEmail && c.email.toLowerCase() === cleanEmail) ||
        (company.id && c.id === company.id)
    );

    const isSuppressed = cleanEmail
      ? isAddressSuppressed(cleanEmail, suppressions).suppressed
      : false;

    const cleanCanton = (company.canton || existing?.canton || 'ZH').trim().toUpperCase();
    const language =
      company.language || existing?.language || getLanguageForCanton(cleanCanton);

    // CRITICAL PHASE 4 FIX:
    // Never overwrite existing id, unsubscribed=true, or last_contacted_at on re-import (even after delete)!
    const preservedUnsubscribed =
      Boolean(existing?.unsubscribed) ||
      Boolean(company.unsubscribed) ||
      isSuppressed;

    const priorContactFromHistory =
      cleanEmail && state.contact_history_by_email
        ? state.contact_history_by_email[cleanEmail]
        : null;
    const priorContactFromLogs = cleanEmail
      ? state.logs.find((l) => l.recipient_email?.toLowerCase() === cleanEmail)?.sent_at
      : null;

    const preservedLastContacted =
      existing?.last_contacted_at ||
      priorContactFromHistory ||
      priorContactFromLogs ||
      company.last_contacted_at ||
      null;

    if (cleanEmail && preservedLastContacted) {
      state.contact_history_by_email = state.contact_history_by_email || {};
      state.contact_history_by_email[cleanEmail] = preservedLastContacted;
    }

    const record: Company = {
      id: existing?.id || company.id || crypto.randomUUID(),
      name: (company.name || existing?.name || 'Entreprise BTP').trim(),
      domain: company.domain?.trim() ?? existing?.domain ?? null,
      canton: cleanCanton,
      language,
      language_override:
        company.language_override ?? existing?.language_override ?? Boolean(company.language),
      email: cleanEmail,
      verified_email: verifiedEmail,
      phone: company.phone?.trim() ?? existing?.phone ?? null,
      contact_person: company.contact_person?.trim() ?? existing?.contact_person ?? null,
      address: company.address?.trim() ?? existing?.address ?? null,
      postal_code: company.postal_code?.trim() ?? existing?.postal_code ?? null,
      city: company.city?.trim() ?? existing?.city ?? null,
      industry: company.industry || existing?.industry || 'civil_engineering',
      notes: company.notes?.trim() ?? existing?.notes ?? null,
      source: company.source || existing?.source || 'manual',
      source_id: company.source_id?.trim() ?? existing?.source_id ?? null,
      website: company.website?.trim() ?? existing?.website ?? null,
      email_source_url:
        company.email_source_url?.trim() ?? existing?.email_source_url ?? null,
      discovered_at: company.discovered_at ?? existing?.discovered_at ?? null,
      confidence: company.confidence ?? existing?.confidence ?? null,
      stock_status: company.stock_status ?? existing?.stock_status ?? 'unknown',
      unsubscribed: preservedUnsubscribed,
      last_contacted_at: preservedLastContacted,
      created_at: existing?.created_at || new Date().toISOString(),
    };

    if (record.unsubscribed && cleanEmail && !isSuppressed) {
      await this.addSuppression({
        email: cleanEmail,
        reason: 'manual_suppression',
        source: record.source || 'company_upsert',
      });
    }

    if (this.client && (await this.isSqlReady()) && cleanEmail) {
      const sqlRow: Record<string, any> = {
        id: record.id,
        name: record.name,
        domain: record.domain,
        canton: record.canton.slice(0, 4),
        language: record.language,
        email: record.email,
        phone: record.phone,
        industry: record.industry,
        unsubscribed: record.unsubscribed,
        last_contacted_at: record.last_contacted_at,
        created_at: record.created_at,
      };
      if (this.discoverySqlAvailable) {
        Object.assign(sqlRow, {
          source: record.source,
          source_id: record.source_id,
          website: record.website,
          email_source_url: record.email_source_url,
          discovered_at: record.discovered_at,
        });
      }
      const { error } = await this.client
        .from('companies')
        .upsert(sqlRow, { onConflict: 'email' });
      if (error) {
        console.warn('[Supabase] SQL addCompany upsert warning:', error.message);
      }
    }

    const existingIdx = state.companies.findIndex(
      (c) =>
        c.id === record.id ||
        (cleanEmail && c.email && c.email.toLowerCase() === cleanEmail)
    );
    if (existingIdx >= 0) {
      state.companies[existingIdx] = record;
    } else {
      state.companies.unshift(record);
    }

    await this.saveStorageState(state);
    return record;
  }

  async addCompaniesBulk(
    companies: Array<
      Omit<Company, 'id' | 'created_at' | 'unsubscribed'> & {
        unsubscribed?: boolean;
      }
    >
  ): Promise<{
    added: number;
    updated: number;
    failed: number;
    skipped: number;
    companies: Company[];
    results: Array<{ name: string; email: string; status: 'added' | 'updated' | 'failed'; error?: string }>;
  }> {
    const existingList = await this.getCompanies();
    const existingEmails = new Set(
      existingList.map((c) => c.email.toLowerCase()).filter(Boolean)
    );

    const savedCompanies: Company[] = [];
    const results: Array<{
      name: string;
      email: string;
      status: 'added' | 'updated' | 'failed';
      error?: string;
    }> = [];
    let added = 0;
    let updated = 0;
    let failed = 0;

    for (const c of companies) {
      try {
        if (!c.name || !c.name.trim()) {
          failed++;
          results.push({
            name: c.name || '(Missing Name)',
            email: c.email || '',
            status: 'failed',
            error: 'Company name is required',
          });
          continue;
        }
        const cleanEmail = (c.email || '').trim().toLowerCase();
        const wasExisting = cleanEmail ? existingEmails.has(cleanEmail) : false;
        const saved = await this.addCompany(c);
        savedCompanies.push(saved);
        if (wasExisting) {
          updated++;
          results.push({ name: saved.name, email: saved.email, status: 'updated' });
        } else {
          added++;
          if (cleanEmail) existingEmails.add(cleanEmail);
          results.push({ name: saved.name, email: saved.email, status: 'added' });
        }
      } catch (err: any) {
        failed++;
        results.push({
          name: c.name || 'Unknown',
          email: c.email || '',
          status: 'failed',
          error: err?.message || 'Failed to save row',
        });
      }
    }

    return { added, updated, failed, skipped: failed, companies: savedCompanies, results };
  }

  async updateCompany(id: string, patch: Partial<Company>): Promise<Company | null> {
    const state = await this.ensureStorageState();
    const all = await this.getCompanies();
    const target = all.find((c) => c.id === id);
    if (!target) {
      return null;
    }

    const updated: Company = {
      ...target,
      ...patch,
      id: target.id,
      canton: patch.canton ? patch.canton.trim().toUpperCase() : target.canton,
      email: patch.email !== undefined ? patch.email.trim().toLowerCase() : target.email,
    };

    if (updated.email && updated.last_contacted_at) {
      state.contact_history_by_email = state.contact_history_by_email || {};
      state.contact_history_by_email[updated.email] = updated.last_contacted_at;
    }

    // If marked unsubscribed, also record in durable suppression_registry
    if (patch.unsubscribed === true && updated.email) {
      await this.addSuppression({
        email: updated.email,
        reason: 'manual_suppression',
        source: 'company_update',
      });
    }

    if (this.client && (await this.isSqlReady())) {
      const sqlPatch: Record<string, any> = {};
      if (patch.name !== undefined) sqlPatch.name = updated.name;
      if (patch.domain !== undefined) sqlPatch.domain = updated.domain;
      if (patch.canton !== undefined) sqlPatch.canton = updated.canton.slice(0, 4);
      if (patch.language !== undefined) sqlPatch.language = updated.language;
      if (patch.email !== undefined && updated.email) sqlPatch.email = updated.email;
      if (patch.phone !== undefined) sqlPatch.phone = updated.phone;
      if (patch.industry !== undefined) sqlPatch.industry = updated.industry;
      if (patch.unsubscribed !== undefined) sqlPatch.unsubscribed = updated.unsubscribed;
      if (patch.last_contacted_at !== undefined)
        sqlPatch.last_contacted_at = updated.last_contacted_at;

      if (Object.keys(sqlPatch).length > 0) {
        const { error } = await this.client.from('companies').update(sqlPatch).eq('id', id);
        if (error) {
          console.warn('[Supabase] SQL updateCompany warning:', error.message);
        }
      }
    }

    const idx = state.companies.findIndex((c) => c.id === id);
    if (idx !== -1) {
      state.companies[idx] = updated;
    } else {
      state.companies.unshift(updated);
    }

    await this.saveStorageState(state);
    return updated;
  }

  /**
   * Deletes a company while preserving suppression in suppression_registry
   * and last_contacted_at in contact_history_by_email so deleting & re-adding
   * never clears opt-out or 30-day cooldown!
   */
  async deleteCompany(id: string): Promise<boolean> {
    const state = await this.ensureStorageState();
    const all = await this.getCompanies();
    const target = all.find((c) => c.id === id);

    if (target && target.email) {
      const emailKey = target.email.toLowerCase();
      if (target.last_contacted_at) {
        state.contact_history_by_email = state.contact_history_by_email || {};
        state.contact_history_by_email[emailKey] = target.last_contacted_at;
      }
      if (target.unsubscribed) {
        await this.addSuppression({
          email: emailKey,
          reason: 'unsubscribe_reply',
          source: 'preserved_on_company_delete',
          notes: `Preserved opt-out when deleting company ${target.name}`,
        });
      }
    }

    if (this.client && (await this.isSqlReady())) {
      await this.client.from('companies').delete().eq('id', id);
    }

    const beforeLen = state.companies.length;
    state.companies = state.companies.filter((c) => c.id !== id);
    await this.saveStorageState(state);
    return state.companies.length < beforeLen || Boolean(target);
  }

  async findCompanyByEmail(email: string): Promise<Company | null> {
    const clean = (email || '').trim().toLowerCase();
    if (!clean) return null;
    const all = await this.getCompanies();
    return all.find((c) => c.email && c.email.toLowerCase() === clean) || null;
  }

  async savePushSubscription(subscription: StoredPushSubscription): Promise<void> {
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      throw new Error('Invalid browser push subscription.');
    }
    const state = await this.ensureStorageState();
    state.push_subscriptions = [
      subscription,
      ...state.push_subscriptions.filter((item) => item.endpoint !== subscription.endpoint),
    ];
    await this.saveStorageState(state);
  }

  async getPushSubscriptions(): Promise<StoredPushSubscription[]> {
    const state = await this.ensureStorageState();
    return state.push_subscriptions || [];
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    if (!endpoint) return;
    const state = await this.ensureStorageState();
    state.push_subscriptions = state.push_subscriptions.filter((item) => item.endpoint !== endpoint);
    await this.saveStorageState(state);
  }

  // =========================================================
  // 4. ATOMIC INBOUND MESSAGE CLAIMING & LEADS (PHASE 5)
  // =========================================================
  async claimInboundMessage(params: {
    messageKey: string;
    senderEmail: string;
    subject?: string;
    rawBody?: string;
  }): Promise<{
    claimed: boolean;
    reason?: 'already_processed' | 'deleted' | 'in_flight';
    existingLead?: InboundLead | null;
  }> {
    const key = params.messageKey.trim();
    if (this.activeInboundClaims.has(key)) {
      return { claimed: false, reason: 'in_flight' };
    }

    this.activeInboundClaims.add(key);
    try {
      const state = await this.ensureStorageState();

      // 1. Check if previously deleted
      const isDeleted = await this.isDeletedEmail({
        senderEmail: params.senderEmail,
        rawBody: params.rawBody,
        rawSubject: params.subject,
        messageId: key,
      });
      if (isDeleted) {
        return { claimed: false, reason: 'deleted' };
      }

      // 2. Check processed_messages registry
      const existingRecord = state.processed_messages[key];
      if (existingRecord) {
        if (existingRecord.status === 'deleted') {
          return { claimed: false, reason: 'deleted' };
        }
        if (existingRecord.status === 'processed') {
          const allLeads = await this.getLeads(true);
          const matchingLead =
            allLeads.find((l) => l.id === existingRecord.lead_id || l.message_id === key) ||
            null;
          return {
            claimed: false,
            reason: 'already_processed',
            existingLead: matchingLead,
          };
        }
        if (existingRecord.status === 'claimed') {
          const claimedAgeMs = Date.now() - new Date(existingRecord.claimed_at).getTime();
          if (claimedAgeMs < 120_000) {
            return { claimed: false, reason: 'in_flight' };
          }
          // Stale claim (>2m old) or failed status is allowed to be re-claimed!
        }
      }

      // 3. Also check existing leads by message_id
      const allLeads = await this.getLeads(true);
      const existingLead = allLeads.find((l) => l.message_id === key);
      if (existingLead) {
        if (existingLead.lead_status === 'deleted' || existingLead.is_deleted) {
          return { claimed: false, reason: 'deleted' };
        }
        return {
          claimed: false,
          reason: 'already_processed',
          existingLead,
        };
      }

      state.processed_messages[key] = {
        message_key: key,
        sender_email: params.senderEmail.trim().toLowerCase(),
        subject: params.subject,
        status: 'claimed',
        claimed_at: new Date().toISOString(),
      };
      await this.saveStorageState(state);
      return { claimed: true };
    } finally {
      this.activeInboundClaims.delete(key);
    }
  }

  async completeInboundMessage(messageKey: string, leadId?: string | null): Promise<void> {
    const state = await this.ensureStorageState();
    const key = messageKey.trim();
    state.processed_messages[key] = {
      ...(state.processed_messages[key] || {
        message_key: key,
        sender_email: '',
        claimed_at: new Date().toISOString(),
      }),
      status: 'processed',
      lead_id: leadId || null,
      processed_at: new Date().toISOString(),
      error_message: null,
    };
    await this.saveStorageState(state);
  }

  async failInboundMessage(messageKey: string, errorMessage: string): Promise<void> {
    const state = await this.ensureStorageState();
    const key = messageKey.trim();
    state.processed_messages[key] = {
      ...(state.processed_messages[key] || {
        message_key: key,
        sender_email: '',
        claimed_at: new Date().toISOString(),
      }),
      status: 'failed',
      error_message: errorMessage,
    };
    await this.saveStorageState(state);
  }

  async getLeads(includeDeleted = false): Promise<InboundLead[]> {
    const state = await this.ensureStorageState();
    const stateById = new Map(state.leads.map((l) => [l.id, l]));
    const mergedById = new Map<string, InboundLead>();

    if (this.client && (await this.isSqlReady())) {
      const { data, error } = await this.client
        .from('inbound_leads')
        .select('*, companies(name, canton)')
        .order('received_at', { ascending: false });

      if (!error && data) {
        for (const row of data as any[]) {
          const local = stateById.get(row.id);
          const merged: InboundLead = {
            ...local,
            ...row,
            company_name:
              row.company_name ||
              local?.company_name ||
              row.companies?.name ||
              row.sender_email,
            canton: row.canton || local?.canton || row.companies?.canton || 'CH',
            message_id: row.message_id ?? local?.message_id ?? null,
            match_score: row.match_score ?? local?.match_score ?? 85,
            classification_confidence:
              row.classification_confidence ?? local?.classification_confidence ?? 0.9,
            equipment_fit_score:
              row.equipment_fit_score ?? local?.equipment_fit_score ?? row.match_score ?? 85,
            needs_review: row.needs_review ?? local?.needs_review ?? false,
            next_action: row.next_action ?? local?.next_action ?? null,
            next_action_due_at: row.next_action_due_at ?? local?.next_action_due_at ?? null,
            inspection_date: row.inspection_date ?? local?.inspection_date ?? null,
            inspection_location: row.inspection_location ?? local?.inspection_location ?? null,
            inspection_notes: row.inspection_notes ?? local?.inspection_notes ?? null,
            pass_reason: row.pass_reason ?? local?.pass_reason ?? null,
            notes: row.notes ?? local?.notes ?? null,
            purchase_price_chf: row.purchase_price_chf ?? local?.purchase_price_chf ?? null,
            transport_cost_chf: row.transport_cost_chf ?? local?.transport_cost_chf ?? null,
            estimated_resale_chf:
              row.estimated_resale_chf ?? local?.estimated_resale_chf ?? null,
            call_history: Array.isArray(row.call_history)
              ? row.call_history
              : local?.call_history || [],
            reply_history: Array.isArray(row.reply_history)
              ? row.reply_history
              : local?.reply_history || [],
          };
          mergedById.set(merged.id, merged);
        }
      }
    }

    // Merge all state.leads so fallback records are NEVER hidden by SQL reads!
    for (const local of state.leads) {
      if (!mergedById.has(local.id)) {
        mergedById.set(local.id, local);
      }
    }

    let result = Array.from(mergedById.values()).sort(
      (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
    );

    if (!includeDeleted) {
      result = result.filter(
        (l) => l.lead_status !== 'deleted' && !l.is_deleted
      );
    }

    return result;
  }

  async createLead(lead: Omit<InboundLead, 'id' | 'received_at'>): Promise<InboundLead> {
    const state = await this.ensureStorageState();

    // Enrich detected machinery with structured amounts/currencies
    const enrichedMachinery = (lead.machinery_detected || []).map((m) => {
      const parsed = parsePriceString(m.asking_price);
      return {
        ...m,
        asking_price_amount: m.asking_price_amount ?? parsed.amount,
        asking_price_currency: m.asking_price_currency ?? parsed.currency,
      };
    });

    const record: InboundLead = {
      ...lead,
      machinery_detected: enrichedMachinery,
      id: crypto.randomUUID(),
      received_at: new Date().toISOString(),
      call_history: lead.call_history || [],
      reply_history: lead.reply_history || [],
    };

    if (this.client && (await this.isSqlReady())) {
      const safeIntent = ['HOT_LEAD', 'NOT_INTERESTED', 'UNSUBSCRIBE', 'OUT_OF_OFFICE'].includes(
        record.intent
      )
        ? record.intent
        : 'HOT_LEAD';

      const dbRow: Record<string, any> = {
        id: record.id,
        company_id: record.company_id || null,
        sender_email: record.sender_email,
        raw_subject: record.raw_subject || null,
        raw_body: record.raw_body,
        intent: safeIntent,
        machinery_detected: record.machinery_detected,
        contact_name: record.contact_name || null,
        contact_phone: record.contact_phone || null,
        lead_status: record.lead_status,
        ai_summary: record.ai_summary || null,
        received_at: record.received_at,
      };

      const { error } = await this.client.from('inbound_leads').insert(dbRow);
      if (error) {
        console.warn('[Supabase] SQL createLead warning:', error.message);
      }
    }

    state.leads.unshift(record);

    // Also auto-create structured EquipmentRecords for each detected machine
    for (const m of record.machinery_detected) {
      const equip: EquipmentRecord = {
        id: crypto.randomUUID(),
        company_id: record.company_id || null,
        lead_id: record.id,
        company_name: record.company_name,
        canton: record.canton,
        category: m.type || 'Heavy Machinery',
        make_model: m.make_model || 'Machine BTP',
        year: m.year ?? null,
        hours: m.hours ?? null,
        serial_number: m.serial_number ?? null,
        condition: m.condition ?? null,
        location: record.canton || 'CH',
        availability: 'available',
        asking_price_amount: m.asking_price_amount ?? null,
        asking_price_currency: m.asking_price_currency || 'CHF',
        asking_price_raw: m.asking_price ?? null,
        source_evidence: m.source_evidence ?? record.raw_body.slice(0, 200),
        created_at: record.received_at,
      };
      state.equipment.unshift(equip);
    }

    await this.saveStorageState(state);
    return record;
  }

  async updateLead(id: string, patch: Partial<InboundLead>): Promise<InboundLead | null> {
    const state = await this.ensureStorageState();
    const all = await this.getLeads(true);
    const target = all.find((l) => l.id === id);
    if (!target) return null;

    const updated: InboundLead = {
      ...target,
      ...patch,
      id: target.id,
    };

    if (this.client && (await this.isSqlReady()) && patch.lead_status) {
      await this.client
        .from('inbound_leads')
        .update({ lead_status: patch.lead_status })
        .eq('id', id);
    }

    const idx = state.leads.findIndex((l) => l.id === id);
    if (idx !== -1) {
      state.leads[idx] = updated;
    } else {
      state.leads.unshift(updated);
    }

    await this.saveStorageState(state);
    return updated;
  }

  async updateLeadStatus(id: string, lead_status: DealStatus): Promise<InboundLead | null> {
    return this.updateLead(id, { lead_status });
  }

  async deleteLead(id: string): Promise<void> {
    const state = await this.ensureStorageState();
    const all = await this.getLeads(true);
    const targetLead = all.find((l) => l.id === id);

    if (this.client && (await this.isSqlReady())) {
      try {
        const { error } = await this.client
          .from('inbound_leads')
          .update({ lead_status: 'deleted' })
          .eq('id', id);

        if (error) {
          await this.client
            .from('inbound_leads')
            .update({ lead_status: 'passed' })
            .eq('id', id);
        }
      } catch (e) {
        console.warn('[Supabase] SQL deleteLead warning:', e);
      }
    }

    if (targetLead) {
      const idx = state.leads.findIndex((l) => l.id === id);
      if (idx !== -1) {
        state.leads[idx].lead_status = 'deleted';
        state.leads[idx].is_deleted = true;
      } else {
        state.leads.unshift({
          ...targetLead,
          lead_status: 'deleted',
          is_deleted: true,
        });
      }

      if (targetLead.message_id) {
        const key = targetLead.message_id.trim();
        state.processed_messages[key] = {
          message_key: key,
          sender_email: targetLead.sender_email,
          subject: targetLead.raw_subject || undefined,
          status: 'deleted',
          lead_id: targetLead.id,
          claimed_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
        };
        state.deleted_fingerprints.push(`msgid:${key}`);
      }

      const email = (targetLead.sender_email || '').toLowerCase().trim();
      if (email && targetLead.raw_body) {
        const bodySnippet = targetLead.raw_body.slice(0, 150).trim().toLowerCase();
        state.deleted_fingerprints.push(`${email}|${bodySnippet}`);
      }

      state.deleted_fingerprints = Array.from(new Set(state.deleted_fingerprints));
      await this.saveStorageState(state);
    }
  }

  async isDeletedEmail(params: {
    senderEmail: string;
    rawBody?: string;
    rawSubject?: string;
    messageId?: string;
  }): Promise<boolean> {
    const state = await this.ensureStorageState();
    const sender = params.senderEmail.toLowerCase().trim();
    const fps = state.deleted_fingerprints || [];

    if (params.messageId) {
      const key = params.messageId.trim();
      if (fps.includes(`msgid:${key}`)) return true;
      if (state.processed_messages[key]?.status === 'deleted') return true;
    }

    if (params.rawBody) {
      const bodySnippet = params.rawBody.slice(0, 150).trim().toLowerCase();
      if (fps.includes(`${sender}|${bodySnippet}`)) return true;
    }

    return state.leads.some(
      (l) =>
        (l.lead_status === 'deleted' || l.is_deleted === true) &&
        l.sender_email.toLowerCase().trim() === sender &&
        ((params.messageId && l.message_id === params.messageId) ||
          (params.rawBody && l.raw_body.trim() === params.rawBody.trim()))
    );
  }

  // =========================================================
  // 5. EQUIPMENT RECORDS (PHASE 10.2)
  // =========================================================
  async getEquipmentRecords(leadId?: string): Promise<EquipmentRecord[]> {
    const state = await this.ensureStorageState();
    if (leadId) {
      return state.equipment.filter((e) => e.lead_id === leadId);
    }
    return state.equipment;
  }

  async createEquipmentRecord(
    item: Omit<EquipmentRecord, 'id' | 'created_at'>
  ): Promise<EquipmentRecord> {
    return this.addEquipmentRecord(item);
  }

  async addEquipmentRecord(
    item: Omit<EquipmentRecord, 'id' | 'created_at'>
  ): Promise<EquipmentRecord> {
    const state = await this.ensureStorageState();
    const parsedPrice = parsePriceString(item.asking_price_raw);
    const amount = item.asking_price_amount ?? parsedPrice.amount;
    const currency = item.asking_price_currency || parsedPrice.currency || 'CHF';

    const purchase = item.purchase_estimate_chf ?? null;
    const transport = item.transport_cost_chf ?? null;
    const resale = item.estimated_resale_chf ?? null;
    const margin =
      resale !== null && purchase !== null
        ? Math.round(resale - purchase - (transport || 0))
        : item.margin_estimate_chf ?? null;

    const record: EquipmentRecord = {
      ...item,
      id: crypto.randomUUID(),
      asking_price_amount: amount,
      asking_price_currency: currency,
      margin_estimate_chf: margin,
      created_at: new Date().toISOString(),
    };

    state.equipment.unshift(record);
    await this.saveStorageState(state);
    return record;
  }

  async updateEquipmentRecord(
    id: string,
    patch: Partial<EquipmentRecord>
  ): Promise<EquipmentRecord | null> {
    const state = await this.ensureStorageState();
    const idx = state.equipment.findIndex((e) => e.id === id);
    if (idx === -1) return null;

    const current = state.equipment[idx];
    const updated: EquipmentRecord = {
      ...current,
      ...patch,
      id: current.id,
    };

    if (
      updated.estimated_resale_chf !== null &&
      updated.estimated_resale_chf !== undefined &&
      updated.purchase_estimate_chf !== null &&
      updated.purchase_estimate_chf !== undefined
    ) {
      updated.margin_estimate_chf = Math.round(
        updated.estimated_resale_chf -
          updated.purchase_estimate_chf -
          (updated.transport_cost_chf || 0)
      );
    }

    state.equipment[idx] = updated;
    await this.saveStorageState(state);
    return updated;
  }

  async deleteEquipmentRecord(id: string): Promise<boolean> {
    const state = await this.ensureStorageState();
    const before = state.equipment.length;
    state.equipment = state.equipment.filter((e) => e.id !== id);
    await this.saveStorageState(state);
    return state.equipment.length < before;
  }

  // =========================================================
  // 6. OUTBOUND LOGS & ATOMIC QUOTA / CLAIMING (PHASE 3 & 6)
  // =========================================================
  async getOutboundLogs(): Promise<OutboundLog[]> {
    const state = await this.ensureStorageState();
    const stateById = new Map(state.logs.map((l) => [l.id, l]));
    const mergedById = new Map<string, OutboundLog>();

    if (this.client && (await this.isSqlReady())) {
      const { data, error } = await this.client
        .from('outbound_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(500);

      if (!error && data) {
        for (const sqlLog of data as OutboundLog[]) {
          const local = stateById.get(sqlLog.id);
          mergedById.set(sqlLog.id, {
            ...local,
            ...sqlLog,
            full_body: sqlLog.full_body ?? local?.full_body,
            html_body: sqlLog.html_body ?? local?.html_body,
            recipient_email: sqlLog.recipient_email ?? local?.recipient_email,
            sender_email: sqlLog.sender_email ?? local?.sender_email,
            company_name: sqlLog.company_name ?? local?.company_name,
            canton: sqlLog.canton ?? local?.canton,
            smtp_message_id: sqlLog.smtp_message_id ?? local?.smtp_message_id,
            is_test: sqlLog.is_test ?? local?.is_test ?? false,
          });
        }
      }
    }

    for (const local of state.logs) {
      if (!mergedById.has(local.id)) {
        mergedById.set(local.id, local);
      }
    }

    const result = Array.from(mergedById.values()).sort(
      (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
    );
    state.logs = result;
    return result;
  }

  async addOutboundLog(log: Omit<OutboundLog, 'id' | 'sent_at'> & { sent_at?: string }): Promise<OutboundLog> {
    const state = await this.ensureStorageState();
    const record: OutboundLog = {
      ...log,
      id: crypto.randomUUID(),
      sent_at: log.sent_at || new Date().toISOString(),
    };

    if (this.client && (await this.isSqlReady())) {
      // Base columns guaranteed in 20261030000000_init_schema.sql
      const baseSqlRow: Record<string, any> = {
        id: record.id,
        company_id: record.company_id,
        sent_at: record.sent_at,
        language: record.language,
        subject: record.subject,
        body_snippet: record.body_snippet,
        delivery_status: record.delivery_status,
      };

      if (this.extendedSqlColumnsAvailable) {
        Object.assign(baseSqlRow, {
          sender_email: record.sender_email || null,
          recipient_email: record.recipient_email || null,
          company_name: record.company_name || null,
          canton: record.canton || null,
          full_body: record.full_body || null,
          html_body: record.html_body || null,
          smtp_message_id: record.smtp_message_id || null,
          error_message: record.error_message || null,
          is_test: Boolean(record.is_test),
        });
      }

      const { error } = await this.client.from('outbound_logs').insert(baseSqlRow);
      if (error) {
        console.warn('[Supabase] SQL addOutboundLog warning:', error.message);
      }
    }

    state.logs.unshift(record);
    await this.saveStorageState(state);
    return record;
  }

  async updateOutboundLogStatus(
    id: string,
    patch: Partial<OutboundLog>
  ): Promise<OutboundLog | null> {
    const state = await this.ensureStorageState();
    const idx = state.logs.findIndex((l) => l.id === id);
    if (idx === -1) return null;

    state.logs[idx] = { ...state.logs[idx], ...patch };

    if (this.client && (await this.isSqlReady()) && patch.delivery_status) {
      await this.client
        .from('outbound_logs')
        .update({ delivery_status: patch.delivery_status })
        .eq('id', id);
    }

    await this.saveStorageState(state);
    return state.logs[idx];
  }

  async deleteOutboundLog(id: string): Promise<void> {
    if (this.client && (await this.isSqlReady())) {
      try {
        await this.client.from('outbound_logs').delete().eq('id', id);
      } catch (e) {
        console.warn('[Supabase] SQL deleteOutboundLog warning:', e);
      }
    }
    const state = await this.ensureStorageState();
    state.logs = state.logs.filter((l) => l.id !== id);
    await this.saveStorageState(state);
  }

  /**
   * Counts outreach emails sent during the current Europe/Zurich calendar day.
   * Excludes test previews (is_test === true) and failed/bounced attempts.
   */
  async getTodaySentCount(referenceDate = new Date()): Promise<number> {
    const logs = await this.getOutboundLogs();
    const countedStatuses = new Set(['accepted', 'delivered', 'simulated', 'sending']);
    const activeReservations = this.activeCompanyClaims.size;

    const sentCount = logs.filter(
      (l) =>
        !l.is_test &&
        countedStatuses.has(l.delivery_status) &&
        isSameSwissDay(l.sent_at, referenceDate)
    ).length;

    return sentCount + activeReservations;
  }

  /**
   * Atomically claims the next eligible contractor and reserves 1 daily quota slot.
   * Prevents concurrent requests from choosing the same company or exceeding daily_limit.
   */
  async claimNextEligibleCompany(options?: {
    referenceDate?: Date;
    companyId?: string;
  }): Promise<{
    claimed: boolean;
    reason?: 'paused' | 'quota_reached' | 'no_eligible_company' | 'busy';
    company?: Company;
    settings?: AgentSettings;
    todaySentCount?: number;
  }> {
    if (this.isClaimingOutbound) {
      return { claimed: false, reason: 'busy' };
    }

    this.isClaimingOutbound = true;
    try {
      const refDate = options?.referenceDate || new Date();
      const [settings, companies, suppressions, todaySentCount] = await Promise.all([
        this.getSettings(),
        this.getCompanies(),
        this.getSuppressions(),
        this.getTodaySentCount(refDate),
      ]);

      if (!settings.is_active || !settings.outreach_active) {
        return { claimed: false, reason: 'paused', settings, todaySentCount };
      }

      if (todaySentCount >= settings.daily_limit) {
        return { claimed: false, reason: 'quota_reached', settings, todaySentCount };
      }

      const nowMs = refDate.getTime();
      const candidate = companies.find(
        (c) =>
          (!options?.companyId || c.id === options.companyId) &&
          !this.activeCompanyClaims.has(c.id) &&
          settings.selected_cantons.includes(c.canton) &&
          isEligibleForOutbound(c.last_contacted_at, c.unsubscribed, {
            email: c.email,
            verifiedEmail: c.verified_email,
            suppressions,
            claimedAt: c.claimed_at,
            nowMs,
          })
      );

      if (!candidate) {
        return { claimed: false, reason: 'no_eligible_company', settings, todaySentCount };
      }

      this.activeCompanyClaims.add(candidate.id);
      const claimedIso = refDate.toISOString();
      await this.updateCompany(candidate.id, {
        claimed_at: claimedIso,
        claim_token: crypto.randomUUID(),
      });

      return {
        claimed: true,
        company: candidate,
        settings,
        todaySentCount: todaySentCount + 1,
      };
    } finally {
      this.isClaimingOutbound = false;
    }
  }

  async releaseCompanyClaim(companyId: string, markContactedAt?: string | null): Promise<void> {
    this.activeCompanyClaims.delete(companyId);
    const patch: Partial<Company> = {
      claimed_at: null,
      claim_token: null,
    };
    if (markContactedAt !== undefined) {
      patch.last_contacted_at = markContactedAt;
    }
    await this.updateCompany(companyId, patch);
  }

  async getSchedulerMeta(): Promise<PersistedSchedulerMeta> {
    const state = await this.ensureStorageState();
    return state.scheduler || {};
  }

  async updateSchedulerMeta(patch: Partial<PersistedSchedulerMeta>): Promise<PersistedSchedulerMeta> {
    const state = await this.ensureStorageState();
    state.scheduler = {
      ...(state.scheduler || {}),
      ...patch,
    };
    await this.saveStorageState(state);
    return state.scheduler;
  }

  // =========================================================
  // 9. AUTONOMOUS COMPANY DISCOVERY
  // =========================================================
  async getDiscoveryRecords(limit = 250): Promise<DiscoveryRecord[]> {
    const state = await this.ensureStorageState();
    const safeLimit = Math.max(1, Math.min(2000, limit));
    if (this.client && (await this.isSqlReady()) && this.discoverySqlAvailable) {
      const { data, error } = await this.client
        .from('discovery_records')
        .select('*')
        .order('discovered_at', { ascending: false })
        .limit(safeLimit);
      if (!error && data) {
        const merged = new Map<string, DiscoveryRecord>();
        for (const record of [...(data as DiscoveryRecord[]), ...state.discovery_records]) {
          if (!merged.has(record.id)) merged.set(record.id, record);
        }
        state.discovery_records = Array.from(merged.values())
          .sort((a, b) => b.discovered_at.localeCompare(a.discovered_at))
          .slice(0, 2000);
      }
    }
    return state.discovery_records.slice(0, safeLimit);
  }

  async hasDiscoverySource(source: DiscoveryRecord['source'], sourceId: string): Promise<boolean> {
    const state = await this.ensureStorageState();
    return state.discovery_records.some(
      (record) => record.source === source && record.source_id === sourceId
    );
  }

  async addDiscoveryRecord(
    record: Omit<DiscoveryRecord, 'id' | 'discovered_at'> & {
      id?: string;
      discovered_at?: string;
    }
  ): Promise<DiscoveryRecord> {
    const state = await this.ensureStorageState();
    const existing = state.discovery_records.find(
      (item) => item.source === record.source && item.source_id === record.source_id
    );
    if (existing) return existing;

    const saved: DiscoveryRecord = {
      ...record,
      id: record.id || crypto.randomUUID(),
      discovered_at: record.discovered_at || new Date().toISOString(),
    };
    state.discovery_records.unshift(saved);
    if (state.discovery_records.length > 2000) {
      state.discovery_records = state.discovery_records.slice(0, 2000);
    }
    if (this.client && (await this.isSqlReady()) && this.discoverySqlAvailable) {
      const { error } = await this.client.from('discovery_records').insert(saved);
      if (error) console.warn('[Supabase] SQL discovery record insert warning:', error.message);
    }
    await this.saveStorageState(state);
    return saved;
  }

  async getDiscoveryStats(referenceDate = new Date()): Promise<DiscoveryStats> {
    const records = await this.getDiscoveryRecords(2000);
    const today = records.filter((record) =>
      isSameSwissDay(record.discovered_at, referenceDate)
    );
    return {
      found_today: today.length,
      ready_today: today.filter((r) => r.status === 'ready').length,
      missing_email_today: today.filter((r) => r.status === 'missing_email').length,
      duplicates_today: today.filter((r) => r.status === 'duplicate').length,
      rejected_today: today.filter((r) => r.status === 'rejected').length,
      total_discovered: records.length,
    };
  }

  async getDiscoveryMeta(): Promise<PersistedDiscoveryMeta> {
    const state = await this.ensureStorageState();
    return state.discovery || {};
  }

  async updateDiscoveryMeta(
    patch: Partial<PersistedDiscoveryMeta>
  ): Promise<PersistedDiscoveryMeta> {
    const state = await this.ensureStorageState();
    state.discovery = { ...(state.discovery || {}), ...patch };
    await this.saveStorageState(state);
    return state.discovery;
  }

  // =========================================================
  // 11. CONTROLLED AGENT ACTIONS & WATCHLISTS
  // =========================================================
  async getAgentActions(): Promise<AgentAction[]> {
    const state = await this.ensureStorageState();
    return [...state.agent_actions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async createAgentAction(
    input: Omit<AgentAction, 'id' | 'created_at' | 'updated_at'>
  ): Promise<AgentAction> {
    const state = await this.ensureStorageState();
    const duplicate = state.agent_actions.find(
      (item) =>
        item.type === input.type &&
        item.company_id === input.company_id &&
        item.lead_id === input.lead_id &&
        (item.status === 'scheduled' || item.status === 'pending_approval')
    );
    if (duplicate) return duplicate;
    const now = new Date().toISOString();
    const action: AgentAction = {
      ...input,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    };
    state.agent_actions.unshift(action);
    state.agent_actions = state.agent_actions.slice(0, 1000);
    await this.saveStorageState(state);
    await this.recordAuditLog(
      'agent_action_created',
      'agent_action',
      `${action.title} · ${action.status} · ${action.rule}`,
      action.id
    );
    return action;
  }

  async updateAgentAction(
    id: string,
    patch: Partial<AgentAction>
  ): Promise<AgentAction | null> {
    const state = await this.ensureStorageState();
    const index = state.agent_actions.findIndex((item) => item.id === id);
    if (index < 0) return null;
    state.agent_actions[index] = {
      ...state.agent_actions[index],
      ...patch,
      id,
      updated_at: new Date().toISOString(),
    };
    await this.saveStorageState(state);
    return state.agent_actions[index];
  }

  async cancelAgentActionsForRecipient(email: string, reason: string): Promise<number> {
    const state = await this.ensureStorageState();
    const clean = email.trim().toLowerCase();
    let count = 0;
    for (const action of state.agent_actions) {
      if (
        action.recipient_email?.toLowerCase() === clean &&
        (action.status === 'scheduled' || action.status === 'pending_approval')
      ) {
        action.status = 'cancelled';
        action.error = reason;
        action.updated_at = new Date().toISOString();
        count++;
      }
    }
    if (count > 0) await this.saveStorageState(state);
    return count;
  }

  async getWatchlists(): Promise<WatchlistRule[]> {
    const state = await this.ensureStorageState();
    return state.watchlists;
  }

  async createWatchlist(
    input: Omit<WatchlistRule, 'id' | 'created_at' | 'updated_at'>
  ): Promise<WatchlistRule> {
    const state = await this.ensureStorageState();
    const now = new Date().toISOString();
    const rule: WatchlistRule = { ...input, id: crypto.randomUUID(), created_at: now, updated_at: now };
    state.watchlists.unshift(rule);
    await this.saveStorageState(state);
    return rule;
  }

  async updateWatchlist(id: string, patch: Partial<WatchlistRule>): Promise<WatchlistRule | null> {
    const state = await this.ensureStorageState();
    const index = state.watchlists.findIndex((item) => item.id === id);
    if (index < 0) return null;
    state.watchlists[index] = { ...state.watchlists[index], ...patch, id, updated_at: new Date().toISOString() };
    await this.saveStorageState(state);
    return state.watchlists[index];
  }

  async deleteWatchlist(id: string): Promise<boolean> {
    const state = await this.ensureStorageState();
    const before = state.watchlists.length;
    state.watchlists = state.watchlists.filter((item) => item.id !== id);
    if (before === state.watchlists.length) return false;
    await this.saveStorageState(state);
    return true;
  }

  /**
   * Explicit reconciliation procedure to sync fallback Storage records into Supabase SQL tables.
   */
  async reconcileFallbackToSql(): Promise<{
    sqlReady: boolean;
    companiesSynced: number;
    leadsSynced: number;
    logsSynced: number;
  }> {
    const schema = await this.checkSqlSchema();
    if (!schema.sqlReady || !this.client) {
      return { sqlReady: false, companiesSynced: 0, leadsSynced: 0, logsSynced: 0 };
    }

    const state = await this.ensureStorageState();
    let companiesSynced = 0;
    let leadsSynced = 0;
    let logsSynced = 0;

    for (const c of state.companies) {
      if (!c.email) continue;
      const { error } = await this.client.from('companies').upsert(
        {
          id: c.id,
          name: c.name,
          domain: c.domain || null,
          canton: c.canton.slice(0, 4),
          language: c.language,
          email: c.email,
          phone: c.phone || null,
          industry: c.industry || 'civil_engineering',
          unsubscribed: c.unsubscribed,
          last_contacted_at: c.last_contacted_at || null,
          created_at: c.created_at,
        },
        { onConflict: 'email' }
      );
      if (!error) companiesSynced++;
    }

    for (const l of state.leads) {
      const safeIntent = ['HOT_LEAD', 'NOT_INTERESTED', 'UNSUBSCRIBE', 'OUT_OF_OFFICE'].includes(
        l.intent
      )
        ? l.intent
        : 'HOT_LEAD';
      const { error } = await this.client.from('inbound_leads').upsert({
        id: l.id,
        company_id: l.company_id || null,
        sender_email: l.sender_email,
        raw_subject: l.raw_subject || null,
        raw_body: l.raw_body,
        intent: safeIntent,
        machinery_detected: l.machinery_detected,
        contact_name: l.contact_name || null,
        contact_phone: l.contact_phone || null,
        lead_status: l.lead_status,
        ai_summary: l.ai_summary || null,
        received_at: l.received_at,
      });
      if (!error) leadsSynced++;
    }

    for (const log of state.logs) {
      if (!log.company_id) continue;
      const { error } = await this.client.from('outbound_logs').upsert({
        id: log.id,
        company_id: log.company_id,
        sent_at: log.sent_at,
        language: log.language,
        subject: log.subject,
        body_snippet: log.body_snippet,
        delivery_status: log.delivery_status,
      });
      if (!error) logsSynced++;
    }

    return { sqlReady: true, companiesSynced, leadsSynced, logsSynced };
  }
}

export const supabaseDataService = new SupabaseDataService();
