-- Ensure admin users can read credit usage rows from session_cache
-- This table contains PII (emails), so keep access restricted to admins only.

ALTER TABLE public.session_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view session cache" ON public.session_cache;
CREATE POLICY "Admins can view session cache"
ON public.session_cache
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));