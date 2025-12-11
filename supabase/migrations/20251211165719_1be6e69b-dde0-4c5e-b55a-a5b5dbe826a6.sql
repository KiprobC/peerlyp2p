-- Create user_settings table for preferences
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  push_notifications BOOLEAN DEFAULT true,
  transaction_alerts BOOLEAN DEFAULT true,
  two_factor_enabled BOOLEAN DEFAULT false,
  preferred_currency TEXT DEFAULT 'KES',
  theme TEXT DEFAULT 'dark',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update handle_new_user function to also create settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  
  -- Create default wallets
  INSERT INTO public.wallets (user_id, crypto_type) VALUES
    (NEW.id, 'BTC'),
    (NEW.id, 'USDT'),
    (NEW.id, 'ETH');
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  
  -- Create default settings
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Add username column to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;