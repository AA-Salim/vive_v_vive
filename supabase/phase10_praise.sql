-- Phase 10: Sing His Praises. A written praise for Salaxe is worth 150 points, once per day.
-- Requires phase10_foundation.sql (free-form point reasons, vvv_add_to_realtime).
-- Additive and idempotent: safe to run while the previous app version is deployed.
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
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 40 AND 280),
  normalized TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  reward INTEGER NOT NULL DEFAULT 150 CHECK (reward >= 0),
  praise_day DATE NOT NULL DEFAULT CURRENT_DATE,
  verdict TEXT CHECK (verdict IN ('crowned', 'scorned')),
  verdict_note TEXT CHECK (verdict_note IS NULL OR char_length(verdict_note) BETWEEN 1 AND 140),
  favor INTEGER NOT NULL DEFAULT 0 CHECK (favor >= 0),
  judged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  judged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT praises_verdict_complete CHECK ((verdict IS NULL) = (judged_at IS NULL))
);

-- One praise per user per day (same CURRENT_DATE boundary as claim_daily_bonus) and no song sung twice.
CREATE UNIQUE INDEX IF NOT EXISTS praises_one_per_day ON praises (user_id, praise_day);
CREATE UNIQUE INDEX IF NOT EXISTS praises_fingerprint_unique ON praises (fingerprint);
CREATE INDEX IF NOT EXISTS praises_recent_idx ON praises (created_at DESC);
CREATE INDEX IF NOT EXISTS praises_user_idx ON praises (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS praises_crowned_idx ON praises (judged_at DESC) WHERE verdict = 'crowned';
CREATE INDEX IF NOT EXISTS praises_pending_idx ON praises (created_at DESC) WHERE verdict IS NULL;

ALTER TABLE praises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "praises_read" ON praises;
CREATE POLICY "praises_read" ON praises FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON praises FROM anon, authenticated;

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

CREATE OR REPLACE FUNCTION praise_word_count(p_clean TEXT) RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::INTEGER
  FROM regexp_split_to_table(public.praise_deaccent(p_clean), '[ \n]+') AS t(token)
  WHERE token ~ '[a-z0-9]'
$$;

-- The inspiration prompts shown in the composer (lib/praise/prompts.ts). Copying one is not a praise.
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
CREATE OR REPLACE FUNCTION praise_rule_violation(p_clean TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_chars INTEGER := char_length(coalesce(p_clean, ''));
  v_lowered TEXT := public.praise_deaccent(p_clean);
  v_norm TEXT := public.praise_normalize(p_clean);
  v_compact TEXT;
  v_total INTEGER;
  v_distinct INTEGER;
  v_top INTEGER;
  v_single INTEGER;
BEGIN
  IF v_chars < 40 THEN RETURN 'too_short'; END IF;
  IF v_chars > 280 THEN RETURN 'too_long'; END IF;
  IF public.praise_word_count(p_clean) < 8 THEN RETURN 'too_few_words'; END IF;
  IF v_norm !~ '(^| )(salax|slx|chalaks|chklat|chklass|goblino)' THEN RETURN 'no_name'; END IF;

  IF v_norm ~ '(.)\1{5,}'
    OR v_norm ~ '(.{2,3})\1{4,}'
    OR v_norm ~ '(qwert|werty|ertyu|rtyui|tyuio|yuiop|asdfg|sdfgh|dfghj|fghjk|ghjkl|hjklm|zxcvb|xcvbn|cvbnm|azert|zerty|qsdfg|wxcvb|trewq|ytrew|uytre|iuytr|oiuyt|poiuy|gfdsa|hgfds|jhgfd|kjhgf|lkjhg|bvcxz|nbvcx|mnbvc)'
    OR v_norm ~ '[bcdfghjklmnpqrstvwxz]{6,}'
    OR v_norm ~ '[a-z]{31,}'
  THEN
    RETURN 'keyboard_mash';
  END IF;

  -- Function words (a, y, le, un, the...) repeat in any real sentence, so only stray letters and
  -- repeated words of 4+ letters count as filler.
  SELECT
    coalesce(sum(c), 0),
    count(*) FILTER (WHERE length(w) > 1),
    coalesce(max(c) FILTER (WHERE length(w) > 3), 0),
    coalesce(sum(c) FILTER (WHERE length(w) = 1 AND w NOT IN ('a', 'i', 'o', 'y')), 0)
  INTO v_total, v_distinct, v_top, v_single
  FROM (
    SELECT w, count(*) AS c
    FROM unnest(string_to_array(v_norm, ' ')) AS w
    WHERE w <> ''
    GROUP BY w
  ) g;
  IF v_distinct < 5
    OR v_single * 10 > v_total * 3
    OR (v_top > 3 AND v_top * 100 > 34 * v_total)
    OR v_norm ~ '(^| )([a-z]+)( \2){3,}( |$)'
  THEN
    RETURN 'repetitive';
  END IF;

  v_compact := regexp_replace(v_lowered, '[ \n]', '', 'g');
  IF char_length(regexp_replace(v_compact, '[^a-z]', '', 'g')) * 10 < char_length(v_compact) * 6 THEN
    RETURN 'too_many_symbols';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(public.praise_prompt_bodies()) AS b
    WHERE strpos(' ' || v_norm || ' ', ' ' || public.praise_normalize(b) || ' ') > 0
  ) THEN
    RETURN 'prompt_copy';
  END IF;

  RETURN NULL;
END;
$$;

-- Jaccard similarity of the distinct words of two normalized praises.
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
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF EXISTS (SELECT 1 FROM praises WHERE user_id = v_uid AND praise_day = CURRENT_DATE) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_sung', 'resets_at', (CURRENT_DATE + 1)::TIMESTAMPTZ);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM point_balances WHERE user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_balance');
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

  BEGIN
    INSERT INTO praises (user_id, body, normalized, fingerprint, reward, praise_day)
    VALUES (v_uid, v_body, v_norm, v_fp, 150, CURRENT_DATE)
    RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    RETURN jsonb_build_object(
      'ok', false,
      'error', CASE WHEN v_constraint = 'praises_one_per_day' THEN 'already_sung' ELSE 'duplicate' END
    );
  END;

  v_balance := adjust_balance(v_uid, 150, 'sing_his_praises', v_row.id);

  RETURN jsonb_build_object(
    'ok', true,
    'praise', to_jsonb(v_row) - 'normalized' - 'fingerprint',
    'balance', v_balance,
    'resets_at', (CURRENT_DATE + 1)::TIMESTAMPTZ
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
  END IF;

  UPDATE praises
  SET verdict = p_verdict,
      verdict_note = v_note,
      judged_by = v_uid,
      judged_at = now(),
      favor = CASE WHEN p_verdict = 'crowned' THEN 50 ELSE 0 END
  WHERE id = p_praise_id AND verdict IS NULL
  RETURNING * INTO v_row;

  IF p_verdict = 'crowned' THEN
    v_balance := adjust_balance(v_row.user_id, 50, 'royal_favor', v_row.id);
    v_crowns := v_crowns + 1;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'praise', to_jsonb(v_row) - 'normalized' - 'fingerprint',
    'author_balance', v_balance,
    'crowns_left', greatest(0, 3 - v_crowns)
  );
END;
$$;

-- Everything the praise panel needs about today, the caller and the court, in one call.
CREATE OR REPLACE FUNCTION praise_state() RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public SET timezone = 'UTC' AS $$
  WITH me AS (SELECT auth.uid() AS uid),
       king AS (SELECT praise_salaxe_user_id() AS uid)
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
      SELECT id FROM praises WHERE user_id = (SELECT uid FROM me) AND praise_day = CURRENT_DATE
    ),
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
  )
$$;

REVOKE EXECUTE ON FUNCTION submit_praise(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION judge_praise(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_praise(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION judge_praise(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION praise_state() TO anon, authenticated;

SELECT vvv_add_to_realtime('praises');

NOTIFY pgrst, 'reload schema';
