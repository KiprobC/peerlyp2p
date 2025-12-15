-- Add username_changed column to track if username has been edited
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_changed boolean DEFAULT false;

-- Function to generate random username
CREATE OR REPLACE FUNCTION public.generate_random_username()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  adjectives text[] := ARRAY['Swift', 'Crypto', 'Digital', 'Golden', 'Silver', 'Diamond', 'Stellar', 'Quantum', 'Cosmic', 'Thunder', 'Lightning', 'Shadow', 'Frost', 'Fire', 'Storm', 'Eagle', 'Wolf', 'Lion', 'Phoenix', 'Dragon'];
  nouns text[] := ARRAY['Trader', 'Coin', 'Vault', 'Wallet', 'Chain', 'Block', 'Token', 'Ledger', 'Node', 'Miner', 'Holder', 'Keeper', 'Master', 'Pro', 'King', 'Star', 'Hunter', 'Seeker', 'Guard', 'Shield'];
  random_adj text;
  random_noun text;
  random_num int;
  new_username text;
BEGIN
  random_adj := adjectives[1 + floor(random() * array_length(adjectives, 1))::int];
  random_noun := nouns[1 + floor(random() * array_length(nouns, 1))::int];
  random_num := floor(random() * 9000 + 1000)::int;
  new_username := random_adj || random_noun || random_num::text;
  RETURN new_username;
END;
$$;

-- Update handle_new_user to auto-generate username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  generated_username text;
BEGIN
  -- Generate unique username
  generated_username := public.generate_random_username();
  
  -- Ensure uniqueness by appending random chars if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = generated_username) LOOP
    generated_username := public.generate_random_username();
  END LOOP;

  -- Create profile with generated username
  INSERT INTO public.profiles (user_id, email, full_name, username, username_changed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    generated_username,
    false
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

-- Generate usernames for existing users who don't have one
UPDATE public.profiles 
SET username = public.generate_random_username(), username_changed = false 
WHERE username IS NULL OR username = '';

-- Add unique constraint on username
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);