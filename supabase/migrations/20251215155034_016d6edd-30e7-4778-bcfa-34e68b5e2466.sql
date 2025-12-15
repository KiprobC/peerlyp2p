-- Fix linter WARN: Function Search Path Mutable for normalize_crypto_type_column
CREATE OR REPLACE FUNCTION public.normalize_crypto_type_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.crypto_type IS NOT NULL THEN
    NEW.crypto_type := UPPER(BTRIM(NEW.crypto_type));
  END IF;
  RETURN NEW;
END;
$$;