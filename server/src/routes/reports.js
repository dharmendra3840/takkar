// Reports queue: sorted by severity, one-tap actions (ADMIN-04, MOD-01 to MOD-05).
import { json, bad, notFound, readJson, nowIso, clampInt, requireString } from '../lib/http.js';
import { requirePermission, auditStatement } from '../lib/auth.js';
import { actionStatements } from './players.js';

export async function listReports({ env, admin, query }) {
  requirePermission(admin, 'reports.view');
  const status = ['open', 'resolved', 'dismissed'].includes(query.get('status')) ? query.get('status') : 'open';
  const kind = query.get('kind') || '';
  const limit = clampInt(query.get('limit'), 1, 100, 50);
  const args = [status];
  let where = 'r.status = ?1';
  if (kind) { args.push(kind); where += ' AND r.kind = ?2'; }
  const { results } = await env.DB.prepare(
    `SELECT r.*, t.nickname AS target_nickname, t.status AS target_status, t.muted_until AS target_muted_until,
            rp.nickname AS reporter_nickname, a.email AS resolved_by_email,
            (SELECT COUNT(*) FROM reports x WHERE x.target_user_id = r.target_user_id AND x.status = 'open') AS target_open_reports,
            (SELECT COUNT(*) FROM sanctions s WHERE s.user_id = r.target_user_id) AS target_sanctions
       FROM reports r
       LEFT JOIN users t ON t.id = r.target_user_id
       LEFT JOIN users rp ON rp.id = r.reporter_id
       LEFT JOIN admins a ON a.id = r.resolved_by
      WHERE ${where}
      ORDER BY ${status === 'open' ? 'r.severity ASC, r.created_at ASC' : 'r.resolved_at DESC'}
      LIMIT ${limit}`
  ).bind(...args).all();
  const { results: counts } = await env.DB.prepare("SELECT kind, COUNT(*) AS n FROM reports WHERE status = 'open' GROUP BY kind").all();
  return json({ reports: results, openByKind: Object.fromEntries(counts.map((c) => [c.kind, c.n])) });
}

/**
 * Resolves a report. action: dismiss | warn | rename | mute | suspend | reset_scores | ban | delete_data | close_league | close_squad.
 * Player actions reuse the same rules and permissions as the Players page.
 */
export async function resolveReport({ request, env, admin, params }) {
  requirePermission(admin, 'reports.resolve');
  const report = await env.DB.prepare('SELECT * FROM reports WHERE id = ?1').bind(params.id).first();
  if (!report) throw notFound('Report not found.');
  if (report.status !== 'open') throw bad('This report is already closed.');
  const body = await readJson(request);
  const reason = requireString(body.reason, 'Reason', { min: 3, max: 500 });
  const action = String(body.action || '');
  const now = nowIso();
  const stmts = [];

  if (action === 'dismiss') {
    stmts.push(auditStatement(env, admin, 'report.dismiss', { targetType: 'report', targetId: report.id, reason }));
  } else if (action === 'close_league' || action === 'close_squad') {
    requirePermission(admin, action === 'close_league' ? 'leagues.close' : 'squads.close');
    if (!report.target_ref) throw bad('This report is not about a league or squad.');
    const table = action === 'close_league' ? 'leagues' : 'squads';
    stmts.push(action === 'close_league'
      ? env.DB.prepare("UPDATE leagues SET status = 'closed', closed_at = ?1, closed_reason = ?2 WHERE id = ?3").bind(now, reason, report.target_ref)
      : env.DB.prepare("UPDATE squads SET status = 'closed' WHERE id = ?1").bind(report.target_ref));
    stmts.push(auditStatement(env, admin, `${table === 'leagues' ? 'league' : 'squad'}.close`, { targetType: table.slice(0, -1), targetId: report.target_ref, reason, details: { report: report.id } }));
  } else {
    if (!report.target_user_id) throw bad('This report has no player to act on.');
    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(report.target_user_id).first();
    if (!user || user.status === 'deleted') throw bad('That player no longer exists. Dismiss the report instead.');
    stmts.push(...await actionStatements(env, admin, user, { ...body, action, reason }, report.id));
  }

  stmts.push(env.DB.prepare('UPDATE reports SET status = ?1, resolution = ?2, resolved_by = ?3, resolved_at = ?4 WHERE id = ?5')
    .bind(action === 'dismiss' ? 'dismissed' : 'resolved', `${action}: ${reason}`, admin.id, now, report.id));
  await env.DB.batch(stmts);
  return json({ ok: true });
}
