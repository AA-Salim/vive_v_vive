-- Phase 10: remove games recorded twice by the old double-click declare.
-- A duplicate is a game with the same ten players on the same sides and the same winner, recorded less than
-- 60 seconds after its twin (the real twins were 1-7 seconds apart; a rematch takes 20+ minutes).
-- The copy a session points to is kept, otherwise the earliest. Then every player's wins, losses and games
-- played are recomputed from the remaining history. Points already paid are not touched. Idempotent.

DO $$
DECLARE
  v_removed integer;
BEGIN
  CREATE TEMP TABLE vvv_duplicate_games ON COMMIT DROP AS
  WITH g AS (
    SELECT ga.id, ga.played_at, ga.winner_side,
      (SELECT string_agg(gp.player_id::text || ':' || gp.side, ',' ORDER BY gp.player_id::text)
       FROM game_players gp WHERE gp.game_id = ga.id) AS roster,
      EXISTS (SELECT 1 FROM game_sessions s WHERE s.game_id = ga.id) AS linked
    FROM games ga
  ),
  gaps AS (
    SELECT g.*,
      played_at - lag(played_at) OVER (PARTITION BY roster, winner_side ORDER BY played_at, id) AS gap
    FROM g
    WHERE roster IS NOT NULL
  ),
  clusters AS (
    SELECT gaps.*,
      sum(CASE WHEN gap IS NULL OR gap >= interval '60 seconds' THEN 1 ELSE 0 END)
        OVER (PARTITION BY roster, winner_side ORDER BY played_at, id ROWS UNBOUNDED PRECEDING) AS cluster
    FROM gaps
  ),
  ranked AS (
    SELECT clusters.*,
      row_number() OVER w AS rn,
      first_value(id) OVER w AS keeper
    FROM clusters
    WINDOW w AS (PARTITION BY roster, winner_side, cluster ORDER BY linked DESC, played_at, id
                 ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
  )
  SELECT id AS duplicate_id, keeper AS keep_id FROM ranked WHERE rn > 1;

  SELECT count(*) INTO v_removed FROM vvv_duplicate_games;

  UPDATE game_sessions s SET game_id = d.keep_id
  FROM vvv_duplicate_games d WHERE s.game_id = d.duplicate_id;

  IF to_regclass('public.post_game_votes') IS NOT NULL THEN
    EXECUTE 'UPDATE post_game_votes v SET game_id = d.keep_id FROM vvv_duplicate_games d WHERE v.game_id = d.duplicate_id';
  END IF;
  IF to_regclass('public.duels') IS NOT NULL THEN
    EXECUTE 'UPDATE duels x SET game_id = d.keep_id FROM vvv_duplicate_games d WHERE x.game_id = d.duplicate_id';
  END IF;

  DELETE FROM games WHERE id IN (SELECT duplicate_id FROM vvv_duplicate_games);

  UPDATE players p SET
    wins = coalesce(h.wins, 0),
    losses = coalesce(h.losses, 0),
    games_played = coalesce(h.wins, 0) + coalesce(h.losses, 0)
  FROM players p2
  LEFT JOIN (
    SELECT gp.player_id,
      count(*) FILTER (WHERE gp.side = g.winner_side) AS wins,
      count(*) FILTER (WHERE gp.side <> g.winner_side) AS losses
    FROM game_players gp JOIN games g ON g.id = gp.game_id
    GROUP BY gp.player_id
  ) h ON h.player_id = p2.id
  WHERE p.id = p2.id
    AND (p.wins, p.losses, p.games_played) IS DISTINCT FROM
        (coalesce(h.wins, 0), coalesce(h.losses, 0), coalesce(h.wins, 0) + coalesce(h.losses, 0));

  RAISE NOTICE 'Removed % duplicate games and recomputed player records.', v_removed;
END $$;
