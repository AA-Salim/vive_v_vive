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
