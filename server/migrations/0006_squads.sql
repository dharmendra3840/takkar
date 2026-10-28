-- Phase 2: real squads (study groups). Up to 20 members, invite code, daily squad duel.

ALTER TABLE squads ADD COLUMN exam_id TEXT;
ALTER TABLE squads ADD COLUMN invite_code TEXT;
ALTER TABLE squads ADD COLUMN max_members INTEGER NOT NULL DEFAULT 20;
ALTER TABLE squads ADD COLUMN closed_at TEXT;
ALTER TABLE squads ADD COLUMN closed_reason TEXT;
CREATE UNIQUE INDEX squads_invite ON squads(invite_code) WHERE invite_code IS NOT NULL;

-- owner | member. state: member | left | removed (removed members cannot rejoin with the code).
ALTER TABLE squad_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member';
CREATE INDEX squad_members_user ON squad_members(user_id, state);

-- A squad duel belongs to one squad; the first attempt each day goes on the squad's table.
ALTER TABLE duels ADD COLUMN squad_id TEXT;
CREATE INDEX duels_squad_day ON duels(squad_id, day);

CREATE INDEX reactions_squad ON reactions(squad_id, created_at);

UPDATE settings SET value = '20', updated_at = '2026-10-28T00:00:00.000Z', updated_by = 'system' WHERE key = 'limit.squad_max_members';
INSERT INTO settings_history (key, value, at, admin_id) VALUES ('limit.squad_max_members', '20', '2026-10-28T00:00:00.000Z', 'system');
