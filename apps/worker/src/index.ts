import { Worker } from 'bullmq';
import { getRedisConfig } from './config/redis.ts';
import { OUTBOUND_QUEUE_NAME, OutboundJobPayload } from './queues/outbound.queue.ts';
import { INBOUND_QUEUE_NAME, InboundJobPayload } from './queues/inbound.queue.ts';
import { processDispatchOutboundJob, DispatchOutboundContext } from './jobs/dispatch-outbound.job.ts';
import { processInboundJob, ProcessInboundContext } from './jobs/process-inbound.job.ts';
import { imapService } from './services/imap.service.ts';
import { supabaseDataService } from './services/supabase.service.ts';
import { isSwissBusinessHours } from './scheduler.ts';

console.log('========================================================');
console.log('⚡ JimiScout 24/7 Persistent Daemon Worker (Railway)');
console.log('🇨🇭 Swiss Working Hours Enforcement: 08:30-17:00 CET, Mon-Fri');
console.log(`⏱️ Current status in Switzerland: ${isSwissBusinessHours() ? '🟢 OPEN (In-Window)' : '🌙 CLOSED (Paused/Standby)'}`);
console.log('========================================================');

const workerContext: DispatchOutboundContext & ProcessInboundContext = {
  getSettings: () => supabaseDataService.getSettings(),
  getCompany: async (id: string) => {
    const companies = await supabaseDataService.getCompanies();
    return companies.find((c) => c.id === id) || null;
  },
  updateCompanyLastContacted: (id: string, date: Date) =>
    supabaseDataService.updateCompany(id, { last_contacted_at: date.toISOString() }),
  logOutbound: async (data) => {
    await supabaseDataService.addOutboundLog({
      company_id: data.companyId,
      language: data.language,
      subject: data.subject,
      body_snippet: data.bodySnippet,
      delivery_status: data.deliveryStatus as 'delivered' | 'bounced' | 'simulated',
    });
  },
  getDailySentCount: () => supabaseDataService.getTodaySentCount(),
  findCompanyByEmail: (email: string) => supabaseDataService.findCompanyByEmail(email),
  setCompanyUnsubscribed: (companyId: string) =>
    supabaseDataService.updateCompany(companyId, { unsubscribed: true }),
  createInboundLead: (lead) => supabaseDataService.createLead(lead),
};

export function startWorker() {
  try {
    const outboundWorker = new Worker<OutboundJobPayload>(
      OUTBOUND_QUEUE_NAME,
      async (job) => {
        return processDispatchOutboundJob(job, workerContext);
      },
      getRedisConfig()
    );

    const inboundWorker = new Worker<InboundJobPayload>(
      INBOUND_QUEUE_NAME,
      async (job) => {
        return processInboundJob(job, workerContext);
      },
      getRedisConfig()
    );

    outboundWorker.on('completed', (job) => {
      console.log(`[Worker] Outbound job ${job.id} completed.`);
    });

    outboundWorker.on('error', (err) => {
      console.warn('[Worker:Outbound] Redis connection notice:', err.message);
    });

    inboundWorker.on('completed', (job) => {
      console.log(`[Worker] Inbound job ${job.id} completed.`);
    });

    inboundWorker.on('error', (err) => {
      console.warn('[Worker:Inbound] Redis connection notice:', err.message);
    });

    imapService.startPolling(async (raw) => {
      console.log(`[Worker] IMAP incoming detected from ${raw.senderEmail}`);
      await processInboundJob(
        {
          id: raw.messageId,
          data: {
            senderEmail: raw.senderEmail,
            rawSubject: raw.subject,
            rawBody: raw.bodyText,
            receivedAt: raw.receivedAt.toISOString(),
          },
        } as any,
        workerContext
      );
    });

    console.log('[Worker] Outbound and Inbound queue workers initialized.');
  } catch (err: any) {
    console.warn('[Worker] Worker initialization error:', err?.message);
  }
}

startWorker();
