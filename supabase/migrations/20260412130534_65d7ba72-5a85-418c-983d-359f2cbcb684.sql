-- Performance indexes for admin panel queries
CREATE INDEX IF NOT EXISTS idx_trades_status ON public.trades (status);
CREATE INDEX IF NOT EXISTS idx_trades_buyer_id ON public.trades (buyer_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller_id ON public.trades (seller_id);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON public.trades (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON public.wallet_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON public.wallet_transactions (status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_tx_hash ON public.wallet_transactions (tx_hash);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON public.wallet_transactions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON public.admin_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_action_type ON public.admin_actions (action_type);
CREATE INDEX IF NOT EXISTS idx_admin_actions_actor_id ON public.admin_actions (actor_id);

CREATE INDEX IF NOT EXISTS idx_treasury_ledger_ledger_type ON public.treasury_ledger (ledger_type);
CREATE INDEX IF NOT EXISTS idx_treasury_ledger_created_at ON public.treasury_ledger (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_kyc_status ON public.profiles (kyc_status);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);