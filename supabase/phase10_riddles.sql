-- Phase 10: The King's Riddle. Before a subject sings his praises, Salaxe tests their wit with one small
-- puzzle: a number sequence, an arrow sequence or a pipe maze. submit_praise (phase10_praise.sql) refuses a
-- praise until today's riddle is solved, and pays the Sharp Mind bonus (+20, ledger reason riddle_bonus)
-- with the praise reward when it was solved on the first try. A wrong answer retires the riddle and poses a
-- new one, up to 10 riddles a day.
-- Requires phase10_praise.sql. Additive and idempotent, safe before and after phase11_lockdown.sql.
-- Answers never leave the database before a riddle is solved: clients cannot read the table, and the two
-- client functions only return the public half of a riddle. Days are UTC days, like praises.
-- Constants mirrored in lib/praise/rules.ts (RIDDLE_FIRST_TRY_BONUS, RIDDLE_DAILY_LIMIT); the generators and
-- the maze check are mirrored for display only in lib/praise/riddle.ts.

DO $$
BEGIN
  IF to_regprocedure('public.submit_praise(text)') IS NULL OR to_regclass('public.praises') IS NULL THEN
    RAISE EXCEPTION 'Run supabase/phase10_praise.sql before supabase/phase10_riddles.sql';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION riddle_first_try_bonus() RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$ SELECT 20 $$;

CREATE OR REPLACE FUNCTION riddle_daily_limit() RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$ SELECT 10 $$;

-- One row per user per day, holding the riddle currently posed. attempts counts the answers given today
-- (misses, skips and the final solve), so the riddle on screen is number attempts + 1.
CREATE TABLE IF NOT EXISTS praise_riddles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  riddle_day DATE NOT NULL DEFAULT CURRENT_DATE,
  kind TEXT NOT NULL CHECK (kind IN ('sequence', 'arrows', 'maze')),
  puzzle JSONB NOT NULL,
  answer JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  solved_at TIMESTAMPTZ,
  first_try BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, riddle_day),
  CONSTRAINT praise_riddles_solved_complete CHECK ((solved_at IS NULL) = (first_try IS NULL))
);

ALTER TABLE praise_riddles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON praise_riddles FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION riddle_rand(p_lo INTEGER, p_hi INTEGER) RETURNS INTEGER
LANGUAGE sql VOLATILE AS $$
  SELECT p_lo + floor(random() * (p_hi - p_lo + 1))::INTEGER
$$;

CREATE OR REPLACE FUNCTION riddle_shuffle(p_items INTEGER[]) RETURNS INTEGER[]
LANGUAGE sql VOLATILE AS $$
  SELECT coalesce(array_agg(x ORDER BY random()), '{}') FROM unnest(p_items) AS x
$$;

-- ============================================================
-- Number sequences
-- ============================================================

-- The next term predicted by every simple rule that fits p_terms: same step, same ratio, same change of
-- step (or of that change), two alternating steps, times m plus c, and sum of the two before. A sequence is
-- fair when every rule that fits agrees on the next term.
CREATE OR REPLACE FUNCTION riddle_sequence_predictions(p_terms INTEGER[]) RETURNS NUMERIC[]
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  t NUMERIC[] := p_terms::NUMERIC[];
  n INTEGER := coalesce(cardinality(p_terms), 0);
  v_out NUMERIC[] := '{}';
  v_fits BOOLEAN;
  v_m NUMERIC;
  v_c NUMERIC;
  i INTEGER;
BEGIN
  IF n < 3 THEN
    RETURN v_out;
  END IF;

  v_fits := true;
  FOR i IN 3..n LOOP
    v_fits := v_fits AND t[i] - t[i - 1] = t[2] - t[1];
  END LOOP;
  IF v_fits THEN v_out := v_out || (t[n] + t[2] - t[1]); END IF;

  IF t[1] <> 0 AND t[2] <> 0 THEN
    v_fits := true;
    FOR i IN 3..n LOOP
      v_fits := v_fits AND t[i] * t[1] = t[i - 1] * t[2];
    END LOOP;
    IF v_fits THEN v_out := v_out || (t[n] * t[2] / t[1]); END IF;
  END IF;

  IF n >= 4 THEN
    v_fits := true;
    FOR i IN 4..n LOOP
      v_fits := v_fits AND (t[i] - 2 * t[i - 1] + t[i - 2]) = (t[3] - 2 * t[2] + t[1]);
    END LOOP;
    IF v_fits THEN v_out := v_out || (2 * t[n] - t[n - 1] + (t[3] - 2 * t[2] + t[1])); END IF;

    IF n >= 5 THEN
      v_fits := true;
      FOR i IN 5..n LOOP
        v_fits := v_fits AND (t[i] - 3 * t[i - 1] + 3 * t[i - 2] - t[i - 3]) = (t[4] - 3 * t[3] + 3 * t[2] - t[1]);
      END LOOP;
      IF v_fits THEN v_out := v_out || (3 * t[n] - 3 * t[n - 1] + t[n - 2] + (t[4] - 3 * t[3] + 3 * t[2] - t[1])); END IF;
    END IF;

    v_fits := true;
    FOR i IN 4..n LOOP
      v_fits := v_fits AND t[i] - t[i - 1] = t[i - 2] - t[i - 3];
    END LOOP;
    IF v_fits THEN v_out := v_out || (t[n] + t[n - 1] - t[n - 2]); END IF;

    IF t[2] <> t[1] THEN
      v_m := (t[3] - t[2]) / (t[2] - t[1]);
      v_c := t[2] - v_m * t[1];
      v_fits := true;
      FOR i IN 3..n LOOP
        v_fits := v_fits AND abs(t[i] - (v_m * t[i - 1] + v_c)) < 0.000001;
      END LOOP;
      IF v_fits THEN v_out := v_out || round(v_m * t[n] + v_c, 6); END IF;
    END IF;
  END IF;

  v_fits := true;
  FOR i IN 3..n LOOP
    v_fits := v_fits AND t[i] = t[i - 1] + t[i - 2];
  END LOOP;
  IF v_fits THEN v_out := v_out || (t[n] + t[n - 1]); END IF;

  RETURN v_out;
END;
$$;

-- "2, 4, 8, 16, ?" with four options. Light on purpose: one rule, small numbers, solvable in under a minute.
CREATE OR REPLACE FUNCTION riddle_make_sequence() RETURNS JSONB
LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE
  v_rule TEXT;
  v_all INTEGER[];
  v_terms INTEGER[];
  v_answer INTEGER;
  v_pred NUMERIC[];
  v_a INTEGER;
  v_b INTEGER;
  v_x INTEGER;
  v_last INTEGER;
  v_gap INTEGER;
  v_pick INTEGER;
  v_options INTEGER[];
  v_try INTEGER := 0;
BEGIN
  LOOP
    v_try := v_try + 1;
    v_a := NULL;
    v_b := NULL;
    v_rule := (ARRAY['add', 'subtract', 'double', 'triple', 'halve', 'squares', 'growing', 'fibonacci',
      'alternate', 'double_plus_one'])[riddle_rand(1, 10)];
    CASE v_rule
      WHEN 'add' THEN
        v_a := riddle_rand(2, 9);
        v_x := riddle_rand(1, 20);
        v_all := ARRAY(SELECT v_x + i * v_a FROM generate_series(0, 4) i);
      WHEN 'subtract' THEN
        v_a := riddle_rand(2, 9);
        v_x := riddle_rand(1, 15) + 4 * v_a;
        v_all := ARRAY(SELECT v_x - i * v_a FROM generate_series(0, 4) i);
      WHEN 'double' THEN
        v_x := riddle_rand(1, 6);
        v_all := ARRAY(SELECT (v_x * 2 ^ i)::INTEGER FROM generate_series(0, 4) i);
      WHEN 'triple' THEN
        v_x := riddle_rand(1, 2);
        v_all := ARRAY(SELECT (v_x * 3 ^ i)::INTEGER FROM generate_series(0, 4) i);
      WHEN 'halve' THEN
        v_x := riddle_rand(1, 6);
        v_all := ARRAY(SELECT (v_x * 2 ^ (4 - i))::INTEGER FROM generate_series(0, 4) i);
      WHEN 'squares' THEN
        v_x := riddle_rand(1, 6);
        v_all := ARRAY(SELECT ((v_x + i) * (v_x + i))::INTEGER FROM generate_series(0, 4) i);
      WHEN 'growing' THEN
        v_a := riddle_rand(1, 4);
        v_x := riddle_rand(1, 9);
        v_all := ARRAY(SELECT v_x + i * v_a + i * (i - 1) / 2 FROM generate_series(0, 4) i);
      WHEN 'fibonacci' THEN
        v_x := riddle_rand(1, 4);
        v_all := ARRAY[v_x, riddle_rand(v_x, v_x + 3)];
        FOR i IN 3..6 LOOP
          v_all := v_all || (v_all[i - 1] + v_all[i - 2]);
        END LOOP;
      WHEN 'alternate' THEN
        v_a := riddle_rand(3, 9);
        v_b := riddle_rand(1, v_a - 1);
        v_x := riddle_rand(1, 12);
        v_all := ARRAY(SELECT v_x + ((i + 1) / 2) * v_a - (i / 2) * v_b FROM generate_series(0, 5) i);
      ELSE
        v_x := riddle_rand(1, 5);
        v_all := ARRAY(SELECT ((v_x + 1) * 2 ^ i - 1)::INTEGER FROM generate_series(0, 4) i);
    END CASE;

    v_answer := v_all[cardinality(v_all)];
    v_terms := v_all[1:cardinality(v_all) - 1];
    v_pred := riddle_sequence_predictions(v_terms);
    EXIT WHEN v_answer = ANY(v_pred) AND v_answer = ALL(v_pred) AND v_answer > 0;
    IF v_try >= 40 THEN
      v_rule := 'double';
      v_terms := ARRAY[2, 4, 8, 16];
      v_answer := 32;
      v_a := NULL;
      v_b := NULL;
      EXIT;
    END IF;
  END LOOP;

  -- The naive "same step again" guess comes first, so the obvious mistake is always on the table.
  v_last := v_terms[cardinality(v_terms)];
  v_gap := v_last - v_terms[cardinality(v_terms) - 1];
  v_options := ARRAY[v_answer];
  FOREACH v_pick IN ARRAY ARRAY[v_last + v_gap] || riddle_shuffle(ARRAY[
    v_answer + 1, v_answer - 1, v_answer + 2, v_answer - 2,
    v_answer + abs(v_gap), v_answer - abs(v_gap), v_last * 2, v_answer + 10
  ]) LOOP
    IF cardinality(v_options) < 4 AND v_pick > 0 AND v_pick <> ALL(v_options) THEN
      v_options := v_options || v_pick;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'puzzle', jsonb_build_object(
      'terms', to_jsonb(v_terms),
      'options', to_jsonb(ARRAY(SELECT x FROM unnest(v_options) AS x ORDER BY x))
    ),
    'answer', jsonb_build_object('value', v_answer, 'rule', v_rule, 'a', v_a, 'b', v_b)
  );
END;
$$;

-- ============================================================
-- Arrow sequences: directions 0..7, clockwise from up, 45 degrees apart
-- ============================================================

-- turn: the same turn every step. alternate: two turns taking turns. grow: each turn one notch wider.
CREATE OR REPLACE FUNCTION riddle_make_arrows() RETURNS JSONB
LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE
  v_rule TEXT := (ARRAY['turn', 'turn', 'alternate', 'grow'])[riddle_rand(1, 4)];
  v_a INTEGER;
  v_b INTEGER;
  v_steps INTEGER[];
  v_step INTEGER;
  v_dirs INTEGER[] := ARRAY[riddle_rand(0, 7)];
BEGIN
  IF v_rule = 'turn' THEN
    v_a := (ARRAY[1, 1, 2, 2, 3, -1, -1, -2, -2, -3, 4])[riddle_rand(1, 11)];
    v_steps := ARRAY[v_a, v_a, v_a, v_a];
  ELSIF v_rule = 'alternate' THEN
    v_a := (ARRAY[1, 2, 3, -1, -2, -3])[riddle_rand(1, 6)];
    LOOP
      v_b := (ARRAY[1, 2, 3, -1, -2, -3, 4])[riddle_rand(1, 7)];
      EXIT WHEN v_b <> v_a;
    END LOOP;
    v_steps := ARRAY[v_a, v_b, v_a, v_b, v_a];
  ELSE
    v_a := (ARRAY[1, -1])[riddle_rand(1, 2)];
    v_steps := ARRAY[v_a, 2 * v_a, 3 * v_a, 4 * v_a];
  END IF;

  FOREACH v_step IN ARRAY v_steps LOOP
    v_dirs := v_dirs || (((v_dirs[cardinality(v_dirs)] + v_step) % 8 + 8) % 8);
  END LOOP;

  RETURN jsonb_build_object(
    'puzzle', jsonb_build_object('arrows', to_jsonb(v_dirs[1:cardinality(v_dirs) - 1])),
    'answer', jsonb_build_object('value', v_dirs[cardinality(v_dirs)], 'rule', v_rule, 'a', v_a, 'b', v_b)
  );
END;
$$;

-- ============================================================
-- Pipe maze: tap a tile to turn it a quarter clockwise, connect the west entry to the east exit
-- ============================================================

-- Openings as bits (north 1, east 2, south 4, west 8) of a straight (I), corner (L) or tee (T) tile after
-- p_rot clockwise quarter turns.
CREATE OR REPLACE FUNCTION riddle_tile_mask(p_type TEXT, p_rot INTEGER) RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_type
    WHEN 'I' THEN (ARRAY[5, 10, 5, 10])[((p_rot % 4) + 4) % 4 + 1]
    WHEN 'L' THEN (ARRAY[3, 6, 12, 9])[((p_rot % 4) + 4) % 4 + 1]
    WHEN 'T' THEN (ARRAY[7, 14, 13, 11])[((p_rot % 4) + 4) % 4 + 1]
    ELSE 0
  END
$$;

-- True when water poured into the west side of row p_entry, column 0 flows out of the east side of row
-- p_exit, last column, through tiles whose openings face each other.
CREATE OR REPLACE FUNCTION riddle_maze_connected(
  p_size INTEGER, p_tiles TEXT, p_rot INTEGER[], p_entry INTEGER, p_exit INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_count INTEGER := p_size * p_size;
  v_masks INTEGER[];
  v_seen BOOLEAN[];
  v_queue INTEGER[];
  v_head INTEGER := 1;
  v_cell INTEGER;
  v_next INTEGER;
  v_dir INTEGER;
  v_start INTEGER := p_entry * p_size + 1;
  v_goal INTEGER := p_exit * p_size + p_size;
BEGIN
  IF p_size IS NULL OR p_size < 2 OR cardinality(p_rot) IS DISTINCT FROM v_count
    OR char_length(p_tiles) IS DISTINCT FROM v_count
    OR p_entry NOT BETWEEN 0 AND p_size - 1 OR p_exit NOT BETWEEN 0 AND p_size - 1
  THEN
    RETURN false;
  END IF;

  v_masks := ARRAY(SELECT riddle_tile_mask(substr(p_tiles, i, 1), p_rot[i]) FROM generate_series(1, v_count) i);
  IF (v_masks[v_start] & 8) = 0 THEN
    RETURN false;
  END IF;

  v_seen := array_fill(false, ARRAY[v_count]);
  v_seen[v_start] := true;
  v_queue := ARRAY[v_start];
  WHILE v_head <= cardinality(v_queue) LOOP
    v_cell := v_queue[v_head];
    v_head := v_head + 1;
    FOREACH v_dir IN ARRAY ARRAY[1, 2, 4, 8] LOOP
      CONTINUE WHEN (v_masks[v_cell] & v_dir) = 0;
      v_next := CASE v_dir
        WHEN 1 THEN CASE WHEN v_cell > p_size THEN v_cell - p_size END
        WHEN 2 THEN CASE WHEN v_cell % p_size <> 0 THEN v_cell + 1 END
        WHEN 4 THEN CASE WHEN v_cell <= v_count - p_size THEN v_cell + p_size END
        ELSE CASE WHEN v_cell % p_size <> 1 AND p_size > 1 THEN v_cell - 1 END
      END;
      CONTINUE WHEN v_next IS NULL OR v_seen[v_next];
      CONTINUE WHEN (v_masks[v_next] & CASE v_dir WHEN 1 THEN 4 WHEN 2 THEN 8 WHEN 4 THEN 1 ELSE 2 END) = 0;
      v_seen[v_next] := true;
      v_queue := v_queue || v_next;
    END LOOP;
  END LOOP;

  RETURN v_seen[v_goal] AND (v_masks[v_goal] & 2) <> 0;
END;
$$;

-- Lays a path first (column by column: in from the west, slide up to two rows, out to the east; the exit is
-- where it ends), fills the other cells with decoys (few tees, they leak water everywhere), then turns three or
-- four path pipes out of place until the maze is broken. Never the first one, so water already shows where it
-- comes in and following it to the break is the whole puzzle. Always solvable: the laid path is the solution.
CREATE OR REPLACE FUNCTION riddle_make_maze(p_size INTEGER DEFAULT 5) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE
  n INTEGER := greatest(3, least(p_size, 6));
  v_entry INTEGER := riddle_rand(0, n - 1);
  v_exit INTEGER;
  v_masks INTEGER[] := array_fill(0, ARRAY[n * n]);
  v_path INTEGER[] := '{}';
  v_tiles TEXT := '';
  v_type TEXT;
  v_solution INTEGER[] := '{}';
  v_rot INTEGER[];
  v_row INTEGER := v_entry;
  v_target INTEGER;
  v_step INTEGER;
  v_cell INTEGER;
  v_breaks INTEGER;
  v_try INTEGER := 0;
BEGIN
  FOR v_col IN 0..n - 1 LOOP
    v_target := greatest(0, least(n - 1, v_row + riddle_rand(-2, 2)));
    v_step := sign(v_target - v_row);
    v_cell := v_row * n + v_col + 1;
    v_masks[v_cell] := v_masks[v_cell] | 8;
    WHILE v_row <> v_target LOOP
      v_masks[v_cell] := v_masks[v_cell] | CASE WHEN v_step > 0 THEN 4 ELSE 1 END;
      v_path := v_path || v_cell;
      v_row := v_row + v_step;
      v_cell := v_row * n + v_col + 1;
      v_masks[v_cell] := v_masks[v_cell] | CASE WHEN v_step > 0 THEN 1 ELSE 4 END;
    END LOOP;
    v_masks[v_cell] := v_masks[v_cell] | 2;
    v_path := v_path || v_cell;
  END LOOP;
  v_exit := v_row;

  FOR i IN 1..n * n LOOP
    IF v_masks[i] = 0 THEN
      v_type := (ARRAY['L', 'L', 'I', 'I', 'T'])[riddle_rand(1, 5)];
      v_solution := v_solution || riddle_rand(0, 3);
    ELSE
      v_type := CASE WHEN v_masks[i] IN (5, 10) THEN 'I' ELSE 'L' END;
      v_solution := v_solution || (SELECT r FROM generate_series(0, 3) r WHERE riddle_tile_mask(v_type, r) = v_masks[i] LIMIT 1);
    END IF;
    v_tiles := v_tiles || v_type;
  END LOOP;

  v_breaks := least(cardinality(v_path) - 1, riddle_rand(3, 4));
  LOOP
    v_try := v_try + 1;
    v_rot := v_solution;
    -- A straight pipe has two looks, a corner four: any other look than the solution's is out of place.
    FOREACH v_cell IN ARRAY (riddle_shuffle(v_path[2:]))[1:v_breaks] LOOP
      v_rot[v_cell] := (v_solution[v_cell] + riddle_rand(1, CASE WHEN substr(v_tiles, v_cell, 1) = 'I' THEN 1 ELSE 3 END)) % 4;
    END LOOP;
    EXIT WHEN NOT riddle_maze_connected(n, v_tiles, v_rot, v_entry, v_exit) OR v_try >= 60;
  END LOOP;

  RETURN jsonb_build_object(
    'puzzle', jsonb_build_object('size', n, 'tiles', v_tiles, 'rotations', to_jsonb(v_rot), 'entry', v_entry, 'exit', v_exit),
    'answer', jsonb_build_object(
      'rotations', to_jsonb(v_solution),
      'path', to_jsonb(ARRAY(SELECT c - 1 FROM unnest(v_path) AS c))
    )
  );
END;
$$;

-- ============================================================
-- Daily riddles
-- ============================================================

CREATE OR REPLACE FUNCTION riddle_make(p_kind TEXT) RETURNS JSONB
LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT CASE p_kind
    WHEN 'arrows' THEN riddle_make_arrows()
    WHEN 'maze' THEN riddle_make_maze(5)
    ELSE riddle_make_sequence()
  END
$$;

-- The kind rotates every day for each user, and again after every miss.
CREATE OR REPLACE FUNCTION riddle_kind_for(p_uid UUID, p_day DATE, p_number INTEGER) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT (ARRAY['sequence', 'arrows', 'maze'])[
    ((((p_day - DATE '2026-01-01') + abs(hashtext(p_uid::TEXT) % 3) + p_number - 1) % 3) + 3) % 3 + 1
  ]
$$;

-- True or false for a well-formed answer, NULL for a malformed one (never counted as a miss).
CREATE OR REPLACE FUNCTION riddle_check(p_kind TEXT, p_puzzle JSONB, p_answer JSONB, p_given JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_size INTEGER;
  v_rot INTEGER[];
BEGIN
  IF p_kind = 'sequence' THEN
    IF jsonb_typeof(p_given->'value') IS DISTINCT FROM 'number' OR NOT (p_puzzle->'options') @> jsonb_build_array(p_given->'value') THEN
      RETURN NULL;
    END IF;
    RETURN (p_given->>'value')::NUMERIC = (p_answer->>'value')::NUMERIC;
  END IF;

  IF p_kind = 'arrows' THEN
    IF jsonb_typeof(p_given->'value') IS DISTINCT FROM 'number' OR (p_given->'value')::TEXT !~ '^[0-7]$' THEN
      RETURN NULL;
    END IF;
    RETURN (p_given->>'value')::INTEGER = (p_answer->>'value')::INTEGER;
  END IF;

  IF p_kind = 'maze' THEN
    v_size := (p_puzzle->>'size')::INTEGER;
    IF jsonb_typeof(p_given->'rotations') IS DISTINCT FROM 'array'
      OR jsonb_array_length(p_given->'rotations') <> v_size * v_size
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_given->'rotations') AS x WHERE x::TEXT !~ '^[0-3]$')
    THEN
      RETURN NULL;
    END IF;
    v_rot := ARRAY(
      SELECT x::INTEGER FROM jsonb_array_elements_text(p_given->'rotations') WITH ORDINALITY AS e(x, i) ORDER BY i
    );
    RETURN riddle_maze_connected(v_size, p_puzzle->>'tiles', v_rot, (p_puzzle->>'entry')::INTEGER, (p_puzzle->>'exit')::INTEGER);
  END IF;

  RETURN NULL;
END;
$$;

-- The client's view of a riddle row. The solution only appears once the riddle is over (solved or locked).
CREATE OR REPLACE FUNCTION riddle_view(p_row praise_riddles) RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public SET timezone = 'UTC' AS $$
  SELECT jsonb_build_object(
    'day', p_row.riddle_day,
    'status', CASE
      WHEN p_row.solved_at IS NOT NULL THEN 'solved'
      WHEN p_row.attempts >= riddle_daily_limit() THEN 'locked'
      ELSE 'open'
    END,
    'number', least(p_row.attempts + CASE WHEN p_row.solved_at IS NULL THEN 1 ELSE 0 END, riddle_daily_limit()),
    'limit', riddle_daily_limit(),
    'misses', p_row.attempts - CASE WHEN p_row.solved_at IS NULL THEN 0 ELSE 1 END,
    'first_try', p_row.first_try,
    'bonus', CASE
      WHEN p_row.first_try OR (p_row.solved_at IS NULL AND p_row.attempts = 0) THEN riddle_first_try_bonus()
      ELSE 0
    END,
    'kind', p_row.kind,
    'puzzle', p_row.puzzle,
    'solution', CASE
      WHEN p_row.solved_at IS NOT NULL OR p_row.attempts >= riddle_daily_limit() THEN p_row.answer
    END,
    'solved_at', p_row.solved_at,
    'resets_at', (p_row.riddle_day + 1)::TIMESTAMPTZ
  )
$$;

-- Today's riddle for the caller, posed on first call. Only the public half is returned.
CREATE OR REPLACE FUNCTION get_my_riddle() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET timezone = 'UTC' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row praise_riddles%ROWTYPE;
  v_kind TEXT;
  v_new JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_row FROM praise_riddles WHERE user_id = v_uid AND riddle_day = CURRENT_DATE;
  IF NOT FOUND THEN
    v_kind := riddle_kind_for(v_uid, CURRENT_DATE, 1);
    v_new := riddle_make(v_kind);
    INSERT INTO praise_riddles (user_id, riddle_day, kind, puzzle, answer)
    VALUES (v_uid, CURRENT_DATE, v_kind, v_new->'puzzle', v_new->'answer')
    ON CONFLICT (user_id, riddle_day) DO NOTHING;
    SELECT * INTO v_row FROM praise_riddles WHERE user_id = v_uid AND riddle_day = CURRENT_DATE;
  END IF;

  RETURN riddle_view(v_row) || jsonb_build_object('ok', true);
END;
$$;

-- Answers today's riddle. p_answer: {"number": n, "value": x} for sequences and arrows, {"number": n,
-- "rotations": [...]} for mazes, or {"number": n, "skip": true} to ask for another riddle (counts as a miss).
-- number is the riddle being answered: a double tap that reaches an already replaced riddle is ignored.
-- A miss retires the riddle, reveals its solution and poses a new one until the daily limit.
CREATE OR REPLACE FUNCTION solve_my_riddle(p_answer JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET timezone = 'UTC' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row praise_riddles%ROWTYPE;
  v_skip BOOLEAN;
  v_correct BOOLEAN := false;
  v_previous JSONB;
  v_kind TEXT;
  v_next JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF jsonb_typeof(p_answer) IS DISTINCT FROM 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_answer');
  END IF;
  v_skip := p_answer->'skip' = 'true'::JSONB;

  SELECT * INTO v_row FROM praise_riddles WHERE user_id = v_uid AND riddle_day = CURRENT_DATE FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_riddle');
  END IF;
  IF v_row.solved_at IS NOT NULL THEN
    RETURN riddle_view(v_row) || jsonb_build_object('ok', true, 'result', 'already_solved');
  END IF;
  IF v_row.attempts >= riddle_daily_limit() THEN
    RETURN riddle_view(v_row) || jsonb_build_object('ok', false, 'error', 'riddle_limit');
  END IF;
  IF p_answer ? 'number' AND p_answer->'number' IS DISTINCT FROM to_jsonb(v_row.attempts + 1) THEN
    RETURN riddle_view(v_row) || jsonb_build_object('ok', true, 'result', 'stale');
  END IF;

  IF NOT coalesce(v_skip, false) THEN
    v_correct := riddle_check(v_row.kind, v_row.puzzle, v_row.answer, p_answer);
    IF v_correct IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_answer');
    END IF;
  END IF;

  IF v_correct THEN
    UPDATE praise_riddles
    SET attempts = attempts + 1,
        solved_at = now(),
        first_try = (attempts = 0),
        puzzle = CASE
          WHEN kind = 'maze' THEN jsonb_set(puzzle, '{rotations}', to_jsonb(ARRAY(
            SELECT x::INTEGER FROM jsonb_array_elements_text(p_answer->'rotations') WITH ORDINALITY AS e(x, i) ORDER BY i
          )))
          ELSE puzzle
        END,
        updated_at = now()
    WHERE user_id = v_uid AND riddle_day = CURRENT_DATE
    RETURNING * INTO v_row;
    RETURN riddle_view(v_row) || jsonb_build_object('ok', true, 'result', 'correct');
  END IF;

  v_previous := jsonb_build_object('kind', v_row.kind, 'puzzle', v_row.puzzle, 'solution', v_row.answer);
  IF v_row.attempts + 1 >= riddle_daily_limit() THEN
    UPDATE praise_riddles SET attempts = attempts + 1, updated_at = now()
    WHERE user_id = v_uid AND riddle_day = CURRENT_DATE
    RETURNING * INTO v_row;
  ELSE
    v_kind := riddle_kind_for(v_uid, CURRENT_DATE, v_row.attempts + 2);
    v_next := riddle_make(v_kind);
    UPDATE praise_riddles
    SET attempts = attempts + 1, kind = v_kind, puzzle = v_next->'puzzle', answer = v_next->'answer', updated_at = now()
    WHERE user_id = v_uid AND riddle_day = CURRENT_DATE
    RETURNING * INTO v_row;
  END IF;

  RETURN riddle_view(v_row) || jsonb_build_object(
    'ok', true,
    'result', CASE WHEN v_skip THEN 'skipped' ELSE 'wrong' END,
    'previous', v_previous
  );
END;
$$;

-- Read by submit_praise: NULL while the user's riddle for today is unsolved, otherwise the Sharp Mind bonus
-- owed with the praise (riddle_first_try_bonus() for a first-try solve, else 0).
CREATE OR REPLACE FUNCTION praise_riddle_bonus(p_uid UUID) RETURNS INTEGER
LANGUAGE sql STABLE SET search_path = public SET timezone = 'UTC' AS $$
  SELECT CASE WHEN first_try THEN riddle_first_try_bonus() ELSE 0 END
  FROM praise_riddles
  WHERE user_id = p_uid AND riddle_day = CURRENT_DATE AND solved_at IS NOT NULL
$$;

REVOKE EXECUTE ON FUNCTION riddle_first_try_bonus() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION riddle_daily_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION riddle_rand(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION riddle_shuffle(INTEGER[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION riddle_sequence_predictions(INTEGER[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION riddle_make_sequence() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION riddle_make_arrows() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION riddle_tile_mask(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION riddle_maze_connected(INTEGER, TEXT, INTEGER[], INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION riddle_make_maze(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION riddle_make(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION riddle_kind_for(UUID, DATE, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION riddle_check(TEXT, JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION riddle_view(praise_riddles) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION praise_riddle_bonus(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_my_riddle() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION solve_my_riddle(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_my_riddle() TO authenticated;
GRANT EXECUTE ON FUNCTION solve_my_riddle(JSONB) TO authenticated;

-- The gate and the bonus live in submit_praise (phase10_praise.sql). An older copy of that function would let
-- praises skip the riddle and never pay the bonus, so refuse to finish until it is the current one.
DO $$
BEGIN
  IF position('praise_riddle_bonus' IN pg_get_functiondef('public.submit_praise(text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'submit_praise has no King''s Riddle gate: run the current supabase/phase10_praise.sql, then this file again';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
