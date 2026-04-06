
INSERT INTO storage.buckets (id, name, public)
VALUES ('cert-templates', 'cert-templates', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read cert-templates" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'cert-templates');

INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-certs', 'generated-certs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read generated-certs" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'generated-certs');

CREATE POLICY "Service role upload generated-certs" ON storage.objects
FOR INSERT TO service_role
WITH CHECK (bucket_id = 'generated-certs');
