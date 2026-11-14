// Tutor leagues (Live tests tab, LIVE-14, LIVE-16, LIVE-17). Verified educators create them; students
// join with a code and give their real name, which only that league's educator sees. Other members
// see the league's name, exam and size, never each other.
import { json, bad, notFound, HttpError, readJson, nowIso } from '../lib/http.js';
import { checkLeagueName } from '../lib/names.js';
import { getSettings } from '../lib/settings.js';
import { randomId } from '../lib/crypto.js';
import { currentPlayer, limit } from './player.js';
import { EXAMS } from '../../../app/www/js/exams.js';
import { CODE_ALPHABET } from '../../../app/www/js/squad-rules.js';
import {
  LEAGUE_CODE_LENGTH, LEAGUES_JOINED_MAX, EDUCATOR_LEAGUES_DEFAULT, LEAGUE_MEMBERS_DEFAULT,
  cleanLeagueCode, isLeagueCode, realNameError, cleanRealName,
} from '../../../app/www/js/league-rules.js';

const NOT_FOUND = 'That league code does not work. Check it with your tutor.';

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(LEAGUE_CODE_LENGTH));
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** The admin's switches and limits. Leagues off (or everything paused) stops creating, joining and managing. */
async function leagueSettings(env) {
  const s = await getSettings(env);
  if (s['switch.leagues']?.value === false || s['switch.pause_all']?.value === true) {
    throw new HttpError(403, 'Leagues are paused for a short while. Please try again later.', 'leagues_off');
  }
  return {
    perEducator: Number(s['limit.educator_leagues']?.value) || EDUCATOR_LEAGUES_DEFAULT,
    maxMembers: Number(s['limit.league_max_members']?.value) || LEAGUE_MEMBERS_DEFAULT,
  };
}

const memberCount = (env, leagueId) => env.DB.prepare("SELECT COUNT(*) AS n FROM league_members WHERE league_id = ?1 AND state = 'member'").bind(leagueId).first().then((r) => r.n);

/** The educator's public name: their approved channel or centre, else their nickname. */
const educatorName = (env, ownerId) => env.DB.prepare(
  `SELECT COALESCE((SELECT channel_name FROM educator_requests WHERE user_id = u.id AND status = 'approved' ORDER BY decided_at DESC LIMIT 1), u.display_name, u.nickname) AS name
   FROM users u WHERE u.id = ?1`
).bind(ownerId).first().then((r) => r?.name || 'Your tutor');

/** A suspended educator's leagues pause: no new students until the suspension ends (EDU-08). */
async function requireOwnerActive(env, l) {
  const owner = await env.DB.prepare('SELECT status, suspended_until FROM users WHERE id = ?1').bind(l.owner_id).first();
  if (!owner || owner.status === 'banned' || owner.status === 'deleted') throw new HttpError(410, 'This league is closed.', 'league_closed');
  if (owner.status === 'suspended' && (!owner.suspended_until || Date.parse(owner.suspended_until) > Date.now())) {
    throw new HttpError(423, 'This league is paused for now. Please try again later.', 'league_paused');
  }
}

/** Members are told who closed it: their tutor, or the Takkar team. */
const closedNotice = (l) => (l.closed_reason === 'Closed by the educator' ? 'Your tutor closed this league.' : 'This league was closed by Takkar.');

/** A league keeps the size it was created with; older rows without one get the default. */
const cap = (l) => Number(l.max_members) || LEAGUE_MEMBERS_DEFAULT;

function summary(l, extra = {}) {
  return { id: l.id, name: l.name, exam: l.exam_id, status: l.status, approval: !!l.approval, max: cap(l), ...extra };
}

/** A league this player owns, or 404 (so others learn nothing). */
async function ownedLeague(env, user, id) {
  const l = await env.DB.prepare('SELECT * FROM leagues WHERE id = ?1 AND owner_id = ?2').bind(id, user.id).first();
  if (!l) throw notFound('This league is not available.');
  return l;
}
function requireOpen(l) {
  if (l.status === 'closed') throw new HttpError(409, 'This league is closed.', 'league_closed');
}

// ---------- GET /api/leagues: leagues I run and leagues I'm in ----------
export async function listMine({ request, env }) {
  const user = await currentPlayer(request, env);
  const s = await getSettings(env);
  const [{ results: owned }, { results: joined }] = await Promise.all([
    env.DB.prepare(
      `SELECT l.*, (SELECT COUNT(*) FROM league_members m WHERE m.league_id = l.id AND m.state = 'member') AS members,
         (SELECT COUNT(*) FROM league_members m WHERE m.league_id = l.id AND m.state = 'pending') AS waiting
       FROM leagues l WHERE l.owner_id = ?1 AND l.status != 'closed' ORDER BY l.created_at ASC`
    ).bind(user.id).all(),
    env.DB.prepare(
      `SELECT l.*, m.state AS you, (SELECT COUNT(*) FROM league_members x WHERE x.league_id = l.id AND x.state = 'member') AS members
       FROM league_members m JOIN leagues l ON l.id = m.league_id
       WHERE m.user_id = ?1 AND m.state IN ('member', 'pending') AND l.owner_id != ?1 ORDER BY m.joined_at ASC`
    ).bind(user.id).all(),
  ]);
  const names = Object.fromEntries(await Promise.all([...new Set(joined.map((l) => l.owner_id))].map(async (id) => [id, await educatorName(env, id)])));
  return json({
    educator: user.role === 'educator',
    limits: { leagues: Number(s['limit.educator_leagues']?.value) || EDUCATOR_LEAGUES_DEFAULT },
    owned: owned.map((l) => summary(l, { role: 'owner', members: l.members, waiting: l.waiting, inviteCode: l.invite_code })),
    joined: joined.map((l) => summary(l, { role: l.you, members: l.members, educator: names[l.owner_id] })),
  });
}

// ---------- POST /api/leagues: an educator creates a league ----------
export async function create({ request, env }) {
  const user = await currentPlayer(request, env);
  const limits = await leagueSettings(env);
  await limit(env, 'league_create', user.id, 10, 86400);
  if (user.role !== 'educator') throw new HttpError(403, 'Only verified educators can create leagues.', 'not_educator');
  const body = (await readJson(request)) || {};
  const name = String(body.name ?? '').trim().replace(/\s+/g, ' ');
  const nameError = await checkLeagueName(env, name);
  if (nameError) throw bad(nameError, 'name');
  const exam = String(body.exam ?? '');
  if (!Object.hasOwn(EXAMS, exam)) throw bad('Choose the exam this league prepares for.', 'exam');
  const owned = await env.DB.prepare("SELECT COUNT(*) AS n FROM leagues WHERE owner_id = ?1 AND status != 'closed'").bind(user.id).first();
  if (owned.n >= limits.perEducator) {
    throw new HttpError(409, `Your plan allows ${limits.perEducator} leagues. Close one to start another.`, 'league_limit');
  }
  const id = randomId('lg_');
  const now = nowIso();
  // Codes are random; retry on the rare clash with an existing one.
  for (let tries = 0; ; tries++) {
    try {
      await env.DB.prepare(
        `INSERT INTO leagues (id, name, owner_id, level, approval, invite_code, status, created_at, exam_id, max_members)
         VALUES (?1, ?2, ?3, 'exam', ?4, ?5, 'live', ?6, ?7, ?8)`
      ).bind(id, name, user.id, body.approval === false ? 0 : 1, newCode(), now, exam, limits.maxMembers).run();
      break;
    } catch (e) {
      if (tries >= 3 || !/UNIQUE/i.test(String(e?.message))) throw e;
    }
  }
  const l = await env.DB.prepare('SELECT * FROM leagues WHERE id = ?1').bind(id).first();
  return json({ league: summary(l, { role: 'owner', members: 0, waiting: 0, inviteCode: l.invite_code }) }, 201);
}

// ---------- GET /api/leagues/invite/:code: what an invite opens ----------
export async function preview({ request, env, params }) {
  const user = await currentPlayer(request, env, { required: false });
  await leagueSettings(env);
  await limit(env, 'league_preview', user ? user.id : request.headers.get('CF-Connecting-IP') || 'anon', 60, 3600);
  const code = cleanLeagueCode(params.code);
  const l = isLeagueCode(code) ? await env.DB.prepare('SELECT * FROM leagues WHERE invite_code = ?1').bind(code).first() : null;
  if (!l) throw notFound(NOT_FOUND);
  if (l.status !== 'live') throw new HttpError(410, 'This league is closed.', 'league_closed');
  await requireOwnerActive(env, l);
  const members = await memberCount(env, l.id);
  let you = null;
  if (user) you = l.owner_id === user.id ? 'owner' : (await env.DB.prepare('SELECT state FROM league_members WHERE league_id = ?1 AND user_id = ?2').bind(l.id, user.id).first())?.state || null;
  return json({ league: summary(l, { members, full: members >= cap(l), educator: await educatorName(env, l.owner_id) }), you });
}

// ---------- POST /api/leagues/invite/:code/join ----------
export async function join({ request, env, params }) {
  const user = await currentPlayer(request, env);
  await leagueSettings(env);
  await limit(env, 'league_join', user.id, 30, 3600);
  const code = cleanLeagueCode(params.code);
  const l = isLeagueCode(code) ? await env.DB.prepare('SELECT * FROM leagues WHERE invite_code = ?1').bind(code).first() : null;
  if (!l) throw notFound(NOT_FOUND);
  if (l.status !== 'live') throw new HttpError(410, 'This league is closed.', 'league_closed');
  if (l.owner_id === user.id) throw bad('This is your own league.', 'own_league');
  await requireOwnerActive(env, l);
  const body = (await readJson(request)) || {};
  const realName = cleanRealName(body.realName);
  const nameProblem = realNameError(realName);
  if (nameProblem) throw bad(nameProblem, 'real_name');
  if (body.consent !== true) throw bad('Please agree that your tutor sees your results.', 'consent');

  const existing = await env.DB.prepare('SELECT state FROM league_members WHERE league_id = ?1 AND user_id = ?2').bind(l.id, user.id).first();
  if (existing?.state === 'removed') throw new HttpError(403, 'Your tutor removed you from this league, so you cannot join it again.', 'removed');
  if (existing?.state === 'member' || existing?.state === 'pending') {
    // Already in (or waiting): just update the name they gave.
    await env.DB.prepare('UPDATE league_members SET real_name = ?1 WHERE league_id = ?2 AND user_id = ?3').bind(realName, l.id, user.id).run();
    return json({ ok: true, state: existing.state, league: summary(l) });
  }
  const mine = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM league_members m JOIN leagues q ON q.id = m.league_id WHERE m.user_id = ?1 AND m.state IN ('member', 'pending') AND q.status = 'live'"
  ).bind(user.id).first();
  if (mine.n >= LEAGUES_JOINED_MAX) throw bad(`You are already in ${LEAGUES_JOINED_MAX} leagues. Leave one to join another.`, 'too_many_leagues');
  if ((await memberCount(env, l.id)) >= cap(l)) throw bad(`This league is full (${cap(l)} students). Ask your tutor.`, 'league_full');
  const state = l.approval ? 'pending' : 'member';
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO league_members (league_id, user_id, joined_at, state, real_name, consent_at) VALUES (?1, ?2, ?3, ?4, ?5, ?3)
     ON CONFLICT(league_id, user_id) DO UPDATE SET state = ?4, joined_at = ?3, real_name = ?5, consent_at = ?3, decided_at = NULL`
  ).bind(l.id, user.id, now, state, realName).run();
  return json({ ok: true, state, league: summary(l) });
}

// ---------- GET /api/leagues/:id: the league page ----------
export async function page({ request, env, params }) {
  const user = await currentPlayer(request, env);
  const l = await env.DB.prepare('SELECT * FROM leagues WHERE id = ?1').bind(params.id).first();
  if (!l) throw notFound('This league is not available.');
  const members = await memberCount(env, l.id);
  if (l.owner_id === user.id) {
    const { results: people } = await env.DB.prepare(
      `SELECT m.user_id, m.state, m.real_name, m.joined_at, COALESCE(u.display_name, u.nickname) AS nickname, u.nickname AS username FROM league_members m JOIN users u ON u.id = m.user_id
       WHERE m.league_id = ?1 AND m.state IN ('member', 'pending') ORDER BY m.state = 'pending' DESC, m.real_name COLLATE NOCASE ASC`
    ).bind(l.id).all();
    const row = (p) => ({ id: p.user_id, realName: p.real_name, nickname: p.nickname, username: p.username, joinedAt: p.joined_at });
    return json({
      league: summary(l, { members, inviteCode: l.invite_code, closedReason: l.status === 'closed' ? (l.closed_reason === 'Closed by the educator' ? 'You closed this league.' : 'Takkar closed this league. Contact us if you think this is a mistake.') : null }),
      role: 'owner',
      members: people.filter((p) => p.state === 'member').map(row),
      waiting: people.filter((p) => p.state === 'pending').map(row),
    });
  }
  const you = await env.DB.prepare('SELECT state, real_name FROM league_members WHERE league_id = ?1 AND user_id = ?2').bind(l.id, user.id).first();
  if (!you || !['member', 'pending'].includes(you.state)) throw notFound('This league is not available.');
  return json({
    league: summary(l, { members, educator: await educatorName(env, l.owner_id), closedReason: l.status === 'closed' ? closedNotice(l) : null }),
    role: you.state,
    you: { realName: you.real_name },
  });
}

// ---------- Educator: approve, decline, remove ----------
async function memberAction(request, env, params, from, to) {
  const user = await currentPlayer(request, env);
  await leagueSettings(env);
  const l = await ownedLeague(env, user, params.id);
  requireOpen(l);
  const m = await env.DB.prepare('SELECT state FROM league_members WHERE league_id = ?1 AND user_id = ?2').bind(l.id, params.uid).first();
  if (!m || !from.includes(m.state)) throw notFound('That student is not in this league.');
  if (to === 'member' && (await memberCount(env, l.id)) >= cap(l)) {
    throw bad(`The league is full (${cap(l)} students). Remove someone first.`, 'league_full');
  }
  // Anyone who is no longer in the league stops having a real name on file.
  await env.DB.prepare(`UPDATE league_members SET state = ?1, decided_at = ?2${to === 'member' ? '' : ', real_name = NULL'} WHERE league_id = ?3 AND user_id = ?4`)
    .bind(to, nowIso(), l.id, params.uid).run();
  return json({ ok: true });
}
export const approve = ({ request, env, params }) => memberAction(request, env, params, ['pending'], 'member');
// A declined request can be made again (it may have been a mistake); only removal is final.
export const decline = ({ request, env, params }) => memberAction(request, env, params, ['pending'], 'left');
export const remove = ({ request, env, params }) => memberAction(request, env, params, ['member'], 'removed');

// ---------- Educator: new code, rename, close ----------
export async function resetInvite({ request, env, params }) {
  const user = await currentPlayer(request, env);
  await leagueSettings(env);
  await limit(env, 'league_reset', user.id, 10, 86400);
  const l = await ownedLeague(env, user, params.id);
  requireOpen(l);
  for (let tries = 0; ; tries++) {
    const code = newCode();
    try {
      await env.DB.prepare('UPDATE leagues SET invite_code = ?1 WHERE id = ?2').bind(code, l.id).run();
      return json({ inviteCode: code });
    } catch (e) {
      if (tries >= 3 || !/UNIQUE/i.test(String(e?.message))) throw e;
    }
  }
}

export async function rename({ request, env, params }) {
  const user = await currentPlayer(request, env);
  await leagueSettings(env);
  const l = await ownedLeague(env, user, params.id);
  requireOpen(l);
  const body = (await readJson(request)) || {};
  const name = String(body.name ?? '').trim().replace(/\s+/g, ' ');
  const nameError = await checkLeagueName(env, name);
  if (nameError) throw bad(nameError, 'name');
  await env.DB.prepare('UPDATE leagues SET name = ?1 WHERE id = ?2').bind(name, l.id).run();
  return json({ ok: true, name });
}

export async function close({ request, env, params }) {
  const user = await currentPlayer(request, env);
  const l = await ownedLeague(env, user, params.id);
  requireOpen(l);
  const now = nowIso();
  // Tests not yet started are cancelled with it, so students' reminders and the start button go too.
  await env.DB.batch([
    env.DB.prepare("UPDATE leagues SET status = 'closed', closed_at = ?1, closed_reason = 'Closed by the educator' WHERE id = ?2").bind(now, l.id),
    env.DB.prepare("UPDATE live_tests SET status = 'cancelled', cancelled_at = ?1 WHERE league_id = ?2 AND status = 'scheduled' AND starts_at > ?1").bind(now, l.id),
  ]);
  return json({ ok: true });
}

// ---------- Student: leave ----------
export async function leave({ request, env, params }) {
  const user = await currentPlayer(request, env);
  const m = await env.DB.prepare("SELECT state FROM league_members WHERE league_id = ?1 AND user_id = ?2 AND state IN ('member', 'pending')").bind(params.id, user.id).first();
  if (!m) throw notFound('You are not in this league.');
  // Leaving forgets the real name given to the tutor.
  await env.DB.prepare("UPDATE league_members SET state = 'left', real_name = NULL, decided_at = ?1 WHERE league_id = ?2 AND user_id = ?3").bind(nowIso(), params.id, user.id).run();
  return json({ ok: true });
}

/** A banned player leaves their leagues; leagues they ran close. */
export function bannedLeagueStatements(env, userId, now) {
  return [
    env.DB.prepare("UPDATE leagues SET status = 'closed', closed_at = ?1, closed_reason = 'Educator account closed' WHERE owner_id = ?2 AND status != 'closed'").bind(now, userId),
    env.DB.prepare('UPDATE league_members SET real_name = NULL WHERE league_id IN (SELECT id FROM leagues WHERE owner_id = ?1)').bind(userId),
    env.DB.prepare("UPDATE league_members SET state = 'left', real_name = NULL, decided_at = ?1 WHERE user_id = ?2 AND state IN ('member', 'pending')").bind(now, userId),
  ];
}
