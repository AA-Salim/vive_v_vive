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
