// Player API for the Takkar app (beta 0.2.0).
// Sign-in is Google or phone through Firebase; guests never call the signed-in routes.
// The app sends "Authorization: Bearer <token>"; only the token's SHA-256 is stored.
import { json, bad, HttpError, readJson, nowIso, istDay, requireString } from '../lib/http.js';
import { sha256, randomToken, randomId } from '../lib/crypto.js';
import { clientIp, auditStatement } from '../lib/auth.js';
import { getSettings } from '../lib/settings.js';
import { checkNickname } from '../lib/names.js';
import { verifyFirebaseToken } from '../lib/firebase.js';
import { deleteStatements } from './players.js';
import { TEMPLATES } from '../../../app/www/js/engine/index.js';
import { checkSquadDuel, ownedSquadStatements } from './squads.js';

const SESSION_DAYS = 90;
const TEMPLATE_IDS = new Set(TEMPLATES.map((t) => t.id));
const DEFAULT_UPDATE_URL = 'https://takkar.vercel.app/beta';

// ---------- CORS: the Android app (https://localhost in its WebView) and the web app ----------

const ALLOWED_ORIGINS = new Set([
  'https://localhost', 'http://localhost', 'capacitor://localhost',
  // The web app at /play/ on the website, now and after the domain moves.
  'https://takkar.vercel.app', 'https://playtakkar.in', 'https://www.playtakkar.in',
  'http://localhost:8790', 'http://127.0.0.1:8790', // development (npm run serve)
]);

export function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Takkar-App',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

// ---------- Rate limits (fixed windows, counted in D1) ----------

export async function limit(env, name, who, max, windowS) {
  const window = Math.floor(Date.now() / 1000 / windowS);
  const key = `${name}:${await sha256(`${who}:${istDay()}`)}`;
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
     ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window_start = ?2 THEN count + 1 ELSE 1 END, window_start = ?2
     RETURNING count`
  ).bind(key, window).first();
  // Now and then, clear out windows that have ended long ago.
  if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?1').bind(window - 2).run();
  if (row.count > max) throw new HttpError(429, 'Too many tries. Please wait a few minutes.', 'rate_limited');
}

// ---------- Sessions ----------

const bearer = (request) => {
  const m = (request.headers.get('Authorization') || '').match(/^Bearer ([A-Za-z0-9_-]{20,100})$/);
  return m ? m[1] : null;
};

function blockedError(user) {
  if (user.status === 'banned') return new HttpError(403, 'This account has been closed for breaking the rules.', 'banned');
  if (user.status === 'suspended' && (!user.suspended_until || Date.parse(user.suspended_until) > Date.now())) {
    const err = new HttpError(403, user.suspended_until ? 'This account is paused for now.' : 'This account is paused while we review a report.', 'suspended');
    err.until = user.suspended_until;
    return err;
  }
  return null;
}

/** The signed-in player, or null for guests. With required = true, guests get 401. */
export async function currentPlayer(request, env, { required = true } = {}) {
  const token = bearer(request);
  if (!token) {
    if (required) throw new HttpError(401, 'Please sign in.', 'unauthorised');
    return null;
  }
  const row = await env.DB.prepare(
    `SELECT s.token_hash, s.expires_at, s.last_seen_at AS session_seen, u.*
     FROM player_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?1`
  ).bind(await sha256(token)).first();
  if (!row || Date.parse(row.expires_at) < Date.now() || row.status === 'deleted') {
    if (required) throw new HttpError(401, 'Your sign-in has ended. Please sign in again.', 'session_ended');
    return null;
  }
  const blocked = blockedError(row);
  if (blocked) throw blocked;
  // A suspension that has run out ends by itself.
  if (row.status === 'suspended') await env.DB.prepare("UPDATE users SET status = 'active', suspended_until = NULL WHERE id = ?1").bind(row.id).run();
  // Slide the session and "last seen" at most once an hour, to save writes.
  if (Date.now() - Date.parse(row.session_seen) > 3600000) {
    const now = nowIso();
    await env.DB.batch([
      env.DB.prepare('UPDATE player_sessions SET last_seen_at = ?1, expires_at = ?2 WHERE token_hash = ?3').bind(now, new Date(Date.now() + SESSION_DAYS * 86400000).toISOString(), row.token_hash),
      env.DB.prepare('UPDATE users SET last_seen_at = ?1 WHERE id = ?2').bind(now, row.id),
    ]);
  }
  return row;
}

async function newSession(env, userId) {
  const token = randomToken(32);
  const now = nowIso();
  return {
    token,
    statement: env.DB.prepare('INSERT INTO player_sessions (token_hash, user_id, created_at, last_seen_at, expires_at) VALUES (?1, ?2, ?3, ?3, ?4)')
      .bind(await sha256(token), userId, now, new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()),
  };
}

function playerJson(u, streak) {
  return {
    id: u.id,
    nickname: u.nickname,
    signInMethod: u.sign_in_method,
    email: u.email || null,
    phoneLast4: u.phone_last4 || null,
    plusUntil: u.plus_until && Date.parse(u.plus_until) > Date.now() ? u.plus_until : null,
    mutedUntil: u.muted_until && Date.parse(u.muted_until) > Date.now() ? u.muted_until : null,
    ageConfirmedAt: u.age_confirmed_at,
    termsVersion: u.terms_version,
    createdAt: u.created_at,
    exam: u.exam_id || null,
    examMonth: u.exam_month || null,
    goal: u.daily_goal || null,
    streak: streak ? { current: streak.current, best: streak.best, lastDay: streak.last_day } : { current: 0, best: 0, lastDay: null },
  };
}

/**
 * The browser's Firebase settings (all public by design; Firebase protects sign-in with the
 * authorised-domains list). Null until set in wrangler.jsonc, and then web sign-in turns on.
 */
function webFirebase(env) {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_WEB_API_KEY || !env.FIREBASE_WEB_APP_ID) return null;
  return {
    apiKey: env.FIREBASE_WEB_API_KEY,
    authDomain: env.FIREBASE_AUTH_DOMAIN || `${env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: env.FIREBASE_PROJECT_ID,
    appId: env.FIREBASE_WEB_APP_ID,
  };
}

// ---------- GET /api/config: switches, limits, announcements, paused questions, app version ----------

// Android builds before 0.3.1 were made without Firebase's google-services.json, so their sign-in
// buttons would fail. They are told sign-in is not set up and stay guest-only until they update.
const FIRST_SIGN_IN_BUILD = [0, 3, 1];
function nativeBeforeSignIn(request) {
  const origin = request.headers.get('Origin') || '';
  if (!/^(https|capacitor):\/\/localhost$/.test(origin)) return false; // the web app always can
  const version = (request.headers.get('X-Takkar-App') || '0.0.0').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((version[i] || 0) !== FIRST_SIGN_IN_BUILD[i]) return (version[i] || 0) < FIRST_SIGN_IN_BUILD[i];
  }
  return false;
}

export async function config({ request, env }) {
  const [settings, { results: notes }, { results: paused }] = await Promise.all([
    getSettings(env),
    env.DB.prepare("SELECT id, text, created_at FROM announcements WHERE active = 1 AND scope = 'all' ORDER BY created_at DESC LIMIT 3").all(),
    env.DB.prepare("SELECT id FROM templates WHERE status != 'active'").all(),
  ]);
  const v = (key, fallback) => (settings[key] ? settings[key].value : fallback);
  return json({
    paused: v('switch.pause_all', false),
    switches: {
      signups: v('switch.signups', true),
      duels: v('switch.duels', true),
      squads: v('switch.squads', true),
      leagues: v('switch.leagues', true),
      plusPurchases: v('switch.plus_purchases', false),
    },
    limits: { freeDuelsPerDay: v('limit.free_duels_per_day', 3) },
    announcements: notes.map((n) => ({ id: n.id, text: n.text, at: n.created_at })),
    pausedTemplates: paused.map((t) => t.id),
    app: { latestBuild: v('app.latest_build', 1), minBuild: v('app.min_build', 1), updateUrl: env.APP_UPDATE_URL || DEFAULT_UPDATE_URL },
    auth: { firebase: !!env.FIREBASE_PROJECT_ID && !nativeBeforeSignIn(request), phone: v('switch.phone_sign_in', false), web: webFirebase(env) },
    serverTime: nowIso(),
  }, 200, { 'Cache-Control': 'public, max-age=30', Vary: 'Origin, X-Takkar-App' });
}

// ---------- POST /api/auth/firebase: sign in, or create the account on first sign-in ----------

export async function signIn({ request, env }) {
  await limit(env, 'auth', clientIp(request), 30, 600);
  const body = await readJson(request);
  const who = await verifyFirebaseToken(env, request, body.idToken);

  const existing = await env.DB.prepare('SELECT * FROM users WHERE firebase_uid = ?1').bind(who.uid).first();
  if (existing) {
    const blocked = blockedError(existing);
    if (blocked) throw blocked;
    const session = await newSession(env, existing.id);
    await env.DB.batch([session.statement, env.DB.prepare('UPDATE users SET last_seen_at = ?1 WHERE id = ?2').bind(nowIso(), existing.id)]);
    const streak = await env.DB.prepare('SELECT * FROM streaks WHERE user_id = ?1').bind(existing.id).first();
    return json({ token: session.token, player: playerJson(existing, streak), created: false });
  }

  // First sign-in: the app asks for a nickname and the 18+ confirmation, then calls again.
  if (!body.profile) return json({ needsProfile: true, provider: who.provider });

  const settings = await getSettings(env);
  if (settings['switch.signups']?.value === false || settings['switch.pause_all']?.value === true) {
    throw new HttpError(403, 'New accounts are paused for a short while. Please play as a guest and try again later.', 'signups_off');
  }
  const nickname = requireString(body.profile.nickname, 'Nickname', { max: 12 });
  const nickError = await checkNickname(env, nickname);
  if (nickError) throw bad(nickError, 'nickname');
  if (body.profile.ageConfirmed !== true) throw bad('Takkar is for people aged 18 and over.', 'age');
  const termsVersion = requireString(body.profile.termsVersion, 'Terms version', { max: 40 });
  if (who.email && await env.DB.prepare('SELECT id FROM users WHERE email = ?1').bind(who.email).first()) {
    throw new HttpError(409, 'That Google account already has a Takkar account. Sign in with it instead.', 'email_taken');
  }

  const id = randomId('usr_');
  const now = nowIso();
  const session = await newSession(env, id);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, nickname, email, sign_in_method, age_confirmed_at, terms_version, created_at, created_day, last_seen_at, firebase_uid, phone_last4)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?5, ?7, ?5, ?8, ?9)`
    ).bind(id, nickname, who.email, who.provider, now, termsVersion, istDay(), who.uid, who.phone ? who.phone.slice(-4) : null),
    env.DB.prepare('INSERT INTO streaks (user_id, current, best) VALUES (?1, 0, 0)').bind(id),
    session.statement,
  ]);
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(id).first();
  return json({ token: session.token, player: playerJson(user, null), created: true }, 201);
}

// ---------- GET /api/me: profile, streak and (with ?history=1) recent duels for a new phone ----------

export async function me({ request, env, query }) {
  const user = await currentPlayer(request, env);
  const streak = await env.DB.prepare('SELECT * FROM streaks WHERE user_id = ?1').bind(user.id).first();
  const out = { player: playerJson(user, streak) };
  if (query.get('history') === '1') {
    const { results: duels } = await env.DB.prepare(
      `SELECT id, kind, seed, topic, level, marking, exam_id, squad_id, rival, day, finished_at, status, score, rival_score, verdict,
              right_count, wrong_count, skipped_count, time_ms, counted
       FROM duels WHERE user_id = ?1 ORDER BY day DESC, finished_at DESC LIMIT 300`
    ).bind(user.id).all();
    const { results: answers } = await env.DB.prepare(
      `SELECT a.duel_id, a.q_index, a.template, a.choice, a.correct, a.points, a.time_ms FROM duel_answers a
       WHERE a.duel_id IN (SELECT id FROM duels WHERE user_id = ?1 ORDER BY day DESC, finished_at DESC LIMIT 300)
       ORDER BY a.duel_id, a.q_index`
    ).bind(user.id).all();
    const byDuel = new Map();
    for (const a of answers) {
      if (!byDuel.has(a.duel_id)) byDuel.set(a.duel_id, []);
      byDuel.get(a.duel_id).push({ template: a.template, choice: a.choice, correct: !!a.correct, points: a.points, timeMs: a.time_ms });
    }
    out.history = duels.reverse().map((d) => ({
      id: d.id, at: Date.parse(d.finished_at), day: d.day, kind: d.kind, seed: d.seed, topic: d.topic, level: d.level,
      marking: d.marking, exam: d.exam_id || null, squadId: d.squad_id || null, rival: d.rival, status: d.status, score: d.score, rivalScore: d.rival_score, verdict: d.verdict,
      counted: !!d.counted, right: d.right_count, wrong: d.wrong_count, skipped: d.skipped_count, timeMs: d.time_ms,
      answers: byDuel.get(d.id) || [],
    }));
  }
  return json(out);
}

// ---------- POST /api/me/nickname: a new nickname, at most once every 7 days ----------

export const NICKNAME_DAYS = 7;
export async function saveNickname({ request, env }) {
  const user = await currentPlayer(request, env);
  await limit(env, 'nickname', user.id, 10, 3600);
  const body = await readJson(request);
  const nickname = String(body.nickname || '').trim();
  if (nickname === user.nickname) return json({ ok: true, player: playerJson(user, null) });
  const last = user.nickname_changed_at ? Date.parse(user.nickname_changed_at) : 0;
  const wait = last + NICKNAME_DAYS * 86400000 - Date.now();
  if (wait > 0) throw bad(`You can change your nickname again in ${Math.ceil(wait / 86400000)} day${wait > 86400000 ? 's' : ''}.`, 'nickname_wait');
  const error = await checkNickname(env, nickname, user.id);
  if (error) throw bad(error, 'bad_nickname');
  await env.DB.prepare('UPDATE users SET nickname = ?1, nickname_changed_at = ?2 WHERE id = ?3').bind(nickname, nowIso(), user.id).run();
  const fresh = await env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(user.id).first();
  const streak = await env.DB.prepare('SELECT * FROM streaks WHERE user_id = ?1').bind(user.id).first();
  return json({ ok: true, player: playerJson(fresh, streak) });
}

// ---------- POST /api/me/profile: the exam, its month and the daily goal ----------

export async function saveProfile({ request, env }) {
  const user = await currentPlayer(request, env);
  await limit(env, 'profile', user.id, 60, 3600);
  const body = await readJson(request);
  if (!EXAMS[body.exam]) throw bad('Pick SSC CGL, IBPS PO or RRB NTPC.', 'bad_exam');
  const month = body.examMonth ?? null;
  if (month !== null && !MONTH_RE.test(month)) throw bad('Exam month must look like 2027-01.', 'bad_month');
  const goal = body.goal ?? null;
  if (goal !== null && !GOALS.includes(goal)) throw bad('Goal must be 1, 3 or 5 duels a day.', 'bad_goal');
  await env.DB.prepare('UPDATE users SET exam_id = ?2, exam_month = ?3, daily_goal = ?4 WHERE id = ?1').bind(user.id, body.exam, month, goal).run();
  const fresh = await env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(user.id).first();
  const streak = await env.DB.prepare('SELECT * FROM streaks WHERE user_id = ?1').bind(user.id).first();
  return json({ ok: true, player: playerJson(fresh, streak) });
}

// ---------- POST /api/duels: finished and abandoned duels, sent in batches (works after offline play) ----------

const KINDS = ['solo', 'rematch', 'challenge', 'league', 'squad'];
const TOPICS = ['quant', 'reasoning', 'mixed'];
const LEVELS = ['easy', 'exam', 'hard'];
const MARKINGS = ['exam', 'speed'];
const RIVAL_IDS = ['relaxed', 'steady', 'sharp'];
const LIMIT_MS = { easy: 20000, exam: 30000, hard: 35000 };
const isInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
/** Exam scores are multiples of 1/12 (+2/−0.5, +1/−0.25, +1/−⅓), sent as decimals. */
const isTwelfths = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max && Math.abs(n * 12 - Math.round(n * 12)) < 1e-6;
const tidy = (n) => Math.round(n * 12) / 12;

// The launch exams (app/www/js/exams.js). Ten questions in a duel.
const EXAMS = {
  'ssc-cgl': { right: 2, wrong: -0.5, seconds: 36 },
  'ibps-po': { right: 1, wrong: -0.25, seconds: 36 },
  'rrb-ntpc': { right: 1, wrong: -1 / 3, seconds: 54 },
};
const MONTH_RE = /^20\d\d-(0[1-9]|1[0-2])$/;
const GOALS = [1, 3, 5];

/** Lowest and highest score of ten questions, and the most time one answer can take. */
function duelBounds(d) {
  const exam = d.exam ? EXAMS[d.exam] : null;
  if (d.marking === 'speed') return { lo: 0, hi: 150, step: isInt, answerMs: exam ? exam.seconds * 1000 : LIMIT_MS[d.level], pts: [-1, 15] };
  if (exam) return { lo: 10 * exam.wrong, hi: 10 * exam.right, step: isTwelfths, answerMs: exam.seconds * 1000, pts: [exam.wrong, exam.right] };
  return { lo: -10, hi: 40, step: isInt, answerMs: LIMIT_MS[d.level], pts: [-1, 15] };
}

function checkDuel(d, today) {
  const fail = (what) => bad(`Duel ${String(d?.id).slice(0, 40)}: ${what}.`, 'bad_duel');
  if (!d || typeof d !== 'object') throw fail('not an object');
  if (typeof d.id !== 'string' || !/^[A-Za-z0-9_-]{4,60}$/.test(d.id)) throw fail('id');
  if (!KINDS.includes(d.kind) || !TOPICS.includes(d.topic) || !LEVELS.includes(d.level) || !MARKINGS.includes(d.marking)) throw fail('settings');
  if (d.rival !== null && d.rival !== undefined && !RIVAL_IDS.includes(d.rival)) throw fail('rival');
  if (!['finished', 'abandoned'].includes(d.status)) throw fail('status');
  if (!isInt(d.day, today - 14, today + 1)) throw fail('day');
  if (!isInt(d.seed, 0, 2 ** 32)) throw fail('seed');
  if (d.exam !== null && d.exam !== undefined && !EXAMS[d.exam]) throw fail('exam');
  const { lo, hi, step, answerMs, pts } = duelBounds(d);
  if (!step(d.score, lo - 1e-9, hi + 1e-9) || !step(d.rivalScore, lo - 1e-9, hi + 1e-9)) throw fail('score');
  if (!isInt(d.right, 0, 10) || !isInt(d.wrong, 0, 10) || !isInt(d.skipped, 0, 10) || d.right + d.wrong + d.skipped !== 10) throw fail('counts');
  if (!isInt(d.timeMs, 0, 10 * answerMs)) throw fail('time');
  if (d.verdict !== null && d.verdict !== undefined && !['won', 'lost', 'tied'].includes(d.verdict)) throw fail('verdict');
  if (!Array.isArray(d.answers) || d.answers.length > 10) throw fail('answers');
  d.answers.forEach((a, i) => {
    if (!a || !TEMPLATE_IDS.has(a.template)) throw fail(`answer ${i + 1} template`);
    if (!(a.choice === null || isInt(a.choice, 0, 3))) throw fail(`answer ${i + 1} choice`);
    if (typeof a.correct !== 'boolean' || !isTwelfths(a.points, pts[0] - 1e-9, pts[1] + 1e-9) || !isInt(a.timeMs, 0, answerMs)) throw fail(`answer ${i + 1}`);
  });
  if (d.answers.filter((a) => a.correct).length !== d.right) throw fail('right count does not match answers');
}

/** Rebuilds the streak from the days with a finished duel, so late (offline) uploads still count. */
async function rebuildStreak(env, userId) {
  const { results } = await env.DB.prepare("SELECT DISTINCT day FROM duels WHERE user_id = ?1 AND status = 'finished' ORDER BY day ASC").bind(userId).all();
  let current = 0, best = 0, last = null;
  for (const { day } of results) {
    current = last !== null && day === last + 1 ? current + 1 : 1;
    best = Math.max(best, current);
    last = day;
  }
  await env.DB.prepare(
    `INSERT INTO streaks (user_id, current, best, last_day) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(user_id) DO UPDATE SET current = excluded.current, best = MAX(streaks.best, excluded.best), last_day = excluded.last_day`
  ).bind(userId, current, best, last).run();
  return env.DB.prepare('SELECT * FROM streaks WHERE user_id = ?1').bind(userId).first();
}

export async function saveDuels({ request, env }) {
  const user = await currentPlayer(request, env);
  await limit(env, 'duels', user.id, 200, 3600);
  const body = await readJson(request);
  if (!Array.isArray(body.duels) || body.duels.length === 0 || body.duels.length > 50) throw bad('Send 1 to 50 duels.');
  const today = istDay();
  body.duels.forEach((d) => checkDuel(d, today));
  for (const d of body.duels) if (d.kind === 'squad') await checkSquadDuel(env, user.id, d);

  const stmts = [];
  const ids = {};
  const seen = new Set(); // seed + day of every duel earlier in this upload
  for (const d of body.duels) {
    // The server id mixes in the player, so one player can never overwrite another's duel.
    const id = 'd_' + (await sha256(`${user.id}:${d.id}`)).slice(0, 24);
    ids[d.id] = id;
    const finishedAt = new Date(typeof d.at === 'number' && d.at > 0 && d.at <= Date.now() + 60000 ? d.at : Date.now()).toISOString();
    // Ranks count only finished solo duels and the first attempt at a league's daily duel (DUEL-09).
    let counted = d.status === 'finished' && (d.kind === 'solo' || (d.kind === 'league' && d.counted === true)) ? 1 : 0;
    // A squad duel: only the first attempt that day (finished or left) goes on the squad table.
    // Any earlier duel with the same questions counts as that attempt, so playing a squad mate's
    // challenge code first (and learning the answers) does not lead to a counted score.
    const seedKey = `${d.seed}:${d.day}`;
    if (d.kind === 'squad') {
      const earlier = seen.has(seedKey) || !!(await env.DB.prepare('SELECT id FROM duels WHERE user_id = ?1 AND day = ?2 AND seed = ?3 AND id != ?4 LIMIT 1').bind(user.id, d.day, d.seed, id).first());
      counted = d.status === 'finished' && !earlier ? 1 : 0;
    }
    seen.add(seedKey);
    stmts.push(env.DB.prepare(
      `INSERT OR IGNORE INTO duels (id, user_id, seed, topic, level, marking, exam_id, kind, rival, day, started_at, finished_at, status, score, rival_score,
         right_count, wrong_count, skipped_count, time_ms, counted, verdict, squad_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?20, ?7, ?8, ?9, ?10, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?21)`
    ).bind(id, user.id, d.seed, d.topic, d.level, d.marking, d.kind, d.rival || null, d.day, finishedAt, d.status, tidy(d.score), tidy(d.rivalScore),
      d.right, d.wrong, d.skipped, d.timeMs, counted, d.status === 'finished' ? d.verdict || null : null, d.exam || null, d.kind === 'squad' ? d.squadId : null));
    d.answers.forEach((a, i) => stmts.push(env.DB.prepare(
      `INSERT OR IGNORE INTO duel_answers (duel_id, q_index, template, served_at, answered_at, choice, correct, points, time_ms)
       VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6, ?7, ?8)`
    ).bind(id, i, a.template, finishedAt, a.choice, a.correct ? 1 : 0, a.points, a.timeMs)));
  }
  await env.DB.batch(stmts);
  const streak = await rebuildStreak(env, user.id);
  return json({ ok: true, ids, streak: { current: streak.current, best: streak.best, lastDay: streak.last_day } });
}

// ---------- POST /api/reports: problems and reports about players (guests too) ----------

const REPORT_KINDS = { app_problem: 3, nickname: 2, cheating: 2, harassment: 1, under_18: 1, other: 3 };

export async function report({ request, env }) {
  const player = await currentPlayer(request, env, { required: false });
  await limit(env, 'report', player ? player.id : clientIp(request), 10, 3600);
  const body = await readJson(request);
  if (!(body.kind in REPORT_KINDS)) throw bad('Pick what the report is about.');
  const details = requireString(body.details, 'Details', { min: 5, max: 1000 });
  // A report from a squad page records the squad, if the reporter is in it.
  let squadRef = null;
  if (player && typeof body.squadId === 'string') {
    const inSquad = await env.DB.prepare("SELECT 1 FROM squad_members WHERE squad_id = ?1 AND user_id = ?2 AND state = 'member'").bind(body.squadId.slice(0, 40), player.id).first();
    if (inSquad) squadRef = body.squadId.slice(0, 40);
  }
  let target = null;
  if (body.nickname) {
    target = await env.DB.prepare("SELECT id FROM users WHERE nickname = ?1 AND status != 'deleted'").bind(String(body.nickname).slice(0, 12)).first();
  }
  const extra = [body.appVersion && `App ${String(body.appVersion).slice(0, 20)}`, body.device && `Device: ${String(body.device).slice(0, 80)}`,
    body.nickname && !target && `Reported nickname: ${String(body.nickname).slice(0, 12)}`].filter(Boolean).join(' · ');
  await env.DB.prepare(
    'INSERT INTO reports (id, kind, target_user_id, reporter_id, details, severity, status, created_at, target_ref) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)'
  ).bind(randomId('rep_'), body.kind, target?.id || null, player?.id || null, extra ? `${details}\n\n${extra}` : details, REPORT_KINDS[body.kind], 'open', nowIso(), squadRef).run();
  return json({ ok: true }, 201);
}

// ---------- POST /api/flags: "this question looks wrong" ----------

export async function flagQuestion({ request, env }) {
  const player = await currentPlayer(request, env, { required: false });
  await limit(env, 'flag', player ? player.id : clientIp(request), 30, 3600);
  const body = await readJson(request);
  if (!TEMPLATE_IDS.has(body.template)) throw bad('Unknown question type.');
  const text = requireString(body.text, 'Question', { max: 600 });
  const reason = body.reason === 'unclear' ? 'unclear' : 'wrong';
  const since = new Date(Date.now() - 86400000).toISOString();
  if (player) {
    const dup = await env.DB.prepare('SELECT id FROM question_flags WHERE user_id = ?1 AND question_text = ?2 AND created_at > ?3').bind(player.id, text, since).first();
    if (dup) return json({ ok: true, duplicate: true });
  }
  await env.DB.prepare('INSERT INTO question_flags (id, template, question_text, user_id, reason, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
    .bind(randomId('flg_'), body.template, text, player?.id || null, reason, 'open', nowIso()).run();

  // QGEN-06: too many flags in a day pauses the question type until a moderator looks.
  const settings = await getSettings(env);
  const pauseAfter = settings['flags.pause_after']?.value ?? 25;
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM question_flags WHERE template = ?1 AND created_at > ?2').bind(body.template, since).first();
  if (n >= pauseAfter) {
    const res = await env.DB.prepare("UPDATE templates SET status = 'paused', reason = ?1, updated_at = ?2, updated_by = 'system' WHERE id = ?3 AND status = 'active'")
      .bind(`Paused automatically: ${n} flags in 24 hours`, nowIso(), body.template).run();
    if (res.meta.changes) {
      await env.DB.batch([auditStatement(env, { id: null, email: 'system' }, 'template.auto_pause', { targetType: 'template', targetId: body.template, reason: `${n} flags in 24 hours` })]);
    }
  }
  return json({ ok: true }, 201);
}

// ---------- Sign out, and delete my account (PROF-03) ----------

export async function signOut({ request, env }) {
  const token = bearer(request);
  if (token) await env.DB.prepare('DELETE FROM player_sessions WHERE token_hash = ?1').bind(await sha256(token)).run();
  return json({ ok: true });
}

export async function deleteAccount({ request, env }) {
  const user = await currentPlayer(request, env);
  const now = nowIso();
  await env.DB.batch([
    ...(await ownedSquadStatements(env, user.id, now)),
    ...deleteStatements(env, user, now),
    auditStatement(env, { id: null, email: 'player' }, 'player.self_delete', { targetType: 'player', targetId: user.id, reason: 'Deleted from the app' }),
  ]);
  return json({ ok: true });
}
