-- Phase 7: Bet Insurance + Shame Board

-- Add insured column to bets
ALTER TABLE bets ADD COLUMN insured BOOLEAN NOT NULL DEFAULT false;

-- Extend point_transactions reasons
ALTER TABLE point_transactions DROP CONSTRAINT point_transactions_reason_check;
ALTER TABLE point_transactions ADD CONSTRAINT point_transactions_reason_check
  CHECK (reason IN (
    'initial_grant', 'daily_bonus', 'game_win', 'game_participation',
    'bet_placed', 'bet_won', 'bet_refunded', 'kiss_the_hand',
    'chaos_spent', 'chaos_won', 'chaos_refunded',
    'insurance_bought', 'insurance_payout', 'insurance_refunded',
    'shame_spent'
  ));

-- Replace resolve_bets with insurance support
CREATE OR REPLACE FUNCTION resolve_bets(p_session_id UUID, p_winner_side TEXT) RETURNS VOID AS $$
DECLARE
  total_pool INTEGER; winning_pool INTEGER; losing_pool INTEGER;
  bet_record RECORD; calculated_payout INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_pool
  FROM bets WHERE session_id = p_session_id AND status = 'pending';
  SELECT COALESCE(SUM(amount), 0) INTO winning_pool
  FROM bets WHERE session_id = p_session_id AND status = 'pending' AND side = p_winner_side;
  SELECT COALESCE(SUM(amount), 0) INTO losing_pool
  FROM bets WHERE session_id = p_session_id AND status = 'pending' AND side != p_winner_side;

  IF winning_pool = 0 OR losing_pool = 0 THEN
    FOR bet_record IN SELECT * FROM bets WHERE session_id = p_session_id AND status = 'pending' LOOP
      UPDATE bets SET status = 'refunded', payout = bet_record.amount WHERE id = bet_record.id;
      PERFORM adjust_balance(bet_record.user_id, bet_record.amount, 'bet_refunded', bet_record.id);
      IF bet_record.insured THEN
        PERFORM adjust_balance(bet_record.user_id, 17, 'insurance_refunded', bet_record.id);
      END IF;
    END LOOP;
    RETURN;
  END IF;

  FOR bet_record IN SELECT * FROM bets WHERE session_id = p_session_id AND status = 'pending' AND side = p_winner_side LOOP
    calculated_payout := FLOOR((bet_record.amount::NUMERIC / winning_pool) * total_pool);
    UPDATE bets SET status = 'won', payout = calculated_payout WHERE id = bet_record.id;
    PERFORM adjust_balance(bet_record.user_id, calculated_payout, 'bet_won', bet_record.id);
    IF bet_record.insured THEN
      PERFORM adjust_balance(bet_record.user_id, 17, 'insurance_refunded', bet_record.id);
    END IF;
  END LOOP;

  FOR bet_record IN SELECT * FROM bets WHERE session_id = p_session_id AND status = 'pending' AND side != p_winner_side LOOP
    IF bet_record.insured THEN
      calculated_payout := FLOOR(bet_record.amount::NUMERIC / 2);
      UPDATE bets SET status = 'lost', payout = calculated_payout WHERE id = bet_record.id;
      PERFORM adjust_balance(bet_record.user_id, calculated_payout, 'insurance_payout', bet_record.id);
    ELSE
      UPDATE bets SET status = 'lost', payout = 0 WHERE id = bet_record.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace refund_all_bets with insurance support
CREATE OR REPLACE FUNCTION refund_all_bets(p_session_id UUID) RETURNS VOID AS $$
DECLARE bet_record RECORD;
BEGIN
  FOR bet_record IN SELECT * FROM bets WHERE session_id = p_session_id AND status = 'pending' LOOP
    UPDATE bets SET status = 'refunded', payout = bet_record.amount WHERE id = bet_record.id;
    PERFORM adjust_balance(bet_record.user_id, bet_record.amount, 'bet_refunded', bet_record.id);
    IF bet_record.insured THEN
      PERFORM adjust_balance(bet_record.user_id, 17, 'insurance_refunded', bet_record.id);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Shame Board
CREATE TABLE shame_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shamer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '',
  worst_stat_label TEXT NOT NULL,
  worst_stat_value TEXT NOT NULL,
  recent_losses JSONB NOT NULL DEFAULT '[]',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shame_entries_active ON shame_entries(expires_at DESC);
CREATE INDEX idx_shame_entries_target ON shame_entries(target_player_id);

ALTER TABLE shame_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shame_read" ON shame_entries FOR SELECT USING (true);
CREATE POLICY "shame_insert" ON shame_entries FOR INSERT WITH CHECK (auth.uid() = shamer_user_id);
