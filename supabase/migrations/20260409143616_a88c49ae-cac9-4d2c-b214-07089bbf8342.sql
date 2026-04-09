
-- Create violation_scans table for storing automated scan results
CREATE TABLE public.violation_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_number TEXT NOT NULL,
  user_name TEXT,
  email TEXT,
  risk_level TEXT NOT NULL DEFAULT 'LOW',
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  credential_status TEXT,
  scan_batch_id TEXT NOT NULL,
  scanned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_violation_scans_account ON public.violation_scans(account_number);
CREATE INDEX idx_violation_scans_batch ON public.violation_scans(scan_batch_id);
CREATE INDEX idx_violation_scans_risk ON public.violation_scans(risk_level);
CREATE INDEX idx_violation_scans_scanned ON public.violation_scans(scanned_at DESC);

-- Enable RLS
ALTER TABLE public.violation_scans ENABLE ROW LEVEL SECURITY;

-- Only admins can view
CREATE POLICY "Admins can view violation scans"
  ON public.violation_scans FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Service can insert
CREATE POLICY "Service can insert violation scans"
  ON public.violation_scans FOR INSERT
  TO public
  WITH CHECK (true);

-- Service can update
CREATE POLICY "Service can update violation scans"
  ON public.violation_scans FOR UPDATE
  TO public
  USING (true);

-- Admins can delete old scans
CREATE POLICY "Admins can delete violation scans"
  ON public.violation_scans FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Auto-update timestamp trigger
CREATE TRIGGER update_violation_scans_updated_at
  BEFORE UPDATE ON public.violation_scans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
