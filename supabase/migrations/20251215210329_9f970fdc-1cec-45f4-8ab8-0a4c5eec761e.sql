-- Fix search_path for generate_random_username function
CREATE OR REPLACE FUNCTION public.generate_random_username()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
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