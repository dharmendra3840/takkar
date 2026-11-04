-- Live tests in tutor leagues (Live tests (beta) tab, LIVE-01 to LIVE-19; design/03 §3.4).
-- The paper (questions and answer key) lives only in live_tests.paper, which no player endpoint returns.

CREATE TABLE live_tests (
  id               TEXT PRIMARY KEY,
  league_id        TEXT NOT NULL REFERENCES leagues(id),
  title            TEXT NOT NULL,
  exam_id          TEXT NOT NULL,
  topics           TEXT NOT NULL,          -- JSON: topic labels the tutor picked ([] = all, by the exam's weights)
  difficulty       TEXT NOT NULL,          -- easy | exam | hard
  question_count   INTEGER NOT NULL,
  quant_count      INTEGER NOT NULL,       -- the paper's first quant_count questions are the quant section
  starts_at        TEXT NOT NULL,
  late_minutes     INTEGER NOT NULL,       -- 5 or 10
  duration_minutes INTEGER NOT NULL,
  closes_at        TEXT NOT NULL,          -- starts_at + late_minutes + duration_minutes
  status           TEXT NOT NULL DEFAULT 'scheduled',  -- scheduled | cancelled | released (open, running, ended follow from the clock)
  seed             INTEGER NOT NULL,
  set_version      INTEGER NOT NULL,
  paper            TEXT NOT NULL,          -- JSON: the questions, in both languages, with the answer key
  created_by       TEXT NOT NULL REFERENCES users(id),
  created_at       TEXT NOT NULL,
  cancelled_at     TEXT,
  marked_at        TEXT,                   -- scores and ranks worked out (after closes_at)
  released_at      TEXT
);
CREATE INDEX live_tests_league ON live_tests(league_id, starts_at);

CREATE TABLE live_attempts (
  test_id       TEXT NOT NULL REFERENCES live_tests(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  started_at    TEXT NOT NULL,
  ends_at       TEXT NOT NULL,             -- started_at + duration
  submitted_at  TEXT,                      -- set on submit, or at ends_at when the time ran out
  order_seed    INTEGER NOT NULL,          -- this student's question and option order
  answers       TEXT NOT NULL DEFAULT '{}', -- JSON by paper index: { c: choice in the student's order | null, f: flagged, r: review, s: seconds }
  app_leaves    INTEGER NOT NULL DEFAULT 0,
  web           INTEGER NOT NULL DEFAULT 0, -- sat in a browser (screenshots can't be blocked there)
  score_x12     INTEGER,
  right_count   INTEGER,
  wrong_count   INTEGER,
  skipped_count INTEGER,
  time_ms       INTEGER,
  rank          INTEGER,
  PRIMARY KEY (test_id, user_id)
);
CREATE INDEX live_attempts_user ON live_attempts(user_id, started_at);

-- Beta limits (admin settings): live tests on, 2 a day per league.
INSERT INTO settings (key, value, updated_at, updated_by) VALUES ('switch.live_tests', 'true', '2026-11-04T00:00:00.000Z', 'system');
INSERT INTO settings_history (key, value, at, admin_id) VALUES ('switch.live_tests', 'true', '2026-11-04T00:00:00.000Z', 'system');
INSERT INTO settings (key, value, updated_at, updated_by) VALUES ('limit.live_tests_per_day', '2', '2026-11-04T00:00:00.000Z', 'system');
INSERT INTO settings_history (key, value, at, admin_id) VALUES ('limit.live_tests_per_day', '2', '2026-11-04T00:00:00.000Z', 'system');
