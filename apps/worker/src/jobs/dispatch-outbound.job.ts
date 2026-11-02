import { Job } from 'bullmq';
import { OutboundJobPayload } from '../queues/outbound.queue.ts';
import { outboundScheduler } from '../services/outbound-scheduler.service.ts';

/**
 * BullMQ worker job handler that delegates to the authoritative
 * outboundScheduler service (single source of truth for Swiss hours,
 * daily quota, 30-day anti-harassment, suppression registry, and language routing).
 */
export async function processDispatchOutboundJob(job: Job<OutboundJobPayload>) {
  const { companyId, email } = job.data;
  console.log(`[JOB:OUTBOUND] Processing queued outbound job ${job.id} (${companyId || email || 'auto'})`);

  return outboundScheduler.executeStep({
    companyId: companyId || undefined,
    manualOverride: false,
  });
}
