CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  winner_side TEXT NOT NULL CHECK (winner_side IN ('blue', 'red'))
);

CREATE TABLE game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('blue', 'red')),
  lane TEXT NOT NULL CHECK (lane IN ('top', 'jungle', 'mid', 'adc', 'support')),
  champion TEXT NOT NULL
);

CREATE TABLE daily_fearless (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  champion_name TEXT NOT NULL,
  UNIQUE (date, champion_name)
);

CREATE INDEX idx_game_players_game_id ON game_players(game_id);
CREATE INDEX idx_game_players_player_id ON game_players(player_id);
CREATE INDEX idx_daily_fearless_date ON daily_fearless(date);

-- Phase 1: Active Game Sessions
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'betting', 'in_game', 'blue_win', 'red_win', 'canceled', 'expired')),
  created_by UUID,
  resolved_by UUID,
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  betting_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE session_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('blue', 'red')),
  lane TEXT NOT NULL CHECK (lane IN ('top', 'jungle', 'mid', 'adc', 'support')),
  champion TEXT NOT NULL,
  champion_internal TEXT NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT false,
  fearless_override BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_session_assignments_session ON session_assignments(session_id);
CREATE INDEX idx_game_sessions_status ON game_sessions(status)
  WHERE status IN ('draft', 'betting', 'in_game');

CREATE UNIQUE INDEX idx_one_active_session
  ON game_sessions ((true))
  WHERE status IN ('draft', 'betting', 'in_game');

-- Phase 2: Auth
ALTER TABLE players ADD COLUMN auth_user_id UUID UNIQUE;
ALTER TABLE players ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_username TEXT NOT NULL,
  discord_avatar_url TEXT,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_profiles_player ON user_profiles(player_id);

ALTER TABLE game_sessions
  ADD CONSTRAINT fk_session_creator
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE game_sessions
  ADD CONSTRAINT fk_session_resolver
  FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Phase 3: Points
CREATE TABLE point_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 50,
  last_daily_claim DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT positive_balance CHECK (balance >= 0)
);

CREATE TABLE point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'initial_grant', 'daily_bonus', 'game_win', 'game_participation',
    'bet_placed', 'bet_won', 'bet_refunded'
  )),
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_point_transactions_user ON point_transactions(user_id);
CREATE INDEX idx_point_balances_balance ON point_balances(balance DESC);

CREATE OR REPLACE FUNCTION adjust_balance(
  p_user_id UUID, p_amount INTEGER, p_reason TEXT, p_reference_id UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE new_balance INTEGER;
BEGIN
  UPDATE point_balances SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = p_user_id RETURNING balance INTO new_balance;
  IF NOT FOUND THEN RAISE EXCEPTION 'User balance not found'; END IF;
  IF new_balance < 0 THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  INSERT INTO point_transactions (user_id, amount, reason, reference_id)
  VALUES (p_user_id, p_amount, p_reason, p_reference_id);
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE point_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "balances_read" ON point_balances FOR SELECT USING (true);
CREATE POLICY "balances_insert" ON point_balances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "balances_update" ON point_balances FOR UPDATE USING (false);

ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_read" ON point_transactions FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION claim_daily_bonus(p_user_id UUID) RETURNS INTEGER AS $$
DECLARE new_balance INTEGER; last_claim DATE;
BEGIN
  SELECT last_daily_claim INTO last_claim FROM point_balances WHERE user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User balance not found'; END IF;
  IF last_claim = CURRENT_DATE THEN RETURN -1; END IF;
  UPDATE point_balances SET balance = balance + 5, last_daily_claim = CURRENT_DATE, updated_at = now()
  WHERE user_id = p_user_id RETURNING balance INTO new_balance;
  INSERT INTO point_transactions (user_id, amount, reason)
  VALUES (p_user_id, 5, 'daily_bonus');
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Phase 4: Betting
CREATE TABLE bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('blue', 'red')),
  amount INTEGER NOT NULL CHECK (amount >= 1),
  payout INTEGER,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'won', 'lost', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

CREATE INDEX idx_bets_session ON bets(session_id);
CREATE INDEX idx_bets_user ON bets(user_id);

ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bets_read" ON bets FOR SELECT USING (true);
CREATE POLICY "bets_insert" ON bets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bets_update" ON bets FOR UPDATE USING (false);

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
    END LOOP;
    RETURN;
  END IF;

  FOR bet_record IN SELECT * FROM bets WHERE session_id = p_session_id AND status = 'pending' AND side = p_winner_side LOOP
    calculated_payout := FLOOR((bet_record.amount::NUMERIC / winning_pool) * total_pool);
    UPDATE bets SET status = 'won', payout = calculated_payout WHERE id = bet_record.id;
    PERFORM adjust_balance(bet_record.user_id, calculated_payout, 'bet_won', bet_record.id);
  END LOOP;

  UPDATE bets SET status = 'lost', payout = 0
  WHERE session_id = p_session_id AND status = 'pending' AND side != p_winner_side;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION refund_all_bets(p_session_id UUID) RETURNS VOID AS $$
DECLARE bet_record RECORD;
BEGIN
  FOR bet_record IN SELECT * FROM bets WHERE session_id = p_session_id AND status = 'pending' LOOP
    UPDATE bets SET status = 'refunded', payout = bet_record.amount WHERE id = bet_record.id;
    PERFORM adjust_balance(bet_record.user_id, bet_record.amount, 'bet_refunded', bet_record.id);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
