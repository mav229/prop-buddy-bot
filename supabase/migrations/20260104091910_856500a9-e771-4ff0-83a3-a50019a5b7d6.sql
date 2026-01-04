-- Create widget_leads table for email collection
CREATE TABLE public.widget_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  session_id TEXT,
  source TEXT NOT NULL DEFAULT 'discount_popup',
  page_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on email to prevent duplicates
CREATE UNIQUE INDEX widget_leads_email_unique ON public.widget_leads (email);

-- Enable Row Level Security
ALTER TABLE public.widget_leads ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (for collecting emails from widget)
CREATE POLICY "Anyone can insert leads"
ON public.widget_leads
FOR INSERT
WITH CHECK (true);

-- Admins can view all leads
CREATE POLICY "Admins can view leads"
ON public.widget_leads
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update leads
CREATE POLICY "Admins can update leads"
ON public.widget_leads
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete leads
CREATE POLICY "Admins can delete leads"
ON public.widget_leads
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));