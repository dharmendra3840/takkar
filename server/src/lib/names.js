// Name rules shared with the app (ONB-04, LEAG-01) plus the admin-editable word filter (MOD-02).
import { nicknameError, leagueNameError } from '../../../app/www/js/validate.js';

const normalise = (text) => text.toLowerCase()
  .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/@/g, 'a')
  .replace(/[^a-z]/g, '');

export async function blockedByFilter(env, text) {
  const plain = normalise(text);
  const { results } = await env.DB.prepare('SELECT word FROM word_filter').all();
  return results.some(({ word }) => (word.length <= 2 ? plain === word.toLowerCase() : plain.includes(normalise(word))));
}

export async function checkNickname(env, nickname, exceptUserId = null) {
  const error = nicknameError(nickname);
  if (error) return error;
  if (await blockedByFilter(env, nickname)) return 'That name is not allowed.';
  const taken = await env.DB.prepare('SELECT id FROM users WHERE nickname = ?1 AND id != ?2').bind(nickname, exceptUserId || '').first();
  return taken ? 'That nickname is already taken.' : '';
}

export async function checkLeagueName(env, name) {
  return leagueNameError(name) || ((await blockedByFilter(env, name)) ? 'That name is not allowed.' : '');
}
