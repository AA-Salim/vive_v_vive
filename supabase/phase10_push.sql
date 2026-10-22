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
