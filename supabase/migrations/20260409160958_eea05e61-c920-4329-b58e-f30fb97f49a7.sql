
CREATE TABLE public.flagged_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_number TEXT NOT NULL,
  user_name TEXT,
  email TEXT,
  flag_type TEXT NOT NULL,
  flag_detail TEXT,
  risk_level TEXT NOT NULL DEFAULT 'HIGH',
  metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  flagged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_number)
);

ALTER TABLE public.flagged_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view flagged accounts" ON public.flagged_accounts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete flagged accounts" ON public.flagged_accounts
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert flagged accounts" ON public.flagged_accounts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update flagged accounts" ON public.flagged_accounts
  FOR UPDATE USING (true);
