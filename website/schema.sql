-- Early-access list for takkar.info. Apply with:
--   npx wrangler d1 execute takkar-web --remote --file=schema.sql
-- Retention: delete the whole table 90 days after the launch email is sent
-- (to be added to the SRS data model and the privacy notice).

CREATE TABLE IF NOT EXISTS waitlist (
  email              TEXT PRIMARY KEY,
  adult_confirmed_at TEXT NOT NULL,
  notice_version     TEXT NOT NULL,
  created_at         TEXT NOT NULL
);
