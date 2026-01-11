-- Add admin SELECT policies for wallets and transactions
CREATE POLICY "Admins can view all wallets" 
ON public.wallets 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all transactions" 
ON public.wallet_transactions 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Add admin SELECT policy for trades
CREATE POLICY "Admins can view all trades" 
ON public.trades 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Add admin UPDATE policy for trades (for dispute resolution)
CREATE POLICY "Admins can update all trades" 
ON public.trades 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'));

-- Add admin SELECT policy for offers
CREATE POLICY "Admins can view all offers" 
ON public.offers 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Add admin UPDATE and DELETE policies for offers
CREATE POLICY "Admins can update all offers" 
ON public.offers 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete all offers" 
ON public.offers 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- Add admin policy for inserting to admin_actions
CREATE POLICY "Admins and moderators can insert actions" 
ON public.admin_actions 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator')
);

-- Create a function to log admin actions on KYC changes
CREATE OR REPLACE FUNCTION public.log_kyc_action()
RETURNS TRIGGER AS $$
DECLARE
  v_action_type TEXT;
  v_actor_role app_role;
BEGIN
  -- Only log on status change from submitted
  IF OLD.kyc_status = 'submitted' AND NEW.kyc_status IN ('verified', 'rejected') THEN
    v_action_type := CASE NEW.kyc_status
      WHEN 'verified' THEN 'kyc_approved'
      WHEN 'rejected' THEN 'kyc_rejected'
    END;
    
    -- Get actor role
    SELECT role INTO v_actor_role 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    LIMIT 1;
    
    IF v_actor_role IS NOT NULL THEN
      INSERT INTO public.admin_actions (
        actor_id, 
        actor_role, 
        action_type, 
        target_type, 
        target_id, 
        details
      ) VALUES (
        auth.uid(),
        v_actor_role,
        v_action_type,
        'user',
        NEW.user_id,
        jsonb_build_object(
          'user_email', NEW.email,
          'user_name', NEW.full_name
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for KYC action logging
DROP TRIGGER IF EXISTS log_kyc_action_trigger ON public.profiles;
CREATE TRIGGER log_kyc_action_trigger
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.log_kyc_action();

-- Create function to log escrow actions
CREATE OR REPLACE FUNCTION public.log_escrow_action()
RETURNS TRIGGER AS $$
DECLARE
  v_action_type TEXT;
  v_actor_role app_role;
BEGIN
  -- Log escrow release by admin
  IF OLD.escrow_released IS DISTINCT FROM NEW.escrow_released AND NEW.escrow_released = true THEN
    v_action_type := 'escrow_released';
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' AND OLD.status = 'disputed' THEN
    v_action_type := 'trade_cancelled';
  ELSE
    RETURN NEW;
  END IF;
  
  -- Get actor role (only log if actor is admin/moderator)
  SELECT role INTO v_actor_role 
  FROM public.user_roles 
  WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  LIMIT 1;
  
  IF v_actor_role IS NOT NULL THEN
    INSERT INTO public.admin_actions (
      actor_id, 
      actor_role, 
      action_type, 
      target_type, 
      target_id, 
      details
    ) VALUES (
      auth.uid(),
      v_actor_role,
      v_action_type,
      'trade',
      NEW.id,
      jsonb_build_object(
        'crypto_amount', NEW.crypto_amount,
        'crypto_type', NEW.crypto_type,
        'fiat_amount', NEW.fiat_amount
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for escrow action logging
DROP TRIGGER IF EXISTS log_escrow_action_trigger ON public.trades;
CREATE TRIGGER log_escrow_action_trigger
AFTER UPDATE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.log_escrow_action();