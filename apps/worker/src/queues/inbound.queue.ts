import { Queue } from 'bullmq';
import { getRedisConfig } from '../config/redis.ts';

export const INBOUND_QUEUE_NAME = 'jimiscout-inbound-process';

export interface InboundJobPayload {
  senderEmail: string;
  senderName?: string;
  rawSubject: string;
  rawBody: string;
  receivedAt?: string;
}

export function createInboundQueue() {
  return new Queue<InboundJobPayload>(INBOUND_QUEUE_NAME, getRedisConfig());
}
