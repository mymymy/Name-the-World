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


-- Which places are hard, and which get named first.
--
-- Counters, not events. The obvious way round is a row per answer, which for
-- the world game is two hundred rows a run and grows without end; and a table
-- of who named what in which order is a record of a person's session, which is
-- not something this game should be keeping. So the sequence is turned into
-- counters in the same request that carries it and then thrown away. What is
-- left is one row per place per game - about seven hundred and thirty rows in
-- total, forever, however many people play.
--
-- Nothing here can be tied to a person: no session, no address, no time beyond
-- when the row was last touched.

CREATE TABLE IF NOT EXISTS picks (
  game  TEXT    NOT NULL,           -- 'world/all', 'boroughs/all', ...
  code  TEXT    NOT NULL,           -- 'FRA', 'LB-Barnet', ...
  got   INTEGER NOT NULL DEFAULT 0, -- runs that reached it at all
  hit   INTEGER NOT NULL DEFAULT 0, -- ... and named it right
  miss  INTEGER NOT NULL DEFAULT 0, -- ... and named it wrong
  told  INTEGER NOT NULL DEFAULT 0, -- ... and asked to be shown
  opens INTEGER NOT NULL DEFAULT 0, -- runs that started on it
  posn  INTEGER NOT NULL DEFAULT 0, -- sum of the places in the order it was taken
  at    INTEGER NOT NULL DEFAULT 0, -- last touched
  PRIMARY KEY (game, code)
);

-- How many runs each game has had. Kept apart from the places so that a run
-- writes a row only for what it actually reached: a game of two hundred that
-- somebody gave five minutes should cost five rows and not two hundred. It is
-- also the denominator - got/runs is how often a place is even arrived at,
-- which is a different kind of hard from getting it wrong.
CREATE TABLE IF NOT EXISTS games (
  game TEXT    PRIMARY KEY,
  runs INTEGER NOT NULL DEFAULT 0,
  at   INTEGER NOT NULL DEFAULT 0
);

-- Reports carry no name and beat no rate limit of their own, so they get one:
-- a row per accepted report, counted per address over the last hour and then
-- forgotten. The address is salted and hashed exactly as it is for the board.
CREATE TABLE IF NOT EXISTS beats (
  ip TEXT    NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS beats_rate ON beats(ip, at);
