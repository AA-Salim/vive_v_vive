-- Phase 10: Royal Warrants (stacking bounties) and the Pillory (the shame board, cheap and loud).
-- Run AFTER phase10_foundation.sql. Additive and idempotent: safe to run (and re-run) while the previous app
-- version is live. The legacy bounties table, its resolve_bounties() function and the legacy shame_entries
-- inserts keep working exactly as before.
--
-- Royal Warrants (mirrored in lib/bounties/rules.ts)
--   * Anyone can price a player's head: 20+ points per pledge, at most 500 per backer on one warrant.
--     Pledges on the same target stack on a single open warrant.
--   * The wanted player loses a game: the linked members of the team that beat them split the whole price
--     equally (leftover points go to the first hunters in lane order). Nobody linked on that team: it stays up.
--   * The wanted player wins: an escape. The warrant stays up and the Crown adds 15% of the pledges
--     (5 to 25 per escape, the Crown never adds more than the pledges themselves).
--   * A warrant lives 7 days after its last pledge. Unclaimed at the deadline: every backer gets their pledge
--     back and the Crown's bonus returns to the treasury.
--   * Only a game recorded after the warrant opened can settle it, a game settles a warrant at most once, and
--     only inside that game's declaration (by the user declaring it).
--   * A wanted player deleted from the roster: every backer gets their pledge back.
--   * Legacy bounties (one poster, 1.5x back to the poster) keep their terms; expired ones are refunded.
--
-- The Pillory
--   * 40 points nails a player to the wall for 24 hours with their worst real stat and a roast.
--   * One live entry per target, one post per shamer every 6 hours.
--   * Eggs are free, one per person per entry; each keeps the entry up one more hour (12 at most).
--   * The Tribunal's Inter verdict pillories the voted player for free, once per vote.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.vvv_add_to_realtime(text)') IS NULL THEN
    RAISE EXCEPTION 'Run supabase/phase10_foundation.sql before supabase/phase10_bounties-shame.sql';
  END IF;
END $$;

-- Repeated from the foundation so this file never depends on the old reason CHECK list.
ALTER TABLE point_transactions DROP CONSTRAINT IF EXISTS point_transactions_reason_check;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'point_transactions_reason_format') THEN
    ALTER TABLE point_transactions ADD CONSTRAINT point_transactions_reason_format
      CHECK (reason ~ '^[a-z][a-z0-9_]{1,48}$');
  END IF;
END $$;

-- ============================================================
-- RULES
-- ============================================================

CREATE OR REPLACE FUNCTION bounty_rules() RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'min_pledge', 20,
    'max_backer_total', 500,
    'lifetime_days', 7,
    'escape_pct', 15,
    'escape_min', 5,
    'escape_max', 25,
    'debt_floor', -300
  )
$$;

CREATE OR REPLACE FUNCTION pillory_rules() RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'cost', 40,
    'hours', 24,
    'cooldown_hours', 6,
    'message_max', 140,
    'egg_hours', 1,
    'egg_max_hours', 12,
    'debt_floor', -300
  )
$$;

-- The account behind a player: their own link first, then a profile that claimed them.
CREATE OR REPLACE FUNCTION vvv_bounty_account(p_player_id UUID) RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT auth_user_id FROM players WHERE id = p_player_id),
    (SELECT id FROM user_profiles WHERE player_id = p_player_id ORDER BY created_at LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION vvv_bounty_is_self(p_user_id UUID, p_player_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user_id IS NOT NULL AND p_player_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM players WHERE id = p_player_id AND auth_user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = p_user_id AND player_id = p_player_id)
  )
$$;

-- Every writer of a target's warrant takes this lock before any balance or warrant row, so pledges, the
-- expiry sweep and settlement serialize per target instead of racing on its warrant.
CREATE OR REPLACE FUNCTION vvv_bounty_lock_key(p_player_id UUID) RETURNS BIGINT
LANGUAGE sql IMMUTABLE AS $$
  SELECT hashtextextended('vvv_bounty:' || p_player_id::text, 0)
$$;

-- ============================================================
-- WARRANT TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS bounty_warrants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'expired')),
  pledged INTEGER NOT NULL DEFAULT 0 CHECK (pledged >= 0),
  crown_bonus INTEGER NOT NULL DEFAULT 0 CHECK (crown_bonus >= 0),
  escapes INTEGER NOT NULL DEFAULT 0 CHECK (escapes >= 0),
  opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_pledge_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  claimed_session_id UUID REFERENCES game_sessions(id) ON DELETE SET NULL,
  payout INTEGER NOT NULL DEFAULT 0 CHECK (payout >= 0),
  hunters JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bounty_warrants_one_open ON bounty_warrants(target_player_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_bounty_warrants_expiry ON bounty_warrants(expires_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_bounty_warrants_closed ON bounty_warrants(closed_at DESC) WHERE status <> 'open';

CREATE TABLE IF NOT EXISTS bounty_pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warrant_id UUID NOT NULL REFERENCES bounty_warrants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pledged' CHECK (status IN ('pledged', 'paid_out', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (warrant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bounty_pledges_user ON bounty_pledges(user_id, created_at DESC);

-- One row per warrant and settled game: makes settlement idempotent and keeps the chase history.
CREATE TABLE IF NOT EXISTS bounty_outcomes (
  warrant_id UUID NOT NULL REFERENCES bounty_warrants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('claimed', 'escaped', 'unclaimed')),
  bonus INTEGER NOT NULL DEFAULT 0 CHECK (bonus >= 0),
  payout INTEGER NOT NULL DEFAULT 0 CHECK (payout >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (warrant_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_bounty_outcomes_session ON bounty_outcomes(session_id);

ALTER TABLE bounty_warrants ENABLE ROW LEVEL SECURITY;
ALTER TABLE bounty_pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE bounty_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bounty_warrants_read" ON bounty_warrants;
CREATE POLICY "bounty_warrants_read" ON bounty_warrants FOR SELECT USING (true);
DROP POLICY IF EXISTS "bounty_pledges_read" ON bounty_pledges;
CREATE POLICY "bounty_pledges_read" ON bounty_pledges FOR SELECT USING (true);
DROP POLICY IF EXISTS "bounty_outcomes_read" ON bounty_outcomes;
CREATE POLICY "bounty_outcomes_read" ON bounty_outcomes FOR SELECT USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON bounty_warrants, bounty_pledges, bounty_outcomes FROM anon, authenticated;

-- Deleting a wanted player from the roster cascades to their warrant: every backer gets their pledge back first.
CREATE OR REPLACE FUNCTION vvv_bounty_refund_on_delete() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pledge RECORD;
BEGIN
  IF OLD.status = 'open' THEN
    FOR v_pledge IN
      SELECT user_id, amount FROM bounty_pledges WHERE warrant_id = OLD.id AND status = 'pledged' ORDER BY created_at
    LOOP
      IF EXISTS (SELECT 1 FROM point_balances WHERE user_id = v_pledge.user_id) THEN
        PERFORM adjust_balance(v_pledge.user_id, v_pledge.amount, 'bounty_expired_refund', OLD.id);
      END IF;
    END LOOP;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_bounty_warrants_refund ON bounty_warrants;
CREATE TRIGGER trg_bounty_warrants_refund BEFORE DELETE ON bounty_warrants
  FOR EACH ROW EXECUTE FUNCTION vvv_bounty_refund_on_delete();

-- ============================================================
-- PLEDGE (open a warrant or add to the open one)
-- ============================================================

-- Closes one open warrant at its deadline: every backer gets their pledge back. Internal.
CREATE OR REPLACE FUNCTION vvv_bounty_expire(p_warrant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_warrant bounty_warrants%ROWTYPE;
  v_pledge bounty_pledges%ROWTYPE;
  v_refunded INTEGER := 0;
  v_backers INTEGER := 0;
BEGIN
  SELECT * INTO v_warrant FROM bounty_warrants WHERE id = p_warrant_id FOR UPDATE;
  IF NOT FOUND OR v_warrant.status <> 'open' OR v_warrant.expires_at > now() THEN
    RETURN NULL;
  END IF;

  FOR v_pledge IN
    SELECT * FROM bounty_pledges WHERE warrant_id = p_warrant_id AND status = 'pledged' ORDER BY created_at FOR UPDATE
  LOOP
    UPDATE bounty_pledges SET status = 'refunded', updated_at = now() WHERE id = v_pledge.id;
    -- A treasury that no longer exists must not block every later sweep.
    IF EXISTS (SELECT 1 FROM point_balances WHERE user_id = v_pledge.user_id) THEN
      PERFORM adjust_balance(v_pledge.user_id, v_pledge.amount, 'bounty_expired_refund', p_warrant_id);
      v_refunded := v_refunded + v_pledge.amount;
      v_backers := v_backers + 1;
    END IF;
  END LOOP;

  UPDATE bounty_warrants SET status = 'expired', closed_at = now() WHERE id = p_warrant_id;

  RETURN jsonb_build_object(
    'warrant_id', p_warrant_id,
    'target_player_id', v_warrant.target_player_id,
    'target_name', (SELECT name FROM players WHERE id = v_warrant.target_player_id),
    'target_user_id', vvv_bounty_account(v_warrant.target_player_id),
    'refunded', v_refunded,
    'backers', v_backers,
    'escapes', v_warrant.escapes
  );
END;
$$;

CREATE OR REPLACE FUNCTION bounty_pledge(p_target_player_id UUID, p_amount INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_rules JSONB := bounty_rules();
  v_target players%ROWTYPE;
  v_balance INTEGER;
  v_warrant bounty_warrants%ROWTYPE;
  v_created BOOLEAN := false;
  v_mine INTEGER := 0;
  v_expired JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'bounty:not_authenticated'; END IF;
  IF p_amount IS NULL OR p_amount < (v_rules->>'min_pledge')::INT THEN RAISE EXCEPTION 'bounty:amount_too_small'; END IF;
  IF p_amount > (v_rules->>'max_backer_total')::INT THEN RAISE EXCEPTION 'bounty:amount_too_large'; END IF;

  SELECT * INTO v_target FROM players WHERE id = p_target_player_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'bounty:target_not_found'; END IF;
  IF NOT v_target.is_active THEN RAISE EXCEPTION 'bounty:target_inactive'; END IF;
  IF vvv_bounty_is_self(v_uid, p_target_player_id) THEN RAISE EXCEPTION 'bounty:self'; END IF;

  -- Serializes every pledge on this target (two first pledges cannot open two warrants).
  PERFORM pg_advisory_xact_lock(vvv_bounty_lock_key(p_target_player_id));

  -- Locking the balance first serializes concurrent requests from the same user.
  SELECT balance INTO v_balance FROM point_balances WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bounty:no_balance'; END IF;
  IF v_balance - p_amount < (v_rules->>'debt_floor')::INT THEN RAISE EXCEPTION 'bounty:debt_limit'; END IF;

  SELECT * INTO v_warrant FROM bounty_warrants
  WHERE target_player_id = p_target_player_id AND status = 'open'
  FOR UPDATE;

  IF FOUND AND v_warrant.expires_at <= now() THEN
    v_expired := vvv_bounty_expire(v_warrant.id);
    SELECT balance INTO v_balance FROM point_balances WHERE user_id = v_uid;
    v_warrant := NULL;
  END IF;

  IF v_warrant.id IS NULL THEN
    INSERT INTO bounty_warrants (target_player_id, opened_by, expires_at)
    VALUES (p_target_player_id, v_uid, now() + make_interval(days => (v_rules->>'lifetime_days')::INT))
    RETURNING * INTO v_warrant;
    v_created := true;
  END IF;

  SELECT amount INTO v_mine FROM bounty_pledges WHERE warrant_id = v_warrant.id AND user_id = v_uid FOR UPDATE;
  v_mine := COALESCE(v_mine, 0);
  IF v_mine + p_amount > (v_rules->>'max_backer_total')::INT THEN RAISE EXCEPTION 'bounty:backer_cap'; END IF;

  INSERT INTO bounty_pledges (warrant_id, user_id, amount)
  VALUES (v_warrant.id, v_uid, p_amount)
  ON CONFLICT (warrant_id, user_id)
  DO UPDATE SET amount = bounty_pledges.amount + EXCLUDED.amount, updated_at = now();

  UPDATE bounty_warrants
  SET pledged = pledged + p_amount,
      last_pledge_at = now(),
      expires_at = GREATEST(expires_at, now() + make_interval(days => (v_rules->>'lifetime_days')::INT))
  WHERE id = v_warrant.id
  RETURNING * INTO v_warrant;

  PERFORM adjust_balance(v_uid, -p_amount, 'bounty_placed', v_warrant.id);

  RETURN jsonb_build_object(
    'warrant', to_jsonb(v_warrant),
    'created', v_created,
    'pledged', p_amount,
    'mine', v_mine + p_amount,
    'price', v_warrant.pledged + v_warrant.crown_bonus,
    'backers', (SELECT count(*) FROM bounty_pledges WHERE warrant_id = v_warrant.id),
    'target_name', v_target.name,
    'target_user_id', vvv_bounty_account(p_target_player_id),
    'balance', v_balance - p_amount,
    'expired', v_expired
  );
END;
$$;

-- ============================================================
-- EXPIRY SWEEP (lazy: run by any read of the board)
-- ============================================================

CREATE OR REPLACE FUNCTION bounty_sweep() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
  v_target UUID;
  v_result JSONB;
  v_expired JSONB := '[]'::jsonb;
  v_legacy RECORD;
  v_legacy_count INTEGER := 0;
BEGIN
  FOR v_id, v_target IN
    SELECT id, target_player_id FROM bounty_warrants
    WHERE status = 'open' AND expires_at <= now()
    ORDER BY expires_at
    LIMIT 25
  LOOP
    -- Busy target: a pledge or a settlement is on it right now; the next read sweeps it.
    CONTINUE WHEN NOT pg_try_advisory_xact_lock(vvv_bounty_lock_key(v_target));
    v_result := vvv_bounty_expire(v_id);
    IF v_result IS NOT NULL THEN v_expired := v_expired || jsonb_build_array(v_result); END IF;
  END LOOP;

  -- Legacy bounties never refunded at their deadline; they promised to expire, so they return the stake.
  FOR v_legacy IN
    SELECT * FROM bounties
    WHERE status = 'active' AND expires_at <= now()
    ORDER BY expires_at
    LIMIT 25
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE bounties SET status = 'expired' WHERE id = v_legacy.id AND status = 'active';
    IF FOUND AND EXISTS (SELECT 1 FROM point_balances WHERE user_id = v_legacy.poster_user_id) THEN
      PERFORM adjust_balance(v_legacy.poster_user_id, v_legacy.amount, 'bounty_expired_refund', v_legacy.id);
      v_legacy_count := v_legacy_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('expired', v_expired, 'legacy_refunded', v_legacy_count);
END;
$$;

-- ============================================================
-- SETTLEMENT (declare_winner hook; idempotent, derived only from the recorded game)
-- ============================================================

CREATE OR REPLACE FUNCTION bounty_settle_session(p_session_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rules JSONB := bounty_rules();
  v_session game_sessions%ROWTYPE;
  v_game games%ROWTYPE;
  v_row RECORD;
  v_warrant bounty_warrants%ROWTYPE;
  v_hunters JSONB;
  v_count INTEGER;
  v_pot INTEGER;
  v_share INTEGER;
  v_extra INTEGER;
  v_amount INTEGER;
  v_hunter JSONB;
  v_index INTEGER;
  v_paid JSONB;
  v_bonus INTEGER;
  v_claimed JSONB := '[]'::jsonb;
  v_escaped JSONB := '[]'::jsonb;
  v_unclaimed JSONB := '[]'::jsonb;
  v_legacy_claimed JSONB := '[]'::jsonb;
  v_legacy_failed INTEGER := 0;
  v_payout INTEGER;
  v_target UUID;
BEGIN
  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('settled', false, 'reason', 'session_not_found'); END IF;
  -- Only inside a declaration (game linked, status still in_game: it flips last) and only for the user holding
  -- it, so nobody can replay an old game later to collect a warrant that has grown since.
  IF v_session.game_id IS NULL OR v_session.status <> 'in_game' THEN
    RETURN jsonb_build_object('settled', false, 'reason', 'no_game');
  END IF;
  IF auth.uid() IS NOT NULL AND v_session.resolved_by IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('settled', false, 'reason', 'not_resolver');
  END IF;

  SELECT * INTO v_game FROM games WHERE id = v_session.game_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('settled', false, 'reason', 'no_game'); END IF;

  -- Target locks first, in a fixed order, before any balance moves.
  FOR v_target IN
    SELECT DISTINCT w.target_player_id
    FROM bounty_warrants w
    JOIN game_players gp ON gp.game_id = v_game.id AND gp.player_id = w.target_player_id
    WHERE w.status = 'open'
    ORDER BY 1
  LOOP
    PERFORM pg_advisory_xact_lock(vvv_bounty_lock_key(v_target));
  END LOOP;

  FOR v_row IN
    SELECT w.id, gp.side AS target_side
    FROM bounty_warrants w
    JOIN game_players gp ON gp.game_id = v_game.id AND gp.player_id = w.target_player_id
    WHERE w.status = 'open'
      AND w.opened_at < v_game.played_at
      AND NOT EXISTS (SELECT 1 FROM bounty_outcomes o WHERE o.warrant_id = w.id AND o.session_id = p_session_id)
    ORDER BY w.opened_at
  LOOP
    SELECT * INTO v_warrant FROM bounty_warrants WHERE id = v_row.id FOR UPDATE;
    CONTINUE WHEN v_warrant.status <> 'open'
      OR EXISTS (SELECT 1 FROM bounty_outcomes o WHERE o.warrant_id = v_warrant.id AND o.session_id = p_session_id);

    IF v_row.target_side = v_game.winner_side THEN
      v_bonus := LEAST(
        GREATEST((v_rules->>'escape_min')::INT, FLOOR(v_warrant.pledged::NUMERIC * (v_rules->>'escape_pct')::INT / 100)::INT),
        (v_rules->>'escape_max')::INT,
        GREATEST(v_warrant.pledged - v_warrant.crown_bonus, 0)
      );
      UPDATE bounty_warrants SET escapes = escapes + 1, crown_bonus = crown_bonus + v_bonus
      WHERE id = v_warrant.id
      RETURNING * INTO v_warrant;
      INSERT INTO bounty_outcomes (warrant_id, session_id, outcome, bonus) VALUES (v_warrant.id, p_session_id, 'escaped', v_bonus);
      v_escaped := v_escaped || jsonb_build_array(jsonb_build_object(
        'warrant_id', v_warrant.id,
        'target_player_id', v_warrant.target_player_id,
        'target_name', (SELECT name FROM players WHERE id = v_warrant.target_player_id),
        'target_user_id', vvv_bounty_account(v_warrant.target_player_id),
        'bonus', v_bonus,
        'price', v_warrant.pledged + v_warrant.crown_bonus,
        'escapes', v_warrant.escapes
      ));
      CONTINUE;
    END IF;

    -- The wanted player lost: every linked winner with a treasury is a hunter.
    SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', h.user_id, 'player_id', h.player_id, 'name', h.name) ORDER BY h.lane_rank, h.name), '[]'::jsonb)
    INTO v_hunters
    FROM (
      SELECT DISTINCT ON (a.user_id) a.user_id, a.player_id, a.name, a.lane_rank
      FROM (
        SELECT vvv_bounty_account(gp.player_id) AS user_id, gp.player_id, p.name,
               COALESCE(array_position(ARRAY['top', 'jungle', 'mid', 'adc', 'support'], gp.lane), 9) AS lane_rank
        FROM game_players gp
        JOIN players p ON p.id = gp.player_id
        WHERE gp.game_id = v_game.id AND gp.side = v_game.winner_side
      ) a
      WHERE a.user_id IS NOT NULL AND EXISTS (SELECT 1 FROM point_balances pb WHERE pb.user_id = a.user_id)
      ORDER BY a.user_id, a.lane_rank
    ) h;

    v_count := jsonb_array_length(v_hunters);
    v_pot := v_warrant.pledged + v_warrant.crown_bonus;

    IF v_count = 0 OR v_pot <= 0 THEN
      INSERT INTO bounty_outcomes (warrant_id, session_id, outcome) VALUES (v_warrant.id, p_session_id, 'unclaimed');
      v_unclaimed := v_unclaimed || jsonb_build_array(jsonb_build_object(
        'warrant_id', v_warrant.id,
        'target_name', (SELECT name FROM players WHERE id = v_warrant.target_player_id),
        'price', v_pot
      ));
      CONTINUE;
    END IF;

    v_share := v_pot / v_count;
    v_extra := v_pot - v_share * v_count;
    v_paid := '[]'::jsonb;
    v_index := 0;
    FOR v_hunter IN SELECT value FROM jsonb_array_elements(v_hunters) LOOP
      v_amount := v_share + CASE WHEN v_index < v_extra THEN 1 ELSE 0 END;
      IF v_amount > 0 THEN
        PERFORM adjust_balance((v_hunter->>'user_id')::UUID, v_amount, 'bounty_claimed', p_session_id);
      END IF;
      v_paid := v_paid || jsonb_build_array(v_hunter || jsonb_build_object('share', v_amount));
      v_index := v_index + 1;
    END LOOP;

    UPDATE bounty_pledges SET status = 'paid_out', updated_at = now() WHERE warrant_id = v_warrant.id AND status = 'pledged';
    UPDATE bounty_warrants
    SET status = 'claimed', closed_at = now(), claimed_session_id = p_session_id, payout = v_pot, hunters = v_paid
    WHERE id = v_warrant.id;
    INSERT INTO bounty_outcomes (warrant_id, session_id, outcome, payout) VALUES (v_warrant.id, p_session_id, 'claimed', v_pot);

    v_claimed := v_claimed || jsonb_build_array(jsonb_build_object(
      'warrant_id', v_warrant.id,
      'target_player_id', v_warrant.target_player_id,
      'target_name', (SELECT name FROM players WHERE id = v_warrant.target_player_id),
      'target_user_id', vvv_bounty_account(v_warrant.target_player_id),
      'payout', v_pot,
      'escapes', v_warrant.escapes,
      'backers', (SELECT count(*) FROM bounty_pledges WHERE warrant_id = v_warrant.id),
      'hunters', v_paid
    ));
  END LOOP;

  -- Legacy bounties keep the terms they were posted with (the same as resolve_bounties).
  FOR v_row IN
    SELECT b.id, b.poster_user_id, b.amount, b.payout_multiplier, b.target_player_id, gp.side AS target_side
    FROM bounties b
    JOIN game_players gp ON gp.game_id = v_game.id AND gp.player_id = b.target_player_id
    WHERE b.status = 'active' AND b.expires_at > now() AND b.created_at < v_game.played_at
    ORDER BY b.created_at
    FOR UPDATE OF b
  LOOP
    IF v_row.target_side = v_game.winner_side THEN
      UPDATE bounties SET status = 'failed', resolved_session_id = p_session_id WHERE id = v_row.id;
      v_legacy_failed := v_legacy_failed + 1;
    ELSE
      v_payout := FLOOR(v_row.amount * v_row.payout_multiplier)::INT;
      UPDATE bounties SET status = 'claimed', resolved_session_id = p_session_id WHERE id = v_row.id;
      PERFORM adjust_balance(v_row.poster_user_id, v_payout, 'bounty_claimed', p_session_id);
      v_legacy_claimed := v_legacy_claimed || jsonb_build_array(jsonb_build_object(
        'bounty_id', v_row.id,
        'target_player_id', v_row.target_player_id,
        'target_name', (SELECT name FROM players WHERE id = v_row.target_player_id),
        'target_user_id', vvv_bounty_account(v_row.target_player_id),
        'poster_user_id', v_row.poster_user_id,
        'payout', v_payout
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'settled', true,
    'winner', v_game.winner_side,
    'claimed', v_claimed,
    'escaped', v_escaped,
    'unclaimed', v_unclaimed,
    'legacy_claimed', v_legacy_claimed,
    'legacy_failed', v_legacy_failed
  );
END;
$$;

-- ============================================================
-- PILLORY (extends shame_entries; legacy rows read as before)
-- ============================================================

ALTER TABLE shame_entries ALTER COLUMN shamer_user_id DROP NOT NULL;
ALTER TABLE shame_entries ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user';
ALTER TABLE shame_entries ADD COLUMN IF NOT EXISTS cost INTEGER;
ALTER TABLE shame_entries ADD COLUMN IF NOT EXISTS vote_session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE;
ALTER TABLE shame_entries ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE shame_entries ADD COLUMN IF NOT EXISTS eggs INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shame_entries ADD COLUMN IF NOT EXISTS extended_hours INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shame_entries_source_check' AND conrelid = 'public.shame_entries'::regclass) THEN
    ALTER TABLE shame_entries ADD CONSTRAINT shame_entries_source_check CHECK (
      source IN ('user', 'tribunal')
      AND (source = 'tribunal' OR shamer_user_id IS NOT NULL)
      AND (source = 'user' OR vote_session_id IS NOT NULL)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shame_entries_counters_check' AND conrelid = 'public.shame_entries'::regclass) THEN
    ALTER TABLE shame_entries ADD CONSTRAINT shame_entries_counters_check CHECK (
      eggs >= 0 AND extended_hours >= 0 AND (cost IS NULL OR cost >= 0) AND jsonb_typeof(details) = 'object'
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shame_entries_tribunal ON shame_entries(vote_session_id, target_player_id) WHERE vote_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shame_entries_shamer ON shame_entries(shamer_user_id, created_at DESC);

-- The legacy route inserts directly (shame_insert, 48 hours): such a row can never forge a Tribunal decree,
-- counters or a paid marker, nor stay on the wall longer than the legacy board allowed.
DROP POLICY IF EXISTS "shame_insert_user_only" ON shame_entries;
CREATE POLICY "shame_insert_user_only" ON shame_entries AS RESTRICTIVE FOR INSERT
  WITH CHECK (
    source = 'user' AND vote_session_id IS NULL AND eggs = 0 AND extended_hours = 0
    AND cost IS NULL AND details = '{}'::jsonb AND expires_at <= now() + interval '49 hours'
  );

CREATE TABLE IF NOT EXISTS shame_eggs (
  entry_id UUID NOT NULL REFERENCES shame_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shame_eggs_user ON shame_eggs(user_id, created_at DESC);

ALTER TABLE shame_eggs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shame_eggs_read" ON shame_eggs;
CREATE POLICY "shame_eggs_read" ON shame_eggs FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON shame_eggs FROM anon, authenticated;

-- Stat text is computed by the server route from real games; it is display-only, so it is only bounded here.
CREATE OR REPLACE FUNCTION pillory_post(
  p_target_player_id UUID,
  p_message TEXT,
  p_stat_label TEXT,
  p_stat_value TEXT,
  p_recent_losses JSONB DEFAULT '[]'::jsonb,
  p_details JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_rules JSONB := pillory_rules();
  v_cost INTEGER := (v_rules->>'cost')::INT;
  v_message TEXT := btrim(COALESCE(p_message, ''));
  v_target players%ROWTYPE;
  v_balance INTEGER;
  v_last TIMESTAMPTZ;
  v_entry shame_entries%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'pillory:not_authenticated'; END IF;
  IF char_length(v_message) = 0 THEN RAISE EXCEPTION 'pillory:message_required'; END IF;
  IF char_length(v_message) > (v_rules->>'message_max')::INT THEN RAISE EXCEPTION 'pillory:message_too_long'; END IF;

  SELECT * INTO v_target FROM players WHERE id = p_target_player_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'pillory:target_not_found'; END IF;
  IF vvv_bounty_is_self(v_uid, p_target_player_id) THEN RAISE EXCEPTION 'pillory:self'; END IF;

  SELECT balance INTO v_balance FROM point_balances WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pillory:no_balance'; END IF;

  SELECT max(created_at) INTO v_last FROM shame_entries WHERE shamer_user_id = v_uid AND source = 'user';
  IF v_last IS NOT NULL AND v_last > now() - make_interval(hours => (v_rules->>'cooldown_hours')::INT) THEN
    RAISE EXCEPTION 'pillory:cooldown';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('vvv_pillory:' || p_target_player_id::text, 0));
  IF EXISTS (
    SELECT 1 FROM shame_entries
    WHERE target_player_id = p_target_player_id AND source = 'user' AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'pillory:already_pilloried';
  END IF;

  IF v_balance - v_cost < (v_rules->>'debt_floor')::INT THEN RAISE EXCEPTION 'pillory:debt_limit'; END IF;

  INSERT INTO shame_entries (
    shamer_user_id, target_player_id, message, worst_stat_label, worst_stat_value, recent_losses,
    expires_at, source, cost, details
  ) VALUES (
    v_uid,
    p_target_player_id,
    v_message,
    left(COALESCE(NULLIF(btrim(p_stat_label), ''), 'Crimes'), 60),
    left(COALESCE(NULLIF(btrim(p_stat_value), ''), 'Unspeakable'), 60),
    CASE WHEN jsonb_typeof(p_recent_losses) = 'array' AND octet_length(p_recent_losses::text) <= 2048 THEN p_recent_losses ELSE '[]'::jsonb END,
    now() + make_interval(hours => (v_rules->>'hours')::INT),
    'user',
    v_cost,
    CASE WHEN jsonb_typeof(p_details) = 'object' AND octet_length(p_details::text) <= 2048 THEN p_details ELSE '{}'::jsonb END
  )
  RETURNING * INTO v_entry;

  PERFORM adjust_balance(v_uid, -v_cost, 'shame_spent', v_entry.id);

  RETURN jsonb_build_object(
    'entry', to_jsonb(v_entry),
    'target_name', v_target.name,
    'target_user_id', vvv_bounty_account(p_target_player_id),
    'cost', v_cost,
    'balance', v_balance - v_cost
  );
END;
$$;

CREATE OR REPLACE FUNCTION pillory_throw_egg(p_entry_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_rules JSONB := pillory_rules();
  v_entry shame_entries%ROWTYPE;
  v_extend BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'pillory:not_authenticated'; END IF;

  SELECT * INTO v_entry FROM shame_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND OR v_entry.expires_at <= now() THEN RAISE EXCEPTION 'pillory:entry_gone'; END IF;
  IF vvv_bounty_is_self(v_uid, v_entry.target_player_id) THEN RAISE EXCEPTION 'pillory:own_egg'; END IF;

  INSERT INTO shame_eggs (entry_id, user_id) VALUES (p_entry_id, v_uid) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'pillory:already_thrown'; END IF;

  v_extend := v_entry.extended_hours + (v_rules->>'egg_hours')::INT <= (v_rules->>'egg_max_hours')::INT;
  UPDATE shame_entries
  SET eggs = eggs + 1,
      extended_hours = extended_hours + CASE WHEN v_extend THEN (v_rules->>'egg_hours')::INT ELSE 0 END,
      expires_at = expires_at + CASE WHEN v_extend THEN make_interval(hours => (v_rules->>'egg_hours')::INT) ELSE interval '0' END
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  RETURN jsonb_build_object(
    'entry_id', v_entry.id,
    'eggs', v_entry.eggs,
    'expires_at', v_entry.expires_at,
    'extended', v_extend,
    'target_name', (SELECT name FROM players WHERE id = v_entry.target_player_id),
    'target_user_id', vvv_bounty_account(v_entry.target_player_id)
  );
END;
$$;

-- Lazy (any read of the wall): every settled Tribunal vote with an Inter verdict pillories the voted players
-- once, free, for 24 hours from the verdict. Works whether or not the prophecy-vote migration exists yet.
CREATE OR REPLACE FUNCTION pillory_sync_tribunal() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rules JSONB := pillory_rules();
  v_vote RECORD;
  v_player UUID;
  v_votes INTEGER;
  v_ballots INTEGER;
  v_line RECORD;
  v_id UUID;
  v_created JSONB := '[]'::jsonb;
BEGIN
  IF to_regclass('public.post_game_votes') IS NULL THEN
    RETURN v_created;
  END IF;

  FOR v_vote IN
    SELECT v.session_id, v.game_id, v.winner_side, v.settled_at, v.inter_player_ids, v.summary
    FROM post_game_votes v
    WHERE v.status = 'settled'
      AND cardinality(v.inter_player_ids) > 0
      AND v.settled_at > now() - make_interval(hours => (v_rules->>'hours')::INT)
      AND EXISTS (
        SELECT 1 FROM unnest(v.inter_player_ids) AS ip(player_id)
        WHERE EXISTS (SELECT 1 FROM players p WHERE p.id = ip.player_id)
          AND NOT EXISTS (
            SELECT 1 FROM shame_entries s WHERE s.vote_session_id = v.session_id AND s.target_player_id = ip.player_id
          )
      )
    ORDER BY v.settled_at
    LIMIT 10
  LOOP
    v_ballots := COALESCE((v_vote.summary->'inter'->>'ballots')::INT, 0);
    FOREACH v_player IN ARRAY v_vote.inter_player_ids LOOP
      CONTINUE WHEN NOT EXISTS (SELECT 1 FROM players WHERE id = v_player);
      v_votes := COALESCE((v_vote.summary->'inter'->'tallies'->>(v_player::text))::INT, 0);
      SELECT gp.champion, gp.lane, gp.side INTO v_line
      FROM game_players gp WHERE gp.game_id = v_vote.game_id AND gp.player_id = v_player LIMIT 1;

      v_id := NULL;
      INSERT INTO shame_entries (
        shamer_user_id, target_player_id, message, worst_stat_label, worst_stat_value, recent_losses,
        expires_at, source, cost, vote_session_id, details
      ) VALUES (
        NULL,
        v_player,
        '',
        'Voted Inter by the Tribunal',
        CASE WHEN v_ballots > 0 THEN v_votes || ' of ' || v_ballots || ' ballots' ELSE v_votes || ' votes' END,
        '[]'::jsonb,
        v_vote.settled_at + make_interval(hours => (v_rules->>'hours')::INT),
        'tribunal',
        0,
        v_vote.session_id,
        jsonb_strip_nulls(jsonb_build_object(
          'votes', v_votes,
          'ballots', v_ballots,
          'champion', v_line.champion,
          'lane', v_line.lane,
          'side', v_line.side,
          'won', CASE WHEN v_line.side IS NULL OR v_vote.winner_side IS NULL THEN NULL ELSE v_line.side = v_vote.winner_side END,
          'shared', cardinality(v_vote.inter_player_ids) > 1
        ))
      )
      ON CONFLICT (vote_session_id, target_player_id) WHERE vote_session_id IS NOT NULL DO NOTHING
      RETURNING id INTO v_id;

      IF v_id IS NOT NULL THEN
        v_created := v_created || jsonb_build_array(jsonb_build_object(
          'entry_id', v_id,
          'session_id', v_vote.session_id,
          'target_player_id', v_player,
          'target_name', (SELECT name FROM players WHERE id = v_player),
          'target_user_id', vvv_bounty_account(v_player),
          'votes', v_votes,
          'ballots', v_ballots
        ));
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_created;
END;
$$;

-- ============================================================
-- PRIVILEGES
-- ============================================================

REVOKE EXECUTE ON FUNCTION vvv_bounty_account(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_bounty_is_self(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_bounty_expire(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_bounty_lock_key(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_bounty_refund_on_delete() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION bounty_pledge(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bounty_pledge(UUID, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION bounty_settle_session(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bounty_settle_session(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION bounty_sweep() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bounty_sweep() TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION pillory_post(UUID, TEXT, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pillory_post(UUID, TEXT, TEXT, TEXT, JSONB, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION pillory_throw_egg(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pillory_throw_egg(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION pillory_sync_tribunal() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pillory_sync_tribunal() TO anon, authenticated;

-- ============================================================
-- REALTIME
-- ============================================================

SELECT vvv_add_to_realtime('bounty_warrants');
SELECT vvv_add_to_realtime('bounties');
SELECT vvv_add_to_realtime('shame_entries');

COMMIT;
