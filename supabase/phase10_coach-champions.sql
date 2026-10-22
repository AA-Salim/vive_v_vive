-- Phase 10: coach champions. Once the coaches lock their teams and lanes, they pick every champion themselves
-- in League draft order (Blue 1, Red 2, Blue 2, Red 2, Blue 2, Red 1) instead of a random deal.
-- Additive and idempotent: safe to run (and re-run) while the previous app version is deployed. Every write
-- happens inside the SECURITY DEFINER functions below, so it works with and without phase11_lockdown.sql.
-- Run after supabase/phase10_lobby.sql. Without this file the app keeps dealing champions at random.

DO $$
BEGIN
  IF to_regprocedure('vvv_add_to_realtime(text)') IS NULL OR to_regclass('public.coach_draft_picks') IS NULL THEN
    RAISE EXCEPTION 'Run supabase/phase10_foundation.sql and supabase/phase10_lobby.sql before supabase/phase10_coach-champions.sql';
  END IF;
END $$;

-- ============================================================
-- Schema
-- ============================================================

-- champion_draft_at: when the teams were locked and champion select opened (NULL while players are drafted).
-- champion_turn_ends_at: server deadline of the pick on the clock (NULL once all ten are picked).
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS champion_draft_at TIMESTAMPTZ;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS champion_turn_ends_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS coach_champion_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  pick_number INTEGER NOT NULL CHECK (pick_number BETWEEN 1 AND 10),
  side TEXT NOT NULL CHECK (side IN ('blue', 'red')),
  player_id UUID NOT NULL REFERENCES players(id),
  lane TEXT NOT NULL CHECK (lane IN ('top', 'jungle', 'mid', 'adc', 'support')),
  champion TEXT NOT NULL,
  champion_internal TEXT NOT NULL,
  -- The coach who picked; NULL when the clock ran out and the server picked.
  picked_by UUID,
  auto BOOLEAN NOT NULL DEFAULT false,
  requested BOOLEAN NOT NULL DEFAULT false,
  fearless_override BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, pick_number),
  UNIQUE (session_id, player_id),
  UNIQUE (session_id, champion)
);

-- One pinned wish per player ("I want Ahri"), shown to their own coach and team only.
CREATE TABLE IF NOT EXISTS coach_champion_requests (
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  champion TEXT NOT NULL,
  champion_internal TEXT NOT NULL,
  requested_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, player_id)
);

ALTER TABLE coach_champion_picks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_champion_picks_read" ON coach_champion_picks;
CREATE POLICY "coach_champion_picks_read" ON coach_champion_picks FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON coach_champion_picks FROM anon, authenticated;

ALTER TABLE coach_champion_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_champion_requests_read" ON coach_champion_requests;
CREATE POLICY "coach_champion_requests_read" ON coach_champion_requests FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM coach_draft_picks p
    JOIN game_sessions s ON s.id = p.session_id
    WHERE p.session_id = coach_champion_requests.session_id
      AND p.player_id = coach_champion_requests.player_id
      AND (
        auth.uid() = CASE p.side WHEN 'blue' THEN s.blue_coach_id ELSE s.red_coach_id END
        OR EXISTS (
          SELECT 1 FROM coach_draft_picks mate JOIN players pl ON pl.id = mate.player_id
          WHERE mate.session_id = p.session_id AND mate.side = p.side AND pl.auth_user_id = auth.uid()
        )
      )
  )
);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON coach_champion_requests FROM anon, authenticated;

-- Picks land with a game_sessions update (already published); requests need their own feed.
SELECT vvv_add_to_realtime('coach_champion_requests');

-- ============================================================
-- Helpers (owner only)
-- ============================================================

-- League draft order: B1 R1 R2 B2 B3 R3 R4 B4 B5 R5.
CREATE OR REPLACE FUNCTION coach_champion_side(p_pick_number INTEGER)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (ARRAY['blue', 'red', 'red', 'blue', 'blue', 'red', 'red', 'blue', 'blue', 'red'])[p_pick_number]
$$;

CREATE OR REPLACE FUNCTION coach_champion_clock() RETURNS INTERVAL
LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT interval '30 seconds' $$;

-- A pick sent in the last moments still counts: the auto-pick only fires once this slack is gone too.
CREATE OR REPLACE FUNCTION coach_champion_grace() RETURNS INTERVAL
LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT interval '2 seconds' $$;

CREATE OR REPLACE FUNCTION coach_champion_coach(p_session game_sessions, p_side TEXT) RETURNS UUID
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE p_side WHEN 'blue' THEN p_session.blue_coach_id WHEN 'red' THEN p_session.red_coach_id END
$$;

-- Why a champion cannot be picked in this game right now, or NULL when it can.
CREATE OR REPLACE FUNCTION coach_champion_blocked(p_session_id UUID, p_champion TEXT) RETURNS TEXT
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM coach_champion_picks c WHERE c.session_id = p_session_id AND c.champion = p_champion)
      THEN 'champion_taken'
    WHEN EXISTS (
      SELECT 1 FROM daily_fearless df WHERE df.date = (now() AT TIME ZONE 'utc')::date AND df.champion_name = p_champion
    ) THEN 'fearless_banned'
  END
$$;

CREATE OR REPLACE FUNCTION coach_champion_pick_json(p_pick coach_champion_picks) RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pick_number', p_pick.pick_number,
    'side', p_pick.side,
    'player_id', p_pick.player_id,
    'player_name', pl.name,
    'player_user_id', pl.auth_user_id,
    'lane', p_pick.lane,
    'champion', p_pick.champion,
    'champion_internal', p_pick.champion_internal,
    'picked_by', p_pick.picked_by,
    'auto', p_pick.auto,
    'requested', p_pick.requested,
    'fearless_override', p_pick.fearless_override
  )
  FROM players pl WHERE pl.id = p_pick.player_id
$$;

-- Runs after every pick, with the session row locked: either hands the clock to the next coach, or, after the
-- tenth pick, seats all ten with their champions (locked: no re-roll touches a coach's pick), opens the normal
-- draft and spends the ten queue spots. updated_at moves with every pick so open clients refetch.
CREATE OR REPLACE FUNCTION coach_champions_advance(p_session game_sessions) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
  v_next TEXT;
  v_ends TIMESTAMPTZ;
  v_dequeued INTEGER := 0;
BEGIN
  SELECT count(*) INTO v_count FROM coach_champion_picks WHERE session_id = p_session.id;

  IF v_count < 10 THEN
    v_next := coach_champion_side(v_count + 1);
    v_ends := now() + coach_champion_clock();
    UPDATE game_sessions
    SET draft_turn = v_next, champion_turn_ends_at = v_ends, updated_at = now()
    WHERE id = p_session.id;
    RETURN jsonb_build_object(
      'completed', false,
      'next_side', v_next,
      'next_coach_id', coach_champion_coach(p_session, v_next),
      'turn_ends_at', v_ends,
      'dequeued', 0
    );
  END IF;

  IF EXISTS (SELECT 1 FROM session_assignments WHERE session_id = p_session.id) THEN
    RAISE EXCEPTION 'coachdraft:stale';
  END IF;

  INSERT INTO session_assignments (session_id, player_id, side, lane, champion, champion_internal, locked, fearless_override)
  SELECT c.session_id, c.player_id, c.side, c.lane, c.champion, c.champion_internal, true, c.fearless_override
  FROM coach_champion_picks c
  WHERE c.session_id = p_session.id;

  UPDATE game_sessions
  SET status = 'draft', draft_turn = NULL, champion_turn_ends_at = NULL, updated_at = now()
  WHERE id = p_session.id;

  DELETE FROM player_queue WHERE player_id IN (SELECT player_id FROM coach_champion_picks WHERE session_id = p_session.id);
  GET DIAGNOSTICS v_dequeued = ROW_COUNT;

  RETURN jsonb_build_object('completed', true, 'next_side', NULL, 'next_coach_id', NULL, 'turn_ends_at', NULL, 'dequeued', v_dequeued);
END;
$$;

-- The clock ran out: lock a champion for the first open lane of the side on the clock. The player's pinned
-- request wins when it is still available, then a random champion from their lane pool, then any champion,
-- and only if every one of those is gone, a fearless-banned one from the lane (flagged as an override).
CREATE OR REPLACE FUNCTION coach_champions_autopick(p_session game_sessions) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
  v_side TEXT;
  v_slot coach_draft_picks%ROWTYPE;
  v_name TEXT;
  v_internal TEXT;
  v_requested BOOLEAN := false;
  v_override BOOLEAN := false;
  v_today DATE := (now() AT TIME ZONE 'utc')::date;
  v_pick coach_champion_picks%ROWTYPE;
BEGIN
  SELECT count(*) INTO v_count FROM coach_champion_picks WHERE session_id = p_session.id;
  IF v_count >= 10 THEN RAISE EXCEPTION 'coachdraft:draft_full'; END IF;
  v_side := coach_champion_side(v_count + 1);

  SELECT d.* INTO v_slot
  FROM coach_draft_picks d
  WHERE d.session_id = p_session.id AND d.side = v_side
    AND NOT EXISTS (SELECT 1 FROM coach_champion_picks c WHERE c.session_id = d.session_id AND c.player_id = d.player_id)
  ORDER BY array_position(ARRAY['top', 'jungle', 'mid', 'adc', 'support'], d.lane), d.pick_number
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:stale'; END IF;

  SELECT r.champion, r.champion_internal INTO v_name, v_internal
  FROM coach_champion_requests r
  WHERE r.session_id = p_session.id AND r.player_id = v_slot.player_id
    AND coach_champion_blocked(p_session.id, r.champion) IS NULL;
  v_requested := FOUND;

  IF NOT v_requested THEN
    SELECT cr.name, cr.internal_name INTO v_name, v_internal
    FROM champion_roles cr
    WHERE cr.role = v_slot.lane AND coach_champion_blocked(p_session.id, cr.name) IS NULL
    ORDER BY random()
    LIMIT 1;
  END IF;
  IF v_name IS NULL THEN
    SELECT cr.name, cr.internal_name INTO v_name, v_internal
    FROM champion_roles cr
    WHERE coach_champion_blocked(p_session.id, cr.name) IS NULL
    ORDER BY random()
    LIMIT 1;
  END IF;
  IF v_name IS NULL THEN
    SELECT cr.name, cr.internal_name INTO v_name, v_internal
    FROM champion_roles cr
    WHERE cr.role = v_slot.lane
      AND NOT EXISTS (SELECT 1 FROM coach_champion_picks c WHERE c.session_id = p_session.id AND c.champion = cr.name)
    ORDER BY random()
    LIMIT 1;
    v_override := v_name IS NOT NULL AND EXISTS (
      SELECT 1 FROM daily_fearless df WHERE df.date = v_today AND df.champion_name = v_name
    );
  END IF;
  IF v_name IS NULL THEN RAISE EXCEPTION 'coachdraft:no_champions'; END IF;

  INSERT INTO coach_champion_picks
    (session_id, pick_number, side, player_id, lane, champion, champion_internal, picked_by, auto, requested, fearless_override)
  VALUES
    (p_session.id, v_count + 1, v_side, v_slot.player_id, v_slot.lane, v_name, v_internal, NULL, true, v_requested, v_override)
  RETURNING * INTO v_pick;

  RETURN coach_champion_pick_json(v_pick) || coach_champions_advance(p_session);
END;
$$;

REVOKE EXECUTE ON FUNCTION coach_champion_side(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION coach_champion_clock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION coach_champion_grace() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION coach_champion_coach(game_sessions, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION coach_champion_blocked(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION coach_champion_pick_json(coach_champion_picks) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION coach_champions_advance(game_sessions) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION coach_champions_autopick(game_sessions) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Entry points
-- ============================================================

-- Locks both teams and opens champion select, Blue on the clock. Either coach or an admin; p_version is the
-- draft version the caller saw (game_sessions.updated_at), so a lane change in flight makes the lock retry.
CREATE OR REPLACE FUNCTION coach_champions_open(p_session_id UUID, p_version TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_total INTEGER;
  v_blue INTEGER;
  v_missing INTEGER;
  v_lanes INTEGER;
  v_ends TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'coachdraft:not_authenticated'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:session_not_found'; END IF;
  IF v_uid IS DISTINCT FROM v_session.blue_coach_id AND v_uid IS DISTINCT FROM v_session.red_coach_id
     AND NOT EXISTS (SELECT 1 FROM players WHERE auth_user_id = v_uid AND is_admin) THEN
    RAISE EXCEPTION 'coachdraft:not_a_coach';
  END IF;
  IF v_session.status <> 'coach_draft' THEN RAISE EXCEPTION 'coachdraft:not_drafting'; END IF;

  IF v_session.champion_draft_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'opened', false,
      'turn_side', v_session.draft_turn,
      'turn_ends_at', v_session.champion_turn_ends_at,
      'next_coach_id', coach_champion_coach(v_session, v_session.draft_turn)
    );
  END IF;
  IF p_version IS NOT NULL AND v_session.updated_at IS DISTINCT FROM p_version THEN
    RAISE EXCEPTION 'coachdraft:stale';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE side = 'blue'), count(*) FILTER (WHERE lane IS NULL),
         count(DISTINCT (side, lane)) FILTER (WHERE lane IS NOT NULL)
  INTO v_total, v_blue, v_missing, v_lanes
  FROM coach_draft_picks WHERE session_id = p_session_id;
  IF v_total <> 10 OR v_blue <> 5 THEN RAISE EXCEPTION 'coachdraft:picks_missing'; END IF;
  IF v_missing > 0 THEN RAISE EXCEPTION 'coachdraft:lanes_missing'; END IF;
  IF v_lanes <> 10 THEN RAISE EXCEPTION 'coachdraft:lane_clash'; END IF;

  v_ends := now() + coach_champion_clock();
  UPDATE game_sessions
  SET champion_draft_at = now(), champion_turn_ends_at = v_ends, draft_turn = coach_champion_side(1), updated_at = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'opened', true,
    'turn_side', coach_champion_side(1),
    'turn_ends_at', v_ends,
    'next_coach_id', coach_champion_coach(v_session, coach_champion_side(1))
  );
END;
$$;

-- One champion for one of the caller's players, on the caller's turn. p_pick_number is the pick the caller
-- believes is on the clock: a retry of a pick that already landed returns it again instead of failing.
CREATE OR REPLACE FUNCTION coach_champion_pick(p_session_id UUID, p_player_id UUID, p_champion TEXT, p_pick_number INTEGER DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_existing coach_champion_picks%ROWTYPE;
  v_slot coach_draft_picks%ROWTYPE;
  v_count INTEGER;
  v_side TEXT;
  v_name TEXT;
  v_internal TEXT;
  v_blocked TEXT;
  v_pick coach_champion_picks%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'coachdraft:not_authenticated'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:session_not_found'; END IF;

  IF p_pick_number IS NOT NULL THEN
    SELECT * INTO v_existing FROM coach_champion_picks WHERE session_id = p_session_id AND pick_number = p_pick_number;
    IF FOUND AND v_existing.player_id = p_player_id AND v_existing.picked_by = v_uid
       AND (lower(v_existing.champion) = lower(p_champion) OR lower(v_existing.champion_internal) = lower(p_champion)) THEN
      RETURN coach_champion_pick_json(v_existing) || jsonb_build_object(
        'replayed', true,
        'completed', v_session.status <> 'coach_draft',
        'next_side', CASE WHEN v_session.status = 'coach_draft' THEN v_session.draft_turn END,
        'next_coach_id', CASE WHEN v_session.status = 'coach_draft' THEN coach_champion_coach(v_session, v_session.draft_turn) END,
        'turn_ends_at', v_session.champion_turn_ends_at,
        'dequeued', 0
      );
    END IF;
  END IF;

  IF v_uid IS DISTINCT FROM v_session.blue_coach_id AND v_uid IS DISTINCT FROM v_session.red_coach_id THEN
    RAISE EXCEPTION 'coachdraft:not_a_coach';
  END IF;
  IF v_session.status <> 'coach_draft' THEN RAISE EXCEPTION 'coachdraft:not_drafting'; END IF;
  IF v_session.champion_draft_at IS NULL THEN RAISE EXCEPTION 'coachdraft:champions_closed'; END IF;

  SELECT count(*) INTO v_count FROM coach_champion_picks WHERE session_id = p_session_id;
  IF v_count >= 10 THEN RAISE EXCEPTION 'coachdraft:draft_full'; END IF;
  IF p_pick_number IS NOT NULL AND p_pick_number <> v_count + 1 THEN RAISE EXCEPTION 'coachdraft:stale'; END IF;
  IF v_session.champion_turn_ends_at IS NOT NULL AND now() >= v_session.champion_turn_ends_at + coach_champion_grace() THEN
    RAISE EXCEPTION 'coachdraft:turn_expired';
  END IF;

  v_side := coach_champion_side(v_count + 1);
  IF coach_champion_coach(v_session, v_side) IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'coachdraft:not_your_turn'; END IF;

  SELECT * INTO v_slot FROM coach_draft_picks WHERE session_id = p_session_id AND player_id = p_player_id;
  IF NOT FOUND OR v_slot.side <> v_side THEN RAISE EXCEPTION 'coachdraft:not_your_player'; END IF;
  IF EXISTS (SELECT 1 FROM coach_champion_picks WHERE session_id = p_session_id AND player_id = p_player_id) THEN
    RAISE EXCEPTION 'coachdraft:player_has_champion';
  END IF;

  SELECT cr.name, cr.internal_name INTO v_name, v_internal
  FROM champion_roles cr
  WHERE lower(cr.name) = lower(btrim(p_champion)) OR lower(cr.internal_name) = lower(btrim(p_champion))
  ORDER BY (cr.name = btrim(p_champion)) DESC
  LIMIT 1;
  IF v_name IS NULL THEN RAISE EXCEPTION 'coachdraft:unknown_champion'; END IF;

  v_blocked := coach_champion_blocked(p_session_id, v_name);
  IF v_blocked IS NOT NULL THEN RAISE EXCEPTION 'coachdraft:%', v_blocked; END IF;

  INSERT INTO coach_champion_picks
    (session_id, pick_number, side, player_id, lane, champion, champion_internal, picked_by, auto, requested)
  VALUES (
    p_session_id, v_count + 1, v_side, p_player_id, v_slot.lane, v_name, v_internal, v_uid, false,
    EXISTS (SELECT 1 FROM coach_champion_requests r WHERE r.session_id = p_session_id AND r.player_id = p_player_id AND r.champion = v_name)
  )
  RETURNING * INTO v_pick;

  RETURN coach_champion_pick_json(v_pick) || jsonb_build_object('replayed', false) || coach_champions_advance(v_session);
END;
$$;

-- Takes back the latest champion. Only the coach who picked it, only until the next pick lands (an expired
-- clock counts as landed), and never an auto-pick. The undoing coach gets a fresh clock.
CREATE OR REPLACE FUNCTION coach_champion_undo(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_last coach_champion_picks%ROWTYPE;
  v_ends TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'coachdraft:not_authenticated'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:session_not_found'; END IF;
  IF v_session.status <> 'coach_draft' THEN RAISE EXCEPTION 'coachdraft:not_drafting'; END IF;
  IF v_session.champion_draft_at IS NULL THEN RAISE EXCEPTION 'coachdraft:champions_closed'; END IF;

  SELECT * INTO v_last FROM coach_champion_picks WHERE session_id = p_session_id ORDER BY pick_number DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:nothing_to_undo'; END IF;
  IF v_last.auto THEN RAISE EXCEPTION 'coachdraft:auto_pick_final'; END IF;
  IF v_last.picked_by IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'coachdraft:not_your_pick'; END IF;
  IF v_session.champion_turn_ends_at IS NOT NULL AND now() >= v_session.champion_turn_ends_at + coach_champion_grace() THEN
    RAISE EXCEPTION 'coachdraft:turn_expired';
  END IF;

  v_result := coach_champion_pick_json(v_last);
  DELETE FROM coach_champion_picks WHERE id = v_last.id;

  v_ends := now() + coach_champion_clock();
  UPDATE game_sessions SET draft_turn = v_last.side, champion_turn_ends_at = v_ends, updated_at = now() WHERE id = p_session_id;

  RETURN v_result || jsonb_build_object(
    'turn_ends_at', v_ends,
    'other_coach_id', coach_champion_coach(v_session, CASE v_last.side WHEN 'blue' THEN 'red' ELSE 'blue' END)
  );
END;
$$;

-- The caller pins (or, with NULL, clears) the champion they want. Players drafted into this game only, until
-- their own champion is picked. No points involved.
CREATE OR REPLACE FUNCTION coach_champion_request(p_session_id UUID, p_champion TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_player players%ROWTYPE;
  v_slot coach_draft_picks%ROWTYPE;
  v_name TEXT;
  v_internal TEXT;
  v_blocked TEXT;
  v_previous TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'coachdraft:not_authenticated'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:session_not_found'; END IF;
  IF v_session.status <> 'coach_draft' THEN RAISE EXCEPTION 'coachdraft:not_drafting'; END IF;

  SELECT * INTO v_player FROM players WHERE auth_user_id = v_uid LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:not_in_draft'; END IF;
  SELECT * INTO v_slot FROM coach_draft_picks WHERE session_id = p_session_id AND player_id = v_player.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:not_in_draft'; END IF;
  IF EXISTS (SELECT 1 FROM coach_champion_picks WHERE session_id = p_session_id AND player_id = v_player.id) THEN
    RAISE EXCEPTION 'coachdraft:player_has_champion';
  END IF;

  SELECT champion INTO v_previous FROM coach_champion_requests WHERE session_id = p_session_id AND player_id = v_player.id;

  IF p_champion IS NULL OR btrim(p_champion) = '' THEN
    DELETE FROM coach_champion_requests WHERE session_id = p_session_id AND player_id = v_player.id;
  ELSE
    SELECT cr.name, cr.internal_name INTO v_name, v_internal
    FROM champion_roles cr
    WHERE lower(cr.name) = lower(btrim(p_champion)) OR lower(cr.internal_name) = lower(btrim(p_champion))
    ORDER BY (cr.name = btrim(p_champion)) DESC
    LIMIT 1;
    IF v_name IS NULL THEN RAISE EXCEPTION 'coachdraft:unknown_champion'; END IF;
    v_blocked := coach_champion_blocked(p_session_id, v_name);
    IF v_blocked IS NOT NULL THEN RAISE EXCEPTION 'coachdraft:%', v_blocked; END IF;

    INSERT INTO coach_champion_requests (session_id, player_id, champion, champion_internal, requested_by, updated_at)
    VALUES (p_session_id, v_player.id, v_name, v_internal, v_uid, now())
    ON CONFLICT (session_id, player_id)
    DO UPDATE SET champion = EXCLUDED.champion, champion_internal = EXCLUDED.champion_internal,
                  requested_by = EXCLUDED.requested_by, updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'player_id', v_player.id,
    'player_name', v_player.name,
    'side', v_slot.side,
    'champion', v_name,
    'champion_internal', v_internal,
    'previous', v_previous,
    'changed', v_previous IS DISTINCT FROM v_name,
    'coach_id', coach_champion_coach(v_session, v_slot.side)
  );
END;
$$;

-- Lazy clock: any read past the deadline (plus the grace) auto-picks once. Cheap when nothing is due, so every
-- client can call it on every refresh. Returns the auto-pick, or NULL.
CREATE OR REPLACE FUNCTION coach_champions_tick(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id;
  IF NOT FOUND OR v_session.status <> 'coach_draft' OR v_session.champion_draft_at IS NULL
     OR v_session.champion_turn_ends_at IS NULL OR now() < v_session.champion_turn_ends_at + coach_champion_grace() THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_session.status <> 'coach_draft' OR v_session.champion_draft_at IS NULL
     OR v_session.champion_turn_ends_at IS NULL OR now() < v_session.champion_turn_ends_at + coach_champion_grace() THEN
    RETURN NULL;
  END IF;

  RETURN coach_champions_autopick(v_session);
END;
$$;

REVOKE EXECUTE ON FUNCTION coach_champions_open(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION coach_champions_open(UUID, TIMESTAMPTZ) TO authenticated;
REVOKE EXECUTE ON FUNCTION coach_champion_pick(UUID, UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION coach_champion_pick(UUID, UUID, TEXT, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION coach_champion_undo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION coach_champion_undo(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION coach_champion_request(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION coach_champion_request(UUID, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION coach_champions_tick(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coach_champions_tick(UUID) TO anon, authenticated;

-- ============================================================
-- Guards. Clients keep their direct writes on these tables (the lobby still makes them); these only refuse
-- what would bypass champion select. Functions run as the owner and pass, except the freeze on the teams.
-- ============================================================

-- The champion clock is the server's, and a game in champion select reaches the draft through its last pick.
CREATE OR REPLACE FUNCTION vvv_coach_champions_session_guard() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.champion_draft_at IS NOT NULL OR NEW.champion_turn_ends_at IS NOT NULL THEN
      RAISE EXCEPTION 'coachdraft:champions_locked' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.champion_draft_at IS DISTINCT FROM OLD.champion_draft_at
     OR NEW.champion_turn_ends_at IS DISTINCT FROM OLD.champion_turn_ends_at
     OR (OLD.status = 'coach_draft' AND OLD.champion_draft_at IS NOT NULL AND NEW.status = 'draft') THEN
    RAISE EXCEPTION 'coachdraft:champions_locked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Once the teams are locked, nobody (the old player undo and lane functions included) reshuffles them.
CREATE OR REPLACE FUNCTION vvv_coach_draft_picks_freeze() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_sessions UUID[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_sessions := ARRAY[NEW.session_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_sessions := ARRAY[OLD.session_id];
  ELSE
    v_sessions := ARRAY[OLD.session_id, NEW.session_id];
  END IF;
  IF EXISTS (SELECT 1 FROM game_sessions WHERE id = ANY (v_sessions) AND champion_draft_at IS NOT NULL) THEN
    RAISE EXCEPTION 'coachdraft:teams_locked' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- A seat holding its coach's pick keeps that champion and its lock against client writes (re-rolls, unlocks).
-- Decrees still change it: they run inside chaos_issue_decree().
CREATE OR REPLACE FUNCTION vvv_coach_champion_seats_guard() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF (NEW.champion IS DISTINCT FROM OLD.champion
      OR NEW.champion_internal IS DISTINCT FROM OLD.champion_internal
      OR (OLD.locked AND NOT NEW.locked))
     AND EXISTS (
       SELECT 1 FROM coach_champion_picks c
       WHERE c.session_id = OLD.session_id AND c.player_id = OLD.player_id AND c.champion = OLD.champion
     ) THEN
    RAISE EXCEPTION 'coachdraft:coach_pick_locked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION vvv_coach_champions_session_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_coach_draft_picks_freeze() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_coach_champion_seats_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vvv_coach_champions_session_guard ON game_sessions;
CREATE TRIGGER vvv_coach_champions_session_guard
  BEFORE INSERT OR UPDATE ON game_sessions
  FOR EACH ROW EXECUTE FUNCTION vvv_coach_champions_session_guard();

DROP TRIGGER IF EXISTS vvv_coach_draft_picks_freeze ON coach_draft_picks;
CREATE TRIGGER vvv_coach_draft_picks_freeze
  BEFORE INSERT OR UPDATE OR DELETE ON coach_draft_picks
  FOR EACH ROW EXECUTE FUNCTION vvv_coach_draft_picks_freeze();

DROP TRIGGER IF EXISTS vvv_coach_champion_seats_guard ON session_assignments;
CREATE TRIGGER vvv_coach_champion_seats_guard
  BEFORE UPDATE ON session_assignments
  FOR EACH ROW EXECUTE FUNCTION vvv_coach_champion_seats_guard();

NOTIFY pgrst, 'reload schema';
