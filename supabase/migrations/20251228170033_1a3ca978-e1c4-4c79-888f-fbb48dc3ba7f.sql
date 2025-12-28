-- Create training_feedback table to store bot training data
CREATE TABLE public.training_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  bot_answer TEXT NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 0.85,
  is_correct BOOLEAN DEFAULT NULL,
  corrected_answer TEXT DEFAULT NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  reviewed_by UUID REFERENCES auth.users(id),
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_feedback ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage training feedback"
ON public.training_feedback
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can insert (for logging from chat)
CREATE POLICY "Anyone can insert training feedback"
ON public.training_feedback
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_training_feedback_reviewed ON public.training_feedback(is_correct, created_at DESC);