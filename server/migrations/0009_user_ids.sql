-- Nicknames no longer need to be unique; a signed-in account gets a unique user ID instead
-- (design/06-data-and-api.md §6.7).
-- users.nickname keeps its UNIQUE (NOCASE) constraint and becomes the user ID, lowercased;
-- the name other players see moves to display_name, copied first so nobody's visible name changes.
-- Lowercasing cannot collide: NOCASE already kept names that differ only in case apart.

ALTER TABLE users ADD COLUMN display_name TEXT;
UPDATE users SET display_name = nickname;
UPDATE users SET nickname = lower(nickname);
ALTER TABLE users ADD COLUMN username_changed_at TEXT;
