-- JimiScout BTP - Complete Database Schema Migration
-- Includes initial tables and non-destructive CRM & reliability extensions

-- 1. Enums
DO $$ BEGIN
    CREATE TYPE swiss_language AS ENUM ('de', 'fr', 'it');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE lead_intent AS ENUM ('HOT_LEAD', 'NOT_INTERESTED', 'UNSUBSCRIBE', 'OUT_OF_OFFICE', 'NEEDS_REVIEW', 'IRRELEVANT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE deal_status AS ENUM ('new', 'contacted', 'inspecting', 'closed', 'passed', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE tone_type AS ENUM ('swiss_formal', 'approachable_trade', 'fast_cash');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Verified Swiss Contractors Directory
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    canton VARCHAR(4) NOT NULL,
    language swiss_language NOT NULL DEFAULT 'de',
    language_override BOOLEAN NOT NULL DEFAULT FALSE,
    email VARCHAR(255) UNIQUE NOT NULL,
    verified_email BOOLEAN NOT NULL DEFAULT TRUE,
    phone VARCHAR(50),
    contact_person VARCHAR(255),
    address TEXT,
    postal_code VARCHAR(32),
    city VARCHAR(128),
    industry VARCHAR(100) DEFAULT 'civil_engineering',
    notes TEXT,
    source VARCHAR(64) DEFAULT 'manual',
    confidence NUMERIC(4,3),
    stock_status VARCHAR(64) DEFAULT 'unknown',
    unsubscribed BOOLEAN NOT NULL DEFAULT FALSE,
    last_contacted_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    claim_token VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_dispatch 
ON companies (canton, language, unsubscribed, last_contacted_at);

-- 3. System Settings & Active Persona (Single-row configuration)
CREATE TABLE IF NOT EXISTS agent_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    daily_limit INT NOT NULL DEFAULT 25 CHECK (daily_limit BETWEEN 5 AND 100),
    selected_cantons TEXT[] NOT NULL DEFAULT '{"BE", "ZH", "VD", "TI", "GE", "VS"}',
    sender_name VARCHAR(100) NOT NULL DEFAULT 'Jamal',
    sender_email VARCHAR(255) NOT NULL DEFAULT 'info@jimyexport.ch',
    sender_phone VARCHAR(50) NOT NULL DEFAULT '+41 79 123 45 67',
    tone tone_type NOT NULL DEFAULT 'swiss_formal',
    hooks JSONB NOT NULL DEFAULT '{"cash_settlement": true, "transport_covered": true, "as_is": true}'::jsonb,
    equipment_focus TEXT DEFAULT 'Pelles sur chenilles 15-30t, camions benne 4 essieux, chargeuses sur pneus, concasseurs',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Outbound Logs
CREATE TABLE IF NOT EXISTS outbound_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    language swiss_language NOT NULL,
    subject TEXT NOT NULL,
    body_snippet TEXT NOT NULL,
    delivery_status VARCHAR(50) NOT NULL DEFAULT 'accepted',
    sender_email VARCHAR(255),
    recipient_email VARCHAR(255),
    company_name VARCHAR(255),
    canton VARCHAR(8),
    full_body TEXT,
    html_body TEXT,
    smtp_message_id VARCHAR(255),
    error_message TEXT,
    is_test BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_outbound_logs_sent_at ON outbound_logs (sent_at DESC);

-- 5. Inbound Deals (CRM Pipeline)
CREATE TABLE IF NOT EXISTS inbound_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    company_name VARCHAR(255),
    canton VARCHAR(8),
    sender_email VARCHAR(255) NOT NULL,
    raw_subject TEXT,
    raw_body TEXT NOT NULL,
    latest_reply_text TEXT,
    intent lead_intent NOT NULL,
    machinery_detected JSONB NOT NULL DEFAULT '[]'::jsonb,
    contact_name VARCHAR(100),
    contact_phone VARCHAR(50),
    lead_status deal_status NOT NULL DEFAULT 'new',
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ai_summary TEXT,
    match_score INT,
    classification_confidence NUMERIC(4,3),
    equipment_fit_score INT,
    needs_review BOOLEAN NOT NULL DEFAULT FALSE,
    message_id VARCHAR(255),
    in_reply_to VARCHAR(255),
    "references" JSONB DEFAULT '[]'::jsonb,
    telegram_notified_at TIMESTAMPTZ,
    telegram_error TEXT,
    next_action TEXT,
    next_action_due_at TIMESTAMPTZ,
    inspection_date TIMESTAMPTZ,
    inspection_location TEXT,
    inspection_notes TEXT,
    pass_reason TEXT,
    notes TEXT,
    purchase_price_chf NUMERIC(12,2),
    transport_cost_chf NUMERIC(12,2),
    estimated_resale_chf NUMERIC(12,2),
    call_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    reply_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_leads_status ON inbound_leads (lead_status, received_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inbound_leads_message_id ON inbound_leads (message_id) WHERE message_id IS NOT NULL;

-- 6. Suppression Registry
CREATE TABLE IF NOT EXISTS suppression_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255),
    domain VARCHAR(255),
    reason VARCHAR(64) NOT NULL DEFAULT 'unsubscribe_reply',
    source VARCHAR(128) NOT NULL DEFAULT 'inbound_email',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_suppression_target CHECK (email IS NOT NULL OR domain IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppression_email ON suppression_registry (LOWER(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppression_domain ON suppression_registry (LOWER(domain)) WHERE domain IS NOT NULL;

-- 7. Processed Inbound Message Registry
CREATE TABLE IF NOT EXISTS inbound_processed_messages (
    message_key VARCHAR(255) PRIMARY KEY,
    sender_email VARCHAR(255) NOT NULL,
    subject TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'claimed',
    lead_id UUID REFERENCES inbound_leads(id) ON DELETE SET NULL,
    error_message TEXT,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- 8. Equipment Records
CREATE TABLE IF NOT EXISTS equipment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES inbound_leads(id) ON DELETE SET NULL,
    company_name VARCHAR(255),
    canton VARCHAR(8),
    category VARCHAR(128) NOT NULL,
    make_model VARCHAR(255) NOT NULL,
    year INT,
    hours INT,
    mileage_km INT,
    serial_number VARCHAR(128),
    condition TEXT,
    location VARCHAR(255),
    availability VARCHAR(32) NOT NULL DEFAULT 'available',
    asking_price_amount NUMERIC(12,2),
    asking_price_currency VARCHAR(8) NOT NULL DEFAULT 'CHF',
    asking_price_raw VARCHAR(128),
    purchase_estimate_chf NUMERIC(12,2),
    transport_cost_chf NUMERIC(12,2),
    estimated_resale_chf NUMERIC(12,2),
    margin_estimate_chf NUMERIC(12,2),
    source_evidence TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(128),
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security (RLS) policies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppression_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_processed_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
