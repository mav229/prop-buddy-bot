-- Fix 1: Remove public access to discord_users (service role bypasses RLS anyway)
DROP POLICY IF EXISTS "Service can manage discord users" ON public.discord_users;

-- Fix 2: Remove public read access to chat_history
DROP POLICY IF EXISTS "Public can read chat history" ON public.chat_history;