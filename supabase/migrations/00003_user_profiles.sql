-- User Profiles — V2
-- Personal settings: display name, avatar, timezone, theme, 2FA, notification prefs

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  theme TEXT DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'system')),
  two_factor_enabled BOOLEAN DEFAULT false,
  notification_prefs JSONB DEFAULT '{
    "critical": true,
    "warning": true,
    "info": false,
    "digest": true
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own profile" ON user_profiles
  FOR ALL USING (user_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
