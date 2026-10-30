-- JimiScout BTP - Initial Database Schema Migration
-- Designed for Swiss B2B Machinery Procurement Platform

-- 1. Enums
CREATE TYPE swiss_language AS ENUM ('de', 'fr', 'it');
CREATE TYPE lead_intent AS ENUM ('HOT_LEAD', 'NOT_INTERESTED', 'UNSUBSCRIBE', 'OUT_OF_OFFICE');
CREATE TYPE deal_status AS ENUM ('new', 'contacted', 'inspecting', 'closed', 'passed');
CREATE TYPE tone_type AS ENUM ('swiss_formal', 'approachable_trade', 'fast_cash');

-- 2. Verified Swiss Contractors Directory
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    canton VARCHAR(4) NOT NULL,            -- 'ZH', 'BE', 'VD', 'TI', etc.
    language swiss_language NOT NULL DEFAULT 'de',
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    industry VARCHAR(100) DEFAULT 'civil_engineering', -- 'tiefbau', 'demolition', 'quarry'
    unsubscribed BOOLEAN NOT NULL DEFAULT FALSE,
    last_contacted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_companies_dispatch 
ON companies (canton, language, unsubscribed, last_contacted_at);

-- 3. System Settings & Active Persona (Single-row configuration)
CREATE TABLE agent_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    daily_limit INT NOT NULL DEFAULT 25 CHECK (daily_limit BETWEEN 10 AND 50),
    selected_cantons TEXT[] NOT NULL DEFAULT '{"BE", "ZH", "VD", "TI"}',
    sender_name VARCHAR(100) NOT NULL DEFAULT 'Jamal',
    sender_email VARCHAR(255) NOT NULL DEFAULT 'contact@jimiexport.ch',
    sender_phone VARCHAR(50) NOT NULL DEFAULT '+41 79 123 45 67',
    tone tone_type NOT NULL DEFAULT 'swiss_formal',
    hooks JSONB NOT NULL DEFAULT '{"cash_settlement": true, "transport_covered": true, "as_is": true}'::jsonb,
    equipment_focus TEXT DEFAULT 'Pelles sur chenilles 15-30t, camions benne 4 essieux, chargeuses sur pneus',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Outbound Logs
CREATE TABLE outbound_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    language swiss_language NOT NULL,
    subject TEXT NOT NULL,
    body_snippet TEXT NOT NULL,
    delivery_status VARCHAR(50) NOT NULL DEFAULT 'delivered'
);

-- 5. Inbound Deals (CRM Pipeline)
CREATE TABLE inbound_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    sender_email VARCHAR(255) NOT NULL,
    raw_subject TEXT,
    raw_body TEXT NOT NULL,
    intent lead_intent NOT NULL,
    machinery_detected JSONB NOT NULL DEFAULT '[]'::jsonb,
    contact_name VARCHAR(100),
    contact_phone VARCHAR(50),
    lead_status deal_status NOT NULL DEFAULT 'new',
    ai_summary TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inbound_leads_status ON inbound_leads (lead_status, received_at DESC);

-- Row Level Security (RLS) policies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read/write for agent_settings" ON agent_settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read/write for companies" ON companies
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read/write for inbound_leads" ON inbound_leads
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read/write for outbound_logs" ON outbound_logs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
