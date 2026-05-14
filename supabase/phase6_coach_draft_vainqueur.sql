-- Phase 6: Coach Draft + Vainqueur

-- Add game_mode and coach columns to game_sessions
ALTER TABLE game_sessions ADD COLUMN game_mode TEXT NOT NULL DEFAULT 'standard'
  CHECK (game_mode IN ('standard', 'coach_draft', 'vainqueur'));
ALTER TABLE game_sessions ADD COLUMN blue_coach_id UUID REFERENCES auth.users(id);
ALTER TABLE game_sessions ADD COLUMN red_coach_id UUID REFERENCES auth.users(id);
ALTER TABLE game_sessions ADD COLUMN draft_turn TEXT CHECK (draft_turn IN ('blue', 'red'));

-- Update status constraint to include coach_draft
ALTER TABLE game_sessions DROP CONSTRAINT game_sessions_status_check;
ALTER TABLE game_sessions ADD CONSTRAINT game_sessions_status_check
  CHECK (status IN ('coach_draft', 'draft', 'chaos', 'betting', 'in_game', 'blue_win', 'red_win', 'canceled', 'expired'));

-- Update active session unique index to include coach_draft
DROP INDEX IF EXISTS idx_one_active_session;
CREATE UNIQUE INDEX idx_one_active_session
  ON game_sessions ((true))
  WHERE status IN ('coach_draft', 'draft', 'chaos', 'betting', 'in_game');

-- Update status index
DROP INDEX IF EXISTS idx_game_sessions_status;
CREATE INDEX idx_game_sessions_status ON game_sessions(status)
  WHERE status IN ('coach_draft', 'draft', 'chaos', 'betting', 'in_game');

-- Coach draft picks table
CREATE TABLE coach_draft_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  pick_number INTEGER NOT NULL,
  player_id UUID NOT NULL REFERENCES players(id),
  side TEXT NOT NULL CHECK (side IN ('blue', 'red')),
  lane TEXT CHECK (lane IN ('top', 'jungle', 'mid', 'adc', 'support')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, pick_number),
  UNIQUE (session_id, player_id)
);
CREATE INDEX idx_coach_draft_picks_session ON coach_draft_picks(session_id);

-- Player queue for vainqueur rotation
CREATE TABLE player_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE UNIQUE,
  position INTEGER NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_player_queue_position ON player_queue(position);

-- Vainqueur state singleton
CREATE TABLE vainqueur_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN NOT NULL DEFAULT false,
  winning_player_ids UUID[] DEFAULT '{}',
  losing_player_ids UUID[] DEFAULT '{}',
  loser_volunteers UUID[] DEFAULT '{}',
  last_session_id UUID REFERENCES game_sessions(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO vainqueur_state (is_active) VALUES (false);
