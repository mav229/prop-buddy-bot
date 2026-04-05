
CREATE TABLE public.hall_of_fame_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT NOT NULL,
  account_number TEXT,
  certificate_url TEXT NOT NULL,
  certificate_type TEXT NOT NULL DEFAULT 'achievement',
  phase TEXT,
  slug TEXT NOT NULL UNIQUE,
  mongo_source_id TEXT NOT NULL UNIQUE,
  mongo_collection TEXT NOT NULL DEFAULT 'payouts',
  payout_amount NUMERIC,
  status TEXT,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.hall_of_fame_certificates ENABLE ROW LEVEL SECURITY;

-- Public read for hall of fame
CREATE POLICY "Anyone can view certificates"
ON public.hall_of_fame_certificates
FOR SELECT
USING (true);

-- Service can insert/update (edge function uses service role)
CREATE POLICY "Service can insert certificates"
ON public.hall_of_fame_certificates
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update certificates"
ON public.hall_of_fame_certificates
FOR UPDATE
USING (true);

-- Admins can delete
CREATE POLICY "Admins can delete certificates"
ON public.hall_of_fame_certificates
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for slug lookups
CREATE INDEX idx_hof_slug ON public.hall_of_fame_certificates(slug);
CREATE INDEX idx_hof_type ON public.hall_of_fame_certificates(certificate_type);

-- Auto-update timestamps
CREATE TRIGGER update_hof_certificates_updated_at
BEFORE UPDATE ON public.hall_of_fame_certificates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
