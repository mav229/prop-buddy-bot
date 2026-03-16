
-- Auto-replies table for canned responses
CREATE TABLE public.auto_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_keywords TEXT[] NOT NULL DEFAULT '{}',
  response_text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  match_mode TEXT NOT NULL DEFAULT 'contains' CHECK (match_mode IN ('contains', 'exact', 'starts_with')),
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage auto replies" ON public.auto_replies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Auto replies publicly readable" ON public.auto_replies
  FOR SELECT TO public
  USING (true);

-- Chat ratings table
CREATE TABLE public.chat_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  message_index INTEGER NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, message_index)
);

ALTER TABLE public.chat_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert ratings" ON public.chat_ratings
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Admins can view ratings" ON public.chat_ratings
  FOR SELECT TO public
  USING (public.has_role(auth.uid(), 'admin'));
