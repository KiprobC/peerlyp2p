-- Create countries table with supported currencies and payment methods
CREATE TABLE public.countries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(3) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  currency_code VARCHAR(3) NOT NULL,
  currency_symbol VARCHAR(5) NOT NULL,
  phone_code VARCHAR(10) NOT NULL,
  flag_emoji TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment methods table
CREATE TABLE public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for country-specific payment methods
CREATE TABLE public.country_payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_id UUID NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(country_id, payment_method_id)
);

-- Add country to profiles if not exists (it already exists, so we add kyc_country)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS kyc_country VARCHAR(3),
ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3) DEFAULT 'USD';

-- Enable RLS
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_payment_methods ENABLE ROW LEVEL SECURITY;

-- RLS Policies for countries (publicly readable)
CREATE POLICY "Countries are viewable by everyone"
ON public.countries FOR SELECT
USING (true);

CREATE POLICY "Admins can manage countries"
ON public.countries FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for payment_methods (publicly readable)
CREATE POLICY "Payment methods are viewable by everyone"
ON public.payment_methods FOR SELECT
USING (true);

CREATE POLICY "Admins can manage payment methods"
ON public.payment_methods FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for country_payment_methods (publicly readable)
CREATE POLICY "Country payment methods are viewable by everyone"
ON public.country_payment_methods FOR SELECT
USING (true);

CREATE POLICY "Admins can manage country payment methods"
ON public.country_payment_methods FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Seed initial countries
INSERT INTO public.countries (code, name, currency_code, currency_symbol, phone_code, flag_emoji) VALUES
('KE', 'Kenya', 'KES', 'KSh', '+254', '🇰🇪'),
('NG', 'Nigeria', 'NGN', '₦', '+234', '🇳🇬'),
('US', 'United States', 'USD', '$', '+1', '🇺🇸'),
('GB', 'United Kingdom', 'GBP', '£', '+44', '🇬🇧'),
('GH', 'Ghana', 'GHS', 'GH₵', '+233', '🇬🇭'),
('ZA', 'South Africa', 'ZAR', 'R', '+27', '🇿🇦'),
('TZ', 'Tanzania', 'TZS', 'TSh', '+255', '🇹🇿'),
('UG', 'Uganda', 'UGX', 'USh', '+256', '🇺🇬'),
('RW', 'Rwanda', 'RWF', 'FRw', '+250', '🇷🇼'),
('ET', 'Ethiopia', 'ETB', 'Br', '+251', '🇪🇹'),
('EG', 'Egypt', 'EGP', 'E£', '+20', '🇪🇬'),
('MA', 'Morocco', 'MAD', 'DH', '+212', '🇲🇦'),
('AE', 'UAE', 'AED', 'د.إ', '+971', '🇦🇪'),
('IN', 'India', 'INR', '₹', '+91', '🇮🇳'),
('PH', 'Philippines', 'PHP', '₱', '+63', '🇵🇭'),
('CA', 'Canada', 'CAD', 'C$', '+1', '🇨🇦'),
('AU', 'Australia', 'AUD', 'A$', '+61', '🇦🇺'),
('EU', 'European Union', 'EUR', '€', '+', '🇪🇺')
ON CONFLICT (code) DO NOTHING;

-- Seed payment methods
INSERT INTO public.payment_methods (name, display_name, icon, description) VALUES
('MPESA', 'M-Pesa', 'smartphone', 'Mobile money transfer via Safaricom M-Pesa'),
('BANK_TRANSFER', 'Bank Transfer', 'building', 'Direct bank to bank transfer'),
('AIRTEL_MONEY', 'Airtel Money', 'smartphone', 'Mobile money via Airtel'),
('MTN_MOMO', 'MTN Mobile Money', 'smartphone', 'Mobile money via MTN'),
('OPAY', 'OPay', 'wallet', 'OPay mobile wallet'),
('PAYSTACK', 'Paystack', 'credit-card', 'Paystack payment gateway'),
('FLUTTERWAVE', 'Flutterwave', 'credit-card', 'Flutterwave payment gateway'),
('ZELLE', 'Zelle', 'send', 'Zelle instant bank transfer'),
('CASH_APP', 'Cash App', 'smartphone', 'Square Cash App'),
('VENMO', 'Venmo', 'smartphone', 'Venmo mobile payments'),
('PAYPAL', 'PayPal', 'credit-card', 'PayPal payments'),
('WISE', 'Wise', 'globe', 'Wise (TransferWise) international transfer'),
('REVOLUT', 'Revolut', 'credit-card', 'Revolut digital banking'),
('ECOCASH', 'EcoCash', 'smartphone', 'Zimbabwe EcoCash mobile money'),
('CHIPPER', 'Chipper Cash', 'smartphone', 'Chipper Cash cross-border payments'),
('UPI', 'UPI', 'smartphone', 'Unified Payments Interface (India)'),
('GCASH', 'GCash', 'smartphone', 'GCash mobile wallet (Philippines)'),
('PAYMAYA', 'PayMaya', 'smartphone', 'PayMaya digital wallet (Philippines)')
ON CONFLICT (name) DO NOTHING;

-- Link payment methods to countries
INSERT INTO public.country_payment_methods (country_id, payment_method_id, priority)
SELECT c.id, p.id, 
  CASE 
    WHEN p.name = 'MPESA' THEN 1
    WHEN p.name = 'BANK_TRANSFER' THEN 2
    WHEN p.name = 'AIRTEL_MONEY' THEN 3
    ELSE 10
  END
FROM public.countries c, public.payment_methods p
WHERE c.code = 'KE' AND p.name IN ('MPESA', 'BANK_TRANSFER', 'AIRTEL_MONEY')
ON CONFLICT DO NOTHING;

INSERT INTO public.country_payment_methods (country_id, payment_method_id, priority)
SELECT c.id, p.id, 
  CASE 
    WHEN p.name = 'BANK_TRANSFER' THEN 1
    WHEN p.name = 'OPAY' THEN 2
    WHEN p.name = 'PAYSTACK' THEN 3
    WHEN p.name = 'FLUTTERWAVE' THEN 4
    WHEN p.name = 'CHIPPER' THEN 5
    ELSE 10
  END
FROM public.countries c, public.payment_methods p
WHERE c.code = 'NG' AND p.name IN ('BANK_TRANSFER', 'OPAY', 'PAYSTACK', 'FLUTTERWAVE', 'CHIPPER')
ON CONFLICT DO NOTHING;

INSERT INTO public.country_payment_methods (country_id, payment_method_id, priority)
SELECT c.id, p.id, 
  CASE 
    WHEN p.name = 'ZELLE' THEN 1
    WHEN p.name = 'CASH_APP' THEN 2
    WHEN p.name = 'VENMO' THEN 3
    WHEN p.name = 'BANK_TRANSFER' THEN 4
    WHEN p.name = 'PAYPAL' THEN 5
    ELSE 10
  END
FROM public.countries c, public.payment_methods p
WHERE c.code = 'US' AND p.name IN ('ZELLE', 'CASH_APP', 'VENMO', 'BANK_TRANSFER', 'PAYPAL')
ON CONFLICT DO NOTHING;

INSERT INTO public.country_payment_methods (country_id, payment_method_id, priority)
SELECT c.id, p.id, 
  CASE 
    WHEN p.name = 'BANK_TRANSFER' THEN 1
    WHEN p.name = 'REVOLUT' THEN 2
    WHEN p.name = 'WISE' THEN 3
    WHEN p.name = 'PAYPAL' THEN 4
    ELSE 10
  END
FROM public.countries c, public.payment_methods p
WHERE c.code = 'GB' AND p.name IN ('BANK_TRANSFER', 'REVOLUT', 'WISE', 'PAYPAL')
ON CONFLICT DO NOTHING;

INSERT INTO public.country_payment_methods (country_id, payment_method_id, priority)
SELECT c.id, p.id, 
  CASE 
    WHEN p.name = 'MTN_MOMO' THEN 1
    WHEN p.name = 'BANK_TRANSFER' THEN 2
    WHEN p.name = 'CHIPPER' THEN 3
    ELSE 10
  END
FROM public.countries c, public.payment_methods p
WHERE c.code = 'GH' AND p.name IN ('MTN_MOMO', 'BANK_TRANSFER', 'CHIPPER')
ON CONFLICT DO NOTHING;

INSERT INTO public.country_payment_methods (country_id, payment_method_id, priority)
SELECT c.id, p.id, priority
FROM public.countries c, public.payment_methods p, (VALUES 
  ('UG', 'MTN_MOMO', 1), ('UG', 'AIRTEL_MONEY', 2), ('UG', 'BANK_TRANSFER', 3),
  ('TZ', 'MPESA', 1), ('TZ', 'AIRTEL_MONEY', 2), ('TZ', 'BANK_TRANSFER', 3),
  ('RW', 'MTN_MOMO', 1), ('RW', 'BANK_TRANSFER', 2),
  ('ZA', 'BANK_TRANSFER', 1), ('ZA', 'PAYPAL', 2),
  ('IN', 'UPI', 1), ('IN', 'BANK_TRANSFER', 2), ('IN', 'PAYPAL', 3),
  ('PH', 'GCASH', 1), ('PH', 'PAYMAYA', 2), ('PH', 'BANK_TRANSFER', 3)
) AS v(country_code, method_name, priority)
WHERE c.code = v.country_code AND p.name = v.method_name
ON CONFLICT DO NOTHING;

-- Update trigger for countries
CREATE TRIGGER update_countries_updated_at
BEFORE UPDATE ON public.countries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_country_payment_methods_country ON public.country_payment_methods(country_id);
CREATE INDEX idx_profiles_kyc_country ON public.profiles(kyc_country);