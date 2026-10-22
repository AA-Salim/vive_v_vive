-- Phase 10: Sing His Praises. One short line of worship for Salaxe, up to 4 times a day (praise_rules per_day).
-- Each of those hand kisses fills one daily slot (praise_slot 1 to 4), needs its own King's Riddle
-- (phase10_riddles.sql) and pays less than the one before: 200, 150, 100 then 50 points (praise_rules rewards),
-- 500 a day before title effects. The praise keeps how long its riddle took and how many riddles were missed.
-- Requires phase10_foundation.sql (free-form point reasons, vvv_add_to_realtime).
-- Additive and idempotent: safe to run while the previous app version is deployed.
-- Rules version 2 (praise_rules): 8 to 25 characters, 2+ words, his name, no insults, 300 points. Version 1 asked
-- for 40 to 280 characters and 8+ words for 100 points; its praises stay valid and keep their reward.
-- Days are UTC days (the database default, so the same boundary as claim_daily_bonus), pinned inside each
-- function so a client-chosen session time zone cannot shift the daily limits.

DO $$
BEGIN
  IF to_regprocedure('public.vvv_add_to_realtime(text)') IS NULL OR EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.point_transactions'::regclass AND conname = 'point_transactions_reason_check'
  ) THEN
    RAISE EXCEPTION 'Run supabase/phase10_foundation.sql before supabase/phase10_praise.sql';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS praises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CONSTRAINT praises_body_length CHECK (char_length(body) BETWEEN 1 AND 280),
  normalized TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  reward INTEGER NOT NULL DEFAULT 300 CHECK (reward >= 0),
  praise_day DATE NOT NULL DEFAULT CURRENT_DATE,
  praise_slot SMALLINT NOT NULL DEFAULT 1 CONSTRAINT praises_slot_check CHECK (praise_slot >= 1),
  verdict TEXT CHECK (verdict IN ('crowned', 'scorned')),
  verdict_note TEXT CHECK (verdict_note IS NULL OR char_length(verdict_note) BETWEEN 1 AND 140),
  favor INTEGER NOT NULL DEFAULT 0 CHECK (favor >= 0),
  judged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  judged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT praises_verdict_complete CHECK ((verdict IS NULL) = (judged_at IS NULL))
);
ALTER TABLE praises ALTER COLUMN reward SET DEFAULT 300;
-- Praises sung while the limit was one a day all took the day's first slot.
ALTER TABLE praises ADD COLUMN IF NOT EXISTS praise_slot SMALLINT NOT NULL DEFAULT 1
  CONSTRAINT praises_slot_check CHECK (praise_slot >= 1);
-- The King's Riddle that opened the praise: milliseconds from its first riddle posed to the solve, and the riddles
-- missed, skipped or timed out before it. NULL when no riddle gated the praise.
ALTER TABLE praises ADD COLUMN IF NOT EXISTS riddle_ms INTEGER CONSTRAINT praises_riddle_ms_check CHECK (riddle_ms >= 0);
ALTER TABLE praises ADD COLUMN IF NOT EXISTS riddle_misses SMALLINT
  CONSTRAINT praises_riddle_misses_check CHECK (riddle_misses >= 0);

-- The first version created the length rule inline (40 to 280, auto-named). The table only bounds the body now,
-- loosely enough for both versions; praise_rule_violation enforces the live limits.
DO $$
DECLARE
  v_name TEXT;
BEGIN
  FOR v_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.praises'::regclass
      AND contype = 'c'
      AND conname <> 'praises_body_length'
      AND pg_get_constraintdef(oid) ~ 'char_length\(body\)'
  LOOP
    EXECUTE format('ALTER TABLE public.praises DROP CONSTRAINT %I', v_name);
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.praises'::regclass AND conname = 'praises_body_length'
  ) THEN
    ALTER TABLE public.praises ADD CONSTRAINT praises_body_length CHECK (char_length(body) BETWEEN 1 AND 280);
  END IF;
END
$$;

-- One praise per user per daily slot (same CURRENT_DATE boundary as claim_daily_bonus) and no song sung twice.
-- The slot index replaces the one-per-day index of the once-a-day version.
CREATE UNIQUE INDEX IF NOT EXISTS praises_one_per_slot ON praises (user_id, praise_day, praise_slot);
DROP INDEX IF EXISTS praises_one_per_day;
CREATE UNIQUE INDEX IF NOT EXISTS praises_fingerprint_unique ON praises (fingerprint);
CREATE INDEX IF NOT EXISTS praises_recent_idx ON praises (created_at DESC);
CREATE INDEX IF NOT EXISTS praises_user_idx ON praises (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS praises_crowned_idx ON praises (judged_at DESC) WHERE verdict = 'crowned';
CREATE INDEX IF NOT EXISTS praises_pending_idx ON praises (created_at DESC) WHERE verdict IS NULL;

ALTER TABLE praises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "praises_read" ON praises;
CREATE POLICY "praises_read" ON praises FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON praises FROM anon, authenticated;

-- The live rules, reported by praise_state() so the app can tell this version from the previous one
-- (lib/praise/rules.ts: PRAISE_RULES, LEGACY_PRAISE_RULES, praiseRulesFrom). Without per_day the app counts one
-- praise a day at reward, as the previous version enforced. rewards holds the base of each daily kiss in slot
-- order; reward is the first one.
CREATE OR REPLACE FUNCTION praise_rules() RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'rules_version', 2, 'reward', 200, 'min_length', 8, 'max_length', 25, 'min_words', 2,
    'per_day', 4, 'rewards', jsonb_build_array(200, 150, 100, 50)
  )
$$;

-- The base reward of the kiss in daily slot p_slot, before title effects.
CREATE OR REPLACE FUNCTION praise_slot_reward(p_slot INTEGER) RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((praise_rules()->'rewards'->>(p_slot - 1))::INTEGER, (praise_rules()->>'reward')::INTEGER)
$$;

-- The caller's slots still free today, lowest first: the next kiss takes the first one. Empty once every daily
-- slot is sung. Praises are public, so this reveals nothing the praises table does not.
CREATE OR REPLACE FUNCTION praise_free_slots(p_uid UUID) RETURNS INTEGER[]
LANGUAGE sql STABLE SET search_path = public SET timezone = 'UTC' AS $$
  SELECT coalesce(array_agg(s ORDER BY s), '{}')
  FROM generate_series(1, (praise_rules()->>'per_day')::INTEGER) AS s
  WHERE NOT EXISTS (
    SELECT 1 FROM praises WHERE user_id = p_uid AND praise_day = CURRENT_DATE AND praise_slot = s
  )
$$;

-- The slot the caller's next kiss takes today, NULL when all are sung. Read under praise_lock_user by
-- submit_praise, get_my_riddle and solve_my_riddle, so all three agree on it.
CREATE OR REPLACE FUNCTION praise_next_slot(p_uid UUID) RETURNS INTEGER
LANGUAGE sql STABLE SET search_path = public SET timezone = 'UTC' AS $$
  SELECT (praise_free_slots(p_uid))[1]
$$;

-- Serializes one user's kisses and riddles until the transaction ends: two tabs cannot take the same slot, sing a
-- fifth praise or answer a riddle for a slot that was just sung.
CREATE OR REPLACE FUNCTION praise_lock_user(p_uid UUID) RETURNS VOID
LANGUAGE sql VOLATILE AS $$
  SELECT pg_advisory_xact_lock(hashtext('vvv.praise_kiss'), hashtext(p_uid::TEXT))
$$;

-- Text rules. Mirrored in lib/praise/rules.ts, which only gives early feedback: these functions decide.
CREATE OR REPLACE FUNCTION praise_clean(p_body TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          replace(coalesce(p_body, ''), E'\r\n', E'\n'),
          '[ \t\f\v\r\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+', ' ', 'g'),
        ' ?\n ?', E'\n', 'g'),
      '\n{3,}', E'\n\n', 'g'),
    E' \n')
$$;

CREATE OR REPLACE FUNCTION praise_deaccent(p_text TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(
    replace(replace(replace(replace(replace(
      regexp_replace(normalize(coalesce(p_text, ''), NFD), '[\u0300-\u036f]', '', 'g'),
      chr(339), 'oe'), chr(338), 'oe'), chr(230), 'ae'), chr(198), 'ae'), chr(223), 'ss'))
$$;

CREATE OR REPLACE FUNCTION praise_normalize(p_text TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(regexp_replace(
    regexp_replace(public.praise_deaccent(p_text), '[''`\u2019\u02bc]', '', 'g'),
    '[^a-z]+', ' ', 'g'))
$$;

-- A word holds at least two letters or digits: "w", "x" or "#1" alone do not count.
CREATE OR REPLACE FUNCTION praise_word_count(p_clean TEXT) RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::INTEGER
  FROM regexp_split_to_table(public.praise_deaccent(p_clean), '[ \n]+') AS t(token)
  WHERE char_length(regexp_replace(token, '[^a-z0-9]', '', 'g')) >= 2
$$;

-- The insult filter, mirrored line for line in lib/praise/insults.ts (INSULT_STEMS, findInsult): keep both lists
-- and both algorithms identical. Each stem starts with its mode:
--   =  whole token        short or common stems (mok, tg, pd, nul, con)
--   ^  token prefix       short stems that only take endings (nik, zb, wld, w9, 5to, kelb)
--   ~  compact substring  long, distinctive stems that survive any split (charmouta, 9ahba, putain)
-- Repeated letters collapse before matching, so stems are written collapsed: conard for connard, nob for noob
-- (a whole token, so noble passes).
CREATE OR REPLACE FUNCTION praise_insult_stems() RETURNS TEXT[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    -- Darija
    '^zaml', '^zamel', '^zamal', '^zmel', '^zml', '^zwaml', '^zwamel',
    '^5to', '^khto', '^5tk', '^khtk', '^khtek', '^5tek', '^o5t', '^okht', '=5tak', '=khtak',
    '^w9', '^wqi7', '^wqa7',
    '^wld', '^wlid', '^wlad',
    '~9ahba', '~qahba', '~kahba', '~9a7ba', '~qa7ba', '~ka7ba', '~9e7ba', '~9hba', '~q7ba', '~9hab', '~q7ab', '~qhab', '^3ahir',
    '^zb', '^zebi', '=zeb', '^zob',
    '^nik', '^nayk', '^nayek', '^n7wi', '^nhwi', '^tnyak', '^tnayk', '^tnik', '^mnyo', '^manyo', '^t7wa',
    '~9awed', '~qawed', '~9awd', '~qawd', '~9wd', '=qwd', '^9wad', '^qwad', '^m9wd',
    '=mok', '=tmok', '=mk', '=mouk',
    '^zok', '=zk',
    '^7mar', '^hmar', '^7mir', '^hmir', '^7imar', '^himar',
    '^kelb', '^klb', '^kalb', '^kleb', '^klab',
    '^bghel', '^bghl', '^bghal', '^b8el',
    '~9lawi', '~qlawi', '^klawi', '^9lwa', '^qlwa',
    '^terma', '^tirma',
    '=5ra', '=khra', '=khara', '=5ara', '^5rya', '^khrya', '^5raw', '^khraw',
    '^tfou', '=tfo', '=tfu',
    '~charmout', '~sharmout', '~chermout', '~charmot', '~sharmot', '~chermot', '~charmut', '~sharmut',
    '^manyak', '^maniak',
    '^khanz', '^5anz', '^7ayawan', '^hayawan', '^9erd', '^qerd', '^9ird', '^qird',
    '^halouf', '^7alouf', '^hlouf', '^7louf', '^ghbi', '^ghabi', '^tbon', '^tboun',
    '^mskhot', '^mskhout', '^msakh', '^mse5', '^msa5',
    -- French
    '^pute', '~putain', '=ptn', '^fdp', '^ntm', '^niqu', '^encul', '=con', '=cons', '=conne', '^conar', '^conas',
    '^coner', '^salop', '^merd', '^emerd', '^batar', '^abrut', '^debil', '=tg', '~tagueule', '=pd', '=pede',
    '=nul', '=nuls', '^nulos', '^nulard', '=cul', '^boufon', '^tocar', '^minabl', '^pouri', '=cassos', '^baltring',
    '=teube', '=golmon', '^fiot', '^enfoir', '^ordur', '^raclur', '=chier', '=naze',
    -- English
    '~fuck', '^fuk', '^fck', '^fvck', '^shit', '^bulshit', '=sht', '^bitch', '^biatch', '^btch', '^ashol', '^dick',
    '=nob', '=nobs', '=newb', '=nub', '^trash', '^idiot', '^stupid', '^loser', '^clown', '^dumb', '^moron', '^bastar',
    '^cunt', '^wank', '=twat', '=bozo', '^suck', '^garbag', '^pathetic', '^feeder', '=inting', '^hardstuck', '^jerk',
    '=ugly'
  ]
$$;

-- The first insult stem found in the text, or NULL. Runs on the cleaned body, digits included (praise_normalize
-- drops them). Two passes: the Darija one keeps 3, 5, 7 and 9 (letters in Arabizi) and reads 4 and @ as a, 0 as o,
-- 1 as i and $ as s; the Latin one also reads 3 as e and 5 as s. Accents, compatibility forms (NFKD) and common
-- Cyrillic and Greek look-alikes fold to latin letters first. Tokens are matched three ways: split on every symbol,
-- glued across symbols (z.a.m.l, z-a-m-l) and runs of single letters glued back (z a m l). "nul" is a whole token
-- only (nulle part, nullement pass) and never in the French "nul ne" (nobody).
-- Known misses, by choice: Nike or Nikola trip nik, and kalbi (my heart, in some dialects) trips kalb.
CREATE OR REPLACE FUNCTION praise_insult(p_text TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_folded TEXT := lower(translate(
    replace(replace(replace(replace(replace(
      regexp_replace(normalize(coalesce(p_text, ''), NFKD), '[\u0300-\u036f]', '', 'g'),
      chr(339), 'oe'), chr(338), 'oe'), chr(230), 'ae'), chr(198), 'ae'), chr(223), 'ss'),
    'аеорсхуікмтвнѕјАЕОРСХУІКМТВНЅЈαεικνορτυχΑΕΙΚΝΟΡΤΥΧ',
    'aeopcxyikmtbhsjaeopcxyikmtbhsjaeikvoptuxaeiknoptyx'));
  v_pass TEXT;
  v_split TEXT[];
  v_tokens TEXT[];
  v_token TEXT;
  v_run TEXT;
  v_compact TEXT;
  v_entry TEXT;
  v_stem TEXT;
  v_hit BOOLEAN;
BEGIN
  FOREACH v_pass IN ARRAY ARRAY[translate(v_folded, '4@01$', 'aaois'), translate(v_folded, '4@01$35', 'aaoises')] LOOP
    v_pass := regexp_replace(v_pass, '(^|[^a-z0-9])nul([^a-z0-9]+ne)(?![a-z0-9])', '\1\2', 'g');

    v_split := ARRAY[]::TEXT[];
    FOREACH v_token IN ARRAY regexp_split_to_array(v_pass, '[^a-z0-9]+') LOOP
      IF v_token <> '' THEN
        v_split := v_split || regexp_replace(v_token, '(.)\1+', '\1', 'g');
      END IF;
    END LOOP;

    v_tokens := v_split;
    FOREACH v_token IN ARRAY regexp_split_to_array(regexp_replace(v_pass, '[^a-z0-9\s]', '', 'g'), '\s+') LOOP
      IF v_token <> '' THEN
        v_tokens := v_tokens || regexp_replace(v_token, '(.)\1+', '\1', 'g');
      END IF;
    END LOOP;

    v_run := '';
    FOREACH v_token IN ARRAY v_split || ''::TEXT LOOP
      IF char_length(v_token) = 1 THEN
        v_run := v_run || v_token;
      ELSE
        IF char_length(v_run) > 1 THEN
          v_tokens := v_tokens || regexp_replace(v_run, '(.)\1+', '\1', 'g');
        END IF;
        v_run := '';
      END IF;
    END LOOP;

    v_compact := regexp_replace(regexp_replace(v_pass, '[^a-z0-9]', '', 'g'), '(.)\1+', '\1', 'g');

    FOREACH v_entry IN ARRAY public.praise_insult_stems() LOOP
      v_stem := substr(v_entry, 2);
      v_hit := CASE left(v_entry, 1)
        WHEN '=' THEN v_stem = ANY (v_tokens)
        WHEN '^' THEN EXISTS (SELECT 1 FROM unnest(v_tokens) AS t WHERE left(t, char_length(v_stem)) = v_stem)
        ELSE strpos(v_compact, v_stem) > 0
      END;
      IF v_hit THEN
        RETURN v_stem;
      END IF;
    END LOOP;
  END LOOP;
  RETURN NULL;
END;
$$;

-- The long-form inspiration prompts of rules version 1. The composer now offers words of worship, meant to be used
-- as they are, so no rule checks against this list anymore. Kept for older callers.
CREATE OR REPLACE FUNCTION praise_prompt_bodies() RETURNS TEXT[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'Compare him to a Baron steal.',
    'Thank him for a defeat he calls a delayed victory.',
    'Explain why the 0/8 Yone game was a masterclass in patience.',
    'Defend the solo Baron call. He had a plan. Probably.',
    'Review his reign like a five-star restaurant.',
    'Announce his comeback like a patch note.',
    'Praise his jungle pathing, wherever it went.',
    'Thank him for every gank that almost happened.',
    'Write it as a royal decree, with at least one hereby.',
    'Cast his last teamfight like a Worlds final.',
    'Convince the rebels he never fell, he just recalled.',
    'Toast his second coronation. Raise your glass high.',
    'Praise his map awareness, especially around the fountain.',
    'Explain why his ff15 votes were acts of mercy.',
    'Describe the crown on the floor with the dignity it deserves.',
    'Compliment the little notebook. Hope your name is not in it.',
    'Name one thing he did right. Take your time.',
    'Write him a haiku. Syllables optional, loyalty mandatory.',
    'Thank him for teaching the Charamil humility, mostly by example.',
    'Hype his flash, especially the ones into walls.',
    'Ecris-lui un compliment en francais, comme un vrai courtisan.',
    'Pretend you are the last loyalist and you never doubted him.',
    'Compare his KDA to a fine wine. It needs time.',
    'Describe how much the empty throne misses him.',
    'Sell his autograph like it is a legendary skin.',
    'Thank him for the points he has generously not stolen yet.',
    'Praise his shotcalling. Out loud. In public.',
    'Write the opening line of his biography.'
  ]
$$;

-- Returns NULL when the cleaned praise passes every rule, otherwise the first violated rule.
-- Short lines (rules version 2): the 8-word, 5-distinct-word and stray-letter rules are gone (they only stopped
-- padding up to the old minimum), mash limits are tighter, and the repeat rule allows no word of 4+ letters twice
-- and no word three times ("mon roi, mon GOAT" passes, "Legend Legend SLX" does not). Arabic script still counts
-- as symbols.
CREATE OR REPLACE FUNCTION praise_rule_violation(p_clean TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_rules JSONB := public.praise_rules();
  v_chars INTEGER := char_length(coalesce(p_clean, ''));
  v_lowered TEXT := public.praise_deaccent(p_clean);
  v_norm TEXT := public.praise_normalize(p_clean);
  v_compact TEXT;
  v_top INTEGER;
  v_top_long INTEGER;
BEGIN
  IF public.praise_insult(p_clean) IS NOT NULL THEN RETURN 'insult'; END IF;
  IF v_chars < (v_rules->>'min_length')::INTEGER THEN RETURN 'too_short'; END IF;
  IF v_chars > (v_rules->>'max_length')::INTEGER THEN RETURN 'too_long'; END IF;
  IF public.praise_word_count(p_clean) < (v_rules->>'min_words')::INTEGER THEN RETURN 'too_few_words'; END IF;
  IF v_norm !~ '(^| )(salax|slx|chalaks|chklat|chklass|goblino)' THEN RETURN 'no_name'; END IF;

  IF v_norm ~ '(.)\1{5,}'
    OR v_norm ~ '(.{2,3})\1{3,}'
    OR v_norm ~ '(qwert|werty|ertyu|rtyui|tyuio|yuiop|asdfg|sdfgh|dfghj|fghjk|ghjkl|hjklm|zxcvb|xcvbn|cvbnm|azert|zerty|qsdfg|wxcvb|trewq|ytrew|uytre|iuytr|oiuyt|poiuy|gfdsa|hgfds|jhgfd|kjhgf|lkjhg|bvcxz|nbvcx|mnbvc)'
    OR v_norm ~ '[bcdfghjklmnpqrstvwxz]{6,}'
    OR v_norm ~ '[a-z]{20,}'
  THEN
    RETURN 'keyboard_mash';
  END IF;

  SELECT coalesce(max(c), 0), coalesce(max(c) FILTER (WHERE length(w) > 3), 0)
  INTO v_top, v_top_long
  FROM (
    SELECT w, count(*) AS c
    FROM unnest(string_to_array(v_norm, ' ')) AS w
    WHERE w <> ''
    GROUP BY w
  ) g;
  IF v_top_long > 1 OR v_top > 2 THEN
    RETURN 'repetitive';
  END IF;

  v_compact := regexp_replace(v_lowered, '[ \n]', '', 'g');
  IF char_length(regexp_replace(v_compact, '[^a-z]', '', 'g')) * 10 < char_length(v_compact) * 6 THEN
    RETURN 'too_many_symbols';
  END IF;

  RETURN NULL;
END;
$$;

-- Jaccard similarity of the distinct words of two normalized praises. submit_praise refuses 0.8 and up, kept for
-- short lines on purpose: with 4 distinct words or fewer, 0.8 is only reached by the same words in another order
-- (or a 4-word line plus one word), so sharing his name and one word of worship with an earlier praise ("Salaxe
-- GOAT" after "Salaxe the GOAT", 2/3) still passes. Exact repeats are caught by the fingerprint first.
CREATE OR REPLACE FUNCTION praise_similarity(p_a TEXT, p_b TEXT) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE AS $$
  WITH a AS (SELECT DISTINCT w FROM unnest(string_to_array(p_a, ' ')) AS w WHERE w <> ''),
       b AS (SELECT DISTINCT w FROM unnest(string_to_array(p_b, ' ')) AS w WHERE w <> '')
  SELECT coalesce(
    (SELECT count(*) FROM (SELECT w FROM a INTERSECT SELECT w FROM b) i)::NUMERIC
      / NULLIF((SELECT count(*) FROM (SELECT w FROM a UNION SELECT w FROM b) u), 0),
    0)
$$;

CREATE OR REPLACE FUNCTION praise_salaxe_user_id() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT auth_user_id FROM public.players
  WHERE lower(name) = 'salaxe' AND auth_user_id IS NOT NULL
  ORDER BY created_at
  LIMIT 1
$$;

-- Validates, stores and rewards one praise for the caller. The reward reason stays sing_his_praises
-- so devotion milestones, the leaderboard and act awards keep counting it.
CREATE OR REPLACE FUNCTION submit_praise(p_body TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET timezone = 'UTC' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_body TEXT := praise_clean(left(coalesce(p_body, ''), 2000));
  v_norm TEXT;
  v_fp TEXT;
  v_violation TEXT;
  v_match UUID;
  v_row praises%ROWTYPE;
  v_balance INTEGER;
  v_constraint TEXT;
  v_reward INTEGER;
  v_riddle_bonus INTEGER;
  v_riddle_ms INTEGER;
  v_riddle_misses INTEGER;
  v_per_day INTEGER := (praise_rules()->>'per_day')::INTEGER;
  v_slot INTEGER;
  v_base INTEGER;
  v_left INTEGER[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  PERFORM praise_lock_user(v_uid);
  v_slot := praise_next_slot(v_uid);
  IF v_slot IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'already_sung', 'per_day', v_per_day, 'resets_at', (CURRENT_DATE + 1)::TIMESTAMPTZ
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM point_balances WHERE user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_balance');
  END IF;

  -- King's Riddle (phase10_riddles.sql): the riddle of this kiss's slot must be solved first. Skipped while that
  -- file is missing.
  IF to_regprocedure('public.praise_riddle_bonus(uuid)') IS NOT NULL THEN
    v_riddle_bonus := praise_riddle_bonus(v_uid);
    IF v_riddle_bonus IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'riddle_required');
    END IF;
    IF to_regprocedure('public.praise_riddle_stats(uuid)') IS NOT NULL THEN
      SELECT r.ms, r.misses INTO v_riddle_ms, v_riddle_misses FROM praise_riddle_stats(v_uid) r;
    END IF;
  END IF;

  v_violation := praise_rule_violation(v_body);
  IF v_violation IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', v_violation);
  END IF;

  v_norm := praise_normalize(v_body);
  v_fp := md5(v_norm);

  SELECT user_id INTO v_match FROM praises WHERE fingerprint = v_fp LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'duplicate', 'match_user_id', v_match);
  END IF;

  SELECT r.user_id INTO v_match
  FROM (SELECT user_id, normalized FROM praises ORDER BY created_at DESC LIMIT 1500) r
  WHERE praise_similarity(v_norm, r.normalized) >= 0.8
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_similar', 'match_user_id', v_match);
  END IF;

  v_base := praise_slot_reward(v_slot);
  v_reward := vvv_title_scaled(v_uid, 'praise_bonus_pct', v_base); -- title effects: Last Loyalist, devotion honors

  BEGIN
    INSERT INTO praises (
      user_id, body, normalized, fingerprint, reward, praise_day, praise_slot, riddle_ms, riddle_misses
    )
    VALUES (v_uid, v_body, v_norm, v_fp, v_reward, CURRENT_DATE, v_slot, v_riddle_ms, v_riddle_misses)
    RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    RETURN jsonb_build_object(
      'ok', false,
      'error', CASE WHEN v_constraint IN ('praises_one_per_slot', 'praises_one_per_day') THEN 'already_sung' ELSE 'duplicate' END
    );
  END;

  v_balance := adjust_balance(v_uid, v_reward, 'sing_his_praises', v_row.id);
  -- King's Riddle: the Sharp Mind bonus for a first-try solve, once per kiss like the praise itself. Titles never
  -- scale it: only the praise reward above carries the title bonus.
  IF v_riddle_bonus > 0 THEN
    v_balance := adjust_balance(v_uid, v_riddle_bonus, 'riddle_bonus', v_row.id);
  END IF;

  v_left := praise_free_slots(v_uid);
  RETURN jsonb_build_object(
    'ok', true,
    'praise', to_jsonb(v_row) - 'normalized' - 'fingerprint',
    'balance', v_balance,
    'riddle_bonus', coalesce(v_riddle_bonus, 0),
    'slot', v_slot,
    'per_day', v_per_day,
    'base_reward', v_base,
    'remaining_today', cardinality(v_left),
    'next_reward', CASE WHEN cardinality(v_left) > 0 THEN praise_slot_reward(v_left[1]) END,
    'resets_at', (CURRENT_DATE + 1)::TIMESTAMPTZ,
    'title_effects', vvv_title_fx_take()
  );
END;
$$;

-- Salaxe (the player named salaxe) crowns (+50 Royal Favor, 3 per day) or scorns a praise. Verdicts are final.
CREATE OR REPLACE FUNCTION judge_praise(p_praise_id UUID, p_verdict TEXT, p_note TEXT DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET timezone = 'UTC' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_note TEXT := NULLIF(btrim(regexp_replace(coalesce(p_note, ''), '\s+', ' ', 'g')), '');
  v_row praises%ROWTYPE;
  v_crowns INTEGER;
  v_balance INTEGER;
  v_favor INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF v_uid IS DISTINCT FROM praise_salaxe_user_id() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_salaxe');
  END IF;
  IF p_verdict IS NULL OR p_verdict NOT IN ('crowned', 'scorned') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_verdict');
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note) > 140 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'note_too_long');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('vvv.judge_praise'));

  SELECT * INTO v_row FROM praises WHERE id = p_praise_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_row.user_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'own_praise');
  END IF;
  IF v_row.verdict IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_judged', 'verdict', v_row.verdict);
  END IF;

  SELECT count(*) INTO v_crowns FROM praises
  WHERE verdict = 'crowned'
    AND judged_at >= CURRENT_DATE::TIMESTAMPTZ
    AND judged_at < (CURRENT_DATE + 1)::TIMESTAMPTZ;

  IF p_verdict = 'crowned' THEN
    IF v_crowns >= 3 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'crown_limit');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM point_balances WHERE user_id = v_row.user_id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'author_unavailable');
    END IF;
    v_favor := vvv_title_scaled(v_row.user_id, 'favor_bonus_pct', 50); -- title effects: Throne Polisher
  END IF;

  UPDATE praises
  SET verdict = p_verdict,
      verdict_note = v_note,
      judged_by = v_uid,
      judged_at = now(),
      favor = v_favor
  WHERE id = p_praise_id AND verdict IS NULL
  RETURNING * INTO v_row;

  IF p_verdict = 'crowned' THEN
    v_balance := adjust_balance(v_row.user_id, v_favor, 'royal_favor', v_row.id);
    v_crowns := v_crowns + 1;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'praise', to_jsonb(v_row) - 'normalized' - 'fingerprint',
    'author_balance', v_balance,
    'crowns_left', greatest(0, 3 - v_crowns),
    'title_effects', vvv_title_fx_take()
  );
END;
$$;

-- Everything the praise panel needs about today, the caller and the court, in one call. today_id is the caller's
-- latest praise of the day; sung_today, remaining_today, next_slot and next_reward (its base) count the daily
-- kisses (per_day and the rewards schedule come with praise_rules()).
CREATE OR REPLACE FUNCTION praise_state() RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public SET timezone = 'UTC' AS $$
  WITH me AS (SELECT auth.uid() AS uid),
       king AS (SELECT praise_salaxe_user_id() AS uid),
       free AS (SELECT CASE WHEN uid IS NULL THEN '{}'::INTEGER[] ELSE praise_free_slots(uid) END AS slots FROM me)
  SELECT jsonb_build_object(
    'today', CURRENT_DATE,
    'resets_at', (CURRENT_DATE + 1)::TIMESTAMPTZ,
    'server_now', now(),
    'user_id', (SELECT uid FROM me),
    'salaxe_user_id', (SELECT uid FROM king),
    'total_count', (SELECT count(*) FROM praises),
    'pending_count', (
      SELECT count(*) FROM praises
      WHERE verdict IS NULL
        AND user_id IS DISTINCT FROM (SELECT uid FROM king)
        AND created_at >= now() - interval '7 days'
    ),
    'crowns_today', (
      SELECT count(*) FROM praises
      WHERE verdict = 'crowned'
        AND judged_at >= CURRENT_DATE::TIMESTAMPTZ
        AND judged_at < (CURRENT_DATE + 1)::TIMESTAMPTZ
    ),
    'today_id', (
      SELECT id FROM praises
      WHERE user_id = (SELECT uid FROM me) AND praise_day = CURRENT_DATE
      ORDER BY created_at DESC, praise_slot DESC
      LIMIT 1
    ),
    'sung_today', (
      SELECT count(*) FROM praises WHERE user_id = (SELECT uid FROM me) AND praise_day = CURRENT_DATE
    ),
    'remaining_today', (SELECT cardinality(slots) FROM free),
    'next_slot', (SELECT slots[1] FROM free),
    'next_reward', (SELECT praise_slot_reward(slots[1]) FROM free WHERE cardinality(slots) > 0),
    'my_total', (SELECT count(*) FROM praises WHERE user_id = (SELECT uid FROM me)),
    'my_crowned', (
      SELECT count(*) FROM praises WHERE user_id = (SELECT uid FROM me) AND verdict = 'crowned'
    ),
    'my_favor', (SELECT coalesce(sum(favor), 0) FROM praises WHERE user_id = (SELECT uid FROM me)),
    'my_legacy', (
      SELECT count(*) FROM point_transactions
      WHERE user_id = (SELECT uid FROM me)
        AND reason IN ('kiss_the_hand', 'sing_his_praises')
        AND reference_id IS NULL
    )
  ) || praise_rules()
$$;

REVOKE EXECUTE ON FUNCTION praise_lock_user(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION submit_praise(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION judge_praise(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_praise(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION judge_praise(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION praise_state() TO anon, authenticated;

SELECT vvv_add_to_realtime('praises');

NOTIFY pgrst, 'reload schema';
