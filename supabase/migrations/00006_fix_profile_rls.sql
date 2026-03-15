-- Fix RLS for user_profiles to allow INSERT via upsert
-- The existing FOR ALL USING policy should work, but let's make it explicit

DROP POLICY IF EXISTS "Users can manage their own profile" ON user_profiles;

-- Separate policies for clarity
CREATE POLICY "Users can read their own profile" ON user_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own profile" ON user_profiles
  FOR DELETE USING (user_id = auth.uid());
