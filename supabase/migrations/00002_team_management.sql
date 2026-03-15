-- Team Management — V2
-- Adds color, icon, team lead, and team_members table

-- ============================================================
-- 1. Extend teams table
-- ============================================================
ALTER TABLE teams
  ADD COLUMN color TEXT DEFAULT '#6366f1',
  ADD COLUMN icon TEXT DEFAULT '🤖',
  ADD COLUMN lead_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================================
-- 2. Team members
-- ============================================================
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'lead')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- ============================================================
-- 3. Indexes
-- ============================================================
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_teams_lead_user_id ON teams(lead_user_id);

-- ============================================================
-- 4. RLS
-- ============================================================
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see org team members" ON team_members
  FOR ALL USING (
    team_id IN (
      SELECT id FROM teams WHERE org_id IN (SELECT user_org_ids())
    )
  );

-- ============================================================
-- 5. Updated_at trigger on teams
-- ============================================================
CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
