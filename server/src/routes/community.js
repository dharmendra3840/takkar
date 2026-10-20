// Leagues, educator approval and squads (ADMIN-10, LEAG-08, LEAG-09).
import { json, bad, notFound, readJson, nowIso, clampInt, requireString } from '../lib/http.js';
import { requirePermission, auditStatement } from '../lib/auth.js';

export async function listLeagues({ env, admin, query }) {
  requirePermission(admin, 'leagues.view');
  const status = ['pending', 'live', 'closed'].includes(query.get('status')) ? query.get('status') : null;
  const q = (query.get('q') || '').trim();
  const where = [];
  const args = [];
  if (status) { args.push(status); where.push(`l.status = ?${args.length}`); }
  if (q) { args.push(`%${q.replace(/[%_]/g, '')}%`); where.push(`(l.name LIKE ?${args.length} OR l.invite_code LIKE ?${args.length})`); }
  const { results } = await env.DB.prepare(
    `SELECT l.*, u.nickname AS owner_nickname, u.status AS owner_status,
       (SELECT COUNT(*) FROM league_members m WHERE m.league_id = l.id AND m.state = 'member') AS members,
       (SELECT COUNT(*) FROM league_members m WHERE m.league_id = l.id AND m.state = 'pending') AS waiting,
       (SELECT COUNT(DISTINCT d.user_id) FROM duels d WHERE d.league_id = l.id AND d.started_at > ?${args.length + 1}) AS active_week,
       (SELECT COUNT(*) FROM reports r WHERE r.target_ref = l.id AND r.status = 'open') AS open_reports
     FROM leagues l JOIN users u ON u.id = l.owner_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY CASE l.status WHEN 'pending' THEN 0 WHEN 'live' THEN 1 ELSE 2 END, l.created_at DESC LIMIT 200`
  ).bind(...args, new Date(Date.now() - 7 * 86400000).toISOString()).all();
  return json({ leagues: results });
}

export async function setLeagueStatus({ request, env, admin, params }) {
  const body = await readJson(request);
  const status = String(body.status || '');
  if (!['live', 'closed'].includes(status)) throw bad('Status must be live or closed.');
  requirePermission(admin, status === 'closed' ? 'leagues.close' : 'educators.decide');
  const reason = requireString(body.reason, 'Reason', { min: 3, max: 500 });
  const league = await env.DB.prepare('SELECT * FROM leagues WHERE id = ?1').bind(params.id).first();
  if (!league) throw notFound('League not found.');
  const now = nowIso();
  await env.DB.batch([
    status === 'closed'
      ? env.DB.prepare("UPDATE leagues SET status = 'closed', closed_at = ?1, closed_reason = ?2 WHERE id = ?3").bind(now, reason, league.id)
      : env.DB.prepare("UPDATE leagues SET status = 'live', closed_at = NULL, closed_reason = NULL WHERE id = ?1").bind(league.id),
    auditStatement(env, admin, status === 'closed' ? 'league.close' : (league.status === 'pending' ? 'league.approve' : 'league.reopen'),
      { targetType: 'league', targetId: league.id, reason, details: { name: league.name, from: league.status } }),
  ]);
  return json({ ok: true });
}

export async function listEducatorRequests({ env, admin, query }) {
  requirePermission(admin, 'educators.decide');
  const status = ['pending', 'approved', 'rejected'].includes(query.get('status')) ? query.get('status') : 'pending';
  const { results } = await env.DB.prepare(
    `SELECT e.*, u.nickname, u.created_at AS joined_at, u.status AS user_status,
       (SELECT COUNT(*) FROM leagues l WHERE l.owner_id = e.user_id) AS leagues
     FROM educator_requests e JOIN users u ON u.id = e.user_id WHERE e.status = ?1 ORDER BY e.created_at ASC LIMIT 200`
  ).bind(status).all();
  return json({ requests: results });
}

/** Approving makes the player an educator and puts their waiting leagues live (LEAG-08). */
export async function decideEducator({ request, env, admin, params }) {
  requirePermission(admin, 'educators.decide');
  const body = await readJson(request);
  const decision = String(body.decision || '');
  if (!['approve', 'reject'].includes(decision)) throw bad('Decision must be approve or reject.');
  const reason = requireString(body.reason, 'Reason', { min: 3, max: 500 });
  const req = await env.DB.prepare('SELECT * FROM educator_requests WHERE id = ?1').bind(params.id).first();
  if (!req) throw notFound('Request not found.');
  if (req.status !== 'pending') throw bad('This request was already decided.');
  const now = nowIso();
  const stmts = [
    env.DB.prepare('UPDATE educator_requests SET status = ?1, decided_by = ?2, decided_at = ?3 WHERE id = ?4')
      .bind(decision === 'approve' ? 'approved' : 'rejected', admin.id, now, req.id),
    auditStatement(env, admin, `educator.${decision}`, { targetType: 'player', targetId: req.user_id, reason, details: { channel: req.channel_name } }),
  ];
  if (decision === 'approve') {
    stmts.push(env.DB.prepare("UPDATE users SET role = 'educator' WHERE id = ?1").bind(req.user_id));
    stmts.push(env.DB.prepare("UPDATE leagues SET status = 'live' WHERE owner_id = ?1 AND status = 'pending'").bind(req.user_id));
  }
  await env.DB.batch(stmts);
  return json({ ok: true });
}

export async function listSquads({ env, admin, query }) {
  requirePermission(admin, 'squads.view');
  const q = (query.get('q') || '').trim();
  const args = [];
  let where = '';
  if (q) { args.push(`%${q.replace(/[%_]/g, '')}%`); where = 'WHERE s.name LIKE ?1'; }
  const limit = clampInt(query.get('limit'), 1, 200, 100);
  const { results } = await env.DB.prepare(
    `SELECT s.*, u.nickname AS owner_nickname,
       (SELECT COUNT(*) FROM squad_members m WHERE m.squad_id = s.id AND m.state = 'member') AS members,
       (SELECT COUNT(*) FROM reactions r WHERE r.squad_id = s.id) AS reactions,
       (SELECT COUNT(*) FROM reports r WHERE r.target_ref = s.id AND r.status = 'open') AS open_reports
     FROM squads s JOIN users u ON u.id = s.owner_id ${where} ORDER BY open_reports DESC, s.created_at DESC LIMIT ${limit}`
  ).bind(...args).all();
  return json({ squads: results });
}

export async function closeSquad({ request, env, admin, params }) {
  requirePermission(admin, 'squads.close');
  const body = await readJson(request);
  const reason = requireString(body.reason, 'Reason', { min: 3, max: 500 });
  const squad = await env.DB.prepare('SELECT * FROM squads WHERE id = ?1').bind(params.id).first();
  if (!squad) throw notFound('Squad not found.');
  await env.DB.batch([
    env.DB.prepare("UPDATE squads SET status = 'closed' WHERE id = ?1").bind(squad.id),
    auditStatement(env, admin, 'squad.close', { targetType: 'squad', targetId: squad.id, reason, details: { name: squad.name } }),
  ]);
  return json({ ok: true });
}
