-- Phase 10: hardening. Guarded functions for every money move and players write the app still makes as the user.
--
-- Run order: deploy the new app first, then every other phase10_*.sql file, then this one, and only once the
-- site works with all of them, supabase/phase11_lockdown.sql.
--
-- Additive and idempotent: this file only creates functions and one guard table and pins the search_path of
-- the legacy money functions, so it is safe while either the previous or the new app version is live. The new
-- app calls these functions first and falls back to its old direct writes while they are missing; phase11 then
-- closes the old doors (adjust_balance and the legacy settle functions, client writes on players).
--
-- Every callable function: SECURITY DEFINER, search_path pinned, caller taken from auth.uid() (never from an
-- argument), inputs validated, safe to call twice, executable by signed-in users only. The vvv_* helpers are
-- internal and revoked from every client role.
--
-- Errors are raised as '<domain>:<code>' messages the app maps to its own copy. "Already claimed" errors use
-- SQLSTATE 23505 so the existing duplicate handling keeps working.

-- ============================================================
-- LEGACY MONEY FUNCTIONS: pin the search_path (behavior unchanged)
-- ============================================================

DO $$
DECLARE
  v_fn TEXT;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'adjust_balance(uuid, integer, text, uuid)',
    'claim_daily_bonus(uuid)',
    'resolve_bets(uuid, text)',
    'refund_all_bets(uuid)',
    'resolve_chaos_wagers(uuid, text)',
    'refund_chaos_actions(uuid)',
    'resolve_bounties(uuid, uuid[])'
  ] LOOP
    IF to_regprocedure(v_fn) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', v_fn);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- HELPERS (internal)
-- ============================================================

CREATE OR REPLACE FUNCTION vvv_is_admin(p_user_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM players WHERE auth_user_id = p_user_id AND is_admin)
$$;

-- Same value as consolationRef() in lib/lore/reward-claims.ts: a stable UUID per act for the consolation marker.
CREATE OR REPLACE FUNCTION vvv_consolation_ref(p_act_id INTEGER) RETURNS UUID
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  WITH h AS (SELECT encode(sha256(convert_to('vvv:consolation:' || p_act_id::TEXT, 'UTF8')), 'hex') AS hex)
  SELECT (
    substr(hex, 1, 8) || '-' || substr(hex, 9, 4) || '-5' || substr(hex, 14, 3) || '-'
    || lpad(to_hex((('x' || substr(hex, 17, 2))::BIT(8)::INTEGER & 63) | 128), 2, '0')
    || substr(hex, 19, 2) || '-' || substr(hex, 21, 12)
  )::UUID
  FROM h
$$;

-- Roster names: what PlayerNameSchema accepts (trimmed, 1..24 characters, no control characters).
CREATE OR REPLACE FUNCTION vvv_roster_name(p_name TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE
  v_name TEXT := btrim(coalesce(p_name, ''));
BEGIN
  IF v_name = '' OR char_length(v_name) > 24 OR v_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'roster:invalid_name';
  END IF;
  RETURN v_name;
END;
$$;

CREATE OR REPLACE FUNCTION vvv_player_json(p_player players) RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'id', p_player.id,
    'name', p_player.name,
    'is_active', p_player.is_active,
    'is_admin', p_player.is_admin,
    'wins', p_player.wins,
    'losses', p_player.losses,
    'games_played', p_player.games_played,
    'created_at', p_player.created_at,
    'auth_user_id', p_player.auth_user_id
  )
$$;

-- ============================================================
-- GAME RESULTS: counters and +10 / +2 exactly once per game
-- ============================================================

-- One row per recorded game. Not tied to games or sessions by foreign key on purpose: deleting either can never
-- free a game to be counted again.
CREATE TABLE IF NOT EXISTS game_outcome_records (
  game_id UUID PRIMARY KEY,
  session_id UUID NOT NULL UNIQUE,
  winner_side TEXT NOT NULL CHECK (winner_side IN ('blue', 'red')),
  counted BOOLEAN NOT NULL,
  credited INTEGER NOT NULL DEFAULT 0,
  recorded_by UUID,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE game_outcome_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "game_outcome_records_read" ON game_outcome_records;
CREATE POLICY "game_outcome_records_read" ON game_outcome_records FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON game_outcome_records FROM anon, authenticated;

-- Called by the declare flow (lib/session/resolve.ts) once the game row is linked and before the status flips.
-- Writes the game_players seats, bumps wins/losses/games_played and pays every linked player with a treasury
-- (game_win +10, game_participation +2, reference_id = session id), all in one transaction. A second call for the
-- same session or game is a no-op, so the two minute retry of a dead declaration can never count twice.
-- When an earlier app version already wrote the seats, it also moved the counters: only missing points are paid.
CREATE OR REPLACE FUNCTION record_game_outcome(p_session_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_game games%ROWTYPE;
  v_record game_outcome_records%ROWTYPE;
  v_seats INTEGER;
  v_sides INTEGER;
  v_counted BOOLEAN := false;
  v_credited INTEGER := 0;
  v_seat RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'game:not_authenticated'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'game:session_not_found'; END IF;

  -- The claimant who runs the game (creator, or anyone on a creatorless game), or an admin.
  IF NOT COALESCE(
    vvv_is_admin(v_uid)
    OR (v_session.resolved_by = v_uid AND (v_session.created_by IS NULL OR v_session.created_by = v_uid)),
    false
  ) THEN
    RAISE EXCEPTION 'game:forbidden';
  END IF;

  SELECT * INTO v_record FROM game_outcome_records WHERE session_id = p_session_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'recorded', false, 'already', true, 'game_id', v_record.game_id,
      'winner_side', v_record.winner_side, 'counted', v_record.counted, 'credited', 0
    );
  END IF;

  IF v_session.status <> 'in_game' THEN RAISE EXCEPTION 'game:not_in_game'; END IF;
  IF v_session.game_id IS NULL THEN RAISE EXCEPTION 'game:not_linked'; END IF;

  SELECT * INTO v_game FROM games WHERE id = v_session.game_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'game:not_linked'; END IF;
  -- A rematch has the same ten players: an older game row can never be recorded for a newer session.
  IF v_game.played_at < v_session.created_at THEN RAISE EXCEPTION 'game:game_mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM game_outcome_records WHERE game_id = v_game.id) THEN
    RAISE EXCEPTION 'game:game_already_recorded';
  END IF;

  SELECT count(*), count(DISTINCT side) INTO v_seats, v_sides FROM session_assignments WHERE session_id = p_session_id;
  IF v_seats < 2 OR v_seats > 10 OR v_sides <> 2 THEN RAISE EXCEPTION 'game:invalid_roster'; END IF;

  IF NOT EXISTS (SELECT 1 FROM game_players WHERE game_id = v_game.id) THEN
    INSERT INTO game_players (game_id, player_id, side, lane, champion)
    SELECT v_game.id, sa.player_id, sa.side, sa.lane, sa.champion
    FROM session_assignments sa
    WHERE sa.session_id = p_session_id;

    UPDATE players p SET
      wins = p.wins + CASE WHEN sa.side = v_game.winner_side THEN 1 ELSE 0 END,
      losses = p.losses + CASE WHEN sa.side = v_game.winner_side THEN 0 ELSE 1 END,
      games_played = p.games_played + 1
    FROM session_assignments sa
    WHERE sa.session_id = p_session_id AND sa.player_id = p.id;
    v_counted := true;
  END IF;

  FOR v_seat IN
    SELECT DISTINCT ON (p.auth_user_id) p.auth_user_id AS user_id, sa.side
    FROM session_assignments sa
    JOIN players p ON p.id = sa.player_id
    WHERE sa.session_id = p_session_id
      AND p.auth_user_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM point_balances b WHERE b.user_id = p.auth_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM point_transactions t
        WHERE t.user_id = p.auth_user_id AND t.reference_id = p_session_id
          AND t.reason IN ('game_win', 'game_participation')
      )
    ORDER BY p.auth_user_id
  LOOP
    IF v_seat.side = v_game.winner_side THEN
      PERFORM adjust_balance(v_seat.user_id, 10, 'game_win', p_session_id);
    ELSE
      PERFORM adjust_balance(v_seat.user_id, 2, 'game_participation', p_session_id);
    END IF;
    v_credited := v_credited + 1;
  END LOOP;

  INSERT INTO game_outcome_records (game_id, session_id, winner_side, counted, credited, recorded_by)
  VALUES (v_game.id, p_session_id, v_game.winner_side, v_counted, v_credited, v_uid);

  RETURN jsonb_build_object(
    'recorded', true, 'already', false, 'game_id', v_game.id,
    'winner_side', v_game.winner_side, 'counted', v_counted, 'credited', v_credited
  );
END;
$$;

-- ============================================================
-- ACT REWARDS (app/api/acts/claim-rewards)
-- ============================================================

-- Pays the caller's own act award once. The act_carryover row (reference_id = award id) is the claim marker,
-- also guarded by idx_point_transactions_act_carryover_once from phase10_storytelling.sql.
CREATE OR REPLACE FUNCTION claim_act_award(p_award_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_award act_awards%ROWTYPE;
  v_bonus INTEGER;
  v_balance INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'award:not_authenticated'; END IF;

  SELECT * INTO v_award FROM act_awards WHERE id = p_award_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'award:not_found'; END IF;

  IF EXISTS (
    SELECT 1 FROM point_transactions
    WHERE user_id = v_uid AND reason = 'act_carryover' AND reference_id = v_award.id
  ) THEN
    RAISE EXCEPTION 'award:already_claimed' USING ERRCODE = '23505';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM point_balances WHERE user_id = v_uid) THEN RAISE EXCEPTION 'award:no_balance'; END IF;

  v_bonus := GREATEST(COALESCE(v_award.carry_over_bonus, 0), 0);
  v_balance := adjust_balance(v_uid, v_bonus, 'act_carryover', v_award.id);
  RETURN jsonb_build_object('award_id', v_award.id, 'title', v_award.title, 'bonus', v_bonus, 'balance', v_balance);
END;
$$;

-- Marks the caller's consolation title for an archived act they played without an award (no points move).
CREATE OR REPLACE FUNCTION claim_act_consolation(p_act_id INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ref UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'award:not_authenticated'; END IF;
  IF p_act_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM acts WHERE id = p_act_id AND status = 'archived')
     OR NOT EXISTS (SELECT 1 FROM act_snapshots WHERE act_id = p_act_id AND user_id = v_uid)
     OR EXISTS (SELECT 1 FROM act_awards WHERE act_id = p_act_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'award:not_eligible';
  END IF;

  v_ref := vvv_consolation_ref(p_act_id);
  PERFORM pg_advisory_xact_lock(hashtext('vvv_consolation:' || v_uid::TEXT));
  IF EXISTS (
    SELECT 1 FROM point_transactions WHERE user_id = v_uid AND reason = 'act_carryover' AND reference_id = v_ref
  ) THEN
    RAISE EXCEPTION 'award:already_claimed' USING ERRCODE = '23505';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM point_balances WHERE user_id = v_uid) THEN RAISE EXCEPTION 'award:no_balance'; END IF;

  PERFORM adjust_balance(v_uid, 0, 'act_carryover', v_ref);
  RETURN jsonb_build_object('act_id', p_act_id, 'reference', v_ref);
END;
$$;

-- Act awards hold claimable points: only an admin archiving an act writes them (app/api/admin/archive-act).
-- p_awards: [{ category, user_id, player_id, title, carry_over_bonus, final_value, perks }]. Existing categories
-- for the act are kept, like the old one-insert-per-award loop. Returns how many awards were written.
CREATE OR REPLACE FUNCTION admin_record_act_awards(p_act_id INTEGER, p_awards JSONB) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_item JSONB;
  v_bonus INTEGER;
  v_title TEXT;
  v_count INTEGER := 0;
  v_rows INTEGER;
BEGIN
  IF NOT vvv_is_admin(v_uid) THEN RAISE EXCEPTION 'award:forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM acts WHERE id = p_act_id) THEN RAISE EXCEPTION 'award:act_not_found'; END IF;
  IF p_awards IS NULL OR jsonb_typeof(p_awards) <> 'array' OR jsonb_array_length(p_awards) > 20 THEN
    RAISE EXCEPTION 'award:invalid';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_awards) LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN RAISE EXCEPTION 'award:invalid'; END IF;
    v_bonus := COALESCE((v_item->>'carry_over_bonus')::INTEGER, 0);
    v_title := btrim(coalesce(v_item->>'title', ''));
    IF v_bonus < 0 OR v_bonus > 1000 OR v_title = '' OR char_length(v_title) > 120
       OR (v_item ? 'perks' AND jsonb_typeof(v_item->'perks') <> 'object') THEN
      RAISE EXCEPTION 'award:invalid';
    END IF;

    INSERT INTO act_awards (act_id, user_id, player_id, category, title, carry_over_bonus, final_value, perks)
    VALUES (
      p_act_id,
      (v_item->>'user_id')::UUID,
      NULLIF(v_item->>'player_id', '')::UUID,
      v_item->>'category',
      v_title,
      v_bonus,
      left(v_item->>'final_value', 200),
      COALESCE(v_item->'perks', '{}'::jsonb)
    )
    ON CONFLICT (act_id, category) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_count := v_count + v_rows;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- NEW ACT / ECONOMY RESET (app/api/admin/reset-economy)
-- ============================================================

-- Opens the next act, resets every treasury to 0, grants the act's starting purse to everyone, and gives back the
-- carry-over bonuses of the previous act that were already claimed (the reset just wiped them). Unclaimed
-- bonuses stay claimable through the reward banner, so no bonus is ever paid twice.
CREATE OR REPLACE FUNCTION admin_reset_economy(
  p_name TEXT DEFAULT NULL,
  p_subtitle TEXT DEFAULT NULL,
  p_initial_grant INTEGER DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT := COALESCE(NULLIF(btrim(p_name), ''), 'Act II: The Fallen Crown');
  v_subtitle TEXT := COALESCE(NULLIF(btrim(p_subtitle), ''), 'The Fallen Crown');
  v_grant INTEGER := COALESCE(p_initial_grant, 100);
  v_previous acts%ROWTYPE;
  v_act acts%ROWTYPE;
  v_row RECORD;
  v_granted INTEGER := 0;
  v_carry INTEGER := 0;
  v_carry_points INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'economy:not_authenticated'; END IF;
  IF NOT vvv_is_admin(v_uid) THEN RAISE EXCEPTION 'economy:forbidden'; END IF;
  IF v_grant < 0 OR v_grant > 1000 THEN RAISE EXCEPTION 'economy:invalid_grant'; END IF;
  IF char_length(v_name) > 120 OR char_length(v_subtitle) > 120 THEN RAISE EXCEPTION 'economy:invalid_name'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('vvv_reset_economy'));
  IF EXISTS (SELECT 1 FROM acts WHERE status = 'active') THEN RAISE EXCEPTION 'economy:act_active'; END IF;

  SELECT * INTO v_previous FROM acts WHERE status = 'archived' ORDER BY act_number DESC LIMIT 1;

  INSERT INTO acts (act_number, name, subtitle, status, started_at, initial_grant)
  VALUES ((SELECT COALESCE(max(act_number), 0) + 1 FROM acts), v_name, v_subtitle, 'active', now(), v_grant)
  RETURNING * INTO v_act;

  UPDATE point_balances SET balance = 0, last_daily_claim = NULL, updated_at = now();

  FOR v_row IN SELECT user_id FROM point_balances ORDER BY user_id LOOP
    IF v_grant > 0 THEN
      PERFORM adjust_balance(v_row.user_id, v_grant, 'initial_grant', NULL);
    END IF;
    v_granted := v_granted + 1;
  END LOOP;

  IF v_previous.id IS NOT NULL THEN
    FOR v_row IN
      SELECT a.user_id, SUM(t.amount)::INTEGER AS amount
      FROM act_awards a
      JOIN point_transactions t
        ON t.user_id = a.user_id AND t.reason = 'act_carryover' AND t.reference_id = a.id AND t.amount > 0
      WHERE a.act_id = v_previous.id
        AND EXISTS (SELECT 1 FROM point_balances b WHERE b.user_id = a.user_id)
      GROUP BY a.user_id
      ORDER BY a.user_id
    LOOP
      PERFORM adjust_balance(v_row.user_id, v_row.amount, 'act_carryover', NULL);
      v_carry := v_carry + 1;
      v_carry_points := v_carry_points + v_row.amount;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'act', to_jsonb(v_act),
    'granted', v_granted,
    'initial_grant', v_grant,
    'carry_overs', v_carry,
    'carry_over_points', v_carry_points
  );
END;
$$;

-- ============================================================
-- POINTS: first treasury and the daily stipend for the caller only
-- ============================================================

-- app/api/points/initialize: opens the caller's treasury with the active act's starting purse (0..1000), once.
CREATE OR REPLACE FUNCTION init_my_point_balance() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_grant INTEGER;
  v_balance INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'points:not_authenticated'; END IF;

  SELECT initial_grant INTO v_grant FROM acts WHERE status = 'active' ORDER BY act_number DESC LIMIT 1;
  v_grant := LEAST(GREATEST(COALESCE(v_grant, 100), 0), 1000);

  INSERT INTO point_balances (user_id, balance) VALUES (v_uid, 0) ON CONFLICT (user_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('already_initialized', true);
  END IF;

  v_balance := CASE WHEN v_grant > 0 THEN adjust_balance(v_uid, v_grant, 'initial_grant', NULL) ELSE 0 END;
  RETURN jsonb_build_object('initialized', true, 'balance', v_balance);
END;
$$;

-- app/api/points/daily: the legacy claim_daily_bonus(p_user_id) lets anyone claim for anyone; this one only
-- claims for the caller. Same return value: the new balance, or -1 when today's stipend is already taken.
CREATE OR REPLACE FUNCTION claim_my_daily_bonus() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'points:not_authenticated'; END IF;
  RETURN claim_daily_bonus(v_uid);
END;
$$;

-- ============================================================
-- IDENTITY: claiming a player (app/api/auth/link-player)
-- ============================================================

-- Links the caller to an unclaimed player, and their profile to it. Refused when the player belongs to someone
-- else or the caller already answers to another player. Claiming your own player again is a no-op.
CREATE OR REPLACE FUNCTION claim_player(p_player_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_player players%ROWTYPE;
  v_profile_player UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'claim:not_authenticated'; END IF;

  -- One claim at a time per caller, so two tabs cannot each grab a different player.
  PERFORM pg_advisory_xact_lock(hashtext('vvv_claim_player:' || v_uid::TEXT));

  SELECT * INTO v_player FROM players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim:not_found'; END IF;
  IF v_player.auth_user_id IS NOT NULL AND v_player.auth_user_id <> v_uid THEN RAISE EXCEPTION 'claim:taken'; END IF;

  SELECT player_id INTO v_profile_player FROM user_profiles WHERE id = v_uid;
  IF EXISTS (SELECT 1 FROM players WHERE auth_user_id = v_uid AND id <> p_player_id)
     OR (v_profile_player IS NOT NULL AND v_profile_player <> p_player_id) THEN
    RAISE EXCEPTION 'claim:has_player';
  END IF;

  IF v_player.auth_user_id IS NULL THEN
    UPDATE players SET auth_user_id = v_uid WHERE id = p_player_id;
  END IF;
  UPDATE user_profiles SET player_id = p_player_id WHERE id = v_uid AND player_id IS DISTINCT FROM p_player_id;

  RETURN jsonb_build_object(
    'player_id', v_player.id,
    'name', v_player.name,
    'newly_claimed', v_player.auth_user_id IS NULL
  );
END;
$$;

-- ============================================================
-- ROSTER (app/api/players): admin only, same rules as the lobby routes
-- ============================================================

CREATE OR REPLACE FUNCTION admin_add_player(p_name TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_name TEXT;
  v_player players%ROWTYPE;
BEGIN
  IF NOT vvv_is_admin(auth.uid()) THEN RAISE EXCEPTION 'roster:forbidden'; END IF;
  v_name := vvv_roster_name(p_name);

  PERFORM pg_advisory_xact_lock(hashtext('vvv_roster'));
  IF EXISTS (SELECT 1 FROM players WHERE lower(btrim(name)) = lower(v_name)) THEN
    RAISE EXCEPTION 'roster:duplicate' USING ERRCODE = '23505';
  END IF;

  INSERT INTO players (name) VALUES (v_name) RETURNING * INTO v_player;
  RETURN vvv_player_json(v_player);
END;
$$;

-- Rename and/or bench / bring back. Benching also drops the player from the queue, like the route did.
CREATE OR REPLACE FUNCTION admin_update_player(
  p_player_id UUID,
  p_name TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_name TEXT;
  v_player players%ROWTYPE;
BEGIN
  IF NOT vvv_is_admin(auth.uid()) THEN RAISE EXCEPTION 'roster:forbidden'; END IF;
  IF p_name IS NULL AND p_is_active IS NULL THEN RAISE EXCEPTION 'roster:nothing_to_change'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('vvv_roster'));
  SELECT * INTO v_player FROM players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'roster:not_found'; END IF;

  IF p_name IS NOT NULL THEN
    v_name := vvv_roster_name(p_name);
    IF EXISTS (SELECT 1 FROM players WHERE id <> p_player_id AND lower(btrim(name)) = lower(v_name)) THEN
      RAISE EXCEPTION 'roster:duplicate' USING ERRCODE = '23505';
    END IF;
  END IF;

  UPDATE players
  SET name = COALESCE(v_name, name), is_active = COALESCE(p_is_active, is_active)
  WHERE id = p_player_id
  RETURNING * INTO v_player;

  IF p_is_active = false THEN
    DELETE FROM player_queue WHERE player_id = p_player_id;
  END IF;

  RETURN vvv_player_json(v_player);
END;
$$;

-- Only clean slates can go: unclaimed, no games, and nothing in any table that points at the player (the queue
-- aside). Deleting would cascade into game history, bounties and their escrow.
CREATE OR REPLACE FUNCTION admin_delete_player(p_player_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_player players%ROWTYPE;
  v_ref RECORD;
  v_found BOOLEAN;
BEGIN
  IF NOT vvv_is_admin(auth.uid()) THEN RAISE EXCEPTION 'roster:forbidden'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('vvv_roster'));
  SELECT * INTO v_player FROM players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'roster:not_found'; END IF;
  IF v_player.auth_user_id IS NOT NULL THEN RAISE EXCEPTION 'roster:claimed'; END IF;
  IF COALESCE(v_player.games_played, 0) > 0 THEN RAISE EXCEPTION 'roster:has_history'; END IF;

  FOR v_ref IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = 'public.players'::regclass AND cardinality(c.conkey) = 1
      AND c.conrelid <> 'public.player_queue'::regclass
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE %I = $1)', v_ref.tbl, v_ref.col) INTO v_found USING p_player_id;
    IF v_found THEN RAISE EXCEPTION 'roster:has_history'; END IF;
  END LOOP;

  DELETE FROM players WHERE id = p_player_id;
  RETURN jsonb_build_object('id', v_player.id, 'name', v_player.name);
END;
$$;

-- ============================================================
-- PRIVILEGES
-- ============================================================

REVOKE EXECUTE ON FUNCTION vvv_is_admin(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_consolation_ref(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_roster_name(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_player_json(players) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_fn TEXT;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'record_game_outcome(uuid)',
    'claim_act_award(uuid)',
    'claim_act_consolation(integer)',
    'admin_record_act_awards(integer, jsonb)',
    'admin_reset_economy(text, text, integer)',
    'init_my_point_balance()',
    'claim_my_daily_bonus()',
    'claim_player(uuid)',
    'admin_add_player(text)',
    'admin_update_player(uuid, text, boolean)',
    'admin_delete_player(uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', v_fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_fn);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
