-- Create table for shared reports
CREATE TABLE public.shared_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  report_type TEXT NOT NULL,
  report_title TEXT NOT NULL,
  report_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '30 days')
);

-- Enable RLS
ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;

-- Users can create their own shared reports
CREATE POLICY "Users can insert their own shared reports"
ON public.shared_reports
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own shared reports
CREATE POLICY "Users can view their own shared reports"
ON public.shared_reports
FOR SELECT
USING (auth.uid() = user_id);

-- Users can delete their own shared reports
CREATE POLICY "Users can delete their own shared reports"
ON public.shared_reports
FOR DELETE
USING (auth.uid() = user_id);

-- Public can view any shared report (for sharing functionality)
CREATE POLICY "Public can view shared reports"
ON public.shared_reports
FOR SELECT
USING (true);