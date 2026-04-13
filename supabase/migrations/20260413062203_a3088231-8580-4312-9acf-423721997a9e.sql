
CREATE TABLE public.mongo_mirror (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection text NOT NULL,
  mongo_id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(collection, mongo_id)
);

CREATE INDEX idx_mongo_mirror_collection ON public.mongo_mirror(collection);
CREATE INDEX idx_mongo_mirror_mongo_id ON public.mongo_mirror(mongo_id);
CREATE INDEX idx_mongo_mirror_data ON public.mongo_mirror USING GIN(data);

ALTER TABLE public.mongo_mirror ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view mongo mirror"
  ON public.mongo_mirror FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert mongo mirror"
  ON public.mongo_mirror FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Service can update mongo mirror"
  ON public.mongo_mirror FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Service can delete mongo mirror"
  ON public.mongo_mirror FOR DELETE
  TO public
  USING (true);
