-- Create trigger function to auto-complete setup when wizard is finished
CREATE OR REPLACE FUNCTION public.auto_complete_setup_on_wizard_finish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-set setup_completed when essential profile fields are filled
  -- and setup_step has progressed (indicating user went through wizard)
  IF NEW.setup_completed = false 
     AND NEW.username IS NOT NULL 
     AND NEW.full_name IS NOT NULL 
     AND NEW.full_name <> ''
     AND NEW.setup_step >= 3 THEN
    NEW.setup_completed := true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop the trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_auto_complete_setup_on_wizard_finish ON profiles;

-- Create the trigger (runs BEFORE the KYC trigger so both can work together)
CREATE TRIGGER trigger_auto_complete_setup_on_wizard_finish
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_complete_setup_on_wizard_finish();