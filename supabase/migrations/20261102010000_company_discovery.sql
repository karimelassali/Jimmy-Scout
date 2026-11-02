-- JimiScout autonomous contractor discovery.
-- Idempotent and safe to apply after the CRM expansion migration.

ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS discovery_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS outreach_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS discovery_daily_limit INT NOT NULL DEFAULT 25;
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS discovery_interval_minutes INT NOT NULL DEFAULT 120;
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS discovery_keywords TEXT[] NOT NULL DEFAULT ARRAY[
  'entreprise de terrassement',
  'Tiefbauunternehmen',
  'entreprise de démolition',
  'Baumaschinen Vermietung',
  'genio civile'
];

ALTER TABLE companies ADD COLUMN IF NOT EXISTS source_id VARCHAR(255);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email_source_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_companies_source_id ON companies (source, source_id)
WHERE source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS discovery_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(32) NOT NULL,
  source_id VARCHAR(512) NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  company_name VARCHAR(255) NOT NULL,
  canton VARCHAR(8) NOT NULL,
  website TEXT,
  email VARCHAR(255),
  phone VARCHAR(80),
  address TEXT,
  status VARCHAR(32) NOT NULL,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  evidence_url TEXT,
  query TEXT NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discovery_records_date
ON discovery_records (discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_records_source
ON discovery_records (source, source_id);
CREATE INDEX IF NOT EXISTS idx_discovery_records_status
ON discovery_records (status, discovered_at DESC);

ALTER TABLE discovery_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'discovery_records'
      AND policyname = 'Allow authenticated read/write for discovery_records'
  ) THEN
    CREATE POLICY "Allow authenticated read/write for discovery_records"
    ON discovery_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
