-- Phase 10: MVP / Inter prophecies settled by a post-game vote ("The Tribunal").
-- Replaces the Lane Call prophecies: lanes were visible during betting, so every call hit and doubled a bet.
-- Run AFTER phase10_foundation.sql. Additive and idempotent: safe to run while the previous app version is live.
--
-- Economy
--   * One prophecy per user per game, MVP or Inter, stake 10..50, sealed during chaos or betting.
--   * Each market is pari-mutuel: prophets who called a voted player split the whole market pot by stake.
--     No verdict, or nobody called it: every stake in that market is returned. Zero-sum, so a coordinated
--     vote cannot print points: if everyone backs the same player they just get their stake back.
--   * Verdict: the leader needs at least 2 votes; a 2-way tie crowns both (dead heat), a wider tie is "split".
--   * Every crowned MVP with an account receives +15 (mvp_bonus). A vote on a game canceled later is void:
--     stakes return and nobody is crowned or paid.
--   * The vote opens when the winner is declared and closes 5 minutes after the game row was written.
--     The first read after closes_at settles it; nothing needs an admin.

DO $$
BEGIN
  IF to_regprocedure('public.vvv_add_to_realtime(text)') IS NULL THEN
    RAISE EXCEPTION 'Apply supabase/phase10_foundation.sql before phase10_prophecy-vote.sql';
  END IF;
END $$;

-- Repeated from the foundation so this file never depends on the order of the old reason CHECK list.
ALTER TABLE point_transactions DROP CONSTRAINT IF EXISTS point_transactions_reason_check;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'point_transactions_reason_format') THEN
    ALTER TABLE point_transactions ADD CONSTRAINT point_transactions_reason_format
      CHECK (reason ~ '^[a-z][a-z0-9_]{1,48}$');
  END IF;
END $$;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS prophecy_wagers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market TEXT NOT NULL CHECK (market IN ('mvp', 'inter')),
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  stake INTEGER NOT NULL CHECK (stake BETWEEN 10 AND 50),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'refunded')),
  payout INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  UNIQUE (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_prophecy_wagers_session ON prophecy_wagers(session_id);
CREATE INDEX IF NOT EXISTS idx_prophecy_wagers_user ON prophecy_wagers(user_id);
CREATE INDEX IF NOT EXISTS idx_prophecy_wagers_pending ON prophecy_wagers(session_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS post_game_votes (
  session_id UUID PRIMARY KEY REFERENCES game_sessions(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  winner_side TEXT CHECK (winner_side IN ('blue', 'red')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closes_at TIMESTAMPTZ NOT NULL,
  settled_at TIMESTAMPTZ,
  mvp_player_ids UUID[] NOT NULL DEFAULT '{}',
  inter_player_ids UUID[] NOT NULL DEFAULT '{}',
  summary JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_post_game_votes_open ON post_game_votes(closes_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_post_game_votes_opened ON post_game_votes(opened_at DESC);

CREATE TABLE IF NOT EXISTS post_game_ballots (
  session_id UUID NOT NULL REFERENCES post_game_votes(session_id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('mvp', 'inter')),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  cast_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, voter_id, category)
);

CREATE INDEX IF NOT EXISTS idx_post_game_ballots_session ON post_game_ballots(session_id, category);

-- Public reads (ballots are public on purpose: the court votes in the open). Writes only via the functions below.
ALTER TABLE prophecy_wagers ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_game_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_game_ballots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prophecy_wagers_read" ON prophecy_wagers;
CREATE POLICY "prophecy_wagers_read" ON prophecy_wagers FOR SELECT USING (true);
DROP POLICY IF EXISTS "post_game_votes_read" ON post_game_votes;
CREATE POLICY "post_game_votes_read" ON post_game_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "post_game_ballots_read" ON post_game_ballots;
CREATE POLICY "post_game_ballots_read" ON post_game_ballots FOR SELECT USING (true);

-- ============================================================
-- HELPERS
-- ============================================================

CREATE OR REPLACE FUNCTION vvv_user_is_player(p_user_id UUID, p_player_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user_id IS NOT NULL AND p_player_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM players WHERE id = p_player_id AND auth_user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = p_user_id AND player_id = p_player_id)
  );
$$;

-- Mirrors the session PATCH route: creator, admin, or anyone when the session has no creator.
CREATE OR REPLACE FUNCTION vvv_can_manage_session(p_user_id UUID, p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM game_sessions s
    WHERE s.id = p_session_id
      AND (
        s.created_by IS NULL
        OR s.created_by = p_user_id
        OR EXISTS (SELECT 1 FROM players p WHERE p.auth_user_id = p_user_id AND p.is_admin)
      )
  );
$$;

-- ============================================================
-- SEAL A PROPHECY (atomic: insert guarded by UNIQUE + stake debit in one transaction)
-- ============================================================

CREATE OR REPLACE FUNCTION seal_prophecy(p_session_id UUID, p_market TEXT, p_player_id UUID, p_stake INTEGER)
RETURNS prophecy_wagers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_wager prophecy_wagers%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'prophecy_auth_required'; END IF;
  IF p_market IS NULL OR p_market NOT IN ('mvp', 'inter') THEN RAISE EXCEPTION 'prophecy_invalid_market'; END IF;
  IF p_stake IS NULL OR p_stake < 10 OR p_stake > 50 THEN RAISE EXCEPTION 'prophecy_invalid_stake'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'prophecy_session_not_found'; END IF;
  IF v_session.status NOT IN ('chaos', 'betting')
     OR (v_session.status = 'betting' AND v_session.betting_ends_at IS NOT NULL AND v_session.betting_ends_at <= now()) THEN
    RAISE EXCEPTION 'prophecy_closed';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM session_assignments WHERE session_id = p_session_id AND player_id = p_player_id) THEN
    RAISE EXCEPTION 'prophecy_player_not_in_game';
  END IF;

  -- Backing yourself as the Inter would pay you to throw the game.
  IF p_market = 'inter' AND vvv_user_is_player(v_uid, p_player_id) THEN
    RAISE EXCEPTION 'prophecy_self_inter';
  END IF;

  BEGIN
    INSERT INTO prophecy_wagers (session_id, user_id, market, player_id, stake)
    VALUES (p_session_id, v_uid, p_market, p_player_id, p_stake)
    RETURNING * INTO v_wager;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'prophecy_already_sealed';
  END;

  PERFORM adjust_balance(v_uid, -p_stake, 'prophecy_stake', v_wager.id);
  RETURN v_wager;
END;
$$;

-- ============================================================
-- OPEN THE TRIBUNAL
-- Called by the declare_winner hook (session still in_game, caller is its creator/admin) or lazily by any
-- reader once the session is resolved. The window is anchored to the game row, so lazy opens never extend it.
-- ============================================================

CREATE OR REPLACE FUNCTION open_post_game_vote(p_session_id UUID, p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_game games%ROWTYPE;
  v_vote post_game_votes%ROWTYPE;
  v_created BOOLEAN := false;
BEGIN
  SELECT * INTO v_vote FROM post_game_votes WHERE session_id = p_session_id;
  IF FOUND THEN
    RETURN jsonb_build_object('created', false, 'vote', to_jsonb(v_vote));
  END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'vote_session_not_found'; END IF;

  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'vote_game_not_found'; END IF;

  IF v_session.status IN ('blue_win', 'red_win') THEN
    IF v_session.game_id IS DISTINCT FROM p_game_id THEN RAISE EXCEPTION 'vote_game_mismatch'; END IF;
  ELSIF v_session.status = 'in_game' THEN
    IF NOT vvv_can_manage_session(v_uid, p_session_id) THEN RAISE EXCEPTION 'vote_forbidden'; END IF;
    -- A rematch has the same ten players, so the roster alone cannot tell this game from the previous one.
    IF (v_session.game_id IS NOT NULL AND v_session.game_id <> p_game_id) OR v_game.played_at < v_session.created_at THEN
      RAISE EXCEPTION 'vote_game_mismatch';
    END IF;
    IF EXISTS (
      SELECT 1 FROM session_assignments sa
      WHERE sa.session_id = p_session_id
        AND NOT EXISTS (SELECT 1 FROM game_players gp WHERE gp.game_id = p_game_id AND gp.player_id = sa.player_id)
    ) THEN
      RAISE EXCEPTION 'vote_game_mismatch';
    END IF;
  ELSE
    RAISE EXCEPTION 'vote_not_available';
  END IF;

  IF v_game.played_at + interval '5 minutes' <= now() THEN
    RAISE EXCEPTION 'vote_window_passed';
  END IF;

  INSERT INTO post_game_votes (session_id, game_id, winner_side, opened_at, closes_at)
  VALUES (p_session_id, p_game_id, v_game.winner_side, now(), v_game.played_at + interval '5 minutes')
  ON CONFLICT (session_id) DO NOTHING
  RETURNING true INTO v_created;

  SELECT * INTO v_vote FROM post_game_votes WHERE session_id = p_session_id;
  RETURN jsonb_build_object('created', COALESCE(v_created, false), 'vote', to_jsonb(v_vote));
END;
$$;

-- ============================================================
-- CAST / CHANGE A BALLOT (one per voter and category, changeable until the gavel falls)
-- ============================================================

CREATE OR REPLACE FUNCTION cast_post_game_vote(p_session_id UUID, p_category TEXT, p_player_id UUID)
RETURNS post_game_ballots
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_vote post_game_votes%ROWTYPE;
  v_ballot post_game_ballots%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'vote_auth_required'; END IF;
  IF p_category IS NULL OR p_category NOT IN ('mvp', 'inter') THEN RAISE EXCEPTION 'vote_invalid_category'; END IF;

  -- Row lock serializes ballots with settlement: no ballot can land after the count started.
  SELECT * INTO v_vote FROM post_game_votes WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'vote_not_open'; END IF;
  IF v_vote.status <> 'open' OR v_vote.closes_at <= now() THEN RAISE EXCEPTION 'vote_closed'; END IF;
  IF EXISTS (SELECT 1 FROM game_sessions WHERE id = p_session_id AND status IN ('canceled', 'expired')) THEN
    RAISE EXCEPTION 'vote_closed';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM session_assignments WHERE session_id = p_session_id AND player_id = p_player_id) THEN
    RAISE EXCEPTION 'vote_player_not_in_game';
  END IF;

  IF vvv_user_is_player(v_uid, p_player_id) THEN RAISE EXCEPTION 'vote_self'; END IF;

  IF EXISTS (
    SELECT 1 FROM post_game_ballots
    WHERE session_id = p_session_id AND voter_id = v_uid AND category <> p_category AND player_id = p_player_id
  ) THEN
    RAISE EXCEPTION 'vote_same_player';
  END IF;

  INSERT INTO post_game_ballots (session_id, voter_id, category, player_id)
  VALUES (p_session_id, v_uid, p_category, p_player_id)
  ON CONFLICT (session_id, voter_id, category)
  DO UPDATE SET player_id = EXCLUDED.player_id, cast_at = now()
  RETURNING * INTO v_ballot;

  RETURN v_ballot;
END;
$$;

-- ============================================================
-- SETTLEMENT
-- ============================================================

-- Settles one due vote. Internal: callers go through settle_post_game_votes().
CREATE OR REPLACE FUNCTION vvv_settle_post_game_vote(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_vote post_game_votes%ROWTYPE;
  v_category TEXT;
  v_tallies JSONB;
  v_ballots INTEGER;
  v_top INTEGER;
  v_leaders UUID[];
  v_winners UUID[];
  v_outcome TEXT;
  v_pot INTEGER;
  v_prophets INTEGER;
  v_winning_stake INTEGER;
  v_hits INTEGER;
  v_paid INTEGER;
  v_payout INTEGER;
  v_wager RECORD;
  v_summary JSONB := '{}'::jsonb;
  v_mvp UUID[] := '{}';
  v_inter UUID[] := '{}';
  v_player UUID;
  v_user UUID;
  v_bonus_paid UUID[] := '{}';
  v_void BOOLEAN;
BEGIN
  SELECT * INTO v_vote FROM post_game_votes WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_vote.status <> 'open' OR v_vote.closes_at > now() THEN
    RETURN NULL;
  END IF;

  -- A game canceled after its vote opened gets no verdict: every stake goes home and nobody is crowned.
  v_void := EXISTS (SELECT 1 FROM game_sessions WHERE id = p_session_id AND status IN ('canceled', 'expired'));

  -- A pick whose player was deleted can never win: return the stake.
  FOR v_wager IN
    SELECT * FROM prophecy_wagers
    WHERE session_id = p_session_id AND status = 'pending' AND player_id IS NULL
    FOR UPDATE
  LOOP
    UPDATE prophecy_wagers SET status = 'refunded', payout = v_wager.stake, settled_at = now() WHERE id = v_wager.id;
    PERFORM adjust_balance(v_wager.user_id, v_wager.stake, 'prophecy_refunded', v_wager.id);
  END LOOP;

  FOREACH v_category IN ARRAY ARRAY['mvp', 'inter'] LOOP
    SELECT COALESCE(jsonb_object_agg(t.player_id, t.votes), '{}'::jsonb),
           COALESCE(SUM(t.votes), 0)::INTEGER,
           COALESCE(MAX(t.votes), 0)::INTEGER
      INTO v_tallies, v_ballots, v_top
      FROM (
        SELECT player_id, COUNT(*)::INTEGER AS votes
        FROM post_game_ballots
        WHERE session_id = p_session_id AND category = v_category
        GROUP BY player_id
      ) t;

    SELECT COALESCE(array_agg(t.player_id), '{}')
      INTO v_leaders
      FROM (
        SELECT player_id
        FROM post_game_ballots
        WHERE session_id = p_session_id AND category = v_category
        GROUP BY player_id
        HAVING COUNT(*) = v_top
      ) t;

    IF v_void THEN
      v_outcome := 'void';
      v_winners := '{}';
    ELSIF v_ballots = 0 THEN
      v_outcome := 'no_votes';
      v_winners := '{}';
    ELSIF v_top < 2 THEN
      v_outcome := 'too_few';
      v_winners := '{}';
    ELSIF cardinality(v_leaders) > 2 THEN
      v_outcome := 'split';
      v_winners := '{}';
    ELSE
      v_outcome := 'decided';
      v_winners := v_leaders;
    END IF;

    SELECT COALESCE(SUM(stake), 0)::INTEGER,
           COUNT(*)::INTEGER,
           COALESCE(SUM(stake) FILTER (WHERE player_id = ANY (v_winners)), 0)::INTEGER,
           (COUNT(*) FILTER (WHERE player_id = ANY (v_winners)))::INTEGER
      INTO v_pot, v_prophets, v_winning_stake, v_hits
      FROM prophecy_wagers
      WHERE session_id = p_session_id AND market = v_category AND status = 'pending';

    v_paid := 0;
    FOR v_wager IN
      SELECT * FROM prophecy_wagers
      WHERE session_id = p_session_id AND market = v_category AND status = 'pending'
      ORDER BY created_at
      FOR UPDATE
    LOOP
      IF v_winning_stake = 0 THEN
        UPDATE prophecy_wagers SET status = 'refunded', payout = v_wager.stake, settled_at = now() WHERE id = v_wager.id;
        PERFORM adjust_balance(v_wager.user_id, v_wager.stake, 'prophecy_refunded', v_wager.id);
      ELSIF v_wager.player_id = ANY (v_winners) THEN
        v_payout := FLOOR(v_wager.stake::NUMERIC * v_pot / v_winning_stake);
        UPDATE prophecy_wagers SET status = 'won', payout = v_payout, settled_at = now() WHERE id = v_wager.id;
        PERFORM adjust_balance(v_wager.user_id, v_payout, 'prophecy_won', v_wager.id);
        v_paid := v_paid + v_payout;
      ELSE
        UPDATE prophecy_wagers SET status = 'lost', payout = 0, settled_at = now() WHERE id = v_wager.id;
      END IF;
    END LOOP;

    v_summary := v_summary || jsonb_build_object(v_category, jsonb_build_object(
      'ballots', v_ballots,
      'tallies', v_tallies,
      'winners', to_jsonb(v_winners),
      'names', (SELECT COALESCE(jsonb_agg(p.name ORDER BY p.name), '[]'::jsonb) FROM players p WHERE p.id = ANY (v_winners)),
      'outcome', v_outcome,
      'pot', v_pot,
      'prophets', v_prophets,
      'hits', CASE WHEN v_winning_stake = 0 THEN 0 ELSE v_hits END,
      'paid', v_paid,
      'refunded', v_pot > 0 AND v_winning_stake = 0
    ));

    IF v_category = 'mvp' THEN v_mvp := v_winners; ELSE v_inter := v_winners; END IF;
  END LOOP;

  FOREACH v_player IN ARRAY v_mvp LOOP
    SELECT COALESCE(
      (SELECT auth_user_id FROM players WHERE id = v_player),
      (SELECT id FROM user_profiles WHERE player_id = v_player LIMIT 1)
    ) INTO v_user;
    IF v_user IS NOT NULL AND EXISTS (SELECT 1 FROM point_balances WHERE user_id = v_user) THEN
      PERFORM adjust_balance(v_user, 15, 'mvp_bonus', p_session_id);
      v_bonus_paid := v_bonus_paid || v_player;
    END IF;
  END LOOP;

  v_summary := v_summary || jsonb_build_object('mvp_bonus', 15, 'mvp_bonus_paid', to_jsonb(v_bonus_paid), 'void', v_void);

  UPDATE post_game_votes
  SET status = 'settled', settled_at = now(), mvp_player_ids = v_mvp, inter_player_ids = v_inter, summary = v_summary
  WHERE session_id = p_session_id;

  RETURN v_summary || jsonb_build_object('session_id', p_session_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION vvv_settle_post_game_vote(UUID) FROM PUBLIC, anon, authenticated;

-- Settles every due vote (or only p_session_id's) exactly once and returns what was just settled, so the
-- caller can announce it. Also returns stakes stranded on games that will never get a vote.
-- Safe for anyone to call: it only acts on votes whose window has closed.
CREATE OR REPLACE FUNCTION settle_post_game_votes(p_session_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session_id UUID;
  v_result JSONB;
  v_results JSONB := '[]'::jsonb;
  v_wager RECORD;
BEGIN
  FOR v_session_id IN
    SELECT session_id FROM post_game_votes
    WHERE status = 'open' AND closes_at <= now() AND (p_session_id IS NULL OR session_id = p_session_id)
    ORDER BY closes_at
    LIMIT 20
    FOR UPDATE SKIP LOCKED
  LOOP
    v_result := vvv_settle_post_game_vote(v_session_id);
    IF v_result IS NOT NULL THEN
      v_results := v_results || jsonb_build_array(v_result);
    END IF;
  END LOOP;

  FOR v_wager IN
    SELECT w.* FROM prophecy_wagers w
    JOIN game_sessions s ON s.id = w.session_id
    LEFT JOIN games g ON g.id = s.game_id
    WHERE w.status = 'pending'
      AND (p_session_id IS NULL OR w.session_id = p_session_id)
      AND (
        s.status IN ('canceled', 'expired')
        OR (
          s.status IN ('blue_win', 'red_win')
          AND NOT EXISTS (SELECT 1 FROM post_game_votes v WHERE v.session_id = s.id)
          AND COALESCE(g.played_at, s.updated_at) + interval '5 minutes' <= now()
        )
      )
    FOR UPDATE OF w SKIP LOCKED
  LOOP
    UPDATE prophecy_wagers SET status = 'refunded', payout = v_wager.stake, settled_at = now() WHERE id = v_wager.id;
    PERFORM adjust_balance(v_wager.user_id, v_wager.stake, 'prophecy_refunded', v_wager.id);
  END LOOP;

  RETURN v_results;
END;
$$;

-- Cancel hook: return every pending stake of a game that will not be played out.
CREATE OR REPLACE FUNCTION refund_prophecy_wagers(p_session_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_status TEXT;
  v_wager RECORD;
  v_count INTEGER := 0;
BEGIN
  SELECT status INTO v_status FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_status IN ('blue_win', 'red_win') THEN RAISE EXCEPTION 'prophecy_already_resolved'; END IF;
  IF v_status NOT IN ('canceled', 'expired') AND NOT vvv_can_manage_session(v_uid, p_session_id) THEN
    RAISE EXCEPTION 'prophecy_forbidden';
  END IF;

  FOR v_wager IN
    SELECT * FROM prophecy_wagers WHERE session_id = p_session_id AND status = 'pending' FOR UPDATE
  LOOP
    UPDATE prophecy_wagers SET status = 'refunded', payout = v_wager.stake, settled_at = now() WHERE id = v_wager.id;
    PERFORM adjust_balance(v_wager.user_id, v_wager.stake, 'prophecy_refunded', v_wager.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- PRIVILEGES
-- ============================================================

-- Internal helpers: only the SECURITY DEFINER functions above call them, with the owner's rights.
REVOKE EXECUTE ON FUNCTION vvv_user_is_player(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_can_manage_session(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Sealing and voting need a signed-in caller; lazy opening and settlement stay open to every reader.
REVOKE EXECUTE ON FUNCTION seal_prophecy(UUID, TEXT, UUID, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION cast_post_game_vote(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION seal_prophecy(UUID, TEXT, UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cast_post_game_vote(UUID, TEXT, UUID) TO authenticated, service_role;

-- ============================================================
-- REALTIME
-- ============================================================

SELECT vvv_add_to_realtime('prophecy_wagers');
SELECT vvv_add_to_realtime('post_game_votes');
SELECT vvv_add_to_realtime('post_game_ballots');
