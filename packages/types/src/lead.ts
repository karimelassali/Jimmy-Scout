import { DealStatus, LeadIntent } from './database.ts';

export interface DetectedMachinery {
  type: string;        // 'Pelle sur chenilles', 'Camion benne 4 essieux', etc.
  make_model: string;  // e.g. 'CAT 320 GC', 'Volvo L150H'
  year?: number | null;
  hours?: number | null;
  asking_price?: string | null; // e.g. 'CHF 44,000'
  asking_price_amount?: number | null;
  asking_price_currency?: 'CHF' | 'EUR' | 'USD';
  asking_price_chf?: number | null;
  serial_number?: string | null;
  condition?: string | null;
  source_evidence?: string | null;
}

export interface CallLogItem {
  id: string;
  timestamp?: string;
  called_at?: string;
  outcome:
    | 'reached'
    | 'answered'
    | 'voicemail'
    | 'no_answer'
    | 'follow_up_needed'
    | 'inspection_booked'
    | 'offer_made';
  notes: string;
}

export type CallLogEntry = CallLogItem;

export interface ReplyDraftItem {
  id: string;
  created_at?: string;
  subject: string;
  body: string;
  sent_at?: string | null;
  message_id?: string | null;
}

export interface InboundLead {
  id: string;
  company_id?: string | null;
  company_name?: string;
  canton?: string;
  sender_email: string;
  raw_subject?: string | null;
  raw_body: string;
  latest_reply_text?: string | null;
  intent: LeadIntent;
  machinery_detected: DetectedMachinery[];
  contact_name?: string | null;
  contact_phone?: string | null;
  lead_status: DealStatus;
  ai_summary?: string | null;
  received_at: string;
  match_score?: number;
  classification_confidence?: number;
  equipment_fit_score?: number;
  needs_review?: boolean;
  message_id?: string | null;
  in_reply_to?: string | null;
  references?: string[];
  is_deleted?: boolean;
  telegram_notified_at?: string | null;
  telegram_error?: string | null;

  // Phase 10: Follow-ups, inspections & negotiations
  next_action?: string | null;
  next_action_due_at?: string | null;
  inspection_date?: string | null;
  inspection_location?: string | null;
  inspection_notes?: string | null;
  pass_reason?: string | null;
  notes?: string | null;
  purchase_price_chf?: number | null;
  transport_cost_chf?: number | null;
  estimated_resale_chf?: number | null;
  estimated_purchase_value_chf?: number | null;
  estimated_resale_value_chf?: number | null;
  actual_purchase_value_chf?: number | null;
  call_history?: CallLogItem[];
  reply_history?: ReplyDraftItem[];

  // Deal-closing intelligence generated from the available dossier data.
  deal_score?: number;
  deal_score_reasons?: string[];
  market_price_low_chf?: number | null;
  market_price_high_chf?: number | null;
  market_price_confidence?: 'low' | 'medium' | 'high';
  market_price_basis?: string;
  estimated_margin_chf?: number | null;
  missing_information?: string[];
  qualification_subject?: string | null;
  qualification_draft?: string | null;
  negotiation_opening_chf?: number | null;
  negotiation_max_chf?: number | null;
  negotiation_draft?: string | null;
  watchlist_matches?: string[];
  seller_reliability_score?: number;
  seller_history_summary?: string;
}

export interface EquipmentRecord {
  id: string;
  company_id?: string | null;
  lead_id?: string | null;
  company_name?: string;
  canton?: string;
  category: string;
  make_model?: string;
  brand?: string;
  model?: string;
  year?: number | null;
  hours?: number | null;
  operating_hours?: number | null;
  tonnage?: number | null;
  mileage_km?: number | null;
  serial_number?: string | null;
  condition?: string | null;
  location?: string | null;
  location_canton?: string | null;
  availability?: 'available' | 'reserved' | 'sold' | 'unknown';
  decision_status?: string;
  asking_price_amount?: number | null;
  asking_price_currency: 'CHF' | 'EUR' | 'USD';
  asking_price_raw?: string | null;
  asking_price_chf?: number | null;
  purchase_estimate_chf?: number | null;
  target_buy_price_chf?: number | null;
  transport_cost_chf?: number | null;
  estimated_resale_chf?: number | null;
  estimated_export_value_chf?: number | null;
  margin_estimate_chf?: number | null;
  source_evidence?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface GeminiReplyAnalysis {
  intent: LeadIntent;
  confidence: number;
  equipment_fit_score?: number;
  needs_review?: boolean;
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
