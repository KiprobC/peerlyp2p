-- Enable realtime for wallets table
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;

-- Enable realtime for offers table  
ALTER PUBLICATION supabase_realtime ADD TABLE public.offers;