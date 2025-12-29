-- Create discord_users table for persistent user profiles
CREATE TABLE public.discord_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id text UNIQUE NOT NULL,
  username text NOT NULL,
  display_name text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  message_count integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discord_users ENABLE ROW LEVEL SECURITY;

-- Public read access for the bot
CREATE POLICY "Discord users are publicly readable"
ON public.discord_users
FOR SELECT
USING (true);

-- Public insert/update for the bot (edge function uses service role)
CREATE POLICY "Service can manage discord users"
ON public.discord_users
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_discord_users_updated_at
BEFORE UPDATE ON public.discord_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_discord_users_discord_user_id ON public.discord_users(discord_user_id);