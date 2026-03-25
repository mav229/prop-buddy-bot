CREATE TABLE widget_user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text,
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  total_sessions integer DEFAULT 1,
  preferences jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE widget_user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No public access" ON widget_user_profiles FOR ALL USING (false);