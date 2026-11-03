import { Worker } from 'bullmq';
import { getRedisConfig } from './config/redis.ts';
import { OUTBOUND_QUEUE_NAME, OutboundJobPayload } from './queues/outbound.queue.ts';
import { INBOUND_QUEUE_NAME, InboundJobPayload } from './queues/inbound.queue.ts';
import { processDispatchOutboundJob } from './jobs/dispatch-outbound.job.ts';
import { processInboundJob } from './jobs/process-inbound.job.ts';
import { imapService } from './services/imap.service.ts';
import { inboundService } from './services/inbound.service.ts';
import { outboundScheduler } from './services/outbound-scheduler.service.ts';
import { companyDiscoveryService } from './services/company-discovery.service.ts';
import { agentOrchestrator } from './services/agent-orchestrator.service.ts';
import { isSwissBusinessHours } from './scheduler.ts';

console.log('========================================================');
console.log('⚡ JimiScout 24/7 Persistent Daemon Worker');
console.log('🇨🇭 Swiss Working Hours Enforcement: 08:30-17:00 Europe/Zurich, Mon-Fri');
console.log(
  `⏱️ Current status in Switzerland: ${
    isSwissBusinessHours() ? '🟢 OPEN (In-Window)' : '🌙 CLOSED (Paused/Standby)'
  }`
);
console.log('========================================================');

export function startWorker() {
  // 1. Start the autonomous outbound scheduler loop (checks Swiss hours, jitter & quota)
  outboundScheduler.startDaemonLoop(60_000);

  // 1b. Search one canton/keyword slice at a time and respect the persisted interval/limit.
  companyDiscoveryService.startDaemonLoop(5 * 60_000);
  agentOrchestrator.startDaemonLoop(60_000);

  // 2. Start IMAP inbox polling with post-processing \Seen guarantees
  imapService.startPolling(async (raw) => {
    console.log(`[Worker:IMAP] Incoming message detected from ${raw.senderEmail}`);
    await inboundService.processInboundMessage({
      senderEmail: raw.senderEmail,
      companyName: raw.senderName,
      rawSubject: raw.subject,
      rawBody: raw.bodyText,
      messageId: raw.messageId,
      imapUid: raw.uid,
      receivedAt: raw.receivedAt.toISOString(),
      isBounceReport: raw.isBounceReport,
      bouncedRecipient: raw.bouncedRecipient,
      source: 'imap',
    });
  });

  // 3. Optional BullMQ workers when Redis is configured
  if (process.env.REDIS_URL) {
    try {
      const outboundWorker = new Worker<OutboundJobPayload>(
        OUTBOUND_QUEUE_NAME,
        async (job) => processDispatchOutboundJob(job),
        getRedisConfig()
      );

      const inboundWorker = new Worker<InboundJobPayload>(
        INBOUND_QUEUE_NAME,
        async (job) => processInboundJob(job),
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

      console.log('[Worker] BullMQ Outbound and Inbound queue workers initialized.');
    } catch (err: any) {
      console.warn('[Worker] BullMQ initialization skipped:', err?.message);
    }
  } else {
    console.log('[Worker] Running in direct scheduler + IMAP daemon mode (REDIS_URL not set).');
  }
}

startWorker();
