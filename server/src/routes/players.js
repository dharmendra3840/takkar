// Players: search, profile, moderation actions and data export (ADMIN-03, MOD-04, MOD-05, PROF-02).
import { json, bad, notFound, readJson, nowIso, istDay, clampInt, requireString } from '../lib/http.js';
import { requirePermission, can, auditStatement } from '../lib/auth.js';
import { randomId } from '../lib/crypto.js';
import { checkNickname } from '../lib/names.js';

const weekStart = (day) => day - ((day + 3) % 7);

export async function listPlayers({ env, admin, query }) {
  requirePermission(admin, 'players.view');
  const q = (query.get('q') || '').trim();
  const status = query.get('status') || '';
  const sort = { joined: 'u.created_at DESC', seen: 'u.last_seen_at DESC', nickname: 'u.nickname COLLATE NOCASE ASC' }[query.get('sort')] || 'u.created_at DESC';
  const limit = clampInt(query.get('limit'), 1, 100, 50);
  const offset = clampInt(query.get('offset'), 0, 1e7, 0);

  const where = ["u.status != 'deleted'"];
  const args = [];
  if (q) {
    // Search by nickname, or by exact email (SEC: emails are not listed, only matched).
    args.push(`%${q.replace(/[%_]/g, '')}%`, q.toLowerCase());
    where.push(`(u.nickname LIKE ?${args.length - 1} OR u.email = ?${args.length} OR u.id = ?${args.length})`);
  }
  if (['active', 'suspended', 'banned'].includes(status)) { args.push(status); where.push(`u.status = ?${args.length}`); }
  if (status === 'muted') { args.push(nowIso()); where.push(`u.muted_until > ?${args.length}`); }
  if (status === 'plus') { args.push(nowIso()); where.push(`u.plus_until > ?${args.length}`); }
  if (status === 'educator') where.push("u.role = 'educator'");

  const sql = `SELECT u.id, u.nickname, u.role, u.status, u.muted_until, u.suspended_until, u.plus_until, u.created_at, u.last_seen_at,
      (SELECT COUNT(*) FROM reports r WHERE r.target_user_id = u.id AND r.status = 'open') AS open_reports,
      (SELECT COUNT(*) FROM duels d WHERE d.user_id = u.id) AS duels
    FROM users u WHERE ${where.join(' AND ')} ORDER BY ${sort} LIMIT ${limit} OFFSET ${offset}`;
  const { results } = await env.DB.prepare(sql).bind(...args).all();
  const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users u WHERE ${where.join(' AND ')}`).bind(...args).first();
  return json({ players: results, total: total.n, limit, offset });
}

async function loadUser(env, id) {
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(id).first();
  if (!user || user.status === 'deleted') throw notFound('Player not found.');
  return user;
}

export async function getPlayer({ env, admin, params }) {
  requirePermission(admin, 'players.view');
  const user = await loadUser(env, params.id);
  const today = istDay();
  const q = (sql, ...a) => env.DB.prepare(sql).bind(...a);
  const [stats, streak, duels, sanctions, reportsAbout, reportsBy, leagues, squads, topics, subs, payments] = await Promise.all([
    q(`SELECT COUNT(*) AS total, SUM(status = 'finished') AS finished, SUM(status = 'abandoned') AS abandoned,
              AVG(CASE WHEN status = 'finished' AND marking = 'exam' THEN score END) AS avg_score,
              SUM(right_count) AS right_total, SUM(right_count + wrong_count) AS answered,
              SUM(CASE WHEN day >= ?2 THEN 1 ELSE 0 END) AS week
         FROM duels WHERE user_id = ?1`, user.id, weekStart(today)).first(),
    q('SELECT * FROM streaks WHERE user_id = ?1', user.id).first(),
    q('SELECT id, kind, topic, level, marking, status, score, rival_score, right_count, wrong_count, skipped_count, time_ms, counted, scores_reset, started_at FROM duels WHERE user_id = ?1 ORDER BY started_at DESC LIMIT 25', user.id).all(),
    q('SELECT s.*, a.email AS admin_email FROM sanctions s LEFT JOIN admins a ON a.id = s.admin_id WHERE s.user_id = ?1 ORDER BY s.created_at DESC LIMIT 50', user.id).all(),
    q('SELECT id, kind, status, details, severity, created_at, resolution FROM reports WHERE target_user_id = ?1 ORDER BY created_at DESC LIMIT 50', user.id).all(),
    q('SELECT COUNT(*) AS n FROM reports WHERE reporter_id = ?1', user.id).first(),
    q("SELECT l.id, l.name, l.status, m.state, (l.owner_id = ?1) AS is_owner FROM league_members m JOIN leagues l ON l.id = m.league_id WHERE m.user_id = ?1 UNION SELECT id, name, status, 'owner', 1 FROM leagues WHERE owner_id = ?1", user.id).all(),
    q('SELECT s.id, s.name, s.status, m.state FROM squad_members m JOIN squads s ON s.id = m.squad_id WHERE m.user_id = ?1', user.id).all(),
    // Speed check for cheating review (MOD-03): average answer time and accuracy by template.
    q(`SELECT a.template, COUNT(*) AS n, AVG(a.correct) AS accuracy, AVG(a.time_ms) AS avg_ms, SUM(a.time_ms < 1500) AS under_1_5s
         FROM duel_answers a JOIN duels d ON d.id = a.duel_id WHERE d.user_id = ?1 GROUP BY a.template ORDER BY n DESC LIMIT 12`, user.id).all(),
    can(admin, 'money.view') ? q('SELECT * FROM subscriptions WHERE user_id = ?1 ORDER BY created_at DESC', user.id).all() : null,
    can(admin, 'money.view') ? q('SELECT * FROM payments WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 20', user.id).all() : null,
  ]);
  return json({
    player: { ...user, email: can(admin, 'players.contact') ? user.email : (user.email ? 'hidden' : null) },
    stats: { ...stats, accuracy: stats.answered ? Math.round((stats.right_total / stats.answered) * 100) : null, reportsFiled: reportsBy.n },
    streak,
    duels: duels.results,
    sanctions: sanctions.results,
    reports: reportsAbout.results,
    leagues: leagues.results,
    squads: squads.results,
    speed: topics.results,
    subscriptions: subs?.results || null,
    payments: payments?.results || null,
  });
}

// Which actions need which permission. Destructive and money actions are owner-only (ADMIN-01).
const ACTIONS = {
  warn: 'players.moderate',
  mute: 'players.moderate',
  unmute: 'players.moderate',
  suspend: 'players.moderate',
  restore: 'players.moderate',
  reset_scores: 'players.moderate',
  rename: 'players.moderate',
  ban: 'players.ban',
  delete_data: 'players.delete',
  grant_plus: 'money.grant',
  revoke_plus: 'money.grant',
};

/** Builds the statements for one action. Exported so the reports queue can reuse it. */
export async function actionStatements(env, admin, user, body, reportId = null) {
  const action = body.action;
  if (!ACTIONS[action]) throw bad(`Unknown action "${action}".`);
  requirePermission(admin, ACTIONS[action]);
  const reason = requireString(body.reason, 'Reason', { min: 3, max: 500 });
  const now = nowIso();
  const days = body.days === null || body.days === undefined || body.days === '' ? null : clampInt(body.days, 1, 3650, 7);
  const until = days ? new Date(Date.now() + days * 86400000).toISOString() : null;
  const stmts = [];
  const sanction = (kind, extraUntil = until) => env.DB.prepare(
    'INSERT INTO sanctions (id, user_id, kind, reason, until, admin_id, report_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)'
  ).bind(randomId('san_'), user.id, kind, reason, extraUntil, admin.id, reportId, now);
  let details = { days };

  switch (action) {
    case 'warn':
      stmts.push(sanction('warn', null));
      break;
    case 'mute':
      stmts.push(env.DB.prepare('UPDATE users SET muted_until = ?1 WHERE id = ?2').bind(until || new Date(Date.now() + 7 * 86400000).toISOString(), user.id));
      stmts.push(sanction('mute', until || new Date(Date.now() + 7 * 86400000).toISOString()));
      break;
    case 'unmute':
      stmts.push(env.DB.prepare('UPDATE users SET muted_until = NULL WHERE id = ?1').bind(user.id));
      stmts.push(sanction('unmute', null));
      break;
    case 'suspend':
      // No end date means suspended until reviewed (MOD-05 uses this for under-18 reports).
      stmts.push(env.DB.prepare("UPDATE users SET status = 'suspended', suspended_until = ?1 WHERE id = ?2").bind(until, user.id));
      stmts.push(sanction('suspend'));
      break;
    case 'restore':
      stmts.push(env.DB.prepare("UPDATE users SET status = 'active', suspended_until = NULL WHERE id = ?1").bind(user.id));
      stmts.push(sanction('restore', null));
      break;
    case 'ban':
      stmts.push(env.DB.prepare("UPDATE users SET status = 'banned', suspended_until = NULL WHERE id = ?1").bind(user.id));
      stmts.push(sanction('ban', null));
      break;
    case 'reset_scores': {
      // Reset counted results so they leave ranks and league tables. "week" or "all".
      const scope = body.scope === 'all' ? 'all' : 'week';
      const from = scope === 'all' ? 0 : weekStart(istDay());
      stmts.push(env.DB.prepare('UPDATE duels SET counted = 0, scores_reset = 1 WHERE user_id = ?1 AND day >= ?2 AND counted = 1').bind(user.id, from));
      stmts.push(sanction('reset_scores', null));
      details = { scope };
      break;
    }
    case 'rename': {
      // A neutral default unless a new nickname is given (admin manual: rename and warn).
      const nickname = body.nickname ? String(body.nickname).trim() : `player${user.id.replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase()}`;
      const err = await checkNickname(env, nickname, user.id);
      if (err) throw bad(err);
      stmts.push(env.DB.prepare('UPDATE users SET nickname = ?1, nickname_changed_at = ?2 WHERE id = ?3').bind(nickname, now, user.id));
      stmts.push(sanction('rename', null));
      details = { from: user.nickname, to: nickname };
      break;
    }
    case 'grant_plus': {
      const grantDays = days || 30;
      const base = user.plus_until && Date.parse(user.plus_until) > Date.now() ? Date.parse(user.plus_until) : Date.now();
      const end = new Date(base + grantDays * 86400000).toISOString();
      stmts.push(env.DB.prepare('UPDATE users SET plus_until = ?1 WHERE id = ?2').bind(end, user.id));
      stmts.push(env.DB.prepare("INSERT INTO subscriptions (id, user_id, source, status, amount_paise, current_period_end, granted_by, created_at) VALUES (?1, ?2, 'grant', 'active', 0, ?3, ?4, ?5)")
        .bind(randomId('sub_'), user.id, end, admin.id, now));
      stmts.push(sanction('grant_plus', end));
      details = { days: grantDays, until: end };
      break;
    }
    case 'revoke_plus':
      stmts.push(env.DB.prepare('UPDATE users SET plus_until = NULL WHERE id = ?1').bind(user.id));
      stmts.push(env.DB.prepare("UPDATE subscriptions SET status = 'ended', cancelled_at = ?1 WHERE user_id = ?2 AND source = 'grant' AND status = 'active'").bind(now, user.id));
      stmts.push(sanction('revoke_plus', null));
      break;
    case 'delete_data':
      stmts.push(...deleteStatements(env, user, now));
      stmts.push(sanction('delete_data', null));
      break;
  }
  stmts.push(auditStatement(env, admin, `player.${action}`, { targetType: 'player', targetId: user.id, reason, details: { nickname: user.nickname, ...details, report: reportId } }));
  return stmts;
}

/**
 * PROF-03 / MOD-05: removes a player's personal data. Payments stay as tax records
 * (SRS), and sanctions and reports stay for 3 years, linked only to the anonymous id.
 * PLUS-09: active subscriptions are cancelled first.
 */
function deleteStatements(env, user, now) {
  const anon = `deleted_${user.id.slice(-8)}`;
  return [
    env.DB.prepare("UPDATE subscriptions SET status = 'cancelled', cancelled_at = ?1 WHERE user_id = ?2 AND status = 'active'").bind(now, user.id),
    env.DB.prepare('DELETE FROM duel_answers WHERE duel_id IN (SELECT id FROM duels WHERE user_id = ?1)').bind(user.id),
    env.DB.prepare('DELETE FROM challenges WHERE user_id = ?1').bind(user.id),
    env.DB.prepare('DELETE FROM duels WHERE user_id = ?1').bind(user.id),
    env.DB.prepare('DELETE FROM league_members WHERE user_id = ?1').bind(user.id),
    env.DB.prepare('DELETE FROM squad_members WHERE user_id = ?1').bind(user.id),
    env.DB.prepare('DELETE FROM reactions WHERE from_user = ?1').bind(user.id),
    env.DB.prepare('DELETE FROM streaks WHERE user_id = ?1').bind(user.id),
    env.DB.prepare('DELETE FROM guest_devices WHERE user_id = ?1').bind(user.id),
    env.DB.prepare('UPDATE question_flags SET user_id = NULL WHERE user_id = ?1').bind(user.id),
    env.DB.prepare("UPDATE leagues SET status = 'closed', closed_at = ?1, closed_reason = 'Owner account deleted' WHERE owner_id = ?2 AND status != 'closed'").bind(now, user.id),
    env.DB.prepare("UPDATE users SET nickname = ?1, email = NULL, status = 'deleted', plus_until = NULL, muted_until = NULL, suspended_until = NULL, deleted_at = ?2 WHERE id = ?3")
      .bind(anon, now, user.id),
  ];
}

export async function playerAction({ request, env, admin, params }) {
  const user = await loadUser(env, params.id);
  const body = await readJson(request);
  const stmts = await actionStatements(env, admin, user, body);
  await env.DB.batch(stmts);
  const after = await env.DB.prepare('SELECT id, nickname, status, muted_until, suspended_until, plus_until FROM users WHERE id = ?1').bind(user.id).first();
  return json({ ok: true, player: after });
}

/** PROF-02 for support: everything stored about a player, as JSON (owner only). */
export async function exportPlayer({ env, admin, params }) {
  requirePermission(admin, 'players.export');
  const user = await loadUser(env, params.id);
  const all = (sql) => env.DB.prepare(sql).bind(user.id).all().then((r) => r.results);
  const data = {
    exportedAt: nowIso(),
    user,
    streak: await env.DB.prepare('SELECT * FROM streaks WHERE user_id = ?1').bind(user.id).first(),
    duels: await all('SELECT * FROM duels WHERE user_id = ?1 ORDER BY started_at'),
    answers: await all('SELECT a.* FROM duel_answers a JOIN duels d ON d.id = a.duel_id WHERE d.user_id = ?1'),
    challenges: await all('SELECT * FROM challenges WHERE user_id = ?1'),
    leagues: await all('SELECT * FROM league_members WHERE user_id = ?1'),
    squads: await all('SELECT * FROM squad_members WHERE user_id = ?1'),
    subscriptions: await all('SELECT * FROM subscriptions WHERE user_id = ?1'),
    payments: await all('SELECT * FROM payments WHERE user_id = ?1'),
    sanctions: await all('SELECT kind, reason, until, created_at FROM sanctions WHERE user_id = ?1'),
  };
  await env.DB.batch([auditStatement(env, admin, 'player.export', { targetType: 'player', targetId: user.id, reason: 'Data export' })]);
  return json(data, 200, { 'Content-Disposition': `attachment; filename="takkar-player-${user.id}.json"` });
}
