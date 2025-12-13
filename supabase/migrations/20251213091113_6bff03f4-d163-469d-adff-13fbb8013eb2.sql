-- Create platform_fees table for managing fees
CREATE TABLE public.platform_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fee_type TEXT NOT NULL UNIQUE,
  percentage NUMERIC NOT NULL DEFAULT 0,
  min_amount NUMERIC DEFAULT 0,
  max_amount NUMERIC DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;

-- Everyone can read fees (needed for calculating fees in trades)
CREATE POLICY "Anyone can view active fees"
ON public.platform_fees
FOR SELECT
USING (is_active = true);

-- Only admins can manage fees
CREATE POLICY "Admins can manage fees"
ON public.platform_fees
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_platform_fees_updated_at
BEFORE UPDATE ON public.platform_fees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default fee configurations
INSERT INTO public.platform_fees (fee_type, percentage, min_amount, description) VALUES
('trade', 1.0, 0, 'Fee charged on each completed trade'),
('deposit', 0, 0, 'Fee charged on crypto deposits'),
('withdrawal', 0.5, 0, 'Fee charged on crypto withdrawals'),
('escrow', 0, 0, 'Fee for escrow service');