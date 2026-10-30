export type SwissLanguage = 'de' | 'fr' | 'it';

export type LeadIntent = 'HOT_LEAD' | 'NOT_INTERESTED' | 'UNSUBSCRIBE' | 'OUT_OF_OFFICE';

export type DealStatus = 'new' | 'contacted' | 'inspecting' | 'closed' | 'passed';

export type ToneType = 'swiss_formal' | 'approachable_trade' | 'fast_cash';

export interface Company {
  id: string;
  name: string;
  domain?: string | null;
  canton: string;
  language: SwissLanguage;
  email: string;
  phone?: string | null;
  industry?: string;
  unsubscribed: boolean;
  last_contacted_at?: string | null;
  created_at: string;
}

export interface PersonaHooks {
  cash_settlement: boolean;
  transport_covered: boolean;
  as_is: boolean;
}

export interface AgentSettings {
  id: string;
  is_active: boolean;
  daily_limit: number;
  selected_cantons: string[];
  sender_name: string;
  sender_email: string;
  sender_phone: string;
  tone: ToneType;
  hooks: PersonaHooks;
  equipment_focus: string;
  updated_at: string;
}

export interface OutboundLog {
  id: string;
  company_id: string;
  sent_at: string;
  language: SwissLanguage;
  subject: string;
  body_snippet: string;
  delivery_status: 'delivered' | 'bounced' | 'deferred' | 'simulated';
}
