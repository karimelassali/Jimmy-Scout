export type SwissLanguage = 'de' | 'fr' | 'it';

export type LeadIntent =
  | 'HOT_LEAD'
  | 'NOT_INTERESTED'
  | 'UNSUBSCRIBE'
  | 'OUT_OF_OFFICE'
  | 'NEEDS_REVIEW'
  | 'IRRELEVANT';

export type DealStatus =
  | 'new'
  | 'contacted'
  | 'inspecting'
  | 'inspection_scheduled'
  | 'inspected'
  | 'negotiating'
  | 'purchased'
  | 'closed'
  | 'passed'
  | 'archived'
  | 'deleted';

export type ToneType = 'swiss_formal' | 'approachable_trade' | 'fast_cash';

export type OutboundDeliveryStatus =
  | 'queued'
  | 'sending'
  | 'accepted'
  | 'delivered'
  | 'bounced'
  | 'deferred'
  | 'failed'
  | 'simulated';

export type CompanyStockStatus =
  | 'unknown'
  | 'has_stock'
  | 'no_stock_temporarily'
  | 'declined'
  | 'active_seller'
  | 'opted_out';

export interface Company {
  id: string;
  name: string;
  domain?: string | null;
  canton: string;
  language: SwissLanguage;
  language_override?: boolean;
  email: string;
  verified_email?: boolean;
  phone?: string | null;
  contact_person?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  industry?: string;
  notes?: string | null;
  source?: string | null;
  source_id?: string | null;
  website?: string | null;
  email_source_url?: string | null;
  discovered_at?: string | null;
  confidence?: number | null;
  stock_status?: CompanyStockStatus;
  unsubscribed: boolean;
  last_contacted_at?: string | null;
  claimed_at?: string | null;
  claim_token?: string | null;
  created_at: string;
}

export interface SuppressionEntry {
  id: string;
  email?: string | null;
  domain?: string | null;
  companyName?: string | null;
  reason:
    | 'unsubscribe_reply'
    | 'manual_suppression'
    | 'manual_opt_out'
    | 'hard_bounce'
    | 'complaint'
    | string;
  source: string;
  notes?: string | null;
  unsubscribed?: boolean;
  created_at: string;
}

export interface PersonaHooks {
  cash_settlement: boolean;
  transport_covered: boolean;
  as_is: boolean;
}

export type AutomationMode = 'off' | 'approval' | 'auto';

export interface AgentFeatureControls {
  deal_scoring: AutomationMode;
  follow_ups: AutomationMode;
  qualification: AutomationMode;
  price_comparison: AutomationMode;
  watchlists: AutomationMode;
  daily_briefing: AutomationMode;
  negotiation: AutomationMode;
  seller_intelligence: AutomationMode;
}

export interface AgentSettings {
  id: string;
  is_active: boolean;
  discovery_active: boolean;
  outreach_active: boolean;
  discovery_daily_limit: number;
  discovery_interval_minutes: number;
  discovery_keywords: string[];
  daily_limit: number;
  selected_cantons: string[];
  sender_name: string;
  sender_email: string;
  sender_phone: string;
  tone: ToneType;
  hooks: PersonaHooks;
  equipment_focus: string;
  feature_controls: AgentFeatureControls;
  follow_up_first_business_days: number;
  follow_up_final_business_days: number;
  daily_briefing_hour: number;
  updated_at: string;
}

export type AgentActionType =
  | 'follow_up_1'
  | 'follow_up_final'
  | 'qualification_reply'
  | 'daily_briefing'
  | 'watchlist_match';

export type AgentActionStatus =
  | 'pending_approval'
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface AgentAction {
  id: string;
  type: AgentActionType;
  status: AgentActionStatus;
  company_id?: string | null;
  lead_id?: string | null;
  recipient_email?: string | null;
  title: string;
  reason: string;
  rule: string;
  payload: Record<string, unknown>;
  scheduled_for: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  error?: string | null;
}

export interface WatchlistRule {
  id: string;
  name: string;
  enabled: boolean;
  keywords: string[];
  min_year?: number | null;
  max_hours?: number | null;
  max_price_chf?: number | null;
  cantons: string[];
  created_at: string;
  updated_at: string;
}

export type DiscoveryRecordStatus =
  | 'ready'
  | 'missing_email'
  | 'duplicate'
  | 'rejected'
  | 'error';

export interface DiscoveryRecord {
  id: string;
  source: 'google_places' | 'foursquare' | 'openstreetmap' | 'zefix' | 'stub';
  source_id: string;
  company_id?: string | null;
  company_name: string;
  canton: string;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status: DiscoveryRecordStatus;
  confidence: number;
  reason: string;
  evidence_url?: string | null;
  query: string;
  discovered_at: string;
}

export interface DiscoveryStats {
  found_today: number;
  ready_today: number;
  missing_email_today: number;
  duplicates_today: number;
  rejected_today: number;
  total_discovered: number;
}

export type DiscoveryStateType =
  | 'paused'
  | 'enabled'
  | 'running'
  | 'waiting'
  | 'quota_reached'
  | 'blocked'
  | 'failed';

export interface DiscoverySchedulerStatus extends DiscoveryStats {
  state: DiscoveryStateType;
  provider_configured: boolean;
  last_run_at?: string | null;
  next_run_at?: string | null;
  last_error?: string | null;
  last_canton?: string | null;
}

export interface OutboundLog {
  id: string;
  company_id: string;
  sent_at: string;
  language: SwissLanguage;
  subject: string;
  body_snippet: string;
  delivery_status: OutboundDeliveryStatus;
  sender_email?: string;
  recipient_email?: string;
  company_name?: string;
  canton?: string;
  full_body?: string;
  html_body?: string;
  smtp_message_id?: string | null;
  error_message?: string | null;
  is_test?: boolean;
}

export type SchedulerStateType =
  | 'paused'
  | 'enabled'
  | 'running'
  | 'waiting_for_hours'
  | 'quota_reached'
  | 'blocked'
  | 'failed';

export interface SchedulerStatus {
  state: SchedulerStateType;
  is_active: boolean;
  is_swiss_business_hours: boolean;
  swiss_time: string;
  today_sent: number;
  daily_limit: number;
  eligible_count: number;
  queue_depth: number;
  last_heartbeat_at?: string | null;
  last_run_at?: string | null;
  next_send_at?: string | null;
  last_error?: string | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: 'settings' | 'company' | 'suppression' | 'lead' | 'outbound' | 'equipment' | 'import' | 'agent_action' | 'watchlist';
  entity_id?: string | null;
  details: string;
  created_at: string;
}
