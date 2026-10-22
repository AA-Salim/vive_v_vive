-- Phase 10: Duels ("Trials by Combat"): 1v1 wagers between users on the result of the current game.
-- Run AFTER phase10_foundation.sql. Additive and idempotent: safe to run while the previous app version is live.
--
-- Rules (mirrored in lib/duels/rules.ts)
--   * A signed-in user challenges another user (named) or the whole court (open) for the current game:
--     "I take Blue for 100". Whoever answers takes the other side for the same stake. Stakes 10..500.
--   * Challenges are thrown during draft, chaos or betting and can be answered until betting closes.
--   * Escrow: the challenger pays when the challenge is thrown, the opponent pays atomically on accept.
--     Declined, withdrawn, unanswered (expired) and canceled duels return every stake.
--   * Players only fight for their own team: nobody can take the side against their own banner.
--   * One live duel per pair per game, one open challenge and at most 3 unanswered challenges per user per game,
--     10 challenges thrown per user per game in total (withdraw-and-rethrow cannot flood the herald).
--   * Settlement: the winner takes the pot (2 x stake) minus the royal tithe, 10% of the winnings
--     (floor(stake * 10%)), which is burned. Status won/lost is the challenger's result; winner_id names the victor.
--   * Balances may go down to the -300 debt floor, like bets.
--   * settle_duels / refund_duels: the session creator or an admin while the game is live; once the session is
--     resolved or canceled anyone may (re)run them, the outcome comes from the database, never from the caller.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.vvv_add_to_realtime(text)') IS NULL THEN
    RAISE EXCEPTION 'Run supabase/phase10_foundation.sql before supabase/phase10_duels.sql';
  END IF;
END $$;

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS duels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  challenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_open BOOLEAN NOT NULL DEFAULT false,
  challenger_side TEXT NOT NULL CHECK (challenger_side IN ('blue', 'red')),
  stake INTEGER NOT NULL CHECK (stake BETWEEN 10 AND 500),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'accepted', 'won', 'lost', 'declined', 'withdrawn', 'expired', 'refunded')),
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_side TEXT CHECK (winner_side IN ('blue', 'red')),
  payout INTEGER CHECK (payout >= 0),
  tax INTEGER NOT NULL DEFAULT 0 CHECK (tax >= 0),
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  CONSTRAINT duels_not_self CHECK (opponent_id IS NULL OR opponent_id <> challenger_id),
  CONSTRAINT duels_named_has_opponent CHECK (is_open OR opponent_id IS NOT NULL),
  CONSTRAINT duels_fought_has_opponent CHECK (status NOT IN ('accepted', 'won', 'lost') OR opponent_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_duels_session ON duels (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_duels_challenger ON duels (challenger_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duels_opponent ON duels (opponent_id, created_at DESC) WHERE opponent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_duels_live ON duels (session_id) WHERE status IN ('open', 'accepted');

-- One live duel per pair per game, whoever challenged whom. Declined or withdrawn challenges free the pair.
CREATE UNIQUE INDEX IF NOT EXISTS idx_duels_one_per_pair
  ON duels (session_id, LEAST(challenger_id, opponent_id), GREATEST(challenger_id, opponent_id))
  WHERE opponent_id IS NOT NULL AND status IN ('open', 'accepted', 'won', 'lost');

-- One open (unnamed) challenge per user per game at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_duels_one_open_call
  ON duels (session_id, challenger_id)
  WHERE is_open AND status = 'open';

-- Public reads: the court duels in the open. Writes only through the functions below.
ALTER TABLE duels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "duels_read" ON duels;
CREATE POLICY "duels_read" ON duels FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON duels FROM anon, authenticated;

-- ============================================================
-- HELPERS
-- ============================================================

CREATE OR REPLACE FUNCTION duel_rules() RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'min_stake', 10,
    'max_stake', 500,
    'tax_pct', 10,
    'max_pending', 3,
    'max_thrown', 10,
    'debt_floor', -300
  )
$$;

-- Challenges are thrown and answered from the draft until betting closes.
CREATE OR REPLACE FUNCTION duel_is_accepting(p_status TEXT, p_betting_ends_at TIMESTAMPTZ) RETURNS BOOLEAN
LANGUAGE sql VOLATILE AS $$
  SELECT COALESCE(
    p_status IN ('draft', 'chaos', 'betting')
      AND NOT (p_status = 'betting' AND p_betting_ends_at IS NOT NULL AND p_betting_ends_at <= clock_timestamp()),
    false
  )
$$;

-- The side a user plays on in this game (through either account link), or NULL for spectators.
CREATE OR REPLACE FUNCTION duel_player_side(p_session_id UUID, p_user_id UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT sa.side
  FROM session_assignments sa
  WHERE sa.session_id = p_session_id
    AND p_user_id IS NOT NULL
    AND (
      sa.player_id IN (SELECT p.id FROM players p WHERE p.auth_user_id = p_user_id)
      OR sa.player_id IN (
        SELECT up.player_id FROM user_profiles up WHERE up.id = p_user_id AND up.player_id IS NOT NULL
      )
    )
  ORDER BY sa.side
  LIMIT 1
$$;

-- Mirrors the session PATCH route: the creator, an admin, or anyone for a session without an owner.
CREATE OR REPLACE FUNCTION duel_can_officiate(p_created_by UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(
    p_created_by IS NULL
      OR p_created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM players WHERE auth_user_id = auth.uid() AND is_admin),
    false
  )
$$;

-- One lock order for every duel function: the game_sessions row, then purses by user id, then duel rows.
-- create_duel holds its purse while its insert may wait on the unique indexes, so anything that updates a
-- duel row and then pays someone must already hold that purse, or a withdrawal racing a new challenge deadlocks.
CREATE OR REPLACE FUNCTION duel_lock_session_purses(p_session_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM 1 FROM point_balances
  WHERE user_id IN (
    SELECT challenger_id FROM duels WHERE session_id = p_session_id AND status IN ('open', 'accepted')
    UNION
    SELECT opponent_id FROM duels
    WHERE session_id = p_session_id AND status IN ('open', 'accepted') AND opponent_id IS NOT NULL
  )
  ORDER BY user_id
  FOR UPDATE;
  PERFORM 1 FROM duels WHERE session_id = p_session_id AND status IN ('open', 'accepted') ORDER BY id FOR UPDATE;
END;
$$;

-- Unanswered challenges go home.
CREATE OR REPLACE FUNCTION duel_expire_open(p_session_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  r duels%ROWTYPE;
  v_count INTEGER := 0;
  v_total INTEGER := 0;
  v_users UUID[] := '{}';
BEGIN
  PERFORM duel_lock_session_purses(p_session_id);
  FOR r IN SELECT * FROM duels WHERE session_id = p_session_id AND status = 'open' ORDER BY created_at, id LOOP
    UPDATE duels SET status = 'expired', settled_at = now() WHERE id = r.id;
    PERFORM adjust_balance(r.challenger_id, r.stake, 'duel_refunded', r.id);
    v_count := v_count + 1;
    v_total := v_total + r.stake;
    IF NOT r.challenger_id = ANY (v_users) THEN
      v_users := v_users || r.challenger_id;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('expired', v_count, 'expired_total', v_total, 'expired_user_ids', to_jsonb(v_users));
END;
$$;

CREATE OR REPLACE FUNCTION duel_settle_accepted(p_session_id UUID, p_winner_side TEXT, p_game_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_rules JSONB := duel_rules();
  v_expired JSONB;
  r duels%ROWTYPE;
  v_winner UUID;
  v_loser UUID;
  v_pot INTEGER;
  v_tax INTEGER;
  v_settled JSONB := '[]'::jsonb;
BEGIN
  PERFORM duel_lock_session_purses(p_session_id);
  v_expired := duel_expire_open(p_session_id);

  FOR r IN SELECT * FROM duels WHERE session_id = p_session_id AND status = 'accepted' ORDER BY created_at, id LOOP
    v_winner := CASE WHEN r.challenger_side = p_winner_side THEN r.challenger_id ELSE r.opponent_id END;
    v_loser := CASE WHEN v_winner = r.challenger_id THEN r.opponent_id ELSE r.challenger_id END;
    v_pot := r.stake * 2;
    v_tax := vvv_title_duel_tithe(v_winner, r.stake, (v_rules->>'tax_pct')::INT); -- title effects: El Goblino Pequeno

    UPDATE duels SET
      status = CASE WHEN v_winner = r.challenger_id THEN 'won' ELSE 'lost' END,
      winner_id = v_winner,
      winner_side = p_winner_side,
      payout = v_pot - v_tax,
      tax = v_tax,
      game_id = p_game_id,
      settled_at = now()
    WHERE id = r.id;

    PERFORM adjust_balance(v_winner, v_pot, 'duel_won', r.id);
    IF v_tax > 0 THEN
      PERFORM adjust_balance(v_winner, -v_tax, 'duel_tax', r.id);
    END IF;
    PERFORM vvv_title_duel_consolation(v_loser, r.stake, r.id); -- title effects: Delayed Victory Specialist

    v_settled := v_settled || jsonb_build_array(jsonb_build_object(
      'id', r.id,
      'challenger_id', r.challenger_id,
      'opponent_id', r.opponent_id,
      'winner_id', v_winner,
      'loser_id', v_loser,
      'stake', r.stake,
      'payout', v_pot - v_tax,
      'tax', v_tax
    ));
  END LOOP;

  RETURN jsonb_build_object('action', 'settled', 'winner_side', p_winner_side, 'settled', v_settled) || v_expired;
END;
$$;

CREATE OR REPLACE FUNCTION duel_refund_all(p_session_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_expired JSONB;
  r duels%ROWTYPE;
  v_count INTEGER := 0;
BEGIN
  PERFORM duel_lock_session_purses(p_session_id);
  v_expired := duel_expire_open(p_session_id);

  FOR r IN SELECT * FROM duels WHERE session_id = p_session_id AND status = 'accepted' ORDER BY created_at, id LOOP
    UPDATE duels SET status = 'refunded', settled_at = now() WHERE id = r.id;
    PERFORM adjust_balance(r.challenger_id, r.stake, 'duel_refunded', r.id);
    PERFORM adjust_balance(r.opponent_id, r.stake, 'duel_refunded', r.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('action', 'refunded', 'refunded', v_count) || v_expired;
END;
$$;

-- ============================================================
-- THROW DOWN THE GAUNTLET
-- ============================================================

CREATE OR REPLACE FUNCTION create_duel(
  p_session_id UUID,
  p_side TEXT,
  p_stake INTEGER,
  p_opponent_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user UUID := auth.uid();
  v_rules JSONB := duel_rules();
  v_session game_sessions%ROWTYPE;
  v_my_side TEXT;
  v_their_side TEXT;
  v_balance INTEGER;
  v_pending INTEGER;
  v_thrown INTEGER;
  v_duel duels%ROWTYPE;
  v_constraint TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'duel:not_authenticated'; END IF;
  IF p_side IS NULL OR p_side NOT IN ('blue', 'red') THEN RAISE EXCEPTION 'duel:invalid_side'; END IF;
  IF p_stake IS NULL OR p_stake < (v_rules->>'min_stake')::INT OR p_stake > (v_rules->>'max_stake')::INT THEN
    RAISE EXCEPTION 'duel:invalid_stake';
  END IF;
  IF p_opponent_id IS NOT NULL AND p_opponent_id = v_user THEN RAISE EXCEPTION 'duel:self'; END IF;

  -- Share lock: phase transitions wait for in-flight challenges, so none slips in after the gates close.
  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'duel:session_not_found'; END IF;
  IF NOT duel_is_accepting(v_session.status, v_session.betting_ends_at) THEN RAISE EXCEPTION 'duel:closed'; END IF;

  v_my_side := duel_player_side(p_session_id, v_user);
  IF v_my_side IS NOT NULL AND v_my_side <> p_side THEN RAISE EXCEPTION 'duel:treason'; END IF;

  IF p_opponent_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM point_balances WHERE user_id = p_opponent_id) THEN
      RAISE EXCEPTION 'duel:opponent_unavailable';
    END IF;
    v_their_side := duel_player_side(p_session_id, p_opponent_id);
    IF v_their_side IS NOT NULL AND v_their_side = p_side THEN RAISE EXCEPTION 'duel:opponent_treason'; END IF;
  END IF;

  -- Locking the purse first serializes concurrent challenges from the same user (limits and balance).
  SELECT balance INTO v_balance FROM point_balances WHERE user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'duel:no_balance'; END IF;

  SELECT count(*) FILTER (WHERE status = 'open'), count(*) INTO v_pending, v_thrown
  FROM duels WHERE session_id = p_session_id AND challenger_id = v_user;
  IF v_pending >= (v_rules->>'max_pending')::INT THEN RAISE EXCEPTION 'duel:too_many_pending'; END IF;
  IF v_thrown >= (v_rules->>'max_thrown')::INT THEN RAISE EXCEPTION 'duel:too_many_thrown'; END IF;

  IF v_balance - p_stake < (v_rules->>'debt_floor')::INT THEN RAISE EXCEPTION 'duel:debt_limit'; END IF;

  BEGIN
    INSERT INTO duels (session_id, challenger_id, opponent_id, is_open, challenger_side, stake)
    VALUES (p_session_id, v_user, p_opponent_id, p_opponent_id IS NULL, p_side, p_stake)
    RETURNING * INTO v_duel;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'idx_duels_one_open_call' THEN RAISE EXCEPTION 'duel:open_exists'; END IF;
    RAISE EXCEPTION 'duel:pair_exists';
  END;

  v_balance := adjust_balance(v_user, -p_stake, 'duel_stake', v_duel.id);
  RETURN jsonb_build_object('duel', to_jsonb(v_duel), 'balance', v_balance);
END;
$$;

-- ============================================================
-- ANSWER, DECLINE, WITHDRAW
-- ============================================================

CREATE OR REPLACE FUNCTION accept_duel(p_duel_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user UUID := auth.uid();
  v_rules JSONB := duel_rules();
  v_session_id UUID;
  v_session game_sessions%ROWTYPE;
  v_duel duels%ROWTYPE;
  v_balance INTEGER;
  v_has_purse BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'duel:not_authenticated'; END IF;

  SELECT session_id INTO v_session_id FROM duels WHERE id = p_duel_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'duel:not_found'; END IF;

  -- Session, then purse, then the duel row (see duel_lock_session_purses).
  SELECT * INTO v_session FROM game_sessions WHERE id = v_session_id FOR SHARE;
  SELECT balance INTO v_balance FROM point_balances WHERE user_id = v_user FOR UPDATE;
  v_has_purse := FOUND;
  SELECT * INTO v_duel FROM duels WHERE id = p_duel_id FOR UPDATE;

  IF v_duel.status <> 'open' THEN
    IF v_duel.status = 'accepted' AND v_duel.is_open AND v_duel.opponent_id <> v_user THEN
      RAISE EXCEPTION 'duel:taken';
    END IF;
    RAISE EXCEPTION 'duel:not_open';
  END IF;
  IF NOT duel_is_accepting(v_session.status, v_session.betting_ends_at) THEN RAISE EXCEPTION 'duel:closed'; END IF;
  IF v_duel.challenger_id = v_user THEN RAISE EXCEPTION 'duel:self'; END IF;
  IF NOT v_duel.is_open AND v_duel.opponent_id IS DISTINCT FROM v_user THEN RAISE EXCEPTION 'duel:not_yours'; END IF;
  IF duel_player_side(v_session_id, v_user) = v_duel.challenger_side THEN RAISE EXCEPTION 'duel:treason'; END IF;
  IF NOT v_has_purse THEN RAISE EXCEPTION 'duel:no_balance'; END IF;
  IF v_balance - v_duel.stake < (v_rules->>'debt_floor')::INT THEN RAISE EXCEPTION 'duel:debt_limit'; END IF;

  BEGIN
    UPDATE duels SET status = 'accepted', opponent_id = v_user, responded_at = now()
    WHERE id = p_duel_id
    RETURNING * INTO v_duel;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'duel:pair_exists';
  END;

  v_balance := adjust_balance(v_user, -v_duel.stake, 'duel_stake', v_duel.id);
  RETURN jsonb_build_object('duel', to_jsonb(v_duel), 'balance', v_balance);
END;
$$;

-- The named opponent refuses: the challenger's stake goes home.
CREATE OR REPLACE FUNCTION decline_duel(p_duel_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user UUID := auth.uid();
  v_challenger UUID;
  v_duel duels%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'duel:not_authenticated'; END IF;

  -- The challenger never changes: lock the purse being refunded before the duel row.
  SELECT challenger_id INTO v_challenger FROM duels WHERE id = p_duel_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'duel:not_found'; END IF;
  PERFORM 1 FROM point_balances WHERE user_id = v_challenger FOR UPDATE;

  SELECT * INTO v_duel FROM duels WHERE id = p_duel_id FOR UPDATE;
  IF v_duel.status <> 'open' THEN RAISE EXCEPTION 'duel:not_open'; END IF;
  IF v_duel.is_open OR v_duel.opponent_id IS DISTINCT FROM v_user THEN RAISE EXCEPTION 'duel:not_yours'; END IF;

  UPDATE duels SET status = 'declined', responded_at = now(), settled_at = now()
  WHERE id = p_duel_id
  RETURNING * INTO v_duel;
  PERFORM adjust_balance(v_duel.challenger_id, v_duel.stake, 'duel_refunded', v_duel.id);

  RETURN jsonb_build_object('duel', to_jsonb(v_duel));
END;
$$;

-- The challenger takes an unanswered challenge back.
CREATE OR REPLACE FUNCTION withdraw_duel(p_duel_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user UUID := auth.uid();
  v_duel duels%ROWTYPE;
  v_balance INTEGER;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'duel:not_authenticated'; END IF;

  PERFORM 1 FROM point_balances WHERE user_id = v_user FOR UPDATE;
  SELECT * INTO v_duel FROM duels WHERE id = p_duel_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'duel:not_found'; END IF;
  IF v_duel.challenger_id <> v_user THEN RAISE EXCEPTION 'duel:not_yours'; END IF;
  IF v_duel.status <> 'open' THEN RAISE EXCEPTION 'duel:not_open'; END IF;

  UPDATE duels SET status = 'withdrawn', responded_at = now(), settled_at = now()
  WHERE id = p_duel_id
  RETURNING * INTO v_duel;
  v_balance := adjust_balance(v_user, v_duel.stake, 'duel_refunded', v_duel.id);

  RETURN jsonb_build_object('duel', to_jsonb(v_duel), 'balance', v_balance);
END;
$$;

-- ============================================================
-- SETTLEMENT
-- ============================================================

-- Declare-winner hook (session still in_game: creator or admin, game row linked and matching), or a lazy
-- repair once the session is resolved (anyone, winner taken from the status). Idempotent: only live rows move.
CREATE OR REPLACE FUNCTION settle_duels(p_session_id UUID, p_winner_side TEXT, p_game_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
  v_resolved_side TEXT;
BEGIN
  IF p_winner_side IS NULL OR p_winner_side NOT IN ('blue', 'red') THEN RAISE EXCEPTION 'duel:invalid_side'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'duel:session_not_found'; END IF;

  IF v_session.status = 'in_game' THEN
    IF NOT duel_can_officiate(v_session.created_by) THEN RAISE EXCEPTION 'duel:not_authorized'; END IF;
    IF p_game_id IS NULL OR v_session.game_id IS DISTINCT FROM p_game_id THEN RAISE EXCEPTION 'duel:invalid_state'; END IF;
    IF NOT EXISTS (SELECT 1 FROM games WHERE id = p_game_id AND winner_side = p_winner_side) THEN
      RAISE EXCEPTION 'duel:invalid_state';
    END IF;
  ELSIF v_session.status IN ('blue_win', 'red_win') THEN
    v_resolved_side := CASE WHEN v_session.status = 'blue_win' THEN 'blue' ELSE 'red' END;
    IF p_winner_side <> v_resolved_side THEN RAISE EXCEPTION 'duel:invalid_state'; END IF;
  ELSE
    RAISE EXCEPTION 'duel:invalid_state';
  END IF;

  RETURN duel_settle_accepted(p_session_id, p_winner_side, v_session.game_id);
END;
$$;

-- Cancel hook: every stake goes home. Runs after the status flipped to canceled (anyone may repeat it);
-- on a live game only the creator or an admin can void the duels.
CREATE OR REPLACE FUNCTION refund_duels(p_session_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'duel:session_not_found'; END IF;
  IF v_session.status IN ('blue_win', 'red_win') THEN RAISE EXCEPTION 'duel:already_resolved'; END IF;
  IF v_session.status NOT IN ('canceled', 'expired') AND NOT duel_can_officiate(v_session.created_by) THEN
    RAISE EXCEPTION 'duel:not_authorized';
  END IF;
  RETURN duel_refund_all(p_session_id);
END;
$$;

-- Lazy upkeep any signed-in reader may trigger; it only does what the session state dictates:
-- expire unanswered challenges once the gates closed, finish a settlement or a refund a hook left behind.
CREATE OR REPLACE FUNCTION sweep_duels(p_session_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'duel:not_authenticated'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'duel:session_not_found'; END IF;
  IF duel_is_accepting(v_session.status, v_session.betting_ends_at) THEN
    RETURN jsonb_build_object('action', 'none');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM duels WHERE session_id = p_session_id AND status IN ('open', 'accepted')) THEN
    RETURN jsonb_build_object('action', 'none');
  END IF;

  IF v_session.status IN ('blue_win', 'red_win') THEN
    SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
    RETURN duel_settle_accepted(
      p_session_id,
      CASE WHEN v_session.status = 'blue_win' THEN 'blue' ELSE 'red' END,
      v_session.game_id
    );
  ELSIF v_session.status IN ('canceled', 'expired') THEN
    SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
    RETURN duel_refund_all(p_session_id);
  END IF;

  RETURN jsonb_build_object('action', 'expired') || duel_expire_open(p_session_id);
END;
$$;

-- Repairs stakes stranded on games that are over: a settle or refund hook that failed twice, on a game whose
-- board nobody opened afterwards (a canceled game never shows one). The next game's board runs this.
CREATE OR REPLACE FUNCTION sweep_stale_duels() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_session_id UUID;
  v_results JSONB := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'duel:not_authenticated'; END IF;

  FOR v_session_id IN
    SELECT DISTINCT d.session_id
    FROM duels d
    JOIN game_sessions s ON s.id = d.session_id
    WHERE d.status IN ('open', 'accepted') AND s.status IN ('blue_win', 'red_win', 'canceled', 'expired')
    LIMIT 5
  LOOP
    v_results := v_results || jsonb_build_array(sweep_duels(v_session_id) || jsonb_build_object('session_id', v_session_id));
  END LOOP;
  RETURN v_results;
END;
$$;

-- ============================================================
-- PRIVILEGES
-- ============================================================

REVOKE EXECUTE ON FUNCTION create_duel(UUID, TEXT, INTEGER, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_duel(UUID, TEXT, INTEGER, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION accept_duel(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION accept_duel(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION decline_duel(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION decline_duel(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION withdraw_duel(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION withdraw_duel(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION settle_duels(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION settle_duels(UUID, TEXT, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION refund_duels(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION refund_duels(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION sweep_duels(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sweep_duels(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION sweep_stale_duels() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sweep_stale_duels() TO authenticated;

REVOKE EXECUTE ON FUNCTION duel_lock_session_purses(UUID) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION duel_player_side(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION duel_can_officiate(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION duel_expire_open(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION duel_settle_accepted(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION duel_refund_all(UUID) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- REALTIME
-- ============================================================

SELECT vvv_add_to_realtime('duels');

COMMIT;
