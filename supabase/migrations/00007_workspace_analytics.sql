-- Workspace Analytics — Phase A
-- Track all AI usage across the organization (agents + humans)

-- Usage Sources — where does data come from?
CREATE TABLE usage_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('proxy', 'api_sync', 'csv_import', 'manual')),
  provider TEXT NOT NULL,
  product TEXT,
  config JSONB DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'success', 'error')),
  sync_error TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Workspace Members — all employees with AI tool access
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  department TEXT,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  role TEXT,
  scim_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, email)
);

-- Member Tool Assignments — which tools does each member have?
CREATE TABLE member_tool_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  member_id UUID REFERENCES workspace_members(id) ON DELETE CASCADE,
  source_id UUID REFERENCES usage_sources(id) ON DELETE CASCADE,
  seat_type TEXT,
  monthly_cost DECIMAL(10,2) DEFAULT 0,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, source_id)
);

-- Human Usage Events — aggregated daily usage per member per source
CREATE TABLE human_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  source_id UUID REFERENCES usage_sources(id) ON DELETE SET NULL,
  member_id UUID REFERENCES workspace_members(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  messages_count INT DEFAULT 0,
  conversations_count INT DEFAULT 0,
  tokens_used INT DEFAULT 0,
  cost DECIMAL(10,6) DEFAULT 0,
  active_minutes INT DEFAULT 0,
  models_used TEXT[],
  task_categories JSONB DEFAULT '{}',
  tools_used TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, source_id, member_id, date)
);

-- Workspace Assistants — custom GPTs, bots, etc.
CREATE TABLE workspace_assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  source_id UUID REFERENCES usage_sources(id) ON DELETE SET NULL,
  external_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  creator_member_id UUID REFERENCES workspace_members(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  total_conversations INT DEFAULT 0,
  total_users INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Surveys
CREATE TABLE surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  target TEXT DEFAULT 'all',
  is_anonymous BOOLEAN DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
  member_id UUID REFERENCES workspace_members(id) ON DELETE SET NULL,
  answers JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_usage_sources_org ON usage_sources(org_id);
CREATE INDEX idx_workspace_members_org ON workspace_members(org_id);
CREATE INDEX idx_workspace_members_email ON workspace_members(org_id, email);
CREATE INDEX idx_workspace_members_team ON workspace_members(team_id);
CREATE INDEX idx_member_tools_member ON member_tool_assignments(member_id);
CREATE INDEX idx_member_tools_source ON member_tool_assignments(source_id);
CREATE INDEX idx_human_usage_org_date ON human_usage(org_id, date);
CREATE INDEX idx_human_usage_member ON human_usage(member_id, date);
CREATE INDEX idx_human_usage_source ON human_usage(source_id, date);
CREATE INDEX idx_workspace_assistants_org ON workspace_assistants(org_id);
CREATE INDEX idx_surveys_org ON surveys(org_id);
CREATE INDEX idx_survey_responses_survey ON survey_responses(survey_id);

-- RLS
ALTER TABLE usage_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_tool_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see org usage sources" ON usage_sources
  FOR ALL USING (org_id IN (SELECT user_org_ids()));
CREATE POLICY "Users see org workspace members" ON workspace_members
  FOR ALL USING (org_id IN (SELECT user_org_ids()));
CREATE POLICY "Users see org tool assignments" ON member_tool_assignments
  FOR ALL USING (org_id IN (SELECT user_org_ids()));
CREATE POLICY "Users see org human usage" ON human_usage
  FOR ALL USING (org_id IN (SELECT user_org_ids()));
CREATE POLICY "Users see org assistants" ON workspace_assistants
  FOR ALL USING (org_id IN (SELECT user_org_ids()));
CREATE POLICY "Users see org surveys" ON surveys
  FOR ALL USING (org_id IN (SELECT user_org_ids()));
CREATE POLICY "Users see org survey responses" ON survey_responses
  FOR ALL USING (org_id IN (SELECT user_org_ids()));

-- Updated_at triggers
CREATE TRIGGER usage_sources_updated_at
  BEFORE UPDATE ON usage_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER workspace_assistants_updated_at
  BEFORE UPDATE ON workspace_assistants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
