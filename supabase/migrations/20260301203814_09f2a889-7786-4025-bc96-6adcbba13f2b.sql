
CREATE POLICY "Users can upload group images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoices'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'groups'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can delete group images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'invoices'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'groups'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
