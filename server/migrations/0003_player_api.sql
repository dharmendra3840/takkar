-- Player API (beta 0.2.0): sign-in with Google or phone (through Firebase),
-- player sessions, rate limits and app-version settings.

-- Firebase user id: one Takkar account per Google account or phone number.
ALTER TABLE users ADD COLUMN firebase_uid TEXT;
CREATE UNIQUE INDEX users_firebase_uid ON users(firebase_uid) WHERE firebase_uid IS NOT NULL;
-- Last 4 digits only, so support can confirm an account without storing the number.
ALTER TABLE users ADD COLUMN phone_last4 TEXT;

-- Won, lost or tied, as the app worked it out (ties go to the faster player).
ALTER TABLE duels ADD COLUMN verdict TEXT;

-- The app gets a random token; only its SHA-256 is stored (like admin sessions).
CREATE TABLE player_sessions (
  token_hash   TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at   TEXT NOT NULL
);
CREATE INDEX player_sessions_user ON player_sessions(user_id);

-- Fixed-window counters for the public API. Keys hold a hash, never a raw IP.
CREATE TABLE rate_limits (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);

-- App builds (Android versionCode). Older than min: must update. Older than latest: may update.
INSERT INTO settings (key, value, updated_at, updated_by) VALUES ('app.latest_build', '2', '2026-10-20T00:00:00.000Z', 'system');
INSERT INTO settings_history (key, value, at, admin_id) VALUES ('app.latest_build', '2', '2026-10-20T00:00:00.000Z', 'system');
INSERT INTO settings (key, value, updated_at, updated_by) VALUES ('app.min_build', '1', '2026-10-20T00:00:00.000Z', 'system');
INSERT INTO settings_history (key, value, at, admin_id) VALUES ('app.min_build', '1', '2026-10-20T00:00:00.000Z', 'system');
