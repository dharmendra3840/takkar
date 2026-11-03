-- Live friend duels (design/03-duels-squads-leagues-rooms.md 3.1, 06-data-and-api.md 6.3).
-- A DuelRoom Durable Object runs each duel; this table is its record, and each player's
-- result is also written to duels (kind 'live'), so history and streaks work as for any duel.

CREATE TABLE friend_duels (
  id           TEXT PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,              -- 6 letters, shared as a link or typed in
  exam_id      TEXT NOT NULL,                     -- the host's exam; both play its pattern
  seed         INTEGER NOT NULL,                  -- secret: questions are served one at a time
  set_version  INTEGER NOT NULL,
  host_id      TEXT NOT NULL REFERENCES users(id),
  guest_id     TEXT REFERENCES users(id),         -- set by the first player to join, or by a squad invite
  squad_id     TEXT,                              -- started from a squad page
  status       TEXT NOT NULL DEFAULT 'lobby',     -- lobby | live | done | expired
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,                     -- the lobby closes 10 minutes after it opens
  started_at   TEXT,
  finished_at  TEXT,
  host_score   REAL,
  guest_score  REAL,
  winner_id    TEXT,                              -- null for a tie
  left_id      TEXT                               -- a player who left mid-duel (it counts as a loss)
);
CREATE INDEX friend_duels_host ON friend_duels(host_id, created_at);
CREATE INDEX friend_duels_guest ON friend_duels(guest_id, created_at);

-- One-minute tickets to open the live connection, so the session token never goes in a URL.
CREATE TABLE live_tickets (
  ticket_hash TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  duel_id     TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
