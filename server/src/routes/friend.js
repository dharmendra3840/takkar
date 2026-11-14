// Live friend duels (design/03-duels-squads-leagues-rooms.md §3.1): create, preview, join, and the
// one-minute ticket that opens the live connection to the duel's DuelRoom object.
// Friend duels need sign-in and do not use any of the free daily duels (decided 4 Nov 2026).
import { json, bad, HttpError, readJson, nowIso } from '../lib/http.js';
import { sha256, randomToken, randomId } from '../lib/crypto.js';
import { currentPlayer, limit } from './player.js';
import { clientIp } from '../lib/auth.js';
import { EXAMS } from '../../../app/www/js/exams.js';
import { CURRENT_SET } from '../../../app/www/js/engine/index.js';

const LOBBY_MS = 10 * 60 * 1000; // a friend who isn't there in 10 minutes gets a challenge instead
const TICKET_MS = 60 * 1000;
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // no I, L or O, which look like numbers
const SITE = 'https://www.playtakkar.in';

const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_LETTERS[b % CODE_LETTERS.length]).join('');
const shown = (u) => ({ nickname: u.display_name || u.nickname, username: u.nickname });

async function ticketFor(env, userId, duelId) {
  const token = randomToken();
  await env.DB.prepare('INSERT INTO live_tickets (ticket_hash, user_id, duel_id, expires_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(await sha256(token), userId, duelId, new Date(Date.now() + TICKET_MS).toISOString()).run();
  return token;
}

async function duelByCode(env, code) {
  const duel = await env.DB.prepare('SELECT * FROM friend_duels WHERE code = ?1').bind(String(code || '').toUpperCase().slice(0, 6)).first();
  if (!duel) throw new HttpError(404, 'No duel has that code. Check it with your friend.', 'not_found');
  if (duel.status === 'lobby' && Date.parse(duel.expires_at) < Date.now()) duel.status = 'expired';
  return duel;
}

const preview = (duel, host, you) => ({
  code: duel.code, status: duel.status, expiresAt: duel.expires_at, exam: duel.exam_id,
  host: shown(host), you: you ? (you.id === duel.host_id ? 'host' : you.id === duel.guest_id ? 'guest' : null) : null,
  open: duel.status === 'lobby' && (!duel.guest_id || (!!duel.squad_id && (!you || you.id === duel.guest_id))), link: `${SITE}/play/?duel=${duel.code}`,
});

// ---------- POST /api/duels/friend: open a lobby (optionally for one squad member) ----------
export async function create({ request, env }) {
  const user = await currentPlayer(request, env);
  await limit(env, 'friend_duel', user.id, 30, 3600);
  const body = await readJson(request).catch(() => ({}));
  const own = (id) => (typeof id === 'string' && Object.hasOwn(EXAMS, id) ? EXAMS[id] : null);
  const exam = own(body.exam) || own(user.exam_id); // the phone's exam, which may not have synced yet
  if (!exam) throw bad('Pick your exam first: the duel follows its pattern.', 'no_exam');
  let guest = null, squadId = null;
  if (body.squadId || body.invitee) {
    // From a squad page: only that member can join, and both must be in the squad.
    const both = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM squad_members m JOIN squads s ON s.id = m.squad_id WHERE m.squad_id = ?1 AND m.user_id IN (?2, ?3) AND m.state = 'member' AND s.status = 'active'"
    ).bind(String(body.squadId || ''), user.id, String(body.invitee || '')).first();
    if (both.n !== 2 || body.invitee === user.id) throw bad('You can duel members of your own squads.', 'not_member');
    guest = body.invitee;
    squadId = body.squadId;
  }
  const id = randomId('fd_');
  const now = Date.now();
  let code;
  for (let i = 0; i < 5; i++) {
    code = newCode();
    const taken = await env.DB.prepare('SELECT 1 FROM friend_duels WHERE code = ?1').bind(code).first();
    if (!taken) break;
  }
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  await env.DB.prepare(
    `INSERT INTO friend_duels (id, code, exam_id, seed, set_version, host_id, guest_id, squad_id, status, created_at, expires_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'lobby', ?9, ?10)`
  ).bind(id, code, exam.id, seed, CURRENT_SET, user.id, guest, squadId, new Date(now).toISOString(), new Date(now + LOBBY_MS).toISOString()).run();
  const duel = await env.DB.prepare('SELECT * FROM friend_duels WHERE id = ?1').bind(id).first();
  return json({ duel: preview(duel, user, user), ticket: await ticketFor(env, user.id, id) }, 201);
}

// ---------- GET /api/duels/friend/:code: who invited you, in which exam (sign-in not needed to look) ----------
export async function show({ request, env, params }) {
  const you = await currentPlayer(request, env, { required: false });
  await limit(env, 'friend_preview', you ? you.id : clientIp(request), 120, 3600);
  const duel = await duelByCode(env, params.code);
  const host = await env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(duel.host_id).first();
  return json({ duel: preview(duel, host, you) });
}

// ---------- POST /api/duels/friend/:code/join: take the guest's place (or come back), and a ticket ----------
export async function join({ request, env, params }) {
  const user = await currentPlayer(request, env);
  await limit(env, 'friend_join', user.id, 60, 3600);
  const duel = await duelByCode(env, params.code);
  const player = duel.host_id === user.id || duel.guest_id === user.id;
  if (duel.status === 'expired' && !player) throw new HttpError(410, 'This duel’s lobby closed after 10 minutes. Ask for a new link, or play their challenge.', 'expired');
  if (!player) {
    if (duel.guest_id || duel.status !== 'lobby') throw new HttpError(409, 'This duel already has two players.', 'full');
    const took = await env.DB.prepare("UPDATE friend_duels SET guest_id = ?1 WHERE id = ?2 AND guest_id IS NULL AND status = 'lobby'").bind(user.id, duel.id).run();
    if (!took.meta.changes) throw new HttpError(409, 'This duel already has two players.', 'full');
  }
  const host = await env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(duel.host_id).first();
  const fresh = await env.DB.prepare('SELECT * FROM friend_duels WHERE id = ?1').bind(duel.id).first();
  return json({ duel: preview(fresh, host, user), ticket: await ticketFor(env, user.id, duel.id) });
}

// ---------- GET /api/live/duel/:code?ticket=: the WebSocket, handed to the duel's DuelRoom ----------
export async function connect(request, env, code) {
  if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'Expected a WebSocket.', code: 'upgrade' }, 426);
  const ticket = new URL(request.url).searchParams.get('ticket') || '';
  const hash = await sha256(ticket);
  const row = await env.DB.prepare('SELECT * FROM live_tickets WHERE ticket_hash = ?1').bind(hash).first();
  await env.DB.prepare('DELETE FROM live_tickets WHERE ticket_hash = ?1 OR expires_at < ?2').bind(hash, nowIso()).run(); // one use each
  if (!row || Date.parse(row.expires_at) < Date.now()) return json({ error: 'This connection link has expired. Try again.', code: 'ticket' }, 401);
  const duel = await env.DB.prepare('SELECT * FROM friend_duels WHERE id = ?1').bind(row.duel_id).first();
  if (!duel || duel.code !== String(code).toUpperCase()) return json({ error: 'No such duel.', code: 'not_found' }, 404);
  const role = duel.host_id === row.user_id ? 'host' : duel.guest_id === row.user_id ? 'guest' : null;
  if (!role) return json({ error: 'You are not in this duel.', code: 'not_player' }, 403);
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?1 AND status = 'active'").bind(row.user_id).first();
  if (!user) return json({ error: 'Your account cannot play right now.', code: 'blocked' }, 403);
  const headers = new Headers(request.headers);
  headers.set('x-takkar-role', role);
  headers.set('x-takkar-user', user.id);
  headers.set('x-takkar-nickname', encodeURIComponent(user.display_name || user.nickname));
  headers.set('x-takkar-username', user.nickname);
  headers.set('x-takkar-duel', JSON.stringify({ id: duel.id, code: duel.code, status: duel.status, seed: duel.seed, set_version: duel.set_version, exam_id: duel.exam_id, squad_id: duel.squad_id, expires_at: duel.expires_at }));
  const stub = env.DUEL_ROOM.get(env.DUEL_ROOM.idFromName(duel.id));
  return stub.fetch(new Request(request.url, { headers }));
}
