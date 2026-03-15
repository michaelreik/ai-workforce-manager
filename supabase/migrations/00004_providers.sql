-- Provider management table
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('openai', 'anthropic', 'google', 'azure', 'custom')),
  display_name TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL, -- encrypted API key
  base_url TEXT, -- optional custom endpoint
  rate_limit_rpm INT, -- requests per minute
  is_default BOOLEAN DEFAULT false,
  health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'down', 'unknown')),
  last_health_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_providers_org_id ON providers(org_id);
CREATE INDEX idx_providers_type ON providers(provider_type);

-- RLS
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see org providers" ON providers
  FOR ALL USING (org_id IN (SELECT user_org_ids()));

-- Updated_at trigger
CREATE TRIGGER providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
