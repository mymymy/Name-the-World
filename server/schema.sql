-- The leaderboard, as one table.
--
-- One row per player per game, not one per attempt. A board of every run
-- anyone ever finished is mostly one keen person, and it gives whoever wants
-- to spoil it an easy way to: post a thousand runs and nobody else is visible.
-- Keeping only each player's best caps both.

CREATE TABLE IF NOT EXISTS runs (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  game   TEXT    NOT NULL,          -- 'world/all', 'boroughs/all', ...
  name   TEXT    NOT NULL,          -- as typed, after cleaning
  fold   TEXT    NOT NULL,          -- lowercased, for deciding who is who
  score  INTEGER NOT NULL,
  total  INTEGER NOT NULL,
  ms     INTEGER NOT NULL,
  at     INTEGER NOT NULL,          -- epoch milliseconds
  ip     TEXT    NOT NULL           -- salted hash, for rate limiting only
);

-- one row per player per game: an upsert keeps whichever run was better
CREATE UNIQUE INDEX IF NOT EXISTS runs_player ON runs(game, fold);

-- the board's own order: most named, then quickest
CREATE INDEX IF NOT EXISTS runs_board ON runs(game, score DESC, ms ASC);

-- how many this address has posted lately
CREATE INDEX IF NOT EXISTS runs_rate ON runs(ip, at);
