-- Phase 10: titles with teeth. Immediate effects, tiered prices and loadouts.
-- Additive and idempotent: safe to run again, and safe while the previous app version is deployed.
--
-- Run order: after every other phase10 file (foundation, live-sync, titles, prophecy-vote, chaos, betting, praise,
-- duels, bounties-shame, lobby, storytelling, dedupe-games, hardening), then supabase/phase11_lockdown.sql.
-- The money functions of those files call the vvv_title_* helpers below (one marked line per formula); until this
-- file has run they report a missing function and the app falls back to its pre-migration paths.
--
-- Mirrored in TypeScript, keep both in lockstep:
--   lib/titles/effects.ts   effect keys, ranges, the per-title table and every formula
--   lib/titles/pricing.ts   price tiers: Legendary 15, Epic 10, Rare 6, Common 3 written praises (100 points each)
--   lib/titles/loadout.ts   slots (2 super rare, 3 rare, 4 common) and the conflicting pairs
--   lib/titles/catalog.ts   honor tiers (act awards Legendary, the last title of a milestone group Rare, the rest Common)
--
-- Effects come from every equipped self title and every brand (mockery curse) still burning. Several sources may
-- feed one key: their sum is clamped to the key's range. Every helper that changes an amount writes a note
-- ({title, key, value, subject}) into a transaction-local list; the calling function returns it as title_effects so
-- the API, the Herald and the ledgers can say which title did what.
--
-- New point reasons: title_stipend_bonus, title_stipend_redirected (0 points, the marker on the cursed side),
-- title_stipend_tribute (received by Salaxe), title_duel_refund.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.vvv_curse_games_served(timestamptz, uuid)') IS NULL
     OR to_regprocedure('public.vvv_titles_locked()') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.point_transactions'::regclass AND conname = 'point_transactions_reason_format'
     ) THEN
    RAISE EXCEPTION 'Run supabase/phase10_foundation.sql and supabase/phase10_titles.sql before supabase/phase10_title-effects.sql';
  END IF;
END $$;

-- ============================================================
-- RULE TABLES (seeded below; the seed is the source of truth, re-running this file resets them to it)
-- ============================================================

CREATE TABLE IF NOT EXISTS title_tiers (
  title_name TEXT PRIMARY KEY,
  tier TEXT NOT NULL CHECK (tier IN ('legendary', 'epic', 'rare', 'common'))
);

CREATE TABLE IF NOT EXISTS title_effect_keys (
  effect_key TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('sum', 'min', 'flag')),
  min_value NUMERIC NOT NULL,
  max_value NUMERIC NOT NULL,
  CHECK (min_value <= max_value)
);

CREATE TABLE IF NOT EXISTS title_effects (
  title_name TEXT NOT NULL,
  effect_key TEXT NOT NULL REFERENCES title_effect_keys (effect_key) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  PRIMARY KEY (title_name, effect_key)
);

CREATE TABLE IF NOT EXISTS title_conflicts (
  title_a TEXT NOT NULL,
  title_b TEXT NOT NULL,
  reason TEXT NOT NULL,
  PRIMARY KEY (title_a, title_b),
  CHECK (title_a < title_b)
);

CREATE TABLE IF NOT EXISTS title_slot_rules (
  slot TEXT PRIMARY KEY CHECK (slot IN ('super_rare', 'rare', 'common')),
  slots INTEGER NOT NULL CHECK (slots >= 0)
);

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['title_tiers', 'title_effect_keys', 'title_effects', 'title_conflicts', 'title_slot_rules'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_read', v_table);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (true)', v_table || '_read', v_table);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON %I FROM anon, authenticated', v_table);
  END LOOP;
END $$;

-- Effect keys: how several sources combine (sum, lowest wins, on/off) and the range of the result.
WITH seed (effect_key, mode, min_value, max_value) AS (
  VALUES
    ('decree_extra_uses', 'sum', 0, 1),
    ('decree_cost_pct', 'sum', -30, 50),
    ('decree_cost_salaxe_pct', 'sum', -20, 0),
    ('decree_cost_target_pct', 'sum', -20, 0),
    ('exile_immune', 'flag', 0, 1),
    ('wager_base_bonus', 'sum', 0, 0.2),
    ('early_window_bonus_s', 'sum', 0, 30),
    ('all_in_bonus_pct', 'sum', 0, 10),
    ('insurance_coverage_bonus', 'sum', 0, 15),
    ('insurance_premium_salaxe_pct', 'sum', -25, 0),
    ('insurance_blocked', 'flag', 0, 1),
    ('bet_cap', 'min', 1, 100000),
    ('praise_bonus_pct', 'sum', 0, 40),
    ('favor_bonus_pct', 'sum', 0, 50),
    ('stipend_bonus_pct', 'sum', 0, 100),
    ('stipend_to_salaxe', 'flag', 0, 1),
    ('bestow_cost_pct', 'sum', -30, 0),
    ('duel_tithe_pct', 'sum', -50, 0),
    ('duel_loss_refund_pct', 'sum', 0, 20),
    ('herald', 'flag', 0, 1)
), dropped AS (
  DELETE FROM title_effect_keys k WHERE NOT EXISTS (SELECT 1 FROM seed s WHERE s.effect_key = k.effect_key)
)
INSERT INTO title_effect_keys (effect_key, mode, min_value, max_value)
SELECT effect_key, mode, min_value, max_value FROM seed
ON CONFLICT (effect_key) DO UPDATE
SET mode = EXCLUDED.mode, min_value = EXCLUDED.min_value, max_value = EXCLUDED.max_value;

-- What each title does while equipped (curses: while the brand burns).
WITH seed (title_name, effect_key, value) AS (
  VALUES
    ('The Usurper', 'decree_extra_uses', 1),
    ('Kingslayer', 'decree_cost_salaxe_pct', -20),
    ('Crown Thief', 'early_window_bonus_s', 30),
    ('The Disrespector', 'bestow_cost_pct', -20),
    ('The One Who Stopped Kneeling', 'exile_immune', 1),
    ('Last Loyalist', 'praise_bonus_pct', 25),
    ('Still Kneeling', 'stipend_bonus_pct', 100),
    ('Throne Polisher', 'favor_bonus_pct', 50),
    ('The Holdout', 'insurance_premium_salaxe_pct', -25),
    ('Copium Dealer', 'insurance_coverage_bonus', 15),
    ('Baron Caller (Derogatory)', 'wager_base_bonus', 0.2),
    ('El Goblino Pequeno', 'duel_tithe_pct', -50),
    ('Main Character (Self-Diagnosed)', 'herald', 1),
    ('The 0/8 Powerspike', 'all_in_bonus_pct', 10),
    ('Delayed Victory Specialist', 'duel_loss_refund_pct', 20),
    ('Court Jester', 'bet_cap', 50),
    ('Boot Licker', 'decree_cost_pct', 20),
    ('Royal Carpet', 'decree_cost_target_pct', -20),
    ('Salaxe''s Emotional Support', 'stipend_to_salaxe', 1),
    ('The Crawling One', 'insurance_blocked', 1),
    ('Mischief Maker', 'decree_cost_pct', -3),
    ('Chaos Enjoyer', 'decree_cost_pct', -5),
    ('Chaos Incarnate', 'decree_cost_pct', -7),
    ('Salaxe Appreciator', 'praise_bonus_pct', 5),
    ('Devoted Servant', 'praise_bonus_pct', 5),
    ('Down Horrendous For Salaxe', 'praise_bonus_pct', 10)
), dropped AS (
  DELETE FROM title_effects e
  WHERE NOT EXISTS (SELECT 1 FROM seed s WHERE s.title_name = e.title_name AND s.effect_key = e.effect_key)
)
INSERT INTO title_effects (title_name, effect_key, value)
SELECT title_name, effect_key, value FROM seed
ON CONFLICT (title_name, effect_key) DO UPDATE SET value = EXCLUDED.value;

-- Price and slot tiers. Act awards are matched by name in vvv_title_tier(); any other honor not listed is Common.
WITH seed (title_name, tier) AS (
  VALUES
    ('The Usurper', 'legendary'),
    ('Kingslayer', 'legendary'),
    ('Copium Dealer', 'legendary'),
    ('Last Loyalist', 'epic'),
    ('The One Who Stopped Kneeling', 'epic'),
    ('Delayed Victory Specialist', 'epic'),
    ('Crown Thief', 'rare'),
    ('The Disrespector', 'rare'),
    ('The Holdout', 'rare'),
    ('Baron Caller (Derogatory)', 'rare'),
    ('El Goblino Pequeno', 'rare'),
    ('Main Character (Self-Diagnosed)', 'rare'),
    ('The 0/8 Powerspike', 'rare'),
    ('Still Kneeling', 'common'),
    ('Throne Polisher', 'common'),
    ('Court Jester', 'legendary'),
    ('The Crawling One', 'epic'),
    ('Boot Licker', 'rare'),
    ('Royal Carpet', 'rare'),
    ('Salaxe''s Emotional Support', 'common'),
    ('Summoned', 'common'),
    ('Committed to the Rift', 'common'),
    ('The Regular', 'common'),
    ('Can''t Stop Won''t Stop', 'common'),
    ('Half-Century Club', 'common'),
    ('Grass Is a Myth', 'common'),
    ('Vive v Vive Addict', 'common'),
    ('This Game Is My Personality', 'rare'),
    ('First Taste of Victory', 'common'),
    ('Winner By Habit', 'common'),
    ('The Carry', 'common'),
    ('Unkillable Legacy', 'rare'),
    ('At Least You Tried', 'common'),
    ('Coinflip Merchant', 'common'),
    ('Random Champs, Calculated Wins', 'rare'),
    ('Baby Gambler', 'common'),
    ('Degenerate In Training', 'common'),
    ('Can''t Help Myself', 'common'),
    ('The House Should Be Worried', 'rare'),
    ('Lucky Guess', 'common'),
    ('Fortune''s Favorite', 'common'),
    ('The Oracle', 'rare'),
    ('Pocket Change', 'common'),
    ('Stacking Paper', 'common'),
    ('Economy Enjoyer', 'common'),
    ('Walking Treasury', 'rare'),
    ('Salaxe Appreciator', 'common'),
    ('Devoted Servant', 'common'),
    ('Down Horrendous For Salaxe', 'rare'),
    ('First Blood (Emotional)', 'common'),
    ('Community Punching Bag', 'common'),
    ('Shame Sponge', 'rare'),
    ('Mischief Maker', 'common'),
    ('Chaos Enjoyer', 'common'),
    ('Chaos Incarnate', 'rare'),
    ('Bounty Poster', 'common'),
    ('Most Wanted Printer', 'rare'),
    ('Salaxe''s Background Character', 'common'),
    ('Court Jester (Unpaid)', 'common'),
    ('Throne Room Tourist', 'common'),
    ('The One Who Was There', 'common'),
    ('Salaxe''s Tax Write-Off', 'common'),
    ('Professional Bystander', 'common'),
    ('Royal Seat Warmer', 'common'),
    ('The Forgettable', 'common'),
    ('Act I Survivor (Barely)', 'common'),
    ('Salaxe''s Emotional Baggage', 'common'),
    ('Crown Witness (Did Not Touch It)', 'common'),
    ('The NPC', 'common'),
    ('Vive v Vive Benchwarmer', 'common'),
    ('Salaxe''s Least Favorite', 'common'),
    ('The One Who Showed Up', 'common'),
    ('Royal Court Filler', 'common'),
    ('Act I: Participated', 'common'),
    ('Charamil''s Most Average', 'common'),
    ('Almost Relevant', 'common'),
    ('Salaxe''s Forgotten Minion', 'common')
), dropped AS (
  DELETE FROM title_tiers t WHERE NOT EXISTS (SELECT 1 FROM seed s WHERE s.title_name = t.title_name)
)
INSERT INTO title_tiers (title_name, tier)
SELECT title_name, tier FROM seed
ON CONFLICT (title_name) DO UPDATE SET tier = EXCLUDED.tier;

-- Super-broken pairs that can never be worn together (title_a < title_b).
WITH seed (title_a, title_b, reason) AS (
  VALUES
    ('Copium Dealer', 'The Holdout', 'One Guardian Angel racket at a time: the angel only takes one bribe.'),
    ('Delayed Victory Specialist', 'El Goblino Pequeno', 'Two duel hustles at once: the tithe collector audits one of them.')
), dropped AS (
  DELETE FROM title_conflicts c
  WHERE NOT EXISTS (SELECT 1 FROM seed s WHERE s.title_a = c.title_a AND s.title_b = c.title_b)
)
INSERT INTO title_conflicts (title_a, title_b, reason)
SELECT title_a, title_b, reason FROM seed
ON CONFLICT (title_a, title_b) DO UPDATE SET reason = EXCLUDED.reason;

INSERT INTO title_slot_rules (slot, slots) VALUES ('super_rare', 2), ('rare', 3), ('common', 4)
ON CONFLICT (slot) DO UPDATE SET slots = EXCLUDED.slots;

-- ============================================================
-- TIERS AND PRICES
-- ============================================================

-- p_price ranks a shop title the seed does not know yet (tierForPrice in lib/titles/pricing.ts).
CREATE OR REPLACE FUNCTION vvv_title_tier(p_name TEXT, p_category TEXT, p_price INTEGER DEFAULT 0) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(
    (SELECT tier FROM title_tiers WHERE title_name = p_name),
    CASE
      WHEN p_category = 'award'
        AND btrim(p_name) ~* '^Act\s+([IVXLC]+|\d+):?\s+(Grand Champion|Warrior|Iron Man|Degenerate|Devotee|Punching Bag)$'
        THEN 'legendary'
      WHEN p_category = 'award' THEN 'common'
      WHEN COALESCE(p_price, 0) >= 1500 THEN 'legendary'
      WHEN COALESCE(p_price, 0) >= 1000 THEN 'epic'
      WHEN COALESCE(p_price, 0) >= 600 THEN 'rare'
      ELSE 'common'
    END
  )
$$;

-- Written praises per tier, times the 100 points one praise pays (PRAISE_REWARD, submit_praise).
CREATE OR REPLACE FUNCTION vvv_title_tier_price(p_tier TEXT) RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT 100 * CASE p_tier WHEN 'legendary' THEN 15 WHEN 'epic' THEN 10 WHEN 'rare' THEN 6 ELSE 3 END
$$;

-- A mockery title worn as a banner is a scar: it sits in a Common slot.
CREATE OR REPLACE FUNCTION vvv_title_slot(p_name TEXT, p_category TEXT, p_price INTEGER DEFAULT 0) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE
    WHEN p_category = 'mockery' THEN 'common'
    WHEN vvv_title_tier(p_name, p_category, p_price) IN ('legendary', 'epic') THEN 'super_rare'
    ELSE vvv_title_tier(p_name, p_category, p_price)
  END
$$;

-- New prices for everything sold in the armory. Existing owners keep what they own.
UPDATE titles t
SET price = vvv_title_tier_price(tt.tier)
FROM title_tiers tt
WHERE tt.title_name = t.name
  AND t.category <> 'award'
  AND t.price IS DISTINCT FROM vvv_title_tier_price(tt.tier);

-- ============================================================
-- LOADOUTS: several equipped titles, validated by equip_loadout()
-- ============================================================

ALTER TABLE user_titles ADD COLUMN IF NOT EXISTS equipped_at TIMESTAMPTZ;

-- phase10_titles.sql allowed one equipped title per user; a loadout holds up to one per slot.
DROP INDEX IF EXISTS idx_user_titles_one_active;
CREATE INDEX IF NOT EXISTS idx_user_titles_active ON user_titles (user_id) WHERE is_active;

-- First rule a set of titles breaks, or NULL. Same rules as loadoutViolation() in lib/titles/loadout.ts.
CREATE OR REPLACE FUNCTION vvv_loadout_violation(p_user_id UUID, p_title_ids UUID[]) RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_slot RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM unnest(p_title_ids) AS wanted(id)
    WHERE NOT EXISTS (SELECT 1 FROM user_titles ut WHERE ut.user_id = p_user_id AND ut.title_id = wanted.id)
  ) THEN
    RETURN 'not_owned';
  END IF;

  FOR v_slot IN
    SELECT vvv_title_slot(t.name, t.category, t.price) AS slot, count(*) AS used
    FROM titles t WHERE t.id = ANY (p_title_ids)
    GROUP BY 1
  LOOP
    IF v_slot.used > COALESCE((SELECT slots FROM title_slot_rules WHERE slot = v_slot.slot), 0) THEN
      RETURN 'slot_full_' || v_slot.slot;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM title_conflicts c
    JOIN titles a ON a.name = c.title_a
    JOIN titles b ON b.name = c.title_b
    WHERE a.id = ANY (p_title_ids) AND b.id = ANY (p_title_ids)
  ) THEN
    RETURN 'title_conflict';
  END IF;

  -- Rebels and loyalists never share the super rare slots.
  IF EXISTS (
    SELECT 1 FROM titles t
    WHERE t.id = ANY (p_title_ids) AND t.category = 'rebellion' AND vvv_title_slot(t.name, t.category, t.price) = 'super_rare'
  ) AND EXISTS (
    SELECT 1 FROM titles t
    WHERE t.id = ANY (p_title_ids) AND t.category = 'loyalty' AND vvv_title_slot(t.name, t.category, t.price) = 'super_rare'
  ) THEN
    RETURN 'faction_conflict';
  END IF;

  RETURN NULL;
END;
$$;

-- Replaces the caller's whole loadout (an empty array lowers every banner). Sealed while a game is live.
-- equip_title(p_title_id) from phase10_titles.sql keeps its meaning for old clients: wear only that title.
CREATE OR REPLACE FUNCTION equip_loadout(p_title_ids UUID[]) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_ids UUID[];
  v_violation TEXT;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF vvv_titles_locked() THEN RAISE EXCEPTION 'titles_locked'; END IF;

  v_ids := ARRAY(SELECT DISTINCT id FROM unnest(COALESCE(p_title_ids, '{}'::UUID[])) AS wanted(id) WHERE id IS NOT NULL);
  IF cardinality(v_ids) > (SELECT COALESCE(sum(slots), 0) FROM title_slot_rules) THEN
    RAISE EXCEPTION 'loadout_full';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('vvv_titles:' || v_caller::TEXT));

  v_violation := vvv_loadout_violation(v_caller, v_ids);
  IF v_violation IS NOT NULL THEN RAISE EXCEPTION '%', v_violation; END IF;

  UPDATE user_titles SET is_active = false
  WHERE user_id = v_caller AND is_active AND NOT (title_id = ANY (v_ids));
  UPDATE user_titles SET is_active = true, equipped_at = now()
  WHERE user_id = v_caller AND title_id = ANY (v_ids) AND NOT is_active;

  RETURN jsonb_build_object(
    'title_ids', to_jsonb(v_ids),
    'titles', (SELECT COALESCE(jsonb_agg(t.name ORDER BY t.name), '[]'::jsonb) FROM titles t WHERE t.id = ANY (v_ids))
  );
END;
$$;

-- ============================================================
-- EFFECT LOOKUP
-- ============================================================

CREATE OR REPLACE FUNCTION vvv_salaxe_player_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT id FROM players WHERE lower(btrim(name)) = 'salaxe' ORDER BY created_at LIMIT 1
$$;

CREATE OR REPLACE FUNCTION vvv_salaxe_user_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth_user_id FROM players
  WHERE lower(btrim(name)) = 'salaxe' AND auth_user_id IS NOT NULL
  ORDER BY created_at LIMIT 1
$$;

-- Every title acting on a user right now: equipped self titles, and brands that still have games left.
CREATE OR REPLACE FUNCTION vvv_title_sources(p_user_id UUID)
RETURNS TABLE (title_name TEXT, kind TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT t.name, 'equipped'
  FROM user_titles ut JOIN titles t ON t.id = ut.title_id
  WHERE ut.user_id = p_user_id AND ut.is_active AND t.for_self
  UNION
  SELECT t.name, 'curse'
  FROM user_titles ut JOIN titles t ON t.id = ut.title_id
  WHERE ut.user_id = p_user_id
    AND ut.assigned_by IS NOT NULL
    AND NOT t.for_self
    AND t.category = 'mockery'
    AND vvv_curse_games_served(ut.created_at) < 8
$$;

-- The combined, clamped value of one effect for a user, or NULL when no title of theirs has it.
CREATE OR REPLACE FUNCTION vvv_title_effect(p_user_id UUID, p_key TEXT) RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE k.mode
    WHEN 'flag' THEN 1
    WHEN 'min' THEN LEAST(k.max_value, GREATEST(k.min_value, min(e.value)))
    ELSE LEAST(k.max_value, GREATEST(k.min_value, sum(e.value)))
  END
  FROM vvv_title_sources(p_user_id) s
  JOIN title_effects e ON e.title_name = s.title_name AND e.effect_key = p_key
  JOIN title_effect_keys k ON k.effect_key = e.effect_key
  GROUP BY k.mode, k.min_value, k.max_value
$$;

-- Notes: which titles changed an amount in this transaction. Read and cleared by vvv_title_fx_take().
CREATE OR REPLACE FUNCTION vvv_title_fx_note(p_user_id UUID, p_key TEXT, p_subject TEXT DEFAULT NULL) RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_notes JSONB := COALESCE(NULLIF(current_setting('vvv.title_fx', true), ''), '[]')::jsonb;
  v_new JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('title', s.title_name, 'key', p_key, 'value', e.value, 'subject', p_subject)
    ORDER BY s.title_name
  ), '[]'::jsonb)
  INTO v_new
  FROM vvv_title_sources(p_user_id) s
  JOIN title_effects e ON e.title_name = s.title_name AND e.effect_key = p_key;
  IF jsonb_array_length(v_new) > 0 THEN
    PERFORM set_config('vvv.title_fx', (v_notes || v_new)::TEXT, true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION vvv_title_fx_take() RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_notes JSONB := COALESCE(NULLIF(current_setting('vvv.title_fx', true), ''), '[]')::jsonb;
BEGIN
  PERFORM set_config('vvv.title_fx', '[]', true);
  RETURN v_notes;
END;
$$;

-- p_base scaled by a percent key (praise, favor, stipend, curse discounts), rounded like Math.round in TS.
CREATE OR REPLACE FUNCTION vvv_title_scaled(p_user_id UUID, p_key TEXT, p_base INTEGER) RETURNS INTEGER
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_pct NUMERIC := vvv_title_effect(p_user_id, p_key);
BEGIN
  IF v_pct IS NULL OR v_pct = 0 OR p_base IS NULL OR p_base = 0 THEN RETURN p_base; END IF;
  PERFORM vvv_title_fx_note(p_user_id, p_key);
  RETURN ROUND(p_base * (100 + v_pct) / 100.0)::INTEGER;
END;
$$;

-- ============================================================
-- ROYAL DECREES (chaos_issue_decree, chaos_wager_multiplier)
-- ============================================================

-- The Usurper: one more use of every limited decree. Disabled decrees (max 0) stay disabled.
CREATE OR REPLACE FUNCTION vvv_title_decree_uses(p_user_id UUID, p_max INTEGER, p_used INTEGER) RETURNS INTEGER
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_extra INTEGER;
BEGIN
  IF p_max IS NULL OR p_max <= 0 THEN RETURN p_max; END IF;
  v_extra := COALESCE(vvv_title_effect(p_user_id, 'decree_extra_uses'), 0)::INTEGER;
  IF v_extra > 0 AND p_used >= p_max AND p_used < p_max + v_extra THEN
    PERFORM vvv_title_fx_note(p_user_id, 'decree_extra_uses');
  END IF;
  RETURN p_max + v_extra;
END;
$$;

-- The price of a decree once every title has spoken: the caster's own modifier (Boot Licker, decree honors),
-- Kingslayer when it is aimed at Salaxe or his team, and Royal Carpet when it is aimed at a carpeted seat; the
-- total stays between -30% and +50%. The King's Wager is a stake, not a price: it never changes.
-- Also refuses an exile on a seat that cannot be exiled (The One Who Stopped Kneeling).
-- Mirrors decreeCost() in lib/titles/effects.ts and decreeAimedSeats() in lib/chaos/title-terms.ts.
CREATE OR REPLACE FUNCTION vvv_title_decree_cost(
  p_user_id UUID,
  p_session_id UUID,
  p_action TEXT,
  p_cost INTEGER,
  p_target_1 UUID,
  p_target_2 UUID,
  p_team TEXT
) RETURNS INTEGER
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_salaxe UUID := vvv_salaxe_player_id();
  v_actor UUID;
  v_targets UUID[];
  v_own NUMERIC;
  v_slayer NUMERIC;
  v_carpet_user UUID;
  v_carpet_name TEXT;
  v_carpet NUMERIC;
  v_pct NUMERIC;
BEGIN
  IF p_action = 'champion_ban'
     AND vvv_title_effect((SELECT auth_user_id FROM players WHERE id = p_target_1), 'exile_immune') IS NOT NULL THEN
    RAISE EXCEPTION 'chaos:exile_immune';
  END IF;

  IF p_action = 'double_or_nothing' OR COALESCE(p_cost, 0) <= 0 THEN RETURN p_cost; END IF;

  SELECT player_id INTO v_actor FROM user_profiles WHERE id = p_user_id;
  v_targets := CASE
    WHEN p_action IN ('champion_ban', 'lane_force') THEN ARRAY[p_target_1, p_target_2]
    WHEN p_action = 'swap_teammate' THEN ARRAY[p_target_2]
    WHEN p_action IN ('shuffle_lanes', 'reroll_champs') THEN
      ARRAY(SELECT player_id FROM session_assignments WHERE session_id = p_session_id AND side = p_team)
    ELSE '{}'::UUID[]
  END;
  v_targets := array_remove(array_remove(v_targets, NULL), v_actor);

  v_own := COALESCE(vvv_title_effect(p_user_id, 'decree_cost_pct'), 0);
  v_slayer := CASE
    WHEN v_salaxe = ANY (v_targets) THEN COALESCE(vvv_title_effect(p_user_id, 'decree_cost_salaxe_pct'), 0)
    ELSE 0
  END;

  SELECT p.auth_user_id, p.name, vvv_title_effect(p.auth_user_id, 'decree_cost_target_pct')
  INTO v_carpet_user, v_carpet_name, v_carpet
  FROM players p
  WHERE p.id = ANY (v_targets)
    AND p.auth_user_id IS NOT NULL
    AND p.auth_user_id <> p_user_id
    AND vvv_title_effect(p.auth_user_id, 'decree_cost_target_pct') IS NOT NULL
  ORDER BY 3, p.name
  LIMIT 1;

  v_pct := LEAST(50, GREATEST(-30, v_own + v_slayer + COALESCE(v_carpet, 0)));
  IF v_pct = 0 THEN RETURN p_cost; END IF;

  IF v_own <> 0 THEN PERFORM vvv_title_fx_note(p_user_id, 'decree_cost_pct'); END IF;
  IF v_slayer <> 0 THEN PERFORM vvv_title_fx_note(p_user_id, 'decree_cost_salaxe_pct'); END IF;
  IF v_carpet_user IS NOT NULL THEN
    PERFORM vvv_title_fx_note(v_carpet_user, 'decree_cost_target_pct', v_carpet_name);
  END IF;

  RETURN ROUND(p_cost * (100 + v_pct) / 100.0)::INTEGER;
END;
$$;

-- Stored in the decree's details: Baron Caller's starting multiplier (read by chaos_wager_multiplier) and the notes
-- of every title that changed this decree.
CREATE OR REPLACE FUNCTION vvv_title_decree_details(p_user_id UUID, p_action TEXT) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_bonus NUMERIC;
  v_details JSONB := '{}'::jsonb;
  v_notes JSONB;
BEGIN
  IF p_action = 'double_or_nothing' THEN
    v_bonus := vvv_title_effect(p_user_id, 'wager_base_bonus');
    IF v_bonus IS NOT NULL AND v_bonus > 0 THEN
      PERFORM vvv_title_fx_note(p_user_id, 'wager_base_bonus');
      v_details := jsonb_build_object('base_multiplier', 2.0 + v_bonus);
    END IF;
  END IF;
  v_notes := vvv_title_fx_take();
  IF jsonb_array_length(v_notes) > 0 THEN
    v_details := v_details || jsonb_build_object('title_effects', v_notes);
  END IF;
  RETURN v_details;
END;
$$;

-- ============================================================
-- BETS (place_bet_v2, insure_bet_v2, resolve_bets_v2)
-- ============================================================

-- Court Jester caps the whole stake of a game; The Crawling One refuses any new Guardian Angel.
CREATE OR REPLACE FUNCTION vvv_title_bet_guard(p_user_id UUID, p_total INTEGER, p_new_insurance BOOLEAN) RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_cap NUMERIC := vvv_title_effect(p_user_id, 'bet_cap');
BEGIN
  IF v_cap IS NOT NULL AND COALESCE(p_total, 0) > v_cap THEN RAISE EXCEPTION 'bet:title_bet_cap'; END IF;
  IF p_new_insurance AND vvv_title_effect(p_user_id, 'insurance_blocked') IS NOT NULL THEN
    RAISE EXCEPTION 'bet:title_no_insurance';
  END IF;
END;
$$;

-- The Holdout: a cheaper Guardian Angel on Salaxe's side. Salaxe never discounts his own side.
CREATE OR REPLACE FUNCTION vvv_title_premium_pct(p_user_id UUID, p_session_id UUID, p_side TEXT, p_pct INTEGER) RETURNS INTEGER
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_mod NUMERIC := vvv_title_effect(p_user_id, 'insurance_premium_salaxe_pct');
BEGIN
  IF v_mod IS NULL OR v_mod = 0 OR p_pct IS NULL OR p_user_id IS NOT DISTINCT FROM vvv_salaxe_user_id() THEN
    RETURN p_pct;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM session_assignments
    WHERE session_id = p_session_id AND player_id = vvv_salaxe_player_id() AND side = p_side
  ) THEN
    RETURN p_pct;
  END IF;
  PERFORM vvv_title_fx_note(p_user_id, 'insurance_premium_salaxe_pct');
  RETURN CEIL(p_pct * (100 + v_mod) / 100.0)::INTEGER;
END;
$$;

-- Copium Dealer: a Guardian Angel that covers more of the stake.
CREATE OR REPLACE FUNCTION vvv_title_coverage_pct(p_user_id UUID, p_pct INTEGER) RETURNS INTEGER
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_bonus NUMERIC := vvv_title_effect(p_user_id, 'insurance_coverage_bonus');
BEGIN
  IF v_bonus IS NULL OR v_bonus = 0 THEN RETURN p_pct; END IF;
  PERFORM vvv_title_fx_note(p_user_id, 'insurance_coverage_bonus');
  RETURN LEAST(100, p_pct + v_bonus)::INTEGER;
END;
$$;

-- Crown Thief: the early-conviction window lasts longer for the wearer.
CREATE OR REPLACE FUNCTION vvv_title_is_early(p_user_id UUID, p_opened TIMESTAMPTZ, p_now TIMESTAMPTZ, p_seconds INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_bonus NUMERIC;
BEGIN
  IF p_opened IS NULL THEN RETURN false; END IF;
  IF p_now < p_opened + make_interval(secs => p_seconds) THEN RETURN true; END IF;
  v_bonus := vvv_title_effect(p_user_id, 'early_window_bonus_s');
  IF v_bonus IS NULL OR v_bonus <= 0 OR p_now >= p_opened + make_interval(secs => (p_seconds + v_bonus)::DOUBLE PRECISION) THEN
    RETURN false;
  END IF;
  PERFORM vvv_title_fx_note(p_user_id, 'early_window_bonus_s');
  RETURN true;
END;
$$;

-- ============================================================
-- DUELS (duel_settle_accepted)
-- ============================================================

-- El Goblino Pequeno: a smaller tithe for the winner. Without an effect this is floor(stake * tax_pct / 100).
CREATE OR REPLACE FUNCTION vvv_title_duel_tithe(p_winner UUID, p_stake INTEGER, p_tax_pct INTEGER) RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT FLOOR(p_stake::NUMERIC * p_tax_pct * (100 + COALESCE(vvv_title_effect(p_winner, 'duel_tithe_pct'), 0)) / 10000)::INTEGER
$$;

-- Delayed Victory Specialist: part of a lost duel's stake comes back from the treasury.
CREATE OR REPLACE FUNCTION vvv_title_duel_consolation(p_loser UUID, p_stake INTEGER, p_duel_id UUID) RETURNS INTEGER
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_refund INTEGER := FLOOR(p_stake::NUMERIC * COALESCE(vvv_title_effect(p_loser, 'duel_loss_refund_pct'), 0) / 100)::INTEGER;
BEGIN
  IF v_refund <= 0 OR NOT EXISTS (SELECT 1 FROM point_balances WHERE user_id = p_loser) THEN RETURN 0; END IF;
  IF EXISTS (
    SELECT 1 FROM point_transactions WHERE user_id = p_loser AND reason = 'title_duel_refund' AND reference_id = p_duel_id
  ) THEN
    RETURN 0;
  END IF;
  PERFORM adjust_balance(p_loser, v_refund, 'title_duel_refund', p_duel_id);
  RETURN v_refund;
END;
$$;

-- ============================================================
-- POST-GAME PERKS (apply_title_perk): every perk of one wearer together pays at most 60 per game
-- ============================================================

CREATE OR REPLACE FUNCTION vvv_title_perk_room(p_session_id UUID, p_user_id UUID, p_amount INTEGER) RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT LEAST(p_amount, GREATEST(0, 60 - COALESCE(sum(amount) FILTER (WHERE amount > 0), 0)))::INTEGER
  FROM title_perk_applications
  WHERE session_id = p_session_id AND user_id = p_user_id AND kind = 'perk'
$$;

-- ============================================================
-- DAILY STIPEND: Still Kneeling doubles it, Salaxe's Emotional Support sends it to Salaxe
-- ============================================================

-- Same claim as the legacy claim_daily_bonus (5 points, once per UTC day), with the titles applied. Returns
-- { claimed, balance, amount, paid_to_salaxe, title_effects }; balance is -1 when today's stipend is already taken.
CREATE OR REPLACE FUNCTION vvv_title_claim_stipend(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp SET timezone = 'UTC' AS $$
DECLARE
  v_base CONSTANT INTEGER := 5;
  v_last DATE;
  v_amount INTEGER;
  v_salaxe UUID := vvv_salaxe_user_id();
  v_redirect BOOLEAN;
  v_balance INTEGER;
BEGIN
  SELECT last_daily_claim INTO v_last FROM point_balances WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User balance not found'; END IF;
  IF v_last = CURRENT_DATE THEN
    RETURN jsonb_build_object('claimed', false, 'balance', -1);
  END IF;

  UPDATE point_balances SET last_daily_claim = CURRENT_DATE, updated_at = now() WHERE user_id = p_user_id;
  v_amount := vvv_title_scaled(p_user_id, 'stipend_bonus_pct', v_base);
  v_redirect := vvv_title_effect(p_user_id, 'stipend_to_salaxe') IS NOT NULL AND v_salaxe IS DISTINCT FROM p_user_id;

  IF v_redirect THEN
    PERFORM vvv_title_fx_note(p_user_id, 'stipend_to_salaxe');
    v_balance := adjust_balance(p_user_id, 0, 'title_stipend_redirected', v_salaxe);
    IF v_salaxe IS NOT NULL AND EXISTS (SELECT 1 FROM point_balances WHERE user_id = v_salaxe) THEN
      PERFORM adjust_balance(v_salaxe, v_amount, 'title_stipend_tribute', p_user_id);
    END IF;
  ELSE
    v_balance := adjust_balance(p_user_id, v_base, 'daily_bonus', NULL);
    IF v_amount > v_base THEN
      v_balance := adjust_balance(p_user_id, v_amount - v_base, 'title_stipend_bonus', NULL);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'claimed', true,
    'balance', v_balance,
    'amount', v_amount,
    'paid_to_salaxe', v_redirect,
    'title_effects', vvv_title_fx_take()
  );
END;
$$;

-- app/api/points/daily: the caller's own stipend, with the title effects spelled out.
CREATE OR REPLACE FUNCTION claim_my_daily_stipend() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'points:not_authenticated'; END IF;
  RETURN vvv_title_claim_stipend(v_uid);
END;
$$;

-- ============================================================
-- PRIVILEGES
-- ============================================================

DO $$
DECLARE
  v_fn TEXT;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'vvv_title_tier(text, text, integer)',
    'vvv_title_tier_price(text)',
    'vvv_title_slot(text, text, integer)',
    'vvv_loadout_violation(uuid, uuid[])',
    'vvv_salaxe_player_id()',
    'vvv_salaxe_user_id()',
    'vvv_title_sources(uuid)',
    'vvv_title_effect(uuid, text)',
    'vvv_title_fx_note(uuid, text, text)',
    'vvv_title_fx_take()',
    'vvv_title_scaled(uuid, text, integer)',
    'vvv_title_decree_uses(uuid, integer, integer)',
    'vvv_title_decree_cost(uuid, uuid, text, integer, uuid, uuid, text)',
    'vvv_title_decree_details(uuid, text)',
    'vvv_title_bet_guard(uuid, integer, boolean)',
    'vvv_title_premium_pct(uuid, uuid, text, integer)',
    'vvv_title_coverage_pct(uuid, integer)',
    'vvv_title_is_early(uuid, timestamptz, timestamptz, integer)',
    'vvv_title_duel_tithe(uuid, integer, integer)',
    'vvv_title_duel_consolation(uuid, integer, uuid)',
    'vvv_title_perk_room(uuid, uuid, integer)',
    'vvv_title_claim_stipend(uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn);
  END LOOP;

  FOREACH v_fn IN ARRAY ARRAY['equip_loadout(uuid[])', 'claim_my_daily_stipend()'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', v_fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_fn);
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
