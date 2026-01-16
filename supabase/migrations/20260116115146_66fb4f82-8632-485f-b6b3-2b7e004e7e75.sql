-- First, update all existing KYC-verified users to have setup_completed = true
UPDATE profiles 
SET setup_completed = true 
WHERE kyc_status = 'verified' AND setup_completed = false;

-- Create a trigger function to auto-set setup_completed when KYC is approved
CREATE OR REPLACE FUNCTION public.auto_complete_setup_on_kyc_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If kyc_status is being changed to 'verified', auto-set setup_completed to true
  IF NEW.kyc_status = 'verified' AND (OLD.kyc_status IS DISTINCT FROM 'verified') THEN
    NEW.setup_completed := true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop the trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_auto_complete_setup_on_kyc_verified ON profiles;

-- Create the trigger
CREATE TRIGGER trigger_auto_complete_setup_on_kyc_verified
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_complete_setup_on_kyc_verified();