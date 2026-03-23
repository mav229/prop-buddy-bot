
CREATE TABLE public.discord_connection_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  discord_username text,
  discord_user_id text,
  action text NOT NULL DEFAULT 'connect',
  status text NOT NULL DEFAULT 'success',
  assigned_role text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discord_connection_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view connection logs"
  ON public.discord_connection_logs
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert connection logs"
  ON public.discord_connection_logs
  FOR INSERT
  TO public
  WITH CHECK (true);
