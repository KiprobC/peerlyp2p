CREATE POLICY "Admins can view all KYC documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can view all KYC documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-documents' AND has_role(auth.uid(), 'moderator'::app_role));