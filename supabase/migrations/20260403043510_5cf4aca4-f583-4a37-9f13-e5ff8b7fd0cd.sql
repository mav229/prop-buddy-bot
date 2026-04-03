
-- Extension usage analytics
CREATE TABLE public.extension_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  input_length int NOT NULL,
  response_time_ms int,
  tone_selected text,
  success boolean DEFAULT true
);

ALTER TABLE public.extension_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can insert usage logs"
ON public.extension_usage_logs FOR INSERT
TO public WITH CHECK (true);

CREATE POLICY "Admins can view usage logs"
ON public.extension_usage_logs FOR SELECT
TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Custom tone presets
CREATE TABLE public.extension_tone_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  prompt_instructions text NOT NULL,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.extension_tone_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active tone presets"
ON public.extension_tone_presets FOR SELECT
TO public USING (true);

CREATE POLICY "Admins can manage tone presets"
ON public.extension_tone_presets FOR ALL
TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add default tone presets
INSERT INTO public.extension_tone_presets (name, description, prompt_instructions, sort_order) VALUES
('Short', 'Concise, minimal, to-the-point', 'Rewrite concisely — minimal words, direct, professional. Keep it brief.', 0),
('Detailed', 'Expanded, thorough, professional', 'Rewrite with more context and detail — thorough, professional, well-structured.', 1),
('Empathetic', 'Warm, understanding, supportive', 'Rewrite with warmth and empathy — understanding, supportive, human tone.', 2);
