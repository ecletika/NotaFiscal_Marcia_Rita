
-- Create invoice_groups table
CREATE TABLE public.invoice_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  total_value NUMERIC NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoice_group_items (linking invoices to groups)
CREATE TABLE public.invoice_group_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.invoice_groups(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, invoice_id)
);

-- Enable RLS
ALTER TABLE public.invoice_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_group_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoice_groups
CREATE POLICY "Users can view their own groups" ON public.invoice_groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own groups" ON public.invoice_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own groups" ON public.invoice_groups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own groups" ON public.invoice_groups FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for invoice_group_items
CREATE POLICY "Users can view their group items" ON public.invoice_group_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.invoice_groups WHERE id = group_id AND user_id = auth.uid())
);
CREATE POLICY "Users can add group items" ON public.invoice_group_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.invoice_groups WHERE id = group_id AND user_id = auth.uid())
);
CREATE POLICY "Users can delete group items" ON public.invoice_group_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.invoice_groups WHERE id = group_id AND user_id = auth.uid())
);

-- Trigger for updated_at
CREATE TRIGGER update_invoice_groups_updated_at
BEFORE UPDATE ON public.invoice_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
