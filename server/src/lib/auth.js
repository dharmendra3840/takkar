// Admin sign-in, sessions, CSRF and roles (SEC-01 to SEC-04, SEC-08, SEC-18, ADMIN-01, ADMIN-02).
import { HttpError, unauthorised, forbidden, getCookie, nowIso } from './http.js';
import { sha256, safeEqual } from './crypto.js';

export const SESSION_COOKIE = 'tk_admin';
export const IDLE_MS = 30 * 60 * 1000;         // SEC-02: 30 minutes idle
export const ABSOLUTE_MS = 12 * 60 * 60 * 1000; // SEC-02: 12 hours total

// ADMIN-01: owner does everything; moderators handle players, reports and questions,
// but never payments, data exports, switches, settings or other admins.
const MODERATOR = new Set([
  'overview.view',
  'players.view', 'players.moderate',
  'reports.view', 'reports.resolve',
  'questions.view', 'questions.manage',
  'leagues.view', 'leagues.close',
  'squads.view', 'squads.close',
  'words.view', 'words.add',
]);

export function can(admin, permission) {
  if (!admin || admin.status !== 'active') return false;
  if (admin.role === 'owner') return true;
  return admin.role === 'moderator' && MODERATOR.has(permission);
}

export function requirePermission(admin, permission) {
  if (!can(admin, permission)) throw forbidden();
}

/** Loads the signed-in admin from the session cookie, enforcing idle and absolute timeouts. */
export async function requireAdmin(request, env, { csrf = true } = {}) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) throw unauthorised();
  const idHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT s.id_hash, s.csrf, s.last_seen_at, s.expires_at, s.revoked_at,
            a.id, a.email, a.name, a.role, a.status
       FROM admin_sessions s JOIN admins a ON a.id = s.admin_id
      WHERE s.id_hash = ?1`
  ).bind(idHash).first();
  const now = Date.now();
  if (!row || row.revoked_at || row.status !== 'active') throw unauthorised();
  if (now > Date.parse(row.expires_at)) throw unauthorised('Your session ended after 12 hours. Please sign in again.');
  if (now - Date.parse(row.last_seen_at) > IDLE_MS) {
    await env.DB.prepare('UPDATE admin_sessions SET revoked_at = ?1 WHERE id_hash = ?2').bind(nowIso(), idHash).run();
    throw unauthorised('You were signed out after 30 minutes without activity.');
  }

  // SEC-18: every state-changing request carries the session's CSRF token and comes from our own origin.
  if (csrf && !['GET', 'HEAD'].includes(request.method)) {
    const header = request.headers.get('X-CSRF-Token') || '';
    if (!safeEqual(header, row.csrf)) throw new HttpError(403, 'Security check failed. Reload the page and try again.', 'csrf');
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, 'Cross-site request blocked.', 'origin');
  }

  // Keep the session alive; write at most once a minute to stay within free-tier write limits.
  if (now - Date.parse(row.last_seen_at) > 60000) {
    await env.DB.prepare('UPDATE admin_sessions SET last_seen_at = ?1 WHERE id_hash = ?2').bind(nowIso(), idHash).run();
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role, status: row.status, csrf: row.csrf, sessionHash: idHash };
}

// ---------- Rate limiting for sign-in (SEC-08) ----------

const WINDOW_MS = 15 * 60 * 1000;

export async function tooManyAttempts(env, keys, limit) {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  for (const key of keys) {
    const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE key = ?1 AND at > ?2').bind(key, since).first();
    if (n >= limit) return true;
  }
  return false;
}

export async function recordAttempt(env, keys) {
  const at = nowIso();
  await env.DB.batch(keys.map((key) => env.DB.prepare('INSERT INTO login_attempts (key, at) VALUES (?1, ?2)').bind(key, at)));
  // Keep the table small.
  await env.DB.prepare('DELETE FROM login_attempts WHERE at < ?1').bind(new Date(Date.now() - 24 * 3600 * 1000).toISOString()).run();
}

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'local';
}

// ---------- Audit log (ADMIN-08, SEC-04) ----------

export async function audit(env, admin, action, { targetType = null, targetId = null, reason = null, details = null } = {}) {
  await env.DB.prepare(
    `INSERT INTO audit_log (at, admin_id, admin_email, action, target_type, target_id, reason, details)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  ).bind(nowIso(), admin?.id || null, admin?.email || null, action, targetType, targetId, reason, details ? JSON.stringify(details) : null).run();
}

export function auditStatement(env, admin, action, { targetType = null, targetId = null, reason = null, details = null } = {}) {
  return env.DB.prepare(
    `INSERT INTO audit_log (at, admin_id, admin_email, action, target_type, target_id, reason, details)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  ).bind(nowIso(), admin?.id || null, admin?.email || null, action, targetType, targetId, reason, details ? JSON.stringify(details) : null);
}
