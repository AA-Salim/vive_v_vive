-- Vive v Vive: phase 10 (modernization) — every migration in one file, in dependency order.
-- Paste into the Supabase SQL editor and run once. Safe to re-run: every section is idempotent.

-- ============================================================
-- phase10_foundation.sql
-- ============================================================

-- Phase 10: Foundation for live sync and the feature overhaul
-- Additive and idempotent: safe to run while the previous app version is deployed.

-- Reasons are validated by the app; the database only enforces a sane format so features can add reasons
-- without rewriting a shared CHECK list.
ALTER TABLE point_transactions DROP CONSTRAINT IF EXISTS point_transactions_reason_check;
ALTER TABLE point_transactions DROP CONSTRAINT IF EXISTS point_transactions_reason_format;
ALTER TABLE point_transactions ADD CONSTRAINT point_transactions_reason_format
  CHECK (reason ~ '^[a-z][a-z0-9_]{1,48}$');

-- Adds a table to the realtime publication unless it is already there.
CREATE OR REPLACE FUNCTION vvv_add_to_realtime(p_table TEXT) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = p_table
  ) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', p_table);
  END IF;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION vvv_add_to_realtime(TEXT) FROM PUBLIC, anon, authenticated;

-- These tables were subscribed to by the client but never published, which made Supabase reject
-- the whole realtime channel and forced everyone to refresh.
SELECT vvv_add_to_realtime('coach_draft_picks');
SELECT vvv_add_to_realtime('player_queue');
SELECT vvv_add_to_realtime('vainqueur_state');
SELECT vvv_add_to_realtime('point_balances');
SELECT vvv_add_to_realtime('daily_fearless');
SELECT vvv_add_to_realtime('bounties');
SELECT vvv_add_to_realtime('shame_entries');
SELECT vvv_add_to_realtime('user_titles');
SELECT vvv_add_to_realtime('acts');

-- ============================================================
-- phase10_live-sync.sql
-- ============================================================

-- Phase 10: live sync activity history
-- Additive and idempotent: safe to run (and re-run) while the previous app version is deployed.
-- Persists the live events broadcast by the server so late joiners and refreshed tabs see what happened.

CREATE TABLE IF NOT EXISTS activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  session_id UUID NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  actor JSONB NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_events_type_format') THEN
    ALTER TABLE activity_events ADD CONSTRAINT activity_events_type_format
      CHECK (type ~ '^[a-z][a-z_]{0,23}\.[a-z][a-z_]{0,31}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_events_data_object') THEN
    ALTER TABLE activity_events ADD CONSTRAINT activity_events_data_object
      CHECK (jsonb_typeof(data) = 'object');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_activity_events_created ON activity_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_session ON activity_events (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_recorder ON activity_events (recorded_by, created_at DESC);

ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_events_read" ON activity_events;
CREATE POLICY "activity_events_read" ON activity_events FOR SELECT USING (true);

-- Writes only go through record_activity_event().
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON activity_events FROM anon, authenticated;

-- Records one live event for the calling user. The id is the broadcast event id so clients can
-- merge history with live events without duplicates. Logged-in friends can call this directly and
-- forge entries; the checks keep that bounded (format, payload size, per-user rate).
CREATE OR REPLACE FUNCTION record_activity_event(
  p_id UUID,
  p_type TEXT,
  p_session_id UUID DEFAULT NULL,
  p_actor JSONB DEFAULT NULL,
  p_data JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID := COALESCE(p_id, gen_random_uuid());
  v_session UUID := p_session_id;
  v_recent INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_type IS NULL OR p_type !~ '^[a-z][a-z_]{0,23}\.[a-z][a-z_]{0,31}$' THEN
    RAISE EXCEPTION 'Invalid event type' USING ERRCODE = '22023';
  END IF;
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' OR octet_length(p_data::text) > 8192 THEN
    RAISE EXCEPTION 'Invalid event payload' USING ERRCODE = '22023';
  END IF;
  IF p_actor IS NOT NULL AND (jsonb_typeof(p_actor) <> 'object' OR octet_length(p_actor::text) > 1024) THEN
    RAISE EXCEPTION 'Invalid event actor' USING ERRCODE = '22023';
  END IF;

  IF v_session IS NOT NULL AND NOT EXISTS (SELECT 1 FROM game_sessions WHERE id = v_session) THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_recent
  FROM activity_events
  WHERE recorded_by = v_uid AND created_at > now() - interval '1 minute';
  IF v_recent >= 90 THEN
    RETURN NULL;
  END IF;

  INSERT INTO activity_events (id, type, session_id, actor, data, recorded_by)
  VALUES (v_id, p_type, v_session, p_actor, p_data, v_uid)
  ON CONFLICT (id) DO NOTHING;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION record_activity_event(UUID, TEXT, UUID, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_activity_event(UUID, TEXT, UUID, JSONB, JSONB) TO authenticated;

-- Clients also watch inserts as a fallback when a broadcast is missed.
DO $$
BEGIN
  IF to_regprocedure('vvv_add_to_realtime(text)') IS NOT NULL THEN
    PERFORM vvv_add_to_realtime('activity_events');
  ELSIF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'activity_events'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_events;
  END IF;
END $$;

-- ============================================================
-- phase10_push.sql
-- ============================================================

-- Phase 10: web push subscriptions
-- Additive and idempotent: safe to run (and re-run) before or after phase11_lockdown.sql, while any app
-- version is deployed. Until it runs, the app simply skips push (in-app toasts and tab notifications still work).
--
-- Every write goes through a SECURITY DEFINER function, so the lockdown's revoked privileges never matter here:
--   push_subscribe / push_unsubscribe   a signed-in device registers or drops its own endpoint
--   push_audience                       the server reads who to notify for one live event
--   push_gate                           the server coalesces bursts: at most one push per scope per window
--   push_report                         the server prunes dead endpoints (404/410) and counts failures
-- The server calls the last three with the signed-in caller's session (or the service role key when set), so
-- they are granted to authenticated and service_role, never to anon. A signed-in friend calling push_audience
-- directly learns the endpoints and keys, which only the VAPID private key can use to send anything.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL,
  quiet BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  failure_count INTEGER NOT NULL DEFAULT 0
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_endpoint_format') THEN
    ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_format
      CHECK (endpoint ~ '^https://' AND char_length(endpoint) <= 2048);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_keys_shape') THEN
    ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_keys_shape
      CHECK (jsonb_typeof(keys->'p256dh') = 'string' AND jsonb_typeof(keys->'auth') = 'string');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id, last_seen DESC);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_own_read" ON push_subscriptions;
CREATE POLICY "push_subscriptions_own_read" ON push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_own_delete" ON push_subscriptions;
CREATE POLICY "push_subscriptions_own_delete" ON push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON push_subscriptions FROM anon;
REVOKE INSERT, UPDATE, TRUNCATE ON push_subscriptions FROM authenticated;
GRANT SELECT, DELETE ON push_subscriptions TO authenticated;

-- Coalescing state, one row per scope ("s:<session>" for announcements, "u:<user>:<session>" for personal alerts).
CREATE TABLE IF NOT EXISTS push_gates (
  key TEXT PRIMARY KEY CHECK (char_length(key) <= 160),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT '-infinity',
  pending UUID NULL,
  pending_at TIMESTAMPTZ NULL
);

ALTER TABLE push_gates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON push_gates FROM anon, authenticated;

-- Registers (or refreshes) the caller's device. An endpoint belongs to one browser profile: if another account
-- signed in on it before, the endpoint moves to the caller. Keeps the 8 most recent devices per user.
CREATE OR REPLACE FUNCTION push_subscribe(
  p_endpoint TEXT,
  p_p256dh TEXT,
  p_auth TEXT,
  p_quiet BOOLEAN DEFAULT false
) RETURNS UUID AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  -- Only the browsers' push services: the server POSTs to every stored endpoint, so an arbitrary URL would let
  -- anyone signed in aim those requests anywhere. FCM (Chrome, Edge on Android, Opera, Samsung), Mozilla,
  -- Apple (Safari, iPhone apps on the Home Screen) and Windows (Edge on Windows).
  IF p_endpoint IS NULL OR char_length(p_endpoint) > 2048
     OR p_endpoint !~ '^https://([a-z0-9-]+\.)*(googleapis\.com|google\.com|mozilla\.com|push\.apple\.com|notify\.windows\.com)(:443)?/' THEN
    RAISE EXCEPTION 'push:invalid_endpoint' USING ERRCODE = '22023';
  END IF;
  IF p_p256dh IS NULL OR p_p256dh !~ '^[A-Za-z0-9_-]{80,100}={0,2}$'
     OR p_auth IS NULL OR p_auth !~ '^[A-Za-z0-9_-]{16,32}={0,2}$' THEN
    RAISE EXCEPTION 'push:invalid_keys' USING ERRCODE = '22023';
  END IF;

  INSERT INTO push_subscriptions (user_id, endpoint, keys, quiet)
  VALUES (v_uid, p_endpoint, jsonb_build_object('p256dh', p_p256dh, 'auth', p_auth), COALESCE(p_quiet, false))
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        keys = EXCLUDED.keys,
        quiet = EXCLUDED.quiet,
        last_seen = now(),
        failure_count = 0
  RETURNING id INTO v_id;

  DELETE FROM push_subscriptions
  WHERE user_id = v_uid AND id IN (
    SELECT id FROM push_subscriptions WHERE user_id = v_uid ORDER BY last_seen DESC OFFSET 8
  );

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION push_unsubscribe(p_endpoint TEXT) RETURNS BOOLEAN AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_count INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  DELETE FROM push_subscriptions WHERE user_id = v_uid AND endpoint = p_endpoint;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Who receives one live event. p_user_ids NULL = every subscribed user (announcements skip devices in quiet
-- mode); a list = those users only (personal alerts reach quiet devices too). The actor is never included.
CREATE OR REPLACE FUNCTION push_audience(
  p_user_ids UUID[] DEFAULT NULL,
  p_exclude UUID DEFAULT NULL
) RETURNS TABLE (user_id UUID, endpoint TEXT, p256dh TEXT, auth TEXT) AS $$
  SELECT s.user_id, s.endpoint, s.keys->>'p256dh', s.keys->>'auth'
  FROM push_subscriptions s
  WHERE s.failure_count < 5
    AND (p_exclude IS NULL OR s.user_id <> p_exclude)
    AND (
      (p_user_ids IS NULL AND NOT s.quiet)
      OR (p_user_ids IS NOT NULL AND s.user_id = ANY (p_user_ids))
    )
  ORDER BY s.last_seen DESC
  LIMIT 500;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Leading and trailing throttle per scope. First call (p_retry false): returns 0 when the scope is free (the
-- caller sends now), otherwise parks the event as the scope's latest and returns how many ms to wait. The
-- retry call after that wait returns 0 if the event is still the latest (send it), -1 if a newer one took over.
-- So an isolated event goes out at once, a burst sends its first and its last event, and never two pushes
-- in one window.
CREATE OR REPLACE FUNCTION push_gate(
  p_key TEXT,
  p_event UUID,
  p_window_ms INTEGER DEFAULT 4000,
  p_retry BOOLEAN DEFAULT false
) RETURNS INTEGER AS $$
DECLARE
  v_window INTERVAL := make_interval(secs => LEAST(GREATEST(COALESCE(p_window_ms, 4000), 500), 60000) / 1000.0);
  v_row push_gates%ROWTYPE;
  v_wait NUMERIC;
BEGIN
  IF p_key IS NULL OR char_length(p_key) > 160 OR p_event IS NULL THEN
    RAISE EXCEPTION 'push:invalid_gate' USING ERRCODE = '22023';
  END IF;

  INSERT INTO push_gates (key) VALUES (p_key) ON CONFLICT (key) DO NOTHING;
  SELECT * INTO v_row FROM push_gates WHERE key = p_key FOR UPDATE;

  IF p_retry THEN
    IF v_row.pending IS DISTINCT FROM p_event THEN
      RETURN -1;
    END IF;
    UPDATE push_gates SET sent_at = now(), pending = NULL, pending_at = NULL WHERE key = p_key;
    RETURN 0;
  END IF;

  IF v_row.sent_at <= now() - v_window THEN
    UPDATE push_gates SET sent_at = now(), pending = NULL, pending_at = NULL WHERE key = p_key;
    IF random() < 0.05 THEN
      DELETE FROM push_gates WHERE sent_at < now() - interval '2 days' AND pending IS NULL;
    END IF;
    RETURN 0;
  END IF;

  UPDATE push_gates SET pending = p_event, pending_at = now() WHERE key = p_key;
  v_wait := EXTRACT(EPOCH FROM (v_row.sent_at + v_window - now())) * 1000;
  RETURN GREATEST(CEIL(v_wait)::INTEGER, 50);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Delivery results: gone endpoints (404/410) are deleted, other failures counted (5 strikes and the device
-- is skipped until it registers again).
CREATE OR REPLACE FUNCTION push_report(p_gone TEXT[] DEFAULT '{}', p_failed TEXT[] DEFAULT '{}') RETURNS VOID AS $$
BEGIN
  IF cardinality(COALESCE(p_gone, '{}')) > 0 THEN
    DELETE FROM push_subscriptions WHERE endpoint = ANY (p_gone);
  END IF;
  IF cardinality(COALESCE(p_failed, '{}')) > 0 THEN
    UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE endpoint = ANY (p_failed);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION push_subscribe(TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION push_unsubscribe(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION push_audience(UUID[], UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION push_gate(TEXT, UUID, INTEGER, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION push_report(TEXT[], TEXT[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION push_subscribe(TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION push_unsubscribe(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION push_audience(UUID[], UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION push_gate(TEXT, UUID, INTEGER, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION push_report(TEXT[], TEXT[]) TO authenticated, service_role;

-- ============================================================
-- phase10_titles.sql
-- ============================================================

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

-- ============================================================
-- phase10_prophecy-vote.sql
-- ============================================================

-- Phase 10: MVP / Inter prophecies settled by a post-game vote ("The Tribunal").
-- Replaces the Lane Call prophecies: lanes were visible during betting, so every call hit and doubled a bet.
-- Run AFTER phase10_foundation.sql. Additive and idempotent: safe to run while the previous app version is live.
--
-- Economy
--   * One prophecy per user per game, MVP or Inter, stake 10..50, sealed during chaos or betting.
--   * Each market is pari-mutuel: prophets who called a voted player split the whole market pot by stake.
--     No verdict, or nobody called it: every stake in that market is returned. Zero-sum, so a coordinated
--     vote cannot print points: if everyone backs the same player they just get their stake back.
--   * Verdict: the leader needs at least 2 votes; a 2-way tie crowns both (dead heat), a wider tie is "split".
--   * Every crowned MVP with an account receives +15 (mvp_bonus). A vote on a game canceled later is void:
--     stakes return and nobody is crowned or paid.
--   * The vote opens when the winner is declared and closes 5 minutes after the game row was written.
--     The first read after closes_at settles it; nothing needs an admin.

DO $$
BEGIN
  IF to_regprocedure('public.vvv_add_to_realtime(text)') IS NULL THEN
    RAISE EXCEPTION 'Apply supabase/phase10_foundation.sql before phase10_prophecy-vote.sql';
  END IF;
END $$;

-- Repeated from the foundation so this file never depends on the order of the old reason CHECK list.
ALTER TABLE point_transactions DROP CONSTRAINT IF EXISTS point_transactions_reason_check;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'point_transactions_reason_format') THEN
    ALTER TABLE point_transactions ADD CONSTRAINT point_transactions_reason_format
      CHECK (reason ~ '^[a-z][a-z0-9_]{1,48}$');
  END IF;
END $$;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS prophecy_wagers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market TEXT NOT NULL CHECK (market IN ('mvp', 'inter')),
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  stake INTEGER NOT NULL CHECK (stake BETWEEN 10 AND 50),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'refunded')),
  payout INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  UNIQUE (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_prophecy_wagers_session ON prophecy_wagers(session_id);
CREATE INDEX IF NOT EXISTS idx_prophecy_wagers_user ON prophecy_wagers(user_id);
CREATE INDEX IF NOT EXISTS idx_prophecy_wagers_pending ON prophecy_wagers(session_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS post_game_votes (
  session_id UUID PRIMARY KEY REFERENCES game_sessions(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  winner_side TEXT CHECK (winner_side IN ('blue', 'red')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closes_at TIMESTAMPTZ NOT NULL,
  settled_at TIMESTAMPTZ,
  mvp_player_ids UUID[] NOT NULL DEFAULT '{}',
  inter_player_ids UUID[] NOT NULL DEFAULT '{}',
  summary JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_post_game_votes_open ON post_game_votes(closes_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_post_game_votes_opened ON post_game_votes(opened_at DESC);

CREATE TABLE IF NOT EXISTS post_game_ballots (
  session_id UUID NOT NULL REFERENCES post_game_votes(session_id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('mvp', 'inter')),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  cast_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, voter_id, category)
);

CREATE INDEX IF NOT EXISTS idx_post_game_ballots_session ON post_game_ballots(session_id, category);

-- Public reads (ballots are public on purpose: the court votes in the open). Writes only via the functions below.
ALTER TABLE prophecy_wagers ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_game_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_game_ballots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prophecy_wagers_read" ON prophecy_wagers;
CREATE POLICY "prophecy_wagers_read" ON prophecy_wagers FOR SELECT USING (true);
DROP POLICY IF EXISTS "post_game_votes_read" ON post_game_votes;
CREATE POLICY "post_game_votes_read" ON post_game_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "post_game_ballots_read" ON post_game_ballots;
CREATE POLICY "post_game_ballots_read" ON post_game_ballots FOR SELECT USING (true);

-- ============================================================
-- HELPERS
-- ============================================================

CREATE OR REPLACE FUNCTION vvv_user_is_player(p_user_id UUID, p_player_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user_id IS NOT NULL AND p_player_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM players WHERE id = p_player_id AND auth_user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = p_user_id AND player_id = p_player_id)
  );
$$;

-- Mirrors the session PATCH route: creator, admin, or anyone when the session has no creator.
CREATE OR REPLACE FUNCTION vvv_can_manage_session(p_user_id UUID, p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM game_sessions s
    WHERE s.id = p_session_id
      AND (
        s.created_by IS NULL
        OR s.created_by = p_user_id
        OR EXISTS (SELECT 1 FROM players p WHERE p.auth_user_id = p_user_id AND p.is_admin)
      )
  );
$$;

-- ============================================================
-- SEAL A PROPHECY (atomic: insert guarded by UNIQUE + stake debit in one transaction)
-- ============================================================

CREATE OR REPLACE FUNCTION seal_prophecy(p_session_id UUID, p_market TEXT, p_player_id UUID, p_stake INTEGER)
RETURNS prophecy_wagers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_wager prophecy_wagers%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'prophecy_auth_required'; END IF;
  IF p_market IS NULL OR p_market NOT IN ('mvp', 'inter') THEN RAISE EXCEPTION 'prophecy_invalid_market'; END IF;
  IF p_stake IS NULL OR p_stake < 10 OR p_stake > 50 THEN RAISE EXCEPTION 'prophecy_invalid_stake'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'prophecy_session_not_found'; END IF;
  IF v_session.status NOT IN ('chaos', 'betting')
     OR (v_session.status = 'betting' AND v_session.betting_ends_at IS NOT NULL AND v_session.betting_ends_at <= now()) THEN
    RAISE EXCEPTION 'prophecy_closed';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM session_assignments WHERE session_id = p_session_id AND player_id = p_player_id) THEN
    RAISE EXCEPTION 'prophecy_player_not_in_game';
  END IF;

  -- Backing yourself as the Inter would pay you to throw the game.
  IF p_market = 'inter' AND vvv_user_is_player(v_uid, p_player_id) THEN
    RAISE EXCEPTION 'prophecy_self_inter';
  END IF;

  BEGIN
    INSERT INTO prophecy_wagers (session_id, user_id, market, player_id, stake)
    VALUES (p_session_id, v_uid, p_market, p_player_id, p_stake)
    RETURNING * INTO v_wager;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'prophecy_already_sealed';
  END;

  PERFORM adjust_balance(v_uid, -p_stake, 'prophecy_stake', v_wager.id);
  RETURN v_wager;
END;
$$;

-- ============================================================
-- OPEN THE TRIBUNAL
-- Called by the declare_winner hook (session still in_game, caller is its creator/admin) or lazily by any
-- reader once the session is resolved. The window is anchored to the game row, so lazy opens never extend it.
-- ============================================================

CREATE OR REPLACE FUNCTION open_post_game_vote(p_session_id UUID, p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_game games%ROWTYPE;
  v_vote post_game_votes%ROWTYPE;
  v_created BOOLEAN := false;
BEGIN
  SELECT * INTO v_vote FROM post_game_votes WHERE session_id = p_session_id;
  IF FOUND THEN
    RETURN jsonb_build_object('created', false, 'vote', to_jsonb(v_vote));
  END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'vote_session_not_found'; END IF;

  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'vote_game_not_found'; END IF;

  IF v_session.status IN ('blue_win', 'red_win') THEN
    IF v_session.game_id IS DISTINCT FROM p_game_id THEN RAISE EXCEPTION 'vote_game_mismatch'; END IF;
  ELSIF v_session.status = 'in_game' THEN
    IF NOT vvv_can_manage_session(v_uid, p_session_id) THEN RAISE EXCEPTION 'vote_forbidden'; END IF;
    -- A rematch has the same ten players, so the roster alone cannot tell this game from the previous one.
    IF (v_session.game_id IS NOT NULL AND v_session.game_id <> p_game_id) OR v_game.played_at < v_session.created_at THEN
      RAISE EXCEPTION 'vote_game_mismatch';
    END IF;
    IF EXISTS (
      SELECT 1 FROM session_assignments sa
      WHERE sa.session_id = p_session_id
        AND NOT EXISTS (SELECT 1 FROM game_players gp WHERE gp.game_id = p_game_id AND gp.player_id = sa.player_id)
    ) THEN
      RAISE EXCEPTION 'vote_game_mismatch';
    END IF;
  ELSE
    RAISE EXCEPTION 'vote_not_available';
  END IF;

  IF v_game.played_at + interval '5 minutes' <= now() THEN
    RAISE EXCEPTION 'vote_window_passed';
  END IF;

  INSERT INTO post_game_votes (session_id, game_id, winner_side, opened_at, closes_at)
  VALUES (p_session_id, p_game_id, v_game.winner_side, now(), v_game.played_at + interval '5 minutes')
  ON CONFLICT (session_id) DO NOTHING
  RETURNING true INTO v_created;

  SELECT * INTO v_vote FROM post_game_votes WHERE session_id = p_session_id;
  RETURN jsonb_build_object('created', COALESCE(v_created, false), 'vote', to_jsonb(v_vote));
END;
$$;

-- ============================================================
-- CAST / CHANGE A BALLOT (one per voter and category, changeable until the gavel falls)
-- ============================================================

CREATE OR REPLACE FUNCTION cast_post_game_vote(p_session_id UUID, p_category TEXT, p_player_id UUID)
RETURNS post_game_ballots
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_vote post_game_votes%ROWTYPE;
  v_ballot post_game_ballots%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'vote_auth_required'; END IF;
  IF p_category IS NULL OR p_category NOT IN ('mvp', 'inter') THEN RAISE EXCEPTION 'vote_invalid_category'; END IF;

  -- Row lock serializes ballots with settlement: no ballot can land after the count started.
  SELECT * INTO v_vote FROM post_game_votes WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'vote_not_open'; END IF;
  IF v_vote.status <> 'open' OR v_vote.closes_at <= now() THEN RAISE EXCEPTION 'vote_closed'; END IF;
  IF EXISTS (SELECT 1 FROM game_sessions WHERE id = p_session_id AND status IN ('canceled', 'expired')) THEN
    RAISE EXCEPTION 'vote_closed';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM session_assignments WHERE session_id = p_session_id AND player_id = p_player_id) THEN
    RAISE EXCEPTION 'vote_player_not_in_game';
  END IF;

  IF vvv_user_is_player(v_uid, p_player_id) THEN RAISE EXCEPTION 'vote_self'; END IF;

  IF EXISTS (
    SELECT 1 FROM post_game_ballots
    WHERE session_id = p_session_id AND voter_id = v_uid AND category <> p_category AND player_id = p_player_id
  ) THEN
    RAISE EXCEPTION 'vote_same_player';
  END IF;

  INSERT INTO post_game_ballots (session_id, voter_id, category, player_id)
  VALUES (p_session_id, v_uid, p_category, p_player_id)
  ON CONFLICT (session_id, voter_id, category)
  DO UPDATE SET player_id = EXCLUDED.player_id, cast_at = now()
  RETURNING * INTO v_ballot;

  RETURN v_ballot;
END;
$$;

-- ============================================================
-- SETTLEMENT
-- ============================================================

-- Settles one due vote. Internal: callers go through settle_post_game_votes().
CREATE OR REPLACE FUNCTION vvv_settle_post_game_vote(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_vote post_game_votes%ROWTYPE;
  v_category TEXT;
  v_tallies JSONB;
  v_ballots INTEGER;
  v_top INTEGER;
  v_leaders UUID[];
  v_winners UUID[];
  v_outcome TEXT;
  v_pot INTEGER;
  v_prophets INTEGER;
  v_winning_stake INTEGER;
  v_hits INTEGER;
  v_paid INTEGER;
  v_payout INTEGER;
  v_wager RECORD;
  v_summary JSONB := '{}'::jsonb;
  v_mvp UUID[] := '{}';
  v_inter UUID[] := '{}';
  v_player UUID;
  v_user UUID;
  v_bonus_paid UUID[] := '{}';
  v_void BOOLEAN;
BEGIN
  SELECT * INTO v_vote FROM post_game_votes WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_vote.status <> 'open' OR v_vote.closes_at > now() THEN
    RETURN NULL;
  END IF;

  -- A game canceled after its vote opened gets no verdict: every stake goes home and nobody is crowned.
  v_void := EXISTS (SELECT 1 FROM game_sessions WHERE id = p_session_id AND status IN ('canceled', 'expired'));

  -- A pick whose player was deleted can never win: return the stake.
  FOR v_wager IN
    SELECT * FROM prophecy_wagers
    WHERE session_id = p_session_id AND status = 'pending' AND player_id IS NULL
    FOR UPDATE
  LOOP
    UPDATE prophecy_wagers SET status = 'refunded', payout = v_wager.stake, settled_at = now() WHERE id = v_wager.id;
    PERFORM adjust_balance(v_wager.user_id, v_wager.stake, 'prophecy_refunded', v_wager.id);
  END LOOP;

  FOREACH v_category IN ARRAY ARRAY['mvp', 'inter'] LOOP
    SELECT COALESCE(jsonb_object_agg(t.player_id, t.votes), '{}'::jsonb),
           COALESCE(SUM(t.votes), 0)::INTEGER,
           COALESCE(MAX(t.votes), 0)::INTEGER
      INTO v_tallies, v_ballots, v_top
      FROM (
        SELECT player_id, COUNT(*)::INTEGER AS votes
        FROM post_game_ballots
        WHERE session_id = p_session_id AND category = v_category
        GROUP BY player_id
      ) t;

    SELECT COALESCE(array_agg(t.player_id), '{}')
      INTO v_leaders
      FROM (
        SELECT player_id
        FROM post_game_ballots
        WHERE session_id = p_session_id AND category = v_category
        GROUP BY player_id
        HAVING COUNT(*) = v_top
      ) t;

    IF v_void THEN
      v_outcome := 'void';
      v_winners := '{}';
    ELSIF v_ballots = 0 THEN
      v_outcome := 'no_votes';
      v_winners := '{}';
    ELSIF v_top < 2 THEN
      v_outcome := 'too_few';
      v_winners := '{}';
    ELSIF cardinality(v_leaders) > 2 THEN
      v_outcome := 'split';
      v_winners := '{}';
    ELSE
      v_outcome := 'decided';
      v_winners := v_leaders;
    END IF;

    SELECT COALESCE(SUM(stake), 0)::INTEGER,
           COUNT(*)::INTEGER,
           COALESCE(SUM(stake) FILTER (WHERE player_id = ANY (v_winners)), 0)::INTEGER,
           (COUNT(*) FILTER (WHERE player_id = ANY (v_winners)))::INTEGER
      INTO v_pot, v_prophets, v_winning_stake, v_hits
      FROM prophecy_wagers
      WHERE session_id = p_session_id AND market = v_category AND status = 'pending';

    v_paid := 0;
    FOR v_wager IN
      SELECT * FROM prophecy_wagers
      WHERE session_id = p_session_id AND market = v_category AND status = 'pending'
      ORDER BY created_at
      FOR UPDATE
    LOOP
      IF v_winning_stake = 0 THEN
        UPDATE prophecy_wagers SET status = 'refunded', payout = v_wager.stake, settled_at = now() WHERE id = v_wager.id;
        PERFORM adjust_balance(v_wager.user_id, v_wager.stake, 'prophecy_refunded', v_wager.id);
      ELSIF v_wager.player_id = ANY (v_winners) THEN
        v_payout := FLOOR(v_wager.stake::NUMERIC * v_pot / v_winning_stake);
        UPDATE prophecy_wagers SET status = 'won', payout = v_payout, settled_at = now() WHERE id = v_wager.id;
        PERFORM adjust_balance(v_wager.user_id, v_payout, 'prophecy_won', v_wager.id);
        v_paid := v_paid + v_payout;
      ELSE
        UPDATE prophecy_wagers SET status = 'lost', payout = 0, settled_at = now() WHERE id = v_wager.id;
      END IF;
    END LOOP;

    v_summary := v_summary || jsonb_build_object(v_category, jsonb_build_object(
      'ballots', v_ballots,
      'tallies', v_tallies,
      'winners', to_jsonb(v_winners),
      'names', (SELECT COALESCE(jsonb_agg(p.name ORDER BY p.name), '[]'::jsonb) FROM players p WHERE p.id = ANY (v_winners)),
      'outcome', v_outcome,
      'pot', v_pot,
      'prophets', v_prophets,
      'hits', CASE WHEN v_winning_stake = 0 THEN 0 ELSE v_hits END,
      'paid', v_paid,
      'refunded', v_pot > 0 AND v_winning_stake = 0
    ));

    IF v_category = 'mvp' THEN v_mvp := v_winners; ELSE v_inter := v_winners; END IF;
  END LOOP;

  FOREACH v_player IN ARRAY v_mvp LOOP
    SELECT COALESCE(
      (SELECT auth_user_id FROM players WHERE id = v_player),
      (SELECT id FROM user_profiles WHERE player_id = v_player LIMIT 1)
    ) INTO v_user;
    IF v_user IS NOT NULL AND EXISTS (SELECT 1 FROM point_balances WHERE user_id = v_user) THEN
      PERFORM adjust_balance(v_user, 15, 'mvp_bonus', p_session_id);
      v_bonus_paid := v_bonus_paid || v_player;
    END IF;
  END LOOP;

  v_summary := v_summary || jsonb_build_object('mvp_bonus', 15, 'mvp_bonus_paid', to_jsonb(v_bonus_paid), 'void', v_void);

  UPDATE post_game_votes
  SET status = 'settled', settled_at = now(), mvp_player_ids = v_mvp, inter_player_ids = v_inter, summary = v_summary
  WHERE session_id = p_session_id;

  RETURN v_summary || jsonb_build_object('session_id', p_session_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION vvv_settle_post_game_vote(UUID) FROM PUBLIC, anon, authenticated;

-- Settles every due vote (or only p_session_id's) exactly once and returns what was just settled, so the
-- caller can announce it. Also returns stakes stranded on games that will never get a vote.
-- Safe for anyone to call: it only acts on votes whose window has closed.
CREATE OR REPLACE FUNCTION settle_post_game_votes(p_session_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session_id UUID;
  v_result JSONB;
  v_results JSONB := '[]'::jsonb;
  v_wager RECORD;
BEGIN
  FOR v_session_id IN
    SELECT session_id FROM post_game_votes
    WHERE status = 'open' AND closes_at <= now() AND (p_session_id IS NULL OR session_id = p_session_id)
    ORDER BY closes_at
    LIMIT 20
    FOR UPDATE SKIP LOCKED
  LOOP
    v_result := vvv_settle_post_game_vote(v_session_id);
    IF v_result IS NOT NULL THEN
      v_results := v_results || jsonb_build_array(v_result);
    END IF;
  END LOOP;

  FOR v_wager IN
    SELECT w.* FROM prophecy_wagers w
    JOIN game_sessions s ON s.id = w.session_id
    LEFT JOIN games g ON g.id = s.game_id
    WHERE w.status = 'pending'
      AND (p_session_id IS NULL OR w.session_id = p_session_id)
      AND (
        s.status IN ('canceled', 'expired')
        OR (
          s.status IN ('blue_win', 'red_win')
          AND NOT EXISTS (SELECT 1 FROM post_game_votes v WHERE v.session_id = s.id)
          AND COALESCE(g.played_at, s.updated_at) + interval '5 minutes' <= now()
        )
      )
    FOR UPDATE OF w SKIP LOCKED
  LOOP
    UPDATE prophecy_wagers SET status = 'refunded', payout = v_wager.stake, settled_at = now() WHERE id = v_wager.id;
    PERFORM adjust_balance(v_wager.user_id, v_wager.stake, 'prophecy_refunded', v_wager.id);
  END LOOP;

  RETURN v_results;
END;
$$;

-- Cancel hook: return every pending stake of a game that will not be played out.
CREATE OR REPLACE FUNCTION refund_prophecy_wagers(p_session_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_status TEXT;
  v_wager RECORD;
  v_count INTEGER := 0;
BEGIN
  SELECT status INTO v_status FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_status IN ('blue_win', 'red_win') THEN RAISE EXCEPTION 'prophecy_already_resolved'; END IF;
  IF v_status NOT IN ('canceled', 'expired') AND NOT vvv_can_manage_session(v_uid, p_session_id) THEN
    RAISE EXCEPTION 'prophecy_forbidden';
  END IF;

  FOR v_wager IN
    SELECT * FROM prophecy_wagers WHERE session_id = p_session_id AND status = 'pending' FOR UPDATE
  LOOP
    UPDATE prophecy_wagers SET status = 'refunded', payout = v_wager.stake, settled_at = now() WHERE id = v_wager.id;
    PERFORM adjust_balance(v_wager.user_id, v_wager.stake, 'prophecy_refunded', v_wager.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- PRIVILEGES
-- ============================================================

-- Internal helpers: only the SECURITY DEFINER functions above call them, with the owner's rights.
REVOKE EXECUTE ON FUNCTION vvv_user_is_player(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_can_manage_session(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Sealing and voting need a signed-in caller; lazy opening and settlement stay open to every reader.
REVOKE EXECUTE ON FUNCTION seal_prophecy(UUID, TEXT, UUID, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION cast_post_game_vote(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION seal_prophecy(UUID, TEXT, UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cast_post_game_vote(UUID, TEXT, UUID) TO authenticated, service_role;

-- ============================================================
-- REALTIME
-- ============================================================

SELECT vvv_add_to_realtime('prophecy_wagers');
SELECT vvv_add_to_realtime('post_game_votes');
SELECT vvv_add_to_realtime('post_game_ballots');

-- ============================================================
-- phase10_chaos.sql
-- ============================================================

-- Phase 10: Royal Decrees overhaul (chaos round)
-- Additive and idempotent: safe to run while the previous app version is deployed.
--
-- Every decree now runs inside chaos_issue_decree(): validation, payment and the draft change happen in one
-- transaction (all or nothing), and decrees for the same game are serialized on the game_sessions row, so
-- per-user limits and concurrent draft edits are race-safe. Prices and limits live in chaos_decree_rules.

-- ============================================================
-- chaos_actions: constraints and new columns
-- ============================================================

-- 'sabotage' was never an allowed tier, so legacy champion bans and lane forces were charged and applied
-- but their log row was rejected: no history, no per-game limit, no refund on cancel.
ALTER TABLE chaos_actions DROP CONSTRAINT IF EXISTS chaos_actions_tier_check;
ALTER TABLE chaos_actions ADD CONSTRAINT chaos_actions_tier_check
  CHECK (tier IN ('medium', 'high', 'super', 'sabotage', 'ward'));

ALTER TABLE chaos_actions DROP CONSTRAINT IF EXISTS chaos_actions_action_type_check;
ALTER TABLE chaos_actions ADD CONSTRAINT chaos_actions_action_type_check
  CHECK (action_type IN (
    'double_or_nothing', 'swap_teammate', 'reroll_self',
    'shuffle_lanes', 'reroll_champs', 'target_reroll',
    'champion_ban', 'lane_force', 'royal_pardon'
  ));

ALTER TABLE chaos_actions ADD COLUMN IF NOT EXISTS rules_version SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE chaos_actions ADD COLUMN IF NOT EXISTS affected_side TEXT;
ALTER TABLE chaos_actions ADD COLUMN IF NOT EXISTS changed_assignment_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE chaos_actions ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE chaos_actions ADD COLUMN IF NOT EXISTS multiplier NUMERIC(4, 2);

ALTER TABLE chaos_actions DROP CONSTRAINT IF EXISTS chaos_actions_affected_side_check;
ALTER TABLE chaos_actions ADD CONSTRAINT chaos_actions_affected_side_check
  CHECK (affected_side IS NULL OR affected_side IN ('blue', 'red'));

CREATE INDEX IF NOT EXISTS idx_chaos_actions_session_user ON chaos_actions (session_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chaos_one_pardon_per_player
  ON chaos_actions (session_id, target_player_id)
  WHERE action_type = 'royal_pardon' AND status <> 'refunded';

-- ============================================================
-- Price list and per-game limits (tune with UPDATE, no deploy needed)
-- ============================================================

CREATE TABLE IF NOT EXISTS chaos_decree_rules (
  action_type TEXT PRIMARY KEY,
  cost INTEGER NOT NULL CHECK (cost >= 0),
  max_uses INTEGER NOT NULL CHECK (max_uses >= 0),
  limit_group TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chaos_decree_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chaos_rules_read" ON chaos_decree_rules;
CREATE POLICY "chaos_rules_read" ON chaos_decree_rules FOR SELECT USING (true);

-- max_uses is per user per game, shared by every decree of the same limit_group.
INSERT INTO chaos_decree_rules (action_type, cost, max_uses, limit_group, enabled) VALUES
  ('double_or_nothing', 49, 3, 'wager', true),
  ('royal_pardon', 59, 1, 'pardon', true),
  ('reroll_self', 59, 1, 'reroll_self', true),
  ('champion_ban', 75, 1, 'sabotage', true),
  ('swap_teammate', 89, 1, 'swap', true),
  ('lane_force', 99, 1, 'sabotage', true),
  ('shuffle_lanes', 119, 1, 'shuffle', true),
  ('reroll_champs', 139, 1, 'purge', true),
  ('target_reroll', 139, 0, 'target_reroll', false)
ON CONFLICT (action_type) DO NOTHING;

-- ============================================================
-- Seals: once a game's decrees are refunded, no new decree can slip in before the status flips
-- ============================================================

CREATE TABLE IF NOT EXISTS chaos_session_seals (
  session_id UUID PRIMARY KEY REFERENCES game_sessions(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  sealed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chaos_session_seals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chaos_seals_read" ON chaos_session_seals;
CREATE POLICY "chaos_seals_read" ON chaos_session_seals FOR SELECT USING (true);

-- ============================================================
-- Helpers
-- ============================================================

-- Mirrors the PATCH /api/sessions/[id] rule: the creator or an admin runs the game (or anyone on creatorless games).
CREATE OR REPLACE FUNCTION chaos_can_officiate(p_created_by UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    p_created_by IS NULL
      OR p_created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM players WHERE auth_user_id = auth.uid() AND is_admin),
    false
  );
$$;

-- Random champion for a lane: never one in p_exclude, avoids today's fearless list unless the lane runs dry.
CREATE OR REPLACE FUNCTION chaos_pick_champion(p_lane TEXT, p_exclude TEXT[])
RETURNS TABLE (pick_name TEXT, pick_internal TEXT, pick_fearless_override BOOLEAN)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'utc')::date;
  v_exclude TEXT[] := COALESCE(array_remove(p_exclude, NULL), '{}');
BEGIN
  RETURN QUERY
    SELECT cr.name, cr.internal_name, false
    FROM champion_roles cr
    WHERE cr.role = p_lane
      AND NOT (cr.name = ANY (v_exclude))
      AND NOT EXISTS (
        SELECT 1 FROM daily_fearless df WHERE df.date = v_today AND df.champion_name = cr.name
      )
    ORDER BY random()
    LIMIT 1;
  IF FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT cr.name, cr.internal_name, true
    FROM champion_roles cr
    WHERE cr.role = p_lane AND NOT (cr.name = ANY (v_exclude))
    ORDER BY random()
    LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION chaos_change_json(
  p_before session_assignments, p_lane TEXT, p_champion TEXT, p_internal TEXT
) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'assignment_id', p_before.id,
    'player_id', p_before.player_id,
    'player_name', (SELECT name FROM players WHERE id = p_before.player_id),
    'side', p_before.side,
    'before', jsonb_build_object(
      'lane', p_before.lane, 'champion', p_before.champion, 'champion_internal', p_before.champion_internal
    ),
    'after', jsonb_build_object('lane', p_lane, 'champion', p_champion, 'champion_internal', p_internal)
  );
$$;

-- Double or nothing pays 2x. Wagers placed through chaos_issue_decree (rules_version 2) gain +0.5x once a
-- hostile decree another user lands on the backed side after the wager, capped at 2.5x: defiance pays, but
-- 3x printed points. Mirrored in lib/chaos/catalog.ts (WAGER_* constants).
-- Title effects (phase10_title-effects.sql): Baron Caller stores a higher starting multiplier in details; the
-- 2.5x cap still holds.
CREATE OR REPLACE FUNCTION chaos_wager_multiplier(p_wager chaos_actions) RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p_wager.rules_version < 2 THEN 2.0
    ELSE LEAST(2.5, COALESCE((p_wager.details->>'base_multiplier')::NUMERIC, 2.0) + 0.5 * LEAST(1, (
      SELECT count(*)
      FROM chaos_actions h
      WHERE h.session_id = p_wager.session_id
        AND h.status = 'resolved'
        AND h.affected_side = p_wager.side
        AND h.user_id <> p_wager.user_id
        AND h.created_at > p_wager.created_at
        AND h.action_type IN ('champion_ban', 'lane_force', 'shuffle_lanes', 'reroll_champs', 'target_reroll')
    )))
  END;
$$;

-- ============================================================
-- Issue a decree (the only write path for clients)
-- ============================================================

CREATE OR REPLACE FUNCTION chaos_issue_decree(
  p_session_id UUID,
  p_action_type TEXT,
  p_side TEXT DEFAULT NULL,
  p_target_player_id UUID DEFAULT NULL,
  p_target_player_2_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_rule chaos_decree_rules%ROWTYPE;
  v_id UUID := gen_random_uuid();
  v_now TIMESTAMPTZ;
  v_used INTEGER;
  v_actor_player UUID;
  v_actor session_assignments%ROWTYPE;
  v_t1 session_assignments%ROWTYPE;
  v_t2 session_assignments%ROWTYPE;
  v_row session_assignments%ROWTYPE;
  v_pick RECORD;
  v_exclude TEXT[];
  v_pardoned UUID[];
  v_ids UUID[];
  v_seats JSONB;
  v_seat JSONB;
  v_n INTEGER;
  v_i INTEGER;
  v_changes JSONB := '[]'::jsonb;
  v_changed UUID[] := '{}';
  v_details JSONB;
  v_affected TEXT;
  v_status TEXT := 'resolved';
  v_tier TEXT;
  v_reason TEXT := 'chaos_spent';
  v_side TEXT;
  v_target_team TEXT;
  v_target_1 UUID;
  v_target_2 UUID;
  v_banned TEXT;
  v_forced TEXT;
  v_balance INTEGER;
  v_extra JSONB := '{}'::jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'chaos:not_authenticated';
  END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'chaos:session_not_found';
  END IF;

  v_now := clock_timestamp();
  IF v_session.status <> 'chaos'
     OR (v_session.chaos_ends_at IS NOT NULL AND v_now > v_session.chaos_ends_at + interval '3 seconds')
     OR EXISTS (SELECT 1 FROM chaos_session_seals WHERE session_id = p_session_id) THEN
    RAISE EXCEPTION 'chaos:window_closed';
  END IF;

  SELECT * INTO v_rule FROM chaos_decree_rules WHERE action_type = p_action_type;
  IF NOT FOUND OR NOT v_rule.enabled THEN
    RAISE EXCEPTION 'chaos:unknown_decree';
  END IF;

  SELECT count(*) INTO v_used
  FROM chaos_actions ca
  JOIN chaos_decree_rules r ON r.action_type = ca.action_type
  WHERE ca.session_id = p_session_id
    AND ca.user_id = v_user
    AND ca.status <> 'refunded'
    AND r.limit_group = v_rule.limit_group;
  -- Title effects (phase10_title-effects.sql): The Usurper adds a use.
  IF v_used >= vvv_title_decree_uses(v_user, v_rule.max_uses, v_used) THEN
    RAISE EXCEPTION 'chaos:limit_reached';
  END IF;

  PERFORM 1 FROM session_assignments WHERE session_id = p_session_id FOR UPDATE;

  SELECT player_id INTO v_actor_player FROM user_profiles WHERE id = v_user;
  IF v_actor_player IS NOT NULL THEN
    SELECT * INTO v_actor FROM session_assignments
    WHERE session_id = p_session_id AND player_id = v_actor_player;
  END IF;

  SELECT COALESCE(array_agg(target_player_id), '{}') INTO v_pardoned
  FROM chaos_actions
  WHERE session_id = p_session_id AND action_type = 'royal_pardon' AND status <> 'refunded';

  v_exclude := ARRAY(SELECT champion FROM session_assignments WHERE session_id = p_session_id)
    || ARRAY(
      SELECT banned_champion FROM chaos_actions
      WHERE session_id = p_session_id AND banned_champion IS NOT NULL AND status <> 'refunded'
    );

  IF p_action_type = 'double_or_nothing' THEN
    IF p_side IS NULL OR p_side NOT IN ('blue', 'red') THEN
      RAISE EXCEPTION 'chaos:invalid_side';
    END IF;
    IF v_actor.id IS NOT NULL AND v_actor.side <> p_side THEN
      RAISE EXCEPTION 'chaos:treason';
    END IF;
    IF EXISTS (
      SELECT 1 FROM chaos_actions
      WHERE session_id = p_session_id AND user_id = v_user AND action_type = 'double_or_nothing'
        AND status <> 'refunded' AND side <> p_side
    ) THEN
      RAISE EXCEPTION 'chaos:fence_sitter';
    END IF;
    v_status := 'pending';
    v_tier := 'medium';
    v_side := p_side;
    v_extra := jsonb_build_object('side', p_side);

  ELSIF p_action_type = 'royal_pardon' THEN
    SELECT * INTO v_t1 FROM session_assignments
    WHERE session_id = p_session_id AND player_id = p_target_player_id;
    IF v_t1.id IS NULL THEN
      RAISE EXCEPTION 'chaos:target_not_in_game';
    END IF;
    IF v_t1.player_id = ANY (v_pardoned) THEN
      RAISE EXCEPTION 'chaos:already_pardoned';
    END IF;
    v_tier := 'ward';
    v_target_1 := v_t1.player_id;
    v_extra := jsonb_build_object(
      'target', chaos_change_json(v_t1, v_t1.lane, v_t1.champion, v_t1.champion_internal)
    );

  ELSIF p_action_type = 'swap_teammate' THEN
    IF v_actor.id IS NULL THEN
      RAISE EXCEPTION 'chaos:players_only';
    END IF;
    SELECT * INTO v_t1 FROM session_assignments
    WHERE session_id = p_session_id AND player_id = p_target_player_id;
    IF v_t1.id IS NULL THEN
      RAISE EXCEPTION 'chaos:target_not_in_game';
    END IF;
    IF v_t1.id = v_actor.id THEN
      RAISE EXCEPTION 'chaos:self_target';
    END IF;
    IF v_t1.side <> v_actor.side THEN
      RAISE EXCEPTION 'chaos:target_not_teammate';
    END IF;
    IF v_t1.player_id = ANY (v_pardoned) THEN
      RAISE EXCEPTION 'chaos:target_pardoned';
    END IF;

    UPDATE session_assignments
    SET lane = v_t1.lane, champion = v_t1.champion, champion_internal = v_t1.champion_internal,
        fearless_override = v_t1.fearless_override
    WHERE id = v_actor.id;
    UPDATE session_assignments
    SET lane = v_actor.lane, champion = v_actor.champion, champion_internal = v_actor.champion_internal,
        fearless_override = v_actor.fearless_override
    WHERE id = v_t1.id;

    v_changes := jsonb_build_array(
      chaos_change_json(v_actor, v_t1.lane, v_t1.champion, v_t1.champion_internal),
      chaos_change_json(v_t1, v_actor.lane, v_actor.champion, v_actor.champion_internal)
    );
    v_changed := ARRAY[v_actor.id, v_t1.id];
    v_tier := 'high';
    v_target_1 := v_actor.player_id;
    v_target_2 := v_t1.player_id;

  ELSIF p_action_type = 'reroll_self' THEN
    IF v_actor.id IS NULL THEN
      RAISE EXCEPTION 'chaos:players_only';
    END IF;
    SELECT * INTO v_pick FROM chaos_pick_champion(v_actor.lane, v_exclude);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'chaos:no_champion';
    END IF;

    UPDATE session_assignments
    SET champion = v_pick.pick_name, champion_internal = v_pick.pick_internal,
        fearless_override = v_pick.pick_fearless_override
    WHERE id = v_actor.id;

    v_changes := jsonb_build_array(
      chaos_change_json(v_actor, v_actor.lane, v_pick.pick_name, v_pick.pick_internal)
    );
    v_changed := ARRAY[v_actor.id];
    v_tier := 'high';
    v_target_1 := v_actor.player_id;

  ELSIF p_action_type = 'champion_ban' THEN
    SELECT * INTO v_t1 FROM session_assignments
    WHERE session_id = p_session_id AND player_id = p_target_player_id;
    IF v_t1.id IS NULL THEN
      RAISE EXCEPTION 'chaos:target_not_in_game';
    END IF;
    IF v_t1.player_id = v_actor_player THEN
      RAISE EXCEPTION 'chaos:self_target';
    END IF;
    IF v_t1.player_id = ANY (v_pardoned) THEN
      RAISE EXCEPTION 'chaos:target_pardoned';
    END IF;

    v_banned := v_t1.champion;
    SELECT * INTO v_pick FROM chaos_pick_champion(v_t1.lane, v_exclude);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'chaos:no_champion';
    END IF;

    UPDATE session_assignments
    SET champion = v_pick.pick_name, champion_internal = v_pick.pick_internal,
        fearless_override = v_pick.pick_fearless_override
    WHERE id = v_t1.id;

    v_changes := jsonb_build_array(
      chaos_change_json(v_t1, v_t1.lane, v_pick.pick_name, v_pick.pick_internal)
    );
    v_changed := ARRAY[v_t1.id];
    v_affected := v_t1.side;
    v_tier := 'sabotage';
    v_reason := 'sabotage_spent';
    v_target_1 := v_t1.player_id;
    v_extra := jsonb_build_object('banned_champion', v_banned);

  ELSIF p_action_type = 'lane_force' THEN
    SELECT * INTO v_t1 FROM session_assignments
    WHERE session_id = p_session_id AND player_id = p_target_player_id;
    SELECT * INTO v_t2 FROM session_assignments
    WHERE session_id = p_session_id AND player_id = p_target_player_2_id;
    IF v_t1.id IS NULL OR v_t2.id IS NULL THEN
      RAISE EXCEPTION 'chaos:target_not_in_game';
    END IF;
    IF v_t1.id = v_t2.id THEN
      RAISE EXCEPTION 'chaos:same_target';
    END IF;
    IF v_t1.side <> v_t2.side THEN
      RAISE EXCEPTION 'chaos:target_not_teammate';
    END IF;
    IF v_t1.player_id = v_actor_player OR v_t2.player_id = v_actor_player THEN
      RAISE EXCEPTION 'chaos:self_target';
    END IF;
    IF v_t1.player_id = ANY (v_pardoned) OR v_t2.player_id = ANY (v_pardoned) THEN
      RAISE EXCEPTION 'chaos:target_pardoned';
    END IF;

    UPDATE session_assignments SET lane = v_t2.lane WHERE id = v_t1.id;
    UPDATE session_assignments SET lane = v_t1.lane WHERE id = v_t2.id;

    v_changes := jsonb_build_array(
      chaos_change_json(v_t1, v_t2.lane, v_t1.champion, v_t1.champion_internal),
      chaos_change_json(v_t2, v_t1.lane, v_t2.champion, v_t2.champion_internal)
    );
    v_changed := ARRAY[v_t1.id, v_t2.id];
    v_affected := v_t1.side;
    v_forced := v_t2.lane;
    v_tier := 'sabotage';
    v_reason := 'sabotage_spent';
    v_target_1 := v_t1.player_id;
    v_target_2 := v_t2.player_id;

  ELSIF p_action_type IN ('shuffle_lanes', 'reroll_champs') THEN
    IF p_side IS NULL OR p_side NOT IN ('blue', 'red') THEN
      RAISE EXCEPTION 'chaos:invalid_side';
    END IF;

    SELECT array_agg(id ORDER BY random()) INTO v_ids
    FROM session_assignments
    WHERE session_id = p_session_id AND side = p_side AND NOT (player_id = ANY (v_pardoned));
    v_n := COALESCE(array_length(v_ids, 1), 0);
    IF (p_action_type = 'shuffle_lanes' AND v_n < 2) OR v_n < 1 THEN
      RAISE EXCEPTION 'chaos:not_enough_targets';
    END IF;

    IF p_action_type = 'shuffle_lanes' THEN
      -- One cycle over the movable players: everyone takes the next seat, nobody keeps their own.
      SELECT jsonb_agg(to_jsonb(sa) ORDER BY array_position(v_ids, sa.id)) INTO v_seats
      FROM session_assignments sa
      WHERE sa.id = ANY (v_ids);

      FOR v_i IN 1..v_n LOOP
        v_row := jsonb_populate_record(NULL::session_assignments, v_seats -> (v_i - 1));
        v_seat := v_seats -> (v_i % v_n);
        UPDATE session_assignments
        SET lane = v_seat ->> 'lane', champion = v_seat ->> 'champion',
            champion_internal = v_seat ->> 'champion_internal',
            fearless_override = (v_seat ->> 'fearless_override')::boolean
        WHERE id = v_row.id;
        v_changes := v_changes || jsonb_build_array(
          chaos_change_json(v_row, v_seat ->> 'lane', v_seat ->> 'champion', v_seat ->> 'champion_internal')
        );
      END LOOP;
    ELSE
      FOR v_i IN 1..v_n LOOP
        SELECT * INTO v_row FROM session_assignments WHERE id = v_ids[v_i];
        SELECT * INTO v_pick FROM chaos_pick_champion(v_row.lane, v_exclude);
        IF NOT FOUND THEN
          RAISE EXCEPTION 'chaos:no_champion';
        END IF;
        v_exclude := v_exclude || v_pick.pick_name;
        UPDATE session_assignments
        SET champion = v_pick.pick_name, champion_internal = v_pick.pick_internal,
            fearless_override = v_pick.pick_fearless_override
        WHERE id = v_row.id;
        v_changes := v_changes || jsonb_build_array(
          chaos_change_json(v_row, v_row.lane, v_pick.pick_name, v_pick.pick_internal)
        );
      END LOOP;
    END IF;

    v_changed := v_ids;
    v_affected := p_side;
    v_target_team := p_side;
    v_tier := 'super';
    v_extra := jsonb_build_object('side', p_side);

  ELSE
    RAISE EXCEPTION 'chaos:unknown_decree';
  END IF;

  -- Title effects (phase10_title-effects.sql): discounts, markups and exile immunity set the price.
  v_rule.cost := vvv_title_decree_cost(v_user, p_session_id, p_action_type, v_rule.cost, v_target_1, v_target_2, v_target_team);

  IF v_rule.cost > 0 THEN
    v_balance := adjust_balance(v_user, -v_rule.cost, v_reason, v_id);
  ELSE
    SELECT balance INTO v_balance FROM point_balances WHERE user_id = v_user;
  END IF;

  v_details := jsonb_build_object('changes', v_changes) || v_extra || vvv_title_decree_details(v_user, p_action_type);

  INSERT INTO chaos_actions (
    id, session_id, user_id, action_type, tier, cost, side, target_player_id, target_player_2_id,
    target_team, payout, status, banned_champion, forced_lane, rules_version, affected_side,
    changed_assignment_ids, details, created_at
  ) VALUES (
    v_id, p_session_id, v_user, p_action_type, v_tier, v_rule.cost, v_side, v_target_1, v_target_2,
    v_target_team, NULL, v_status, v_banned, v_forced, 2, v_affected,
    v_changed, v_details, v_now
  );

  UPDATE game_sessions SET updated_at = now() WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'action_type', p_action_type,
    'cost', v_rule.cost,
    'status', v_status,
    'balance', v_balance,
    'side', COALESCE(v_side, v_target_team),
    'affected_side', v_affected,
    'target_player_id', v_target_1,
    'target_player_2_id', v_target_2,
    'banned_champion', v_banned,
    'forced_lane', v_forced,
    'changed_assignment_ids', to_jsonb(v_changed),
    'details', v_details,
    'created_at', v_now
  );
END;
$$;

-- ============================================================
-- End of game: race-safe resolution and refunds
-- ============================================================

CREATE OR REPLACE FUNCTION resolve_chaos_wagers_v2(p_session_id UUID, p_winner_side TEXT, p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
  v_wager chaos_actions%ROWTYPE;
  v_mult NUMERIC;
  v_payout INTEGER;
  v_won INTEGER := 0;
  v_lost INTEGER := 0;
  v_paid INTEGER := 0;
BEGIN
  IF p_winner_side IS NULL OR p_winner_side NOT IN ('blue', 'red') THEN
    RAISE EXCEPTION 'chaos:invalid_side';
  END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'chaos:session_not_found';
  END IF;
  IF NOT chaos_can_officiate(v_session.created_by) THEN
    RAISE EXCEPTION 'chaos:forbidden';
  END IF;
  IF v_session.status NOT IN ('in_game', 'blue_win', 'red_win') THEN
    RAISE EXCEPTION 'chaos:not_resolvable';
  END IF;
  IF (v_session.game_id IS NOT NULL AND v_session.game_id IS DISTINCT FROM p_game_id)
     OR NOT EXISTS (SELECT 1 FROM games WHERE id = p_game_id AND winner_side = p_winner_side) THEN
    RAISE EXCEPTION 'chaos:game_mismatch';
  END IF;

  FOR v_wager IN
    SELECT * FROM chaos_actions
    WHERE session_id = p_session_id AND action_type = 'double_or_nothing' AND status = 'pending'
    ORDER BY created_at
    FOR UPDATE
  LOOP
    v_mult := chaos_wager_multiplier(v_wager);
    IF v_wager.side = p_winner_side THEN
      v_payout := FLOOR(v_wager.cost * v_mult);
      UPDATE chaos_actions SET status = 'won', payout = v_payout, multiplier = v_mult
      WHERE id = v_wager.id AND status = 'pending';
      IF FOUND THEN
        IF v_payout > 0 THEN
          PERFORM adjust_balance(v_wager.user_id, v_payout, 'chaos_won', v_wager.id);
        END IF;
        v_won := v_won + 1;
        v_paid := v_paid + v_payout;
      END IF;
    ELSE
      UPDATE chaos_actions SET status = 'lost', payout = 0, multiplier = v_mult
      WHERE id = v_wager.id AND status = 'pending';
      IF FOUND THEN
        v_lost := v_lost + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('won', v_won, 'lost', v_lost, 'paid', v_paid);
END;
$$;

CREATE OR REPLACE FUNCTION refund_chaos_actions_v2(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
  v_action chaos_actions%ROWTYPE;
  v_count INTEGER := 0;
  v_total INTEGER := 0;
BEGIN
  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'chaos:session_not_found';
  END IF;
  IF NOT chaos_can_officiate(v_session.created_by) THEN
    RAISE EXCEPTION 'chaos:forbidden';
  END IF;
  -- A recorded game or a settled wager means the match was played: its decrees stand.
  IF v_session.status IN ('blue_win', 'red_win')
     OR v_session.game_id IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM chaos_actions
       WHERE session_id = p_session_id AND action_type = 'double_or_nothing' AND status IN ('won', 'lost')
     ) THEN
    RAISE EXCEPTION 'chaos:already_resolved';
  END IF;

  IF v_session.status = 'chaos' THEN
    INSERT INTO chaos_session_seals (session_id, reason) VALUES (p_session_id, 'canceled')
    ON CONFLICT (session_id) DO NOTHING;
  END IF;

  FOR v_action IN
    SELECT * FROM chaos_actions
    WHERE session_id = p_session_id AND status IN ('pending', 'resolved')
    ORDER BY created_at
    FOR UPDATE
  LOOP
    UPDATE chaos_actions SET status = 'refunded', payout = v_action.cost
    WHERE id = v_action.id AND status IN ('pending', 'resolved');
    IF FOUND THEN
      IF v_action.cost > 0 THEN
        PERFORM adjust_balance(v_action.user_id, v_action.cost, 'chaos_refunded', v_action.id);
      END IF;
      v_count := v_count + 1;
      v_total := v_total + v_action.cost;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('refunded', v_count, 'total', v_total);
END;
$$;

-- ============================================================
-- Direct client inserts: only the legacy app path (pay first, then log) is accepted
-- ============================================================

-- The old insert policy let any user write rows with any cost, which resolve_chaos_wagers and
-- refund_chaos_actions would then pay out. Clients may still insert (the previous app version does), but a
-- row must match a legacy-shaped decree that was paid for in the last two minutes.
CREATE OR REPLACE FUNCTION chaos_actions_guard() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_legacy_cost INTEGER;
  v_rule_cost INTEGER;
  v_paid INTEGER;
  v_logged INTEGER;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  v_legacy_cost := CASE NEW.action_type
    WHEN 'double_or_nothing' THEN 49
    WHEN 'swap_teammate' THEN 89
    WHEN 'reroll_self' THEN 89
    WHEN 'shuffle_lanes' THEN 139
    WHEN 'reroll_champs' THEN 139
    WHEN 'target_reroll' THEN 139
    WHEN 'champion_ban' THEN 75
    WHEN 'lane_force' THEN 120
  END;
  SELECT cost INTO v_rule_cost FROM chaos_decree_rules WHERE action_type = NEW.action_type;

  IF v_legacy_cost IS NULL
     OR NEW.user_id IS DISTINCT FROM auth.uid()
     OR NEW.cost NOT IN (v_legacy_cost, COALESCE(v_rule_cost, v_legacy_cost))
     OR NEW.payout IS NOT NULL
     OR NEW.status <> (CASE WHEN NEW.action_type = 'double_or_nothing' THEN 'pending' ELSE 'resolved' END)
     OR NOT EXISTS (SELECT 1 FROM game_sessions WHERE id = NEW.session_id AND status = 'chaos') THEN
    RAISE EXCEPTION 'chaos:direct_insert_rejected';
  END IF;

  SELECT count(*) INTO v_paid
  FROM point_transactions
  WHERE user_id = NEW.user_id
    AND amount = -NEW.cost
    AND reason IN ('chaos_spent', 'sabotage_spent')
    AND created_at > now() - interval '2 minutes';
  SELECT count(*) INTO v_logged
  FROM chaos_actions
  WHERE user_id = NEW.user_id AND cost = NEW.cost AND created_at > now() - interval '2 minutes';
  IF v_paid <= v_logged THEN
    RAISE EXCEPTION 'chaos:unpaid_decree';
  END IF;

  NEW.created_at := now();
  NEW.rules_version := 1;
  NEW.affected_side := NULL;
  NEW.changed_assignment_ids := '{}';
  NEW.details := '{}'::jsonb;
  NEW.multiplier := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chaos_actions_guard ON chaos_actions;
CREATE TRIGGER chaos_actions_guard
  BEFORE INSERT ON chaos_actions
  FOR EACH ROW EXECUTE FUNCTION chaos_actions_guard();

-- ============================================================
-- Privileges
-- ============================================================

REVOKE EXECUTE ON FUNCTION chaos_can_officiate(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION chaos_pick_champion(TEXT, TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION chaos_change_json(session_assignments, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION chaos_wager_multiplier(chaos_actions) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION chaos_actions_guard() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION chaos_issue_decree(UUID, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION resolve_chaos_wagers_v2(UUID, TEXT, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION refund_chaos_actions_v2(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION chaos_issue_decree(UUID, TEXT, TEXT, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resolve_chaos_wagers_v2(UUID, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION refund_chaos_actions_v2(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- Optional hardening, once the new app version is live everywhere (the previous version calls these
-- directly, and any signed-in user can call them with any arguments):
--   REVOKE EXECUTE ON FUNCTION resolve_chaos_wagers(UUID, TEXT) FROM PUBLIC, anon, authenticated;
--   REVOKE EXECUTE ON FUNCTION refund_chaos_actions(UUID) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- phase10_betting.sql
-- ============================================================

-- Phase 10: Betting overhaul
-- Live pari-mutuel market with raises, early-conviction boost, all-in bonus and Guardian Angel insurance.
-- Additive and idempotent: safe to run while the previous app version is deployed.
-- Requires supabase/phase10_foundation.sql (free-form point_transactions reasons).
--
-- Rules (mirrored in lib/betting/rules.ts):
--   payout        floor(stake * total_pool / winning_pool), refund everyone when one side is empty
--   early boost   stake placed in the first 60 s of the window earns +10% of its share of the profit
--   all-in        staking the whole balance (total stake >= 100) earns +15% of the profit, cannot be insured
--   insurance     a loss returns floor(60% of stake). The premium is priced from the pool when bought:
--                 ceil(66% x the other side's share of the pool), between 33% and 60% of the stake, so it stays
--                 negative EV for long shots too. Paid now, kept on a win, refunded only with the bet itself.
--                 Raising an insured bet prices only the added stake.
--   legacy bets   rows placed before this migration keep their terms (flat 17 premium refunded on a win,
--                 50% of the stake back on a loss)
--   own side      a player seated in the game may only back their own team (spectators bet freely), like duels
--                 and the King's Wager: a bet against your own side, all-in bonus included, paid you to throw

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.vvv_add_to_realtime(text)') IS NULL THEN
    RAISE EXCEPTION 'Run supabase/phase10_foundation.sql before supabase/phase10_betting.sql';
  END IF;
END $$;

-- ============================================================
-- COLUMNS
-- ============================================================

ALTER TABLE bets ADD COLUMN IF NOT EXISTS scheme TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE bets ADD COLUMN IF NOT EXISTS premium INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS coverage_pct SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS early_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS all_in BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS bonus INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS raises INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS raised_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bets_scheme_check' AND conrelid = 'public.bets'::regclass
  ) THEN
    ALTER TABLE bets ADD CONSTRAINT bets_scheme_check CHECK (scheme IN ('legacy', 'v2'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bets_v2_amounts_check' AND conrelid = 'public.bets'::regclass
  ) THEN
    ALTER TABLE bets ADD CONSTRAINT bets_v2_amounts_check CHECK (
      premium >= 0 AND bonus >= 0 AND raises >= 0
      AND early_amount >= 0 AND early_amount <= amount
      AND coverage_pct BETWEEN 0 AND 100
    );
  END IF;
END $$;

ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS betting_opened_at TIMESTAMPTZ;

-- Stamps the moment a session enters the betting phase so the early-conviction window is exact
-- whatever the window length is.
CREATE OR REPLACE FUNCTION bet_v2_stamp_betting_opened() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'betting' AND OLD.status IS DISTINCT FROM 'betting' THEN
    NEW.betting_opened_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bet_v2_stamp_betting_opened_trg ON game_sessions;
CREATE TRIGGER bet_v2_stamp_betting_opened_trg
  BEFORE UPDATE OF status ON game_sessions
  FOR EACH ROW EXECUTE FUNCTION bet_v2_stamp_betting_opened();

-- ============================================================
-- RULES
-- ============================================================

CREATE OR REPLACE FUNCTION bet_rules_v2() RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'window_seconds', 300,
    'early_seconds', 60,
    'early_bonus_pct', 10,
    'all_in_bonus_pct', 15,
    'all_in_min', 100,
    'premium_pct', 33,
    'premium_max_pct', 60,
    'premium_load_pct', 110,
    'coverage_pct', 60,
    'insurance_min', 10,
    'debt_floor', -300,
    'max_stake', 100000,
    'legacy_premium', 17,
    'legacy_coverage_pct', 50
  )
$$;

-- Mirrors the session route: the creator, an admin, or anyone for a session without an owner.
CREATE OR REPLACE FUNCTION bet_v2_can_settle(p_created_by UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    p_created_by IS NULL
    OR p_created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM players WHERE auth_user_id = auth.uid() AND is_admin),
    false
  )
$$;

-- The side a user plays on in this game (through either account link), or NULL for spectators. Same rule as
-- duel_player_side() in phase10_duels.sql: Blue wins the impossible tie.
CREATE OR REPLACE FUNCTION bet_v2_player_side(p_session_id UUID, p_user_id UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT sa.side
  FROM session_assignments sa
  WHERE sa.session_id = p_session_id
    AND p_user_id IS NOT NULL
    AND (
      sa.player_id IN (SELECT p.id FROM players p WHERE p.auth_user_id = p_user_id)
      OR sa.player_id IN (
        SELECT up.player_id FROM user_profiles up WHERE up.id = p_user_id AND up.player_id IS NOT NULL
      )
    )
  ORDER BY sa.side
  LIMIT 1
$$;

-- Guardian Angel premium in percent of the insured stake, priced from the pending pools at purchase time
-- (p_side_pool already includes the stake being insured). The other side's share of the pool is the implied
-- chance of losing: a flat price would make insuring long shots free money.
CREATE OR REPLACE FUNCTION bet_v2_premium_pct(p_side_pool INTEGER, p_other_pool INTEGER) RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN COALESCE(p_other_pool, 0) <= 0 OR COALESCE(p_side_pool, 0) <= 0 THEN (r->>'premium_pct')::INT
    ELSE LEAST(
      GREATEST(
        CEIL(
          (r->>'coverage_pct')::INT * (r->>'premium_load_pct')::INT * p_other_pool::NUMERIC
            / (100 * (p_side_pool + p_other_pool))
        )::INT,
        (r->>'premium_pct')::INT
      ),
      (r->>'premium_max_pct')::INT
    )
  END
  FROM (SELECT bet_rules_v2() AS r) rules
$$;

-- ============================================================
-- PLACE / RAISE
-- ============================================================

-- Earlier drafts of these functions had shorter signatures; drop them so PostgREST resolves a single candidate.
DROP FUNCTION IF EXISTS place_bet_v2(UUID, TEXT, INTEGER, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS insure_bet_v2(UUID);

-- p_current is the stake the client saw (0 for a new bet): a double submit or a stale tab is rejected instead of
-- silently becoming a raise. For an all-in, p_amount must equal the purse the client showed. p_max_premium is the
-- premium the client showed: if the odds moved against the bettor before the call landed, it is rejected.
CREATE OR REPLACE FUNCTION place_bet_v2(
  p_session_id UUID,
  p_side TEXT,
  p_amount INTEGER,
  p_insure BOOLEAN DEFAULT false,
  p_all_in BOOLEAN DEFAULT false,
  p_current INTEGER DEFAULT NULL,
  p_max_premium INTEGER DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_rules JSONB := bet_rules_v2();
  v_now TIMESTAMPTZ := now();
  v_session game_sessions%ROWTYPE;
  v_balance INTEGER;
  v_bet bets%ROWTYPE;
  v_has_bet BOOLEAN;
  v_was_insured BOOLEAN;
  v_all_in BOOLEAN := COALESCE(p_all_in, false);
  v_insured BOOLEAN;
  v_stake INTEGER;
  v_total INTEGER;
  v_side_pool INTEGER;
  v_other_pool INTEGER;
  v_premium_pct INTEGER := 0;
  v_premium INTEGER := 0;
  v_cost INTEGER;
  v_opened TIMESTAMPTZ;
  v_early BOOLEAN := false;
  v_seat TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'bet:not_authenticated'; END IF;
  IF p_side IS NULL OR p_side NOT IN ('blue', 'red') THEN RAISE EXCEPTION 'bet:invalid_side'; END IF;

  -- Share lock: closing the window or settling waits for in-flight bets, and vice versa.
  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bet:session_not_found'; END IF;
  IF v_session.status <> 'betting'
     OR (v_session.betting_ends_at IS NOT NULL AND v_session.betting_ends_at <= v_now) THEN
    RAISE EXCEPTION 'bet:betting_closed';
  END IF;

  -- Seats are frozen once the draft ends, so the side a player fights for cannot change under the bet.
  v_seat := bet_v2_player_side(p_session_id, v_user);
  IF v_seat IS NOT NULL AND v_seat <> p_side THEN RAISE EXCEPTION 'bet:treason'; END IF;

  -- Locking the balance first serializes concurrent requests from the same user.
  SELECT balance INTO v_balance FROM point_balances WHERE user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bet:no_balance'; END IF;

  SELECT * INTO v_bet FROM bets WHERE session_id = p_session_id AND user_id = v_user FOR UPDATE;
  v_has_bet := FOUND;

  IF p_current IS NOT NULL AND p_current <> (CASE WHEN v_has_bet THEN v_bet.amount ELSE 0 END) THEN
    RAISE EXCEPTION 'bet:stale_position';
  END IF;

  IF v_has_bet THEN
    IF v_bet.status <> 'pending' THEN RAISE EXCEPTION 'bet:bet_settled'; END IF;
    IF v_bet.side <> p_side THEN RAISE EXCEPTION 'bet:side_locked'; END IF;
    IF v_bet.all_in THEN RAISE EXCEPTION 'bet:all_in_locked'; END IF;
    IF v_bet.scheme = 'legacy' AND v_bet.insured THEN RAISE EXCEPTION 'bet:legacy_locked'; END IF;
  END IF;

  v_was_insured := v_has_bet AND v_bet.insured;
  v_insured := v_was_insured OR COALESCE(p_insure, false);

  IF v_all_in THEN
    IF v_insured THEN RAISE EXCEPTION 'bet:all_in_uninsurable'; END IF;
    v_stake := v_balance;
    IF v_stake < 1 THEN RAISE EXCEPTION 'bet:invalid_amount'; END IF;
    IF p_amount IS NOT NULL AND p_amount <> v_balance THEN RAISE EXCEPTION 'bet:purse_changed'; END IF;
  ELSE
    v_stake := p_amount;
  END IF;

  IF v_stake IS NULL OR v_stake < 1 OR v_stake > (v_rules->>'max_stake')::INT THEN
    RAISE EXCEPTION 'bet:invalid_amount';
  END IF;

  v_total := v_stake + CASE WHEN v_has_bet THEN v_bet.amount ELSE 0 END;
  -- Title effects (phase10_title-effects.sql): Court Jester caps the stake, The Crawling One refuses insurance.
  PERFORM vvv_title_bet_guard(v_user, v_total, COALESCE(p_insure, false) AND NOT v_was_insured);

  IF v_all_in AND v_total < (v_rules->>'all_in_min')::INT THEN
    RAISE EXCEPTION 'bet:all_in_too_small';
  END IF;

  IF v_insured THEN
    IF v_total < (v_rules->>'insurance_min')::INT THEN RAISE EXCEPTION 'bet:insurance_too_small'; END IF;
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE side = p_side), 0) + v_stake,
      COALESCE(SUM(amount) FILTER (WHERE side <> p_side), 0)
    INTO v_side_pool, v_other_pool
    FROM bets WHERE session_id = p_session_id AND status = 'pending';
    v_premium_pct := bet_v2_premium_pct(v_side_pool, v_other_pool);
    v_premium_pct := vvv_title_premium_pct(v_user, p_session_id, p_side, v_premium_pct); -- title effects: The Holdout
    -- An insured bet only pays for the points it adds; insuring now covers the whole stake.
    v_premium := CEIL(
      (CASE WHEN v_was_insured THEN v_stake ELSE v_total END)::NUMERIC * v_premium_pct / 100
    )::INT;
    IF p_max_premium IS NOT NULL AND v_premium > p_max_premium THEN RAISE EXCEPTION 'bet:premium_changed'; END IF;
  END IF;

  v_cost := v_stake + v_premium;
  IF v_balance - v_cost < (v_rules->>'debt_floor')::INT THEN RAISE EXCEPTION 'bet:debt_limit'; END IF;

  v_opened := COALESCE(
    v_session.betting_opened_at,
    v_session.betting_ends_at - make_interval(secs => (v_rules->>'window_seconds')::INT)
  );
  -- Title effects (phase10_title-effects.sql): Crown Thief stretches the early window.
  v_early := vvv_title_is_early(v_user, v_opened, v_now, (v_rules->>'early_seconds')::INT);

  IF v_has_bet THEN
    UPDATE bets SET
      amount = v_total,
      insured = v_insured,
      premium = premium + v_premium,
      coverage_pct = CASE
        WHEN v_insured AND coverage_pct = 0 THEN vvv_title_coverage_pct(v_user, (v_rules->>'coverage_pct')::INT)
        ELSE coverage_pct
      END,
      early_amount = early_amount + CASE WHEN v_early THEN v_stake ELSE 0 END,
      all_in = v_all_in,
      scheme = 'v2',
      raises = raises + 1,
      raised_at = v_now
    WHERE id = v_bet.id
    RETURNING * INTO v_bet;
  ELSE
    INSERT INTO bets (session_id, user_id, side, amount, insured, scheme, premium, coverage_pct, early_amount, all_in)
    VALUES (
      p_session_id, v_user, p_side, v_total, v_insured, 'v2', v_premium,
      CASE WHEN v_insured THEN vvv_title_coverage_pct(v_user, (v_rules->>'coverage_pct')::INT) ELSE 0 END,
      CASE WHEN v_early THEN v_stake ELSE 0 END,
      v_all_in
    )
    RETURNING * INTO v_bet;
  END IF;

  PERFORM adjust_balance(v_user, -v_stake, 'bet_placed', p_session_id);
  IF v_premium > 0 THEN
    PERFORM adjust_balance(v_user, -v_premium, 'insurance_bought', v_bet.id);
  END IF;

  RETURN jsonb_build_object(
    'bet', to_jsonb(v_bet),
    'staked', v_stake,
    'premium', v_premium,
    'premium_pct', v_premium_pct,
    'early', v_early,
    'raised', v_has_bet,
    'all_in', v_all_in,
    'balance', v_balance - v_cost,
    'title_effects', vvv_title_fx_take()
  );
END;
$$;

-- ============================================================
-- INSURE AN EXISTING BET
-- ============================================================

CREATE OR REPLACE FUNCTION insure_bet_v2(p_session_id UUID, p_max_premium INTEGER DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_rules JSONB := bet_rules_v2();
  v_session game_sessions%ROWTYPE;
  v_balance INTEGER;
  v_bet bets%ROWTYPE;
  v_side_pool INTEGER;
  v_other_pool INTEGER;
  v_premium_pct INTEGER;
  v_premium INTEGER;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'bet:not_authenticated'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bet:session_not_found'; END IF;
  IF v_session.status <> 'betting'
     OR (v_session.betting_ends_at IS NOT NULL AND v_session.betting_ends_at <= now()) THEN
    RAISE EXCEPTION 'bet:betting_closed';
  END IF;

  SELECT balance INTO v_balance FROM point_balances WHERE user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bet:no_balance'; END IF;

  SELECT * INTO v_bet FROM bets WHERE session_id = p_session_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bet:no_bet'; END IF;
  IF v_bet.status <> 'pending' THEN RAISE EXCEPTION 'bet:bet_settled'; END IF;
  IF v_bet.insured THEN RAISE EXCEPTION 'bet:already_insured'; END IF;
  IF v_bet.all_in THEN RAISE EXCEPTION 'bet:all_in_uninsurable'; END IF;
  IF v_bet.amount < (v_rules->>'insurance_min')::INT THEN RAISE EXCEPTION 'bet:insurance_too_small'; END IF;
  PERFORM vvv_title_bet_guard(v_user, 0, true); -- title effects: The Crawling One

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE side = v_bet.side), 0),
    COALESCE(SUM(amount) FILTER (WHERE side <> v_bet.side), 0)
  INTO v_side_pool, v_other_pool
  FROM bets WHERE session_id = p_session_id AND status = 'pending';
  v_premium_pct := bet_v2_premium_pct(v_side_pool, v_other_pool);
  v_premium_pct := vvv_title_premium_pct(v_user, p_session_id, v_bet.side, v_premium_pct); -- title effects: The Holdout
  v_premium := CEIL(v_bet.amount::NUMERIC * v_premium_pct / 100)::INT;
  IF p_max_premium IS NOT NULL AND v_premium > p_max_premium THEN RAISE EXCEPTION 'bet:premium_changed'; END IF;
  IF v_balance - v_premium < (v_rules->>'debt_floor')::INT THEN RAISE EXCEPTION 'bet:debt_limit'; END IF;

  UPDATE bets SET
    insured = true,
    premium = premium + v_premium,
    coverage_pct = vvv_title_coverage_pct(v_user, (v_rules->>'coverage_pct')::INT),
    scheme = 'v2'
  WHERE id = v_bet.id
  RETURNING * INTO v_bet;

  PERFORM adjust_balance(v_user, -v_premium, 'insurance_bought', v_bet.id);

  RETURN jsonb_build_object(
    'bet', to_jsonb(v_bet),
    'premium', v_premium,
    'premium_pct', v_premium_pct,
    'balance', v_balance - v_premium,
    'title_effects', vvv_title_fx_take()
  );
END;
$$;

-- ============================================================
-- SETTLEMENT
-- ============================================================

-- Refunds every pending bet of a session: stake plus premium (legacy insured rows get their flat 17 back).
CREATE OR REPLACE FUNCTION bet_v2_refund_pending(p_session_id UUID) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rules JSONB := bet_rules_v2();
  r bets%ROWTYPE;
  v_premium INTEGER;
  v_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT * FROM bets WHERE session_id = p_session_id AND status = 'pending' ORDER BY created_at FOR UPDATE
  LOOP
    UPDATE bets SET status = 'refunded', payout = r.amount WHERE id = r.id;
    PERFORM adjust_balance(r.user_id, r.amount, 'bet_refunded', r.id);
    v_premium := CASE
      WHEN r.scheme = 'v2' THEN r.premium
      WHEN r.insured THEN (v_rules->>'legacy_premium')::INT
      ELSE 0
    END;
    IF v_premium > 0 THEN
      PERFORM adjust_balance(r.user_id, v_premium, 'insurance_refunded', r.id);
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION resolve_bets_v2(p_session_id UUID, p_winner_side TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rules JSONB := bet_rules_v2();
  v_session game_sessions%ROWTYPE;
  v_total INTEGER;
  v_win_pool INTEGER;
  v_count INTEGER;
  r bets%ROWTYPE;
  v_base INTEGER;
  v_profit INTEGER;
  v_early_bonus INTEGER;
  v_all_in_bonus INTEGER;
  v_cover INTEGER;
  v_winners INTEGER := 0;
  v_losers INTEGER := 0;
  v_bonus_paid INTEGER := 0;
  v_cover_paid INTEGER := 0;
BEGIN
  IF p_winner_side IS NULL OR p_winner_side NOT IN ('blue', 'red') THEN RAISE EXCEPTION 'bet:invalid_side'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bet:session_not_found'; END IF;
  IF NOT bet_v2_can_settle(v_session.created_by) THEN RAISE EXCEPTION 'bet:not_authorized'; END IF;
  -- Only a game that is being played (the declare flow settles before flipping the status) or already won by
  -- this side: never while the betting window is open.
  IF v_session.status NOT IN ('in_game', p_winner_side || '_win') THEN
    RAISE EXCEPTION 'bet:invalid_state';
  END IF;

  PERFORM 1 FROM bets WHERE session_id = p_session_id AND status = 'pending' FOR UPDATE;

  SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(amount) FILTER (WHERE side = p_winner_side), 0), COUNT(*)
  INTO v_total, v_win_pool, v_count
  FROM bets WHERE session_id = p_session_id AND status = 'pending';

  IF v_count = 0 THEN
    RETURN jsonb_build_object('settled', 0, 'refunded', false, 'winner', p_winner_side, 'total_pool', 0);
  END IF;

  IF v_win_pool = 0 OR v_win_pool = v_total THEN
    PERFORM bet_v2_refund_pending(p_session_id);
    RETURN jsonb_build_object('settled', v_count, 'refunded', true, 'winner', p_winner_side, 'total_pool', v_total);
  END IF;

  FOR r IN SELECT * FROM bets WHERE session_id = p_session_id AND status = 'pending' ORDER BY created_at LOOP
    IF r.side = p_winner_side THEN
      v_base := FLOOR(r.amount::NUMERIC * v_total / v_win_pool)::INT;
      v_profit := GREATEST(v_base - r.amount, 0);
      v_early_bonus := 0;
      v_all_in_bonus := 0;
      IF r.scheme = 'v2' THEN
        IF r.early_amount > 0 THEN
          v_early_bonus := FLOOR(
            v_profit::NUMERIC * (v_rules->>'early_bonus_pct')::INT * LEAST(r.early_amount, r.amount)
              / (100 * r.amount)
          )::INT;
        END IF;
        IF r.all_in THEN
          -- Title effects (phase10_title-effects.sql): The 0/8 Powerspike raises the all-in bonus.
          v_all_in_bonus := FLOOR(
            v_profit::NUMERIC * ((v_rules->>'all_in_bonus_pct')::INT + COALESCE(vvv_title_effect(r.user_id, 'all_in_bonus_pct'), 0)) / 100
          )::INT;
        END IF;
      END IF;

      UPDATE bets
      SET status = 'won', payout = v_base + v_early_bonus + v_all_in_bonus, bonus = v_early_bonus + v_all_in_bonus
      WHERE id = r.id;

      PERFORM adjust_balance(r.user_id, v_base, 'bet_won', r.id);
      IF v_early_bonus > 0 THEN
        PERFORM adjust_balance(r.user_id, v_early_bonus, 'bet_early_bonus', r.id);
      END IF;
      IF v_all_in_bonus > 0 THEN
        PERFORM adjust_balance(r.user_id, v_all_in_bonus, 'bet_all_in_bonus', r.id);
      END IF;
      IF r.scheme = 'legacy' AND r.insured THEN
        PERFORM adjust_balance(r.user_id, (v_rules->>'legacy_premium')::INT, 'insurance_refunded', r.id);
      END IF;

      v_winners := v_winners + 1;
      v_bonus_paid := v_bonus_paid + v_early_bonus + v_all_in_bonus;
    ELSE
      v_cover := 0;
      IF r.insured THEN
        v_cover := FLOOR(
          r.amount::NUMERIC
            * CASE WHEN r.scheme = 'v2' THEN r.coverage_pct ELSE (v_rules->>'legacy_coverage_pct')::INT END
            / 100
        )::INT;
      END IF;

      UPDATE bets SET status = 'lost', payout = v_cover WHERE id = r.id;
      IF v_cover > 0 THEN
        PERFORM adjust_balance(r.user_id, v_cover, 'insurance_payout', r.id);
      END IF;

      v_losers := v_losers + 1;
      v_cover_paid := v_cover_paid + v_cover;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'settled', v_count,
    'refunded', false,
    'winner', p_winner_side,
    'total_pool', v_total,
    'winners', v_winners,
    'losers', v_losers,
    'bonus_paid', v_bonus_paid,
    'insurance_paid', v_cover_paid
  );
END;
$$;

CREATE OR REPLACE FUNCTION refund_all_bets_v2(p_session_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
  v_count INTEGER;
BEGIN
  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bet:session_not_found'; END IF;
  IF NOT bet_v2_can_settle(v_session.created_by) THEN RAISE EXCEPTION 'bet:not_authorized'; END IF;
  v_count := bet_v2_refund_pending(p_session_id);
  RETURN jsonb_build_object('refunded', v_count);
END;
$$;

-- ============================================================
-- PRIVILEGES
-- ============================================================

REVOKE EXECUTE ON FUNCTION bet_v2_player_side(UUID, UUID) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION place_bet_v2(UUID, TEXT, INTEGER, BOOLEAN, BOOLEAN, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION place_bet_v2(UUID, TEXT, INTEGER, BOOLEAN, BOOLEAN, INTEGER, INTEGER) TO authenticated;

REVOKE EXECUTE ON FUNCTION insure_bet_v2(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION insure_bet_v2(UUID, INTEGER) TO authenticated;

REVOKE EXECUTE ON FUNCTION resolve_bets_v2(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION resolve_bets_v2(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION refund_all_bets_v2(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION refund_all_bets_v2(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION bet_v2_refund_pending(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION bet_v2_can_settle(UUID) FROM PUBLIC, anon, authenticated;

-- The pre-v2 route inserts bets with the caller's role, so direct inserts stay allowed, but only as a plain pending
-- row on an open window: premiums, coverage, boosts and settled rows can only come from the functions above.
DROP POLICY IF EXISTS "bets_insert" ON bets;
CREATE POLICY "bets_insert" ON bets FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending'
  AND payout IS NULL
  AND scheme = 'legacy'
  AND premium = 0
  AND coverage_pct = 0
  AND early_amount = 0
  AND NOT all_in
  AND bonus = 0
  AND raises = 0
  AND raised_at IS NULL
  AND EXISTS (SELECT 1 FROM game_sessions g WHERE g.id = bets.session_id AND g.status = 'betting')
);

-- bets and game_sessions are already published; kept for completeness on fresh projects.
SELECT vvv_add_to_realtime('bets');
SELECT vvv_add_to_realtime('game_sessions');

-- ============================================================
-- REMEDIATION: phantom insurance from the old "Insure" button
-- ============================================================
-- The old PATCH flow charged 17 points, then tried to flag the bet from the client role, which the
-- bets_update policy (USING false) silently rejected: the premium was taken but the bet stayed uninsured.
-- Honor the legacy terms those users were shown: a lost bet gets 50% of its stake back, a won or refunded
-- bet gets its premium back, a pending bet becomes insured, and duplicate charges are returned.
-- Idempotent: fixed bets are flagged insured and no longer match.
DO $$
DECLARE
  v_rules JSONB := bet_rules_v2();
  v_premium INTEGER := (v_rules->>'legacy_premium')::INT;
  r RECORD;
  v_cover INTEGER;
  v_refund INTEGER;
  v_rows INTEGER;
BEGIN
  FOR r IN
    SELECT b.id, b.user_id, b.amount, b.status, SUM(-t.amount)::INT AS charged
    FROM bets b
    JOIN point_transactions t
      ON t.reference_id = b.id AND t.user_id = b.user_id AND t.reason = 'insurance_bought'
    JOIN point_balances pb ON pb.user_id = b.user_id
    WHERE b.scheme = 'legacy' AND NOT b.insured
      AND NOT EXISTS (
        SELECT 1 FROM point_transactions x
        WHERE x.reference_id = b.id AND x.user_id = b.user_id
          AND x.reason IN ('insurance_refunded', 'insurance_bug_refund', 'insurance_bug_payout')
      )
    GROUP BY b.id, b.user_id, b.amount, b.status
  LOOP
    v_cover := CASE
      WHEN r.status = 'lost' THEN FLOOR(r.amount::NUMERIC * (v_rules->>'legacy_coverage_pct')::INT / 100)::INT
      ELSE 0
    END;
    v_refund := CASE
      WHEN r.status IN ('lost', 'pending') THEN GREATEST(r.charged - v_premium, 0)
      ELSE r.charged
    END;

    UPDATE bets SET insured = true, payout = CASE WHEN r.status = 'lost' THEN v_cover ELSE payout END
    WHERE id = r.id AND status = r.status AND NOT insured;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    CONTINUE WHEN v_rows = 0;

    IF v_cover > 0 THEN PERFORM adjust_balance(r.user_id, v_cover, 'insurance_bug_payout', r.id); END IF;
    IF v_refund > 0 THEN PERFORM adjust_balance(r.user_id, v_refund, 'insurance_bug_refund', r.id); END IF;
  END LOOP;
END $$;

COMMIT;

-- ============================================================
-- phase10_praise.sql
-- ============================================================

-- Phase 10: Sing His Praises. A written praise for Salaxe is worth 100 points, once per day.
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
  reward INTEGER NOT NULL DEFAULT 100 CHECK (reward >= 0),
  praise_day DATE NOT NULL DEFAULT CURRENT_DATE,
  verdict TEXT CHECK (verdict IN ('crowned', 'scorned')),
  verdict_note TEXT CHECK (verdict_note IS NULL OR char_length(verdict_note) BETWEEN 1 AND 140),
  favor INTEGER NOT NULL DEFAULT 0 CHECK (favor >= 0),
  judged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  judged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT praises_verdict_complete CHECK ((verdict IS NULL) = (judged_at IS NULL))
);
ALTER TABLE praises ALTER COLUMN reward SET DEFAULT 100;

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
  v_reward INTEGER;
  v_riddle_bonus INTEGER;
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

  -- King's Riddle (phase10_riddles.sql): today's riddle must be solved first. Skipped while that file is missing.
  IF to_regprocedure('public.praise_riddle_bonus(uuid)') IS NOT NULL THEN
    v_riddle_bonus := praise_riddle_bonus(v_uid);
    IF v_riddle_bonus IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'riddle_required');
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

  v_reward := vvv_title_scaled(v_uid, 'praise_bonus_pct', 100); -- title effects: Last Loyalist, devotion honors

  BEGIN
    INSERT INTO praises (user_id, body, normalized, fingerprint, reward, praise_day)
    VALUES (v_uid, v_body, v_norm, v_fp, v_reward, CURRENT_DATE)
    RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    RETURN jsonb_build_object(
      'ok', false,
      'error', CASE WHEN v_constraint = 'praises_one_per_day' THEN 'already_sung' ELSE 'duplicate' END
    );
  END;

  v_balance := adjust_balance(v_uid, v_reward, 'sing_his_praises', v_row.id);
  -- King's Riddle: the Sharp Mind bonus for a first-try solve, once per day like the praise itself. Titles never
  -- scale it: only the praise reward above carries the title bonus.
  IF v_riddle_bonus > 0 THEN
    v_balance := adjust_balance(v_uid, v_riddle_bonus, 'riddle_bonus', v_row.id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'praise', to_jsonb(v_row) - 'normalized' - 'fingerprint',
    'balance', v_balance,
    'riddle_bonus', coalesce(v_riddle_bonus, 0),
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

-- ============================================================
-- phase10_riddles.sql
-- ============================================================

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
-- where it ends), fills the other cells with decoys, then scrambles the path until the maze is broken again.
-- Always solvable: the laid path is the solution.
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
  v_wrong INTEGER;
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
      v_type := (ARRAY['L', 'L', 'I', 'T', 'T'])[riddle_rand(1, 5)];
      v_solution := v_solution || riddle_rand(0, 3);
    ELSE
      v_type := CASE WHEN v_masks[i] IN (5, 10) THEN 'I' ELSE 'L' END;
      v_solution := v_solution || (SELECT r FROM generate_series(0, 3) r WHERE riddle_tile_mask(v_type, r) = v_masks[i] LIMIT 1);
    END IF;
    v_tiles := v_tiles || v_type;
  END LOOP;

  LOOP
    v_try := v_try + 1;
    v_rot := v_solution;
    FOREACH v_cell IN ARRAY v_path LOOP
      v_rot[v_cell] := riddle_rand(0, 3);
    END LOOP;
    SELECT count(*) INTO v_wrong FROM unnest(v_path) AS c
    WHERE riddle_tile_mask(substr(v_tiles, c, 1), v_rot[c]) <> v_masks[c];
    EXIT WHEN (v_wrong >= least(3, cardinality(v_path)) AND NOT riddle_maze_connected(n, v_tiles, v_rot, v_entry, v_exit))
      OR v_try >= 60;
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

-- ============================================================
-- phase10_duels.sql
-- ============================================================

-- Phase 10: Duels ("Trials by Combat"): 1v1 wagers between users on the result of the current game.
-- Run AFTER phase10_foundation.sql. Additive and idempotent: safe to run while the previous app version is live.
--
-- Rules (mirrored in lib/duels/rules.ts)
--   * A signed-in user challenges another user (named) or the whole court (open) for the current game:
--     "I take Blue for 100". Whoever answers takes the other side for the same stake. Stakes 10..500.
--   * Challenges are thrown during draft, chaos or betting and can be answered until betting closes.
--   * Escrow: the challenger pays when the challenge is thrown, the opponent pays atomically on accept.
--     Declined, withdrawn, unanswered (expired) and canceled duels return every stake.
--   * Players only fight for their own team: nobody can take the side against their own banner.
--   * One live duel per pair per game, one open challenge and at most 3 unanswered challenges per user per game,
--     10 challenges thrown per user per game in total (withdraw-and-rethrow cannot flood the herald).
--   * Settlement: the winner takes the pot (2 x stake) minus the royal tithe, 10% of the winnings
--     (floor(stake * 10%)), which is burned. Status won/lost is the challenger's result; winner_id names the victor.
--   * Balances may go down to the -300 debt floor, like bets.
--   * settle_duels / refund_duels: the session creator or an admin while the game is live; once the session is
--     resolved or canceled anyone may (re)run them, the outcome comes from the database, never from the caller.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.vvv_add_to_realtime(text)') IS NULL THEN
    RAISE EXCEPTION 'Run supabase/phase10_foundation.sql before supabase/phase10_duels.sql';
  END IF;
END $$;

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS duels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  challenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_open BOOLEAN NOT NULL DEFAULT false,
  challenger_side TEXT NOT NULL CHECK (challenger_side IN ('blue', 'red')),
  stake INTEGER NOT NULL CHECK (stake BETWEEN 10 AND 500),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'accepted', 'won', 'lost', 'declined', 'withdrawn', 'expired', 'refunded')),
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_side TEXT CHECK (winner_side IN ('blue', 'red')),
  payout INTEGER CHECK (payout >= 0),
  tax INTEGER NOT NULL DEFAULT 0 CHECK (tax >= 0),
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  CONSTRAINT duels_not_self CHECK (opponent_id IS NULL OR opponent_id <> challenger_id),
  CONSTRAINT duels_named_has_opponent CHECK (is_open OR opponent_id IS NOT NULL),
  CONSTRAINT duels_fought_has_opponent CHECK (status NOT IN ('accepted', 'won', 'lost') OR opponent_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_duels_session ON duels (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_duels_challenger ON duels (challenger_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duels_opponent ON duels (opponent_id, created_at DESC) WHERE opponent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_duels_live ON duels (session_id) WHERE status IN ('open', 'accepted');

-- One live duel per pair per game, whoever challenged whom. Declined or withdrawn challenges free the pair.
CREATE UNIQUE INDEX IF NOT EXISTS idx_duels_one_per_pair
  ON duels (session_id, LEAST(challenger_id, opponent_id), GREATEST(challenger_id, opponent_id))
  WHERE opponent_id IS NOT NULL AND status IN ('open', 'accepted', 'won', 'lost');

-- One open (unnamed) challenge per user per game at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_duels_one_open_call
  ON duels (session_id, challenger_id)
  WHERE is_open AND status = 'open';

-- Public reads: the court duels in the open. Writes only through the functions below.
ALTER TABLE duels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "duels_read" ON duels;
CREATE POLICY "duels_read" ON duels FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON duels FROM anon, authenticated;

-- ============================================================
-- HELPERS
-- ============================================================

CREATE OR REPLACE FUNCTION duel_rules() RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'min_stake', 10,
    'max_stake', 500,
    'tax_pct', 10,
    'max_pending', 3,
    'max_thrown', 10,
    'debt_floor', -300
  )
$$;

-- Challenges are thrown and answered from the draft until betting closes.
CREATE OR REPLACE FUNCTION duel_is_accepting(p_status TEXT, p_betting_ends_at TIMESTAMPTZ) RETURNS BOOLEAN
LANGUAGE sql VOLATILE AS $$
  SELECT COALESCE(
    p_status IN ('draft', 'chaos', 'betting')
      AND NOT (p_status = 'betting' AND p_betting_ends_at IS NOT NULL AND p_betting_ends_at <= clock_timestamp()),
    false
  )
$$;

-- The side a user plays on in this game (through either account link), or NULL for spectators.
CREATE OR REPLACE FUNCTION duel_player_side(p_session_id UUID, p_user_id UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT sa.side
  FROM session_assignments sa
  WHERE sa.session_id = p_session_id
    AND p_user_id IS NOT NULL
    AND (
      sa.player_id IN (SELECT p.id FROM players p WHERE p.auth_user_id = p_user_id)
      OR sa.player_id IN (
        SELECT up.player_id FROM user_profiles up WHERE up.id = p_user_id AND up.player_id IS NOT NULL
      )
    )
  ORDER BY sa.side
  LIMIT 1
$$;

-- Mirrors the session PATCH route: the creator, an admin, or anyone for a session without an owner.
CREATE OR REPLACE FUNCTION duel_can_officiate(p_created_by UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(
    p_created_by IS NULL
      OR p_created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM players WHERE auth_user_id = auth.uid() AND is_admin),
    false
  )
$$;

-- One lock order for every duel function: the game_sessions row, then purses by user id, then duel rows.
-- create_duel holds its purse while its insert may wait on the unique indexes, so anything that updates a
-- duel row and then pays someone must already hold that purse, or a withdrawal racing a new challenge deadlocks.
CREATE OR REPLACE FUNCTION duel_lock_session_purses(p_session_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM 1 FROM point_balances
  WHERE user_id IN (
    SELECT challenger_id FROM duels WHERE session_id = p_session_id AND status IN ('open', 'accepted')
    UNION
    SELECT opponent_id FROM duels
    WHERE session_id = p_session_id AND status IN ('open', 'accepted') AND opponent_id IS NOT NULL
  )
  ORDER BY user_id
  FOR UPDATE;
  PERFORM 1 FROM duels WHERE session_id = p_session_id AND status IN ('open', 'accepted') ORDER BY id FOR UPDATE;
END;
$$;

-- Unanswered challenges go home.
CREATE OR REPLACE FUNCTION duel_expire_open(p_session_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  r duels%ROWTYPE;
  v_count INTEGER := 0;
  v_total INTEGER := 0;
  v_users UUID[] := '{}';
BEGIN
  PERFORM duel_lock_session_purses(p_session_id);
  FOR r IN SELECT * FROM duels WHERE session_id = p_session_id AND status = 'open' ORDER BY created_at, id LOOP
    UPDATE duels SET status = 'expired', settled_at = now() WHERE id = r.id;
    PERFORM adjust_balance(r.challenger_id, r.stake, 'duel_refunded', r.id);
    v_count := v_count + 1;
    v_total := v_total + r.stake;
    IF NOT r.challenger_id = ANY (v_users) THEN
      v_users := v_users || r.challenger_id;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('expired', v_count, 'expired_total', v_total, 'expired_user_ids', to_jsonb(v_users));
END;
$$;

CREATE OR REPLACE FUNCTION duel_settle_accepted(p_session_id UUID, p_winner_side TEXT, p_game_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_rules JSONB := duel_rules();
  v_expired JSONB;
  r duels%ROWTYPE;
  v_winner UUID;
  v_loser UUID;
  v_pot INTEGER;
  v_tax INTEGER;
  v_settled JSONB := '[]'::jsonb;
BEGIN
  PERFORM duel_lock_session_purses(p_session_id);
  v_expired := duel_expire_open(p_session_id);

  FOR r IN SELECT * FROM duels WHERE session_id = p_session_id AND status = 'accepted' ORDER BY created_at, id LOOP
    v_winner := CASE WHEN r.challenger_side = p_winner_side THEN r.challenger_id ELSE r.opponent_id END;
    v_loser := CASE WHEN v_winner = r.challenger_id THEN r.opponent_id ELSE r.challenger_id END;
    v_pot := r.stake * 2;
    v_tax := vvv_title_duel_tithe(v_winner, r.stake, (v_rules->>'tax_pct')::INT); -- title effects: El Goblino Pequeno

    UPDATE duels SET
      status = CASE WHEN v_winner = r.challenger_id THEN 'won' ELSE 'lost' END,
      winner_id = v_winner,
      winner_side = p_winner_side,
      payout = v_pot - v_tax,
      tax = v_tax,
      game_id = p_game_id,
      settled_at = now()
    WHERE id = r.id;

    PERFORM adjust_balance(v_winner, v_pot, 'duel_won', r.id);
    IF v_tax > 0 THEN
      PERFORM adjust_balance(v_winner, -v_tax, 'duel_tax', r.id);
    END IF;
    PERFORM vvv_title_duel_consolation(v_loser, r.stake, r.id); -- title effects: Delayed Victory Specialist

    v_settled := v_settled || jsonb_build_array(jsonb_build_object(
      'id', r.id,
      'challenger_id', r.challenger_id,
      'opponent_id', r.opponent_id,
      'winner_id', v_winner,
      'loser_id', v_loser,
      'stake', r.stake,
      'payout', v_pot - v_tax,
      'tax', v_tax
    ));
  END LOOP;

  RETURN jsonb_build_object('action', 'settled', 'winner_side', p_winner_side, 'settled', v_settled) || v_expired;
END;
$$;

CREATE OR REPLACE FUNCTION duel_refund_all(p_session_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_expired JSONB;
  r duels%ROWTYPE;
  v_count INTEGER := 0;
BEGIN
  PERFORM duel_lock_session_purses(p_session_id);
  v_expired := duel_expire_open(p_session_id);

  FOR r IN SELECT * FROM duels WHERE session_id = p_session_id AND status = 'accepted' ORDER BY created_at, id LOOP
    UPDATE duels SET status = 'refunded', settled_at = now() WHERE id = r.id;
    PERFORM adjust_balance(r.challenger_id, r.stake, 'duel_refunded', r.id);
    PERFORM adjust_balance(r.opponent_id, r.stake, 'duel_refunded', r.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('action', 'refunded', 'refunded', v_count) || v_expired;
END;
$$;

-- ============================================================
-- THROW DOWN THE GAUNTLET
-- ============================================================

CREATE OR REPLACE FUNCTION create_duel(
  p_session_id UUID,
  p_side TEXT,
  p_stake INTEGER,
  p_opponent_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user UUID := auth.uid();
  v_rules JSONB := duel_rules();
  v_session game_sessions%ROWTYPE;
  v_my_side TEXT;
  v_their_side TEXT;
  v_balance INTEGER;
  v_pending INTEGER;
  v_thrown INTEGER;
  v_duel duels%ROWTYPE;
  v_constraint TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'duel:not_authenticated'; END IF;
  IF p_side IS NULL OR p_side NOT IN ('blue', 'red') THEN RAISE EXCEPTION 'duel:invalid_side'; END IF;
  IF p_stake IS NULL OR p_stake < (v_rules->>'min_stake')::INT OR p_stake > (v_rules->>'max_stake')::INT THEN
    RAISE EXCEPTION 'duel:invalid_stake';
  END IF;
  IF p_opponent_id IS NOT NULL AND p_opponent_id = v_user THEN RAISE EXCEPTION 'duel:self'; END IF;

  -- Share lock: phase transitions wait for in-flight challenges, so none slips in after the gates close.
  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'duel:session_not_found'; END IF;
  IF NOT duel_is_accepting(v_session.status, v_session.betting_ends_at) THEN RAISE EXCEPTION 'duel:closed'; END IF;

  v_my_side := duel_player_side(p_session_id, v_user);
  IF v_my_side IS NOT NULL AND v_my_side <> p_side THEN RAISE EXCEPTION 'duel:treason'; END IF;

  IF p_opponent_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM point_balances WHERE user_id = p_opponent_id) THEN
      RAISE EXCEPTION 'duel:opponent_unavailable';
    END IF;
    v_their_side := duel_player_side(p_session_id, p_opponent_id);
    IF v_their_side IS NOT NULL AND v_their_side = p_side THEN RAISE EXCEPTION 'duel:opponent_treason'; END IF;
  END IF;

  -- Locking the purse first serializes concurrent challenges from the same user (limits and balance).
  SELECT balance INTO v_balance FROM point_balances WHERE user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'duel:no_balance'; END IF;

  SELECT count(*) FILTER (WHERE status = 'open'), count(*) INTO v_pending, v_thrown
  FROM duels WHERE session_id = p_session_id AND challenger_id = v_user;
  IF v_pending >= (v_rules->>'max_pending')::INT THEN RAISE EXCEPTION 'duel:too_many_pending'; END IF;
  IF v_thrown >= (v_rules->>'max_thrown')::INT THEN RAISE EXCEPTION 'duel:too_many_thrown'; END IF;

  IF v_balance - p_stake < (v_rules->>'debt_floor')::INT THEN RAISE EXCEPTION 'duel:debt_limit'; END IF;

  BEGIN
    INSERT INTO duels (session_id, challenger_id, opponent_id, is_open, challenger_side, stake)
    VALUES (p_session_id, v_user, p_opponent_id, p_opponent_id IS NULL, p_side, p_stake)
    RETURNING * INTO v_duel;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'idx_duels_one_open_call' THEN RAISE EXCEPTION 'duel:open_exists'; END IF;
    RAISE EXCEPTION 'duel:pair_exists';
  END;

  v_balance := adjust_balance(v_user, -p_stake, 'duel_stake', v_duel.id);
  RETURN jsonb_build_object('duel', to_jsonb(v_duel), 'balance', v_balance);
END;
$$;

-- ============================================================
-- ANSWER, DECLINE, WITHDRAW
-- ============================================================

CREATE OR REPLACE FUNCTION accept_duel(p_duel_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user UUID := auth.uid();
  v_rules JSONB := duel_rules();
  v_session_id UUID;
  v_session game_sessions%ROWTYPE;
  v_duel duels%ROWTYPE;
  v_balance INTEGER;
  v_has_purse BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'duel:not_authenticated'; END IF;

  SELECT session_id INTO v_session_id FROM duels WHERE id = p_duel_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'duel:not_found'; END IF;

  -- Session, then purse, then the duel row (see duel_lock_session_purses).
  SELECT * INTO v_session FROM game_sessions WHERE id = v_session_id FOR SHARE;
  SELECT balance INTO v_balance FROM point_balances WHERE user_id = v_user FOR UPDATE;
  v_has_purse := FOUND;
  SELECT * INTO v_duel FROM duels WHERE id = p_duel_id FOR UPDATE;

  IF v_duel.status <> 'open' THEN
    IF v_duel.status = 'accepted' AND v_duel.is_open AND v_duel.opponent_id <> v_user THEN
      RAISE EXCEPTION 'duel:taken';
    END IF;
    RAISE EXCEPTION 'duel:not_open';
  END IF;
  IF NOT duel_is_accepting(v_session.status, v_session.betting_ends_at) THEN RAISE EXCEPTION 'duel:closed'; END IF;
  IF v_duel.challenger_id = v_user THEN RAISE EXCEPTION 'duel:self'; END IF;
  IF NOT v_duel.is_open AND v_duel.opponent_id IS DISTINCT FROM v_user THEN RAISE EXCEPTION 'duel:not_yours'; END IF;
  IF duel_player_side(v_session_id, v_user) = v_duel.challenger_side THEN RAISE EXCEPTION 'duel:treason'; END IF;
  IF NOT v_has_purse THEN RAISE EXCEPTION 'duel:no_balance'; END IF;
  IF v_balance - v_duel.stake < (v_rules->>'debt_floor')::INT THEN RAISE EXCEPTION 'duel:debt_limit'; END IF;

  BEGIN
    UPDATE duels SET status = 'accepted', opponent_id = v_user, responded_at = now()
    WHERE id = p_duel_id
    RETURNING * INTO v_duel;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'duel:pair_exists';
  END;

  v_balance := adjust_balance(v_user, -v_duel.stake, 'duel_stake', v_duel.id);
  RETURN jsonb_build_object('duel', to_jsonb(v_duel), 'balance', v_balance);
END;
$$;

-- The named opponent refuses: the challenger's stake goes home.
CREATE OR REPLACE FUNCTION decline_duel(p_duel_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user UUID := auth.uid();
  v_challenger UUID;
  v_duel duels%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'duel:not_authenticated'; END IF;

  -- The challenger never changes: lock the purse being refunded before the duel row.
  SELECT challenger_id INTO v_challenger FROM duels WHERE id = p_duel_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'duel:not_found'; END IF;
  PERFORM 1 FROM point_balances WHERE user_id = v_challenger FOR UPDATE;

  SELECT * INTO v_duel FROM duels WHERE id = p_duel_id FOR UPDATE;
  IF v_duel.status <> 'open' THEN RAISE EXCEPTION 'duel:not_open'; END IF;
  IF v_duel.is_open OR v_duel.opponent_id IS DISTINCT FROM v_user THEN RAISE EXCEPTION 'duel:not_yours'; END IF;

  UPDATE duels SET status = 'declined', responded_at = now(), settled_at = now()
  WHERE id = p_duel_id
  RETURNING * INTO v_duel;
  PERFORM adjust_balance(v_duel.challenger_id, v_duel.stake, 'duel_refunded', v_duel.id);

  RETURN jsonb_build_object('duel', to_jsonb(v_duel));
END;
$$;

-- The challenger takes an unanswered challenge back.
CREATE OR REPLACE FUNCTION withdraw_duel(p_duel_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user UUID := auth.uid();
  v_duel duels%ROWTYPE;
  v_balance INTEGER;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'duel:not_authenticated'; END IF;

  PERFORM 1 FROM point_balances WHERE user_id = v_user FOR UPDATE;
  SELECT * INTO v_duel FROM duels WHERE id = p_duel_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'duel:not_found'; END IF;
  IF v_duel.challenger_id <> v_user THEN RAISE EXCEPTION 'duel:not_yours'; END IF;
  IF v_duel.status <> 'open' THEN RAISE EXCEPTION 'duel:not_open'; END IF;

  UPDATE duels SET status = 'withdrawn', responded_at = now(), settled_at = now()
  WHERE id = p_duel_id
  RETURNING * INTO v_duel;
  v_balance := adjust_balance(v_user, v_duel.stake, 'duel_refunded', v_duel.id);

  RETURN jsonb_build_object('duel', to_jsonb(v_duel), 'balance', v_balance);
END;
$$;

-- ============================================================
-- SETTLEMENT
-- ============================================================

-- Declare-winner hook (session still in_game: creator or admin, game row linked and matching), or a lazy
-- repair once the session is resolved (anyone, winner taken from the status). Idempotent: only live rows move.
CREATE OR REPLACE FUNCTION settle_duels(p_session_id UUID, p_winner_side TEXT, p_game_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
  v_resolved_side TEXT;
BEGIN
  IF p_winner_side IS NULL OR p_winner_side NOT IN ('blue', 'red') THEN RAISE EXCEPTION 'duel:invalid_side'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'duel:session_not_found'; END IF;

  IF v_session.status = 'in_game' THEN
    IF NOT duel_can_officiate(v_session.created_by) THEN RAISE EXCEPTION 'duel:not_authorized'; END IF;
    IF p_game_id IS NULL OR v_session.game_id IS DISTINCT FROM p_game_id THEN RAISE EXCEPTION 'duel:invalid_state'; END IF;
    IF NOT EXISTS (SELECT 1 FROM games WHERE id = p_game_id AND winner_side = p_winner_side) THEN
      RAISE EXCEPTION 'duel:invalid_state';
    END IF;
  ELSIF v_session.status IN ('blue_win', 'red_win') THEN
    v_resolved_side := CASE WHEN v_session.status = 'blue_win' THEN 'blue' ELSE 'red' END;
    IF p_winner_side <> v_resolved_side THEN RAISE EXCEPTION 'duel:invalid_state'; END IF;
  ELSE
    RAISE EXCEPTION 'duel:invalid_state';
  END IF;

  RETURN duel_settle_accepted(p_session_id, p_winner_side, v_session.game_id);
END;
$$;

-- Cancel hook: every stake goes home. Runs after the status flipped to canceled (anyone may repeat it);
-- on a live game only the creator or an admin can void the duels.
CREATE OR REPLACE FUNCTION refund_duels(p_session_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'duel:session_not_found'; END IF;
  IF v_session.status IN ('blue_win', 'red_win') THEN RAISE EXCEPTION 'duel:already_resolved'; END IF;
  IF v_session.status NOT IN ('canceled', 'expired') AND NOT duel_can_officiate(v_session.created_by) THEN
    RAISE EXCEPTION 'duel:not_authorized';
  END IF;
  RETURN duel_refund_all(p_session_id);
END;
$$;

-- Lazy upkeep any signed-in reader may trigger; it only does what the session state dictates:
-- expire unanswered challenges once the gates closed, finish a settlement or a refund a hook left behind.
CREATE OR REPLACE FUNCTION sweep_duels(p_session_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'duel:not_authenticated'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'duel:session_not_found'; END IF;
  IF duel_is_accepting(v_session.status, v_session.betting_ends_at) THEN
    RETURN jsonb_build_object('action', 'none');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM duels WHERE session_id = p_session_id AND status IN ('open', 'accepted')) THEN
    RETURN jsonb_build_object('action', 'none');
  END IF;

  IF v_session.status IN ('blue_win', 'red_win') THEN
    SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
    RETURN duel_settle_accepted(
      p_session_id,
      CASE WHEN v_session.status = 'blue_win' THEN 'blue' ELSE 'red' END,
      v_session.game_id
    );
  ELSIF v_session.status IN ('canceled', 'expired') THEN
    SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
    RETURN duel_refund_all(p_session_id);
  END IF;

  RETURN jsonb_build_object('action', 'expired') || duel_expire_open(p_session_id);
END;
$$;

-- Repairs stakes stranded on games that are over: a settle or refund hook that failed twice, on a game whose
-- board nobody opened afterwards (a canceled game never shows one). The next game's board runs this.
CREATE OR REPLACE FUNCTION sweep_stale_duels() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_session_id UUID;
  v_results JSONB := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'duel:not_authenticated'; END IF;

  FOR v_session_id IN
    SELECT DISTINCT d.session_id
    FROM duels d
    JOIN game_sessions s ON s.id = d.session_id
    WHERE d.status IN ('open', 'accepted') AND s.status IN ('blue_win', 'red_win', 'canceled', 'expired')
    LIMIT 5
  LOOP
    v_results := v_results || jsonb_build_array(sweep_duels(v_session_id) || jsonb_build_object('session_id', v_session_id));
  END LOOP;
  RETURN v_results;
END;
$$;

-- ============================================================
-- PRIVILEGES
-- ============================================================

REVOKE EXECUTE ON FUNCTION create_duel(UUID, TEXT, INTEGER, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_duel(UUID, TEXT, INTEGER, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION accept_duel(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION accept_duel(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION decline_duel(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION decline_duel(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION withdraw_duel(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION withdraw_duel(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION settle_duels(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION settle_duels(UUID, TEXT, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION refund_duels(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION refund_duels(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION sweep_duels(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sweep_duels(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION sweep_stale_duels() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sweep_stale_duels() TO authenticated;

REVOKE EXECUTE ON FUNCTION duel_lock_session_purses(UUID) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION duel_player_side(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION duel_can_officiate(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION duel_expire_open(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION duel_settle_accepted(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION duel_refund_all(UUID) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- REALTIME
-- ============================================================

SELECT vvv_add_to_realtime('duels');

COMMIT;

-- ============================================================
-- phase10_bounties-shame.sql
-- ============================================================

-- Phase 10: Royal Warrants (stacking bounties) and the Pillory (the shame board, cheap and loud).
-- Run AFTER phase10_foundation.sql. Additive and idempotent: safe to run (and re-run) while the previous app
-- version is live. The legacy bounties table, its resolve_bounties() function and the legacy shame_entries
-- inserts keep working exactly as before.
--
-- Royal Warrants (mirrored in lib/bounties/rules.ts)
--   * Anyone can price a player's head: 20+ points per pledge, at most 500 per backer on one warrant.
--     Pledges on the same target stack on a single open warrant.
--   * The wanted player loses a game: the linked members of the team that beat them split the whole price
--     equally (leftover points go to the first hunters in lane order). Nobody linked on that team: it stays up.
--   * The wanted player wins: an escape. The warrant stays up and the Crown adds 15% of the pledges
--     (5 to 25 per escape, the Crown never adds more than the pledges themselves).
--   * A warrant lives 7 days after its last pledge. Unclaimed at the deadline: every backer gets their pledge
--     back and the Crown's bonus returns to the treasury.
--   * Only a game recorded after the warrant opened can settle it, a game settles a warrant at most once, and
--     only inside that game's declaration (by the user declaring it).
--   * A wanted player deleted from the roster: every backer gets their pledge back.
--   * Legacy bounties (one poster, 1.5x back to the poster) keep their terms; expired ones are refunded.
--
-- The Pillory
--   * 40 points nails a player to the wall for 24 hours with their worst real stat and a roast.
--   * One live entry per target, one post per shamer every 6 hours.
--   * Eggs are free, one per person per entry; each keeps the entry up one more hour (12 at most).
--   * The Tribunal's Inter verdict pillories the voted player for free, once per vote.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.vvv_add_to_realtime(text)') IS NULL THEN
    RAISE EXCEPTION 'Run supabase/phase10_foundation.sql before supabase/phase10_bounties-shame.sql';
  END IF;
END $$;

-- Repeated from the foundation so this file never depends on the old reason CHECK list.
ALTER TABLE point_transactions DROP CONSTRAINT IF EXISTS point_transactions_reason_check;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'point_transactions_reason_format') THEN
    ALTER TABLE point_transactions ADD CONSTRAINT point_transactions_reason_format
      CHECK (reason ~ '^[a-z][a-z0-9_]{1,48}$');
  END IF;
END $$;

-- ============================================================
-- RULES
-- ============================================================

CREATE OR REPLACE FUNCTION bounty_rules() RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'min_pledge', 20,
    'max_backer_total', 500,
    'lifetime_days', 7,
    'escape_pct', 15,
    'escape_min', 5,
    'escape_max', 25,
    'debt_floor', -300
  )
$$;

CREATE OR REPLACE FUNCTION pillory_rules() RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'cost', 40,
    'hours', 24,
    'cooldown_hours', 6,
    'message_max', 140,
    'egg_hours', 1,
    'egg_max_hours', 12,
    'debt_floor', -300
  )
$$;

-- The account behind a player: their own link first, then a profile that claimed them.
CREATE OR REPLACE FUNCTION vvv_bounty_account(p_player_id UUID) RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT auth_user_id FROM players WHERE id = p_player_id),
    (SELECT id FROM user_profiles WHERE player_id = p_player_id ORDER BY created_at LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION vvv_bounty_is_self(p_user_id UUID, p_player_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user_id IS NOT NULL AND p_player_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM players WHERE id = p_player_id AND auth_user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = p_user_id AND player_id = p_player_id)
  )
$$;

-- Every writer of a target's warrant takes this lock before any balance or warrant row, so pledges, the
-- expiry sweep and settlement serialize per target instead of racing on its warrant.
CREATE OR REPLACE FUNCTION vvv_bounty_lock_key(p_player_id UUID) RETURNS BIGINT
LANGUAGE sql IMMUTABLE AS $$
  SELECT hashtextextended('vvv_bounty:' || p_player_id::text, 0)
$$;

-- ============================================================
-- WARRANT TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS bounty_warrants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'expired')),
  pledged INTEGER NOT NULL DEFAULT 0 CHECK (pledged >= 0),
  crown_bonus INTEGER NOT NULL DEFAULT 0 CHECK (crown_bonus >= 0),
  escapes INTEGER NOT NULL DEFAULT 0 CHECK (escapes >= 0),
  opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_pledge_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  claimed_session_id UUID REFERENCES game_sessions(id) ON DELETE SET NULL,
  payout INTEGER NOT NULL DEFAULT 0 CHECK (payout >= 0),
  hunters JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bounty_warrants_one_open ON bounty_warrants(target_player_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_bounty_warrants_expiry ON bounty_warrants(expires_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_bounty_warrants_closed ON bounty_warrants(closed_at DESC) WHERE status <> 'open';

CREATE TABLE IF NOT EXISTS bounty_pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warrant_id UUID NOT NULL REFERENCES bounty_warrants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pledged' CHECK (status IN ('pledged', 'paid_out', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (warrant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bounty_pledges_user ON bounty_pledges(user_id, created_at DESC);

-- One row per warrant and settled game: makes settlement idempotent and keeps the chase history.
CREATE TABLE IF NOT EXISTS bounty_outcomes (
  warrant_id UUID NOT NULL REFERENCES bounty_warrants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('claimed', 'escaped', 'unclaimed')),
  bonus INTEGER NOT NULL DEFAULT 0 CHECK (bonus >= 0),
  payout INTEGER NOT NULL DEFAULT 0 CHECK (payout >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (warrant_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_bounty_outcomes_session ON bounty_outcomes(session_id);

ALTER TABLE bounty_warrants ENABLE ROW LEVEL SECURITY;
ALTER TABLE bounty_pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE bounty_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bounty_warrants_read" ON bounty_warrants;
CREATE POLICY "bounty_warrants_read" ON bounty_warrants FOR SELECT USING (true);
DROP POLICY IF EXISTS "bounty_pledges_read" ON bounty_pledges;
CREATE POLICY "bounty_pledges_read" ON bounty_pledges FOR SELECT USING (true);
DROP POLICY IF EXISTS "bounty_outcomes_read" ON bounty_outcomes;
CREATE POLICY "bounty_outcomes_read" ON bounty_outcomes FOR SELECT USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON bounty_warrants, bounty_pledges, bounty_outcomes FROM anon, authenticated;

-- Deleting a wanted player from the roster cascades to their warrant: every backer gets their pledge back first.
CREATE OR REPLACE FUNCTION vvv_bounty_refund_on_delete() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pledge RECORD;
BEGIN
  IF OLD.status = 'open' THEN
    FOR v_pledge IN
      SELECT user_id, amount FROM bounty_pledges WHERE warrant_id = OLD.id AND status = 'pledged' ORDER BY created_at
    LOOP
      IF EXISTS (SELECT 1 FROM point_balances WHERE user_id = v_pledge.user_id) THEN
        PERFORM adjust_balance(v_pledge.user_id, v_pledge.amount, 'bounty_expired_refund', OLD.id);
      END IF;
    END LOOP;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_bounty_warrants_refund ON bounty_warrants;
CREATE TRIGGER trg_bounty_warrants_refund BEFORE DELETE ON bounty_warrants
  FOR EACH ROW EXECUTE FUNCTION vvv_bounty_refund_on_delete();

-- ============================================================
-- PLEDGE (open a warrant or add to the open one)
-- ============================================================

-- Closes one open warrant at its deadline: every backer gets their pledge back. Internal.
CREATE OR REPLACE FUNCTION vvv_bounty_expire(p_warrant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_warrant bounty_warrants%ROWTYPE;
  v_pledge bounty_pledges%ROWTYPE;
  v_refunded INTEGER := 0;
  v_backers INTEGER := 0;
BEGIN
  SELECT * INTO v_warrant FROM bounty_warrants WHERE id = p_warrant_id FOR UPDATE;
  IF NOT FOUND OR v_warrant.status <> 'open' OR v_warrant.expires_at > now() THEN
    RETURN NULL;
  END IF;

  FOR v_pledge IN
    SELECT * FROM bounty_pledges WHERE warrant_id = p_warrant_id AND status = 'pledged' ORDER BY created_at FOR UPDATE
  LOOP
    UPDATE bounty_pledges SET status = 'refunded', updated_at = now() WHERE id = v_pledge.id;
    -- A treasury that no longer exists must not block every later sweep.
    IF EXISTS (SELECT 1 FROM point_balances WHERE user_id = v_pledge.user_id) THEN
      PERFORM adjust_balance(v_pledge.user_id, v_pledge.amount, 'bounty_expired_refund', p_warrant_id);
      v_refunded := v_refunded + v_pledge.amount;
      v_backers := v_backers + 1;
    END IF;
  END LOOP;

  UPDATE bounty_warrants SET status = 'expired', closed_at = now() WHERE id = p_warrant_id;

  RETURN jsonb_build_object(
    'warrant_id', p_warrant_id,
    'target_player_id', v_warrant.target_player_id,
    'target_name', (SELECT name FROM players WHERE id = v_warrant.target_player_id),
    'target_user_id', vvv_bounty_account(v_warrant.target_player_id),
    'refunded', v_refunded,
    'backers', v_backers,
    'escapes', v_warrant.escapes
  );
END;
$$;

CREATE OR REPLACE FUNCTION bounty_pledge(p_target_player_id UUID, p_amount INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_rules JSONB := bounty_rules();
  v_target players%ROWTYPE;
  v_balance INTEGER;
  v_warrant bounty_warrants%ROWTYPE;
  v_created BOOLEAN := false;
  v_mine INTEGER := 0;
  v_expired JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'bounty:not_authenticated'; END IF;
  IF p_amount IS NULL OR p_amount < (v_rules->>'min_pledge')::INT THEN RAISE EXCEPTION 'bounty:amount_too_small'; END IF;
  IF p_amount > (v_rules->>'max_backer_total')::INT THEN RAISE EXCEPTION 'bounty:amount_too_large'; END IF;

  SELECT * INTO v_target FROM players WHERE id = p_target_player_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'bounty:target_not_found'; END IF;
  IF NOT v_target.is_active THEN RAISE EXCEPTION 'bounty:target_inactive'; END IF;
  IF vvv_bounty_is_self(v_uid, p_target_player_id) THEN RAISE EXCEPTION 'bounty:self'; END IF;

  -- Serializes every pledge on this target (two first pledges cannot open two warrants).
  PERFORM pg_advisory_xact_lock(vvv_bounty_lock_key(p_target_player_id));

  -- Locking the balance first serializes concurrent requests from the same user.
  SELECT balance INTO v_balance FROM point_balances WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bounty:no_balance'; END IF;
  IF v_balance - p_amount < (v_rules->>'debt_floor')::INT THEN RAISE EXCEPTION 'bounty:debt_limit'; END IF;

  SELECT * INTO v_warrant FROM bounty_warrants
  WHERE target_player_id = p_target_player_id AND status = 'open'
  FOR UPDATE;

  IF FOUND AND v_warrant.expires_at <= now() THEN
    v_expired := vvv_bounty_expire(v_warrant.id);
    SELECT balance INTO v_balance FROM point_balances WHERE user_id = v_uid;
    v_warrant := NULL;
  END IF;

  IF v_warrant.id IS NULL THEN
    INSERT INTO bounty_warrants (target_player_id, opened_by, expires_at)
    VALUES (p_target_player_id, v_uid, now() + make_interval(days => (v_rules->>'lifetime_days')::INT))
    RETURNING * INTO v_warrant;
    v_created := true;
  END IF;

  SELECT amount INTO v_mine FROM bounty_pledges WHERE warrant_id = v_warrant.id AND user_id = v_uid FOR UPDATE;
  v_mine := COALESCE(v_mine, 0);
  IF v_mine + p_amount > (v_rules->>'max_backer_total')::INT THEN RAISE EXCEPTION 'bounty:backer_cap'; END IF;

  INSERT INTO bounty_pledges (warrant_id, user_id, amount)
  VALUES (v_warrant.id, v_uid, p_amount)
  ON CONFLICT (warrant_id, user_id)
  DO UPDATE SET amount = bounty_pledges.amount + EXCLUDED.amount, updated_at = now();

  UPDATE bounty_warrants
  SET pledged = pledged + p_amount,
      last_pledge_at = now(),
      expires_at = GREATEST(expires_at, now() + make_interval(days => (v_rules->>'lifetime_days')::INT))
  WHERE id = v_warrant.id
  RETURNING * INTO v_warrant;

  PERFORM adjust_balance(v_uid, -p_amount, 'bounty_placed', v_warrant.id);

  RETURN jsonb_build_object(
    'warrant', to_jsonb(v_warrant),
    'created', v_created,
    'pledged', p_amount,
    'mine', v_mine + p_amount,
    'price', v_warrant.pledged + v_warrant.crown_bonus,
    'backers', (SELECT count(*) FROM bounty_pledges WHERE warrant_id = v_warrant.id),
    'target_name', v_target.name,
    'target_user_id', vvv_bounty_account(p_target_player_id),
    'balance', v_balance - p_amount,
    'expired', v_expired
  );
END;
$$;

-- ============================================================
-- EXPIRY SWEEP (lazy: run by any read of the board)
-- ============================================================

CREATE OR REPLACE FUNCTION bounty_sweep() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
  v_target UUID;
  v_result JSONB;
  v_expired JSONB := '[]'::jsonb;
  v_legacy RECORD;
  v_legacy_count INTEGER := 0;
BEGIN
  FOR v_id, v_target IN
    SELECT id, target_player_id FROM bounty_warrants
    WHERE status = 'open' AND expires_at <= now()
    ORDER BY expires_at
    LIMIT 25
  LOOP
    -- Busy target: a pledge or a settlement is on it right now; the next read sweeps it.
    CONTINUE WHEN NOT pg_try_advisory_xact_lock(vvv_bounty_lock_key(v_target));
    v_result := vvv_bounty_expire(v_id);
    IF v_result IS NOT NULL THEN v_expired := v_expired || jsonb_build_array(v_result); END IF;
  END LOOP;

  -- Legacy bounties never refunded at their deadline; they promised to expire, so they return the stake.
  FOR v_legacy IN
    SELECT * FROM bounties
    WHERE status = 'active' AND expires_at <= now()
    ORDER BY expires_at
    LIMIT 25
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE bounties SET status = 'expired' WHERE id = v_legacy.id AND status = 'active';
    IF FOUND AND EXISTS (SELECT 1 FROM point_balances WHERE user_id = v_legacy.poster_user_id) THEN
      PERFORM adjust_balance(v_legacy.poster_user_id, v_legacy.amount, 'bounty_expired_refund', v_legacy.id);
      v_legacy_count := v_legacy_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('expired', v_expired, 'legacy_refunded', v_legacy_count);
END;
$$;

-- ============================================================
-- SETTLEMENT (declare_winner hook; idempotent, derived only from the recorded game)
-- ============================================================

CREATE OR REPLACE FUNCTION bounty_settle_session(p_session_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rules JSONB := bounty_rules();
  v_session game_sessions%ROWTYPE;
  v_game games%ROWTYPE;
  v_row RECORD;
  v_warrant bounty_warrants%ROWTYPE;
  v_hunters JSONB;
  v_count INTEGER;
  v_pot INTEGER;
  v_share INTEGER;
  v_extra INTEGER;
  v_amount INTEGER;
  v_hunter JSONB;
  v_index INTEGER;
  v_paid JSONB;
  v_bonus INTEGER;
  v_claimed JSONB := '[]'::jsonb;
  v_escaped JSONB := '[]'::jsonb;
  v_unclaimed JSONB := '[]'::jsonb;
  v_legacy_claimed JSONB := '[]'::jsonb;
  v_legacy_failed INTEGER := 0;
  v_payout INTEGER;
  v_target UUID;
BEGIN
  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('settled', false, 'reason', 'session_not_found'); END IF;
  -- Only inside a declaration (game linked, status still in_game: it flips last) and only for the user holding
  -- it, so nobody can replay an old game later to collect a warrant that has grown since.
  IF v_session.game_id IS NULL OR v_session.status <> 'in_game' THEN
    RETURN jsonb_build_object('settled', false, 'reason', 'no_game');
  END IF;
  IF auth.uid() IS NOT NULL AND v_session.resolved_by IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('settled', false, 'reason', 'not_resolver');
  END IF;

  SELECT * INTO v_game FROM games WHERE id = v_session.game_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('settled', false, 'reason', 'no_game'); END IF;

  -- Target locks first, in a fixed order, before any balance moves.
  FOR v_target IN
    SELECT DISTINCT w.target_player_id
    FROM bounty_warrants w
    JOIN game_players gp ON gp.game_id = v_game.id AND gp.player_id = w.target_player_id
    WHERE w.status = 'open'
    ORDER BY 1
  LOOP
    PERFORM pg_advisory_xact_lock(vvv_bounty_lock_key(v_target));
  END LOOP;

  FOR v_row IN
    SELECT w.id, gp.side AS target_side
    FROM bounty_warrants w
    JOIN game_players gp ON gp.game_id = v_game.id AND gp.player_id = w.target_player_id
    WHERE w.status = 'open'
      AND w.opened_at < v_game.played_at
      AND NOT EXISTS (SELECT 1 FROM bounty_outcomes o WHERE o.warrant_id = w.id AND o.session_id = p_session_id)
    ORDER BY w.opened_at
  LOOP
    SELECT * INTO v_warrant FROM bounty_warrants WHERE id = v_row.id FOR UPDATE;
    CONTINUE WHEN v_warrant.status <> 'open'
      OR EXISTS (SELECT 1 FROM bounty_outcomes o WHERE o.warrant_id = v_warrant.id AND o.session_id = p_session_id);

    IF v_row.target_side = v_game.winner_side THEN
      v_bonus := LEAST(
        GREATEST((v_rules->>'escape_min')::INT, FLOOR(v_warrant.pledged::NUMERIC * (v_rules->>'escape_pct')::INT / 100)::INT),
        (v_rules->>'escape_max')::INT,
        GREATEST(v_warrant.pledged - v_warrant.crown_bonus, 0)
      );
      UPDATE bounty_warrants SET escapes = escapes + 1, crown_bonus = crown_bonus + v_bonus
      WHERE id = v_warrant.id
      RETURNING * INTO v_warrant;
      INSERT INTO bounty_outcomes (warrant_id, session_id, outcome, bonus) VALUES (v_warrant.id, p_session_id, 'escaped', v_bonus);
      v_escaped := v_escaped || jsonb_build_array(jsonb_build_object(
        'warrant_id', v_warrant.id,
        'target_player_id', v_warrant.target_player_id,
        'target_name', (SELECT name FROM players WHERE id = v_warrant.target_player_id),
        'target_user_id', vvv_bounty_account(v_warrant.target_player_id),
        'bonus', v_bonus,
        'price', v_warrant.pledged + v_warrant.crown_bonus,
        'escapes', v_warrant.escapes
      ));
      CONTINUE;
    END IF;

    -- The wanted player lost: every linked winner with a treasury is a hunter.
    SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', h.user_id, 'player_id', h.player_id, 'name', h.name) ORDER BY h.lane_rank, h.name), '[]'::jsonb)
    INTO v_hunters
    FROM (
      SELECT DISTINCT ON (a.user_id) a.user_id, a.player_id, a.name, a.lane_rank
      FROM (
        SELECT vvv_bounty_account(gp.player_id) AS user_id, gp.player_id, p.name,
               COALESCE(array_position(ARRAY['top', 'jungle', 'mid', 'adc', 'support'], gp.lane), 9) AS lane_rank
        FROM game_players gp
        JOIN players p ON p.id = gp.player_id
        WHERE gp.game_id = v_game.id AND gp.side = v_game.winner_side
      ) a
      WHERE a.user_id IS NOT NULL AND EXISTS (SELECT 1 FROM point_balances pb WHERE pb.user_id = a.user_id)
      ORDER BY a.user_id, a.lane_rank
    ) h;

    v_count := jsonb_array_length(v_hunters);
    v_pot := v_warrant.pledged + v_warrant.crown_bonus;

    IF v_count = 0 OR v_pot <= 0 THEN
      INSERT INTO bounty_outcomes (warrant_id, session_id, outcome) VALUES (v_warrant.id, p_session_id, 'unclaimed');
      v_unclaimed := v_unclaimed || jsonb_build_array(jsonb_build_object(
        'warrant_id', v_warrant.id,
        'target_name', (SELECT name FROM players WHERE id = v_warrant.target_player_id),
        'price', v_pot
      ));
      CONTINUE;
    END IF;

    v_share := v_pot / v_count;
    v_extra := v_pot - v_share * v_count;
    v_paid := '[]'::jsonb;
    v_index := 0;
    FOR v_hunter IN SELECT value FROM jsonb_array_elements(v_hunters) LOOP
      v_amount := v_share + CASE WHEN v_index < v_extra THEN 1 ELSE 0 END;
      IF v_amount > 0 THEN
        PERFORM adjust_balance((v_hunter->>'user_id')::UUID, v_amount, 'bounty_claimed', p_session_id);
      END IF;
      v_paid := v_paid || jsonb_build_array(v_hunter || jsonb_build_object('share', v_amount));
      v_index := v_index + 1;
    END LOOP;

    UPDATE bounty_pledges SET status = 'paid_out', updated_at = now() WHERE warrant_id = v_warrant.id AND status = 'pledged';
    UPDATE bounty_warrants
    SET status = 'claimed', closed_at = now(), claimed_session_id = p_session_id, payout = v_pot, hunters = v_paid
    WHERE id = v_warrant.id;
    INSERT INTO bounty_outcomes (warrant_id, session_id, outcome, payout) VALUES (v_warrant.id, p_session_id, 'claimed', v_pot);

    v_claimed := v_claimed || jsonb_build_array(jsonb_build_object(
      'warrant_id', v_warrant.id,
      'target_player_id', v_warrant.target_player_id,
      'target_name', (SELECT name FROM players WHERE id = v_warrant.target_player_id),
      'target_user_id', vvv_bounty_account(v_warrant.target_player_id),
      'payout', v_pot,
      'escapes', v_warrant.escapes,
      'backers', (SELECT count(*) FROM bounty_pledges WHERE warrant_id = v_warrant.id),
      'hunters', v_paid
    ));
  END LOOP;

  -- Legacy bounties keep the terms they were posted with (the same as resolve_bounties).
  FOR v_row IN
    SELECT b.id, b.poster_user_id, b.amount, b.payout_multiplier, b.target_player_id, gp.side AS target_side
    FROM bounties b
    JOIN game_players gp ON gp.game_id = v_game.id AND gp.player_id = b.target_player_id
    WHERE b.status = 'active' AND b.expires_at > now() AND b.created_at < v_game.played_at
    ORDER BY b.created_at
    FOR UPDATE OF b
  LOOP
    IF v_row.target_side = v_game.winner_side THEN
      UPDATE bounties SET status = 'failed', resolved_session_id = p_session_id WHERE id = v_row.id;
      v_legacy_failed := v_legacy_failed + 1;
    ELSE
      v_payout := FLOOR(v_row.amount * v_row.payout_multiplier)::INT;
      UPDATE bounties SET status = 'claimed', resolved_session_id = p_session_id WHERE id = v_row.id;
      PERFORM adjust_balance(v_row.poster_user_id, v_payout, 'bounty_claimed', p_session_id);
      v_legacy_claimed := v_legacy_claimed || jsonb_build_array(jsonb_build_object(
        'bounty_id', v_row.id,
        'target_player_id', v_row.target_player_id,
        'target_name', (SELECT name FROM players WHERE id = v_row.target_player_id),
        'target_user_id', vvv_bounty_account(v_row.target_player_id),
        'poster_user_id', v_row.poster_user_id,
        'payout', v_payout
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'settled', true,
    'winner', v_game.winner_side,
    'claimed', v_claimed,
    'escaped', v_escaped,
    'unclaimed', v_unclaimed,
    'legacy_claimed', v_legacy_claimed,
    'legacy_failed', v_legacy_failed
  );
END;
$$;

-- ============================================================
-- PILLORY (extends shame_entries; legacy rows read as before)
-- ============================================================

ALTER TABLE shame_entries ALTER COLUMN shamer_user_id DROP NOT NULL;
ALTER TABLE shame_entries ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user';
ALTER TABLE shame_entries ADD COLUMN IF NOT EXISTS cost INTEGER;
ALTER TABLE shame_entries ADD COLUMN IF NOT EXISTS vote_session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE;
ALTER TABLE shame_entries ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE shame_entries ADD COLUMN IF NOT EXISTS eggs INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shame_entries ADD COLUMN IF NOT EXISTS extended_hours INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shame_entries_source_check' AND conrelid = 'public.shame_entries'::regclass) THEN
    ALTER TABLE shame_entries ADD CONSTRAINT shame_entries_source_check CHECK (
      source IN ('user', 'tribunal')
      AND (source = 'tribunal' OR shamer_user_id IS NOT NULL)
      AND (source = 'user' OR vote_session_id IS NOT NULL)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shame_entries_counters_check' AND conrelid = 'public.shame_entries'::regclass) THEN
    ALTER TABLE shame_entries ADD CONSTRAINT shame_entries_counters_check CHECK (
      eggs >= 0 AND extended_hours >= 0 AND (cost IS NULL OR cost >= 0) AND jsonb_typeof(details) = 'object'
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shame_entries_tribunal ON shame_entries(vote_session_id, target_player_id) WHERE vote_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shame_entries_shamer ON shame_entries(shamer_user_id, created_at DESC);

-- The legacy route inserts directly (shame_insert, 48 hours): such a row can never forge a Tribunal decree,
-- counters or a paid marker, nor stay on the wall longer than the legacy board allowed.
DROP POLICY IF EXISTS "shame_insert_user_only" ON shame_entries;
CREATE POLICY "shame_insert_user_only" ON shame_entries AS RESTRICTIVE FOR INSERT
  WITH CHECK (
    source = 'user' AND vote_session_id IS NULL AND eggs = 0 AND extended_hours = 0
    AND cost IS NULL AND details = '{}'::jsonb AND expires_at <= now() + interval '49 hours'
  );

CREATE TABLE IF NOT EXISTS shame_eggs (
  entry_id UUID NOT NULL REFERENCES shame_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shame_eggs_user ON shame_eggs(user_id, created_at DESC);

ALTER TABLE shame_eggs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shame_eggs_read" ON shame_eggs;
CREATE POLICY "shame_eggs_read" ON shame_eggs FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON shame_eggs FROM anon, authenticated;

-- Stat text is computed by the server route from real games; it is display-only, so it is only bounded here.
CREATE OR REPLACE FUNCTION pillory_post(
  p_target_player_id UUID,
  p_message TEXT,
  p_stat_label TEXT,
  p_stat_value TEXT,
  p_recent_losses JSONB DEFAULT '[]'::jsonb,
  p_details JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_rules JSONB := pillory_rules();
  v_cost INTEGER := (v_rules->>'cost')::INT;
  v_message TEXT := btrim(COALESCE(p_message, ''));
  v_target players%ROWTYPE;
  v_balance INTEGER;
  v_last TIMESTAMPTZ;
  v_entry shame_entries%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'pillory:not_authenticated'; END IF;
  IF char_length(v_message) = 0 THEN RAISE EXCEPTION 'pillory:message_required'; END IF;
  IF char_length(v_message) > (v_rules->>'message_max')::INT THEN RAISE EXCEPTION 'pillory:message_too_long'; END IF;

  SELECT * INTO v_target FROM players WHERE id = p_target_player_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'pillory:target_not_found'; END IF;
  IF vvv_bounty_is_self(v_uid, p_target_player_id) THEN RAISE EXCEPTION 'pillory:self'; END IF;

  SELECT balance INTO v_balance FROM point_balances WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pillory:no_balance'; END IF;

  SELECT max(created_at) INTO v_last FROM shame_entries WHERE shamer_user_id = v_uid AND source = 'user';
  IF v_last IS NOT NULL AND v_last > now() - make_interval(hours => (v_rules->>'cooldown_hours')::INT) THEN
    RAISE EXCEPTION 'pillory:cooldown';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('vvv_pillory:' || p_target_player_id::text, 0));
  IF EXISTS (
    SELECT 1 FROM shame_entries
    WHERE target_player_id = p_target_player_id AND source = 'user' AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'pillory:already_pilloried';
  END IF;

  IF v_balance - v_cost < (v_rules->>'debt_floor')::INT THEN RAISE EXCEPTION 'pillory:debt_limit'; END IF;

  INSERT INTO shame_entries (
    shamer_user_id, target_player_id, message, worst_stat_label, worst_stat_value, recent_losses,
    expires_at, source, cost, details
  ) VALUES (
    v_uid,
    p_target_player_id,
    v_message,
    left(COALESCE(NULLIF(btrim(p_stat_label), ''), 'Crimes'), 60),
    left(COALESCE(NULLIF(btrim(p_stat_value), ''), 'Unspeakable'), 60),
    CASE WHEN jsonb_typeof(p_recent_losses) = 'array' AND octet_length(p_recent_losses::text) <= 2048 THEN p_recent_losses ELSE '[]'::jsonb END,
    now() + make_interval(hours => (v_rules->>'hours')::INT),
    'user',
    v_cost,
    CASE WHEN jsonb_typeof(p_details) = 'object' AND octet_length(p_details::text) <= 2048 THEN p_details ELSE '{}'::jsonb END
  )
  RETURNING * INTO v_entry;

  PERFORM adjust_balance(v_uid, -v_cost, 'shame_spent', v_entry.id);

  RETURN jsonb_build_object(
    'entry', to_jsonb(v_entry),
    'target_name', v_target.name,
    'target_user_id', vvv_bounty_account(p_target_player_id),
    'cost', v_cost,
    'balance', v_balance - v_cost
  );
END;
$$;

CREATE OR REPLACE FUNCTION pillory_throw_egg(p_entry_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_rules JSONB := pillory_rules();
  v_entry shame_entries%ROWTYPE;
  v_extend BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'pillory:not_authenticated'; END IF;

  SELECT * INTO v_entry FROM shame_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND OR v_entry.expires_at <= now() THEN RAISE EXCEPTION 'pillory:entry_gone'; END IF;
  IF vvv_bounty_is_self(v_uid, v_entry.target_player_id) THEN RAISE EXCEPTION 'pillory:own_egg'; END IF;

  INSERT INTO shame_eggs (entry_id, user_id) VALUES (p_entry_id, v_uid) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'pillory:already_thrown'; END IF;

  v_extend := v_entry.extended_hours + (v_rules->>'egg_hours')::INT <= (v_rules->>'egg_max_hours')::INT;
  UPDATE shame_entries
  SET eggs = eggs + 1,
      extended_hours = extended_hours + CASE WHEN v_extend THEN (v_rules->>'egg_hours')::INT ELSE 0 END,
      expires_at = expires_at + CASE WHEN v_extend THEN make_interval(hours => (v_rules->>'egg_hours')::INT) ELSE interval '0' END
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  RETURN jsonb_build_object(
    'entry_id', v_entry.id,
    'eggs', v_entry.eggs,
    'expires_at', v_entry.expires_at,
    'extended', v_extend,
    'target_name', (SELECT name FROM players WHERE id = v_entry.target_player_id),
    'target_user_id', vvv_bounty_account(v_entry.target_player_id)
  );
END;
$$;

-- Lazy (any read of the wall): every settled Tribunal vote with an Inter verdict pillories the voted players
-- once, free, for 24 hours from the verdict. Works whether or not the prophecy-vote migration exists yet.
CREATE OR REPLACE FUNCTION pillory_sync_tribunal() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rules JSONB := pillory_rules();
  v_vote RECORD;
  v_player UUID;
  v_votes INTEGER;
  v_ballots INTEGER;
  v_line RECORD;
  v_id UUID;
  v_created JSONB := '[]'::jsonb;
BEGIN
  IF to_regclass('public.post_game_votes') IS NULL THEN
    RETURN v_created;
  END IF;

  FOR v_vote IN
    SELECT v.session_id, v.game_id, v.winner_side, v.settled_at, v.inter_player_ids, v.summary
    FROM post_game_votes v
    WHERE v.status = 'settled'
      AND cardinality(v.inter_player_ids) > 0
      AND v.settled_at > now() - make_interval(hours => (v_rules->>'hours')::INT)
      AND EXISTS (
        SELECT 1 FROM unnest(v.inter_player_ids) AS ip(player_id)
        WHERE EXISTS (SELECT 1 FROM players p WHERE p.id = ip.player_id)
          AND NOT EXISTS (
            SELECT 1 FROM shame_entries s WHERE s.vote_session_id = v.session_id AND s.target_player_id = ip.player_id
          )
      )
    ORDER BY v.settled_at
    LIMIT 10
  LOOP
    v_ballots := COALESCE((v_vote.summary->'inter'->>'ballots')::INT, 0);
    FOREACH v_player IN ARRAY v_vote.inter_player_ids LOOP
      CONTINUE WHEN NOT EXISTS (SELECT 1 FROM players WHERE id = v_player);
      v_votes := COALESCE((v_vote.summary->'inter'->'tallies'->>(v_player::text))::INT, 0);
      SELECT gp.champion, gp.lane, gp.side INTO v_line
      FROM game_players gp WHERE gp.game_id = v_vote.game_id AND gp.player_id = v_player LIMIT 1;

      v_id := NULL;
      INSERT INTO shame_entries (
        shamer_user_id, target_player_id, message, worst_stat_label, worst_stat_value, recent_losses,
        expires_at, source, cost, vote_session_id, details
      ) VALUES (
        NULL,
        v_player,
        '',
        'Voted Inter by the Tribunal',
        CASE WHEN v_ballots > 0 THEN v_votes || ' of ' || v_ballots || ' ballots' ELSE v_votes || ' votes' END,
        '[]'::jsonb,
        v_vote.settled_at + make_interval(hours => (v_rules->>'hours')::INT),
        'tribunal',
        0,
        v_vote.session_id,
        jsonb_strip_nulls(jsonb_build_object(
          'votes', v_votes,
          'ballots', v_ballots,
          'champion', v_line.champion,
          'lane', v_line.lane,
          'side', v_line.side,
          'won', CASE WHEN v_line.side IS NULL OR v_vote.winner_side IS NULL THEN NULL ELSE v_line.side = v_vote.winner_side END,
          'shared', cardinality(v_vote.inter_player_ids) > 1
        ))
      )
      ON CONFLICT (vote_session_id, target_player_id) WHERE vote_session_id IS NOT NULL DO NOTHING
      RETURNING id INTO v_id;

      IF v_id IS NOT NULL THEN
        v_created := v_created || jsonb_build_array(jsonb_build_object(
          'entry_id', v_id,
          'session_id', v_vote.session_id,
          'target_player_id', v_player,
          'target_name', (SELECT name FROM players WHERE id = v_player),
          'target_user_id', vvv_bounty_account(v_player),
          'votes', v_votes,
          'ballots', v_ballots
        ));
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_created;
END;
$$;

-- ============================================================
-- PRIVILEGES
-- ============================================================

REVOKE EXECUTE ON FUNCTION vvv_bounty_account(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_bounty_is_self(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_bounty_expire(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_bounty_lock_key(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_bounty_refund_on_delete() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION bounty_pledge(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bounty_pledge(UUID, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION bounty_settle_session(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bounty_settle_session(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION bounty_sweep() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bounty_sweep() TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION pillory_post(UUID, TEXT, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pillory_post(UUID, TEXT, TEXT, TEXT, JSONB, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION pillory_throw_egg(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pillory_throw_egg(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION pillory_sync_tribunal() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pillory_sync_tribunal() TO anon, authenticated;

-- ============================================================
-- REALTIME
-- ============================================================

SELECT vvv_add_to_realtime('bounty_warrants');
SELECT vvv_add_to_realtime('bounties');
SELECT vvv_add_to_realtime('shame_entries');

COMMIT;

-- ============================================================
-- phase10_lobby.sql
-- ============================================================

-- Phase 10: lobby (roster, queue, winner-stays rotation, coach draft)
-- Additive and idempotent: safe to run (and re-run) while the previous app version is deployed.
-- Run after supabase/phase10_foundation.sql.

DO $$
BEGIN
  IF to_regprocedure('vvv_add_to_realtime(text)') IS NULL THEN
    RAISE EXCEPTION 'Run supabase/phase10_foundation.sql before supabase/phase10_lobby.sql';
  END IF;
END $$;

-- vainqueur_state is meant to be a single row, but nothing enforced it and duplicates exist: an unordered
-- "LIMIT 1" read then flips between rows after every update. Keep the most relevant row and lock it to one.
DELETE FROM vainqueur_state
WHERE id <> (
  SELECT id FROM vainqueur_state
  ORDER BY is_active DESC, (last_session_id IS NOT NULL) DESC, updated_at DESC, id
  LIMIT 1
);

INSERT INTO vainqueur_state (is_active)
SELECT false
WHERE NOT EXISTS (SELECT 1 FROM vainqueur_state);

CREATE UNIQUE INDEX IF NOT EXISTS vainqueur_state_singleton ON vainqueur_state ((true));

-- Optional coach draft pool: the players who are actually here. NULL means every active player.
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS coach_pool UUID[];

CREATE INDEX IF NOT EXISTS idx_player_queue_order ON player_queue (position, joined_at);

-- Roster edits (bench, rename, new players) reach every open lobby.
SELECT vvv_add_to_realtime('players');

-- Serpentine pick order shared by both functions: B R R B B R R B B R.
CREATE OR REPLACE FUNCTION coach_draft_side(p_pick_number INTEGER)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (ARRAY['blue', 'red', 'red', 'blue', 'blue', 'red', 'red', 'blue', 'blue', 'red'])[p_pick_number]
$$;

-- One pick for the coach whose turn it is. The session row lock serializes picks and undos, so pick numbers
-- stay contiguous and the turn order cannot be raced.
CREATE OR REPLACE FUNCTION coach_draft_pick(p_session_id UUID, p_player_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_player players%ROWTYPE;
  v_count INTEGER;
  v_side TEXT;
  v_next TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'coachdraft:not_authenticated'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:session_not_found'; END IF;
  IF v_session.status <> 'coach_draft' THEN RAISE EXCEPTION 'coachdraft:not_drafting'; END IF;

  SELECT count(*) INTO v_count FROM coach_draft_picks WHERE session_id = p_session_id;
  IF v_count >= 10 THEN RAISE EXCEPTION 'coachdraft:draft_full'; END IF;

  v_side := coach_draft_side(v_count + 1);
  IF (v_side = 'blue' AND v_session.blue_coach_id IS DISTINCT FROM v_uid)
     OR (v_side = 'red' AND v_session.red_coach_id IS DISTINCT FROM v_uid) THEN
    RAISE EXCEPTION 'coachdraft:not_your_turn';
  END IF;

  SELECT * INTO v_player FROM players WHERE id = p_player_id;
  IF NOT FOUND OR NOT v_player.is_active THEN RAISE EXCEPTION 'coachdraft:player_unavailable'; END IF;
  IF COALESCE(cardinality(v_session.coach_pool), 0) > 0 AND NOT (p_player_id = ANY (v_session.coach_pool)) THEN
    RAISE EXCEPTION 'coachdraft:not_in_pool';
  END IF;
  IF EXISTS (SELECT 1 FROM coach_draft_picks WHERE session_id = p_session_id AND player_id = p_player_id) THEN
    RAISE EXCEPTION 'coachdraft:already_picked';
  END IF;

  INSERT INTO coach_draft_picks (session_id, pick_number, player_id, side)
  VALUES (p_session_id, v_count + 1, p_player_id, v_side);

  v_next := CASE WHEN v_count + 1 < 10 THEN coach_draft_side(v_count + 2) END;
  UPDATE game_sessions SET draft_turn = v_next, updated_at = now() WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'pick_number', v_count + 1,
    'side', v_side,
    'next_side', v_next,
    'player_id', v_player.id,
    'player_name', v_player.name,
    'player_user_id', v_player.auth_user_id
  );
END;
$$;

-- Takes back the latest pick. Only the coach who made it can, and only until the next pick lands.
CREATE OR REPLACE FUNCTION coach_draft_undo(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_last coach_draft_picks%ROWTYPE;
  v_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'coachdraft:not_authenticated'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:session_not_found'; END IF;
  IF v_session.status <> 'coach_draft' THEN RAISE EXCEPTION 'coachdraft:not_drafting'; END IF;

  SELECT * INTO v_last FROM coach_draft_picks
  WHERE session_id = p_session_id
  ORDER BY pick_number DESC
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:nothing_to_undo'; END IF;

  IF (v_last.side = 'blue' AND v_session.blue_coach_id IS DISTINCT FROM v_uid)
     OR (v_last.side = 'red' AND v_session.red_coach_id IS DISTINCT FROM v_uid) THEN
    RAISE EXCEPTION 'coachdraft:not_your_pick';
  END IF;

  DELETE FROM coach_draft_picks WHERE id = v_last.id;
  UPDATE game_sessions SET draft_turn = v_last.side, updated_at = now() WHERE id = p_session_id;

  SELECT name INTO v_name FROM players WHERE id = v_last.player_id;

  RETURN jsonb_build_object(
    'pick_number', v_last.pick_number,
    'side', v_last.side,
    'player_id', v_last.player_id,
    'player_name', v_name
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION coach_draft_side(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION coach_draft_pick(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION coach_draft_pick(UUID, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION coach_draft_undo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION coach_draft_undo(UUID) TO authenticated;

-- The queue is written directly by the app as the signed-in user, and had no row security: anyone holding the
-- public key could empty it, reorder it, or slot anyone in at the front with a spot that never expires. Only the
-- writes the app makes pass:
--   insert   your own player, any player for an admin, or the losers of the last decided game for its host (the
--            winner-stays rotation sends them to the back). A new spot always lands at the back, stamped now.
--   update   admins, position only (reordering).
--   delete   your own spot; any spot for an admin; spots that expired (12 hours, QUEUE_TTL_MS in
--            lib/lobby/constants.ts) or belong to benched players; players seated in a game still in its draft
--            (a roll, a coach confirm or a rotation just dealt them in); and the losers of the last decided game
--            for its host.
-- Functions run as the owner and are never affected.
CREATE OR REPLACE FUNCTION vvv_player_queue_guard() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_player UUID := CASE WHEN TG_OP = 'DELETE' THEN OLD.player_id ELSE NEW.player_id END;
  v_admin BOOLEAN;
  v_ok BOOLEAN;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'queue:locked' USING ERRCODE = '42501';
  END IF;

  v_admin := EXISTS (SELECT 1 FROM players WHERE auth_user_id = v_uid AND is_admin);

  IF TG_OP = 'UPDATE' THEN
    IF NOT v_admin OR NEW.id IS DISTINCT FROM OLD.id OR NEW.player_id IS DISTINCT FROM OLD.player_id
       OR NEW.joined_at IS DISTINCT FROM OLD.joined_at THEN
      RAISE EXCEPTION 'queue:locked' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  v_ok := v_admin
    OR EXISTS (SELECT 1 FROM players WHERE id = v_player AND auth_user_id = v_uid)
    OR EXISTS (
      SELECT 1
      FROM (
        SELECT id, status, created_by FROM game_sessions
        WHERE status IN ('blue_win', 'red_win')
        ORDER BY created_at DESC
        LIMIT 1
      ) s
      JOIN session_assignments sa ON sa.session_id = s.id
      WHERE s.created_by = v_uid AND sa.player_id = v_player AND sa.side || '_win' <> s.status
    );

  IF TG_OP = 'DELETE' THEN
    v_ok := v_ok
      OR OLD.joined_at < now() - interval '12 hours' + interval '1 minute'
      OR NOT EXISTS (SELECT 1 FROM players WHERE id = v_player AND is_active)
      OR EXISTS (
        SELECT 1 FROM session_assignments sa
        JOIN game_sessions s ON s.id = sa.session_id
        WHERE sa.player_id = v_player AND s.status = 'draft'
      );
    IF NOT v_ok THEN
      RAISE EXCEPTION 'queue:locked' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'queue:locked' USING ERRCODE = '42501';
  END IF;
  -- Rows inserted earlier by the same statement are visible here, so a batch keeps its order at the back.
  NEW.position := GREATEST(NEW.position, COALESCE((SELECT max(position) FROM player_queue), 0) + 1);
  NEW.joined_at := now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION vvv_player_queue_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vvv_player_queue_guard ON player_queue;
CREATE TRIGGER vvv_player_queue_guard
  BEFORE INSERT OR UPDATE OR DELETE ON player_queue
  FOR EACH ROW EXECUTE FUNCTION vvv_player_queue_guard();

-- ============================================================
-- phase10_coach-champions.sql
-- ============================================================

-- Phase 10: coach champions. Once the coaches lock their teams and lanes, they pick every champion themselves
-- in League draft order (Blue 1, Red 2, Blue 2, Red 2, Blue 2, Red 1) instead of a random deal.
-- Additive and idempotent: safe to run (and re-run) while the previous app version is deployed. Every write
-- happens inside the SECURITY DEFINER functions below, so it works with and without phase11_lockdown.sql.
-- Run after supabase/phase10_lobby.sql. Without this file the app keeps dealing champions at random.

DO $$
BEGIN
  IF to_regprocedure('vvv_add_to_realtime(text)') IS NULL OR to_regclass('public.coach_draft_picks') IS NULL THEN
    RAISE EXCEPTION 'Run supabase/phase10_foundation.sql and supabase/phase10_lobby.sql before supabase/phase10_coach-champions.sql';
  END IF;
END $$;

-- ============================================================
-- Schema
-- ============================================================

-- champion_draft_at: when the teams were locked and champion select opened (NULL while players are drafted).
-- champion_turn_ends_at: server deadline of the pick on the clock (NULL once all ten are picked).
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS champion_draft_at TIMESTAMPTZ;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS champion_turn_ends_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS coach_champion_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  pick_number INTEGER NOT NULL CHECK (pick_number BETWEEN 1 AND 10),
  side TEXT NOT NULL CHECK (side IN ('blue', 'red')),
  player_id UUID NOT NULL REFERENCES players(id),
  lane TEXT NOT NULL CHECK (lane IN ('top', 'jungle', 'mid', 'adc', 'support')),
  champion TEXT NOT NULL,
  champion_internal TEXT NOT NULL,
  -- The coach who picked; NULL when the clock ran out and the server picked.
  picked_by UUID,
  auto BOOLEAN NOT NULL DEFAULT false,
  requested BOOLEAN NOT NULL DEFAULT false,
  fearless_override BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, pick_number),
  UNIQUE (session_id, player_id),
  UNIQUE (session_id, champion)
);

-- One pinned wish per player ("I want Ahri"), shown to their own coach and team only.
CREATE TABLE IF NOT EXISTS coach_champion_requests (
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  champion TEXT NOT NULL,
  champion_internal TEXT NOT NULL,
  requested_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, player_id)
);

ALTER TABLE coach_champion_picks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_champion_picks_read" ON coach_champion_picks;
CREATE POLICY "coach_champion_picks_read" ON coach_champion_picks FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON coach_champion_picks FROM anon, authenticated;

ALTER TABLE coach_champion_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_champion_requests_read" ON coach_champion_requests;
CREATE POLICY "coach_champion_requests_read" ON coach_champion_requests FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM coach_draft_picks p
    JOIN game_sessions s ON s.id = p.session_id
    WHERE p.session_id = coach_champion_requests.session_id
      AND p.player_id = coach_champion_requests.player_id
      AND (
        auth.uid() = CASE p.side WHEN 'blue' THEN s.blue_coach_id ELSE s.red_coach_id END
        OR EXISTS (
          SELECT 1 FROM coach_draft_picks mate JOIN players pl ON pl.id = mate.player_id
          WHERE mate.session_id = p.session_id AND mate.side = p.side AND pl.auth_user_id = auth.uid()
        )
      )
  )
);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON coach_champion_requests FROM anon, authenticated;

-- Picks land with a game_sessions update (already published); requests need their own feed.
SELECT vvv_add_to_realtime('coach_champion_requests');

-- ============================================================
-- Helpers (owner only)
-- ============================================================

-- League draft order: B1 R1 R2 B2 B3 R3 R4 B4 B5 R5.
CREATE OR REPLACE FUNCTION coach_champion_side(p_pick_number INTEGER)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (ARRAY['blue', 'red', 'red', 'blue', 'blue', 'red', 'red', 'blue', 'blue', 'red'])[p_pick_number]
$$;

CREATE OR REPLACE FUNCTION coach_champion_clock() RETURNS INTERVAL
LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT interval '30 seconds' $$;

-- A pick sent in the last moments still counts: the auto-pick only fires once this slack is gone too.
CREATE OR REPLACE FUNCTION coach_champion_grace() RETURNS INTERVAL
LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT interval '2 seconds' $$;

CREATE OR REPLACE FUNCTION coach_champion_coach(p_session game_sessions, p_side TEXT) RETURNS UUID
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE p_side WHEN 'blue' THEN p_session.blue_coach_id WHEN 'red' THEN p_session.red_coach_id END
$$;

-- Why a champion cannot be picked in this game right now, or NULL when it can.
CREATE OR REPLACE FUNCTION coach_champion_blocked(p_session_id UUID, p_champion TEXT) RETURNS TEXT
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM coach_champion_picks c WHERE c.session_id = p_session_id AND c.champion = p_champion)
      THEN 'champion_taken'
    WHEN EXISTS (
      SELECT 1 FROM daily_fearless df WHERE df.date = (now() AT TIME ZONE 'utc')::date AND df.champion_name = p_champion
    ) THEN 'fearless_banned'
  END
$$;

CREATE OR REPLACE FUNCTION coach_champion_pick_json(p_pick coach_champion_picks) RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pick_number', p_pick.pick_number,
    'side', p_pick.side,
    'player_id', p_pick.player_id,
    'player_name', pl.name,
    'player_user_id', pl.auth_user_id,
    'lane', p_pick.lane,
    'champion', p_pick.champion,
    'champion_internal', p_pick.champion_internal,
    'picked_by', p_pick.picked_by,
    'auto', p_pick.auto,
    'requested', p_pick.requested,
    'fearless_override', p_pick.fearless_override
  )
  FROM players pl WHERE pl.id = p_pick.player_id
$$;

-- Runs after every pick, with the session row locked: either hands the clock to the next coach, or, after the
-- tenth pick, seats all ten with their champions (locked: no re-roll touches a coach's pick), opens the normal
-- draft and spends the ten queue spots. updated_at moves with every pick so open clients refetch.
CREATE OR REPLACE FUNCTION coach_champions_advance(p_session game_sessions) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
  v_next TEXT;
  v_ends TIMESTAMPTZ;
  v_dequeued INTEGER := 0;
BEGIN
  SELECT count(*) INTO v_count FROM coach_champion_picks WHERE session_id = p_session.id;

  IF v_count < 10 THEN
    v_next := coach_champion_side(v_count + 1);
    v_ends := now() + coach_champion_clock();
    UPDATE game_sessions
    SET draft_turn = v_next, champion_turn_ends_at = v_ends, updated_at = now()
    WHERE id = p_session.id;
    RETURN jsonb_build_object(
      'completed', false,
      'next_side', v_next,
      'next_coach_id', coach_champion_coach(p_session, v_next),
      'turn_ends_at', v_ends,
      'dequeued', 0
    );
  END IF;

  IF EXISTS (SELECT 1 FROM session_assignments WHERE session_id = p_session.id) THEN
    RAISE EXCEPTION 'coachdraft:stale';
  END IF;

  INSERT INTO session_assignments (session_id, player_id, side, lane, champion, champion_internal, locked, fearless_override)
  SELECT c.session_id, c.player_id, c.side, c.lane, c.champion, c.champion_internal, true, c.fearless_override
  FROM coach_champion_picks c
  WHERE c.session_id = p_session.id;

  UPDATE game_sessions
  SET status = 'draft', draft_turn = NULL, champion_turn_ends_at = NULL, updated_at = now()
  WHERE id = p_session.id;

  DELETE FROM player_queue WHERE player_id IN (SELECT player_id FROM coach_champion_picks WHERE session_id = p_session.id);
  GET DIAGNOSTICS v_dequeued = ROW_COUNT;

  RETURN jsonb_build_object('completed', true, 'next_side', NULL, 'next_coach_id', NULL, 'turn_ends_at', NULL, 'dequeued', v_dequeued);
END;
$$;

-- The clock ran out: lock a champion for the first open lane of the side on the clock. The player's pinned
-- request wins when it is still available, then a random champion from their lane pool, then any champion,
-- and only if every one of those is gone, a fearless-banned one from the lane (flagged as an override).
CREATE OR REPLACE FUNCTION coach_champions_autopick(p_session game_sessions) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
  v_side TEXT;
  v_slot coach_draft_picks%ROWTYPE;
  v_name TEXT;
  v_internal TEXT;
  v_requested BOOLEAN := false;
  v_override BOOLEAN := false;
  v_today DATE := (now() AT TIME ZONE 'utc')::date;
  v_pick coach_champion_picks%ROWTYPE;
BEGIN
  SELECT count(*) INTO v_count FROM coach_champion_picks WHERE session_id = p_session.id;
  IF v_count >= 10 THEN RAISE EXCEPTION 'coachdraft:draft_full'; END IF;
  v_side := coach_champion_side(v_count + 1);

  SELECT d.* INTO v_slot
  FROM coach_draft_picks d
  WHERE d.session_id = p_session.id AND d.side = v_side
    AND NOT EXISTS (SELECT 1 FROM coach_champion_picks c WHERE c.session_id = d.session_id AND c.player_id = d.player_id)
  ORDER BY array_position(ARRAY['top', 'jungle', 'mid', 'adc', 'support'], d.lane), d.pick_number
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:stale'; END IF;

  SELECT r.champion, r.champion_internal INTO v_name, v_internal
  FROM coach_champion_requests r
  WHERE r.session_id = p_session.id AND r.player_id = v_slot.player_id
    AND coach_champion_blocked(p_session.id, r.champion) IS NULL;
  v_requested := FOUND;

  IF NOT v_requested THEN
    SELECT cr.name, cr.internal_name INTO v_name, v_internal
    FROM champion_roles cr
    WHERE cr.role = v_slot.lane AND coach_champion_blocked(p_session.id, cr.name) IS NULL
    ORDER BY random()
    LIMIT 1;
  END IF;
  IF v_name IS NULL THEN
    SELECT cr.name, cr.internal_name INTO v_name, v_internal
    FROM champion_roles cr
    WHERE coach_champion_blocked(p_session.id, cr.name) IS NULL
    ORDER BY random()
    LIMIT 1;
  END IF;
  IF v_name IS NULL THEN
    SELECT cr.name, cr.internal_name INTO v_name, v_internal
    FROM champion_roles cr
    WHERE cr.role = v_slot.lane
      AND NOT EXISTS (SELECT 1 FROM coach_champion_picks c WHERE c.session_id = p_session.id AND c.champion = cr.name)
    ORDER BY random()
    LIMIT 1;
    v_override := v_name IS NOT NULL AND EXISTS (
      SELECT 1 FROM daily_fearless df WHERE df.date = v_today AND df.champion_name = v_name
    );
  END IF;
  IF v_name IS NULL THEN RAISE EXCEPTION 'coachdraft:no_champions'; END IF;

  INSERT INTO coach_champion_picks
    (session_id, pick_number, side, player_id, lane, champion, champion_internal, picked_by, auto, requested, fearless_override)
  VALUES
    (p_session.id, v_count + 1, v_side, v_slot.player_id, v_slot.lane, v_name, v_internal, NULL, true, v_requested, v_override)
  RETURNING * INTO v_pick;

  RETURN coach_champion_pick_json(v_pick) || coach_champions_advance(p_session);
END;
$$;

REVOKE EXECUTE ON FUNCTION coach_champion_side(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION coach_champion_clock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION coach_champion_grace() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION coach_champion_coach(game_sessions, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION coach_champion_blocked(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION coach_champion_pick_json(coach_champion_picks) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION coach_champions_advance(game_sessions) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION coach_champions_autopick(game_sessions) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Entry points
-- ============================================================

-- Locks both teams and opens champion select, Blue on the clock. Either coach or an admin; p_version is the
-- draft version the caller saw (game_sessions.updated_at), so a lane change in flight makes the lock retry.
CREATE OR REPLACE FUNCTION coach_champions_open(p_session_id UUID, p_version TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_total INTEGER;
  v_blue INTEGER;
  v_missing INTEGER;
  v_lanes INTEGER;
  v_ends TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'coachdraft:not_authenticated'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:session_not_found'; END IF;
  IF v_uid IS DISTINCT FROM v_session.blue_coach_id AND v_uid IS DISTINCT FROM v_session.red_coach_id
     AND NOT EXISTS (SELECT 1 FROM players WHERE auth_user_id = v_uid AND is_admin) THEN
    RAISE EXCEPTION 'coachdraft:not_a_coach';
  END IF;
  IF v_session.status <> 'coach_draft' THEN RAISE EXCEPTION 'coachdraft:not_drafting'; END IF;

  IF v_session.champion_draft_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'opened', false,
      'turn_side', v_session.draft_turn,
      'turn_ends_at', v_session.champion_turn_ends_at,
      'next_coach_id', coach_champion_coach(v_session, v_session.draft_turn)
    );
  END IF;
  IF p_version IS NOT NULL AND v_session.updated_at IS DISTINCT FROM p_version THEN
    RAISE EXCEPTION 'coachdraft:stale';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE side = 'blue'), count(*) FILTER (WHERE lane IS NULL),
         count(DISTINCT (side, lane)) FILTER (WHERE lane IS NOT NULL)
  INTO v_total, v_blue, v_missing, v_lanes
  FROM coach_draft_picks WHERE session_id = p_session_id;
  IF v_total <> 10 OR v_blue <> 5 THEN RAISE EXCEPTION 'coachdraft:picks_missing'; END IF;
  IF v_missing > 0 THEN RAISE EXCEPTION 'coachdraft:lanes_missing'; END IF;
  IF v_lanes <> 10 THEN RAISE EXCEPTION 'coachdraft:lane_clash'; END IF;

  v_ends := now() + coach_champion_clock();
  UPDATE game_sessions
  SET champion_draft_at = now(), champion_turn_ends_at = v_ends, draft_turn = coach_champion_side(1), updated_at = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'opened', true,
    'turn_side', coach_champion_side(1),
    'turn_ends_at', v_ends,
    'next_coach_id', coach_champion_coach(v_session, coach_champion_side(1))
  );
END;
$$;

-- One champion for one of the caller's players, on the caller's turn. p_pick_number is the pick the caller
-- believes is on the clock: a retry of a pick that already landed returns it again instead of failing.
CREATE OR REPLACE FUNCTION coach_champion_pick(p_session_id UUID, p_player_id UUID, p_champion TEXT, p_pick_number INTEGER DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_existing coach_champion_picks%ROWTYPE;
  v_slot coach_draft_picks%ROWTYPE;
  v_count INTEGER;
  v_side TEXT;
  v_name TEXT;
  v_internal TEXT;
  v_blocked TEXT;
  v_pick coach_champion_picks%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'coachdraft:not_authenticated'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:session_not_found'; END IF;

  IF p_pick_number IS NOT NULL THEN
    SELECT * INTO v_existing FROM coach_champion_picks WHERE session_id = p_session_id AND pick_number = p_pick_number;
    IF FOUND AND v_existing.player_id = p_player_id AND v_existing.picked_by = v_uid
       AND (lower(v_existing.champion) = lower(p_champion) OR lower(v_existing.champion_internal) = lower(p_champion)) THEN
      RETURN coach_champion_pick_json(v_existing) || jsonb_build_object(
        'replayed', true,
        'completed', v_session.status <> 'coach_draft',
        'next_side', CASE WHEN v_session.status = 'coach_draft' THEN v_session.draft_turn END,
        'next_coach_id', CASE WHEN v_session.status = 'coach_draft' THEN coach_champion_coach(v_session, v_session.draft_turn) END,
        'turn_ends_at', v_session.champion_turn_ends_at,
        'dequeued', 0
      );
    END IF;
  END IF;

  IF v_uid IS DISTINCT FROM v_session.blue_coach_id AND v_uid IS DISTINCT FROM v_session.red_coach_id THEN
    RAISE EXCEPTION 'coachdraft:not_a_coach';
  END IF;
  IF v_session.status <> 'coach_draft' THEN RAISE EXCEPTION 'coachdraft:not_drafting'; END IF;
  IF v_session.champion_draft_at IS NULL THEN RAISE EXCEPTION 'coachdraft:champions_closed'; END IF;

  SELECT count(*) INTO v_count FROM coach_champion_picks WHERE session_id = p_session_id;
  IF v_count >= 10 THEN RAISE EXCEPTION 'coachdraft:draft_full'; END IF;
  IF p_pick_number IS NOT NULL AND p_pick_number <> v_count + 1 THEN RAISE EXCEPTION 'coachdraft:stale'; END IF;
  IF v_session.champion_turn_ends_at IS NOT NULL AND now() >= v_session.champion_turn_ends_at + coach_champion_grace() THEN
    RAISE EXCEPTION 'coachdraft:turn_expired';
  END IF;

  v_side := coach_champion_side(v_count + 1);
  IF coach_champion_coach(v_session, v_side) IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'coachdraft:not_your_turn'; END IF;

  SELECT * INTO v_slot FROM coach_draft_picks WHERE session_id = p_session_id AND player_id = p_player_id;
  IF NOT FOUND OR v_slot.side <> v_side THEN RAISE EXCEPTION 'coachdraft:not_your_player'; END IF;
  IF EXISTS (SELECT 1 FROM coach_champion_picks WHERE session_id = p_session_id AND player_id = p_player_id) THEN
    RAISE EXCEPTION 'coachdraft:player_has_champion';
  END IF;

  SELECT cr.name, cr.internal_name INTO v_name, v_internal
  FROM champion_roles cr
  WHERE lower(cr.name) = lower(btrim(p_champion)) OR lower(cr.internal_name) = lower(btrim(p_champion))
  ORDER BY (cr.name = btrim(p_champion)) DESC
  LIMIT 1;
  IF v_name IS NULL THEN RAISE EXCEPTION 'coachdraft:unknown_champion'; END IF;

  v_blocked := coach_champion_blocked(p_session_id, v_name);
  IF v_blocked IS NOT NULL THEN RAISE EXCEPTION 'coachdraft:%', v_blocked; END IF;

  INSERT INTO coach_champion_picks
    (session_id, pick_number, side, player_id, lane, champion, champion_internal, picked_by, auto, requested)
  VALUES (
    p_session_id, v_count + 1, v_side, p_player_id, v_slot.lane, v_name, v_internal, v_uid, false,
    EXISTS (SELECT 1 FROM coach_champion_requests r WHERE r.session_id = p_session_id AND r.player_id = p_player_id AND r.champion = v_name)
  )
  RETURNING * INTO v_pick;

  RETURN coach_champion_pick_json(v_pick) || jsonb_build_object('replayed', false) || coach_champions_advance(v_session);
END;
$$;

-- Takes back the latest champion. Only the coach who picked it, only until the next pick lands (an expired
-- clock counts as landed), and never an auto-pick. The undoing coach gets a fresh clock.
CREATE OR REPLACE FUNCTION coach_champion_undo(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_last coach_champion_picks%ROWTYPE;
  v_ends TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'coachdraft:not_authenticated'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:session_not_found'; END IF;
  IF v_session.status <> 'coach_draft' THEN RAISE EXCEPTION 'coachdraft:not_drafting'; END IF;
  IF v_session.champion_draft_at IS NULL THEN RAISE EXCEPTION 'coachdraft:champions_closed'; END IF;

  SELECT * INTO v_last FROM coach_champion_picks WHERE session_id = p_session_id ORDER BY pick_number DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:nothing_to_undo'; END IF;
  IF v_last.auto THEN RAISE EXCEPTION 'coachdraft:auto_pick_final'; END IF;
  IF v_last.picked_by IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'coachdraft:not_your_pick'; END IF;
  IF v_session.champion_turn_ends_at IS NOT NULL AND now() >= v_session.champion_turn_ends_at + coach_champion_grace() THEN
    RAISE EXCEPTION 'coachdraft:turn_expired';
  END IF;

  v_result := coach_champion_pick_json(v_last);
  DELETE FROM coach_champion_picks WHERE id = v_last.id;

  v_ends := now() + coach_champion_clock();
  UPDATE game_sessions SET draft_turn = v_last.side, champion_turn_ends_at = v_ends, updated_at = now() WHERE id = p_session_id;

  RETURN v_result || jsonb_build_object(
    'turn_ends_at', v_ends,
    'other_coach_id', coach_champion_coach(v_session, CASE v_last.side WHEN 'blue' THEN 'red' ELSE 'blue' END)
  );
END;
$$;

-- The caller pins (or, with NULL, clears) the champion they want. Players drafted into this game only, until
-- their own champion is picked. No points involved.
CREATE OR REPLACE FUNCTION coach_champion_request(p_session_id UUID, p_champion TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_player players%ROWTYPE;
  v_slot coach_draft_picks%ROWTYPE;
  v_name TEXT;
  v_internal TEXT;
  v_blocked TEXT;
  v_previous TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'coachdraft:not_authenticated'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:session_not_found'; END IF;
  IF v_session.status <> 'coach_draft' THEN RAISE EXCEPTION 'coachdraft:not_drafting'; END IF;

  SELECT * INTO v_player FROM players WHERE auth_user_id = v_uid LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:not_in_draft'; END IF;
  SELECT * INTO v_slot FROM coach_draft_picks WHERE session_id = p_session_id AND player_id = v_player.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'coachdraft:not_in_draft'; END IF;
  IF EXISTS (SELECT 1 FROM coach_champion_picks WHERE session_id = p_session_id AND player_id = v_player.id) THEN
    RAISE EXCEPTION 'coachdraft:player_has_champion';
  END IF;

  SELECT champion INTO v_previous FROM coach_champion_requests WHERE session_id = p_session_id AND player_id = v_player.id;

  IF p_champion IS NULL OR btrim(p_champion) = '' THEN
    DELETE FROM coach_champion_requests WHERE session_id = p_session_id AND player_id = v_player.id;
  ELSE
    SELECT cr.name, cr.internal_name INTO v_name, v_internal
    FROM champion_roles cr
    WHERE lower(cr.name) = lower(btrim(p_champion)) OR lower(cr.internal_name) = lower(btrim(p_champion))
    ORDER BY (cr.name = btrim(p_champion)) DESC
    LIMIT 1;
    IF v_name IS NULL THEN RAISE EXCEPTION 'coachdraft:unknown_champion'; END IF;
    v_blocked := coach_champion_blocked(p_session_id, v_name);
    IF v_blocked IS NOT NULL THEN RAISE EXCEPTION 'coachdraft:%', v_blocked; END IF;

    INSERT INTO coach_champion_requests (session_id, player_id, champion, champion_internal, requested_by, updated_at)
    VALUES (p_session_id, v_player.id, v_name, v_internal, v_uid, now())
    ON CONFLICT (session_id, player_id)
    DO UPDATE SET champion = EXCLUDED.champion, champion_internal = EXCLUDED.champion_internal,
                  requested_by = EXCLUDED.requested_by, updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'player_id', v_player.id,
    'player_name', v_player.name,
    'side', v_slot.side,
    'champion', v_name,
    'champion_internal', v_internal,
    'previous', v_previous,
    'changed', v_previous IS DISTINCT FROM v_name,
    'coach_id', coach_champion_coach(v_session, v_slot.side)
  );
END;
$$;

-- Lazy clock: any read past the deadline (plus the grace) auto-picks once. Cheap when nothing is due, so every
-- client can call it on every refresh. Returns the auto-pick, or NULL.
CREATE OR REPLACE FUNCTION coach_champions_tick(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id;
  IF NOT FOUND OR v_session.status <> 'coach_draft' OR v_session.champion_draft_at IS NULL
     OR v_session.champion_turn_ends_at IS NULL OR now() < v_session.champion_turn_ends_at + coach_champion_grace() THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_session.status <> 'coach_draft' OR v_session.champion_draft_at IS NULL
     OR v_session.champion_turn_ends_at IS NULL OR now() < v_session.champion_turn_ends_at + coach_champion_grace() THEN
    RETURN NULL;
  END IF;

  RETURN coach_champions_autopick(v_session);
END;
$$;

REVOKE EXECUTE ON FUNCTION coach_champions_open(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION coach_champions_open(UUID, TIMESTAMPTZ) TO authenticated;
REVOKE EXECUTE ON FUNCTION coach_champion_pick(UUID, UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION coach_champion_pick(UUID, UUID, TEXT, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION coach_champion_undo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION coach_champion_undo(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION coach_champion_request(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION coach_champion_request(UUID, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION coach_champions_tick(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coach_champions_tick(UUID) TO anon, authenticated;

-- ============================================================
-- Guards. Clients keep their direct writes on these tables (the lobby still makes them); these only refuse
-- what would bypass champion select. Functions run as the owner and pass, except the freeze on the teams.
-- ============================================================

-- The champion clock is the server's, and a game in champion select reaches the draft through its last pick.
CREATE OR REPLACE FUNCTION vvv_coach_champions_session_guard() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.champion_draft_at IS NOT NULL OR NEW.champion_turn_ends_at IS NOT NULL THEN
      RAISE EXCEPTION 'coachdraft:champions_locked' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.champion_draft_at IS DISTINCT FROM OLD.champion_draft_at
     OR NEW.champion_turn_ends_at IS DISTINCT FROM OLD.champion_turn_ends_at
     OR (OLD.status = 'coach_draft' AND OLD.champion_draft_at IS NOT NULL AND NEW.status = 'draft') THEN
    RAISE EXCEPTION 'coachdraft:champions_locked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Once the teams are locked, nobody (the old player undo and lane functions included) reshuffles them.
CREATE OR REPLACE FUNCTION vvv_coach_draft_picks_freeze() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_sessions UUID[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_sessions := ARRAY[NEW.session_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_sessions := ARRAY[OLD.session_id];
  ELSE
    v_sessions := ARRAY[OLD.session_id, NEW.session_id];
  END IF;
  IF EXISTS (SELECT 1 FROM game_sessions WHERE id = ANY (v_sessions) AND champion_draft_at IS NOT NULL) THEN
    RAISE EXCEPTION 'coachdraft:teams_locked' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- A seat holding its coach's pick keeps that champion and its lock against client writes (re-rolls, unlocks).
-- Decrees still change it: they run inside chaos_issue_decree().
CREATE OR REPLACE FUNCTION vvv_coach_champion_seats_guard() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF (NEW.champion IS DISTINCT FROM OLD.champion
      OR NEW.champion_internal IS DISTINCT FROM OLD.champion_internal
      OR (OLD.locked AND NOT NEW.locked))
     AND EXISTS (
       SELECT 1 FROM coach_champion_picks c
       WHERE c.session_id = OLD.session_id AND c.player_id = OLD.player_id AND c.champion = OLD.champion
     ) THEN
    RAISE EXCEPTION 'coachdraft:coach_pick_locked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION vvv_coach_champions_session_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_coach_draft_picks_freeze() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_coach_champion_seats_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vvv_coach_champions_session_guard ON game_sessions;
CREATE TRIGGER vvv_coach_champions_session_guard
  BEFORE INSERT OR UPDATE ON game_sessions
  FOR EACH ROW EXECUTE FUNCTION vvv_coach_champions_session_guard();

DROP TRIGGER IF EXISTS vvv_coach_draft_picks_freeze ON coach_draft_picks;
CREATE TRIGGER vvv_coach_draft_picks_freeze
  BEFORE INSERT OR UPDATE OR DELETE ON coach_draft_picks
  FOR EACH ROW EXECUTE FUNCTION vvv_coach_draft_picks_freeze();

DROP TRIGGER IF EXISTS vvv_coach_champion_seats_guard ON session_assignments;
CREATE TRIGGER vvv_coach_champion_seats_guard
  BEFORE UPDATE ON session_assignments
  FOR EACH ROW EXECUTE FUNCTION vvv_coach_champion_seats_guard();

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- phase10_storytelling.sql
-- ============================================================

-- Phase 10: storytelling
-- Act rewards are claimed by writing one act_carryover transaction per user and reward (through adjust_balance,
-- zero-amount when the reward has no bonus). This index makes that row unique, so a double click or two tabs can
-- never pay a carry-over bonus twice: the losing request fails inside adjust_balance and its balance update rolls back.
--
-- Additive and idempotent. Safe while the previous app version is live: its claim route checks for an existing
-- row before paying, so the index only turns a lost race into an error instead of a second payout.
-- Skipped (with a notice) if duplicate claims already exist, rather than failing the migration.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_point_transactions_act_carryover_once'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM point_transactions
    WHERE reason = 'act_carryover' AND reference_id IS NOT NULL
    GROUP BY user_id, reference_id
    HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'Duplicate act_carryover claims exist: idx_point_transactions_act_carryover_once was not created';
    RETURN;
  END IF;

  CREATE UNIQUE INDEX idx_point_transactions_act_carryover_once
    ON point_transactions (user_id, reference_id)
    WHERE reason = 'act_carryover' AND reference_id IS NOT NULL;
END $$;

-- ============================================================
-- phase10_dedupe-games.sql
-- ============================================================

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

-- ============================================================
-- phase10_hardening.sql
-- ============================================================

-- Phase 10: hardening. Guarded functions for every money move and players write the app still makes as the user.
--
-- Run order: deploy the new app first, then every other phase10_*.sql file, then this one, and only once the
-- site works with all of them, supabase/phase11_lockdown.sql.
--
-- Additive and idempotent: this file only creates functions and one guard table and pins the search_path of
-- the legacy money functions, so it is safe while either the previous or the new app version is live. The new
-- app calls these functions first and falls back to its old direct writes while they are missing; phase11 then
-- closes the old doors (adjust_balance and the legacy settle functions, client writes on players).
--
-- Every callable function: SECURITY DEFINER, search_path pinned, caller taken from auth.uid() (never from an
-- argument), inputs validated, safe to call twice, executable by signed-in users only. The vvv_* helpers are
-- internal and revoked from every client role.
--
-- Errors are raised as '<domain>:<code>' messages the app maps to its own copy. "Already claimed" errors use
-- SQLSTATE 23505 so the existing duplicate handling keeps working.

-- ============================================================
-- LEGACY MONEY FUNCTIONS: pin the search_path (behavior unchanged)
-- ============================================================

DO $$
DECLARE
  v_fn TEXT;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'adjust_balance(uuid, integer, text, uuid)',
    'claim_daily_bonus(uuid)',
    'resolve_bets(uuid, text)',
    'refund_all_bets(uuid)',
    'resolve_chaos_wagers(uuid, text)',
    'refund_chaos_actions(uuid)',
    'resolve_bounties(uuid, uuid[])'
  ] LOOP
    IF to_regprocedure(v_fn) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', v_fn);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- HELPERS (internal)
-- ============================================================

CREATE OR REPLACE FUNCTION vvv_is_admin(p_user_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM players WHERE auth_user_id = p_user_id AND is_admin)
$$;

-- Same value as consolationRef() in lib/lore/reward-claims.ts: a stable UUID per act for the consolation marker.
CREATE OR REPLACE FUNCTION vvv_consolation_ref(p_act_id INTEGER) RETURNS UUID
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  WITH h AS (SELECT encode(sha256(convert_to('vvv:consolation:' || p_act_id::TEXT, 'UTF8')), 'hex') AS hex)
  SELECT (
    substr(hex, 1, 8) || '-' || substr(hex, 9, 4) || '-5' || substr(hex, 14, 3) || '-'
    || lpad(to_hex((('x' || substr(hex, 17, 2))::BIT(8)::INTEGER & 63) | 128), 2, '0')
    || substr(hex, 19, 2) || '-' || substr(hex, 21, 12)
  )::UUID
  FROM h
$$;

-- Roster names: what PlayerNameSchema accepts (trimmed, 1..24 characters, no control characters).
CREATE OR REPLACE FUNCTION vvv_roster_name(p_name TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE
  v_name TEXT := btrim(coalesce(p_name, ''));
BEGIN
  IF v_name = '' OR char_length(v_name) > 24 OR v_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'roster:invalid_name';
  END IF;
  RETURN v_name;
END;
$$;

CREATE OR REPLACE FUNCTION vvv_player_json(p_player players) RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'id', p_player.id,
    'name', p_player.name,
    'is_active', p_player.is_active,
    'is_admin', p_player.is_admin,
    'wins', p_player.wins,
    'losses', p_player.losses,
    'games_played', p_player.games_played,
    'created_at', p_player.created_at,
    'auth_user_id', p_player.auth_user_id
  )
$$;

-- ============================================================
-- GAME RESULTS: counters and +10 / +2 exactly once per game
-- ============================================================

-- One row per recorded game. Not tied to games or sessions by foreign key on purpose: deleting either can never
-- free a game to be counted again.
CREATE TABLE IF NOT EXISTS game_outcome_records (
  game_id UUID PRIMARY KEY,
  session_id UUID NOT NULL UNIQUE,
  winner_side TEXT NOT NULL CHECK (winner_side IN ('blue', 'red')),
  counted BOOLEAN NOT NULL,
  credited INTEGER NOT NULL DEFAULT 0,
  recorded_by UUID,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE game_outcome_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "game_outcome_records_read" ON game_outcome_records;
CREATE POLICY "game_outcome_records_read" ON game_outcome_records FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON game_outcome_records FROM anon, authenticated;

-- Called by the declare flow (lib/session/resolve.ts) once the game row is linked and before the status flips.
-- Writes the game_players seats, bumps wins/losses/games_played and pays every linked player with a treasury
-- (game_win +10, game_participation +2, reference_id = session id), all in one transaction. A second call for the
-- same session or game is a no-op, so the two minute retry of a dead declaration can never count twice.
-- When an earlier app version already wrote the seats, it also moved the counters: only missing points are paid.
CREATE OR REPLACE FUNCTION record_game_outcome(p_session_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session game_sessions%ROWTYPE;
  v_game games%ROWTYPE;
  v_record game_outcome_records%ROWTYPE;
  v_seats INTEGER;
  v_sides INTEGER;
  v_counted BOOLEAN := false;
  v_credited INTEGER := 0;
  v_seat RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'game:not_authenticated'; END IF;

  SELECT * INTO v_session FROM game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'game:session_not_found'; END IF;

  -- The claimant who runs the game (creator, or anyone on a creatorless game), or an admin.
  IF NOT COALESCE(
    vvv_is_admin(v_uid)
    OR (v_session.resolved_by = v_uid AND (v_session.created_by IS NULL OR v_session.created_by = v_uid)),
    false
  ) THEN
    RAISE EXCEPTION 'game:forbidden';
  END IF;

  SELECT * INTO v_record FROM game_outcome_records WHERE session_id = p_session_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'recorded', false, 'already', true, 'game_id', v_record.game_id,
      'winner_side', v_record.winner_side, 'counted', v_record.counted, 'credited', 0
    );
  END IF;

  IF v_session.status <> 'in_game' THEN RAISE EXCEPTION 'game:not_in_game'; END IF;
  IF v_session.game_id IS NULL THEN RAISE EXCEPTION 'game:not_linked'; END IF;

  SELECT * INTO v_game FROM games WHERE id = v_session.game_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'game:not_linked'; END IF;
  -- A rematch has the same ten players: an older game row can never be recorded for a newer session.
  IF v_game.played_at < v_session.created_at THEN RAISE EXCEPTION 'game:game_mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM game_outcome_records WHERE game_id = v_game.id) THEN
    RAISE EXCEPTION 'game:game_already_recorded';
  END IF;

  SELECT count(*), count(DISTINCT side) INTO v_seats, v_sides FROM session_assignments WHERE session_id = p_session_id;
  IF v_seats < 2 OR v_seats > 10 OR v_sides <> 2 THEN RAISE EXCEPTION 'game:invalid_roster'; END IF;

  IF NOT EXISTS (SELECT 1 FROM game_players WHERE game_id = v_game.id) THEN
    INSERT INTO game_players (game_id, player_id, side, lane, champion)
    SELECT v_game.id, sa.player_id, sa.side, sa.lane, sa.champion
    FROM session_assignments sa
    WHERE sa.session_id = p_session_id;

    UPDATE players p SET
      wins = p.wins + CASE WHEN sa.side = v_game.winner_side THEN 1 ELSE 0 END,
      losses = p.losses + CASE WHEN sa.side = v_game.winner_side THEN 0 ELSE 1 END,
      games_played = p.games_played + 1
    FROM session_assignments sa
    WHERE sa.session_id = p_session_id AND sa.player_id = p.id;
    v_counted := true;
  END IF;

  FOR v_seat IN
    SELECT DISTINCT ON (p.auth_user_id) p.auth_user_id AS user_id, sa.side
    FROM session_assignments sa
    JOIN players p ON p.id = sa.player_id
    WHERE sa.session_id = p_session_id
      AND p.auth_user_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM point_balances b WHERE b.user_id = p.auth_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM point_transactions t
        WHERE t.user_id = p.auth_user_id AND t.reference_id = p_session_id
          AND t.reason IN ('game_win', 'game_participation')
      )
    ORDER BY p.auth_user_id
  LOOP
    IF v_seat.side = v_game.winner_side THEN
      PERFORM adjust_balance(v_seat.user_id, 10, 'game_win', p_session_id);
    ELSE
      PERFORM adjust_balance(v_seat.user_id, 2, 'game_participation', p_session_id);
    END IF;
    v_credited := v_credited + 1;
  END LOOP;

  INSERT INTO game_outcome_records (game_id, session_id, winner_side, counted, credited, recorded_by)
  VALUES (v_game.id, p_session_id, v_game.winner_side, v_counted, v_credited, v_uid);

  RETURN jsonb_build_object(
    'recorded', true, 'already', false, 'game_id', v_game.id,
    'winner_side', v_game.winner_side, 'counted', v_counted, 'credited', v_credited
  );
END;
$$;

-- ============================================================
-- ACT REWARDS (app/api/acts/claim-rewards)
-- ============================================================

-- Pays the caller's own act award once. The act_carryover row (reference_id = award id) is the claim marker,
-- also guarded by idx_point_transactions_act_carryover_once from phase10_storytelling.sql.
CREATE OR REPLACE FUNCTION claim_act_award(p_award_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_award act_awards%ROWTYPE;
  v_bonus INTEGER;
  v_balance INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'award:not_authenticated'; END IF;

  SELECT * INTO v_award FROM act_awards WHERE id = p_award_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'award:not_found'; END IF;

  IF EXISTS (
    SELECT 1 FROM point_transactions
    WHERE user_id = v_uid AND reason = 'act_carryover' AND reference_id = v_award.id
  ) THEN
    RAISE EXCEPTION 'award:already_claimed' USING ERRCODE = '23505';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM point_balances WHERE user_id = v_uid) THEN RAISE EXCEPTION 'award:no_balance'; END IF;

  v_bonus := GREATEST(COALESCE(v_award.carry_over_bonus, 0), 0);
  v_balance := adjust_balance(v_uid, v_bonus, 'act_carryover', v_award.id);
  RETURN jsonb_build_object('award_id', v_award.id, 'title', v_award.title, 'bonus', v_bonus, 'balance', v_balance);
END;
$$;

-- Marks the caller's consolation title for an archived act they played without an award (no points move).
CREATE OR REPLACE FUNCTION claim_act_consolation(p_act_id INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ref UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'award:not_authenticated'; END IF;
  IF p_act_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM acts WHERE id = p_act_id AND status = 'archived')
     OR NOT EXISTS (SELECT 1 FROM act_snapshots WHERE act_id = p_act_id AND user_id = v_uid)
     OR EXISTS (SELECT 1 FROM act_awards WHERE act_id = p_act_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'award:not_eligible';
  END IF;

  v_ref := vvv_consolation_ref(p_act_id);
  PERFORM pg_advisory_xact_lock(hashtext('vvv_consolation:' || v_uid::TEXT));
  IF EXISTS (
    SELECT 1 FROM point_transactions WHERE user_id = v_uid AND reason = 'act_carryover' AND reference_id = v_ref
  ) THEN
    RAISE EXCEPTION 'award:already_claimed' USING ERRCODE = '23505';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM point_balances WHERE user_id = v_uid) THEN RAISE EXCEPTION 'award:no_balance'; END IF;

  PERFORM adjust_balance(v_uid, 0, 'act_carryover', v_ref);
  RETURN jsonb_build_object('act_id', p_act_id, 'reference', v_ref);
END;
$$;

-- Act awards hold claimable points: only an admin archiving an act writes them (app/api/admin/archive-act).
-- p_awards: [{ category, user_id, player_id, title, carry_over_bonus, final_value, perks }]. Existing categories
-- for the act are kept, like the old one-insert-per-award loop. Returns how many awards were written.
CREATE OR REPLACE FUNCTION admin_record_act_awards(p_act_id INTEGER, p_awards JSONB) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_item JSONB;
  v_bonus INTEGER;
  v_title TEXT;
  v_count INTEGER := 0;
  v_rows INTEGER;
BEGIN
  IF NOT vvv_is_admin(v_uid) THEN RAISE EXCEPTION 'award:forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM acts WHERE id = p_act_id) THEN RAISE EXCEPTION 'award:act_not_found'; END IF;
  IF p_awards IS NULL OR jsonb_typeof(p_awards) <> 'array' OR jsonb_array_length(p_awards) > 20 THEN
    RAISE EXCEPTION 'award:invalid';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_awards) LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN RAISE EXCEPTION 'award:invalid'; END IF;
    v_bonus := COALESCE((v_item->>'carry_over_bonus')::INTEGER, 0);
    v_title := btrim(coalesce(v_item->>'title', ''));
    IF v_bonus < 0 OR v_bonus > 1000 OR v_title = '' OR char_length(v_title) > 120
       OR (v_item ? 'perks' AND jsonb_typeof(v_item->'perks') <> 'object') THEN
      RAISE EXCEPTION 'award:invalid';
    END IF;

    INSERT INTO act_awards (act_id, user_id, player_id, category, title, carry_over_bonus, final_value, perks)
    VALUES (
      p_act_id,
      (v_item->>'user_id')::UUID,
      NULLIF(v_item->>'player_id', '')::UUID,
      v_item->>'category',
      v_title,
      v_bonus,
      left(v_item->>'final_value', 200),
      COALESCE(v_item->'perks', '{}'::jsonb)
    )
    ON CONFLICT (act_id, category) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_count := v_count + v_rows;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- NEW ACT / ECONOMY RESET (app/api/admin/reset-economy)
-- ============================================================

-- Opens the next act, resets every treasury to 0, grants the act's starting purse to everyone, and gives back the
-- carry-over bonuses of the previous act that were already claimed (the reset just wiped them). Unclaimed
-- bonuses stay claimable through the reward banner, so no bonus is ever paid twice.
CREATE OR REPLACE FUNCTION admin_reset_economy(
  p_name TEXT DEFAULT NULL,
  p_subtitle TEXT DEFAULT NULL,
  p_initial_grant INTEGER DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT := COALESCE(NULLIF(btrim(p_name), ''), 'Act II: The Fallen Crown');
  v_subtitle TEXT := COALESCE(NULLIF(btrim(p_subtitle), ''), 'The Fallen Crown');
  v_grant INTEGER := COALESCE(p_initial_grant, 100);
  v_previous acts%ROWTYPE;
  v_act acts%ROWTYPE;
  v_row RECORD;
  v_granted INTEGER := 0;
  v_carry INTEGER := 0;
  v_carry_points INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'economy:not_authenticated'; END IF;
  IF NOT vvv_is_admin(v_uid) THEN RAISE EXCEPTION 'economy:forbidden'; END IF;
  IF v_grant < 0 OR v_grant > 1000 THEN RAISE EXCEPTION 'economy:invalid_grant'; END IF;
  IF char_length(v_name) > 120 OR char_length(v_subtitle) > 120 THEN RAISE EXCEPTION 'economy:invalid_name'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('vvv_reset_economy'));
  IF EXISTS (SELECT 1 FROM acts WHERE status = 'active') THEN RAISE EXCEPTION 'economy:act_active'; END IF;

  SELECT * INTO v_previous FROM acts WHERE status = 'archived' ORDER BY act_number DESC LIMIT 1;

  INSERT INTO acts (act_number, name, subtitle, status, started_at, initial_grant)
  VALUES ((SELECT COALESCE(max(act_number), 0) + 1 FROM acts), v_name, v_subtitle, 'active', now(), v_grant)
  RETURNING * INTO v_act;

  UPDATE point_balances SET balance = 0, last_daily_claim = NULL, updated_at = now();

  FOR v_row IN SELECT user_id FROM point_balances ORDER BY user_id LOOP
    IF v_grant > 0 THEN
      PERFORM adjust_balance(v_row.user_id, v_grant, 'initial_grant', NULL);
    END IF;
    v_granted := v_granted + 1;
  END LOOP;

  IF v_previous.id IS NOT NULL THEN
    FOR v_row IN
      SELECT a.user_id, SUM(t.amount)::INTEGER AS amount
      FROM act_awards a
      JOIN point_transactions t
        ON t.user_id = a.user_id AND t.reason = 'act_carryover' AND t.reference_id = a.id AND t.amount > 0
      WHERE a.act_id = v_previous.id
        AND EXISTS (SELECT 1 FROM point_balances b WHERE b.user_id = a.user_id)
      GROUP BY a.user_id
      ORDER BY a.user_id
    LOOP
      PERFORM adjust_balance(v_row.user_id, v_row.amount, 'act_carryover', NULL);
      v_carry := v_carry + 1;
      v_carry_points := v_carry_points + v_row.amount;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'act', to_jsonb(v_act),
    'granted', v_granted,
    'initial_grant', v_grant,
    'carry_overs', v_carry,
    'carry_over_points', v_carry_points
  );
END;
$$;

-- ============================================================
-- POINTS: first treasury and the daily stipend for the caller only
-- ============================================================

-- app/api/points/initialize: opens the caller's treasury with the active act's starting purse (0..1000), once.
CREATE OR REPLACE FUNCTION init_my_point_balance() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_grant INTEGER;
  v_balance INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'points:not_authenticated'; END IF;

  SELECT initial_grant INTO v_grant FROM acts WHERE status = 'active' ORDER BY act_number DESC LIMIT 1;
  v_grant := LEAST(GREATEST(COALESCE(v_grant, 100), 0), 1000);

  INSERT INTO point_balances (user_id, balance) VALUES (v_uid, 0) ON CONFLICT (user_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('already_initialized', true);
  END IF;

  v_balance := CASE WHEN v_grant > 0 THEN adjust_balance(v_uid, v_grant, 'initial_grant', NULL) ELSE 0 END;
  RETURN jsonb_build_object('initialized', true, 'balance', v_balance);
END;
$$;

-- app/api/points/daily: the legacy claim_daily_bonus(p_user_id) lets anyone claim for anyone; this one only
-- claims for the caller. Same return value: the new balance, or -1 when today's stipend is already taken.
CREATE OR REPLACE FUNCTION claim_my_daily_bonus() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'points:not_authenticated'; END IF;
  -- Title effects (phase10_title-effects.sql): Still Kneeling doubles it, Salaxe's Emotional Support redirects it.
  RETURN (vvv_title_claim_stipend(v_uid)->>'balance')::INTEGER;
END;
$$;

-- ============================================================
-- IDENTITY: claiming a player (app/api/auth/link-player)
-- ============================================================

-- Links the caller to an unclaimed player, and their profile to it. Refused when the player belongs to someone
-- else or the caller already answers to another player. Claiming your own player again is a no-op.
CREATE OR REPLACE FUNCTION claim_player(p_player_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_player players%ROWTYPE;
  v_profile_player UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'claim:not_authenticated'; END IF;

  -- One claim at a time per caller, so two tabs cannot each grab a different player.
  PERFORM pg_advisory_xact_lock(hashtext('vvv_claim_player:' || v_uid::TEXT));

  SELECT * INTO v_player FROM players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim:not_found'; END IF;
  IF v_player.auth_user_id IS NOT NULL AND v_player.auth_user_id <> v_uid THEN RAISE EXCEPTION 'claim:taken'; END IF;

  SELECT player_id INTO v_profile_player FROM user_profiles WHERE id = v_uid;
  IF EXISTS (SELECT 1 FROM players WHERE auth_user_id = v_uid AND id <> p_player_id)
     OR (v_profile_player IS NOT NULL AND v_profile_player <> p_player_id) THEN
    RAISE EXCEPTION 'claim:has_player';
  END IF;

  IF v_player.auth_user_id IS NULL THEN
    UPDATE players SET auth_user_id = v_uid WHERE id = p_player_id;
  END IF;
  UPDATE user_profiles SET player_id = p_player_id WHERE id = v_uid AND player_id IS DISTINCT FROM p_player_id;

  RETURN jsonb_build_object(
    'player_id', v_player.id,
    'name', v_player.name,
    'newly_claimed', v_player.auth_user_id IS NULL
  );
END;
$$;

-- ============================================================
-- ROSTER (app/api/players): admin only, same rules as the lobby routes
-- ============================================================

CREATE OR REPLACE FUNCTION admin_add_player(p_name TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_name TEXT;
  v_player players%ROWTYPE;
BEGIN
  IF NOT vvv_is_admin(auth.uid()) THEN RAISE EXCEPTION 'roster:forbidden'; END IF;
  v_name := vvv_roster_name(p_name);

  PERFORM pg_advisory_xact_lock(hashtext('vvv_roster'));
  IF EXISTS (SELECT 1 FROM players WHERE lower(btrim(name)) = lower(v_name)) THEN
    RAISE EXCEPTION 'roster:duplicate' USING ERRCODE = '23505';
  END IF;

  INSERT INTO players (name) VALUES (v_name) RETURNING * INTO v_player;
  RETURN vvv_player_json(v_player);
END;
$$;

-- Rename and/or bench / bring back. Benching also drops the player from the queue, like the route did.
CREATE OR REPLACE FUNCTION admin_update_player(
  p_player_id UUID,
  p_name TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_name TEXT;
  v_player players%ROWTYPE;
BEGIN
  IF NOT vvv_is_admin(auth.uid()) THEN RAISE EXCEPTION 'roster:forbidden'; END IF;
  IF p_name IS NULL AND p_is_active IS NULL THEN RAISE EXCEPTION 'roster:nothing_to_change'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('vvv_roster'));
  SELECT * INTO v_player FROM players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'roster:not_found'; END IF;

  IF p_name IS NOT NULL THEN
    v_name := vvv_roster_name(p_name);
    IF EXISTS (SELECT 1 FROM players WHERE id <> p_player_id AND lower(btrim(name)) = lower(v_name)) THEN
      RAISE EXCEPTION 'roster:duplicate' USING ERRCODE = '23505';
    END IF;
  END IF;

  UPDATE players
  SET name = COALESCE(v_name, name), is_active = COALESCE(p_is_active, is_active)
  WHERE id = p_player_id
  RETURNING * INTO v_player;

  IF p_is_active = false THEN
    DELETE FROM player_queue WHERE player_id = p_player_id;
  END IF;

  RETURN vvv_player_json(v_player);
END;
$$;

-- Only clean slates can go: unclaimed, no games, and nothing in any table that points at the player (the queue
-- aside). Deleting would cascade into game history, bounties and their escrow.
CREATE OR REPLACE FUNCTION admin_delete_player(p_player_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_player players%ROWTYPE;
  v_ref RECORD;
  v_found BOOLEAN;
BEGIN
  IF NOT vvv_is_admin(auth.uid()) THEN RAISE EXCEPTION 'roster:forbidden'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('vvv_roster'));
  SELECT * INTO v_player FROM players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'roster:not_found'; END IF;
  IF v_player.auth_user_id IS NOT NULL THEN RAISE EXCEPTION 'roster:claimed'; END IF;
  IF COALESCE(v_player.games_played, 0) > 0 THEN RAISE EXCEPTION 'roster:has_history'; END IF;

  FOR v_ref IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = 'public.players'::regclass AND cardinality(c.conkey) = 1
      AND c.conrelid <> 'public.player_queue'::regclass
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE %I = $1)', v_ref.tbl, v_ref.col) INTO v_found USING p_player_id;
    IF v_found THEN RAISE EXCEPTION 'roster:has_history'; END IF;
  END LOOP;

  DELETE FROM players WHERE id = p_player_id;
  RETURN jsonb_build_object('id', v_player.id, 'name', v_player.name);
END;
$$;

-- ============================================================
-- PRIVILEGES
-- ============================================================

REVOKE EXECUTE ON FUNCTION vvv_is_admin(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_consolation_ref(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_roster_name(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION vvv_player_json(players) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_fn TEXT;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'record_game_outcome(uuid)',
    'claim_act_award(uuid)',
    'claim_act_consolation(integer)',
    'admin_record_act_awards(integer, jsonb)',
    'admin_reset_economy(text, text, integer)',
    'init_my_point_balance()',
    'claim_my_daily_bonus()',
    'claim_player(uuid)',
    'admin_add_player(text)',
    'admin_update_player(uuid, text, boolean)',
    'admin_delete_player(uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', v_fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_fn);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- phase10_title-effects.sql
-- ============================================================

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
