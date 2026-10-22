-- Phase 11: lockdown. RUN LAST.
--
-- Run order:
--   1. Deploy the app version that ships this file (it calls the guarded functions and only falls back to the
--      old direct writes while those functions are missing).
--   2. Run every phase10 file, in this order: foundation, live-sync, push, titles, prophecy-vote, chaos, betting,
--      praise, riddles, duels, bounties-shame, lobby, coach-champions, storytelling, dedupe-games, hardening,
--      title-effects. phase10_all.sql holds every one of them in that order, so running it is the same thing.
--   3. Check the site works (declare a game, place a bet, claim the daily stipend, add a roster player...).
--   4. Run this file between games (no game in progress). Idempotent: running it again changes nothing.
--
-- What it protects, now that every legitimate write goes through a SECURITY DEFINER function:
--   * Points minting. adjust_balance and the legacy settle/refund functions (resolve_bets, refund_all_bets,
--     resolve_chaos_wagers, refund_chaos_actions, resolve_bounties) and claim_daily_bonus(p_user_id) take any
--     arguments from any caller: they are revoked from anon and signed-in users. The guarded functions keep using
--     them with the owner's rights, so nothing that runs inside a function is affected.
--   * Identity takeover. players gets row level security with a public read policy and no client write policy:
--     is_admin, auth_user_id and the win counters can only change through the hardening functions.
--     user_profiles.player_id (who you answer to on the roster) can only be set by claim_player().
--   * Points-bearing rows the database pays out later. Clients can no longer write unpaid bets, unpaid decrees,
--     legacy bounties, act awards, their own starting treasury, ledger rows, game seats or unpaid pillory posts.
--     All of them are written by functions only.
--   * Narrow guards on tables the app still writes directly, limited to what the app itself never does:
--     the host of a game (game_sessions.created_by, trusted by every settle and refund function) cannot be
--     rewritten, a game only moves forward through its phases (the app's own transitions, by the people the app
--     lets make them), a finished or canceled game is final, only a fresh draft can be deleted, the seats of a
--     game (session_assignments) freeze when the draft ends, a recorded game row cannot be edited or deleted,
--     acts and act snapshots are admin-only, and titles can only be self-engraved when they are free honors (no
--     free shop perks, no forged brands, no repricing).
--
-- Not locked, because the app still writes them directly as the user and a lockdown would break it:
--   game_sessions phase moves and the declare claim, games inserts   the session lifecycle (guarded above)
--   session_assignments during the draft, titles / user_titles honors   lobby draft, award and milestone engraving
--   daily_fearless, player_queue (narrow guard in phase10_lobby.sql), vainqueur_state, coach_draft_picks,
--   prophecies (legacy), champion_roles
--
-- Privileges are revoked, not only policies, so re-running any phase10 file afterwards does not reopen a door.
-- If the old app version must come back after this file ran, expect it to break: it moves points through
-- adjust_balance and writes players directly.

DO $$
DECLARE
  v_fn TEXT;
  v_missing TEXT[] := '{}';
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'record_game_outcome(uuid)',
    'claim_player(uuid)',
    'admin_add_player(text)',
    'admin_update_player(uuid, text, boolean)',
    'admin_delete_player(uuid)',
    'claim_act_award(uuid)',
    'claim_act_consolation(integer)',
    'admin_record_act_awards(integer, jsonb)',
    'admin_reset_economy(text, text, integer)',
    'init_my_point_balance()',
    'claim_my_daily_bonus()',
    'place_bet_v2(uuid, text, integer, boolean, boolean, integer, integer)',
    'resolve_bets_v2(uuid, text)',
    'refund_all_bets_v2(uuid)',
    'chaos_issue_decree(uuid, text, text, uuid, uuid)',
    'resolve_chaos_wagers_v2(uuid, text, uuid)',
    'refund_chaos_actions_v2(uuid)',
    'bounty_settle_session(uuid)',
    'pillory_post(uuid, text, text, text, jsonb, jsonb)',
    'buy_title(uuid, uuid)',
    'equip_title(uuid)',
    'apply_title_perk(uuid, uuid, text, text, integer, text, uuid)',
    'equip_loadout(uuid[])',
    'claim_my_daily_stipend()'
  ] LOOP
    IF to_regprocedure(v_fn) IS NULL THEN
      v_missing := v_missing || v_fn;
    END IF;
  END LOOP;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'phase11_lockdown.sql needs every phase10 file first. Missing: %', array_to_string(v_missing, ', ');
  END IF;
END $$;

-- ============================================================
-- 1. MONEY FUNCTIONS: owner and service_role only
-- ============================================================

REVOKE EXECUTE ON FUNCTION adjust_balance(UUID, INTEGER, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resolve_bets(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION refund_all_bets(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resolve_chaos_wagers(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION refund_chaos_actions(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resolve_bounties(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
-- Anyone could claim anybody's stipend with it. The app calls claim_my_daily_bonus() (caller only) instead.
REVOKE EXECUTE ON FUNCTION claim_daily_bonus(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION adjust_balance(UUID, INTEGER, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION resolve_bets(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION refund_all_bets(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION resolve_chaos_wagers(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION refund_chaos_actions(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION resolve_bounties(UUID, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION claim_daily_bonus(UUID) TO service_role;

-- ============================================================
-- 2. PLAYERS: public read, writes through functions only
-- ============================================================

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "players_read" ON players;
CREATE POLICY "players_read" ON players FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON players FROM anon, authenticated;

-- The roster link on a profile is identity too (self-vote checks, decree seats, bounty and MVP payouts read it).
-- Profiles stay editable by their owner (Discord name and avatar), but only claim_player() sets player_id.
CREATE OR REPLACE FUNCTION vvv_user_profiles_guard() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF (TG_OP = 'INSERT' AND NEW.player_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.player_id IS DISTINCT FROM OLD.player_id) THEN
    RAISE EXCEPTION 'profile:player_link_locked' USING ERRCODE = '42501',
      HINT = 'Claim a player through claim_player().';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION vvv_user_profiles_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vvv_user_profiles_guard ON user_profiles;
CREATE TRIGGER vvv_user_profiles_guard
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION vvv_user_profiles_guard();

-- ============================================================
-- 3. ROWS THE DATABASE PAYS OUT LATER: functions only
-- ============================================================

-- Treasuries and the ledger: init_my_point_balance() and admin_reset_economy() replace the client writes.
DROP POLICY IF EXISTS "balances_insert" ON point_balances;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON point_balances FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON point_transactions FROM anon, authenticated;

-- An unpaid "legacy" bet row was refunded (or paid) at settlement: place_bet_v2() is the only writer now.
DROP POLICY IF EXISTS "bets_insert" ON bets;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON bets FROM anon, authenticated;

-- Decrees: chaos_issue_decree() charges and logs in one transaction.
DROP POLICY IF EXISTS "chaos_insert" ON chaos_actions;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON chaos_actions FROM anon, authenticated;

-- Legacy bounty rows are still paid by bounty_settle_session(): nothing in the app writes them anymore.
ALTER TABLE bounties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bounties_read" ON bounties;
CREATE POLICY "bounties_read" ON bounties FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON bounties FROM anon, authenticated;

-- Act awards carry claimable bonuses: admin_record_act_awards() writes them, claim_act_award() pays them.
ALTER TABLE act_awards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "act_awards_read" ON act_awards;
CREATE POLICY "act_awards_read" ON act_awards FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON act_awards FROM anon, authenticated;

-- Game seats decide counters and bounty hunters: record_game_outcome() writes them.
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "game_players_read" ON game_players;
CREATE POLICY "game_players_read" ON game_players FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON game_players FROM anon, authenticated;

-- Pillory posts are paid through pillory_post(); the legacy direct insert skipped the payment.
DROP POLICY IF EXISTS "shame_insert" ON shame_entries;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON shame_entries FROM anon, authenticated;

-- TRUNCATE ignores row level security. Nothing in the app (or PostgREST) uses it.
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- ============================================================
-- 4. GUARDS ON TABLES THE APP STILL WRITES DIRECTLY
-- Each one only refuses writes the app never makes (checked against every client write in app/ and lib/).
-- Functions run as the owner and are never affected.
-- ============================================================

-- The host and the lifecycle. Every settle and refund function trusts created_by and the status, and the seat
-- freeze below only holds if a game can never go back to its draft. Clients get exactly the moves the app makes:
--   insert   a fresh draft or coach draft hosted by the caller, nothing claimed or linked yet
--   forward  coach_draft -> draft (host, admin or a coach), draft -> chaos (host or admin), chaos -> betting and
--            betting -> in_game (host or admin anytime, anyone else once the timer ran out, 5 s of clock slack)
--   back     draft -> coach_draft only while no seat exists (the coach confirm rollback)
--   finish   in_game -> blue_win / red_win by the host or an admin holding the claim, only for the game that
--            record_game_outcome() recorded with that winner
--   cancel   any live phase -> canceled by the host or an admin, never once a game is linked
--   claim    resolved_by and game_id move only while in_game, by the host or an admin, for themselves
-- A finished or canceled game is final, the host and coaches never change, and each timer is only set when its
-- phase opens. The app only deletes a draft it just created (when seating failed).
CREATE OR REPLACE FUNCTION vvv_game_sessions_host_guard() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_manager BOOLEAN;
  v_coach BOOLEAN;
  v_ok BOOLEAN;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_uid IS NULL OR NEW.created_by IS DISTINCT FROM v_uid OR NEW.status NOT IN ('coach_draft', 'draft')
       OR NEW.game_id IS NOT NULL OR NEW.resolved_by IS NOT NULL THEN
      RAISE EXCEPTION 'session:host_locked' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status NOT IN ('coach_draft', 'draft') OR v_uid IS NULL OR OLD.created_by IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'session:host_locked' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.blue_coach_id IS DISTINCT FROM OLD.blue_coach_id
     OR NEW.red_coach_id IS DISTINCT FROM OLD.red_coach_id
     OR NEW.game_mode IS DISTINCT FROM OLD.game_mode THEN
    RAISE EXCEPTION 'session:host_locked' USING ERRCODE = '42501';
  END IF;

  v_manager := v_uid IS NOT NULL AND (
    OLD.created_by IS NULL OR OLD.created_by = v_uid
    OR EXISTS (SELECT 1 FROM players WHERE auth_user_id = v_uid AND is_admin)
  );
  v_coach := v_uid IS NOT NULL AND v_uid IN (OLD.blue_coach_id, OLD.red_coach_id);

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_ok := CASE
      WHEN OLD.status = 'coach_draft' AND NEW.status = 'draft' THEN v_manager OR v_coach
      WHEN OLD.status = 'draft' AND NEW.status = 'coach_draft' THEN
        (v_manager OR v_coach) AND NOT EXISTS (SELECT 1 FROM session_assignments WHERE session_id = OLD.id)
      WHEN OLD.status = 'draft' AND NEW.status = 'chaos' THEN v_manager
      WHEN OLD.status = 'chaos' AND NEW.status = 'betting' THEN
        v_manager OR OLD.chaos_ends_at IS NULL OR OLD.chaos_ends_at <= now() + interval '5 seconds'
      WHEN OLD.status = 'betting' AND NEW.status = 'in_game' THEN
        v_manager OR OLD.betting_ends_at IS NULL OR OLD.betting_ends_at <= now() + interval '5 seconds'
      WHEN OLD.status = 'in_game' AND NEW.status IN ('blue_win', 'red_win') THEN
        v_manager AND NEW.game_id IS NOT NULL AND NEW.resolved_by = v_uid
        AND EXISTS (
          SELECT 1 FROM game_outcome_records r
          WHERE r.session_id = OLD.id AND r.game_id = NEW.game_id AND r.winner_side || '_win' = NEW.status
        )
      WHEN OLD.status IN ('coach_draft', 'draft', 'chaos', 'betting', 'in_game') AND NEW.status = 'canceled' THEN
        v_manager AND NEW.game_id IS NULL AND (NEW.resolved_by IS NULL OR NEW.resolved_by = v_uid)
      ELSE false
    END;
    IF NOT COALESCE(v_ok, false) THEN
      RAISE EXCEPTION 'session:phase_locked' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF (NEW.chaos_ends_at IS DISTINCT FROM OLD.chaos_ends_at AND NOT (OLD.status = 'draft' AND NEW.status = 'chaos'))
     OR (NEW.betting_ends_at IS DISTINCT FROM OLD.betting_ends_at AND NOT (OLD.status = 'chaos' AND NEW.status = 'betting')) THEN
    RAISE EXCEPTION 'session:phase_locked' USING ERRCODE = '42501';
  END IF;

  IF NOT (OLD.status <> 'canceled' AND NEW.status = 'canceled')
     AND (NEW.resolved_by IS DISTINCT FROM OLD.resolved_by OR NEW.game_id IS DISTINCT FROM OLD.game_id)
     AND NOT (
       v_manager AND OLD.status = 'in_game'
       AND (NEW.resolved_by IS NULL OR NEW.resolved_by = v_uid)
       AND (NEW.game_id IS NOT DISTINCT FROM OLD.game_id OR NEW.resolved_by = v_uid)
     ) THEN
    RAISE EXCEPTION 'session:claim_locked' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION vvv_game_sessions_host_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vvv_game_sessions_host_guard ON game_sessions;
CREATE TRIGGER vvv_game_sessions_host_guard
  BEFORE INSERT OR UPDATE OR DELETE ON game_sessions
  FOR EACH ROW EXECUTE FUNCTION vvv_game_sessions_host_guard();

-- Recorded games. The declare flow inserts a game row and, when recording fails before anything landed, deletes
-- it again. A recorded game (seats or an outcome record) is history: no client edits or deletes it.
CREATE OR REPLACE FUNCTION vvv_games_guard() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE'
     OR EXISTS (SELECT 1 FROM game_players WHERE game_id = OLD.id)
     OR EXISTS (SELECT 1 FROM game_outcome_records WHERE game_id = OLD.id) THEN
    RAISE EXCEPTION 'games:recorded' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION vvv_games_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vvv_games_guard ON games;
CREATE TRIGGER vvv_games_guard
  BEFORE UPDATE OR DELETE ON games
  FOR EACH ROW EXECUTE FUNCTION vvv_games_guard();

-- The seats. The lobby writes them during the draft only, as the host, an admin or a coach (create, coach
-- confirm, reroll, locks); decrees change them later through chaos_issue_decree(). Counters, game points and
-- bounty hunters are read from the seats at declare time, so a seat swapped mid-game was a free win.
CREATE OR REPLACE FUNCTION vvv_session_assignments_guard() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session UUID;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  FOREACH v_session IN ARRAY CASE TG_OP
    WHEN 'INSERT' THEN ARRAY[NEW.session_id]
    WHEN 'DELETE' THEN ARRAY[OLD.session_id]
    ELSE ARRAY[OLD.session_id, NEW.session_id]
  END LOOP
    IF v_uid IS NULL OR NOT EXISTS (
      SELECT 1 FROM game_sessions s
      WHERE s.id = v_session AND s.status IN ('coach_draft', 'draft')
        AND (
          s.created_by IS NULL OR v_uid IN (s.created_by, s.blue_coach_id, s.red_coach_id)
          OR EXISTS (SELECT 1 FROM players WHERE auth_user_id = v_uid AND is_admin)
        )
    ) THEN
      RAISE EXCEPTION 'session:seats_locked' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION vvv_session_assignments_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vvv_session_assignments_guard ON session_assignments;
CREATE TRIGGER vvv_session_assignments_guard
  BEFORE INSERT OR UPDATE OR DELETE ON session_assignments
  FOR EACH ROW EXECUTE FUNCTION vvv_session_assignments_guard();

-- Acts. Only the admin archive and new act routes write them; the active act's initial_grant is every new
-- treasury's starting purse and an archived act's snapshots unlock consolation titles.
CREATE OR REPLACE FUNCTION vvv_admin_writes_guard() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM players WHERE auth_user_id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION '%:admin_only', TG_TABLE_NAME USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION vvv_admin_writes_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vvv_admin_writes_guard ON acts;
CREATE TRIGGER vvv_admin_writes_guard
  BEFORE INSERT OR UPDATE OR DELETE ON acts
  FOR EACH ROW EXECUTE FUNCTION vvv_admin_writes_guard();

DROP TRIGGER IF EXISTS vvv_admin_writes_guard ON act_snapshots;
CREATE TRIGGER vvv_admin_writes_guard
  BEFORE INSERT OR UPDATE OR DELETE ON act_snapshots
  FOR EACH ROW EXECUTE FUNCTION vvv_admin_writes_guard();

-- Titles. Equipped titles pay perks and brands pay tribute through apply_title_perk(). The app engraves free
-- honors (category award, price 0) for the caller; buying, equipping, branding and lifting go through
-- buy_title(), equip_title() and lift_title_curse().
CREATE OR REPLACE FUNCTION vvv_titles_guard() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP <> 'INSERT' OR NEW.category IS DISTINCT FROM 'award' OR COALESCE(NEW.price, 0) <> 0 THEN
    RAISE EXCEPTION 'titles:locked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION vvv_user_titles_guard() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP <> 'INSERT'
     OR auth.uid() IS NULL
     OR NEW.user_id IS DISTINCT FROM auth.uid()
     OR NEW.assigned_by IS NOT NULL
     OR NEW.is_active
     OR NOT EXISTS (SELECT 1 FROM titles WHERE id = NEW.title_id AND category = 'award' AND COALESCE(price, 0) = 0) THEN
    RAISE EXCEPTION 'titles:locked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION vvv_titles_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_user_titles_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vvv_titles_guard ON titles;
CREATE TRIGGER vvv_titles_guard
  BEFORE INSERT OR UPDATE OR DELETE ON titles
  FOR EACH ROW EXECUTE FUNCTION vvv_titles_guard();

DROP TRIGGER IF EXISTS vvv_user_titles_guard ON user_titles;
CREATE TRIGGER vvv_user_titles_guard
  BEFORE INSERT OR UPDATE OR DELETE ON user_titles
  FOR EACH ROW EXECUTE FUNCTION vvv_user_titles_guard();

NOTIFY pgrst, 'reload schema';
