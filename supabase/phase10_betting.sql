-- Phase 10: Betting overhaul
-- Live pari-mutuel market with raises, early-conviction boost, all-in bonus and Guardian Angel insurance.
-- Additive and idempotent: safe to run while the previous app version is deployed.
-- Requires supabase/phase10_foundation.sql (free-form point_transactions reasons).
--
-- Rules (mirrored in lib/betting/rules.ts):
--   payout        floor(stake * total_pool / winning_pool), refund everyone when one side is empty
--   early boost   stake placed in the first 60 s of the window earns +10% of its share of the profit
--   all-in        staking the whole balance (total stake >= 100) earns +15% of the profit, cannot be insured
--   insurance     a loss returns floor(60% of stake). The premium is priced from the pool when bought:
--                 ceil(66% x the other side's share of the pool), between 33% and 60% of the stake, so it stays
--                 negative EV for long shots too. Paid now, kept on a win, refunded only with the bet itself.
--                 Raising an insured bet prices only the added stake.
--   legacy bets   rows placed before this migration keep their terms (flat 17 premium refunded on a win,
--                 50% of the stake back on a loss)

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.vvv_add_to_realtime(text)') IS NULL THEN
    RAISE EXCEPTION 'Run supabase/phase10_foundation.sql before supabase/phase10_betting.sql';
  END IF;
END $$;

-- ============================================================
-- COLUMNS
-- ============================================================

ALTER TABLE bets ADD COLUMN IF NOT EXISTS scheme TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE bets ADD COLUMN IF NOT EXISTS premium INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS coverage_pct SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS early_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS all_in BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS bonus INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS raises INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS raised_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bets_scheme_check' AND conrelid = 'public.bets'::regclass
  ) THEN
    ALTER TABLE bets ADD CONSTRAINT bets_scheme_check CHECK (scheme IN ('legacy', 'v2'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bets_v2_amounts_check' AND conrelid = 'public.bets'::regclass
  ) THEN
    ALTER TABLE bets ADD CONSTRAINT bets_v2_amounts_check CHECK (
      premium >= 0 AND bonus >= 0 AND raises >= 0
      AND early_amount >= 0 AND early_amount <= amount
      AND coverage_pct BETWEEN 0 AND 100
    );
  END IF;
END $$;

ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS betting_opened_at TIMESTAMPTZ;

-- Stamps the moment a session enters the betting phase so the early-conviction window is exact
-- whatever the window length is.
CREATE OR REPLACE FUNCTION bet_v2_stamp_betting_opened() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'betting' AND OLD.status IS DISTINCT FROM 'betting' THEN
    NEW.betting_opened_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bet_v2_stamp_betting_opened_trg ON game_sessions;
CREATE TRIGGER bet_v2_stamp_betting_opened_trg
  BEFORE UPDATE OF status ON game_sessions
  FOR EACH ROW EXECUTE FUNCTION bet_v2_stamp_betting_opened();

-- ============================================================
-- RULES
-- ============================================================

CREATE OR REPLACE FUNCTION bet_rules_v2() RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'window_seconds', 300,
    'early_seconds', 60,
    'early_bonus_pct', 10,
    'all_in_bonus_pct', 15,
    'all_in_min', 100,
    'premium_pct', 33,
    'premium_max_pct', 60,
    'premium_load_pct', 110,
    'coverage_pct', 60,
    'insurance_min', 10,
    'debt_floor', -300,
    'max_stake', 100000,
    'legacy_premium', 17,
    'legacy_coverage_pct', 50
  )
$$;

-- Mirrors the session route: the creator, an admin, or anyone for a session without an owner.
CREATE OR REPLACE FUNCTION bet_v2_can_settle(p_created_by UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    p_created_by IS NULL
    OR p_created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM players WHERE auth_user_id = auth.uid() AND is_admin),
    false
  )
$$;

-- Guardian Angel premium in percent of the insured stake, priced from the pending pools at purchase time
-- (p_side_pool already includes the stake being insured). The other side's share of the pool is the implied
-- chance of losing: a flat price would make insuring long shots free money.
CREATE OR REPLACE FUNCTION bet_v2_premium_pct(p_side_pool INTEGER, p_other_pool INTEGER) RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN COALESCE(p_other_pool, 0) <= 0 OR COALESCE(p_side_pool, 0) <= 0 THEN (r->>'premium_pct')::INT
    ELSE LEAST(
      GREATEST(
        CEIL(
          (r->>'coverage_pct')::INT * (r->>'premium_load_pct')::INT * p_other_pool::NUMERIC
            / (100 * (p_side_pool + p_other_pool))
        )::INT,
        (r->>'premium_pct')::INT
      ),
      (r->>'premium_max_pct')::INT
    )
  END
  FROM (SELECT bet_rules_v2() AS r) rules
$$;

-- ============================================================
-- PLACE / RAISE
-- ============================================================

-- Earlier drafts of these functions had shorter signatures; drop them so PostgREST resolves a single candidate.
DROP FUNCTION IF EXISTS place_bet_v2(UUID, TEXT, INTEGER, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS insure_bet_v2(UUID);

-- p_current is the stake the client saw (0 for a new bet): a double submit or a stale tab is rejected instead of
-- silently becoming a raise. For an all-in, p_amount must equal the purse the client showed. p_max_premium is the
-- premium the client showed: if the odds moved against the bettor before the call landed, it is rejected.
CREATE OR REPLACE FUNCTION place_bet_v2(
  p_session_id UUID,
  p_side TEXT,
  p_amount INTEGER,
  p_insure BOOLEAN DEFAULT false,
  p_all_in BOOLEAN DEFAULT false,
  p_current INTEGER DEFAULT NULL,
  p_max_premium INTEGER DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_rules JSONB := bet_rules_v2();
  v_now TIMESTAMPTZ := now();
  v_session game_sessions%ROWTYPE;
  v_balance INTEGER;
  v_bet bets%ROWTYPE;
  v_has_bet BOOLEAN;
  v_was_insured BOOLEAN;
  v_all_in BOOLEAN := COALESCE(p_all_in, false);
  v_insured BOOLEAN;
  v_stake INTEGER;
  v_total INTEGER;
  v_side_pool INTEGER;
  v_other_pool INTEGER;
  v_premium_pct INTEGER := 0;
  v_premium INTEGER := 0;
  v_cost INTEGER;
  v_opened TIMESTAMPTZ;
  v_early BOOLEAN := false;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'bet:not_authenticated'; END IF;
  IF p_side IS NULL OR p_side NOT IN ('blue', 'red') THEN RAISE EXCEPTION 'bet:invalid_side'; END IF;

  -- Share lock: closing the window or settling waits for in-flight bets, and vice versa.
  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bet:session_not_found'; END IF;
  IF v_session.status <> 'betting'
     OR (v_session.betting_ends_at IS NOT NULL AND v_session.betting_ends_at <= v_now) THEN
    RAISE EXCEPTION 'bet:betting_closed';
  END IF;

  -- Locking the balance first serializes concurrent requests from the same user.
  SELECT balance INTO v_balance FROM point_balances WHERE user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bet:no_balance'; END IF;

  SELECT * INTO v_bet FROM bets WHERE session_id = p_session_id AND user_id = v_user FOR UPDATE;
  v_has_bet := FOUND;

  IF p_current IS NOT NULL AND p_current <> (CASE WHEN v_has_bet THEN v_bet.amount ELSE 0 END) THEN
    RAISE EXCEPTION 'bet:stale_position';
  END IF;

  IF v_has_bet THEN
    IF v_bet.status <> 'pending' THEN RAISE EXCEPTION 'bet:bet_settled'; END IF;
    IF v_bet.side <> p_side THEN RAISE EXCEPTION 'bet:side_locked'; END IF;
    IF v_bet.all_in THEN RAISE EXCEPTION 'bet:all_in_locked'; END IF;
    IF v_bet.scheme = 'legacy' AND v_bet.insured THEN RAISE EXCEPTION 'bet:legacy_locked'; END IF;
  END IF;

  v_was_insured := v_has_bet AND v_bet.insured;
  v_insured := v_was_insured OR COALESCE(p_insure, false);

  IF v_all_in THEN
    IF v_insured THEN RAISE EXCEPTION 'bet:all_in_uninsurable'; END IF;
    v_stake := v_balance;
    IF v_stake < 1 THEN RAISE EXCEPTION 'bet:invalid_amount'; END IF;
    IF p_amount IS NOT NULL AND p_amount <> v_balance THEN RAISE EXCEPTION 'bet:purse_changed'; END IF;
  ELSE
    v_stake := p_amount;
  END IF;

  IF v_stake IS NULL OR v_stake < 1 OR v_stake > (v_rules->>'max_stake')::INT THEN
    RAISE EXCEPTION 'bet:invalid_amount';
  END IF;

  v_total := v_stake + CASE WHEN v_has_bet THEN v_bet.amount ELSE 0 END;

  IF v_all_in AND v_total < (v_rules->>'all_in_min')::INT THEN
    RAISE EXCEPTION 'bet:all_in_too_small';
  END IF;

  IF v_insured THEN
    IF v_total < (v_rules->>'insurance_min')::INT THEN RAISE EXCEPTION 'bet:insurance_too_small'; END IF;
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE side = p_side), 0) + v_stake,
      COALESCE(SUM(amount) FILTER (WHERE side <> p_side), 0)
    INTO v_side_pool, v_other_pool
    FROM bets WHERE session_id = p_session_id AND status = 'pending';
    v_premium_pct := bet_v2_premium_pct(v_side_pool, v_other_pool);
    -- An insured bet only pays for the points it adds; insuring now covers the whole stake.
    v_premium := CEIL(
      (CASE WHEN v_was_insured THEN v_stake ELSE v_total END)::NUMERIC * v_premium_pct / 100
    )::INT;
    IF p_max_premium IS NOT NULL AND v_premium > p_max_premium THEN RAISE EXCEPTION 'bet:premium_changed'; END IF;
  END IF;

  v_cost := v_stake + v_premium;
  IF v_balance - v_cost < (v_rules->>'debt_floor')::INT THEN RAISE EXCEPTION 'bet:debt_limit'; END IF;

  v_opened := COALESCE(
    v_session.betting_opened_at,
    v_session.betting_ends_at - make_interval(secs => (v_rules->>'window_seconds')::INT)
  );
  v_early := v_opened IS NOT NULL
    AND v_now < v_opened + make_interval(secs => (v_rules->>'early_seconds')::INT);

  IF v_has_bet THEN
    UPDATE bets SET
      amount = v_total,
      insured = v_insured,
      premium = premium + v_premium,
      coverage_pct = CASE
        WHEN v_insured AND coverage_pct = 0 THEN (v_rules->>'coverage_pct')::INT
        ELSE coverage_pct
      END,
      early_amount = early_amount + CASE WHEN v_early THEN v_stake ELSE 0 END,
      all_in = v_all_in,
      scheme = 'v2',
      raises = raises + 1,
      raised_at = v_now
    WHERE id = v_bet.id
    RETURNING * INTO v_bet;
  ELSE
    INSERT INTO bets (session_id, user_id, side, amount, insured, scheme, premium, coverage_pct, early_amount, all_in)
    VALUES (
      p_session_id, v_user, p_side, v_total, v_insured, 'v2', v_premium,
      CASE WHEN v_insured THEN (v_rules->>'coverage_pct')::INT ELSE 0 END,
      CASE WHEN v_early THEN v_stake ELSE 0 END,
      v_all_in
    )
    RETURNING * INTO v_bet;
  END IF;

  PERFORM adjust_balance(v_user, -v_stake, 'bet_placed', p_session_id);
  IF v_premium > 0 THEN
    PERFORM adjust_balance(v_user, -v_premium, 'insurance_bought', v_bet.id);
  END IF;

  RETURN jsonb_build_object(
    'bet', to_jsonb(v_bet),
    'staked', v_stake,
    'premium', v_premium,
    'premium_pct', v_premium_pct,
    'early', v_early,
    'raised', v_has_bet,
    'all_in', v_all_in,
    'balance', v_balance - v_cost
  );
END;
$$;

-- ============================================================
-- INSURE AN EXISTING BET
-- ============================================================

CREATE OR REPLACE FUNCTION insure_bet_v2(p_session_id UUID, p_max_premium INTEGER DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_rules JSONB := bet_rules_v2();
  v_session game_sessions%ROWTYPE;
  v_balance INTEGER;
  v_bet bets%ROWTYPE;
  v_side_pool INTEGER;
  v_other_pool INTEGER;
  v_premium_pct INTEGER;
  v_premium INTEGER;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'bet:not_authenticated'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bet:session_not_found'; END IF;
  IF v_session.status <> 'betting'
     OR (v_session.betting_ends_at IS NOT NULL AND v_session.betting_ends_at <= now()) THEN
    RAISE EXCEPTION 'bet:betting_closed';
  END IF;

  SELECT balance INTO v_balance FROM point_balances WHERE user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bet:no_balance'; END IF;

  SELECT * INTO v_bet FROM bets WHERE session_id = p_session_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bet:no_bet'; END IF;
  IF v_bet.status <> 'pending' THEN RAISE EXCEPTION 'bet:bet_settled'; END IF;
  IF v_bet.insured THEN RAISE EXCEPTION 'bet:already_insured'; END IF;
  IF v_bet.all_in THEN RAISE EXCEPTION 'bet:all_in_uninsurable'; END IF;
  IF v_bet.amount < (v_rules->>'insurance_min')::INT THEN RAISE EXCEPTION 'bet:insurance_too_small'; END IF;

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE side = v_bet.side), 0),
    COALESCE(SUM(amount) FILTER (WHERE side <> v_bet.side), 0)
  INTO v_side_pool, v_other_pool
  FROM bets WHERE session_id = p_session_id AND status = 'pending';
  v_premium_pct := bet_v2_premium_pct(v_side_pool, v_other_pool);
  v_premium := CEIL(v_bet.amount::NUMERIC * v_premium_pct / 100)::INT;
  IF p_max_premium IS NOT NULL AND v_premium > p_max_premium THEN RAISE EXCEPTION 'bet:premium_changed'; END IF;
  IF v_balance - v_premium < (v_rules->>'debt_floor')::INT THEN RAISE EXCEPTION 'bet:debt_limit'; END IF;

  UPDATE bets SET
    insured = true,
    premium = premium + v_premium,
    coverage_pct = (v_rules->>'coverage_pct')::INT,
    scheme = 'v2'
  WHERE id = v_bet.id
  RETURNING * INTO v_bet;

  PERFORM adjust_balance(v_user, -v_premium, 'insurance_bought', v_bet.id);

  RETURN jsonb_build_object(
    'bet', to_jsonb(v_bet),
    'premium', v_premium,
    'premium_pct', v_premium_pct,
    'balance', v_balance - v_premium
  );
END;
$$;

-- ============================================================
-- SETTLEMENT
-- ============================================================

-- Refunds every pending bet of a session: stake plus premium (legacy insured rows get their flat 17 back).
CREATE OR REPLACE FUNCTION bet_v2_refund_pending(p_session_id UUID) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rules JSONB := bet_rules_v2();
  r bets%ROWTYPE;
  v_premium INTEGER;
  v_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT * FROM bets WHERE session_id = p_session_id AND status = 'pending' ORDER BY created_at FOR UPDATE
  LOOP
    UPDATE bets SET status = 'refunded', payout = r.amount WHERE id = r.id;
    PERFORM adjust_balance(r.user_id, r.amount, 'bet_refunded', r.id);
    v_premium := CASE
      WHEN r.scheme = 'v2' THEN r.premium
      WHEN r.insured THEN (v_rules->>'legacy_premium')::INT
      ELSE 0
    END;
    IF v_premium > 0 THEN
      PERFORM adjust_balance(r.user_id, v_premium, 'insurance_refunded', r.id);
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION resolve_bets_v2(p_session_id UUID, p_winner_side TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rules JSONB := bet_rules_v2();
  v_session game_sessions%ROWTYPE;
  v_total INTEGER;
  v_win_pool INTEGER;
  v_count INTEGER;
  r bets%ROWTYPE;
  v_base INTEGER;
  v_profit INTEGER;
  v_early_bonus INTEGER;
  v_all_in_bonus INTEGER;
  v_cover INTEGER;
  v_winners INTEGER := 0;
  v_losers INTEGER := 0;
  v_bonus_paid INTEGER := 0;
  v_cover_paid INTEGER := 0;
BEGIN
  IF p_winner_side IS NULL OR p_winner_side NOT IN ('blue', 'red') THEN RAISE EXCEPTION 'bet:invalid_side'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bet:session_not_found'; END IF;
  IF NOT bet_v2_can_settle(v_session.created_by) THEN RAISE EXCEPTION 'bet:not_authorized'; END IF;
  -- Only a game that is being played (the declare flow settles before flipping the status) or already won by
  -- this side: never while the betting window is open.
  IF v_session.status NOT IN ('in_game', p_winner_side || '_win') THEN
    RAISE EXCEPTION 'bet:invalid_state';
  END IF;

  PERFORM 1 FROM bets WHERE session_id = p_session_id AND status = 'pending' FOR UPDATE;

  SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(amount) FILTER (WHERE side = p_winner_side), 0), COUNT(*)
  INTO v_total, v_win_pool, v_count
  FROM bets WHERE session_id = p_session_id AND status = 'pending';

  IF v_count = 0 THEN
    RETURN jsonb_build_object('settled', 0, 'refunded', false, 'winner', p_winner_side, 'total_pool', 0);
  END IF;

  IF v_win_pool = 0 OR v_win_pool = v_total THEN
    PERFORM bet_v2_refund_pending(p_session_id);
    RETURN jsonb_build_object('settled', v_count, 'refunded', true, 'winner', p_winner_side, 'total_pool', v_total);
  END IF;

  FOR r IN SELECT * FROM bets WHERE session_id = p_session_id AND status = 'pending' ORDER BY created_at LOOP
    IF r.side = p_winner_side THEN
      v_base := FLOOR(r.amount::NUMERIC * v_total / v_win_pool)::INT;
      v_profit := GREATEST(v_base - r.amount, 0);
      v_early_bonus := 0;
      v_all_in_bonus := 0;
      IF r.scheme = 'v2' THEN
        IF r.early_amount > 0 THEN
          v_early_bonus := FLOOR(
            v_profit::NUMERIC * (v_rules->>'early_bonus_pct')::INT * LEAST(r.early_amount, r.amount)
              / (100 * r.amount)
          )::INT;
        END IF;
        IF r.all_in THEN
          v_all_in_bonus := FLOOR(v_profit::NUMERIC * (v_rules->>'all_in_bonus_pct')::INT / 100)::INT;
        END IF;
      END IF;

      UPDATE bets
      SET status = 'won', payout = v_base + v_early_bonus + v_all_in_bonus, bonus = v_early_bonus + v_all_in_bonus
      WHERE id = r.id;

      PERFORM adjust_balance(r.user_id, v_base, 'bet_won', r.id);
      IF v_early_bonus > 0 THEN
        PERFORM adjust_balance(r.user_id, v_early_bonus, 'bet_early_bonus', r.id);
      END IF;
      IF v_all_in_bonus > 0 THEN
        PERFORM adjust_balance(r.user_id, v_all_in_bonus, 'bet_all_in_bonus', r.id);
      END IF;
      IF r.scheme = 'legacy' AND r.insured THEN
        PERFORM adjust_balance(r.user_id, (v_rules->>'legacy_premium')::INT, 'insurance_refunded', r.id);
      END IF;

      v_winners := v_winners + 1;
      v_bonus_paid := v_bonus_paid + v_early_bonus + v_all_in_bonus;
    ELSE
      v_cover := 0;
      IF r.insured THEN
        v_cover := FLOOR(
          r.amount::NUMERIC
            * CASE WHEN r.scheme = 'v2' THEN r.coverage_pct ELSE (v_rules->>'legacy_coverage_pct')::INT END
            / 100
        )::INT;
      END IF;

      UPDATE bets SET status = 'lost', payout = v_cover WHERE id = r.id;
      IF v_cover > 0 THEN
        PERFORM adjust_balance(r.user_id, v_cover, 'insurance_payout', r.id);
      END IF;

      v_losers := v_losers + 1;
      v_cover_paid := v_cover_paid + v_cover;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'settled', v_count,
    'refunded', false,
    'winner', p_winner_side,
    'total_pool', v_total,
    'winners', v_winners,
    'losers', v_losers,
    'bonus_paid', v_bonus_paid,
    'insurance_paid', v_cover_paid
  );
END;
$$;

CREATE OR REPLACE FUNCTION refund_all_bets_v2(p_session_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
  v_count INTEGER;
BEGIN
  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bet:session_not_found'; END IF;
  IF NOT bet_v2_can_settle(v_session.created_by) THEN RAISE EXCEPTION 'bet:not_authorized'; END IF;
  v_count := bet_v2_refund_pending(p_session_id);
  RETURN jsonb_build_object('refunded', v_count);
END;
$$;

-- ============================================================
-- PRIVILEGES
-- ============================================================

REVOKE EXECUTE ON FUNCTION place_bet_v2(UUID, TEXT, INTEGER, BOOLEAN, BOOLEAN, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION place_bet_v2(UUID, TEXT, INTEGER, BOOLEAN, BOOLEAN, INTEGER, INTEGER) TO authenticated;

REVOKE EXECUTE ON FUNCTION insure_bet_v2(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION insure_bet_v2(UUID, INTEGER) TO authenticated;

REVOKE EXECUTE ON FUNCTION resolve_bets_v2(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION resolve_bets_v2(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION refund_all_bets_v2(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION refund_all_bets_v2(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION bet_v2_refund_pending(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION bet_v2_can_settle(UUID) FROM PUBLIC, anon, authenticated;

-- The pre-v2 route inserts bets with the caller's role, so direct inserts stay allowed, but only as a plain pending
-- row on an open window: premiums, coverage, boosts and settled rows can only come from the functions above.
DROP POLICY IF EXISTS "bets_insert" ON bets;
CREATE POLICY "bets_insert" ON bets FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending'
  AND payout IS NULL
  AND scheme = 'legacy'
  AND premium = 0
  AND coverage_pct = 0
  AND early_amount = 0
  AND NOT all_in
  AND bonus = 0
  AND raises = 0
  AND raised_at IS NULL
  AND EXISTS (SELECT 1 FROM game_sessions g WHERE g.id = bets.session_id AND g.status = 'betting')
);

-- bets and game_sessions are already published; kept for completeness on fresh projects.
SELECT vvv_add_to_realtime('bets');
SELECT vvv_add_to_realtime('game_sessions');

-- ============================================================
-- REMEDIATION: phantom insurance from the old "Insure" button
-- ============================================================
-- The old PATCH flow charged 17 points, then tried to flag the bet from the client role, which the
-- bets_update policy (USING false) silently rejected: the premium was taken but the bet stayed uninsured.
-- Honor the legacy terms those users were shown: a lost bet gets 50% of its stake back, a won or refunded
-- bet gets its premium back, a pending bet becomes insured, and duplicate charges are returned.
-- Idempotent: fixed bets are flagged insured and no longer match.
DO $$
DECLARE
  v_rules JSONB := bet_rules_v2();
  v_premium INTEGER := (v_rules->>'legacy_premium')::INT;
  r RECORD;
  v_cover INTEGER;
  v_refund INTEGER;
  v_rows INTEGER;
BEGIN
  FOR r IN
    SELECT b.id, b.user_id, b.amount, b.status, SUM(-t.amount)::INT AS charged
    FROM bets b
    JOIN point_transactions t
      ON t.reference_id = b.id AND t.user_id = b.user_id AND t.reason = 'insurance_bought'
    JOIN point_balances pb ON pb.user_id = b.user_id
    WHERE b.scheme = 'legacy' AND NOT b.insured
      AND NOT EXISTS (
        SELECT 1 FROM point_transactions x
        WHERE x.reference_id = b.id AND x.user_id = b.user_id
          AND x.reason IN ('insurance_refunded', 'insurance_bug_refund', 'insurance_bug_payout')
      )
    GROUP BY b.id, b.user_id, b.amount, b.status
  LOOP
    v_cover := CASE
      WHEN r.status = 'lost' THEN FLOOR(r.amount::NUMERIC * (v_rules->>'legacy_coverage_pct')::INT / 100)::INT
      ELSE 0
    END;
    v_refund := CASE
      WHEN r.status IN ('lost', 'pending') THEN GREATEST(r.charged - v_premium, 0)
      ELSE r.charged
    END;

    UPDATE bets SET insured = true, payout = CASE WHEN r.status = 'lost' THEN v_cover ELSE payout END
    WHERE id = r.id AND status = r.status AND NOT insured;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    CONTINUE WHEN v_rows = 0;

    IF v_cover > 0 THEN PERFORM adjust_balance(r.user_id, v_cover, 'insurance_bug_payout', r.id); END IF;
    IF v_refund > 0 THEN PERFORM adjust_balance(r.user_id, v_refund, 'insurance_bug_refund', r.id); END IF;
  END LOOP;
END $$;

COMMIT;
