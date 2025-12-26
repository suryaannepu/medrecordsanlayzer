-- Create storage bucket for medical files
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-files', 'medical-files', true);

-- Storage policies for medical files
CREATE POLICY "Users can upload their own medical files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'medical-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own medical files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'medical-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Doctors can view all medical files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'medical-files' AND
  public.has_role(auth.uid(), 'doctor')
);

CREATE POLICY "Users can delete their own medical files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'medical-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);