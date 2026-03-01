CREATE TABLE public.discord_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  discord_username TEXT,
  discord_avatar TEXT,
  assigned_role TEXT NOT NULL DEFAULT 'student',
  last_role_update TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  needs_sync BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.discord_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read discord connections"
  ON public.discord_connections FOR SELECT
  USING (true);

CREATE POLICY "Service can insert discord connections"
  ON public.discord_connections FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update discord connections"
  ON public.discord_connections FOR UPDATE
  USING (true);

CREATE TRIGGER set_discord_connections_updated_at
  BEFORE UPDATE ON public.discord_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();