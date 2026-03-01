CREATE TABLE public.session_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  email TEXT NOT NULL,
  context_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, email)
);
ALTER TABLE public.session_cache ENABLE ROW LEVEL SECURITY;