
-- Table 1: trader_behavior_metrics
CREATE TABLE public.trader_behavior_metrics (
  user_id UUID NOT NULL PRIMARY KEY,
  total_trades INTEGER NOT NULL DEFAULT 0,
  completed_trades INTEGER NOT NULL DEFAULT 0,
  cancelled_trades INTEGER NOT NULL DEFAULT 0,
  disputes_raised_against INTEGER NOT NULL DEFAULT 0,
  disputes_started_by INTEGER NOT NULL DEFAULT 0,
  failed_payment_reports INTEGER NOT NULL DEFAULT 0,
  average_release_time_minutes NUMERIC,
  risk_score NUMERIC NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'normal',
  last_trade_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trader_behavior_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own metrics" ON public.trader_behavior_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all metrics" ON public.trader_behavior_metrics FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators can read all metrics" ON public.trader_behavior_metrics FOR SELECT USING (has_role(auth.uid(), 'moderator'::app_role));

-- Table 2: user_risk_alerts
CREATE TABLE public.user_risk_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  risk_type TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID,
  resolution TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_risk_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage risk alerts" ON public.user_risk_alerts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators can view risk alerts" ON public.user_risk_alerts FOR SELECT USING (has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Moderators can update risk alerts" ON public.user_risk_alerts FOR UPDATE USING (has_role(auth.uid(), 'moderator'::app_role));

-- Table 3: user_fingerprints
CREATE TABLE public.user_fingerprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ip_address TEXT,
  device_type TEXT,
  browser TEXT,
  operating_system TEXT,
  screen_resolution TEXT,
  timezone TEXT,
  device_hash TEXT,
  action_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read fingerprints" ON public.user_fingerprints FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Function: recalculate_trader_risk
CREATE OR REPLACE FUNCTION public.recalculate_trader_risk(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_completed INTEGER;
  v_cancelled INTEGER;
  v_disputes_against INTEGER;
  v_disputes_by INTEGER;
  v_avg_release NUMERIC;
  v_dispute_rate NUMERIC;
  v_cancel_rate NUMERIC;
  v_slow_release_score NUMERIC;
  v_report_score NUMERIC;
  v_risk_score NUMERIC;
  v_risk_level TEXT;
  v_last_trade TIMESTAMP WITH TIME ZONE;
  v_cancels_24h INTEGER;
  v_disputes_today INTEGER;
BEGIN
  -- Aggregate from trades
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    COUNT(*) FILTER (WHERE status = 'disputed' AND disputed_by != p_user_id),
    COUNT(*) FILTER (WHERE status = 'disputed' AND disputed_by = p_user_id),
    MAX(GREATEST(completed_at, cancelled_at, disputed_at, created_at))
  INTO v_total, v_completed, v_cancelled, v_disputes_against, v_disputes_by, v_last_trade
  FROM trades
  WHERE buyer_id = p_user_id OR seller_id = p_user_id;

  -- Average release time (payment_confirmed_at to completed_at)
  SELECT AVG(EXTRACT(EPOCH FROM (completed_at - payment_confirmed_at)) / 60.0)
  INTO v_avg_release
  FROM trades
  WHERE (buyer_id = p_user_id OR seller_id = p_user_id)
    AND status = 'completed'
    AND payment_confirmed_at IS NOT NULL
    AND completed_at IS NOT NULL
    AND completed_at > payment_confirmed_at;

  -- Calculate rates
  IF v_total > 0 THEN
    v_dispute_rate := (v_disputes_against::NUMERIC / v_total) * 100;
    v_cancel_rate := (v_cancelled::NUMERIC / v_total) * 100;
  ELSE
    v_dispute_rate := 0;
    v_cancel_rate := 0;
  END IF;

  -- Slow release score (0-100 based on avg release time, 90min = 100)
  IF v_avg_release IS NOT NULL AND v_avg_release > 0 THEN
    v_slow_release_score := LEAST((v_avg_release / 90.0) * 100, 100);
  ELSE
    v_slow_release_score := 0;
  END IF;

  -- Report score based on disputes_against ratio
  v_report_score := LEAST(v_disputes_against * 10, 100);

  -- Final risk score
  v_risk_score := (v_dispute_rate * 0.4) + (v_cancel_rate * 0.2) + (v_slow_release_score * 0.2) + (v_report_score * 0.2);

  -- Map to risk level
  IF v_risk_score <= 20 THEN
    v_risk_level := 'trusted';
  ELSIF v_risk_score <= 40 THEN
    v_risk_level := 'normal';
  ELSIF v_risk_score <= 60 THEN
    v_risk_level := 'watchlist';
  ELSE
    v_risk_level := 'high_risk';
  END IF;

  -- Upsert metrics
  INSERT INTO trader_behavior_metrics (user_id, total_trades, completed_trades, cancelled_trades, disputes_raised_against, disputes_started_by, average_release_time_minutes, risk_score, risk_level, last_trade_at, updated_at)
  VALUES (p_user_id, v_total, v_completed, v_cancelled, v_disputes_against, v_disputes_by, v_avg_release, v_risk_score, v_risk_level, v_last_trade, now())
  ON CONFLICT (user_id) DO UPDATE SET
    total_trades = EXCLUDED.total_trades,
    completed_trades = EXCLUDED.completed_trades,
    cancelled_trades = EXCLUDED.cancelled_trades,
    disputes_raised_against = EXCLUDED.disputes_raised_against,
    disputes_started_by = EXCLUDED.disputes_started_by,
    average_release_time_minutes = EXCLUDED.average_release_time_minutes,
    risk_score = EXCLUDED.risk_score,
    risk_level = EXCLUDED.risk_level,
    last_trade_at = EXCLUDED.last_trade_at,
    updated_at = now();

  -- Check rule triggers and create alerts (only if enough trades for meaningful data)
  IF v_total >= 3 THEN
    -- High dispute rate (>25%)
    IF v_dispute_rate > 25 THEN
      INSERT INTO user_risk_alerts (user_id, risk_type, description, severity)
      SELECT p_user_id, 'high_dispute_rate', 'Dispute rate exceeds 25% (' || ROUND(v_dispute_rate, 1) || '%)', 'high'
      WHERE NOT EXISTS (SELECT 1 FROM user_risk_alerts WHERE user_id = p_user_id AND risk_type = 'high_dispute_rate' AND is_resolved = false);
    END IF;
  END IF;

  -- Mass cancellations (>5 in 24h)
  SELECT COUNT(*) INTO v_cancels_24h
  FROM trades
  WHERE (buyer_id = p_user_id OR seller_id = p_user_id)
    AND status = 'cancelled'
    AND cancelled_by = p_user_id
    AND cancelled_at > now() - INTERVAL '24 hours';

  IF v_cancels_24h > 5 THEN
    INSERT INTO user_risk_alerts (user_id, risk_type, description, severity)
    SELECT p_user_id, 'mass_cancellation', v_cancels_24h || ' cancellations in 24 hours', 'high'
    WHERE NOT EXISTS (SELECT 1 FROM user_risk_alerts WHERE user_id = p_user_id AND risk_type = 'mass_cancellation' AND is_resolved = false);
  END IF;

  -- Slow release (>90min avg)
  IF v_avg_release IS NOT NULL AND v_avg_release > 90 THEN
    INSERT INTO user_risk_alerts (user_id, risk_type, description, severity)
    SELECT p_user_id, 'slow_release', 'Average release time: ' || ROUND(v_avg_release, 0) || ' minutes', 'medium'
    WHERE NOT EXISTS (SELECT 1 FROM user_risk_alerts WHERE user_id = p_user_id AND risk_type = 'slow_release' AND is_resolved = false);
  END IF;

  -- Multiple disputes same day
  SELECT COUNT(*) INTO v_disputes_today
  FROM trades
  WHERE (buyer_id = p_user_id OR seller_id = p_user_id)
    AND status = 'disputed'
    AND disputed_at::date = CURRENT_DATE;

  IF v_disputes_today >= 3 THEN
    INSERT INTO user_risk_alerts (user_id, risk_type, description, severity)
    SELECT p_user_id, 'multiple_disputes_daily', v_disputes_today || ' disputes today', 'critical'
    WHERE NOT EXISTS (SELECT 1 FROM user_risk_alerts WHERE user_id = p_user_id AND risk_type = 'multiple_disputes_daily' AND is_resolved = false AND created_at::date = CURRENT_DATE);
  END IF;
END;
$$;

-- Trigger on trade status change
CREATE OR REPLACE FUNCTION public.on_trade_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('completed', 'cancelled', 'disputed') THEN
    PERFORM recalculate_trader_risk(NEW.buyer_id);
    PERFORM recalculate_trader_risk(NEW.seller_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_trade_status_change
AFTER UPDATE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.on_trade_status_change();
