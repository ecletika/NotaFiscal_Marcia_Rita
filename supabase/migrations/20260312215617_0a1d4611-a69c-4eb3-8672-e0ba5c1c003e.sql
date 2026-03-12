-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Public can view shared reports" ON public.shared_reports;

-- Create a new public SELECT policy that enforces expiry server-side
CREATE POLICY "Public can view active shared reports"
  ON public.shared_reports
  FOR SELECT
  TO public
  USING (
    (expires_at IS NULL OR expires_at > now())
  );