-- Allow admins to view all trade messages for dispute resolution
CREATE POLICY "Admins can view all trade messages"
ON public.trade_messages
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow moderators to view trade messages for their assigned disputes
CREATE POLICY "Moderators can view messages for assigned disputes"
ON public.trade_messages
FOR SELECT
USING (
  has_role(auth.uid(), 'moderator'::app_role) 
  AND EXISTS (
    SELECT 1 FROM dispute_assignments 
    WHERE dispute_assignments.trade_id = trade_messages.trade_id 
    AND dispute_assignments.assigned_to = auth.uid()
  )
);