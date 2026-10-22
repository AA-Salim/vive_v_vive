-- Phase 10: Titles that matter. Perks, curses, and dignity buybacks.
-- Additive and idempotent: safe to run while the previous app version is deployed.
-- Requires phase10_foundation.sql (free-form point_transactions reasons).
-- Rules mirrored in lib/titles/rules.ts: a curse brands its wearer for 8 resolved games, a wearer
-- carries at most 2 curses, dignity costs 1x the title price, one perk moves at most 60 points per game
-- and a perk can cost its own wearer at most 10. Each title also has its own cap (title_perk_caps, seeded
-- from lib/titles/perks.ts), and a perk only pays someone who took part in the game. A loadout's perks share
-- 60 points per wearer per game (vvv_title_perk_room, phase10_title-effects.sql).
-- New point reasons: title_perk, title_curse (paid by a branded wearer), title_tribute (received by the
-- bestower), title_dignity (brand bought back).

-- ============================================================
-- PERK LEDGER: one row per (game, wearer, title), so every perk is one-shot.
-- ============================================================

CREATE TABLE IF NOT EXISTS title_perk_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('perk', 'curse')),
  amount INTEGER NOT NULL DEFAULT 0,
  beneficiary_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id, title_name)
);

CREATE INDEX IF NOT EXISTS idx_title_perk_applications_user
  ON title_perk_applications (user_id, created_at DESC);

ALTER TABLE title_perk_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "title_perk_applications_read" ON title_perk_applications;
CREATE POLICY "title_perk_applications_read" ON title_perk_applications FOR SELECT USING (true);

-- ============================================================
-- PERK CAPS: the most one title can move in one game. Mirrors perkFor() in lib/titles/perks.ts (each
-- definition's cap, never above the 60 point ceiling): change both together. Lookup order is the same as
-- perkFor(): the exact title name (shop, milestone and consolation titles), then the act award kind parsed
-- from "Act <n> <Award>", then the title's category. Re-running this file resets the table to these values.
-- ============================================================

CREATE TABLE IF NOT EXISTS title_perk_caps (
  scope TEXT NOT NULL CHECK (scope IN ('title', 'act_award', 'category')),
  key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('perk', 'curse')),
  cap INTEGER NOT NULL CHECK (cap BETWEEN 1 AND 60),
  PRIMARY KEY (scope, key)
);

ALTER TABLE title_perk_caps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "title_perk_caps_read" ON title_perk_caps;
CREATE POLICY "title_perk_caps_read" ON title_perk_caps FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON title_perk_caps FROM anon, authenticated;

WITH seed (scope, key, kind, cap) AS (
  VALUES
    ('title', 'Kingslayer', 'perk', 60),
    ('title', 'The Usurper', 'perk', 8),
    ('title', 'Crown Thief', 'perk', 8),
    ('title', 'The Disrespector', 'perk', 40),
    ('title', 'The One Who Stopped Kneeling', 'perk', 16),
    ('title', 'Still Kneeling', 'perk', 8),
    ('title', 'Throne Polisher', 'perk', 12),
    ('title', 'The Holdout', 'perk', 40),
    ('title', 'Last Loyalist', 'perk', 60),
    ('title', 'Copium Dealer', 'perk', 24),
    ('title', 'Baron Caller (Derogatory)', 'perk', 10),
    ('title', 'The 0/8 Powerspike', 'perk', 30),
    ('title', 'Delayed Victory Specialist', 'perk', 8),
    ('title', 'Main Character (Self-Diagnosed)', 'perk', 60),
    ('title', 'El Goblino Pequeno', 'perk', 15),
    ('title', 'Court Jester', 'curse', 50),
    ('title', 'Boot Licker', 'curse', 6),
    ('title', 'Royal Carpet', 'curse', 10),
    ('title', 'Salaxe''s Emotional Support', 'curse', 10),
    ('title', 'The Crawling One', 'curse', 40),
    ('title', 'Summoned', 'perk', 1),
    ('title', 'Committed to the Rift', 'perk', 1),
    ('title', 'The Regular', 'perk', 2),
    ('title', 'Can''t Stop Won''t Stop', 'perk', 2),
    ('title', 'Half-Century Club', 'perk', 2),
    ('title', 'Grass Is a Myth', 'perk', 3),
    ('title', 'Vive v Vive Addict', 'perk', 3),
    ('title', 'This Game Is My Personality', 'perk', 3),
    ('title', 'First Taste of Victory', 'perk', 2),
    ('title', 'Winner By Habit', 'perk', 3),
    ('title', 'The Carry', 'perk', 4),
    ('title', 'Unkillable Legacy', 'perk', 5),
    ('title', 'At Least You Tried', 'perk', 3),
    ('title', 'Coinflip Merchant', 'perk', 6),
    ('title', 'Random Champs, Calculated Wins', 'perk', 6),
    ('title', 'Baby Gambler', 'perk', 10),
    ('title', 'Degenerate In Training', 'perk', 15),
    ('title', 'Can''t Help Myself', 'perk', 20),
    ('title', 'The House Should Be Worried', 'perk', 25),
    ('title', 'Lucky Guess', 'perk', 10),
    ('title', 'Fortune''s Favorite', 'perk', 20),
    ('title', 'The Oracle', 'perk', 30),
    ('title', 'Pocket Change', 'perk', 1),
    ('title', 'Stacking Paper', 'perk', 2),
    ('title', 'Economy Enjoyer', 'perk', 3),
    ('title', 'Walking Treasury', 'perk', 4),
    ('title', 'Salaxe Appreciator', 'perk', 3),
    ('title', 'Devoted Servant', 'perk', 5),
    ('title', 'Down Horrendous For Salaxe', 'perk', 8),
    ('title', 'First Blood (Emotional)', 'perk', 3),
    ('title', 'Community Punching Bag', 'perk', 5),
    ('title', 'Shame Sponge', 'perk', 8),
    ('title', 'Mischief Maker', 'perk', 6),
    ('title', 'Chaos Enjoyer', 'perk', 10),
    ('title', 'Chaos Incarnate', 'perk', 15),
    ('title', 'Bounty Poster', 'perk', 20),
    ('title', 'Most Wanted Printer', 'perk', 40),
    ('title', 'Salaxe''s Background Character', 'perk', 2),
    ('title', 'Court Jester (Unpaid)', 'perk', 2),
    ('title', 'Throne Room Tourist', 'perk', 2),
    ('title', 'The One Who Was There', 'perk', 2),
    ('title', 'Salaxe''s Tax Write-Off', 'perk', 2),
    ('title', 'Professional Bystander', 'perk', 2),
    ('title', 'Royal Seat Warmer', 'perk', 2),
    ('title', 'The Forgettable', 'perk', 2),
    ('title', 'Act I Survivor (Barely)', 'perk', 2),
    ('title', 'Salaxe''s Emotional Baggage', 'perk', 2),
    ('title', 'Crown Witness (Did Not Touch It)', 'perk', 2),
    ('title', 'The NPC', 'perk', 2),
    ('title', 'Vive v Vive Benchwarmer', 'perk', 2),
    ('title', 'Salaxe''s Least Favorite', 'perk', 2),
    ('title', 'The One Who Showed Up', 'perk', 2),
    ('title', 'Royal Court Filler', 'perk', 2),
    ('title', 'Act I: Participated', 'perk', 2),
    ('title', 'Charamil''s Most Average', 'perk', 2),
    ('title', 'Almost Relevant', 'perk', 2),
    ('title', 'Salaxe''s Forgotten Minion', 'perk', 2),
    ('act_award', 'grand champion', 'perk', 5),
    ('act_award', 'warrior', 'perk', 5),
    ('act_award', 'iron man', 'perk', 3),
    ('act_award', 'degenerate', 'perk', 30),
    ('act_award', 'devotee', 'perk', 8),
    ('act_award', 'punching bag', 'perk', 6),
    ('category', 'rebellion', 'perk', 4),
    ('category', 'loyalty', 'perk', 4),
    ('category', 'absurd', 'perk', 6),
    ('category', 'mockery', 'curse', 4),
    ('category', 'award', 'perk', 1)
), upserted AS (
  INSERT INTO title_perk_caps (scope, key, kind, cap)
  SELECT scope, key, kind, cap FROM seed
  ON CONFLICT (scope, key) DO UPDATE SET kind = EXCLUDED.kind, cap = EXCLUDED.cap
  RETURNING 1
)
DELETE FROM title_perk_caps c
WHERE NOT EXISTS (SELECT 1 FROM seed s WHERE s.scope = c.scope AND s.key = c.key);

-- Same pattern as ACT_AWARD_PATTERN in lib/titles/perks.ts.
CREATE OR REPLACE FUNCTION vvv_title_perk_cap(p_title_name TEXT, p_category TEXT)
RETURNS TABLE (kind TEXT, cap INTEGER)
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT c.kind, c.cap
  FROM title_perk_caps c
  WHERE (c.scope = 'title' AND c.key = p_title_name)
     OR (c.scope = 'act_award' AND c.key = lower(substring(
          btrim(p_title_name)
          FROM '(?i)^Act\s+(?:[IVXLC]+|\d+):?\s+(Grand Champion|Warrior|Iron Man|Degenerate|Devotee|Punching Bag)$'
        )))
     OR (c.scope = 'category' AND c.key = p_category)
  ORDER BY CASE c.scope WHEN 'title' THEN 0 WHEN 'act_award' THEN 1 ELSE 2 END
  LIMIT 1
$$;

-- Took part in the game: a seat (through either account link), a settled bet of at least MIN_STAKE (25,
-- lib/titles/rules.ts), a decree that was not refunded, a bounty collected on it, a duel fought on it or a
-- prophecy sealed on it. The tables of later phase10 files are only read once they exist.
CREATE OR REPLACE FUNCTION vvv_title_perk_involved(p_session_id UUID, p_user_id UUID) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1 FROM session_assignments sa
    WHERE sa.session_id = p_session_id
      AND (
        sa.player_id IN (SELECT p.id FROM players p WHERE p.auth_user_id = p_user_id)
        OR sa.player_id IN (SELECT up.player_id FROM user_profiles up WHERE up.id = p_user_id AND up.player_id IS NOT NULL)
      )
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM bets
    WHERE session_id = p_session_id AND user_id = p_user_id AND status IN ('won', 'lost') AND amount >= 25
  ) OR EXISTS (
    SELECT 1 FROM chaos_actions
    WHERE session_id = p_session_id AND user_id = p_user_id AND status <> 'refunded'
  ) OR EXISTS (
    SELECT 1 FROM point_transactions
    WHERE reference_id = p_session_id AND user_id = p_user_id AND reason = 'bounty_claimed' AND amount > 0
  ) THEN
    RETURN true;
  END IF;

  -- Separate statements: plpgsql plans a whole expression at once, missing tables included.
  IF to_regclass('public.duels') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM duels
      WHERE session_id = p_session_id
        AND status IN ('accepted', 'won', 'lost')
        AND (challenger_id = p_user_id OR opponent_id = p_user_id)
    ) THEN
      RETURN true;
    END IF;
  END IF;

  IF to_regclass('public.prophecy_wagers') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM prophecy_wagers
      WHERE session_id = p_session_id AND user_id = p_user_id AND status <> 'refunded'
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

-- ============================================================
-- DUPLICATE ACT AWARDS: keep the "Act I ..." names, move owners, drop the "Act 1 ..." copies.
-- ============================================================

DO $$
DECLARE
  dup RECORD;
  canonical UUID;
BEGIN
  FOR dup IN SELECT id, name FROM titles WHERE name LIKE 'Act 1 %' LOOP
    SELECT id INTO canonical FROM titles WHERE name = 'Act I ' || substring(dup.name FROM 7);

    IF canonical IS NULL THEN
      UPDATE titles SET name = 'Act I ' || substring(dup.name FROM 7) WHERE id = dup.id;
      CONTINUE;
    END IF;

    UPDATE user_titles keep SET is_active = keep.is_active OR copy.is_active
    FROM user_titles copy
    WHERE copy.title_id = dup.id AND keep.title_id = canonical AND keep.user_id = copy.user_id;

    DELETE FROM user_titles copy USING user_titles keep
    WHERE copy.title_id = dup.id AND keep.title_id = canonical AND keep.user_id = copy.user_id;

    UPDATE user_titles SET title_id = canonical WHERE title_id = dup.id;
    DELETE FROM titles WHERE id = dup.id;
  END LOOP;

  -- Unclaimed Act I awards must resolve to the canonical title when they are claimed later.
  UPDATE act_awards SET title = 'Act I ' || substring(title FROM 7)
  WHERE title LIKE 'Act 1 %' AND act_id IN (SELECT id FROM acts WHERE act_number = 1);
END $$;

-- ============================================================
-- ONE EQUIPPED TITLE PER USER (perks pay real points now). Keep the most recent if several are active.
-- Loadouts (phase10_title-effects.sql) replace this rule: once they exist, re-running this file keeps them.
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.title_slot_rules') IS NULL THEN
    UPDATE user_titles ut SET is_active = false
    WHERE ut.is_active AND EXISTS (
      SELECT 1 FROM user_titles other
      WHERE other.user_id = ut.user_id AND other.is_active
        AND (other.created_at, other.id) > (ut.created_at, ut.id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_titles_one_active ON user_titles (user_id) WHERE is_active;
  END IF;
END $$;

-- ============================================================
-- CURSE CLOCK: resolved games created after a brand was applied.
-- ============================================================

CREATE OR REPLACE FUNCTION vvv_curse_games_served(p_since TIMESTAMPTZ, p_exclude UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER FROM game_sessions
  WHERE status IN ('blue_win', 'red_win')
    AND created_at > p_since
    AND (p_exclude IS NULL OR id <> p_exclude)
$$;

-- Titles are sealed while a game is live (a stale session older than 3 hours does not count).
CREATE OR REPLACE FUNCTION vvv_titles_locked() RETURNS BOOLEAN
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM game_sessions
    WHERE status = 'in_game' AND updated_at > now() - interval '3 hours'
  )
$$;

-- ============================================================
-- BUY OR BESTOW A TITLE (atomic: charge + grant, or nothing)
-- ============================================================

CREATE OR REPLACE FUNCTION buy_title(p_title_id UUID, p_target_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_title titles%ROWTYPE;
  v_recipient UUID;
  v_existing user_titles%ROWTYPE;
  v_has_existing BOOLEAN := false;
  v_is_curse BOOLEAN;
  v_active_curses INTEGER;
  v_row_id UUID;
  v_balance INTEGER;
  v_price INTEGER;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_title FROM titles WHERE id = p_title_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'title_not_found'; END IF;
  IF v_title.category = 'award' OR v_title.price <= 0 THEN RAISE EXCEPTION 'not_for_sale'; END IF;

  v_is_curse := NOT v_title.for_self;
  v_recipient := CASE WHEN v_title.for_self THEN v_caller ELSE p_target_user_id END;
  IF v_recipient IS NULL THEN RAISE EXCEPTION 'target_required'; END IF;
  IF v_is_curse AND v_recipient = v_caller THEN RAISE EXCEPTION 'self_target'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_recipient) THEN RAISE EXCEPTION 'target_not_found'; END IF;

  -- Serialize title changes per recipient so ownership and curse limits cannot race.
  PERFORM pg_advisory_xact_lock(hashtext('vvv_titles:' || v_recipient::TEXT));

  SELECT * INTO v_existing FROM user_titles WHERE user_id = v_recipient AND title_id = p_title_id;
  v_has_existing := FOUND;

  IF v_has_existing AND (
    NOT v_is_curse
    OR v_existing.assigned_by IS NULL
    OR vvv_curse_games_served(v_existing.created_at) < 8
  ) THEN
    RAISE EXCEPTION 'already_owned';
  END IF;

  IF v_is_curse THEN
    SELECT count(*) INTO v_active_curses
    FROM user_titles ut
    JOIN titles t ON t.id = ut.title_id
    WHERE ut.user_id = v_recipient
      AND t.for_self = false
      AND ut.assigned_by IS NOT NULL
      AND vvv_curse_games_served(ut.created_at) < 8;
    IF v_active_curses >= 2 THEN RAISE EXCEPTION 'curse_limit'; END IF;
  END IF;

  -- Title effects (phase10_title-effects.sql): The Disrespector curses for less.
  v_price := CASE WHEN v_is_curse THEN vvv_title_scaled(v_caller, 'bestow_cost_pct', v_title.price) ELSE v_title.price END;
  v_balance := adjust_balance(v_caller, -v_price, 'title_bought', p_title_id);

  IF v_has_existing THEN
    -- An expired brand can be burned in again: the clock restarts and the tribute goes to the new bestower.
    UPDATE user_titles SET assigned_by = v_caller, created_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_row_id;
  ELSE
    INSERT INTO user_titles (user_id, title_id, assigned_by, is_active)
    VALUES (v_recipient, p_title_id, CASE WHEN v_is_curse THEN v_caller END, false)
    RETURNING id INTO v_row_id;
  END IF;

  RETURN jsonb_build_object(
    'user_title_id', v_row_id,
    'title', v_title.name,
    'recipient', v_recipient,
    'rebranded', v_has_existing,
    'price', v_price,
    'list_price', v_title.price,
    'balance', v_balance,
    'title_effects', vvv_title_fx_take()
  );
END;
$$;

-- ============================================================
-- EQUIP (or unequip with NULL) the caller's title
-- ============================================================

CREATE OR REPLACE FUNCTION equip_title(p_title_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_name TEXT;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF vvv_titles_locked() THEN RAISE EXCEPTION 'titles_locked'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('vvv_titles:' || v_caller::TEXT));

  IF p_title_id IS NOT NULL THEN
    SELECT t.name INTO v_name
    FROM user_titles ut
    JOIN titles t ON t.id = ut.title_id
    WHERE ut.user_id = v_caller AND ut.title_id = p_title_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_owned'; END IF;
  END IF;

  UPDATE user_titles SET is_active = false
  WHERE user_id = v_caller AND is_active AND title_id IS DISTINCT FROM p_title_id;

  IF p_title_id IS NOT NULL THEN
    UPDATE user_titles SET is_active = true
    WHERE user_id = v_caller AND title_id = p_title_id AND NOT is_active;
  END IF;

  RETURN jsonb_build_object('title_id', p_title_id, 'title', v_name);
END;
$$;

-- ============================================================
-- BUY BACK YOUR DIGNITY: pay a mockery title's price (1x) to burn it off
-- ============================================================

CREATE OR REPLACE FUNCTION lift_title_curse(p_title_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_row RECORD;
  v_cost INTEGER;
  v_balance INTEGER;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF vvv_titles_locked() THEN RAISE EXCEPTION 'titles_locked'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('vvv_titles:' || v_caller::TEXT));

  SELECT ut.id, ut.assigned_by, t.name, t.price, t.for_self INTO v_row
  FROM user_titles ut
  JOIN titles t ON t.id = ut.title_id
  WHERE ut.user_id = v_caller AND ut.title_id = p_title_id;
  IF NOT FOUND OR v_row.for_self THEN RAISE EXCEPTION 'not_cursed'; END IF;

  v_cost := v_row.price; -- dignity costs 1x the brand's price (DIGNITY_MULTIPLIER in lib/titles/rules.ts)
  v_balance := adjust_balance(v_caller, -v_cost, 'title_dignity', p_title_id);
  DELETE FROM user_titles WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'title', v_row.name,
    'cost', v_cost,
    'bestowed_by', v_row.assigned_by,
    'balance', v_balance
  );
END;
$$;

-- ============================================================
-- APPLY ONE PERK OR CURSE after a game. Amounts are computed by the app (lib/titles/engine.ts);
-- this function makes the payout one-shot and bounded, and only lets the user holding the declaration
-- (game_sessions.resolved_by, set by the declare flow) pay it, when that user runs the game (its creator or an
-- admin). It only runs while that game is being settled: the hooks run after the game row is linked and before
-- the result is saved, so a game that is already resolved, or stuck in game past the 3 hour live window, can
-- never pay out again. Only someone who took part in the game can be paid, and never more than the title's
-- own cap (title_perk_caps): an amount above it is clamped.
-- Returns the points moved, 0 when nothing could move, NULL when it was already applied.
-- ============================================================

CREATE OR REPLACE FUNCTION apply_title_perk(
  p_session_id UUID,
  p_user_id UUID,
  p_title_name TEXT,
  p_kind TEXT,
  p_amount INTEGER,
  p_detail TEXT DEFAULT '',
  p_beneficiary UUID DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_session RECORD;
  v_row RECORD;
  v_cap RECORD;
  v_balance INTEGER;
  v_amount INTEGER;
  v_application UUID;
BEGIN
  SELECT id, status, created_by, resolved_by, game_id, created_at, updated_at INTO v_session
  FROM game_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF v_session.status <> 'in_game' OR v_session.game_id IS NULL OR v_session.updated_at < now() - interval '3 hours' THEN
    RAISE EXCEPTION 'session_not_settling';
  END IF;

  -- A session without a creator can only be settled by an admin.
  IF v_caller IS NULL
     OR v_session.resolved_by IS DISTINCT FROM v_caller
     OR NOT (
       COALESCE(v_session.created_by = v_caller, false)
       OR EXISTS (SELECT 1 FROM players WHERE auth_user_id = v_caller AND is_admin)
     ) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN ('perk', 'curse') OR p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT ut.created_at, ut.assigned_by, ut.is_active, t.for_self, t.category INTO v_row
  FROM user_titles ut
  JOIN titles t ON t.id = ut.title_id
  WHERE ut.user_id = p_user_id AND t.name = p_title_name;
  IF NOT FOUND THEN RAISE EXCEPTION 'title_not_held'; END IF;

  IF p_kind = 'perk' THEN
    IF NOT v_row.is_active OR NOT v_row.for_self THEN RAISE EXCEPTION 'title_not_equipped'; END IF;
  ELSIF v_row.for_self
     OR v_row.assigned_by IS NULL
     OR p_amount > 0
     OR p_beneficiary IS DISTINCT FROM v_row.assigned_by
     OR v_row.created_at >= v_session.created_at
     OR vvv_curse_games_served(v_row.created_at, p_session_id) >= 8 THEN
    RAISE EXCEPTION 'curse_not_active';
  END IF;

  SELECT * INTO v_cap FROM vvv_title_perk_cap(p_title_name, v_row.category);
  IF NOT FOUND OR v_cap.kind <> p_kind THEN RAISE EXCEPTION 'no_perk'; END IF;

  -- A perk can cost its own wearer at most 10 (PERK_PENALTY_CAP); a curse only ever charges.
  v_amount := CASE
    WHEN p_kind = 'perk' THEN GREATEST(-LEAST(v_cap.cap, 10), LEAST(v_cap.cap, p_amount))
    ELSE GREATEST(-v_cap.cap, p_amount)
  END;

  IF NOT vvv_title_perk_involved(p_session_id, p_user_id) THEN RAISE EXCEPTION 'not_involved'; END IF;

  SELECT balance INTO v_balance FROM point_balances WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;

  INSERT INTO title_perk_applications (session_id, user_id, title_name, kind, beneficiary_user_id, detail)
  VALUES (
    p_session_id, p_user_id, p_title_name, p_kind,
    CASE WHEN p_kind = 'curse' THEN p_beneficiary END,
    left(coalesce(p_detail, ''), 200)
  )
  ON CONFLICT (session_id, user_id, title_name) DO NOTHING
  RETURNING id INTO v_application;
  IF v_application IS NULL THEN RETURN NULL; END IF;

  -- Charges never push a wearer past the -300 debt floor.
  IF v_amount < 0 THEN v_amount := LEAST(0, GREATEST(v_amount, -300 - v_balance)); END IF;
  -- Title effects (phase10_title-effects.sql): a loadout's perks share 60 points per wearer per game.
  IF p_kind = 'perk' AND v_amount > 0 THEN v_amount := vvv_title_perk_room(p_session_id, p_user_id, v_amount); END IF;
  IF v_amount = 0 THEN RETURN 0; END IF;

  PERFORM adjust_balance(p_user_id, v_amount, CASE WHEN p_kind = 'curse' THEN 'title_curse' ELSE 'title_perk' END, p_session_id);
  IF p_kind = 'curse' AND EXISTS (SELECT 1 FROM point_balances WHERE user_id = p_beneficiary) THEN
    PERFORM adjust_balance(p_beneficiary, -v_amount, 'title_tribute', p_session_id);
  END IF;

  UPDATE title_perk_applications SET amount = v_amount WHERE id = v_application;
  RETURN v_amount;
END;
$$;

REVOKE EXECUTE ON FUNCTION vvv_curse_games_served(TIMESTAMPTZ, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_titles_locked() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_title_perk_cap(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_title_perk_involved(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION buy_title(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION equip_title(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION lift_title_curse(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION apply_title_perk(UUID, UUID, TEXT, TEXT, INTEGER, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION buy_title(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION equip_title(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION lift_title_curse(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_title_perk(UUID, UUID, TEXT, TEXT, INTEGER, TEXT, UUID) TO authenticated;
