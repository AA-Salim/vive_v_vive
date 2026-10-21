-- Phase 10: Titles that matter. Perks, curses, and dignity buybacks.
-- Additive and idempotent: safe to run while the previous app version is deployed.
-- Requires phase10_foundation.sql (free-form point_transactions reasons).
-- Rules mirrored in lib/titles/rules.ts: a curse brands its wearer for 8 resolved games, a wearer
-- carries at most 2 curses, dignity costs 1.5x the title price, one perk moves at most 60 points per game
-- and a perk can cost its own wearer at most 10.
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
-- ============================================================

UPDATE user_titles ut SET is_active = false
WHERE ut.is_active AND EXISTS (
  SELECT 1 FROM user_titles other
  WHERE other.user_id = ut.user_id AND other.is_active
    AND (other.created_at, other.id) > (ut.created_at, ut.id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_titles_one_active ON user_titles (user_id) WHERE is_active;

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

  v_balance := adjust_balance(v_caller, -v_title.price, 'title_bought', p_title_id);

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
    'price', v_title.price,
    'balance', v_balance
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
-- BUY BACK YOUR DIGNITY: pay 1.5x a mockery title's price to burn it off
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

  v_cost := CEIL(v_row.price * 1.5);
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
-- this function makes the payout one-shot, bounded, and callable only by whoever may declare the winner,
-- and only while that game is being settled: the hooks run before the result is saved, so a game that is
-- already resolved, or stuck in game past the 3 hour live window, can never pay out again.
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
  v_balance INTEGER;
  v_amount INTEGER := p_amount;
  v_application UUID;
BEGIN
  SELECT id, status, created_by, created_at, updated_at INTO v_session FROM game_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF v_session.status <> 'in_game' OR v_session.updated_at < now() - interval '3 hours' THEN
    RAISE EXCEPTION 'session_not_settling';
  END IF;

  -- A session without a creator can only be settled by an admin.
  IF v_caller IS NULL OR NOT (
    COALESCE(v_session.created_by = v_caller, false)
    OR EXISTS (SELECT 1 FROM players WHERE auth_user_id = v_caller AND is_admin)
  ) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN ('perk', 'curse')
     OR p_amount IS NULL OR p_amount = 0 OR abs(p_amount) > 60
     OR (p_kind = 'perk' AND p_amount < -10) THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT ut.created_at, ut.assigned_by, ut.is_active, t.for_self INTO v_row
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
REVOKE EXECUTE ON FUNCTION buy_title(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION equip_title(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION lift_title_curse(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION apply_title_perk(UUID, UUID, TEXT, TEXT, INTEGER, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION buy_title(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION equip_title(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION lift_title_curse(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_title_perk(UUID, UUID, TEXT, TEXT, INTEGER, TEXT, UUID) TO authenticated;
