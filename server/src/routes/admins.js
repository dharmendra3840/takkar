// Audit log viewer (ADMIN-08) and admin accounts (owner only).
import { json, bad, notFound, readJson, nowIso, clampInt, requireString, text } from '../lib/http.js';
import { requirePermission, auditStatement, audit } from '../lib/auth.js';
import { randomId } from '../lib/crypto.js';
import { createInvite } from './auth.js';

function auditQuery(query) {
  const where = [];
  const args = [];
  const add = (sql, v) => { args.push(v); where.push(sql.replace('?', `?${args.length}`)); };
  if (query.get('action')) add('action LIKE ?', `${query.get('action').replace(/[%_]/g, '')}%`);
  if (query.get('admin')) add('admin_email = ?', query.get('admin').toLowerCase());
  if (query.get('target')) add('target_id = ?', query.get('target'));
  if (query.get('from')) add('at >= ?', new Date(query.get('from')).toISOString());
  if (query.get('to')) add('at <= ?', new Date(Date.parse(query.get('to')) + 86399999).toISOString());
  if (query.get('q')) { const v = `%${query.get('q').replace(/[%_]/g, '')}%`; args.push(v); where.push(`(reason LIKE ?${args.length} OR details LIKE ?${args.length} OR target_id LIKE ?${args.length})`); }
  return { where: where.length ? 'WHERE ' + where.join(' AND ') : '', args };
}

export async function listAudit({ env, admin, query }) {
  requirePermission(admin, 'audit.view');
  const { where, args } = auditQuery(query);
  const limit = clampInt(query.get('limit'), 1, 200, 100);
  const before = clampInt(query.get('before'), 0, Number.MAX_SAFE_INTEGER, 0);
  const cursor = before ? `${where ? where + ' AND' : 'WHERE'} id < ${before}` : where;
  const { results } = await env.DB.prepare(`SELECT * FROM audit_log ${cursor} ORDER BY id DESC LIMIT ${limit}`).bind(...args).all();
  const { results: actions } = await env.DB.prepare('SELECT DISTINCT action FROM audit_log ORDER BY action').all();
  return json({ entries: results, actions: actions.map((a) => a.action), next: results.length === limit ? results[results.length - 1].id : null });
}

export async function exportAudit({ env, admin, query }) {
  requirePermission(admin, 'audit.export');
  const { where, args } = auditQuery(query);
  const { results } = await env.DB.prepare(`SELECT * FROM audit_log ${where} ORDER BY id DESC LIMIT 20000`).bind(...args).all();
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = ['id,at,admin_email,action,target_type,target_id,reason,details', ...results.map((r) => [r.id, r.at, r.admin_email, r.action, r.target_type, r.target_id, r.reason, r.details].map(cell).join(','))].join('\n');
  await audit(env, admin, 'audit.export', { details: { rows: results.length } });
  return text(csv, 200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="takkar-audit-${new Date().toISOString().slice(0, 10)}.csv"` });
}

// ---------- Admin accounts ----------

export async function listAdmins({ env, admin }) {
  requirePermission(admin, 'admins.manage');
  const now = nowIso();
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.email, a.name, a.role, a.status, a.last_login_at, a.created_at, a.locked_until,
       (SELECT COUNT(*) FROM admin_sessions s WHERE s.admin_id = a.id AND s.revoked_at IS NULL AND s.expires_at > ?1) AS sessions
     FROM admins a ORDER BY a.role = 'owner' DESC, a.created_at`
  ).bind(now).all();
  return json({ admins: results, you: admin.id });
}

/** Adds an owner or moderator. Returns a one-time invite link valid for 48 hours. */
export async function inviteAdmin({ request, env, admin }) {
  requirePermission(admin, 'admins.manage');
  const body = await readJson(request);
  const email = requireString(body.email, 'Email', { min: 5, max: 200 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw bad('Enter a valid email address.');
  const name = requireString(body.name, 'Name', { min: 2, max: 80 });
  const role = body.role === 'owner' ? 'owner' : 'moderator';
  const existing = await env.DB.prepare('SELECT id FROM admins WHERE email = ?1').bind(email).first();
  if (existing) throw bad('That email already has an admin account.');
  const id = randomId('adm_');
  await env.DB.batch([
    env.DB.prepare("INSERT INTO admins (id, email, name, role, status, created_at) VALUES (?1, ?2, ?3, ?4, 'invited', ?5)").bind(id, email, name, role, nowIso()),
    auditStatement(env, admin, 'admin.invite', { targetType: 'admin', targetId: id, details: { email, role } }),
  ]);
  const token = await createInvite(env, id, 'setup', admin.id);
  return json({ ok: true, id, invitePath: `/admin/#/invite/${token}` });
}

async function ownersLeft(env, exceptId) {
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM admins WHERE role = 'owner' AND status = 'active' AND id != ?1").bind(exceptId).first();
  return n;
}

/** change_role | disable | enable | reset_2fa | sign_out */
export async function manageAdmin({ request, env, admin, params }) {
  requirePermission(admin, 'admins.manage');
  const body = await readJson(request);
  const target = await env.DB.prepare('SELECT * FROM admins WHERE id = ?1').bind(params.id).first();
  if (!target) throw notFound('Admin not found.');
  const reason = requireString(body.reason, 'Reason', { min: 3, max: 300 });
  const now = nowIso();
  const action = String(body.action || '');
  const stmts = [];
  let invitePath = null;

  const removingOwner = target.role === 'owner' && target.status === 'active';
  if (['disable', 'reset_2fa'].includes(action) || (action === 'change_role' && body.role !== 'owner')) {
    if (removingOwner && (await ownersLeft(env, target.id)) === 0) throw bad('Takkar must always have at least one active owner.');
  }

  switch (action) {
    case 'change_role': {
      const role = body.role === 'owner' ? 'owner' : 'moderator';
      stmts.push(env.DB.prepare('UPDATE admins SET role = ?1 WHERE id = ?2').bind(role, target.id));
      break;
    }
    case 'disable':
      stmts.push(env.DB.prepare("UPDATE admins SET status = 'disabled' WHERE id = ?1").bind(target.id));
      stmts.push(env.DB.prepare('UPDATE admin_sessions SET revoked_at = ?1 WHERE admin_id = ?2 AND revoked_at IS NULL').bind(now, target.id));
      break;
    case 'enable':
      if (!target.password_hash) throw bad('This admin never finished setup. Send a new invite instead (reset 2-step).');
      stmts.push(env.DB.prepare("UPDATE admins SET status = 'active', failed_logins = 0, locked_until = NULL WHERE id = ?1").bind(target.id));
      break;
    case 'reset_2fa':
      // Lost phone: the admin must set a new password and scan a new QR code from a fresh link.
      stmts.push(env.DB.prepare("UPDATE admins SET status = 'invited', totp_secret_enc = NULL, password_hash = NULL WHERE id = ?1").bind(target.id));
      stmts.push(env.DB.prepare('UPDATE admin_sessions SET revoked_at = ?1 WHERE admin_id = ?2 AND revoked_at IS NULL').bind(now, target.id));
      break;
    case 'sign_out':
      stmts.push(env.DB.prepare('UPDATE admin_sessions SET revoked_at = ?1 WHERE admin_id = ?2 AND revoked_at IS NULL').bind(now, target.id));
      break;
    default:
      throw bad('Unknown action.');
  }
  stmts.push(auditStatement(env, admin, `admin.${action}`, { targetType: 'admin', targetId: target.id, reason, details: { email: target.email, role: body.role } }));
  await env.DB.batch(stmts);
  if (action === 'reset_2fa') {
    invitePath = `/admin/#/invite/${await createInvite(env, target.id, 'reset', admin.id)}`;
  }
  return json({ ok: true, invitePath });
}

/** A fresh invite link for an admin who has not finished setup. */
export async function reinviteAdmin({ env, admin, params }) {
  requirePermission(admin, 'admins.manage');
  const target = await env.DB.prepare('SELECT * FROM admins WHERE id = ?1').bind(params.id).first();
  if (!target) throw notFound('Admin not found.');
  if (target.status !== 'invited') throw bad('This admin has already finished setup.');
  const invitePath = `/admin/#/invite/${await createInvite(env, target.id, 'setup', admin.id)}`;
  await audit(env, admin, 'admin.reinvite', { targetType: 'admin', targetId: target.id });
  return json({ ok: true, invitePath });
}
