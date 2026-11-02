-- Real tutor leagues (Live tests tab, LIVE-14, LIVE-16, LIVE-17): only verified educators create them,
-- each league has one exam pattern, students join with a code and give their real name to the tutor.

ALTER TABLE leagues ADD COLUMN exam_id TEXT;
ALTER TABLE leagues ADD COLUMN max_members INTEGER;
CREATE INDEX leagues_owner ON leagues(owner_id, status);
-- Leagues from before this change have no exam pattern or size and can't follow the new rules: close them.
UPDATE leagues SET status = 'closed', closed_at = '2026-11-02T00:00:00.000Z', closed_reason = 'Replaced by tutor leagues' WHERE exam_id IS NULL AND status != 'closed';

-- pending | member | left | removed. Only the league's educator sees real_name.
ALTER TABLE league_members ADD COLUMN real_name TEXT;
ALTER TABLE league_members ADD COLUMN consent_at TEXT;
ALTER TABLE league_members ADD COLUMN decided_at TEXT;
CREATE INDEX league_members_user ON league_members(user_id, state);

-- One waiting educator application per player, even if the button is pressed twice.
CREATE UNIQUE INDEX educator_requests_one_pending ON educator_requests(user_id) WHERE status = 'pending';

-- Beta plan: 2 leagues per educator, 50 students per league.
INSERT INTO settings (key, value, updated_at, updated_by) VALUES ('limit.educator_leagues', '2', '2026-11-02T00:00:00.000Z', 'system');
INSERT INTO settings_history (key, value, at, admin_id) VALUES ('limit.educator_leagues', '2', '2026-11-02T00:00:00.000Z', 'system');
UPDATE settings SET value = '50', updated_at = '2026-11-02T00:00:00.000Z', updated_by = 'system' WHERE key = 'limit.league_max_members';
INSERT INTO settings_history (key, value, at, admin_id) VALUES ('limit.league_max_members', '50', '2026-11-02T00:00:00.000Z', 'system');
