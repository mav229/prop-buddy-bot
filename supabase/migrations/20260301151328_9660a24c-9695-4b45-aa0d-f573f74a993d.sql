-- Add sequential ticket number
CREATE SEQUENCE IF NOT EXISTS support_ticket_number_seq START WITH 100;

ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS ticket_number integer DEFAULT nextval('support_ticket_number_seq');

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_number ON public.support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_support_tickets_session_id ON public.support_tickets(session_id);