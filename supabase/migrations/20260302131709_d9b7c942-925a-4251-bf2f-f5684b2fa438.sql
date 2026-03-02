
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS admin_reply TEXT DEFAULT NULL;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Allow admins to delete tickets (currently missing)
CREATE POLICY "Admins can delete tickets" ON public.support_tickets
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
