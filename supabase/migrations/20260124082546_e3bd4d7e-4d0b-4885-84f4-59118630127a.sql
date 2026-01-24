-- Add name column to widget_leads table for ticket form submissions
ALTER TABLE public.widget_leads 
ADD COLUMN IF NOT EXISTS name text;