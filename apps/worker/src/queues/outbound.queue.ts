import { Queue } from 'bullmq';
import { getRedisConfig } from '../config/redis.ts';

export const OUTBOUND_QUEUE_NAME = 'jimiscout-outbound-dispatch';

export interface OutboundJobPayload {
  companyId: string;
  companyName: string;
  email: string;
  canton: string;
  language: 'de' | 'fr' | 'it';
}

export function createOutboundQueue() {
  return new Queue<OutboundJobPayload>(OUTBOUND_QUEUE_NAME, getRedisConfig());
}
