-- Takkar database (Cloudflare D1, SQLite). Follows the SRS data model.
-- Times are ISO 8601 UTC text. "day" columns are IST day numbers (days since 1970-01-01 in IST).

-- ---------- Players ----------
CREATE TABLE users (
  id                  TEXT PRIMARY KEY,
  nickname            TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email               TEXT UNIQUE COLLATE NOCASE,          -- only if signed in (ONB-03)
  sign_in_method      TEXT NOT NULL DEFAULT 'guest',        -- guest | google | email
  age_confirmed_at    TEXT NOT NULL,                        -- ONB-02
  terms_version       TEXT NOT NULL,                        -- ONB-05, PRIV-03
  role                TEXT NOT NULL DEFAULT 'player',       -- player | educator
  status              TEXT NOT NULL DEFAULT 'active',       -- active | suspended | banned | deleted
  muted_until         TEXT,                                 -- reactions muted (MOD-04)
  suspended_until     TEXT,
  plus_until          TEXT,                                 -- Plus active until (paid or granted)
  nickname_changed_at TEXT,
  created_at          TEXT NOT NULL,
  created_day         INTEGER NOT NULL,             -- IST day, for return cohorts (ADMIN-09)
  last_seen_at        TEXT,
  deleted_at          TEXT
);
CREATE INDEX users_status ON users(status);
CREATE INDEX users_created_day ON users(created_day);
CREATE INDEX users_created ON users(created_at);

CREATE TABLE guest_devices (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL,
  last_seen_at TEXT
);

CREATE TABLE streaks (
  user_id         TEXT PRIMARY KEY REFERENCES users(id),
  current         INTEGER NOT NULL DEFAULT 0,
  best            INTEGER NOT NULL DEFAULT 0,
  rest_days_left  INTEGER NOT NULL DEFAULT 0,
  last_day        INTEGER
);

-- ---------- Duels ----------
CREATE TABLE duels (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  seed          INTEGER NOT NULL,                 -- secret, never sent to the phone (SEC-11)
  topic         TEXT NOT NULL,
  level         TEXT NOT NULL,
  marking       TEXT NOT NULL,
  kind          TEXT NOT NULL,                    -- solo | challenge | league | rematch
  rival         TEXT,
  league_id     TEXT,
  challenge_id  TEXT,
  day           INTEGER NOT NULL,
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  status        TEXT NOT NULL DEFAULT 'playing',  -- playing | finished | abandoned
  score         INTEGER NOT NULL DEFAULT 0,
  rival_score   INTEGER NOT NULL DEFAULT 0,
  right_count   INTEGER NOT NULL DEFAULT 0,
  wrong_count   INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  time_ms       INTEGER NOT NULL DEFAULT 0,
  counted       INTEGER NOT NULL DEFAULT 0,       -- counts for ranks and leagues
  scores_reset  INTEGER NOT NULL DEFAULT 0        -- set by a sanction (MOD-04)
);
CREATE INDEX duels_user ON duels(user_id, day);
CREATE INDEX duels_day ON duels(day, status);
CREATE INDEX duels_league ON duels(league_id, day);

CREATE TABLE duel_answers (
  duel_id     TEXT NOT NULL REFERENCES duels(id),
  q_index     INTEGER NOT NULL,
  template    TEXT NOT NULL,
  served_at   TEXT NOT NULL,
  answered_at TEXT,
  choice      INTEGER,
  correct     INTEGER NOT NULL DEFAULT 0,
  points      INTEGER NOT NULL DEFAULT 0,
  time_ms     INTEGER,
  PRIMARY KEY (duel_id, q_index)
);
CREATE INDEX duel_answers_template ON duel_answers(template);

CREATE TABLE challenges (
  id            TEXT PRIMARY KEY,
  duel_id       TEXT NOT NULL REFERENCES duels(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  expires_at    TEXT NOT NULL,
  opened_count  INTEGER NOT NULL DEFAULT 0,
  played_count  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

-- ---------- Leagues and educators ----------
CREATE TABLE leagues (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  owner_id       TEXT NOT NULL REFERENCES users(id),
  level          TEXT NOT NULL DEFAULT 'exam',
  approval       INTEGER NOT NULL DEFAULT 1,
  invite_code    TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'pending',  -- pending | live | closed (LEAG-08)
  created_at     TEXT NOT NULL,
  closed_at      TEXT,
  closed_reason  TEXT
);
CREATE INDEX leagues_status ON leagues(status);

CREATE TABLE league_members (
  league_id  TEXT NOT NULL REFERENCES leagues(id),
  user_id    TEXT NOT NULL REFERENCES users(id),
  joined_at  TEXT NOT NULL,
  state      TEXT NOT NULL DEFAULT 'member',       -- pending | member | removed | left
  PRIMARY KEY (league_id, user_id)
);

CREATE TABLE educator_requests (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  channel_name TEXT NOT NULL,
  channel_url  TEXT,
  followers    INTEGER,
  note         TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',    -- pending | approved | rejected
  decided_by   TEXT,
  decided_at   TEXT,
  created_at   TEXT NOT NULL
);

-- ---------- Squads ----------
CREATE TABLE squads (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  owner_id    TEXT NOT NULL REFERENCES users(id),
  status      TEXT NOT NULL DEFAULT 'active',      -- active | closed
  created_at  TEXT NOT NULL
);
CREATE TABLE squad_members (
  squad_id   TEXT NOT NULL REFERENCES squads(id),
  user_id    TEXT NOT NULL REFERENCES users(id),
  joined_at  TEXT NOT NULL,
  state      TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (squad_id, user_id)
);
CREATE TABLE reactions (
  id         TEXT PRIMARY KEY,
  squad_id   TEXT NOT NULL,
  from_user  TEXT NOT NULL,
  reaction   TEXT NOT NULL,                        -- one of 6 preset IDs (SQUAD-03)
  created_at TEXT NOT NULL
);

-- ---------- Money ----------
CREATE TABLE subscriptions (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id),
  source             TEXT NOT NULL DEFAULT 'razorpay', -- razorpay | grant
  provider_id        TEXT,                              -- Razorpay subscription id
  status             TEXT NOT NULL,                     -- active | cancelled | ended | past_due
  amount_paise       INTEGER NOT NULL DEFAULT 0,
  current_period_end TEXT,
  granted_by         TEXT,
  created_at         TEXT NOT NULL,
  cancelled_at       TEXT
);
CREATE INDEX subscriptions_user ON subscriptions(user_id);

CREATE TABLE payments (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  subscription_id TEXT,
  provider_id   TEXT,                               -- Razorpay payment id
  amount_paise  INTEGER NOT NULL,
  refunded_paise INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL,                      -- captured | failed | refunded | partially_refunded
  coupon_code   TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX payments_user ON payments(user_id);
CREATE INDEX payments_created ON payments(created_at);

CREATE TABLE refunds (
  id           TEXT PRIMARY KEY,
  payment_id   TEXT NOT NULL REFERENCES payments(id),
  amount_paise INTEGER NOT NULL,
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL,                       -- processed | manual | failed
  admin_id     TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE TABLE coupons (
  code        TEXT PRIMARY KEY COLLATE NOCASE,
  percent_off INTEGER NOT NULL CHECK (percent_off BETWEEN 1 AND 100),
  ends_at     TEXT NOT NULL,
  max_uses    INTEGER,
  used_count  INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active',       -- active | disabled
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

-- ---------- Questions ----------
CREATE TABLE templates (
  id          TEXT PRIMARY KEY,                     -- engine template id
  label       TEXT NOT NULL,
  topic       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active',       -- active | paused | retired (QGEN-06, ADMIN-05)
  reason      TEXT,
  updated_at  TEXT,
  updated_by  TEXT
);

CREATE TABLE question_flags (
  id            TEXT PRIMARY KEY,
  template      TEXT NOT NULL,
  question_text TEXT NOT NULL,
  user_id       TEXT,
  reason        TEXT NOT NULL DEFAULT 'wrong',      -- wrong | unclear
  status        TEXT NOT NULL DEFAULT 'open',       -- open | reviewed
  created_at    TEXT NOT NULL
);
CREATE INDEX flags_template ON question_flags(template, created_at);

CREATE TABLE question_drafts (
  id           TEXT PRIMARY KEY,
  topic        TEXT NOT NULL,
  label        TEXT,
  text         TEXT NOT NULL,
  options      TEXT NOT NULL,                       -- JSON array of 4 strings
  answer_index INTEGER NOT NULL CHECK (answer_index BETWEEN 0 AND 3),
  solution     TEXT NOT NULL,
  source       TEXT,                                -- required before approval (QGEN-07)
  status       TEXT NOT NULL DEFAULT 'draft',       -- draft | approved | rejected | retired
  created_by   TEXT NOT NULL,
  decided_by   TEXT,
  decided_at   TEXT,
  created_at   TEXT NOT NULL
);

-- ---------- Moderation ----------
CREATE TABLE reports (
  id             TEXT PRIMARY KEY,
  kind           TEXT NOT NULL,      -- nickname | squad_name | league_name | cheating | under_18 | harassment | other
  target_user_id TEXT,
  target_ref     TEXT,               -- squad or league id when the report is about a name
  reporter_id    TEXT,               -- NULL when raised by the system (MOD-03)
  details        TEXT,
  severity       INTEGER NOT NULL DEFAULT 2,   -- 1 highest
  status         TEXT NOT NULL DEFAULT 'open', -- open | resolved | dismissed
  resolution     TEXT,
  resolved_by    TEXT,
  resolved_at    TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX reports_open ON reports(status, severity, created_at);

CREATE TABLE sanctions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  kind       TEXT NOT NULL,          -- warn | mute | unmute | reset_scores | suspend | restore | ban | rename | delete_data | grant_plus | revoke_plus
  reason     TEXT NOT NULL,
  until      TEXT,
  admin_id   TEXT NOT NULL,
  report_id  TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX sanctions_user ON sanctions(user_id, created_at);

CREATE TABLE word_filter (
  word      TEXT PRIMARY KEY COLLATE NOCASE,
  added_by  TEXT NOT NULL,
  added_at  TEXT NOT NULL
);

CREATE TABLE announcements (
  id         TEXT PRIMARY KEY,
  text       TEXT NOT NULL,
  scope      TEXT NOT NULL DEFAULT 'all',   -- all | league (ADMIN-11)
  league_id  TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ended_at   TEXT
);

-- ---------- Settings (switches, limits, price), always with history ----------
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,                  -- JSON
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
CREATE TABLE settings_history (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  key       TEXT NOT NULL,
  value     TEXT NOT NULL,
  at        TEXT NOT NULL,
  admin_id  TEXT
);

-- ---------- Analytics (first-party only, ANLY-01) ----------
CREATE TABLE events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  anon_id  TEXT NOT NULL,
  name     TEXT NOT NULL,     -- ANLY-02 event names
  day      INTEGER NOT NULL,
  at       TEXT NOT NULL,
  props    TEXT
);
CREATE INDEX events_day_name ON events(day, name);

-- ---------- Admins (owner and moderators) ----------
CREATE TABLE admins (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('owner', 'moderator')),
  password_hash   TEXT,                     -- pbkdf2-sha256$iterations$salt$hash
  totp_secret_enc TEXT,                     -- AES-GCM encrypted (SEC-01)
  totp_last_counter INTEGER NOT NULL DEFAULT -1, -- each code works once
  status          TEXT NOT NULL DEFAULT 'invited',  -- invited | active | disabled
  failed_logins   INTEGER NOT NULL DEFAULT 0,
  locked_until    TEXT,
  last_login_at   TEXT,
  created_at      TEXT NOT NULL
);

CREATE TABLE admin_invites (
  token_hash  TEXT PRIMARY KEY,
  admin_id    TEXT NOT NULL REFERENCES admins(id),
  purpose     TEXT NOT NULL DEFAULT 'setup',   -- setup | reset
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_by  TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE admin_sessions (
  id_hash      TEXT PRIMARY KEY,               -- the cookie holds the token; we store its hash
  admin_id     TEXT NOT NULL REFERENCES admins(id),
  csrf         TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at   TEXT NOT NULL,                  -- 12 hours absolute (SEC-02)
  user_agent   TEXT,
  revoked_at   TEXT
);
CREATE INDEX admin_sessions_admin ON admin_sessions(admin_id);

-- Sign-in attempts for rate limiting (SEC-08)
CREATE TABLE login_attempts (
  key  TEXT NOT NULL,
  at   TEXT NOT NULL
);
CREATE INDEX login_attempts_key ON login_attempts(key, at);

-- Half-finished sign-ins waiting for the authenticator code
CREATE TABLE login_challenges (
  token_hash TEXT PRIMARY KEY,
  admin_id   TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0
);

-- ---------- Audit log: append-only, nobody can edit or delete (ADMIN-08, SEC-04) ----------
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL,
  admin_id    TEXT,
  admin_email TEXT,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  reason      TEXT,
  details     TEXT
);
CREATE INDEX audit_at ON audit_log(at);
CREATE INDEX audit_target ON audit_log(target_type, target_id);

CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
