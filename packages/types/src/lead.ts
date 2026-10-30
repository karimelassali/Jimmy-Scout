import { DealStatus, LeadIntent } from './database.ts';

export interface DetectedMachinery {
  type: string;        // 'Pelle sur chenilles', 'Camion benne 4 essieux', etc.
  make_model: string;  // e.g. 'CAT 320 GC', 'Volvo L150H'
  year?: number;
  hours?: number;
  asking_price?: string; // e.g. 'CHF 44,000'
}

export interface InboundLead {
  id: string;
  company_id?: string | null;
  company_name?: string;
  canton?: string;
  sender_email: string;
  raw_subject?: string | null;
  raw_body: string;
  intent: LeadIntent;
  machinery_detected: DetectedMachinery[];
  contact_name?: string | null;
  contact_phone?: string | null;
  lead_status: DealStatus;
  ai_summary?: string | null;
  received_at: string;
  match_score?: number;
}

export interface GeminiReplyAnalysis {
  intent: LeadIntent;
  confidence: number;
  machinery_detected: DetectedMachinery[];
  contact_name?: string;
  contact_phone?: string;
  french_summary: string;
}

export interface TelegramNotificationPayload {
  chat_id: string;
  text: string;
  parse_mode: 'HTML' | 'MarkdownV2' | 'Markdown';
  company_name: string;
  canton: string;
  machinery_summary: string;
  asking_price?: string;
  seller_name?: string;
  phone?: string;
  email?: string;
}
