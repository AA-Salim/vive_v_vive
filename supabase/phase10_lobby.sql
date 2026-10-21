-- Phase 10: lobby (roster, queue, winner-stays rotation, coach draft)
-- Additive and idempotent: safe to run (and re-run) while the previous app version is deployed.
-- Run after supabase/phase10_foundation.sql.

DO $$
BEGIN
  IF to_regprocedure('vvv_add_to_realtime(text)') IS NULL THEN
    RAISE EXCEPTION 'Run supabase/phase10_foundation.sql before supabase/phase10_lobby.sql';
  END IF;
END $$;

-- vainqueur_state is meant to be a single row, but nothing enforced it and duplicates exist: an unordered
-- "LIMIT 1" read then flips between rows after every update. Keep the most relevant row and lock it to one.
DELETE FROM vainqueur_state
WHERE id <> (
  SELECT id FROM vainqueur_state
  ORDER BY is_active DESC, (last_session_id IS NOT NULL) DESC, updated_at DESC, id
  LIMIT 1
);

INSERT INTO vainqueur_state (is_active)
SELECT false
WHERE NOT EXISTS (SELECT 1 FROM vainqueur_state);

CREATE UNIQUE INDEX IF NOT EXISTS vainqueur_state_singleton ON vainqueur_state ((true));

-- Optional coach draft pool: the players who are actually here. NULL means every active player.
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS coach_pool UUID[];

CREATE INDEX IF NOT EXISTS idx_player_queue_order ON player_queue (position, joined_at);

-- Roster edits (bench, rename, new players) reach every open lobby.
SELECT vvv_add_to_realtime('players');

-- Serpentine pick order shared by both functions: B R R B B R R B B R.
CREATE OR REPLACE FUNCTION coach_draft_side(p_pick_number INTEGER)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (ARRAY['blue', 'red', 'red', 'blue', 'blue', 'red', 'red', 'blue', 'blue', 'red'])[p_pick_number]
$$;

-- One pick for the coach whose turn it is. The session row lock serializes picks and undos, so pick numbers
-- stay contiguous and the turn order cannot be raced.
CREATE OR REPLACE FUNCTION coach_draft_pick(p_session_id UUID, p_player_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_player players%ROWTYPE;
  v_count INTEGER;
  v_side TEXT;
  v_next TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'coachdraft:not_authenticated'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:session_not_found'; END IF;
  IF v_session.status <> 'coach_draft' THEN RAISE EXCEPTION 'coachdraft:not_drafting'; END IF;

  SELECT count(*) INTO v_count FROM coach_draft_picks WHERE session_id = p_session_id;
  IF v_count >= 10 THEN RAISE EXCEPTION 'coachdraft:draft_full'; END IF;

  v_side := coach_draft_side(v_count + 1);
  IF (v_side = 'blue' AND v_session.blue_coach_id IS DISTINCT FROM v_uid)
     OR (v_side = 'red' AND v_session.red_coach_id IS DISTINCT FROM v_uid) THEN
    RAISE EXCEPTION 'coachdraft:not_your_turn';
  END IF;

  SELECT * INTO v_player FROM players WHERE id = p_player_id;
  IF NOT FOUND OR NOT v_player.is_active THEN RAISE EXCEPTION 'coachdraft:player_unavailable'; END IF;
  IF COALESCE(cardinality(v_session.coach_pool), 0) > 0 AND NOT (p_player_id = ANY (v_session.coach_pool)) THEN
    RAISE EXCEPTION 'coachdraft:not_in_pool';
  END IF;
  IF EXISTS (SELECT 1 FROM coach_draft_picks WHERE session_id = p_session_id AND player_id = p_player_id) THEN
    RAISE EXCEPTION 'coachdraft:already_picked';
  END IF;

  INSERT INTO coach_draft_picks (session_id, pick_number, player_id, side)
  VALUES (p_session_id, v_count + 1, p_player_id, v_side);

  v_next := CASE WHEN v_count + 1 < 10 THEN coach_draft_side(v_count + 2) END;
  UPDATE game_sessions SET draft_turn = v_next, updated_at = now() WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'pick_number', v_count + 1,
    'side', v_side,
    'next_side', v_next,
    'player_id', v_player.id,
    'player_name', v_player.name,
    'player_user_id', v_player.auth_user_id
  );
END;
$$;

-- Takes back the latest pick. Only the coach who made it can, and only until the next pick lands.
CREATE OR REPLACE FUNCTION coach_draft_undo(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_last coach_draft_picks%ROWTYPE;
  v_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'coachdraft:not_authenticated'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:session_not_found'; END IF;
  IF v_session.status <> 'coach_draft' THEN RAISE EXCEPTION 'coachdraft:not_drafting'; END IF;

  SELECT * INTO v_last FROM coach_draft_picks
  WHERE session_id = p_session_id
  ORDER BY pick_number DESC
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:nothing_to_undo'; END IF;

  IF (v_last.side = 'blue' AND v_session.blue_coach_id IS DISTINCT FROM v_uid)
     OR (v_last.side = 'red' AND v_session.red_coach_id IS DISTINCT FROM v_uid) THEN
    RAISE EXCEPTION 'coachdraft:not_your_pick';
  END IF;

  DELETE FROM coach_draft_picks WHERE id = v_last.id;
  UPDATE game_sessions SET draft_turn = v_last.side, updated_at = now() WHERE id = p_session_id;

  SELECT name INTO v_name FROM players WHERE id = v_last.player_id;

  RETURN jsonb_build_object(
    'pick_number', v_last.pick_number,
    'side', v_last.side,
    'player_id', v_last.player_id,
    'player_name', v_name
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION coach_draft_side(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION coach_draft_pick(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION coach_draft_pick(UUID, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION coach_draft_undo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION coach_draft_undo(UUID) TO authenticated;
