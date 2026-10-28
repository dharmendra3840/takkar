// Switches, limits and prices. Every change keeps history and goes to the audit log.
import { bad, nowIso } from './http.js';
import { auditStatement } from './auth.js';

// What can be changed, and how values are checked.
export const SETTING_RULES = {
  'switch.signups': { type: 'boolean', label: 'New sign-ups' },
  'switch.duels': { type: 'boolean', label: 'Duels' },
  'switch.squads': { type: 'boolean', label: 'Squads and invites' },
  'switch.phone_sign_in': { type: 'boolean', label: 'Phone sign-in (turn on only when Firebase can send real SMS: Blaze plan)' },
  'switch.leagues': { type: 'boolean', label: 'Leagues' },
  'switch.plus_purchases': { type: 'boolean', label: 'Plus purchases' },
  'switch.ads': { type: 'boolean', label: 'Rewarded ads' },
  'switch.pause_all': { type: 'boolean', label: 'Pause everything' },
  'limit.free_duels_per_day': { type: 'int', min: 0, max: 50, label: 'Free duels a day' },
  'limit.league_max_members': { type: 'int', min: 10, max: 100000, label: 'League size limit' },
  'limit.squad_max_members': { type: 'int', min: 2, max: 20, label: 'Squad size limit' },
  'price.plus_paise': { type: 'int', min: 100, max: 1000000, label: 'Plus price for new buyers (paise)' },
  'flags.alert_after': { type: 'int', min: 1, max: 100, label: 'Flags in 24 h before an alert' },
  'flags.pause_after': { type: 'int', min: 1, max: 500, label: 'Flags in 24 h before a template pauses' },
  'app.latest_build': { type: 'int', min: 1, max: 100000, label: 'Latest app build (players older than this see "Update available")' },
  'app.min_build': { type: 'int', min: 1, max: 100000, label: 'Oldest app build allowed (older ones must update)' },
};

export async function getSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value, updated_at, updated_by FROM settings').all();
  const out = {};
  for (const r of results) out[r.key] = { value: JSON.parse(r.value), updatedAt: r.updated_at, updatedBy: r.updated_by };
  return out;
}

export function checkValue(key, value) {
  const rule = SETTING_RULES[key];
  if (!rule) throw bad(`Unknown setting "${key}".`);
  if (rule.type === 'boolean') {
    if (typeof value !== 'boolean') throw bad(`${rule.label} must be on or off.`);
    return value;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < rule.min || n > rule.max) throw bad(`${rule.label} must be a whole number from ${rule.min} to ${rule.max}.`);
  return n;
}

/** Changes one setting, records history and the audit entry in one batch. */
export async function setSetting(env, admin, key, rawValue, reason) {
  const value = checkValue(key, rawValue);
  const at = nowIso();
  const json = JSON.stringify(value);
  const before = await env.DB.prepare('SELECT value FROM settings WHERE key = ?1').bind(key).first();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by')
      .bind(key, json, at, admin.id),
    env.DB.prepare('INSERT INTO settings_history (key, value, at, admin_id) VALUES (?1, ?2, ?3, ?4)').bind(key, json, at, admin.id),
    auditStatement(env, admin, 'setting.change', {
      targetType: 'setting', targetId: key, reason,
      details: { from: before ? JSON.parse(before.value) : null, to: value },
    }),
  ]);
  return value;
}
