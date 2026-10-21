-- Phase 10: Royal Decrees overhaul (chaos round)
-- Additive and idempotent: safe to run while the previous app version is deployed.
--
-- Every decree now runs inside chaos_issue_decree(): validation, payment and the draft change happen in one
-- transaction (all or nothing), and decrees for the same game are serialized on the game_sessions row, so
-- per-user limits and concurrent draft edits are race-safe. Prices and limits live in chaos_decree_rules.

-- ============================================================
-- chaos_actions: constraints and new columns
-- ============================================================

-- 'sabotage' was never an allowed tier, so legacy champion bans and lane forces were charged and applied
-- but their log row was rejected: no history, no per-game limit, no refund on cancel.
ALTER TABLE chaos_actions DROP CONSTRAINT IF EXISTS chaos_actions_tier_check;
ALTER TABLE chaos_actions ADD CONSTRAINT chaos_actions_tier_check
  CHECK (tier IN ('medium', 'high', 'super', 'sabotage', 'ward'));

ALTER TABLE chaos_actions DROP CONSTRAINT IF EXISTS chaos_actions_action_type_check;
ALTER TABLE chaos_actions ADD CONSTRAINT chaos_actions_action_type_check
  CHECK (action_type IN (
    'double_or_nothing', 'swap_teammate', 'reroll_self',
    'shuffle_lanes', 'reroll_champs', 'target_reroll',
    'champion_ban', 'lane_force', 'royal_pardon'
  ));

ALTER TABLE chaos_actions ADD COLUMN IF NOT EXISTS rules_version SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE chaos_actions ADD COLUMN IF NOT EXISTS affected_side TEXT;
ALTER TABLE chaos_actions ADD COLUMN IF NOT EXISTS changed_assignment_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE chaos_actions ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE chaos_actions ADD COLUMN IF NOT EXISTS multiplier NUMERIC(4, 2);

ALTER TABLE chaos_actions DROP CONSTRAINT IF EXISTS chaos_actions_affected_side_check;
ALTER TABLE chaos_actions ADD CONSTRAINT chaos_actions_affected_side_check
  CHECK (affected_side IS NULL OR affected_side IN ('blue', 'red'));

CREATE INDEX IF NOT EXISTS idx_chaos_actions_session_user ON chaos_actions (session_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chaos_one_pardon_per_player
  ON chaos_actions (session_id, target_player_id)
  WHERE action_type = 'royal_pardon' AND status <> 'refunded';

-- ============================================================
-- Price list and per-game limits (tune with UPDATE, no deploy needed)
-- ============================================================

CREATE TABLE IF NOT EXISTS chaos_decree_rules (
  action_type TEXT PRIMARY KEY,
  cost INTEGER NOT NULL CHECK (cost >= 0),
  max_uses INTEGER NOT NULL CHECK (max_uses >= 0),
  limit_group TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chaos_decree_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chaos_rules_read" ON chaos_decree_rules;
CREATE POLICY "chaos_rules_read" ON chaos_decree_rules FOR SELECT USING (true);

-- max_uses is per user per game, shared by every decree of the same limit_group.
INSERT INTO chaos_decree_rules (action_type, cost, max_uses, limit_group, enabled) VALUES
  ('double_or_nothing', 49, 3, 'wager', true),
  ('royal_pardon', 59, 1, 'pardon', true),
  ('reroll_self', 59, 1, 'reroll_self', true),
  ('champion_ban', 75, 1, 'sabotage', true),
  ('swap_teammate', 89, 1, 'swap', true),
  ('lane_force', 99, 1, 'sabotage', true),
  ('shuffle_lanes', 119, 1, 'shuffle', true),
  ('reroll_champs', 139, 1, 'purge', true),
  ('target_reroll', 139, 0, 'target_reroll', false)
ON CONFLICT (action_type) DO NOTHING;

-- ============================================================
-- Seals: once a game's decrees are refunded, no new decree can slip in before the status flips
-- ============================================================

CREATE TABLE IF NOT EXISTS chaos_session_seals (
  session_id UUID PRIMARY KEY REFERENCES game_sessions(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  sealed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chaos_session_seals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chaos_seals_read" ON chaos_session_seals;
CREATE POLICY "chaos_seals_read" ON chaos_session_seals FOR SELECT USING (true);

-- ============================================================
-- Helpers
-- ============================================================

-- Mirrors the PATCH /api/sessions/[id] rule: the creator or an admin runs the game (or anyone on creatorless games).
CREATE OR REPLACE FUNCTION chaos_can_officiate(p_created_by UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    p_created_by IS NULL
      OR p_created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM players WHERE auth_user_id = auth.uid() AND is_admin),
    false
  );
$$;

-- Random champion for a lane: never one in p_exclude, avoids today's fearless list unless the lane runs dry.
CREATE OR REPLACE FUNCTION chaos_pick_champion(p_lane TEXT, p_exclude TEXT[])
RETURNS TABLE (pick_name TEXT, pick_internal TEXT, pick_fearless_override BOOLEAN)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'utc')::date;
  v_exclude TEXT[] := COALESCE(array_remove(p_exclude, NULL), '{}');
BEGIN
  RETURN QUERY
    SELECT cr.name, cr.internal_name, false
    FROM champion_roles cr
    WHERE cr.role = p_lane
      AND NOT (cr.name = ANY (v_exclude))
      AND NOT EXISTS (
        SELECT 1 FROM daily_fearless df WHERE df.date = v_today AND df.champion_name = cr.name
      )
    ORDER BY random()
    LIMIT 1;
  IF FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT cr.name, cr.internal_name, true
    FROM champion_roles cr
    WHERE cr.role = p_lane AND NOT (cr.name = ANY (v_exclude))
    ORDER BY random()
    LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION chaos_change_json(
  p_before session_assignments, p_lane TEXT, p_champion TEXT, p_internal TEXT
) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'assignment_id', p_before.id,
    'player_id', p_before.player_id,
    'player_name', (SELECT name FROM players WHERE id = p_before.player_id),
    'side', p_before.side,
    'before', jsonb_build_object(
      'lane', p_before.lane, 'champion', p_before.champion, 'champion_internal', p_before.champion_internal
    ),
    'after', jsonb_build_object('lane', p_lane, 'champion', p_champion, 'champion_internal', p_internal)
  );
$$;

-- Double or nothing pays 2x. Wagers placed through chaos_issue_decree (rules_version 2) gain +0.5x for each
-- hostile decree another user lands on the backed side after the wager, capped at 3x: defiance pays.
CREATE OR REPLACE FUNCTION chaos_wager_multiplier(p_wager chaos_actions) RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p_wager.rules_version < 2 THEN 2.0
    ELSE 2.0 + 0.5 * LEAST(2, (
      SELECT count(*)
      FROM chaos_actions h
      WHERE h.session_id = p_wager.session_id
        AND h.status = 'resolved'
        AND h.affected_side = p_wager.side
        AND h.user_id <> p_wager.user_id
        AND h.created_at > p_wager.created_at
        AND h.action_type IN ('champion_ban', 'lane_force', 'shuffle_lanes', 'reroll_champs', 'target_reroll')
    ))
  END;
$$;

-- ============================================================
-- Issue a decree (the only write path for clients)
-- ============================================================

CREATE OR REPLACE FUNCTION chaos_issue_decree(
  p_session_id UUID,
  p_action_type TEXT,
  p_side TEXT DEFAULT NULL,
  p_target_player_id UUID DEFAULT NULL,
  p_target_player_2_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_rule chaos_decree_rules%ROWTYPE;
  v_id UUID := gen_random_uuid();
  v_now TIMESTAMPTZ;
  v_used INTEGER;
  v_actor_player UUID;
  v_actor session_assignments%ROWTYPE;
  v_t1 session_assignments%ROWTYPE;
  v_t2 session_assignments%ROWTYPE;
  v_row session_assignments%ROWTYPE;
  v_pick RECORD;
  v_exclude TEXT[];
  v_pardoned UUID[];
  v_ids UUID[];
  v_seats JSONB;
  v_seat JSONB;
  v_n INTEGER;
  v_i INTEGER;
  v_changes JSONB := '[]'::jsonb;
  v_changed UUID[] := '{}';
  v_details JSONB;
  v_affected TEXT;
  v_status TEXT := 'resolved';
  v_tier TEXT;
  v_reason TEXT := 'chaos_spent';
  v_side TEXT;
  v_target_team TEXT;
  v_target_1 UUID;
  v_target_2 UUID;
  v_banned TEXT;
  v_forced TEXT;
  v_balance INTEGER;
  v_extra JSONB := '{}'::jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'chaos:not_authenticated';
  END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'chaos:session_not_found';
  END IF;

  v_now := clock_timestamp();
  IF v_session.status <> 'chaos'
     OR (v_session.chaos_ends_at IS NOT NULL AND v_now > v_session.chaos_ends_at + interval '3 seconds')
     OR EXISTS (SELECT 1 FROM chaos_session_seals WHERE session_id = p_session_id) THEN
    RAISE EXCEPTION 'chaos:window_closed';
  END IF;

  SELECT * INTO v_rule FROM chaos_decree_rules WHERE action_type = p_action_type;
  IF NOT FOUND OR NOT v_rule.enabled THEN
    RAISE EXCEPTION 'chaos:unknown_decree';
  END IF;

  SELECT count(*) INTO v_used
  FROM chaos_actions ca
  JOIN chaos_decree_rules r ON r.action_type = ca.action_type
  WHERE ca.session_id = p_session_id
    AND ca.user_id = v_user
    AND ca.status <> 'refunded'
    AND r.limit_group = v_rule.limit_group;
  IF v_used >= v_rule.max_uses THEN
    RAISE EXCEPTION 'chaos:limit_reached';
  END IF;

  PERFORM 1 FROM session_assignments WHERE session_id = p_session_id FOR UPDATE;

  SELECT player_id INTO v_actor_player FROM user_profiles WHERE id = v_user;
  IF v_actor_player IS NOT NULL THEN
    SELECT * INTO v_actor FROM session_assignments
    WHERE session_id = p_session_id AND player_id = v_actor_player;
  END IF;

  SELECT COALESCE(array_agg(target_player_id), '{}') INTO v_pardoned
  FROM chaos_actions
  WHERE session_id = p_session_id AND action_type = 'royal_pardon' AND status <> 'refunded';

  v_exclude := ARRAY(SELECT champion FROM session_assignments WHERE session_id = p_session_id)
    || ARRAY(
      SELECT banned_champion FROM chaos_actions
      WHERE session_id = p_session_id AND banned_champion IS NOT NULL AND status <> 'refunded'
    );

  IF p_action_type = 'double_or_nothing' THEN
    IF p_side IS NULL OR p_side NOT IN ('blue', 'red') THEN
      RAISE EXCEPTION 'chaos:invalid_side';
    END IF;
    IF v_actor.id IS NOT NULL AND v_actor.side <> p_side THEN
      RAISE EXCEPTION 'chaos:treason';
    END IF;
    IF EXISTS (
      SELECT 1 FROM chaos_actions
      WHERE session_id = p_session_id AND user_id = v_user AND action_type = 'double_or_nothing'
        AND status <> 'refunded' AND side <> p_side
    ) THEN
      RAISE EXCEPTION 'chaos:fence_sitter';
    END IF;
    v_status := 'pending';
    v_tier := 'medium';
    v_side := p_side;
    v_extra := jsonb_build_object('side', p_side);

  ELSIF p_action_type = 'royal_pardon' THEN
    SELECT * INTO v_t1 FROM session_assignments
    WHERE session_id = p_session_id AND player_id = p_target_player_id;
    IF v_t1.id IS NULL THEN
      RAISE EXCEPTION 'chaos:target_not_in_game';
    END IF;
    IF v_t1.player_id = ANY (v_pardoned) THEN
      RAISE EXCEPTION 'chaos:already_pardoned';
    END IF;
    v_tier := 'ward';
    v_target_1 := v_t1.player_id;
    v_extra := jsonb_build_object(
      'target', chaos_change_json(v_t1, v_t1.lane, v_t1.champion, v_t1.champion_internal)
    );

  ELSIF p_action_type = 'swap_teammate' THEN
    IF v_actor.id IS NULL THEN
      RAISE EXCEPTION 'chaos:players_only';
    END IF;
    SELECT * INTO v_t1 FROM session_assignments
    WHERE session_id = p_session_id AND player_id = p_target_player_id;
    IF v_t1.id IS NULL THEN
      RAISE EXCEPTION 'chaos:target_not_in_game';
    END IF;
    IF v_t1.id = v_actor.id THEN
      RAISE EXCEPTION 'chaos:self_target';
    END IF;
    IF v_t1.side <> v_actor.side THEN
      RAISE EXCEPTION 'chaos:target_not_teammate';
    END IF;
    IF v_t1.player_id = ANY (v_pardoned) THEN
      RAISE EXCEPTION 'chaos:target_pardoned';
    END IF;

    UPDATE session_assignments
    SET lane = v_t1.lane, champion = v_t1.champion, champion_internal = v_t1.champion_internal,
        fearless_override = v_t1.fearless_override
    WHERE id = v_actor.id;
    UPDATE session_assignments
    SET lane = v_actor.lane, champion = v_actor.champion, champion_internal = v_actor.champion_internal,
        fearless_override = v_actor.fearless_override
    WHERE id = v_t1.id;

    v_changes := jsonb_build_array(
      chaos_change_json(v_actor, v_t1.lane, v_t1.champion, v_t1.champion_internal),
      chaos_change_json(v_t1, v_actor.lane, v_actor.champion, v_actor.champion_internal)
    );
    v_changed := ARRAY[v_actor.id, v_t1.id];
    v_tier := 'high';
    v_target_1 := v_actor.player_id;
    v_target_2 := v_t1.player_id;

  ELSIF p_action_type = 'reroll_self' THEN
    IF v_actor.id IS NULL THEN
      RAISE EXCEPTION 'chaos:players_only';
    END IF;
    SELECT * INTO v_pick FROM chaos_pick_champion(v_actor.lane, v_exclude);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'chaos:no_champion';
    END IF;

    UPDATE session_assignments
    SET champion = v_pick.pick_name, champion_internal = v_pick.pick_internal,
        fearless_override = v_pick.pick_fearless_override
    WHERE id = v_actor.id;

    v_changes := jsonb_build_array(
      chaos_change_json(v_actor, v_actor.lane, v_pick.pick_name, v_pick.pick_internal)
    );
    v_changed := ARRAY[v_actor.id];
    v_tier := 'high';
    v_target_1 := v_actor.player_id;

  ELSIF p_action_type = 'champion_ban' THEN
    SELECT * INTO v_t1 FROM session_assignments
    WHERE session_id = p_session_id AND player_id = p_target_player_id;
    IF v_t1.id IS NULL THEN
      RAISE EXCEPTION 'chaos:target_not_in_game';
    END IF;
    IF v_t1.player_id = v_actor_player THEN
      RAISE EXCEPTION 'chaos:self_target';
    END IF;
    IF v_t1.player_id = ANY (v_pardoned) THEN
      RAISE EXCEPTION 'chaos:target_pardoned';
    END IF;

    v_banned := v_t1.champion;
    SELECT * INTO v_pick FROM chaos_pick_champion(v_t1.lane, v_exclude);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'chaos:no_champion';
    END IF;

    UPDATE session_assignments
    SET champion = v_pick.pick_name, champion_internal = v_pick.pick_internal,
        fearless_override = v_pick.pick_fearless_override
    WHERE id = v_t1.id;

    v_changes := jsonb_build_array(
      chaos_change_json(v_t1, v_t1.lane, v_pick.pick_name, v_pick.pick_internal)
    );
    v_changed := ARRAY[v_t1.id];
    v_affected := v_t1.side;
    v_tier := 'sabotage';
    v_reason := 'sabotage_spent';
    v_target_1 := v_t1.player_id;
    v_extra := jsonb_build_object('banned_champion', v_banned);

  ELSIF p_action_type = 'lane_force' THEN
    SELECT * INTO v_t1 FROM session_assignments
    WHERE session_id = p_session_id AND player_id = p_target_player_id;
    SELECT * INTO v_t2 FROM session_assignments
    WHERE session_id = p_session_id AND player_id = p_target_player_2_id;
    IF v_t1.id IS NULL OR v_t2.id IS NULL THEN
      RAISE EXCEPTION 'chaos:target_not_in_game';
    END IF;
    IF v_t1.id = v_t2.id THEN
      RAISE EXCEPTION 'chaos:same_target';
    END IF;
    IF v_t1.side <> v_t2.side THEN
      RAISE EXCEPTION 'chaos:target_not_teammate';
    END IF;
    IF v_t1.player_id = v_actor_player OR v_t2.player_id = v_actor_player THEN
      RAISE EXCEPTION 'chaos:self_target';
    END IF;
    IF v_t1.player_id = ANY (v_pardoned) OR v_t2.player_id = ANY (v_pardoned) THEN
      RAISE EXCEPTION 'chaos:target_pardoned';
    END IF;

    UPDATE session_assignments SET lane = v_t2.lane WHERE id = v_t1.id;
    UPDATE session_assignments SET lane = v_t1.lane WHERE id = v_t2.id;

    v_changes := jsonb_build_array(
      chaos_change_json(v_t1, v_t2.lane, v_t1.champion, v_t1.champion_internal),
      chaos_change_json(v_t2, v_t1.lane, v_t2.champion, v_t2.champion_internal)
    );
    v_changed := ARRAY[v_t1.id, v_t2.id];
    v_affected := v_t1.side;
    v_forced := v_t2.lane;
    v_tier := 'sabotage';
    v_reason := 'sabotage_spent';
    v_target_1 := v_t1.player_id;
    v_target_2 := v_t2.player_id;

  ELSIF p_action_type IN ('shuffle_lanes', 'reroll_champs') THEN
    IF p_side IS NULL OR p_side NOT IN ('blue', 'red') THEN
      RAISE EXCEPTION 'chaos:invalid_side';
    END IF;

    SELECT array_agg(id ORDER BY random()) INTO v_ids
    FROM session_assignments
    WHERE session_id = p_session_id AND side = p_side AND NOT (player_id = ANY (v_pardoned));
    v_n := COALESCE(array_length(v_ids, 1), 0);
    IF (p_action_type = 'shuffle_lanes' AND v_n < 2) OR v_n < 1 THEN
      RAISE EXCEPTION 'chaos:not_enough_targets';
    END IF;

    IF p_action_type = 'shuffle_lanes' THEN
      -- One cycle over the movable players: everyone takes the next seat, nobody keeps their own.
      SELECT jsonb_agg(to_jsonb(sa) ORDER BY array_position(v_ids, sa.id)) INTO v_seats
      FROM session_assignments sa
      WHERE sa.id = ANY (v_ids);

      FOR v_i IN 1..v_n LOOP
        v_row := jsonb_populate_record(NULL::session_assignments, v_seats -> (v_i - 1));
        v_seat := v_seats -> (v_i % v_n);
        UPDATE session_assignments
        SET lane = v_seat ->> 'lane', champion = v_seat ->> 'champion',
            champion_internal = v_seat ->> 'champion_internal',
            fearless_override = (v_seat ->> 'fearless_override')::boolean
        WHERE id = v_row.id;
        v_changes := v_changes || jsonb_build_array(
          chaos_change_json(v_row, v_seat ->> 'lane', v_seat ->> 'champion', v_seat ->> 'champion_internal')
        );
      END LOOP;
    ELSE
      FOR v_i IN 1..v_n LOOP
        SELECT * INTO v_row FROM session_assignments WHERE id = v_ids[v_i];
        SELECT * INTO v_pick FROM chaos_pick_champion(v_row.lane, v_exclude);
        IF NOT FOUND THEN
          RAISE EXCEPTION 'chaos:no_champion';
        END IF;
        v_exclude := v_exclude || v_pick.pick_name;
        UPDATE session_assignments
        SET champion = v_pick.pick_name, champion_internal = v_pick.pick_internal,
            fearless_override = v_pick.pick_fearless_override
        WHERE id = v_row.id;
        v_changes := v_changes || jsonb_build_array(
          chaos_change_json(v_row, v_row.lane, v_pick.pick_name, v_pick.pick_internal)
        );
      END LOOP;
    END IF;

    v_changed := v_ids;
    v_affected := p_side;
    v_target_team := p_side;
    v_tier := 'super';
    v_extra := jsonb_build_object('side', p_side);

  ELSE
    RAISE EXCEPTION 'chaos:unknown_decree';
  END IF;

  IF v_rule.cost > 0 THEN
    v_balance := adjust_balance(v_user, -v_rule.cost, v_reason, v_id);
  ELSE
    SELECT balance INTO v_balance FROM point_balances WHERE user_id = v_user;
  END IF;

  v_details := jsonb_build_object('changes', v_changes) || v_extra;

  INSERT INTO chaos_actions (
    id, session_id, user_id, action_type, tier, cost, side, target_player_id, target_player_2_id,
    target_team, payout, status, banned_champion, forced_lane, rules_version, affected_side,
    changed_assignment_ids, details, created_at
  ) VALUES (
    v_id, p_session_id, v_user, p_action_type, v_tier, v_rule.cost, v_side, v_target_1, v_target_2,
    v_target_team, NULL, v_status, v_banned, v_forced, 2, v_affected,
    v_changed, v_details, v_now
  );

  UPDATE game_sessions SET updated_at = now() WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'action_type', p_action_type,
    'cost', v_rule.cost,
    'status', v_status,
    'balance', v_balance,
    'side', COALESCE(v_side, v_target_team),
    'affected_side', v_affected,
    'target_player_id', v_target_1,
    'target_player_2_id', v_target_2,
    'banned_champion', v_banned,
    'forced_lane', v_forced,
    'changed_assignment_ids', to_jsonb(v_changed),
    'details', v_details,
    'created_at', v_now
  );
END;
$$;

-- ============================================================
-- End of game: race-safe resolution and refunds
-- ============================================================

CREATE OR REPLACE FUNCTION resolve_chaos_wagers_v2(p_session_id UUID, p_winner_side TEXT, p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
  v_wager chaos_actions%ROWTYPE;
  v_mult NUMERIC;
  v_payout INTEGER;
  v_won INTEGER := 0;
  v_lost INTEGER := 0;
  v_paid INTEGER := 0;
BEGIN
  IF p_winner_side IS NULL OR p_winner_side NOT IN ('blue', 'red') THEN
    RAISE EXCEPTION 'chaos:invalid_side';
  END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'chaos:session_not_found';
  END IF;
  IF NOT chaos_can_officiate(v_session.created_by) THEN
    RAISE EXCEPTION 'chaos:forbidden';
  END IF;
  IF v_session.status NOT IN ('in_game', 'blue_win', 'red_win') THEN
    RAISE EXCEPTION 'chaos:not_resolvable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM games WHERE id = p_game_id AND winner_side = p_winner_side) THEN
    RAISE EXCEPTION 'chaos:game_mismatch';
  END IF;

  FOR v_wager IN
    SELECT * FROM chaos_actions
    WHERE session_id = p_session_id AND action_type = 'double_or_nothing' AND status = 'pending'
    ORDER BY created_at
    FOR UPDATE
  LOOP
    v_mult := chaos_wager_multiplier(v_wager);
    IF v_wager.side = p_winner_side THEN
      v_payout := FLOOR(v_wager.cost * v_mult);
      UPDATE chaos_actions SET status = 'won', payout = v_payout, multiplier = v_mult
      WHERE id = v_wager.id AND status = 'pending';
      IF FOUND THEN
        IF v_payout > 0 THEN
          PERFORM adjust_balance(v_wager.user_id, v_payout, 'chaos_won', v_wager.id);
        END IF;
        v_won := v_won + 1;
        v_paid := v_paid + v_payout;
      END IF;
    ELSE
      UPDATE chaos_actions SET status = 'lost', payout = 0, multiplier = v_mult
      WHERE id = v_wager.id AND status = 'pending';
      IF FOUND THEN
        v_lost := v_lost + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('won', v_won, 'lost', v_lost, 'paid', v_paid);
END;
$$;

CREATE OR REPLACE FUNCTION refund_chaos_actions_v2(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
  v_action chaos_actions%ROWTYPE;
  v_count INTEGER := 0;
  v_total INTEGER := 0;
BEGIN
  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'chaos:session_not_found';
  END IF;
  IF NOT chaos_can_officiate(v_session.created_by) THEN
    RAISE EXCEPTION 'chaos:forbidden';
  END IF;
  IF v_session.status IN ('blue_win', 'red_win') THEN
    RAISE EXCEPTION 'chaos:already_resolved';
  END IF;

  IF v_session.status = 'chaos' THEN
    INSERT INTO chaos_session_seals (session_id, reason) VALUES (p_session_id, 'canceled')
    ON CONFLICT (session_id) DO NOTHING;
  END IF;

  FOR v_action IN
    SELECT * FROM chaos_actions
    WHERE session_id = p_session_id AND status IN ('pending', 'resolved')
    ORDER BY created_at
    FOR UPDATE
  LOOP
    UPDATE chaos_actions SET status = 'refunded', payout = v_action.cost
    WHERE id = v_action.id AND status IN ('pending', 'resolved');
    IF FOUND THEN
      IF v_action.cost > 0 THEN
        PERFORM adjust_balance(v_action.user_id, v_action.cost, 'chaos_refunded', v_action.id);
      END IF;
      v_count := v_count + 1;
      v_total := v_total + v_action.cost;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('refunded', v_count, 'total', v_total);
END;
$$;

-- ============================================================
-- Direct client inserts: only the legacy app path (pay first, then log) is accepted
-- ============================================================

-- The old insert policy let any user write rows with any cost, which resolve_chaos_wagers and
-- refund_chaos_actions would then pay out. Clients may still insert (the previous app version does), but a
-- row must match a legacy-shaped decree that was paid for in the last two minutes.
CREATE OR REPLACE FUNCTION chaos_actions_guard() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_legacy_cost INTEGER;
  v_rule_cost INTEGER;
  v_paid INTEGER;
  v_logged INTEGER;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  v_legacy_cost := CASE NEW.action_type
    WHEN 'double_or_nothing' THEN 49
    WHEN 'swap_teammate' THEN 89
    WHEN 'reroll_self' THEN 89
    WHEN 'shuffle_lanes' THEN 139
    WHEN 'reroll_champs' THEN 139
    WHEN 'target_reroll' THEN 139
    WHEN 'champion_ban' THEN 75
    WHEN 'lane_force' THEN 120
  END;
  SELECT cost INTO v_rule_cost FROM chaos_decree_rules WHERE action_type = NEW.action_type;

  IF v_legacy_cost IS NULL
     OR NEW.user_id IS DISTINCT FROM auth.uid()
     OR NEW.cost NOT IN (v_legacy_cost, COALESCE(v_rule_cost, v_legacy_cost))
     OR NEW.payout IS NOT NULL
     OR NEW.status <> (CASE WHEN NEW.action_type = 'double_or_nothing' THEN 'pending' ELSE 'resolved' END)
     OR NOT EXISTS (SELECT 1 FROM game_sessions WHERE id = NEW.session_id AND status = 'chaos') THEN
    RAISE EXCEPTION 'chaos:direct_insert_rejected';
  END IF;

  SELECT count(*) INTO v_paid
  FROM point_transactions
  WHERE user_id = NEW.user_id
    AND amount = -NEW.cost
    AND reason IN ('chaos_spent', 'sabotage_spent')
    AND created_at > now() - interval '2 minutes';
  SELECT count(*) INTO v_logged
  FROM chaos_actions
  WHERE user_id = NEW.user_id AND cost = NEW.cost AND created_at > now() - interval '2 minutes';
  IF v_paid <= v_logged THEN
    RAISE EXCEPTION 'chaos:unpaid_decree';
  END IF;

  NEW.created_at := now();
  NEW.rules_version := 1;
  NEW.affected_side := NULL;
  NEW.changed_assignment_ids := '{}';
  NEW.details := '{}'::jsonb;
  NEW.multiplier := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chaos_actions_guard ON chaos_actions;
CREATE TRIGGER chaos_actions_guard
  BEFORE INSERT ON chaos_actions
  FOR EACH ROW EXECUTE FUNCTION chaos_actions_guard();

-- ============================================================
-- Privileges
-- ============================================================

REVOKE EXECUTE ON FUNCTION chaos_can_officiate(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION chaos_pick_champion(TEXT, TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION chaos_change_json(session_assignments, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION chaos_wager_multiplier(chaos_actions) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION chaos_actions_guard() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION chaos_issue_decree(UUID, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION resolve_chaos_wagers_v2(UUID, TEXT, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION refund_chaos_actions_v2(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION chaos_issue_decree(UUID, TEXT, TEXT, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resolve_chaos_wagers_v2(UUID, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION refund_chaos_actions_v2(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- Optional hardening, once the new app version is live everywhere (the previous version calls these
-- directly, and any signed-in user can call them with any arguments):
--   REVOKE EXECUTE ON FUNCTION resolve_chaos_wagers(UUID, TEXT) FROM PUBLIC, anon, authenticated;
--   REVOKE EXECUTE ON FUNCTION refund_chaos_actions(UUID) FROM PUBLIC, anon, authenticated;
