-- Create trade_evidence table for storing payment proofs and dispute evidence
CREATE TABLE public.trade_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL,
  uploader_role TEXT NOT NULL CHECK (uploader_role IN ('buyer', 'seller', 'moderator')),
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('payment_proof', 'dispute_evidence', 'additional_info')),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  description TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trade_evidence ENABLE ROW LEVEL SECURITY;

-- Allow trade participants to view evidence
CREATE POLICY "Trade participants can view evidence"
ON public.trade_evidence
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM trades t 
    WHERE t.id = trade_evidence.trade_id 
    AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
);

-- Allow trade participants to insert evidence
CREATE POLICY "Trade participants can upload evidence"
ON public.trade_evidence
FOR INSERT
WITH CHECK (
  auth.uid() = uploader_id AND
  EXISTS (
    SELECT 1 FROM trades t 
    WHERE t.id = trade_evidence.trade_id 
    AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
);

-- Admins and moderators can view all evidence for assigned disputes
CREATE POLICY "Moderators can view dispute evidence"
ON public.trade_evidence
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  (has_role(auth.uid(), 'moderator'::app_role) AND EXISTS (
    SELECT 1 FROM dispute_assignments da
    WHERE da.trade_id = trade_evidence.trade_id
    AND da.assigned_to = auth.uid()
  ))
);

-- Moderators can insert evidence (for info requests)
CREATE POLICY "Moderators can add evidence"
ON public.trade_evidence
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'moderator'::app_role)
);

-- Add moderator assignment columns to trades
ALTER TABLE public.trades 
ADD COLUMN IF NOT EXISTS assigned_moderator_id UUID,
ADD COLUMN IF NOT EXISTS dispute_resolution_summary TEXT,
ADD COLUMN IF NOT EXISTS resolution_type TEXT CHECK (resolution_type IN ('buyer_wins', 'seller_wins', 'split', 'cancelled'));

-- Create storage bucket for trade evidence
INSERT INTO storage.buckets (id, name, public)
VALUES ('trade-evidence', 'trade-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for trade evidence bucket
CREATE POLICY "Users can upload trade evidence"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'trade-evidence' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their trade evidence"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'trade-evidence' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins and moderators can view all trade evidence"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'trade-evidence' AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
);

-- Function to auto-assign moderator when dispute is opened
CREATE OR REPLACE FUNCTION public.auto_assign_dispute_moderator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_moderator_id UUID;
  v_admin_id UUID;
BEGIN
  -- Only run when status changes to disputed
  IF NEW.status = 'disputed' AND (OLD.status IS NULL OR OLD.status != 'disputed') THEN
    -- Find an available moderator (least assigned open disputes)
    SELECT ur.user_id INTO v_moderator_id
    FROM user_roles ur
    LEFT JOIN (
      SELECT assigned_to, COUNT(*) as dispute_count
      FROM dispute_assignments
      WHERE status NOT IN ('resolved', 'closed')
      GROUP BY assigned_to
    ) da ON da.assigned_to = ur.user_id
    WHERE ur.role = 'moderator'
    ORDER BY COALESCE(da.dispute_count, 0) ASC, RANDOM()
    LIMIT 1;
    
    -- If no moderator found, assign to an admin
    IF v_moderator_id IS NULL THEN
      SELECT user_id INTO v_admin_id
      FROM user_roles
      WHERE role = 'admin'
      ORDER BY RANDOM()
      LIMIT 1;
      v_moderator_id := v_admin_id;
    END IF;
    
    -- Create dispute assignment if moderator found
    IF v_moderator_id IS NOT NULL THEN
      INSERT INTO dispute_assignments (trade_id, assigned_to, assigned_by, priority)
      VALUES (NEW.id, v_moderator_id, COALESCE(NEW.disputed_by, auth.uid()), 
              CASE WHEN NEW.crypto_amount > 0.1 THEN 'high' ELSE 'normal' END)
      ON CONFLICT DO NOTHING;
      
      -- Update trade with assigned moderator
      NEW.assigned_moderator_id := v_moderator_id;
      
      -- Insert system message about moderator assignment
      INSERT INTO trade_messages (trade_id, sender_id, message, is_system)
      VALUES (NEW.id, v_moderator_id, 
              '🔰 A moderator has been assigned to review this dispute. Please provide any evidence to support your case.',
              true);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-assigning moderators
DROP TRIGGER IF EXISTS auto_assign_dispute_moderator_trigger ON trades;
CREATE TRIGGER auto_assign_dispute_moderator_trigger
BEFORE UPDATE ON trades
FOR EACH ROW
EXECUTE FUNCTION auto_assign_dispute_moderator();

-- Function for moderators to post system messages
CREATE OR REPLACE FUNCTION public.moderator_post_message(
  p_trade_id UUID,
  p_message TEXT,
  p_is_system BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id UUID;
BEGIN
  -- Check if user is admin or assigned moderator
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM dispute_assignments 
      WHERE trade_id = p_trade_id AND assigned_to = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to post to this trade';
  END IF;

  INSERT INTO trade_messages (trade_id, sender_id, message, is_system)
  VALUES (p_trade_id, auth.uid(), p_message, p_is_system)
  RETURNING id INTO v_message_id;
  
  RETURN v_message_id;
END;
$$;

-- Function to lock evidence (prevent further edits after submission)
CREATE OR REPLACE FUNCTION public.lock_trade_evidence(p_trade_id UUID, p_uploader_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE trade_evidence
  SET is_locked = true, locked_at = now()
  WHERE trade_id = p_trade_id 
    AND uploader_role = p_uploader_role
    AND is_locked = false;
  
  RETURN true;
END;
$$;

-- Enable realtime for trade_evidence
ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_evidence;