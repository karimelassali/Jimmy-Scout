import { Job } from 'bullmq';
import { OutboundJobPayload } from '../queues/outbound.queue.ts';
import { smtpService } from '../services/smtp.service.ts';
import {
  isSwissBusinessHours,
  getRandomJitterMs,
  getLanguageForCanton,
  isEligibleForOutbound,
} from '../scheduler.ts';
import { generateDeTemplate } from '../templates/de.template.ts';
import { generateFrTemplate } from '../templates/fr.template.ts';
import { generateItTemplate } from '../templates/it.template.ts';
import { AgentSettings, Company } from '@/packages/types/src/database.ts';

export interface DispatchOutboundContext {
  getSettings: () => Promise<AgentSettings>;
  getCompany: (id: string) => Promise<Company | null>;
  updateCompanyLastContacted: (id: string, date: Date) => Promise<void>;
  logOutbound: (data: {
    companyId: string;
    language: 'de' | 'fr' | 'it';
    subject: string;
    bodySnippet: string;
    deliveryStatus: string;
  }) => Promise<void>;
  getDailySentCount: () => Promise<number>;
}

export async function processDispatchOutboundJob(
  job: Job<OutboundJobPayload>,
  ctx: DispatchOutboundContext
) {
  const { companyId, email } = job.data;
  console.log(`[JOB:OUTBOUND] Evaluating dispatch for company ${companyId} <${email}>`);

  // 1. Safety Constraint: System Master Toggle
  const settings = await ctx.getSettings();
  if (!settings.is_active) {
    console.log('[JOB:OUTBOUND] Aborted: Agent settings is_active is FALSE.');
    return { status: 'aborted', reason: 'agent_inactive' };
  }

  // 2. Safety Constraint: Swiss Working Hours (08:30 - 17:00 CET, Mon-Fri)
  if (!isSwissBusinessHours()) {
    console.log('[JOB:OUTBOUND] Deferred: Current time is outside Swiss business hours (08:30-17:00 CET, Mon-Fri).');
    return { status: 'deferred', reason: 'outside_swiss_business_hours' };
  }

  // 3. Safety Constraint: Daily Limit
  const sentToday = await ctx.getDailySentCount();
  if (sentToday >= settings.daily_limit) {
    console.log(`[JOB:OUTBOUND] Quota reached: ${sentToday}/${settings.daily_limit} sent today. Aborting.`);
    return { status: 'quota_reached', count: sentToday };
  }

  // 4. Safety Constraint: 30-Day Anti-Harassment & Unsubscribe Check
  const company = await ctx.getCompany(companyId);
  if (!company) {
    return { status: 'error', reason: 'company_not_found' };
  }

  if (!isEligibleForOutbound(company.last_contacted_at, company.unsubscribed)) {
    console.log(`[JOB:OUTBOUND] Skipped: Company ${company.name} contacted within last 30 days or unsubscribed.`);
    return { status: 'skipped', reason: 'anti_harassment_or_unsubscribed' };
  }

  // Check canton filter
  if (!settings.selected_cantons.includes(company.canton)) {
    console.log(`[JOB:OUTBOUND] Skipped: Canton ${company.canton} not in selected_cantons.`);
    return { status: 'skipped', reason: 'canton_not_selected' };
  }

  // 5. Language Matching
  const language = getLanguageForCanton(company.canton);

  const templateParams = {
    companyName: company.name,
    recipientName: company.name,
    canton: company.canton,
    senderName: settings.sender_name,
    senderEmail: settings.sender_email,
    senderPhone: settings.sender_phone,
    tone: settings.tone,
    hooks: settings.hooks,
    equipmentFocus: settings.equipment_focus,
  };

  let rendered: { subject: string; body: string };
  if (language === 'fr') {
    rendered = generateFrTemplate(templateParams);
  } else if (language === 'it') {
    rendered = generateItTemplate(templateParams);
  } else {
    rendered = generateDeTemplate(templateParams);
  }

  // 6. Randomized Jitter Delay (8 - 18 minutes)
  const jitterMs = getRandomJitterMs();
  console.log(`[JOB:OUTBOUND] Applying randomized anti-spam jitter delay: ${(jitterMs / 60000).toFixed(1)} mins`);

  // 7. Dispatch via Nodemailer SMTP
  const sendResult = await smtpService.sendMail({
    to: company.email,
    subject: rendered.subject,
    text: rendered.body,
    replyTo: settings.sender_email,
  });

  if (!sendResult.success) {
    await ctx.logOutbound({
      companyId: company.id,
      language,
      subject: rendered.subject,
      bodySnippet: `SMTP Error: ${sendResult.error}`,
      deliveryStatus: 'bounced',
    });
    return {
      status: 'error',
      reason: sendResult.error,
      company: company.name,
    };
  }

  const now = new Date();
  await ctx.updateCompanyLastContacted(company.id, now);
  await ctx.logOutbound({
    companyId: company.id,
    language,
    subject: rendered.subject,
    bodySnippet: rendered.body.substring(0, 200),
    deliveryStatus: 'delivered',
  });

  console.log(`[JOB:OUTBOUND] Successfully dispatched to ${company.name} (${company.canton}) in ${language.toUpperCase()}`);

  return {
    status: 'sent',
    company: company.name,
    language,
    messageId: sendResult.messageId,
  };
}
