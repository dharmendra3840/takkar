// Name rules shared with the app (ONB-04, LEAG-01) plus the admin-editable word filter (MOD-02).
import { nicknameError, usernameError, usernameFrom, leagueNameError } from '../../../app/www/js/validate.js';

const normalise = (text) => text.toLowerCase()
  .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/@/g, 'a')
  .replace(/[^a-z]/g, '');

export async function blockedByFilter(env, text) {
  const plain = normalise(text);
  const { results } = await env.DB.prepare('SELECT word FROM word_filter').all();
  return results.some(({ word }) => (word.length <= 2 ? plain === word.toLowerCase() : plain.includes(normalise(word))));
}

/** A nickname is what other players see; many players may share one (design/06-data-and-api.md §6.7). */
export async function checkNickname(env, nickname) {
  const error = nicknameError(nickname);
  if (error) return error;
  return (await blockedByFilter(env, nickname)) ? 'That name is not allowed.' : '';
}

/** A user ID is unique. It lives in users.nickname, the column that has always been unique (migration 0009). */
export async function checkUsername(env, username, exceptUserId = null) {
  const error = usernameError(username);
  if (error) return error;
  if (await blockedByFilter(env, username)) return 'That user ID is not allowed.';
  const taken = await env.DB.prepare('SELECT id FROM users WHERE nickname = ?1 COLLATE NOCASE AND id != ?2').bind(username, exceptUserId || '').first();
  return taken ? 'That user ID is taken.' : '';
}

/** A free user ID close to `base` (a nickname or a wanted ID): base itself, then base with digits; never over 15. */
export async function suggestUsername(env, base) {
  let stem = usernameFrom(base);
  if (usernameError(stem) || (await blockedByFilter(env, stem))) stem = 'player';
  const withNumber = (n) => `${stem.slice(0, 15 - String(n).length)}${n}`;
  const tries = [stem];
  for (let i = 0; i < 12; i++) tries.push(withNumber(10 + Math.floor(Math.random() * (i < 6 ? 90 : 9990))));
  for (const id of tries) if (!(await checkUsername(env, id))) return id;
  return withNumber(Date.now() % 1000000);
}

export async function checkLeagueName(env, name) {
  return leagueNameError(name) || ((await blockedByFilter(env, name)) ? 'That name is not allowed.' : '');
}
