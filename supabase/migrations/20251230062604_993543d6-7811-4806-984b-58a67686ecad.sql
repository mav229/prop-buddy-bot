-- Store a single global widget configuration
CREATE TABLE IF NOT EXISTS public.widget_config (
  id TEXT NOT NULL PRIMARY KEY,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.widget_config ENABLE ROW LEVEL SECURITY;

-- Public read access (widget needs to load styling for all visitors)
DROP POLICY IF EXISTS "Widget config is readable by everyone" ON public.widget_config;
CREATE POLICY "Widget config is readable by everyone"
ON public.widget_config
FOR SELECT
USING (true);

-- Admin-only write access (use correct signature: uuid, app_role)
DROP POLICY IF EXISTS "Admins can insert widget config" ON public.widget_config;
CREATE POLICY "Admins can insert widget config"
ON public.widget_config
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update widget config" ON public.widget_config;
CREATE POLICY "Admins can update widget config"
ON public.widget_config
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete widget config" ON public.widget_config;
CREATE POLICY "Admins can delete widget config"
ON public.widget_config
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS set_widget_config_updated_at ON public.widget_config;
CREATE TRIGGER set_widget_config_updated_at
BEFORE UPDATE ON public.widget_config
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Ensure default row exists
INSERT INTO public.widget_config (id, config)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;