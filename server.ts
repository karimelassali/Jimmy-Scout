import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  isSwissBusinessHours,
  getLanguageForCanton,
  resolveCompanyLanguage,
} from './apps/worker/src/scheduler.ts';
import { generateDeTemplate } from './apps/worker/src/templates/de.template.ts';
import { generateFrTemplate } from './apps/worker/src/templates/fr.template.ts';
import { generateItTemplate } from './apps/worker/src/templates/it.template.ts';
import { smtpService } from './apps/worker/src/services/smtp.service.ts';
import { imapService } from './apps/worker/src/services/imap.service.ts';
import { telegramService } from './apps/worker/src/services/telegram.service.ts';
import { geminiService } from './apps/worker/src/services/gemini.service.ts';
import { supabaseDataService } from './apps/worker/src/services/supabase.service.ts';
import { inboundService } from './apps/worker/src/services/inbound.service.ts';
import { outboundScheduler } from './apps/worker/src/services/outbound-scheduler.service.ts';
import { companyDiscoveryService } from './apps/worker/src/services/company-discovery.service.ts';
import { normalizeCantonCode } from './packages/types/src/swiss.ts';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

// If SMTP_PASS is unset, fall back only to IMAP_PASS from environment (never hardcode secrets)
if (!process.env.SMTP_PASS && process.env.IMAP_PASS) {
  process.env.SMTP_PASS = process.env.IMAP_PASS;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = Number(process.env.PORT) || 3000;
const safePreview = process.env.JIMISCOUT_SAFE_PREVIEW === 'true';

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// ----------------------------------------------------
// SECURITY: Rate Limiter, Auth & Webhook Verification
// ----------------------------------------------------
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'local';
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please wait before retrying.',
        retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
      });
    }
    bucket.count += 1;
    return next();
  };
}

function getConfiguredAdminToken(): string {
  return (process.env.JIMISCOUT_ADMIN_TOKEN || process.env.ADMIN_API_TOKEN || '').trim();
}

function computeSessionCookieValue(token: string): string {
  return crypto.createHmac('sha256', token).update('jimiscout-owner-session-v1').digest('hex');
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim();
      const v = decodeURIComponent(pair.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

function isRequestAuthenticated(req: express.Request): boolean {
  const adminToken = getConfiguredAdminToken();
  if (!adminToken) {
    // When JIMISCOUT_ADMIN_TOKEN is not set in local dev, allow requests while reporting authRequired: false
    return true;
  }

  const headerToken =
    (req.headers['x-admin-token'] as string)?.trim() ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : '');

  if (headerToken && headerToken.length === adminToken.length) {
    try {
      if (crypto.timingSafeEqual(Buffer.from(headerToken), Buffer.from(adminToken))) {
        return true;
      }
    } catch {
      // ignore length mismatch
    }
  }

  const cookies = parseCookies(req.headers.cookie);
  const expectedCookie = computeSessionCookieValue(adminToken);
  if (cookies.jimiscout_session && cookies.jimiscout_session === expectedCookie) {
    return true;
  }

  return false;
}

function requireAdminAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (isRequestAuthenticated(req)) {
    return next();
  }
  return res.status(401).json({
    error: 'Unauthorized: Valid owner session or x-admin-token required.',
    authRequired: true,
  });
}

// Replay cache for webhook signatures
const processedWebhookNonces = new Map<string, number>();

function verifyWebhookAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  // Allow if already authenticated as admin
  if (getConfiguredAdminToken() && isRequestAuthenticated(req)) {
    return next();
  }

  const webhookSecret = (process.env.WEBHOOK_SECRET || '').trim();
  if (!webhookSecret) {
    // If no WEBHOOK_SECRET configured, fall back to admin auth check
    return requireAdminAuth(req, res, next);
  }

  // Check timestamp replay protection if provided
  const timestampHeader = (req.headers['x-webhook-timestamp'] as string)?.trim();
  if (timestampHeader) {
    const ts = Number(timestampHeader);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
      return res.status(401).json({ error: 'Webhook timestamp expired or invalid.' });
    }
  }

  const providedSecret =
    (req.headers['x-webhook-secret'] as string)?.trim() ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : '');

  if (providedSecret && providedSecret === webhookSecret) {
    return next();
  }

  const signature = (req.headers['x-webhook-signature'] as string)?.trim();
  if (signature) {
    const payloadString = JSON.stringify(req.body || {});
    const base = timestampHeader ? `${timestampHeader}.${payloadString}` : payloadString;
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(base)
      .digest('hex');

    if (signature === expectedSig || signature === `sha256=${expectedSig}`) {
      const nonceKey = `${timestampHeader || 'no-ts'}:${expectedSig}`;
      if (processedWebhookNonces.has(nonceKey)) {
        return res.status(409).json({ error: 'Webhook replay rejected.' });
      }
      processedWebhookNonces.set(nonceKey, Date.now());
      return next();
    }
  }

  return res.status(401).json({
    error: 'Unauthorized webhook request: valid x-webhook-secret or x-webhook-signature required.',
  });
}

// CSV Formula Injection Protection (neutralize =, +, -, @, \t, \r at start of cell)
export function sanitizeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

// RFC-4180 compliant CSV parser supporting quoted fields and commas/semicolons
export function parseCsvContent(csvText: string): Array<Record<string, string>> {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  const delimiter =
    (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

  const splitRow = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = splitRow(lines[0]).map((h) => h.toLowerCase().trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitRow(lines[i]);
    if (values.every((v) => !v)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

// ----------------------------------------------------
// AUTHENTICATION ENDPOINTS
// ----------------------------------------------------
app.get('/api/auth/session', (req, res) => {
  const adminToken = getConfiguredAdminToken();
  res.json({
    authRequired: Boolean(adminToken),
    authenticated: isRequestAuthenticated(req),
  });
});

app.post('/api/auth/login', rateLimit(10, 60_000), (req, res) => {
  const adminToken = getConfiguredAdminToken();
  if (!adminToken) {
    return res.json({ success: true, authenticated: true, authRequired: false });
  }

  const provided = String(req.body?.token || req.body?.password || '').trim();
  if (!provided || provided !== adminToken) {
    return res.status(401).json({ success: false, error: 'Invalid access token.' });
  }

  const cookieVal = computeSessionCookieValue(adminToken);
  res.setHeader(
    'Set-Cookie',
    `jimiscout_session=${cookieVal}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
  );
  return res.json({ success: true, authenticated: true });
});

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', 'jimiscout_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ success: true });
});

// ----------------------------------------------------
// PUBLIC / SEMI-PUBLIC HEALTH ENDPOINT
// ----------------------------------------------------
app.get('/api/health', async (_req, res) => {
  try {
    const [settings, leads, companies, logs, todaySent, schemaCheck, schedulerStatus, discoveryStatus] =
      await Promise.all([
        supabaseDataService.getSettings(),
        supabaseDataService.getLeads(),
        supabaseDataService.getCompanies(),
        supabaseDataService.getOutboundLogs(),
        supabaseDataService.getTodaySentCount(),
        supabaseDataService.checkSqlSchema(),
        outboundScheduler.getStatus(),
        companyDiscoveryService.getStatus(),
      ]);

    res.json({
      status: 'ok',
      app: 'JimiScout BTP',
      swiss_time: new Date().toISOString(),
      is_swiss_business_hours: isSwissBusinessHours(),
      agent_active: settings.is_active,
      today_sent: todaySent,
      daily_limit: settings.daily_limit,
      leads_count: leads.length,
      companies_count: companies.length,
      logs_count: logs.length,
      sql_ready: schemaCheck.sqlReady,
      storage_mode: supabaseDataService.getStorageMode(),
      scheduler: schedulerStatus,
      discovery: discoveryStatus,
      integrations: {
        supabase_configured: Boolean(
          process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ),
        gemini_configured: Boolean(process.env.GEMINI_API_KEY),
        google_places_configured: Boolean(process.env.GOOGLE_PLACES_API_KEY),
        foursquare_configured: Boolean(process.env.FOURSQUARE_API_KEY),
        openstreetmap_configured: Boolean(process.env.OSM_OVERPASS_URL),
        zefix_configured: Boolean(process.env.ZEFIX_USERNAME && process.env.ZEFIX_PASSWORD),
        telegram_configured: Boolean(
          process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CLIENT_CHAT_ID
        ),
        smtp_configured: Boolean(
          process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
        ),
        imap_configured: Boolean(
          process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASS
        ),
      },
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err?.message });
  }
});

// Protect all sensitive /api/* routes below (except /api/webhooks/imap which uses verifyWebhookAuth)
app.use('/api', (req, res, next) => {
  if (safePreview && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return res.status(409).json({
      status: 'preview_only',
      message: 'This local preview is read-only. Production actions run on Railway.',
    });
  }
  return next();
});

app.use('/api', (req, res, next) => {
  if (
    req.path === '/health' ||
    req.path.startsWith('/auth/') ||
    req.path === '/webhooks/imap'
  ) {
    return next();
  }
  return requireAdminAuth(req, res, next);
});

// 2. SQL Migration DDL Helper
app.get('/api/sql-migration', (_req, res) => {
  try {
    const initPath = path.resolve(
      __dirname,
      'supabase/migrations/20261030000000_init_schema.sql'
    );
    const repairPath = path.resolve(
      __dirname,
      'supabase/migrations/20261102000000_audit_repairs_and_crm.sql'
    );
    const sqlParts: string[] = [];
    if (fs.existsSync(initPath)) sqlParts.push(fs.readFileSync(initPath, 'utf-8'));
    if (fs.existsSync(repairPath)) sqlParts.push(fs.readFileSync(repairPath, 'utf-8'));
    res.json({ sql: sqlParts.join('\n\n') });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to read SQL migration files' });
  }
});

// Reconcile fallback store to Supabase SQL explicitly
app.post('/api/admin/reconcile-sql', async (_req, res) => {
  try {
    const report = await supabaseDataService.reconcileFallbackToSql();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'SQL reconciliation failed' });
  }
});

app.get('/api/audit-logs', async (_req, res) => {
  try {
    const logs = await supabaseDataService.getAuditLogs();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// 3. Settings (Master toggle, cantons, limit, tone, hooks)
app.get('/api/settings', async (_req, res) => {
  try {
    const settings = await supabaseDataService.getSettings();
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.patch('/api/settings', async (req, res) => {
  try {
    const allowed: Record<string, unknown> = {};
    const body = req.body || {};

    if (typeof body.is_active === 'boolean') allowed.is_active = body.is_active;
    if (typeof body.discovery_active === 'boolean') allowed.discovery_active = body.discovery_active;
    if (typeof body.outreach_active === 'boolean') allowed.outreach_active = body.outreach_active;
    if (typeof body.discovery_daily_limit === 'number' && Number.isFinite(body.discovery_daily_limit)) {
      allowed.discovery_daily_limit = Math.max(1, Math.min(200, Math.round(body.discovery_daily_limit)));
    }
    if (typeof body.discovery_interval_minutes === 'number' && Number.isFinite(body.discovery_interval_minutes)) {
      allowed.discovery_interval_minutes = Math.max(30, Math.min(1440, Math.round(body.discovery_interval_minutes)));
    }
    if (Array.isArray(body.discovery_keywords)) {
      allowed.discovery_keywords = body.discovery_keywords
        .map((value: unknown) => String(value).trim())
        .filter(Boolean)
        .slice(0, 20);
    }
    if (typeof body.daily_limit === 'number' && Number.isFinite(body.daily_limit)) {
      allowed.daily_limit = Math.max(1, Math.min(200, Math.round(body.daily_limit)));
    }
    if (Array.isArray(body.selected_cantons)) {
      allowed.selected_cantons = body.selected_cantons
        .map((c: unknown) => normalizeCantonCode(String(c)))
        .filter((c: string) => c !== 'CH');
    }
    if (
      body.tone === 'swiss_formal' ||
      body.tone === 'approachable_trade' ||
      body.tone === 'fast_cash'
    ) {
      allowed.tone = body.tone;
    }
    if (Array.isArray(body.hooks)) {
      allowed.hooks = body.hooks.map((h: unknown) => String(h).trim()).filter(Boolean);
    }
    if (typeof body.equipment_focus === 'string') {
      allowed.equipment_focus = body.equipment_focus.trim();
    }
    if (typeof body.sender_name === 'string') {
      allowed.sender_name = body.sender_name.trim();
    }
    if (typeof body.sender_email === 'string') {
      allowed.sender_email = body.sender_email.trim();
    }
    if (typeof body.sender_phone === 'string') {
      allowed.sender_phone = body.sender_phone.trim();
    }

    const updated = await supabaseDataService.updateSettings(allowed);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// 4. Leads (CRM Deals & Follow-up Workflow)
app.get('/api/leads', async (_req, res) => {
  try {
    const leads = await supabaseDataService.getLeads();
    res.json(leads);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.patch('/api/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const patch: Record<string, any> = {};

    const validStatuses = [
      'new',
      'contacted',
      'inspection_scheduled',
      'inspected',
      'negotiating',
      'purchased',
      'closed',
      'passed',
      'archived',
      'deleted',
    ];
    if (body.lead_status && validStatuses.includes(body.lead_status)) {
      patch.lead_status = body.lead_status;
    }
    if ('next_action' in body) patch.next_action = body.next_action ? String(body.next_action) : null;
    if ('next_action_due_at' in body) patch.next_action_due_at = body.next_action_due_at || null;
    if ('inspection_date' in body) patch.inspection_date = body.inspection_date || null;
    if ('inspection_location' in body) {
      patch.inspection_location = body.inspection_location ? String(body.inspection_location) : null;
    }
    if ('inspection_notes' in body) {
      patch.inspection_notes = body.inspection_notes ? String(body.inspection_notes) : null;
    }
    if ('pass_reason' in body) patch.pass_reason = body.pass_reason ? String(body.pass_reason) : null;
    if ('estimated_purchase_value_chf' in body) {
      patch.estimated_purchase_value_chf =
        body.estimated_purchase_value_chf !== null && body.estimated_purchase_value_chf !== ''
          ? Number(body.estimated_purchase_value_chf)
          : null;
    }
    if ('estimated_resale_value_chf' in body) {
      patch.estimated_resale_value_chf =
        body.estimated_resale_value_chf !== null && body.estimated_resale_value_chf !== ''
          ? Number(body.estimated_resale_value_chf)
          : null;
    }
    if ('actual_purchase_value_chf' in body) {
      patch.actual_purchase_value_chf =
        body.actual_purchase_value_chf !== null && body.actual_purchase_value_chf !== ''
          ? Number(body.actual_purchase_value_chf)
          : null;
    }
    if (Array.isArray(body.call_history)) patch.call_history = body.call_history;
    if (Array.isArray(body.machinery_detected)) patch.machinery_detected = body.machinery_detected;
    if (typeof body.contact_name === 'string') patch.contact_name = body.contact_name;
    if (typeof body.contact_phone === 'string') patch.contact_phone = body.contact_phone;

    const updated = await supabaseDataService.updateLead(id, patch);
    if (!updated) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// Explicit Human-Reviewed Reply from CRM Deal Card
app.post('/api/leads/:id/reply', rateLimit(15, 60_000), async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, body } = req.body || {};
    if (!subject || !body) {
      return res.status(400).json({ error: 'Reply subject and body are required.' });
    }

    const leads = await supabaseDataService.getLeads();
    const lead = leads.find((l) => l.id === id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const settings = await supabaseDataService.getSettings();
    const sendResult = await smtpService.sendMail({
      to: lead.sender_email,
      subject: String(subject).trim(),
      text: String(body).trim(),
      fromName: `${settings.sender_name} - JIMY EXPORT`,
      replyTo: settings.sender_email,
    });

    if (!sendResult.success) {
      return res.status(400).json({
        success: false,
        error: sendResult.error || 'Failed to send reply via SMTP',
      });
    }

    const nowIso = new Date().toISOString();
    const existingReplies = Array.isArray(lead.reply_history) ? lead.reply_history : [];
    const updatedLead = await supabaseDataService.updateLead(lead.id, {
      lead_status: lead.lead_status === 'new' ? 'contacted' : lead.lead_status,
      reply_history: [
        ...existingReplies,
        {
          id: `rep-${Date.now()}`,
          sent_at: nowIso,
          subject: String(subject).trim(),
          body: String(body).trim(),
          message_id: sendResult.messageId || null,
        },
      ],
    });

    const lang = getLanguageForCanton(lead.canton || 'VD');
    await supabaseDataService.addOutboundLog({
      company_id: lead.company_id || 'manual-reply',
      language: lang,
      subject: String(subject).trim(),
      body_snippet: String(body).trim().substring(0, 180),
      full_body: String(body).trim(),
      recipient_email: lead.sender_email,
      company_name: lead.company_name || lead.sender_email,
      canton: lead.canton || 'CH',
      delivery_status: sendResult.deliveryStatus || 'accepted',
      smtp_message_id: sendResult.messageId || null,
    });

    res.json({
      success: true,
      messageId: sendResult.messageId,
      lead: updatedLead,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to send reply' });
  }
});

app.delete('/api/leads/:id', async (req, res) => {
  try {
    await supabaseDataService.deleteLead(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// 5. Equipment Records (Structured Machine Registry)
app.get('/api/equipment', async (req, res) => {
  try {
    const leadId = req.query.leadId ? String(req.query.leadId) : undefined;
    const records = await supabaseDataService.getEquipmentRecords(leadId);
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.post('/api/equipment', async (req, res) => {
  try {
    const b = req.body || {};
    const record = await supabaseDataService.createEquipmentRecord({
      lead_id: b.lead_id || null,
      company_id: b.company_id || null,
      category: String(b.category || 'Excavator'),
      brand: String(b.brand || ''),
      model: String(b.model || ''),
      year: b.year ? Number(b.year) : null,
      serial_number: b.serial_number ? String(b.serial_number) : null,
      operating_hours: b.operating_hours ? Number(b.operating_hours) : null,
      tonnage: b.tonnage ? Number(b.tonnage) : null,
      condition: String(b.condition || 'Bon état'),
      location_canton: b.location_canton ? normalizeCantonCode(String(b.location_canton)) : null,
      asking_price_raw: b.asking_price_raw ? String(b.asking_price_raw) : null,
      asking_price_amount: b.asking_price_amount !== undefined ? Number(b.asking_price_amount) : null,
      asking_price_currency: b.asking_price_currency || 'CHF',
      asking_price_chf: b.asking_price_chf !== undefined ? Number(b.asking_price_chf) : null,
      target_buy_price_chf:
        b.target_buy_price_chf !== undefined && b.target_buy_price_chf !== null
          ? Number(b.target_buy_price_chf)
          : null,
      estimated_export_value_chf:
        b.estimated_export_value_chf !== undefined && b.estimated_export_value_chf !== null
          ? Number(b.estimated_export_value_chf)
          : null,
      decision_status: b.decision_status || 'evaluating',
      notes: b.notes ? String(b.notes) : null,
    });
    res.status(201).json(record);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create equipment record' });
  }
});

app.patch('/api/equipment/:id', async (req, res) => {
  try {
    const updated = await supabaseDataService.updateEquipmentRecord(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Equipment record not found' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.delete('/api/equipment/:id', async (req, res) => {
  try {
    await supabaseDataService.deleteEquipmentRecord(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// 6. Companies (Verified Swiss Contractors Directory)
app.get('/api/companies', async (_req, res) => {
  try {
    const companies = await supabaseDataService.getCompanies();
    res.json(companies);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.post('/api/companies', async (req, res) => {
  try {
    const {
      name,
      email,
      canton,
      phone,
      domain,
      industry,
      contact_person,
      address,
      postal_code,
      city,
      language,
      notes,
      source,
      confidence,
      verified_email,
      stock_status,
    } = req.body || {};

    if (!name || !canton) {
      return res
        .status(400)
        .json({ error: 'Company name and Swiss canton are required.' });
    }

    const cleanCanton = normalizeCantonCode(String(canton));
    const resolvedLang = resolveCompanyLanguage({
      canton: cleanCanton,
      language: language || null,
    });

    const created = await supabaseDataService.addCompany({
      name: String(name).trim(),
      email: email ? String(email).trim().toLowerCase() : '',
      canton: cleanCanton,
      language: resolvedLang,
      phone: phone ? String(phone).trim() : null,
      domain: domain ? String(domain).trim() : null,
      industry: industry ? String(industry).trim() : 'civil_engineering',
      contact_person: contact_person ? String(contact_person).trim() : null,
      address: address ? String(address).trim() : null,
      postal_code: postal_code ? String(postal_code).trim() : null,
      city: city ? String(city).trim() : null,
      notes: notes ? String(notes).trim() : null,
      source: source || 'manual',
      confidence: typeof confidence === 'number' ? confidence : 1.0,
      verified_email:
        typeof verified_email === 'boolean'
          ? verified_email
          : Boolean(email && String(email).includes('@')),
      stock_status: stock_status || 'unknown',
      last_contacted_at: null,
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to add company' });
  }
});

app.patch('/api/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const patch: Record<string, any> = {};

    if (typeof body.name === 'string') patch.name = body.name.trim();
    if (typeof body.email === 'string') {
      patch.email = body.email.trim().toLowerCase();
      if (!('verified_email' in body)) {
        patch.verified_email = Boolean(patch.email && patch.email.includes('@'));
      }
    }
    if (typeof body.verified_email === 'boolean') patch.verified_email = body.verified_email;
    if (typeof body.canton === 'string') patch.canton = normalizeCantonCode(body.canton);
    if (body.language === 'de' || body.language === 'fr' || body.language === 'it') {
      patch.language = body.language;
    }
    if ('phone' in body) patch.phone = body.phone ? String(body.phone).trim() : null;
    if ('domain' in body) patch.domain = body.domain ? String(body.domain).trim() : null;
    if ('contact_person' in body) {
      patch.contact_person = body.contact_person ? String(body.contact_person).trim() : null;
    }
    if ('address' in body) patch.address = body.address ? String(body.address).trim() : null;
    if ('postal_code' in body) patch.postal_code = body.postal_code ? String(body.postal_code).trim() : null;
    if ('city' in body) patch.city = body.city ? String(body.city).trim() : null;
    if ('notes' in body) patch.notes = body.notes ? String(body.notes).trim() : null;
    if (typeof body.unsubscribed === 'boolean') patch.unsubscribed = body.unsubscribed;
    if (
      body.stock_status === 'unknown' ||
      body.stock_status === 'has_stock' ||
      body.stock_status === 'no_stock_temporarily' ||
      body.stock_status === 'opted_out'
    ) {
      patch.stock_status = body.stock_status;
    }

    const updated = await supabaseDataService.updateCompany(id, patch);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update company' });
  }
});

app.delete('/api/companies/:id', async (req, res) => {
  try {
    await supabaseDataService.deleteCompany(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete company' });
  }
});

// Bulk Insert Companies (from Business Card Scanner or Verified Import)
// NEVER fabricates fake emails when email is blank!
app.post('/api/companies/bulk', async (req, res) => {
  try {
    const { companies } = req.body || {};
    if (!Array.isArray(companies) || companies.length === 0) {
      return res.status(400).json({ error: 'Array of companies is required' });
    }

    const sanitizedList = companies
      .filter((c: any) => c && c.name && String(c.name).trim())
      .map((c: any) => {
        const cleanCanton = normalizeCantonCode(String(c.canton || 'VD'));
        const cleanEmail = c.email ? String(c.email).trim().toLowerCase() : '';
        const hasValidEmail = Boolean(cleanEmail && cleanEmail.includes('@'));
        const language = resolveCompanyLanguage({
          canton: cleanCanton,
          language: c.language || null,
        });

        return {
          name: String(c.name).trim(),
          email: cleanEmail,
          verified_email:
            typeof c.verified_email === 'boolean' ? c.verified_email && hasValidEmail : hasValidEmail,
          canton: cleanCanton,
          language,
          phone: c.phone ? String(c.phone).trim() : null,
          domain: c.domain ? String(c.domain).trim() : null,
          industry: c.industry || 'civil_engineering',
          contact_person: c.contact_person ? String(c.contact_person).trim() : null,
          address: c.address ? String(c.address).trim() : null,
          postal_code: c.postal_code ? String(c.postal_code).trim() : null,
          city: c.city ? String(c.city).trim() : null,
          unsubscribed: Boolean(c.unsubscribed),
          last_contacted_at: null,
          notes: c.notes ? String(c.notes).trim() : null,
          source: c.source || 'ocr',
          confidence: typeof c.confidence === 'number' ? c.confidence : 0.9,
          stock_status: c.stock_status || 'unknown',
        };
      });

    const result = await supabaseDataService.addCompaniesBulk(sanitizedList);
    res.status(201).json({
      success: true,
      added: result.added,
      updated: result.updated,
      skipped: result.skipped,
      companies: result.companies,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to bulk add companies' });
  }
});

// Verified CSV Import for Contractors
app.post('/api/companies/import-csv', async (req, res) => {
  try {
    const { csvText } = req.body || {};
    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ error: 'csvText is required' });
    }

    const parsedRows = parseCsvContent(csvText);
    if (parsedRows.length === 0) {
      return res.status(400).json({ error: 'No valid contractor rows found in CSV.' });
    }

    const mapped = parsedRows
      .map((r) => {
        const name =
          r.name || r.company || r.entreprise || r.firma || r['company name'] || r['nom'] || '';
        const email = r.email || r.mail || r['e-mail'] || r.courriel || '';
        const cantonRaw = r.canton || r.kanton || r.state || 'VD';
        const phone = r.phone || r.telephone || r.téléphone || r.tel || r.telefon || '';
        const contactPerson =
          r.contact_person || r.contact || r.person || r.ansprechpartner || '';
        const city = r.city || r.ville || r.ort || '';
        const postalCode = r.postal_code || r.npa || r.plz || r.zip || '';
        const address = r.address || r.adresse || r.strasse || '';
        const domain = r.domain || r.website || r.site || '';
        const notes = r.notes || r.remarques || r.notizen || '';
        const languageRaw = (r.language || r.langue || r.sprache || '').toLowerCase().trim();

        const cleanCanton = normalizeCantonCode(cantonRaw);
        const cleanEmail = email.trim().toLowerCase();
        const hasValidEmail = Boolean(cleanEmail && cleanEmail.includes('@'));

        return {
          name: name.trim(),
          email: cleanEmail,
          verified_email: hasValidEmail,
          canton: cleanCanton,
          language: resolveCompanyLanguage({
            canton: cleanCanton,
            language:
              languageRaw === 'de' || languageRaw === 'fr' || languageRaw === 'it'
                ? languageRaw
                : null,
          }),
          phone: phone ? phone.trim() : null,
          domain: domain ? domain.trim() : null,
          industry: 'civil_engineering',
          contact_person: contactPerson ? contactPerson.trim() : null,
          address: address ? address.trim() : null,
          postal_code: postalCode ? postalCode.trim() : null,
          city: city ? city.trim() : null,
          notes: notes ? notes.trim() : null,
          source: 'csv_import' as const,
          confidence: 1.0,
        };
      })
      .filter((c) => Boolean(c.name));

    const result = await supabaseDataService.addCompaniesBulk(mapped);
    res.json({
      success: true,
      totalRows: parsedRows.length,
      added: result.added,
      updated: result.updated,
      skipped: result.skipped,
      companies: result.companies,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'CSV import failed' });
  }
});

// CSV Export for Contractors (with CSV formula injection protection)
app.get('/api/companies/export-csv', async (_req, res) => {
  try {
    const companies = await supabaseDataService.getCompanies();
    const headers = [
      'Name',
      'Email',
      'Verified Email',
      'Canton',
      'Language',
      'Phone',
      'Contact Person',
      'Postal Code',
      'City',
      'Address',
      'Domain',
      'Stock Status',
      'Unsubscribed',
      'Last Contacted At',
      'Notes',
    ];
    const rows = companies.map((c) => [
      sanitizeCsvCell(c.name),
      sanitizeCsvCell(c.email),
      sanitizeCsvCell(c.verified_email !== false && Boolean(c.email)),
      sanitizeCsvCell(c.canton),
      sanitizeCsvCell(c.language),
      sanitizeCsvCell(c.phone || ''),
      sanitizeCsvCell(c.contact_person || ''),
      sanitizeCsvCell(c.postal_code || ''),
      sanitizeCsvCell(c.city || ''),
      sanitizeCsvCell(c.address || ''),
      sanitizeCsvCell(c.domain || ''),
      sanitizeCsvCell(c.stock_status || 'unknown'),
      sanitizeCsvCell(c.unsubscribed ? 'true' : 'false'),
      sanitizeCsvCell(c.last_contacted_at || ''),
      sanitizeCsvCell(c.notes || ''),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="jimiscout-contractors-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// 7. Suppression Registry (Permanent Opt-Out & Domain Blocklist)
app.get('/api/suppressions', async (_req, res) => {
  try {
    const suppressions = await supabaseDataService.getSuppressions();
    res.json(suppressions);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.post('/api/suppressions', async (req, res) => {
  try {
    const { email, domain, companyName, reason } = req.body || {};
    if (!email && !domain) {
      return res.status(400).json({ error: 'Email or domain is required for suppression.' });
    }
    const entry = await supabaseDataService.addSuppression({
      email: email ? String(email) : null,
      domain: domain ? String(domain) : null,
      companyName: companyName ? String(companyName) : null,
      reason: reason || 'manual_opt_out',
      unsubscribed: true,
    });
    res.status(201).json(entry);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.delete('/api/suppressions/:id', async (req, res) => {
  try {
    await supabaseDataService.removeSuppression(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// 8. AI Multimodal Vision: Scan Business Cards from Image(s)
app.post('/api/scan-business-card', rateLimit(15, 60_000), async (req, res) => {
  try {
    const { images, image, mimeType } = req.body || {};
    const imageList: Array<{ base64: string; mimeType?: string }> = [];

    if (Array.isArray(images)) {
      for (const img of images) {
        if (typeof img === 'string') {
          imageList.push({ base64: img });
        } else if (img && img.base64) {
          imageList.push({ base64: img.base64, mimeType: img.mimeType });
        }
      }
    } else if (image && typeof image === 'string') {
      imageList.push({ base64: image, mimeType });
    }

    if (imageList.length === 0) {
      return res.status(400).json({
        error: 'Please provide at least one photo of a business card (base64 string)',
      });
    }

    const extraction = await geminiService.extractBusinessCards(imageList);
    res.json({
      success: true,
      count: extraction.cards.length,
      cards: extraction.cards,
    });
  } catch (err: any) {
    console.error('[API /api/scan-business-card] Error:', err);
    res.status(500).json({
      error: err?.message || 'Failed to analyze business card with AI',
    });
  }
});

// 9. Outbound Logs & Safe CSV Export
app.get('/api/logs', async (_req, res) => {
  try {
    const logs = await supabaseDataService.getOutboundLogs();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.get('/api/logs/export-csv', async (_req, res) => {
  try {
    const logs = await supabaseDataService.getOutboundLogs();
    const headers = [
      'Date',
      'Company',
      'Email',
      'Canton',
      'Language',
      'Subject',
      'Delivery Status',
      'SMTP Message ID',
    ];
    const rows = logs.map((l) => [
      sanitizeCsvCell(new Date(l.sent_at).toISOString()),
      sanitizeCsvCell(l.company_name || ''),
      sanitizeCsvCell(l.recipient_email || ''),
      sanitizeCsvCell(l.canton || ''),
      sanitizeCsvCell(l.language.toUpperCase()),
      sanitizeCsvCell(l.subject || ''),
      sanitizeCsvCell(l.delivery_status),
      sanitizeCsvCell(l.smtp_message_id || ''),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="jimiscout-outbound-logs-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.delete('/api/logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await supabaseDataService.deleteOutboundLog(id);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// 10. Live IMAP Inbox Poll (delegates to inboundService with post-processing \Seen guarantees)
app.post('/api/imap/poll', rateLimit(10, 60_000), async (_req, res) => {
  try {
    const processedResults: Array<{
      senderEmail: string;
      subject: string;
      intent: string;
      leadId: string | null;
      isNew: boolean;
    }> = [];

    let newLeadsCount = 0;

    const pollResult = await imapService.pollOnce(async (msg) => {
      const outcome = await inboundService.processInboundMessage({
        senderEmail: msg.senderEmail,
        companyName: msg.senderName,
        rawSubject: msg.subject,
        rawBody: msg.bodyText,
        latestReplyText: msg.latestReplyText,
        messageId: msg.messageId,
        inReplyTo: msg.inReplyTo,
        references: msg.references,
        imapUid: msg.uid,
        uidValidity: msg.uidValidity,
        receivedAt: msg.receivedAt.toISOString(),
        isBounce: msg.isBounce ?? msg.isBounceReport,
        bouncedRecipient: msg.bouncedRecipient,
        source: 'imap',
      });

      const isNew = Boolean(outcome.lead && !outcome.isDuplicate);
      if (isNew) {
        newLeadsCount++;
      }

      processedResults.push({
        senderEmail: msg.senderEmail,
        subject: msg.subject,
        intent: outcome.analysis.intent,
        leadId: outcome.lead?.id || null,
        isNew,
      });
    });

    if (!pollResult.success) {
      return res.status(400).json({
        success: false,
        error: pollResult.error || 'IMAP poll failed',
        messagesProcessed: 0,
      });
    }

    res.json({
      success: true,
      messagesProcessed: newLeadsCount,
      totalChecked: processedResults.length,
      skippedOverlap: pollResult.skippedOverlap,
      results: processedResults,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'IMAP polling error',
    });
  }
});

// 11. Test Email Dispatch via Real SMTP
app.post('/api/test-email', rateLimit(10, 60_000), async (req, res) => {
  try {
    const settings = await supabaseDataService.getSettings();
    const { targetEmail, language = 'fr', customSubject, customBody } = req.body || {};
    const recipient = (targetEmail || settings.sender_email || '').trim();

    if (!recipient) {
      return res.status(400).json({ success: false, error: 'Recipient email is required' });
    }

    let subject = customSubject;
    let body = customBody;
    let html = req.body?.customHtml;

    const templateParams = {
      companyName: 'Entreprise BTP Suisse SA',
      recipientName: undefined,
      canton: language === 'de' ? 'ZH' : language === 'it' ? 'TI' : 'VD',
      senderName: settings.sender_name,
      senderEmail: settings.sender_email,
      senderPhone: settings.sender_phone,
      tone: settings.tone,
      hooks: settings.hooks,
      equipmentFocus: settings.equipment_focus,
    };

    const rendered =
      language === 'de'
        ? generateDeTemplate(templateParams)
        : language === 'it'
        ? generateItTemplate(templateParams)
        : generateFrTemplate(templateParams);

    if (!subject) subject = rendered.subject;
    if (!body) body = rendered.body;
    if (!html) html = rendered.html;

    const result = await smtpService.sendMail({
      to: recipient,
      subject,
      text: body,
      html,
      fromName: `${settings.sender_name} - JIMY EXPORT`,
      replyTo: settings.sender_email,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        recipient,
        error: result.error || 'SMTP send failed',
      });
    }

    res.json({
      success: true,
      recipient,
      messageId: result.messageId,
      deliveryStatus: result.deliveryStatus,
      previewSubject: subject,
      previewSnippet: body.substring(0, 150) + '...',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to send test email' });
  }
});

// 12. Test Telegram Push Alert
app.post('/api/test-telegram', rateLimit(10, 60_000), async (_req, res) => {
  try {
    const botCheck = await telegramService.verifyBot();
    if (!botCheck.connected) {
      return res.status(400).json({
        success: false,
        error: botCheck.error || 'Telegram Bot verification failed',
      });
    }

    const settings = await supabaseDataService.getSettings();
    const companies = await supabaseDataService.getCompanies();
    const leads = await supabaseDataService.getLeads();

    const latestLead = leads[0];
    if (latestLead) {
      const tgRes = await telegramService.sendDealNotification({
        leadId: latestLead.id,
        companyName: latestLead.company_name || 'Contractor',
        canton: latestLead.canton || 'CH',
        machinery: latestLead.machinery_detected,
        askingPrice: latestLead.machinery_detected[0]?.asking_price || undefined,
        sellerName: latestLead.contact_name || undefined,
        sellerPhone: latestLead.contact_phone || undefined,
        sellerEmail: latestLead.sender_email,
        summary: latestLead.ai_summary || latestLead.raw_body,
      });

      return res.json({
        success: tgRes.success,
        botUsername: botCheck.username,
        messageId: tgRes.messageId,
        error: tgRes.error,
      });
    }

    const tgRes = await telegramService.sendDealNotification({
      companyName: `JimiScout Live Check (${companies.length} contractors in pool)`,
      canton: settings.selected_cantons[0] || 'CH',
      machinery: [
        {
          type: 'Connectivity Verification',
          make_model: settings.equipment_focus.split(',')[0] || 'Heavy Machinery',
        },
      ],
      sellerName: settings.sender_name,
      sellerPhone: settings.sender_phone,
      sellerEmail: settings.sender_email,
      summary: `Connexion Telegram @${botCheck.username} opérationnelle. Cantons actifs : ${settings.selected_cantons.join(', ')}.`,
    });

    res.json({
      success: tgRes.success,
      botUsername: botCheck.username,
      messageId: tgRes.messageId,
      error: tgRes.error,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// 13. Inbound Webhook & AI Triage Endpoint
const inboundWebhookHandler = async (req: express.Request, res: express.Response) => {
  const { senderEmail, companyName, canton, rawSubject, rawBody, messageId } = req.body || {};

  if (!senderEmail || !rawBody) {
    return res.status(400).json({
      error: 'Both senderEmail and rawBody are required for inbound AI triage.',
    });
  }

  try {
    const result = await inboundService.processInboundMessage({
      senderEmail: String(senderEmail),
      companyName: companyName ? String(companyName) : undefined,
      canton: canton ? String(canton) : undefined,
      rawSubject: rawSubject ? String(rawSubject) : 'Inbound Reply',
      rawBody: String(rawBody),
      messageId: messageId ? String(messageId) : undefined,
      source: req.path.includes('webhook') ? 'webhook' : 'manual_test',
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Inbound AI triage failed' });
  }
};

app.post('/api/webhooks/imap', rateLimit(30, 60_000), verifyWebhookAuth, inboundWebhookHandler);
app.post('/api/simulate-inbound', rateLimit(20, 60_000), inboundWebhookHandler);

// 14. Scheduler Status & Outbound Dispatch Execution Step
app.get('/api/scheduler/status', async (_req, res) => {
  try {
    const status = await outboundScheduler.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.post('/api/worker/step', rateLimit(20, 60_000), async (req, res) => {
  try {
    if (safePreview) {
      return res.status(409).json({
        status: 'preview_only',
        message: 'Outbound dispatch is disabled in the local preview.',
      });
    }
    const manualOverride = Boolean(req.body?.manualOverride);
    const companyId = req.body?.companyId ? String(req.body.companyId) : undefined;

    const outcome = await outboundScheduler.executeStep({
      manualOverride,
      companyId,
    });

    if (outcome.status === 'dispatched') {
      return res.json(outcome);
    }

    return res.status(400).json(outcome);
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err?.message || 'Outbound step failed',
    });
  }
});

app.get('/api/discovery/status', async (_req, res) => {
  try {
    res.json(await companyDiscoveryService.getStatus());
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load discovery status' });
  }
});

app.get('/api/discovery/records', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
    res.json(await supabaseDataService.getDiscoveryRecords(limit));
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load discovery records' });
  }
});

app.post('/api/discovery/step', rateLimit(10, 60_000), async (req, res) => {
  try {
    if (safePreview) {
      return res.status(409).json({
        status: 'preview_only',
        message: 'Company discovery is disabled in the local preview.',
      });
    }
    const outcome = await companyDiscoveryService.executeStep({
      manualOverride: Boolean(req.body?.manualOverride),
    });
    res.status(outcome.status === 'completed' ? 200 : 400).json(outcome);
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err?.message || 'Discovery run failed' });
  }
});

// ----------------------------------------------------
// Frontend Serving (Vite Middlewares in Dev, Static in Prod)
// ----------------------------------------------------
export async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        if (vite) vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  // Start background scheduler loop when running as a persistent server process
  if (!process.env.VERCEL && process.env.JIMISCOUT_DISABLE_DAEMON !== 'true') {
    outboundScheduler.startDaemonLoop(60_000);
    companyDiscoveryService.startDaemonLoop(5 * 60_000);
    imapService.startPolling(async (raw) => {
      console.log(`[Server:IMAP] Incoming message detected from ${raw.senderEmail}`);
      await inboundService.processInboundMessage({
        senderEmail: raw.senderEmail,
        companyName: raw.senderName,
        rawSubject: raw.subject,
        rawBody: raw.bodyText,
        latestReplyText: raw.latestReplyText,
        messageId: raw.messageId,
        inReplyTo: raw.inReplyTo,
        references: raw.references,
        imapUid: raw.uid,
        uidValidity: raw.uidValidity,
        receivedAt: raw.receivedAt.toISOString(),
        isBounce: raw.isBounce ?? raw.isBounceReport,
        bouncedRecipient: raw.bouncedRecipient,
        source: 'imap',
      });
    });
  }

  return app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 JimiScout BTP server running at http://0.0.0.0:${PORT}`);
  });
}

// Only start listening automatically if server.ts is the main entrypoint (not imported by Vercel /api/index.ts or tests)
const isDirectRun =
  process.argv[1] &&
  (path.resolve(process.argv[1]) === path.resolve(__filename) ||
    process.argv[1].endsWith('/server.ts'));

if (isDirectRun) {
  startServer();
}
