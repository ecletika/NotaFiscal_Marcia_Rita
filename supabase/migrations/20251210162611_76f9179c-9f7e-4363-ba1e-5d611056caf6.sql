-- Create storage bucket for invoices
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Users can upload invoices"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public access to view invoices
CREATE POLICY "Public can view invoices"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoices');

-- Allow users to delete their own invoices
CREATE POLICY "Users can delete own invoices"
ON storage.objects FOR DELETE
USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);