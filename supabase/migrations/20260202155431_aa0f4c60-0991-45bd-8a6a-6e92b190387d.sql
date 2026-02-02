-- Add policy for trade participants to view each other's evidence
-- First, let's ensure both buyer and seller can see evidence for their trades

-- Drop existing restrictive policy if it doesn't cover trade counterparties
DROP POLICY IF EXISTS "Users can view their trade evidence" ON storage.objects;

-- Create comprehensive view policy for trade participants
CREATE POLICY "Trade participants can view trade evidence"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'trade-evidence' 
  AND (
    -- User can view their own uploads
    (auth.uid())::text = (storage.foldername(name))[1]
    OR
    -- User can view evidence for trades they're involved in
    EXISTS (
      SELECT 1 FROM public.trades t
      WHERE t.id::text = (storage.foldername(name))[2]
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
    OR
    -- Admins and moderators can view all
    has_role(auth.uid(), 'admin'::app_role)
    OR
    has_role(auth.uid(), 'moderator'::app_role)
  )
);

-- Drop redundant admin/moderator policy since it's now included above
DROP POLICY IF EXISTS "Admins and moderators can view all trade evidence" ON storage.objects;