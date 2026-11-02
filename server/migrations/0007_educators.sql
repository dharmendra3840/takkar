-- Educator verification (Live tests tab, EDU-01 to EDU-08): tutors apply in the app and prove they
-- control the channel or centre they name. No identity documents are collected.

-- youtube | instagram | telegram | website | in_person
ALTER TABLE educator_requests ADD COLUMN platform TEXT;
ALTER TABLE educator_requests ADD COLUMN exams TEXT;              -- JSON array of exam ids
ALTER TABLE educator_requests ADD COLUMN proof_code TEXT;         -- e.g. TAKKAR-7F3K, none for in person
ALTER TABLE educator_requests ADD COLUMN proof_expires_at TEXT;
ALTER TABLE educator_requests ADD COLUMN verified_by TEXT;        -- code | domain | call | in_person
ALTER TABLE educator_requests ADD COLUMN decision_note TEXT;      -- shown to the applicant
CREATE INDEX educator_requests_user ON educator_requests(user_id, created_at);

ALTER TABLE users ADD COLUMN educator_terms_version TEXT;
ALTER TABLE users ADD COLUMN educator_terms_at TEXT;

-- Applications open; the admin can close them.
INSERT INTO settings (key, value, updated_at, updated_by) VALUES ('switch.educator_applications', 'true', '2026-10-30T00:00:00.000Z', 'system');
INSERT INTO settings_history (key, value, at, admin_id) VALUES ('switch.educator_applications', 'true', '2026-10-30T00:00:00.000Z', 'system');
