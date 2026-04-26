CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  winner_side TEXT NOT NULL CHECK (winner_side IN ('blue', 'red'))
);

CREATE TABLE game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('blue', 'red')),
  lane TEXT NOT NULL CHECK (lane IN ('top', 'jungle', 'mid', 'adc', 'support')),
  champion TEXT NOT NULL
);

CREATE TABLE daily_fearless (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  champion_name TEXT NOT NULL,
  UNIQUE (date, champion_name)
);

CREATE INDEX idx_game_players_game_id ON game_players(game_id);
CREATE INDEX idx_game_players_player_id ON game_players(player_id);
CREATE INDEX idx_daily_fearless_date ON daily_fearless(date);
