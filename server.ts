import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  isSwissBusinessHours,
  getLanguageForCanton,
  isEligibleForOutbound,
} from './apps/worker/src/scheduler.ts';
import { generateDeTemplate } from './apps/worker/src/templates/de.template.ts';
import { generateFrTemplate } from './apps/worker/src/templates/fr.template.ts';
import { generateItTemplate } from './apps/worker/src/templates/it.template.ts';
import { smtpService } from './apps/worker/src/services/smtp.service.ts';
import { imapService } from './apps/worker/src/services/imap.service.ts';
import { telegramService } from './apps/worker/src/services/telegram.service.ts';
import { geminiService } from './apps/worker/src/services/gemini.service.ts';
import { supabaseDataService } from './apps/worker/src/services/supabase.service.ts';
import { InboundLead } from './packages/types/src/lead.ts';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// ----------------------------------------------------
// HELPER: Process a single inbound email (from IMAP or Webhook)
// ----------------------------------------------------
async function handleInboundEmailPayload(params: {
  senderEmail: string;
  companyName?: string;
  canton?: string;
  rawSubject: string;
  rawBody: string;
}) {
  const senderEmail = params.senderEmail.trim().toLowerCase();
  const existingCompany = await supabaseDataService.findCompanyByEmail(senderEmail);

  const companyName =
    params.companyName?.trim() ||
    existingCompany?.name ||
    senderEmail.split('@')[1] ||
    senderEmail;
  const canton = (params.canton?.trim() || existingCompany?.canton || 'CH').toUpperCase();

  // 1. Live Gemini 3.8 Flash Triage
  const analysis = await geminiService.analyzeReply(
    params.rawSubject,
    params.rawBody,
    senderEmail
  );

  let createdLead: InboundLead | null = null;
  let telegramResult: any = null;

  if (analysis.intent === 'HOT_LEAD') {
    createdLead = await supabaseDataService.createLead({
      company_id: existingCompany?.id || null,
      company_name: companyName,
      canton,
      sender_email: senderEmail,
      raw_subject: params.rawSubject,
      raw_body: params.rawBody,
      intent: 'HOT_LEAD',
      machinery_detected: analysis.machinery_detected,
      contact_name: analysis.contact_name || existingCompany?.name || senderEmail,
      contact_phone: analysis.contact_phone || existingCompany?.phone || null,
      lead_status: 'new',
      ai_summary: analysis.french_summary,
      match_score: Math.round((analysis.confidence || 0.9) * 100),
    });

    // 2. Dispatch real Telegram notification
    telegramResult = await telegramService.sendDealNotification({
      companyName,
      canton,
      machinery: analysis.machinery_detected,
      askingPrice: analysis.machinery_detected[0]?.asking_price,
      sellerName: analysis.contact_name || companyName,
      sellerPhone: analysis.contact_phone || existingCompany?.phone || undefined,
      sellerEmail: senderEmail,
      summary: analysis.french_summary,
    });
  } else if (analysis.intent === 'UNSUBSCRIBE' || analysis.intent === 'NOT_INTERESTED') {
    if (existingCompany) {
      await supabaseDataService.updateCompany(existingCompany.id, { unsubscribed: true });
    }
  }

  return {
    analysis,
    lead: createdLead,
    telegram: telegramResult,
  };
}

// ----------------------------------------------------
// API ROUTES (100% Live Integrations — Zero Mock Data)
// ----------------------------------------------------

// 1. Health & Live Integration Status
app.get('/api/health', async (_req, res) => {
  try {
    const [settings, leads, companies, logs, todaySent, schemaCheck] = await Promise.all([
      supabaseDataService.getSettings(),
      supabaseDataService.getLeads(),
      supabaseDataService.getCompanies(),
      supabaseDataService.getOutboundLogs(),
      supabaseDataService.getTodaySentCount(),
      supabaseDataService.checkSqlSchema(),
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
      integrations: {
        supabase_configured: Boolean(
          process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ),
        gemini_configured: Boolean(process.env.GEMINI_API_KEY),
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

// 2. SQL Migration DDL Helper (for one-click copy into Supabase SQL Editor)
app.get('/api/sql-migration', (_req, res) => {
  try {
    const sqlPath = path.resolve(
      __dirname,
      'supabase/migrations/20261030000000_init_schema.sql'
    );
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    res.json({ sql });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to read SQL migration file' });
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
    const updated = await supabaseDataService.updateSettings(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// 4. Leads (CRM Deals)
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
    const { lead_status } = req.body;
    const updated = await supabaseDataService.updateLeadStatus(id, lead_status);
    if (!updated) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
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

// 5. Companies (Verified Swiss Contractors Directory)
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
    const { name, email, canton, phone, domain, industry } = req.body;
    if (!name || !email || !canton) {
      return res
        .status(400)
        .json({ error: 'Company name, email, and Swiss canton are required.' });
    }
    const cleanCanton = String(canton).trim().toUpperCase();
    const language = getLanguageForCanton(cleanCanton);

    const created = await supabaseDataService.addCompany({
      name: String(name),
      email: String(email),
      canton: cleanCanton,
      language,
      phone: phone ? String(phone) : null,
      domain: domain ? String(domain) : null,
      industry: industry ? String(industry) : 'civil_engineering',
      last_contacted_at: null,
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to add company' });
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

// 6. Outbound Logs
app.get('/api/logs', async (_req, res) => {
  try {
    const logs = await supabaseDataService.getOutboundLogs();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// 7. Live IMAP Inbox Poll
app.post('/api/imap/poll', async (_req, res) => {
  try {
    const processedResults: Array<{
      senderEmail: string;
      subject: string;
      intent: string;
      leadId: string | null;
    }> = [];

    const pollResult = await imapService.pollOnce(async (msg) => {
      const outcome = await handleInboundEmailPayload({
        senderEmail: msg.senderEmail,
        companyName: msg.senderName,
        rawSubject: msg.subject,
        rawBody: msg.bodyText,
      });
      processedResults.push({
        senderEmail: msg.senderEmail,
        subject: msg.subject,
        intent: outcome.analysis.intent,
        leadId: outcome.lead?.id || null,
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
      messagesProcessed: processedResults.length,
      results: processedResults,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'IMAP polling error',
    });
  }
});

// 8. Test Email Dispatch via Real SMTP
app.post('/api/test-email', async (req, res) => {
  try {
    const settings = await supabaseDataService.getSettings();
    const { targetEmail, language = 'fr', customSubject, customBody } = req.body;
    const recipient = (targetEmail || settings.sender_email || '').trim();

    if (!recipient) {
      return res.status(400).json({ success: false, error: 'Recipient email is required' });
    }

    let subject = customSubject;
    let body = customBody;

    if (!subject || !body) {
      const params = {
        companyName: 'Entreprise BTP Suisse SA',
        recipientName: 'Direction du Parc Matériel',
        canton: language === 'de' ? 'ZH' : language === 'it' ? 'TI' : 'VD',
        senderName: settings.sender_name,
        senderEmail: settings.sender_email,
        senderPhone: settings.sender_phone,
        tone: settings.tone,
        hooks: settings.hooks,
        equipmentFocus: settings.equipment_focus,
      };

      if (language === 'de') {
        const t = generateDeTemplate(params);
        subject = t.subject;
        body = t.body;
      } else if (language === 'it') {
        const t = generateItTemplate(params);
        subject = t.subject;
        body = t.body;
      } else {
        const t = generateFrTemplate(params);
        subject = t.subject;
        body = t.body;
      }
    }

    const result = await smtpService.sendMail({
      to: recipient,
      subject,
      text: body,
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
      previewSubject: subject,
      previewSnippet: body.substring(0, 150) + '...',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to send test email' });
  }
});

// 9. Test Telegram Push Alert
app.post('/api/test-telegram', async (_req, res) => {
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
        companyName: latestLead.company_name || 'Contractor',
        canton: latestLead.canton || 'CH',
        machinery: latestLead.machinery_detected,
        askingPrice: latestLead.machinery_detected[0]?.asking_price,
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

    // If no leads exist yet, send a live system connectivity notification
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

// 10. Inbound Webhook & AI Triage Endpoint (Gemini 3.8 Flash + Supabase + Telegram)
const inboundWebhookHandler = async (req: express.Request, res: express.Response) => {
  const { senderEmail, companyName, canton, rawSubject, rawBody } = req.body;

  if (!senderEmail || !rawBody) {
    return res.status(400).json({
      error: 'Both senderEmail and rawBody are required for inbound AI triage.',
    });
  }

  try {
    const result = await handleInboundEmailPayload({
      senderEmail: String(senderEmail),
      companyName: companyName ? String(companyName) : undefined,
      canton: canton ? String(canton) : undefined,
      rawSubject: rawSubject ? String(rawSubject) : 'Inbound Reply',
      rawBody: String(rawBody),
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Inbound AI triage failed' });
  }
};

app.post('/api/webhooks/imap', inboundWebhookHandler);
app.post('/api/simulate-inbound', inboundWebhookHandler);

// 11. Outbound Dispatch Execution Step (Real Contractor Lookup + Real SMTP Send)
app.post('/api/worker/step', async (_req, res) => {
  try {
    const [settings, companies, todaySentCount] = await Promise.all([
      supabaseDataService.getSettings(),
      supabaseDataService.getCompanies(),
      supabaseDataService.getTodaySentCount(),
    ]);

    if (!settings.is_active) {
      return res.status(400).json({
        status: 'paused',
        message: 'Outreach engine is paused. Enable the master switch first.',
      });
    }

    if (todaySentCount >= settings.daily_limit) {
      return res.status(400).json({
        status: 'quota_reached',
        message: `Daily quota reached (${todaySentCount}/${settings.daily_limit}).`,
      });
    }

    const eligible = companies.find(
      (c) =>
        settings.selected_cantons.includes(c.canton) &&
        isEligibleForOutbound(c.last_contacted_at, c.unsubscribed)
    );

    if (!eligible) {
      return res.status(400).json({
        status: 'idle',
        message:
          companies.length === 0
            ? 'No contractors in your directory yet. Add contractors in the Swiss Cantons tab first.'
            : 'No eligible contractor waiting in the selected cantons (all contacted within 30 days or unsubscribed).',
      });
    }

    const lang = getLanguageForCanton(eligible.canton);
    const templateParams = {
      companyName: eligible.name,
      recipientName: eligible.name,
      canton: eligible.canton,
      senderName: settings.sender_name,
      senderEmail: settings.sender_email,
      senderPhone: settings.sender_phone,
      tone: settings.tone,
      hooks: settings.hooks,
      equipmentFocus: settings.equipment_focus,
    };

    const rendered =
      lang === 'fr'
        ? generateFrTemplate(templateParams)
        : lang === 'it'
        ? generateItTemplate(templateParams)
        : generateDeTemplate(templateParams);

    const sendResult = await smtpService.sendMail({
      to: eligible.email,
      subject: rendered.subject,
      text: rendered.body,
      replyTo: settings.sender_email,
    });

    if (!sendResult.success) {
      const failedLog = await supabaseDataService.addOutboundLog({
        company_id: eligible.id,
        language: lang,
        subject: rendered.subject,
        body_snippet: `SMTP Error: ${sendResult.error}`,
        delivery_status: 'bounced',
      });

      return res.status(400).json({
        status: 'smtp_error',
        company: eligible.name,
        canton: eligible.canton,
        language: lang,
        error: sendResult.error,
        log: failedLog,
        message: `SMTP dispatch failed for ${eligible.email}: ${sendResult.error}`,
      });
    }

    const nowIso = new Date().toISOString();
    await supabaseDataService.updateCompany(eligible.id, { last_contacted_at: nowIso });
    const deliveredLog = await supabaseDataService.addOutboundLog({
      company_id: eligible.id,
      language: lang,
      subject: rendered.subject,
      body_snippet: rendered.body.substring(0, 180),
      delivery_status: 'delivered',
    });

    const newSentCount = todaySentCount + 1;

    res.json({
      status: 'dispatched',
      company: eligible.name,
      email: eligible.email,
      canton: eligible.canton,
      language: lang,
      messageId: sendResult.messageId,
      todaySentCount: newSentCount,
      dailyLimit: settings.daily_limit,
      log: deliveredLog,
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err?.message || 'Outbound step failed',
    });
  }
});

// ----------------------------------------------------
// Frontend Serving (Vite Middlewares in Dev, Static in Prod)
// ----------------------------------------------------
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 JimiScout BTP production server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
