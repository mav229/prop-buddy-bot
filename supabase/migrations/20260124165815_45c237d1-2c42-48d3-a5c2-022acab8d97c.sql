-- Create table for autobot (auto-reply bot) settings
CREATE TABLE public.autobot_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  delay_seconds INTEGER NOT NULL DEFAULT 120,
  channels TEXT[] DEFAULT '{}',
  bot_name TEXT DEFAULT 'PropScholar Assistant',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.autobot_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can view autobot settings" 
ON public.autobot_settings 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update autobot settings" 
ON public.autobot_settings 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert autobot settings" 
ON public.autobot_settings 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow anon read for bot/edge function access
CREATE POLICY "Service can read autobot settings"
ON public.autobot_settings
FOR SELECT
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_autobot_settings_updated_at
BEFORE UPDATE ON public.autobot_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings row
INSERT INTO public.autobot_settings (is_enabled, delay_seconds, bot_name)
VALUES (false, 120, 'PropScholar Assistant');