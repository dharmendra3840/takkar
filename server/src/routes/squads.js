// Squads: study groups of up to 20 signed-in players (design/03 §3.2, Phase 2).
// Members see each other's nicknames, today's squad duel scores and correct answers this week,
// never emails or phone numbers.
import { json, bad, notFound, HttpError, readJson, nowIso, istDay } from '../lib/http.js';
import { randomId } from '../lib/crypto.js';
import { checkLeagueName } from '../lib/names.js';
import { currentPlayer, limit } from './player.js';
import { EXAMS } from '../../../app/www/js/exams.js';
import { CURRENT_SET } from '../../../app/www/js/engine/index.js';
import { weekStart } from '../../../app/www/js/time.js';
import {
  SQUAD_MAX, SQUADS_PER_PLAYER, SQUADS_OWNED, REACTIONS, CODE_ALPHABET, CODE_LENGTH, missionTarget, squadSeed, cleanCode,
} from '../../../app/www/js/squad-rules.js';

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

const memberCount = (env, squadId) => env.DB.prepare("SELECT COUNT(*) AS n FROM squad_members WHERE squad_id = ?1 AND state = 'member'").bind(squadId).first().then((r) => r.n);

/** The squad, if the player is a member of it (and it is open); 404 otherwise, so outsiders learn nothing. */
async function memberSquad(env, user, squadId) {
  const row = await env.DB.prepare(
    `SELECT s.*, m.role FROM squads s JOIN squad_members m ON m.squad_id = s.id
     WHERE s.id = ?1 AND m.user_id = ?2 AND m.state = 'member' AND s.status = 'active'`
  ).bind(squadId, user.id).first();
  if (!row) throw notFound('This squad is not available.');
  return row;
}
function requireOwner(squad) {
  if (squad.role !== 'owner') throw new HttpError(403, 'Only the squad owner can do that.', 'not_owner');
}

const summary = (s, members) => ({ id: s.id, name: s.name, exam: s.exam_id, role: s.role, members, max: s.max_members, inviteCode: s.role ? s.invite_code : undefined });

// ---------- GET /api/squads: my squads ----------
export async function listMine({ request, env }) {
  const user = await currentPlayer(request, env);
  const { results } = await env.DB.prepare(
    `SELECT s.*, m.role, (SELECT COUNT(*) FROM squad_members x WHERE x.squad_id = s.id AND x.state = 'member') AS members
     FROM squads s JOIN squad_members m ON m.squad_id = s.id
     WHERE m.user_id = ?1 AND m.state = 'member' AND s.status = 'active' ORDER BY m.joined_at ASC`
  ).bind(user.id).all();
  return json({ squads: results.map((s) => summary(s, s.members)) });
}

// ---------- POST /api/squads: create ----------
export async function create({ request, env }) {
  const user = await currentPlayer(request, env);
  await limit(env, 'squad_create', user.id, 10, 86400);
  const body = await readJson(request);
  const name = String(body.name || '').trim();
  const error = await checkLeagueName(env, name);
  if (error) throw bad(error, 'bad_name');
  if (!EXAMS[body.exam]) throw bad('Pick the exam this squad prepares for.', 'bad_exam');
  const mine = await env.DB.prepare(
    `SELECT COUNT(*) AS n, SUM(CASE WHEN m.role = 'owner' THEN 1 ELSE 0 END) AS owned
     FROM squad_members m JOIN squads s ON s.id = m.squad_id WHERE m.user_id = ?1 AND m.state = 'member' AND s.status = 'active'`
  ).bind(user.id).first();
  if (mine.n >= SQUADS_PER_PLAYER) throw bad(`You are already in ${SQUADS_PER_PLAYER} squads. Leave one to start another.`, 'too_many_squads');
  if ((mine.owned || 0) >= SQUADS_OWNED) throw bad(`You already run ${SQUADS_OWNED} squads.`, 'too_many_owned');
  const id = randomId('sq_');
  const now = nowIso();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO squads (id, name, owner_id, status, created_at, exam_id, invite_code, max_members) VALUES (?1, ?2, ?3, 'active', ?4, ?5, ?6, ?7)")
          .bind(id, name, user.id, now, body.exam, code, SQUAD_MAX),
        env.DB.prepare("INSERT INTO squad_members (squad_id, user_id, joined_at, state, role) VALUES (?1, ?2, ?3, 'member', 'owner')").bind(id, user.id, now),
      ]);
      return json({ ok: true, squad: { id, name, exam: body.exam, role: 'owner', members: 1, max: SQUAD_MAX, inviteCode: code } }, 201);
    } catch (e) {
      if (!/UNIQUE/i.test(String(e.message))) throw e; // a clashing invite code: try another
    }
  }
  throw new HttpError(500, 'Could not create the squad. Please try again.', 'code_clash');
}

// ---------- GET /api/squads/invite/:code: what a link opens (no sign-in needed) ----------
export async function preview({ request, env, params }) {
  const user = await currentPlayer(request, env, { required: false });
  await limit(env, 'squad_preview', user ? user.id : request.headers.get('CF-Connecting-IP') || 'anon', 60, 3600);
  const code = cleanCode(params.code);
  const s = await env.DB.prepare("SELECT * FROM squads WHERE invite_code = ?1 AND status = 'active'").bind(code).first();
  if (!s || code.length !== CODE_LENGTH) throw notFound('That squad code does not work. Check it with whoever sent it.');
  const members = await memberCount(env, s.id);
  let state = null;
  if (user) state = (await env.DB.prepare('SELECT state FROM squad_members WHERE squad_id = ?1 AND user_id = ?2').bind(s.id, user.id).first())?.state || null;
  return json({ squad: { id: s.id, name: s.name, exam: s.exam_id, members, max: s.max_members, full: members >= s.max_members }, you: state });
}

// ---------- POST /api/squads/invite/:code/join ----------
export async function join({ request, env, params }) {
  const user = await currentPlayer(request, env);
  await limit(env, 'squad_join', user.id, 30, 3600);
  const code = cleanCode(params.code);
  const s = await env.DB.prepare("SELECT * FROM squads WHERE invite_code = ?1 AND status = 'active'").bind(code).first();
  if (!s || code.length !== CODE_LENGTH) throw notFound('That squad code does not work. Check it with whoever sent it.');
  const existing = await env.DB.prepare('SELECT state FROM squad_members WHERE squad_id = ?1 AND user_id = ?2').bind(s.id, user.id).first();
  if (existing?.state === 'member') return json({ ok: true, squad: summary({ ...s, role: 'member' }, await memberCount(env, s.id)) });
  if (existing?.state === 'removed') throw new HttpError(403, 'You were removed from this squad, so you cannot join it again.', 'removed');
  const mine = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM squad_members m JOIN squads q ON q.id = m.squad_id WHERE m.user_id = ?1 AND m.state = 'member' AND q.status = 'active'"
  ).bind(user.id).first();
  if (mine.n >= SQUADS_PER_PLAYER) throw bad(`You are already in ${SQUADS_PER_PLAYER} squads. Leave one to join another.`, 'too_many_squads');
  if ((await memberCount(env, s.id)) >= s.max_members) throw bad(`This squad is full (${s.max_members} members).`, 'squad_full');
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO squad_members (squad_id, user_id, joined_at, state, role) VALUES (?1, ?2, ?3, 'member', 'member')
     ON CONFLICT(squad_id, user_id) DO UPDATE SET state = 'member', role = 'member', joined_at = ?3`
  ).bind(s.id, user.id, now).run();
  return json({ ok: true, squad: summary({ ...s, role: 'member' }, await memberCount(env, s.id)) });
}

// ---------- GET /api/squads/:id: the squad page ----------
export async function page({ request, env, params }) {
  const user = await currentPlayer(request, env);
  const s = await memberSquad(env, user, params.id);
  const day = istDay();
  const week = weekStart(day);
  const { results: members } = await env.DB.prepare(
    `SELECT m.user_id, m.role, m.joined_at, u.nickname FROM squad_members m JOIN users u ON u.id = m.user_id
     WHERE m.squad_id = ?1 AND m.state = 'member' ORDER BY m.role = 'owner' DESC, m.joined_at ASC`
  ).bind(s.id).all();
  // Correct answers this week, from every finished duel members uploaded.
  const { results: rights } = await env.DB.prepare(
    `SELECT d.user_id, SUM(d.right_count) AS r FROM duels d
     WHERE d.user_id IN (SELECT user_id FROM squad_members WHERE squad_id = ?1 AND state = 'member')
       AND d.status = 'finished' AND d.day BETWEEN ?2 AND ?3 GROUP BY d.user_id`
  ).bind(s.id, week, week + 6).all();
  const rightBy = Object.fromEntries(rights.map((r) => [r.user_id, r.r || 0]));
  // Today's squad duel: first attempt per member.
  const { results: today } = await env.DB.prepare(
    `SELECT d.user_id, d.score, d.time_ms, d.right_count FROM duels d
     WHERE d.squad_id = ?1 AND d.day = ?2 AND d.counted = 1 AND d.status = 'finished'`
  ).bind(s.id, day).all();
  const nick = Object.fromEntries(members.map((m) => [m.user_id, m.nickname]));
  const table = today.filter((t) => nick[t.user_id])
    .sort((a, b) => b.score - a.score || a.time_ms - b.time_ms)
    .map((t, i) => ({ rank: i + 1, nickname: nick[t.user_id], score: t.score, right: t.right_count, timeMs: t.time_ms, you: t.user_id === user.id }));
  const played = await env.DB.prepare('SELECT COUNT(*) AS n FROM duels WHERE squad_id = ?1 AND day = ?2 AND user_id = ?3').bind(s.id, day, user.id).first();
  const { results: reactions } = await env.DB.prepare(
    `SELECT r.reaction, r.created_at, u.nickname FROM reactions r JOIN users u ON u.id = r.from_user
     WHERE r.squad_id = ?1 ORDER BY r.created_at DESC LIMIT 20`
  ).bind(s.id).all();
  const done = members.reduce((sum, m) => sum + (rightBy[m.user_id] || 0), 0);
  return json({
    squad: { ...summary(s, members.length), createdAt: s.created_at },
    you: { role: s.role, playedToday: played.n > 0 },
    members: members.map((m) => ({ nickname: m.nickname, role: m.role, rightThisWeek: rightBy[m.user_id] || 0, you: m.user_id === user.id, id: s.role === 'owner' ? m.user_id : undefined })),
    today: { day, seed: squadSeed(s.id, day), set: CURRENT_SET, exam: s.exam_id, table },
    mission: { done, target: missionTarget(members.length), daysLeft: 6 - (day - week) },
    reactions: reactions.map((r) => ({ reaction: r.reaction, nickname: r.nickname, at: r.created_at })),
    reactionChoices: REACTIONS,
  });
}

/** Statements that take a player out of a squad; an owner who leaves hands over to the longest-standing member, or closes an empty squad. */
async function leaveStatements(env, squad, userId, state, now) {
  const stmts = [env.DB.prepare("UPDATE squad_members SET state = ?1, role = 'member' WHERE squad_id = ?2 AND user_id = ?3").bind(state, squad.id, userId)];
  if (squad.owner_id === userId) {
    const next = await env.DB.prepare("SELECT user_id FROM squad_members WHERE squad_id = ?1 AND state = 'member' AND user_id != ?2 ORDER BY joined_at ASC LIMIT 1").bind(squad.id, userId).first();
    if (next) {
      stmts.push(env.DB.prepare("UPDATE squad_members SET role = 'owner' WHERE squad_id = ?1 AND user_id = ?2").bind(squad.id, next.user_id));
      stmts.push(env.DB.prepare('UPDATE squads SET owner_id = ?1 WHERE id = ?2').bind(next.user_id, squad.id));
    } else {
      stmts.push(env.DB.prepare("UPDATE squads SET status = 'closed', closed_at = ?1, closed_reason = 'Last member left' WHERE id = ?2").bind(now, squad.id));
    }
  }
  return stmts;
}

// ---------- POST /api/squads/:id/leave ----------
export async function leave({ request, env, params }) {
  const user = await currentPlayer(request, env);
  const s = await memberSquad(env, user, params.id);
  await env.DB.batch(await leaveStatements(env, s, user.id, 'left', nowIso()));
  return json({ ok: true });
}

/** Owner actions on a member: by squad member user id. */
async function targetMember(env, s, userId) {
  const m = await env.DB.prepare("SELECT * FROM squad_members WHERE squad_id = ?1 AND user_id = ?2 AND state = 'member'").bind(s.id, String(userId || '')).first();
  if (!m) throw notFound('That person is not in this squad.');
  return m;
}

// ---------- POST /api/squads/:id/members/:uid/remove (owner) ----------
export async function remove({ request, env, params }) {
  const user = await currentPlayer(request, env);
  const s = await memberSquad(env, user, params.id);
  requireOwner(s);
  if (params.uid === user.id) throw bad('To leave your own squad, use Leave squad.', 'self');
  await targetMember(env, s, params.uid);
  await env.DB.prepare("UPDATE squad_members SET state = 'removed' WHERE squad_id = ?1 AND user_id = ?2").bind(s.id, params.uid).run();
  return json({ ok: true });
}

// ---------- POST /api/squads/:id/members/:uid/owner (owner hands over) ----------
export async function handOver({ request, env, params }) {
  const user = await currentPlayer(request, env);
  const s = await memberSquad(env, user, params.id);
  requireOwner(s);
  if (params.uid === user.id) return json({ ok: true });
  await targetMember(env, s, params.uid);
  await env.DB.batch([
    env.DB.prepare("UPDATE squad_members SET role = 'member' WHERE squad_id = ?1 AND user_id = ?2").bind(s.id, user.id),
    env.DB.prepare("UPDATE squad_members SET role = 'owner' WHERE squad_id = ?1 AND user_id = ?2").bind(s.id, params.uid),
    env.DB.prepare('UPDATE squads SET owner_id = ?1 WHERE id = ?2').bind(params.uid, s.id),
  ]);
  return json({ ok: true });
}

// ---------- POST /api/squads/:id/invite/reset (owner): the old code stops working ----------
export async function resetInvite({ request, env, params }) {
  const user = await currentPlayer(request, env);
  const s = await memberSquad(env, user, params.id);
  requireOwner(s);
  await limit(env, 'squad_reset', user.id, 10, 86400);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    try {
      await env.DB.prepare('UPDATE squads SET invite_code = ?1 WHERE id = ?2').bind(code, s.id).run();
      return json({ ok: true, inviteCode: code });
    } catch (e) {
      if (!/UNIQUE/i.test(String(e.message))) throw e;
    }
  }
  throw new HttpError(500, 'Could not make a new code. Please try again.', 'code_clash');
}

// ---------- POST /api/squads/:id/close (owner) ----------
export async function close({ request, env, params }) {
  const user = await currentPlayer(request, env);
  const s = await memberSquad(env, user, params.id);
  requireOwner(s);
  await env.DB.prepare("UPDATE squads SET status = 'closed', closed_at = ?1, closed_reason = 'Closed by the owner' WHERE id = ?2").bind(nowIso(), s.id).run();
  return json({ ok: true });
}

// ---------- POST /api/squads/:id/react ----------
export async function react({ request, env, params }) {
  const user = await currentPlayer(request, env);
  const s = await memberSquad(env, user, params.id);
  await limit(env, 'squad_react', user.id, 30, 3600);
  if (user.muted_until && Date.parse(user.muted_until) > Date.now()) throw new HttpError(403, 'Reactions are paused on your account for now.', 'muted');
  const body = await readJson(request);
  if (!REACTIONS.includes(body.reaction)) throw bad('Pick one of the reactions.', 'bad_reaction');
  await env.DB.prepare('INSERT INTO reactions (id, squad_id, from_user, reaction, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(randomId('re_'), s.id, user.id, body.reaction, nowIso()).run();
  return json({ ok: true }, 201);
}

/** For deleting an account: owned squads go to the longest-standing member, or close. */
export async function ownedSquadStatements(env, userId, now) {
  const { results } = await env.DB.prepare("SELECT * FROM squads WHERE owner_id = ?1 AND status = 'active'").bind(userId).all();
  const out = [];
  for (const s of results) out.push(...(await leaveStatements(env, s, userId, 'left', now)));
  return out;
}

/** Duel uploads: is this a valid squad duel for this player today (or a recent day)? */
export async function checkSquadDuel(env, userId, d) {
  if (typeof d.squadId !== 'string' || d.squadId.length > 40) throw bad(`Duel ${String(d.id).slice(0, 40)}: squad.`, 'bad_duel');
  const m = await env.DB.prepare(
    "SELECT s.id FROM squads s JOIN squad_members m ON m.squad_id = s.id WHERE s.id = ?1 AND m.user_id = ?2 AND m.state = 'member'"
  ).bind(d.squadId, userId).first();
  if (!m) throw bad(`Duel ${String(d.id).slice(0, 40)}: not a member of that squad.`, 'bad_duel');
  if (d.seed !== squadSeed(d.squadId, d.day)) throw bad(`Duel ${String(d.id).slice(0, 40)}: not that day's squad duel.`, 'bad_duel');
}
