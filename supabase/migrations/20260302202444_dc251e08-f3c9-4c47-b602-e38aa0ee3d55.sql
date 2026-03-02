-- Fix RLS: Allow ALL moderators to see ALL dispute assignments (not just their own)
DROP POLICY IF EXISTS "Moderators can view assigned disputes" ON public.dispute_assignments;

CREATE POLICY "Moderators can view all disputes"
ON public.dispute_assignments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'moderator'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR assigned_to = auth.uid()
);

-- Allow moderators to update disputes they pick (self-assign)
DROP POLICY IF EXISTS "Moderators can update assigned disputes" ON public.dispute_assignments;

CREATE POLICY "Moderators can update disputes"
ON public.dispute_assignments
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'moderator'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Also allow moderators to view trades that are disputed (for the shared queue)
CREATE POLICY "Moderators can view disputed trades"
ON public.trades
FOR SELECT
TO authenticated
USING (
  (status = 'disputed' AND (
    has_role(auth.uid(), 'moderator'::app_role) 
    OR has_role(auth.uid(), 'admin'::app_role)
  ))
);

-- Allow moderators to view messages for any disputed trade
DROP POLICY IF EXISTS "Moderators can view messages for assigned disputes" ON public.trade_messages;

CREATE POLICY "Moderators can view messages for disputed trades"
ON public.trade_messages
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'moderator'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND EXISTS (
    SELECT 1 FROM trades t 
    WHERE t.id = trade_messages.trade_id 
    AND t.status = 'disputed'
  )
);

-- Allow moderators to send messages in disputed trades
CREATE POLICY "Moderators can send messages in disputed trades"
ON public.trade_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND (has_role(auth.uid(), 'moderator'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND EXISTS (
    SELECT 1 FROM trades t 
    WHERE t.id = trade_messages.trade_id 
    AND t.status = 'disputed'
  )
);