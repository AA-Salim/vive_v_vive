-- Phase 11: lockdown. RUN LAST.
--
-- Run order:
--   1. Deploy the app version that ships this file (it calls the guarded functions and only falls back to the
--      old direct writes while those functions are missing).
--   2. Run every phase10 file, in this order: foundation, live-sync, titles, prophecy-vote, chaos, betting,
--      praise, duels, bounties-shame, lobby, storytelling, hardening.
--   3. Check the site works (declare a game, place a bet, claim the daily stipend, add a roster player...).
--   4. Run this file. Idempotent: running it again changes nothing.
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
--     rewritten and only a fresh draft can be deleted, the seats of a game (session_assignments) freeze when the
--     draft ends, a recorded game row cannot be edited or deleted, acts and act snapshots are admin-only, and
--     titles can only be self-engraved when they are free honors (no free shop perks, no forged brands, no
--     repricing).
--
-- Not locked, because the app still writes them directly as the user and a lockdown would break it:
--   game_sessions (status, resolved_by, game_id), games   the session lifecycle and the declare claim
--   session_assignments during the draft, titles / user_titles honors   lobby draft, award and milestone engraving
--   daily_fearless, player_queue, vainqueur_state, coach_draft_picks, prophecies (legacy), champion_roles
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
    'apply_title_perk(uuid, uuid, text, text, integer, text, uuid)'
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

-- The host. Sessions are created with created_by = the signed-in creator and nothing ever changes it, but anyone
-- could rewrite it and then settle, refund or cancel someone else's live game through the v2 functions. The app
-- only deletes a draft it just created (when seating failed); deleting anything else wiped bets, decrees and
-- stakes through the cascades.
CREATE OR REPLACE FUNCTION vvv_game_sessions_host_guard() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF (TG_OP = 'INSERT' AND (auth.uid() IS NULL OR NEW.created_by IS DISTINCT FROM auth.uid()))
     OR (TG_OP = 'UPDATE' AND NEW.created_by IS DISTINCT FROM OLD.created_by)
     OR (TG_OP = 'DELETE' AND (OLD.status NOT IN ('coach_draft', 'draft') OR OLD.created_by IS DISTINCT FROM auth.uid())) THEN
    RAISE EXCEPTION 'session:host_locked' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION vvv_game_sessions_host_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vvv_game_sessions_host_guard ON game_sessions;
CREATE TRIGGER vvv_game_sessions_host_guard
  BEFORE INSERT OR UPDATE OF created_by OR DELETE ON game_sessions
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

-- The seats. The lobby writes them during the draft only (create, coach confirm, reroll, locks); decrees change
-- them later through chaos_issue_decree(). Counters, game points and bounty hunters are read from the seats at
-- declare time, so a seat swapped mid-game was a free win.
CREATE OR REPLACE FUNCTION vvv_session_assignments_guard() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF (TG_OP IN ('UPDATE', 'DELETE') AND NOT EXISTS (
        SELECT 1 FROM game_sessions WHERE id = OLD.session_id AND status IN ('coach_draft', 'draft')))
     OR (TG_OP IN ('INSERT', 'UPDATE') AND NOT EXISTS (
        SELECT 1 FROM game_sessions WHERE id = NEW.session_id AND status IN ('coach_draft', 'draft'))) THEN
    RAISE EXCEPTION 'session:seats_locked' USING ERRCODE = '42501';
  END IF;
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
