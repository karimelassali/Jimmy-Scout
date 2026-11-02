import { Job } from 'bullmq';
import { InboundJobPayload } from '../queues/inbound.queue.ts';
import { inboundService } from '../services/inbound.service.ts';

/**
 * BullMQ worker job handler that delegates to the authoritative
 * inboundService (single source of truth for idempotency, suppression,
 * Gemini triage, and Telegram notification).
 */
export async function processInboundJob(job: Job<InboundJobPayload>) {
  const { senderEmail, rawSubject, rawBody, receivedAt } = job.data;
  console.log(`[JOB:INBOUND] Processing inbound reply from <${senderEmail}>: "${rawSubject}"`);

  return inboundService.processInboundMessage({
    senderEmail,
    rawSubject,
    rawBody,
    messageId: job.id ? String(job.id) : undefined,
    receivedAt,
    source: 'worker_job',
  });
}
