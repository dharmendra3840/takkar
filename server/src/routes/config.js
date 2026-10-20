// Switches and limits (ADMIN-06, ADMIN-07 price), word filter (MOD-02), announcements (ADMIN-11).
import { json, bad, notFound, readJson, nowIso, requireString } from '../lib/http.js';
import { requirePermission, auditStatement } from '../lib/auth.js';
import { randomId } from '../lib/crypto.js';
import { getSettings, setSetting, SETTING_RULES } from '../lib/settings.js';

export async function readSettings({ env, admin }) {
  requirePermission(admin, 'settings.view');
  const settings = await getSettings(env);
  const { results: history } = await env.DB.prepare(
    'SELECT h.key, h.value, h.at, a.email FROM settings_history h LEFT JOIN admins a ON a.id = h.admin_id ORDER BY h.id DESC LIMIT 60'
  ).all();
  return json({
    settings: Object.fromEntries(Object.entries(SETTING_RULES).map(([key, rule]) => [key, { ...rule, ...(settings[key] || { value: null }) }])),
    history: history.map((h) => ({ ...h, value: JSON.parse(h.value) })),
  });
}

export async function writeSetting({ request, env, admin, params }) {
  requirePermission(admin, 'settings.change');
  const body = await readJson(request);
  const reason = requireString(body.reason, 'Reason', { min: 3, max: 500 });
  const value = await setSetting(env, admin, params.key, body.value, reason);
  return json({ ok: true, key: params.key, value });
}

// ---------- Word filter ----------

export async function listWords({ env, admin }) {
  requirePermission(admin, 'words.view');
  const { results } = await env.DB.prepare('SELECT w.word, w.added_at, COALESCE(a.email, w.added_by) AS added_by FROM word_filter w LEFT JOIN admins a ON a.id = w.added_by ORDER BY w.added_at DESC, w.word').all();
  return json({ words: results });
}

export async function addWord({ request, env, admin }) {
  requirePermission(admin, 'words.add');
  const body = await readJson(request);
  const word = requireString(body.word, 'Word', { min: 2, max: 40 }).toLowerCase();
  if (!/^[\p{L}\p{N}]+$/u.test(word)) throw bad('Add one word, letters and numbers only.');
  const exists = await env.DB.prepare('SELECT word FROM word_filter WHERE word = ?1').bind(word).first();
  if (exists) throw bad('That word is already blocked.');
  await env.DB.batch([
    env.DB.prepare('INSERT INTO word_filter (word, added_by, added_at) VALUES (?1, ?2, ?3)').bind(word, admin.id, nowIso()),
    auditStatement(env, admin, 'word.add', { targetType: 'word', targetId: word }),
  ]);
  return json({ ok: true });
}

export async function removeWord({ request, env, admin, params }) {
  requirePermission(admin, 'words.remove');
  const body = await readJson(request);
  const reason = requireString(body.reason, 'Reason', { min: 3, max: 300 });
  const res = await env.DB.prepare('DELETE FROM word_filter WHERE word = ?1').bind(params.word).run();
  if (!res.meta.changes) throw notFound('That word is not in the filter.');
  await env.DB.batch([auditStatement(env, admin, 'word.remove', { targetType: 'word', targetId: params.word, reason })]);
  return json({ ok: true });
}

// ---------- Announcements (ADMIN-11) ----------

export async function listAnnouncements({ env, admin }) {
  requirePermission(admin, 'announcements.manage');
  const { results } = await env.DB.prepare(
    'SELECT n.*, l.name AS league_name, a.email AS created_by_email FROM announcements n LEFT JOIN leagues l ON l.id = n.league_id LEFT JOIN admins a ON a.id = n.created_by ORDER BY n.active DESC, n.created_at DESC LIMIT 50'
  ).all();
  return json({ announcements: results });
}

export async function createAnnouncement({ request, env, admin }) {
  requirePermission(admin, 'announcements.manage');
  const body = await readJson(request);
  const text = requireString(body.text, 'Announcement', { min: 5, max: 200 });
  const scope = body.scope === 'league' ? 'league' : 'all';
  let leagueId = null;
  if (scope === 'league') {
    const league = await env.DB.prepare("SELECT id FROM leagues WHERE id = ?1 OR invite_code = ?1").bind(String(body.league || '')).first();
    if (!league) throw bad('Pick a league by its id or invite code.');
    leagueId = league.id;
  }
  const id = randomId('ann_');
  await env.DB.batch([
    env.DB.prepare('INSERT INTO announcements (id, text, scope, league_id, active, created_by, created_at) VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6)').bind(id, text, scope, leagueId, admin.id, nowIso()),
    auditStatement(env, admin, 'announcement.show', { targetType: 'announcement', targetId: id, details: { text, scope, leagueId } }),
  ]);
  return json({ ok: true, id });
}

export async function endAnnouncement({ env, admin, params }) {
  requirePermission(admin, 'announcements.manage');
  const res = await env.DB.prepare('UPDATE announcements SET active = 0, ended_at = ?1 WHERE id = ?2 AND active = 1').bind(nowIso(), params.id).run();
  if (!res.meta.changes) throw notFound('Announcement not found or already removed.');
  await env.DB.batch([auditStatement(env, admin, 'announcement.remove', { targetType: 'announcement', targetId: params.id })]);
  return json({ ok: true });
}
