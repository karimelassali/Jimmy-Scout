import { Job } from 'bullmq';
import { InboundJobPayload } from '../queues/inbound.queue.ts';
import { geminiService } from '../services/gemini.service.ts';
import { telegramService } from '../services/telegram.service.ts';
import { InboundLead } from '@/packages/types/src/lead.ts';
import { Company } from '@/packages/types/src/database.ts';

export interface ProcessInboundContext {
  findCompanyByEmail: (email: string) => Promise<Company | null>;
  setCompanyUnsubscribed: (companyId: string) => Promise<void>;
  createInboundLead: (lead: Omit<InboundLead, 'id' | 'received_at'>) => Promise<InboundLead>;
}

export async function processInboundJob(
  job: Job<InboundJobPayload>,
  ctx: ProcessInboundContext
) {
  const { senderEmail, rawSubject, rawBody } = job.data;
  console.log(`[JOB:INBOUND] Processing inbound reply from <${senderEmail}>: "${rawSubject}"`);

  // 1. Identify Contractor / Company
  const company = await ctx.findCompanyByEmail(senderEmail);
  const companyName = company?.name || senderEmail.split('@')[1] || senderEmail;
  const canton = company?.canton || 'CH';

  // 2. Google Gemini Flash Analysis
  const analysis = await geminiService.analyzeReply(rawSubject, rawBody, senderEmail);
  console.log(`[JOB:INBOUND] Gemini Triage Intent: ${analysis.intent} (Confidence: ${analysis.confidence})`);

  // 3. Execution Routing
  if (analysis.intent === 'UNSUBSCRIBE' || analysis.intent === 'NOT_INTERESTED') {
    if (company) {
      await ctx.setCompanyUnsubscribed(company.id);
      console.log(`[JOB:INBOUND] Marked company ${company.name} as unsubscribed.`);
    }
    return { status: 'handled', intent: analysis.intent };
  }

  if (analysis.intent === 'OUT_OF_OFFICE') {
    console.log('[JOB:INBOUND] Out-of-office message received. Retaining company in regular rotation.');
    return { status: 'ignored', intent: 'OUT_OF_OFFICE' };
  }

  if (analysis.intent === 'HOT_LEAD') {
    // 4. Save to inbound_leads (CRM Pipeline)
    const newLead = await ctx.createInboundLead({
      company_id: company?.id || null,
      company_name: companyName,
      canton,
      sender_email: senderEmail,
      raw_subject: rawSubject,
      raw_body: rawBody,
      intent: 'HOT_LEAD',
      machinery_detected: analysis.machinery_detected,
      contact_name: analysis.contact_name || company?.name || senderEmail,
      contact_phone: analysis.contact_phone || company?.phone || null,
      lead_status: 'new',
      ai_summary: analysis.french_summary,
      match_score: Math.round((analysis.confidence || 0.9) * 100),
    });

    console.log(`[JOB:INBOUND] Saved HOT_LEAD into CRM (Lead ID: ${newLead.id})`);

    // 5. Dispatch immediate Telegram Mobile Push Notification
    const telegramResult = await telegramService.sendDealNotification({
      companyName,
      canton,
      machinery: analysis.machinery_detected,
      askingPrice: analysis.machinery_detected[0]?.asking_price,
      sellerName: analysis.contact_name || company?.name,
      sellerPhone: analysis.contact_phone || company?.phone || undefined,
      sellerEmail: senderEmail,
      summary: analysis.french_summary,
    });

    return {
      status: 'lead_created',
      leadId: newLead.id,
      machinery: analysis.machinery_detected,
      telegram: telegramResult,
    };
  }

  return { status: 'unhandled_intent', intent: analysis.intent };
}
