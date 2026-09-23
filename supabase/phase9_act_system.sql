-- Phase 9: Act System + Act 2 Features
-- Adds acts, awards, snapshots, titles, bounties, prophecies, and draft sabotage

-- ============================================================
-- ACTS SYSTEM
-- ============================================================

CREATE TABLE acts (
  id SERIAL PRIMARY KEY,
  act_number INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subtitle TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('active', 'archived', 'upcoming')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  initial_grant INTEGER NOT NULL DEFAULT 100,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_one_active_act ON acts ((true)) WHERE status = 'active';

CREATE TABLE act_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  act_id INTEGER NOT NULL REFERENCES acts(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  player_id UUID REFERENCES players(id),
  category TEXT NOT NULL CHECK (category IN (
    'treasury', 'warrior', 'iron_man', 'degenerate', 'devotee', 'punching_bag', 'grand_champion'
  )),
  title TEXT NOT NULL,
  carry_over_bonus INTEGER NOT NULL DEFAULT 0,
  final_value TEXT,
  perks JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (act_id, category)
);

CREATE TABLE act_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  act_id INTEGER NOT NULL REFERENCES acts(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  player_name TEXT,
  username TEXT,
  avatar_url TEXT,
  final_balance INTEGER NOT NULL,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  total_bets INTEGER NOT NULL DEFAULT 0,
  total_kisses INTEGER NOT NULL DEFAULT 0,
  total_shames_received INTEGER NOT NULL DEFAULT 0,
  total_games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  win_rate NUMERIC(5,2),
  rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (act_id, user_id)
);

-- Seed Act 1 as archived (started_at = earliest game)
INSERT INTO acts (act_number, name, subtitle, status, started_at, ended_at, initial_grant)
VALUES (
  1,
  'Act I: The Reign of Salaxe',
  'The Reign of Salaxe',
  'archived',
  COALESCE((SELECT MIN(played_at) FROM games), now() - interval '90 days'),
  now(),
  50
);

-- ============================================================
-- TITLES SYSTEM
-- ============================================================

CREATE TABLE titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  category TEXT NOT NULL CHECK (category IN ('rebellion', 'mockery', 'loyalty', 'absurd', 'award')),
  for_self BOOLEAN NOT NULL DEFAULT true,
  act_id INTEGER REFERENCES acts(id),
  is_permanent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, title_id)
);

CREATE INDEX idx_user_titles_user ON user_titles(user_id);
CREATE INDEX idx_user_titles_active ON user_titles(user_id) WHERE is_active = true;

-- Seed shop titles
INSERT INTO titles (name, description, price, category, for_self) VALUES
  ('The Usurper', 'Who needs a crown when you have a winrate?', 80, 'rebellion', true),
  ('Kingslayer', 'Ended a dynasty. It was not hard.', 100, 'rebellion', true),
  ('Crown Thief', 'Finders keepers.', 60, 'rebellion', true),
  ('The Disrespector', 'Called Him "bro." Did not flinch.', 70, 'rebellion', true),
  ('The One Who Stopped Kneeling', 'Back problems. Or dignity. Same thing.', 90, 'rebellion', true),
  ('Court Jester', 'Funny hat mandatory.', 120, 'mockery', false),
  ('Boot Licker', 'Tongue still brown.', 100, 'mockery', false),
  ('Royal Carpet', 'Gets walked on. Enjoys it.', 80, 'mockery', false),
  ('Salaxe''s Emotional Support', 'Unpaid. Overworked.', 110, 'mockery', false),
  ('The Crawling One', 'Always on their knees. Not in a cool way.', 90, 'mockery', false),
  ('Last Loyalist', 'When everyone left, this one stayed. Questionable judgment.', 70, 'loyalty', true),
  ('Still Kneeling', 'Did not get the memo about the rebellion.', 60, 'loyalty', true),
  ('Throne Polisher', 'The throne is empty but spotless.', 50, 'loyalty', true),
  ('The Holdout', 'Believes Salaxe will return. Adorable.', 65, 'loyalty', true),
  ('Copium Dealer', 'Supplies the fallen king with hope.', 75, 'loyalty', true),
  ('Baron Caller (Derogatory)', 'Pings Baron. Dies alone. Every time.', 85, 'absurd', true),
  ('The 0/8 Powerspike', 'It is always darkest before the 0/9.', 90, 'absurd', true),
  ('Delayed Victory Specialist', 'Has never lost. Just runs out of time. Every game.', 95, 'absurd', true),
  ('Main Character (Self-Diagnosed)', 'Nobody agreed to be a side character in your anime.', 80, 'absurd', true),
  ('El Goblino Pequeno', 'Like EL Salaxino Goblino but worse in every way.', 100, 'absurd', true);

-- Award titles (permanent, price 0, assigned automatically)
INSERT INTO titles (name, description, price, category, for_self, is_permanent) VALUES
  ('Act I Grand Champion', 'Ruler of Act I. The one Salaxe fears.', 0, 'award', true, true),
  ('Act I Warrior', 'Highest win rate in Act I. Built different.', 0, 'award', true, true),
  ('Act I Iron Man', 'Most games played in Act I. No life detected.', 0, 'award', true, true),
  ('Act I Degenerate', 'Most bets placed in Act I. Professional gambler.', 0, 'award', true, true),
  ('Act I Devotee', 'Most kisses in Act I. Salaxe''s number one fan.', 0, 'award', true, true),
  ('Act I Punching Bag', 'Most shamed in Act I. Somehow still here.', 0, 'award', true, true);

-- ============================================================
-- BOUNTY SYSTEM
-- ============================================================

CREATE TABLE bounties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount >= 10),
  payout_multiplier NUMERIC(3,1) NOT NULL DEFAULT 1.5,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'claimed', 'failed', 'expired', 'refunded')),
  resolved_session_id UUID REFERENCES game_sessions(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bounties_status ON bounties(status) WHERE status = 'active';
CREATE INDEX idx_bounties_target ON bounties(target_player_id);
CREATE INDEX idx_bounties_poster ON bounties(poster_user_id);
CREATE UNIQUE INDEX idx_one_active_bounty_per_poster
  ON bounties (poster_user_id) WHERE status = 'active';

-- ============================================================
-- PROPHECY SYSTEM
-- ============================================================

CREATE TABLE prophecies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  prediction_type TEXT NOT NULL CHECK (prediction_type IN (
    'player_gets_lane', 'player_most_kills', 'side_wins_fast'
  )),
  prediction_value JSONB NOT NULL,
  multiplier NUMERIC(3,1) NOT NULL DEFAULT 2.0,
  correct BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

CREATE INDEX idx_prophecies_session ON prophecies(session_id);
CREATE INDEX idx_prophecies_user ON prophecies(user_id);

-- ============================================================
-- DRAFT SABOTAGE (extends chaos_actions)
-- ============================================================

ALTER TABLE chaos_actions DROP CONSTRAINT IF EXISTS chaos_actions_action_type_check;
ALTER TABLE chaos_actions ADD CONSTRAINT chaos_actions_action_type_check
  CHECK (action_type IN (
    'double_or_nothing', 'swap_teammate', 'reroll_self',
    'shuffle_lanes', 'reroll_champs', 'target_reroll',
    'champion_ban', 'lane_force'
  ));

ALTER TABLE chaos_actions ADD COLUMN IF NOT EXISTS banned_champion TEXT;
ALTER TABLE chaos_actions ADD COLUMN IF NOT EXISTS forced_lane TEXT
  CHECK (forced_lane IS NULL OR forced_lane IN ('top', 'jungle', 'mid', 'adc', 'support'));

-- ============================================================
-- UPDATED POINT TRANSACTION REASONS
-- ============================================================

ALTER TABLE point_transactions DROP CONSTRAINT point_transactions_reason_check;
ALTER TABLE point_transactions ADD CONSTRAINT point_transactions_reason_check
  CHECK (reason IN (
    'initial_grant', 'daily_bonus', 'game_win', 'game_participation',
    'bet_placed', 'bet_won', 'bet_refunded', 'kiss_the_hand',
    'chaos_spent', 'chaos_won', 'chaos_refunded',
    'insurance_bought', 'insurance_payout', 'insurance_refunded',
    'shame_spent',
    'act_carryover', 'sing_his_praises',
    'title_bought', 'bounty_placed', 'bounty_claimed', 'bounty_expired_refund',
    'prophecy_bonus', 'sabotage_spent'
  ));

-- ============================================================
-- BOUNTY RESOLUTION FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION resolve_bounties(
  p_session_id UUID,
  p_loser_player_ids UUID[]
) RETURNS VOID AS $$
DECLARE
  bounty_record RECORD;
  payout INTEGER;
BEGIN
  FOR bounty_record IN
    SELECT b.id, b.poster_user_id, b.amount, b.payout_multiplier, b.target_player_id
    FROM bounties b
    WHERE b.status = 'active'
      AND b.target_player_id = ANY(p_loser_player_ids)
      AND b.expires_at > now()
  LOOP
    payout := FLOOR(bounty_record.amount * bounty_record.payout_multiplier);

    UPDATE bounties
    SET status = 'claimed', resolved_session_id = p_session_id
    WHERE id = bounty_record.id;

    PERFORM adjust_balance(
      bounty_record.poster_user_id,
      payout,
      'bounty_claimed',
      p_session_id
    );
  END LOOP;

  -- Fail bounties on winners (target played but won)
  UPDATE bounties
  SET status = 'failed', resolved_session_id = p_session_id
  WHERE status = 'active'
    AND target_player_id NOT IN (SELECT unnest(p_loser_player_ids))
    AND target_player_id IN (
      SELECT sa.player_id FROM session_assignments sa WHERE sa.session_id = p_session_id
    )
    AND expires_at > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
