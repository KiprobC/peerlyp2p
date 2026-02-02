-- Fix: allow chat attachments in trade evidence
-- The app uses evidence_type='chat_attachment' but the table constraint currently rejects it.

DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'trade_evidence'
    AND c.contype = 'c'
    AND c.conname = 'trade_evidence_evidence_type_check';

  IF conname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.trade_evidence DROP CONSTRAINT ' || quote_ident(conname);
  END IF;
END $$;

ALTER TABLE public.trade_evidence
  ADD CONSTRAINT trade_evidence_evidence_type_check
  CHECK (
    evidence_type IN (
      'payment_proof',
      'dispute_evidence',
      'additional_info',
      'chat_attachment'
    )
  );