-- Phase 10: the Hall of Kisses. One read-only call ranks every subject by what their daily praises earned, read
-- from the ledger rows tied to each praise (reference_id = praise id): the praise reward as paid (title boosts
-- included), the Sharp Mind riddle bonus and the Royal Favor of a crown. Legacy Act I kisses (kiss_the_hand, or
-- sing_his_praises without a praise) are counted apart. p_from / p_to bound praises by created_at, [from, to).
-- Additive and idempotent: one partial index and one SECURITY DEFINER read function. Works with and without
-- phase11_lockdown.sql. Run after supabase/phase10_riddles.sql. Without this file the app computes the same board
-- from the public praises table and ledger.

DO $$
BEGIN
  IF to_regclass('public.praises') IS NULL THEN
    RAISE EXCEPTION 'Run supabase/phase10_praise.sql before supabase/phase10_praise-board.sql';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_point_transactions_praise_ref
  ON point_transactions (reference_id)
  WHERE reason IN ('sing_his_praises', 'riddle_bonus', 'royal_favor');

CREATE OR REPLACE FUNCTION praise_leaderboard(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 5
) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET timezone = 'UTC' AS $$
  WITH sung AS (
    SELECT p.id, p.user_id, p.body, p.verdict, p.verdict_note, p.praise_day, p.created_at,
      coalesce(sum(t.amount) FILTER (WHERE t.reason = 'sing_his_praises'), 0) AS reward,
      coalesce(sum(t.amount) FILTER (WHERE t.reason = 'riddle_bonus'), 0) AS riddle,
      coalesce(sum(t.amount) FILTER (WHERE t.reason = 'royal_favor'), 0) AS favor,
      row_number() OVER (PARTITION BY p.user_id ORDER BY p.created_at DESC, p.id) AS n
    FROM praises p
    LEFT JOIN point_transactions t
      ON t.reference_id = p.id
     AND t.user_id = p.user_id
     AND t.reason IN ('sing_his_praises', 'riddle_bonus', 'royal_favor')
    WHERE (p_from IS NULL OR p.created_at >= p_from)
      AND (p_to IS NULL OR p.created_at < p_to)
    GROUP BY p.id
  ),
  board AS (
    SELECT user_id,
      count(*) AS kisses,
      sum(reward) AS reward,
      sum(riddle) AS riddle,
      sum(favor) AS favor,
      count(*) FILTER (WHERE verdict = 'crowned') AS crowns,
      count(*) FILTER (WHERE verdict = 'scorned') AS scorns,
      bool_or(praise_day = CURRENT_DATE) AS today,
      max(created_at) AS last_at,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'body', body,
          'created_at', created_at,
          'praise_day', praise_day,
          'verdict', verdict,
          'verdict_note', verdict_note,
          'reward', reward,
          'riddle', riddle,
          'favor', favor
        ) ORDER BY created_at DESC, id
      ) FILTER (WHERE n <= least(greatest(coalesce(p_limit, 5), 1), 20)) AS recent
    FROM sung
    GROUP BY user_id
  ),
  legacy AS (
    SELECT user_id, count(*) AS legacy
    FROM point_transactions
    WHERE (reason = 'kiss_the_hand' OR (reason = 'sing_his_praises' AND reference_id IS NULL))
      AND (p_from IS NULL OR created_at >= p_from)
      AND (p_to IS NULL OR created_at < p_to)
    GROUP BY user_id
  )
  SELECT jsonb_build_object(
    'today', CURRENT_DATE,
    'players', coalesce(jsonb_agg(jsonb_build_object(
      'user_id', coalesce(b.user_id, l.user_id),
      'kisses', coalesce(b.kisses, 0),
      'reward', coalesce(b.reward, 0),
      'riddle', coalesce(b.riddle, 0),
      'favor', coalesce(b.favor, 0),
      'crowns', coalesce(b.crowns, 0),
      'scorns', coalesce(b.scorns, 0),
      'legacy', coalesce(l.legacy, 0),
      'today', coalesce(b.today, false),
      'last_at', b.last_at,
      'recent', coalesce(b.recent, '[]'::jsonb)
    )), '[]'::jsonb)
  )
  FROM board b
  FULL JOIN legacy l ON l.user_id = b.user_id
$$;

REVOKE EXECUTE ON FUNCTION praise_leaderboard(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION praise_leaderboard(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
