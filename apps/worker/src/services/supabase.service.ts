import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/env.ts';
import {
  AgentSettings,
  Company,
  OutboundLog,
  DealStatus,
} from '@/packages/types/src/database.ts';
import { InboundLead } from '@/packages/types/src/lead.ts';

const STORAGE_BUCKET = 'jimiscout-data';
const STATE_FILE = 'production-state.json';

interface PersistedState {
  settings: AgentSettings;
  companies: Company[];
  leads: InboundLead[];
  logs: OutboundLog[];
}

export class SupabaseDataService {
  private client: SupabaseClient | null = null;
  private sqlTablesAvailable: boolean | null = null;
  private cachedState: PersistedState | null = null;

  constructor() {
    if (config.supabase.url && config.supabase.serviceKey) {
      this.client = createClient(config.supabase.url, config.supabase.serviceKey, {
        auth: { persistSession: false },
      });
    }
  }

  private getDefaultSettings(): AgentSettings {
    return {
      id: '00000000-0000-4000-8000-000000000001',
      is_active: false,
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
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Checks whether the user has executed the SQL DDL migration in Supabase SQL Editor.
   */
  async checkSqlSchema(): Promise<{ sqlReady: boolean; error?: string }> {
    if (!this.client) {
      return { sqlReady: false, error: 'Missing Supabase URL or Service Role Key' };
    }
    const { error } = await this.client.from('agent_settings').select('id').limit(1);
    if (!error) {
      this.sqlTablesAvailable = true;
      return { sqlReady: true };
    }
    this.sqlTablesAvailable = false;
    return { sqlReady: false, error: error.message };
  }

  /**
   * Ensures the private Supabase Storage bucket exists for backing state when SQL tables aren't migrated yet,
   * and syncs any stored records into SQL tables once SQL tables become available.
   */
  private async ensureStorageState(): Promise<PersistedState> {
    if (this.cachedState) return this.cachedState;

    const initial: PersistedState = {
      settings: this.getDefaultSettings(),
      companies: [],
      leads: [],
      logs: [],
    };

    if (!this.client) {
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
        const parsed = JSON.parse(text) as PersistedState;
        this.cachedState = {
          settings: parsed.settings || initial.settings,
          companies: Array.isArray(parsed.companies) ? parsed.companies : [],
          leads: Array.isArray(parsed.leads) ? parsed.leads : [],
          logs: Array.isArray(parsed.logs) ? parsed.logs : [],
        };
        return this.cachedState;
      }

      // Initialize file in Supabase Storage
      await this.saveStorageState(initial);
      this.cachedState = initial;
      return initial;
    } catch (err) {
      console.error('[Supabase] Storage init error:', err);
      this.cachedState = initial;
      return initial;
    }
  }

  private async saveStorageState(state: PersistedState): Promise<void> {
    this.cachedState = state;
    if (!this.client) return;
    try {
      const payload = JSON.stringify(state, null, 2);
      await this.client.storage.from(STORAGE_BUCKET).upload(STATE_FILE, payload, {
        upsert: true,
        contentType: 'application/json',
      });
    } catch (err) {
      console.error('[Supabase] Failed to persist state to Supabase Storage:', err);
    }
  }

  private async isSqlReady(): Promise<boolean> {
    if (this.sqlTablesAvailable !== null) return this.sqlTablesAvailable;
    const { sqlReady } = await this.checkSqlSchema();
    return sqlReady;
  }

  // =========================================================
  // 1. AGENT SETTINGS
  // =========================================================
  async getSettings(): Promise<AgentSettings> {
    if (this.client && (await this.isSqlReady())) {
      const { data, error } = await this.client
        .from('agent_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return data as AgentSettings;
      }
      if (!error && !data) {
        const defaults = this.getDefaultSettings();
        const { data: inserted, error: insErr } = await this.client
          .from('agent_settings')
          .insert(defaults)
          .select('*')
          .single();
        if (!insErr && inserted) return inserted as AgentSettings;
      }
    }

    const state = await this.ensureStorageState();
    return state.settings;
  }

  async updateSettings(patch: Partial<AgentSettings>): Promise<AgentSettings> {
    const current = await this.getSettings();
    const updated: AgentSettings = {
      ...current,
      ...patch,
      updated_at: new Date().toISOString(),
    };

    if (this.client && (await this.isSqlReady())) {
      const { data, error } = await this.client
        .from('agent_settings')
        .upsert(updated)
        .select('*')
        .single();
      if (!error && data) return data as AgentSettings;
    }

    const state = await this.ensureStorageState();
    state.settings = updated;
    await this.saveStorageState(state);
    return updated;
  }

  // =========================================================
  // 2. COMPANIES (CONTRACTORS DIRECTORY)
  // =========================================================
  async getCompanies(): Promise<Company[]> {
    if (this.client && (await this.isSqlReady())) {
      const { data, error } = await this.client
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return data as Company[];
    }

    const state = await this.ensureStorageState();
    return state.companies;
  }

  async addCompany(
    company: Omit<Company, 'id' | 'created_at' | 'unsubscribed'> & {
      unsubscribed?: boolean;
    }
  ): Promise<Company> {
    const record: Company = {
      id: crypto.randomUUID(),
      name: company.name.trim(),
      domain: company.domain?.trim() || null,
      canton: company.canton.trim().toUpperCase(),
      language: company.language,
      email: company.email.trim().toLowerCase(),
      phone: company.phone?.trim() || null,
      industry: company.industry || 'civil_engineering',
      unsubscribed: company.unsubscribed ?? false,
      last_contacted_at: company.last_contacted_at || null,
      created_at: new Date().toISOString(),
    };

    if (this.client && (await this.isSqlReady())) {
      const { data, error } = await this.client
        .from('companies')
        .upsert(record, { onConflict: 'email' })
        .select('*')
        .single();
      if (!error && data) return data as Company;
    }

    const state = await this.ensureStorageState();
    const existingIdx = state.companies.findIndex((c) => c.email === record.email);
    if (existingIdx >= 0) {
      state.companies[existingIdx] = { ...state.companies[existingIdx], ...record };
      await this.saveStorageState(state);
      return state.companies[existingIdx];
    }
    state.companies.unshift(record);
    await this.saveStorageState(state);
    return record;
  }

  async deleteCompany(id: string): Promise<void> {
    if (this.client && (await this.isSqlReady())) {
      await this.client.from('companies').delete().eq('id', id);
      return;
    }
    const state = await this.ensureStorageState();
    state.companies = state.companies.filter((c) => c.id !== id);
    await this.saveStorageState(state);
  }

  async findCompanyByEmail(email: string): Promise<Company | null> {
    const clean = email.trim().toLowerCase();
    const all = await this.getCompanies();
    return all.find((c) => c.email.toLowerCase() === clean) || null;
  }

  async updateCompany(id: string, patch: Partial<Company>): Promise<void> {
    if (this.client && (await this.isSqlReady())) {
      await this.client.from('companies').update(patch).eq('id', id);
      return;
    }
    const state = await this.ensureStorageState();
    const idx = state.companies.findIndex((c) => c.id === id);
    if (idx !== -1) {
      state.companies[idx] = { ...state.companies[idx], ...patch };
      await this.saveStorageState(state);
    }
  }

  // =========================================================
  // 3. INBOUND LEADS (CRM DEALS)
  // =========================================================
  async getLeads(): Promise<InboundLead[]> {
    if (this.client && (await this.isSqlReady())) {
      const { data, error } = await this.client
        .from('inbound_leads')
        .select('*, companies(name, canton)')
        .order('received_at', { ascending: false });

      if (!error && data) {
        return data.map((row: any) => ({
          ...row,
          company_name: row.company_name || row.companies?.name || row.sender_email,
          canton: row.canton || row.companies?.canton || 'CH',
        })) as InboundLead[];
      }
    }

    const state = await this.ensureStorageState();
    return state.leads;
  }

  async createLead(
    lead: Omit<InboundLead, 'id' | 'received_at'>
  ): Promise<InboundLead> {
    const record: InboundLead = {
      ...lead,
      id: crypto.randomUUID(),
      received_at: new Date().toISOString(),
    };

    if (this.client && (await this.isSqlReady())) {
      const dbRow = {
        id: record.id,
        company_id: record.company_id || null,
        sender_email: record.sender_email,
        raw_subject: record.raw_subject || null,
        raw_body: record.raw_body,
        intent: record.intent,
        machinery_detected: record.machinery_detected,
        contact_name: record.contact_name || null,
        contact_phone: record.contact_phone || null,
        lead_status: record.lead_status,
        ai_summary: record.ai_summary || null,
        received_at: record.received_at,
      };
      const { data, error } = await this.client
        .from('inbound_leads')
        .insert(dbRow)
        .select('*')
        .single();
      if (!error && data) {
        return {
          ...data,
          company_name: record.company_name,
          canton: record.canton,
        } as InboundLead;
      }
    }

    const state = await this.ensureStorageState();
    state.leads.unshift(record);
    await this.saveStorageState(state);
    return record;
  }

  async updateLeadStatus(id: string, lead_status: DealStatus): Promise<InboundLead | null> {
    if (this.client && (await this.isSqlReady())) {
      const { data, error } = await this.client
        .from('inbound_leads')
        .update({ lead_status })
        .eq('id', id)
        .select('*')
        .single();
      if (!error && data) return data as InboundLead;
    }

    const state = await this.ensureStorageState();
    const idx = state.leads.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    state.leads[idx] = { ...state.leads[idx], lead_status };
    await this.saveStorageState(state);
    return state.leads[idx];
  }

  async deleteLead(id: string): Promise<void> {
    if (this.client && (await this.isSqlReady())) {
      await this.client.from('inbound_leads').delete().eq('id', id);
      return;
    }
    const state = await this.ensureStorageState();
    state.leads = state.leads.filter((l) => l.id !== id);
    await this.saveStorageState(state);
  }

  // =========================================================
  // 4. OUTBOUND LOGS
  // =========================================================
  async getOutboundLogs(): Promise<OutboundLog[]> {
    if (this.client && (await this.isSqlReady())) {
      const { data, error } = await this.client
        .from('outbound_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(100);
      if (!error && data) return data as OutboundLog[];
    }

    const state = await this.ensureStorageState();
    return state.logs;
  }

  async addOutboundLog(
    log: Omit<OutboundLog, 'id' | 'sent_at'>
  ): Promise<OutboundLog> {
    const record: OutboundLog = {
      ...log,
      id: crypto.randomUUID(),
      sent_at: new Date().toISOString(),
    };

    if (this.client && (await this.isSqlReady())) {
      const { data, error } = await this.client
        .from('outbound_logs')
        .insert(record)
        .select('*')
        .single();
      if (!error && data) return data as OutboundLog;
    }

    const state = await this.ensureStorageState();
    state.logs.unshift(record);
    await this.saveStorageState(state);
    return record;
  }

  async getTodaySentCount(): Promise<number> {
    const logs = await this.getOutboundLogs();
    const todayPrefix = new Date().toISOString().slice(0, 10);
    return logs.filter(
      (l) => l.sent_at.startsWith(todayPrefix) && l.delivery_status === 'delivered'
    ).length;
  }
}

export const supabaseDataService = new SupabaseDataService();
