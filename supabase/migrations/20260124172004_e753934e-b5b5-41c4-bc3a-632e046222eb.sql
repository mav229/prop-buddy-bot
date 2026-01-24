-- Create settings table for PS MOD bot (separate from autobot_settings)
CREATE TABLE public.ps_mod_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  delay_seconds INTEGER NOT NULL DEFAULT 120,
  bot_name TEXT NOT NULL DEFAULT 'PS MOD',
  channels TEXT[] DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ps_mod_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings (for the bot)
CREATE POLICY "Anyone can read ps_mod_settings"
ON public.ps_mod_settings
FOR SELECT
USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update ps_mod_settings"
ON public.ps_mod_settings
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_ps_mod_settings_updated_at
BEFORE UPDATE ON public.ps_mod_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.ps_mod_settings (is_enabled, delay_seconds, bot_name)
VALUES (true, 120, 'PS MOD');