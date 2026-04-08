-- Add email and testimonial tracking to certificates
ALTER TABLE public.hall_of_fame_certificates 
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS testimonial_sent_at timestamp with time zone;

-- Create testimonial automation settings (single row)
CREATE TABLE public.testimonial_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.testimonial_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage testimonial settings"
ON public.testimonial_settings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can read testimonial settings"
ON public.testimonial_settings FOR SELECT
TO public
USING (true);

-- Insert default row
INSERT INTO public.testimonial_settings (is_enabled) VALUES (false);

-- Create trigger for updated_at
CREATE TRIGGER update_testimonial_settings_updated_at
BEFORE UPDATE ON public.testimonial_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();