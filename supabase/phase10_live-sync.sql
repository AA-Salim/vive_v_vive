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
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' OR octet_length(p_data::text) > 4096 THEN
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
