-- JimiScout BTP - Non-Destructive Schema Repair & CRM Expansion Migration
-- Safe to run multiple times on existing installations (idempotent).

-- 1. Extend Enums safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'lead_intent' AND e.enumlabel = 'NEEDS_REVIEW') THEN
        ALTER TYPE lead_intent ADD VALUE 'NEEDS_REVIEW';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'lead_intent' AND e.enumlabel = 'IRRELEVANT') THEN
        ALTER TYPE lead_intent ADD VALUE 'IRRELEVANT';
    END IF;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- 2. Add missing columns to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS language_override BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS verified_email BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS postal_code VARCHAR(32);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS city VARCHAR(128);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS source VARCHAR(64) DEFAULT 'manual';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS confidence NUMERIC(4,3);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS stock_status VARCHAR(64) DEFAULT 'unknown';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS claim_token VARCHAR(128);

-- 3. Add missing columns to outbound_logs
ALTER TABLE outbound_logs ALTER COLUMN company_id DROP NOT NULL;
ALTER TABLE outbound_logs ADD COLUMN IF NOT EXISTS sender_email VARCHAR(255);
ALTER TABLE outbound_logs ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255);
ALTER TABLE outbound_logs ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE outbound_logs ADD COLUMN IF NOT EXISTS canton VARCHAR(8);
ALTER TABLE outbound_logs ADD COLUMN IF NOT EXISTS full_body TEXT;
ALTER TABLE outbound_logs ADD COLUMN IF NOT EXISTS html_body TEXT;
ALTER TABLE outbound_logs ADD COLUMN IF NOT EXISTS smtp_message_id VARCHAR(255);
ALTER TABLE outbound_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE outbound_logs ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_outbound_logs_sent_at ON outbound_logs (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_logs_company_id ON outbound_logs (company_id, sent_at DESC);

-- 4. Add missing columns to inbound_leads
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS canton VARCHAR(8);
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS latest_reply_text TEXT;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS match_score INT;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS classification_confidence NUMERIC(4,3);
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS equipment_fit_score INT;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS message_id VARCHAR(255);
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS in_reply_to VARCHAR(255);
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS "references" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS telegram_notified_at TIMESTAMPTZ;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS telegram_error TEXT;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS next_action_due_at TIMESTAMPTZ;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS inspection_date TIMESTAMPTZ;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS inspection_location TEXT;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS inspection_notes TEXT;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS pass_reason TEXT;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS purchase_price_chf NUMERIC(12,2);
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS transport_cost_chf NUMERIC(12,2);
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS estimated_resale_chf NUMERIC(12,2);
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS call_history JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS reply_history JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inbound_leads_message_id
ON inbound_leads (message_id)
WHERE message_id IS NOT NULL;

-- 5. Create Durable Suppression Registry (for email & domain opt-outs, including unknown senders)
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

-- 6. Create Durable Inbound Message Claims Table (for idempotency & deleted lead protection)
CREATE TABLE IF NOT EXISTS inbound_processed_messages (
    message_key VARCHAR(255) PRIMARY KEY,
    sender_email VARCHAR(255) NOT NULL,
    subject TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'claimed', -- 'claimed', 'processed', 'deleted', 'failed'
    lead_id UUID REFERENCES inbound_leads(id) ON DELETE SET NULL,
    error_message TEXT,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- 7. Create Equipment Records Table (Phase 10.2)
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

CREATE INDEX IF NOT EXISTS idx_equipment_records_lead ON equipment_records (lead_id);

-- 8. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(128),
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE suppression_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_processed_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppression_registry' AND policyname = 'Allow authenticated read/write for suppression_registry') THEN
        CREATE POLICY "Allow authenticated read/write for suppression_registry" ON suppression_registry FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inbound_processed_messages' AND policyname = 'Allow authenticated read/write for inbound_processed_messages') THEN
        CREATE POLICY "Allow authenticated read/write for inbound_processed_messages" ON inbound_processed_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'equipment_records' AND policyname = 'Allow authenticated read/write for equipment_records') THEN
        CREATE POLICY "Allow authenticated read/write for equipment_records" ON equipment_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Allow authenticated read/write for audit_logs') THEN
        CREATE POLICY "Allow authenticated read/write for audit_logs" ON audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;
