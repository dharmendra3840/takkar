// Live tests in tutor leagues (Live tests (beta) tab, LIVE-01 to LIVE-19; design/03 §3.4).
// The server owns the paper, the answer key, the clock and the marks; the phone only displays them.
// A tutor schedules a test from Takkar's question bank in the league's exam pattern. Members who joined
// before the start can start within the late window; each gets the full duration from their own start.
// After the test closes the tutor sees the class report and releases results; then each student sees
// their report. Nobody but the tutor sees the paper after the test (LIVE-19).
import { json, bad, notFound, HttpError, readJson, nowIso, istDay } from '../lib/http.js';
import { getSettings } from '../lib/settings.js';
import { blockedByFilter } from '../lib/names.js';
import { randomId } from '../lib/crypto.js';
import { currentPlayer, limit } from './player.js';
import { EXAMS, quantName } from '../../../app/www/js/exams.js';
import { generateSet, orderForPlayer, answerIndexForPlayer, CURRENT_SET, LABEL_HI } from '../../../app/www/js/engine/index.js';
import { QUANT } from '../../../app/www/js/engine/quant.js';
import { REASONING } from '../../../app/www/js/engine/reasoning.js';
import { createRng } from '../../../app/www/js/engine/rng.js';
import { LIVE, closesAtMs, testState, sectionCounts, scheduleError } from '../../../app/www/js/livetest-rules.js';
import { outlineOf, attemptFacts, topicMastery, recommendations, highlight } from '../../../app/www/js/livetest-insights.js';

const MIN = 60 * 1000;
const LABELS = new Set([...QUANT, ...REASONING].map((t) => t.label));

/** The admin's switches: live tests off (or everything paused) stops scheduling and starting. */
async function liveSettings(env) {
  const s = await getSettings(env);
  if (s['switch.live_tests']?.value === false || s['switch.pause_all']?.value === true || s['switch.leagues']?.value === false) {
    throw new HttpError(403, 'Live tests are paused for a short while. Please try again later.', 'live_tests_off');
  }
  return { perDay: Number(s['limit.live_tests_per_day']?.value) || LIVE.perDayDefault };
}

/** A suspended or banned educator's tests pause (EDU-08). */
async function ownerActive(env, ownerId) {
  const o = await env.DB.prepare('SELECT status, suspended_until FROM users WHERE id = ?1').bind(ownerId).first();
  if (!o || o.status === 'banned' || o.status === 'deleted') return false;
  return !(o.status === 'suspended' && (!o.suspended_until || Date.parse(o.suspended_until) > Date.now()));
}

/** A member counts from their approval (or their join, in a league without approval). */
const memberSince = (m) => m.decided_at || m.joined_at;

const summary = (t, nowMs = Date.now()) => ({
  id: t.id, leagueId: t.league_id, title: t.title, exam: t.exam_id, topics: JSON.parse(t.topics), difficulty: t.difficulty,
  count: t.question_count, startsAt: t.starts_at, lateMinutes: t.late_minutes, durationMinutes: t.duration_minutes, closesAt: t.closes_at,
  state: testState({ status: t.status, startsAt: t.starts_at, lateMinutes: t.late_minutes, closesAt: t.closes_at }, nowMs),
});

async function testById(env, id) {
  const t = await env.DB.prepare('SELECT * FROM live_tests WHERE id = ?1').bind(String(id || '')).first();
  if (!t) throw notFound('This test is not available.');
  return t;
}

/** The test's league and the player's place in it: 'owner', 'member' (with join time) or nothing (404). */
async function access(env, user, t) {
  const l = await env.DB.prepare('SELECT * FROM leagues WHERE id = ?1').bind(t.league_id).first();
  if (!l) throw notFound('This test is not available.');
  if (l.owner_id === user.id) return { league: l, role: 'owner' };
  const m = await env.DB.prepare('SELECT state, joined_at, decided_at, real_name FROM league_members WHERE league_id = ?1 AND user_id = ?2').bind(l.id, user.id).first();
  if (!m || m.state !== 'member') throw notFound('This test is not available.');
  return { league: l, role: 'member', member: m };
}

// ---------- the paper ----------

/** Builds the paper from Takkar's bank: the league's exam, the tutor's topics and level (LIVE-02). */
function buildPaper(examId, count, difficulty, topics, seed, paused) {
  const picked = new Set(topics);
  const sections = picked.size ? ['quant', 'reasoning'].filter((sec) => (sec === 'quant' ? QUANT : REASONING).some((t) => picked.has(t.label))) : ['quant', 'reasoning'];
  const counts = sectionCounts(examId, count, sections);
  const only = picked.size ? [...QUANT, ...REASONING].filter((t) => picked.has(t.label)).map((t) => t.id) : null;
  const qs = generateSet(seed, counts, difficulty, { paused, weights: EXAMS[examId].weights, only });
  if (qs.length !== count) throw new Error(`paper has ${qs.length} questions, wanted ${count}`);
  return {
    quantCount: counts.quant,
    paper: qs.map((q) => ({ type: q.type, topic: q.topic, label: q.label, tier: q.tier, text: q.text, options: q.options, answerIndex: q.answerIndex, answerText: q.answerText, steps: q.steps, hi: q.hi })),
  };
}

/**
 * This student's order (LIVE-06): sections stay in place (quant, then reasoning), questions shuffle within
 * each, and options shuffle per question. Returns paper indexes by position.
 */
function studentOrder(count, quantCount, orderSeed) {
  const rng = createRng(orderSeed);
  const quant = Array.from({ length: quantCount }, (_, i) => i);
  const reasoning = Array.from({ length: count - quantCount }, (_, i) => quantCount + i);
  return [...rng.shuffle(quant), ...rng.shuffle(reasoning)];
}
const optionKey = (testId, userId) => `${testId}:${userId}`;
const asStudentSees = (t, userId, paper, i) => orderForPlayer(paper[i], optionKey(t.id, userId), i);
// Marking needs only where the right option landed for this student, not a copy of the question.
const rightIndex = (t, userId, paper, i) => answerIndexForPlayer(paper[i], optionKey(t.id, userId), i);

/** A question as the phone gets it: no answer, no steps (LIVE-02, LT-08). */
function served(q) {
  return { text: q.text, options: q.options, label: q.label, topic: q.topic, type: q.type, hi: q.hi ? { text: q.hi.text, options: q.hi.options, label: q.hi.label } : undefined };
}

/**
 * Marks one attempt with the exam's scheme; scores in twelfths, like duels. `marks` has one character per question
 * in the paper's order (r right, w wrong, - skipped), so the reports never mark again.
 */
function mark(t, a, paper) {
  const exam = EXAMS[t.exam_id];
  const answers = JSON.parse(a.answers || '{}');
  let right = 0; let wrong = 0; let skipped = 0; let x12 = 0; let time = 0; let marks = '';
  paper.forEach((q, i) => {
    const ans = answers[i];
    time += (ans?.s || 0) * 1000;
    if (!ans || ans.c === null || ans.c === undefined) { skipped++; marks += '-'; return; }
    if (ans.c === rightIndex(t, a.user_id, paper, i)) { right++; marks += 'r'; x12 += Math.round(exam.marks * 12); } else { wrong++; marks += 'w'; x12 -= Math.round(exam.negative * 12); }
  });
  return { x12, right, wrong, skipped, time, marks };
}

/** Closed for good: past closes_at and the grace for answers still on their way, so no submit can land after the marking. */
const closedForGood = (t, nowMs) => nowMs >= Date.parse(t.closes_at) + LIVE.saveGraceMs;

/** What a student did, in counts only (LIVE-10): attempted, skipped, flagged, marked for review. */
function counts(a, total) {
  const answers = Object.values(JSON.parse(a.answers || '{}'));
  return {
    attempted: answers.filter((x) => x.c !== null && x.c !== undefined).length,
    skipped: total - answers.filter((x) => x.c !== null && x.c !== undefined).length,
    flagged: answers.filter((x) => x.f).length,
    review: answers.filter((x) => x.r).length,
  };
}

/** After the test closes: every attempt marked, the unsubmitted ones closed at their own end, ranks (LIVE-09). */
async function finalize(env, t) {
  if (t.marked_at || t.status === 'cancelled' || !closedForGood(t, Date.now())) return t;
  const { results } = await env.DB.prepare('SELECT * FROM live_attempts WHERE test_id = ?1').bind(t.id).all();
  // Submitted attempts were marked at submit; only those that ran out of time are marked now.
  let paper = null;
  const stored = (a) => ({ x12: a.score_x12, right: a.right_count, wrong: a.wrong_count, skipped: a.skipped_count, time: a.time_ms, marks: a.marks });
  const scored = results.map((a) => ({ a, m: a.marks ? stored(a) : mark(t, a, paper ||= JSON.parse(t.paper)) })).sort((x, y) => y.m.x12 - x.m.x12 || x.m.time - y.m.time);
  let rank = 0;
  scored.forEach((s, i) => { if (i === 0 || s.m.x12 !== scored[i - 1].m.x12 || s.m.time !== scored[i - 1].m.time) rank = i + 1; s.rank = rank; });
  const now = nowIso();
  const outline = t.outline || JSON.stringify(outlineOf(paper ||= JSON.parse(t.paper)));
  const batch = JSON.stringify(batchOf(t.question_count, scored.map((s) => ({ marks: s.m.marks, answers: s.a.answers, x12: s.m.x12 }))));
  await env.DB.batch([
    ...scored.map((s) => env.DB.prepare(
      `UPDATE live_attempts SET submitted_at = COALESCE(submitted_at, ends_at), score_x12 = ?1, right_count = ?2, wrong_count = ?3, skipped_count = ?4, time_ms = ?5, rank = ?6, marks = ?7
       WHERE test_id = ?8 AND user_id = ?9`
    ).bind(s.m.x12, s.m.right, s.m.wrong, s.m.skipped, s.m.time, s.rank, s.m.marks, t.id, s.a.user_id)),
    env.DB.prepare('UPDATE live_tests SET marked_at = ?1, outline = ?3, batch = ?4 WHERE id = ?2 AND marked_at IS NULL').bind(now, t.id, outline, batch),
  ]);
  return { ...t, marked_at: now, outline, batch };
}

/** How the batch did, question by question: who sat, how many got each right, the seconds spent on each, the scores' sum. */
function batchOf(count, attempts) {
  const right = new Array(count).fill(0);
  const secs = new Array(count).fill(0);
  let sumX12 = 0;
  for (const a of attempts) {
    for (let i = 0; i < count; i++) if (a.marks[i] === 'r') right[i]++;
    for (const [i, v] of Object.entries(JSON.parse(a.answers || '{}'))) if (i < count) secs[i] += v?.s || 0;
    sumX12 += a.x12;
  }
  return { sat: attempts.length, right, secs, sumX12 };
}

/** A marked test with its outline and batch figures; tests marked before these were kept get them now, once. */
async function withStats(env, t) {
  if (!t.marked_at || (t.outline && t.batch)) return t;
  const full = t.paper ? t : await env.DB.prepare('SELECT * FROM live_tests WHERE id = ?1').bind(t.id).first();
  const { results } = await env.DB.prepare('SELECT marks, answers, score_x12 FROM live_attempts WHERE test_id = ?1').bind(t.id).all();
  const outline = full.outline || JSON.stringify(outlineOf(JSON.parse(full.paper)));
  const batch = JSON.stringify(batchOf(full.question_count, results.map((a) => ({ marks: a.marks || '', answers: a.answers, x12: a.score_x12 || 0 }))));
  await env.DB.prepare('UPDATE live_tests SET outline = ?2, batch = ?3 WHERE id = ?1').bind(t.id, outline, batch).run();
  return { ...t, outline, batch };
}

/**
 * The marked tests of a league that one student sat, oldest first, each with its outline, the batch's figures and
 * the student's marks. Students see released tests only; the tutor sees every marked one.
 */
async function history(env, leagueId, userId, { releasedOnly, upTo = null }) {
  const { results } = await env.DB.prepare(
    `SELECT t.id, t.title, t.starts_at, t.exam_id, t.question_count, t.status, t.marked_at, t.outline, t.batch,
       a.marks, a.score_x12, a.rank, a.right_count, a.wrong_count, a.skipped_count
     FROM live_tests t JOIN live_attempts a ON a.test_id = t.id AND a.user_id = ?2
     WHERE t.league_id = ?1 AND t.marked_at IS NOT NULL AND t.status != 'cancelled' AND a.marks IS NOT NULL
       AND (?3 = 0 OR t.status = 'released') AND (?4 IS NULL OR t.starts_at <= ?4)
     ORDER BY t.starts_at ASC LIMIT 60`
  ).bind(leagueId, userId, releasedOnly ? 1 : 0, upTo).all();
  const out = [];
  for (const r of results) {
    const t = await withStats(env, r);
    out.push({ ...r, outline: JSON.parse(t.outline), batch: JSON.parse(t.batch) });
  }
  return out;
}

/** Members who could sit the test: in the league before its start (LIVE-14). */
const eligible = (env, t) => env.DB.prepare(
  `SELECT m.user_id, m.real_name, COALESCE(u.display_name, u.nickname) AS nickname, u.nickname AS username
   FROM league_members m JOIN users u ON u.id = m.user_id
   WHERE m.league_id = ?1 AND m.state = 'member' AND COALESCE(m.decided_at, m.joined_at) < ?2`
).bind(t.league_id, t.starts_at).all().then((r) => r.results);

// ---------- POST /api/leagues/:id/tests: the tutor schedules a test (LIVE-01) ----------
export async function schedule({ request, env, params }) {
  const user = await currentPlayer(request, env);
  const { perDay } = await liveSettings(env);
  await limit(env, 'live_test_create', user.id, 30, 86400);
  const l = await env.DB.prepare('SELECT * FROM leagues WHERE id = ?1 AND owner_id = ?2').bind(params.id, user.id).first();
  if (!l) throw notFound('This league is not available.');
  if (user.role !== 'educator') throw new HttpError(403, 'Only verified educators can schedule live tests.', 'not_educator');
  if (l.status !== 'live') throw new HttpError(409, 'This league is closed.', 'league_closed');
  if (!(await ownerActive(env, user.id))) throw new HttpError(423, 'Your account is paused, so you can’t schedule tests for now.', 'educator_paused');
  const body = (await readJson(request)) || {};
  const title = String(body.title ?? '').trim().replace(/\s+/g, ' ');
  const startsAtMs = Date.parse(String(body.startsAt ?? ''));
  const minutes = Number(body.durationMinutes);
  const late = Number(body.lateMinutes);
  const count = Number(body.questionCount);
  const difficulty = String(body.difficulty ?? 'exam');
  const problem = scheduleError({ title, startsAtMs, minutes, late, count, difficulty }, Date.now());
  if (problem) throw bad(problem, 'schedule');
  if (await blockedByFilter(env, title)) throw bad('That title is not allowed.', 'title');
  const topics = [...new Set((Array.isArray(body.topics) ? body.topics : []).map(String))];
  if (topics.some((x) => !LABELS.has(x))) throw bad('Pick topics from the list.', 'topics');

  // Two tests a day per league in the beta, counted by the India date of the start.
  const day = istDay(startsAtMs);
  const { results: same } = await env.DB.prepare("SELECT starts_at FROM live_tests WHERE league_id = ?1 AND status != 'cancelled' AND starts_at >= ?2 AND starts_at <= ?3")
    .bind(l.id, new Date(startsAtMs - 2 * 86400000).toISOString(), new Date(startsAtMs + 2 * 86400000).toISOString()).all();
  if (same.filter((x) => istDay(Date.parse(x.starts_at)) === day).length >= perDay) {
    throw new HttpError(409, `This league already has ${perDay} live tests that day, the beta limit. Pick another day.`, 'tests_per_day');
  }
  const { results: pausedRows } = await env.DB.prepare("SELECT id FROM templates WHERE status != 'active'").all();
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const { paper, quantCount } = buildPaper(l.exam_id, count, difficulty, topics, seed, pausedRows.map((r) => r.id));
  const id = randomId('lt_');
  const startsAt = new Date(startsAtMs).toISOString();
  await env.DB.prepare(
    `INSERT INTO live_tests (id, league_id, title, exam_id, topics, difficulty, question_count, quant_count, starts_at, late_minutes, duration_minutes, closes_at, status, seed, set_version, paper, created_by, created_at, outline)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'scheduled', ?13, ?14, ?15, ?16, ?17, ?18)`
  ).bind(id, l.id, title, l.exam_id, JSON.stringify(topics), difficulty, count, quantCount, startsAt, late, minutes,
    new Date(closesAtMs(startsAtMs, late, minutes)).toISOString(), seed, CURRENT_SET, JSON.stringify(paper), user.id, nowIso(), JSON.stringify(outlineOf(paper))).run();
  return json({ test: summary(await testById(env, id)) }, 201);
}

// ---------- GET /api/leagues/:id/tests: the league's tests (LIVE-03) ----------
export async function list({ request, env, params }) {
  const user = await currentPlayer(request, env);
  const l = await env.DB.prepare('SELECT * FROM leagues WHERE id = ?1').bind(params.id).first();
  if (!l) throw notFound('This league is not available.');
  const owner = l.owner_id === user.id;
  if (!owner) {
    const m = await env.DB.prepare('SELECT state FROM league_members WHERE league_id = ?1 AND user_id = ?2').bind(l.id, user.id).first();
    if (!m || m.state !== 'member') throw notFound('This league is not available.');
  }
  // Upcoming ones, and those of the last 30 days.
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT t.id, t.league_id, t.title, t.exam_id, t.topics, t.difficulty, t.question_count, t.starts_at, t.late_minutes, t.duration_minutes, t.closes_at, t.status,
       (SELECT COUNT(*) FROM live_attempts x WHERE x.test_id = t.id) AS started,
       (SELECT COUNT(*) FROM live_attempts x WHERE x.test_id = t.id AND x.submitted_at IS NOT NULL) AS submitted,
       a.started_at AS your_start, a.ends_at AS your_end, a.submitted_at AS your_submit
     FROM live_tests t LEFT JOIN live_attempts a ON a.test_id = t.id AND a.user_id = ?2
     WHERE t.league_id = ?1 AND t.closes_at >= ?3 ORDER BY t.starts_at DESC LIMIT 40`
  ).bind(l.id, user.id, since).all();
  const now = Date.now();
  const paused = !(await ownerActive(env, l.owner_id));
  return json({
    serverNow: new Date(now).toISOString(),
    role: owner ? 'owner' : 'member',
    paused,
    tests: results.map((t) => ({
      ...summary(t, now),
      ...(owner ? { started: t.started, submitted: t.submitted } : {}),
      you: owner ? undefined : attemptState(t.your_start, t.your_end, t.your_submit, now),
    })),
  });
}

/** none | sitting | done (submitted or out of time). */
function attemptState(startedAt, endsAt, submittedAt, nowMs) {
  if (!startedAt) return 'none';
  if (submittedAt || nowMs > Date.parse(endsAt)) return 'done';
  return 'sitting';
}

// ---------- GET /api/tests/:id: one test, as the player may see it ----------
export async function detail({ request, env, params }) {
  const user = await currentPlayer(request, env);
  let t = await testById(env, params.id);
  const { league, role, member } = await access(env, user, t);
  const now = Date.now();
  const out = { serverNow: new Date(now).toISOString(), role, league: { id: league.id, name: league.name }, test: summary(t, now) };
  if (role === 'owner') {
    const c = await env.DB.prepare('SELECT COUNT(*) AS started, SUM(submitted_at IS NOT NULL) AS submitted FROM live_attempts WHERE test_id = ?1').bind(t.id).first();
    out.progress = { eligible: (await eligible(env, t)).length, started: c.started, submitted: c.submitted || 0 };
    return json(out);
  }
  out.canSit = memberSince(member) < t.starts_at;
  const a = await env.DB.prepare('SELECT * FROM live_attempts WHERE test_id = ?1 AND user_id = ?2').bind(t.id, user.id).first();
  out.you = { state: attemptState(a?.started_at, a?.ends_at, a?.submitted_at, now) };
  if (a && out.you.state === 'done') {
    out.you.counts = counts(a, t.question_count);
    if (t.status === 'released') {
      t = await finalize(env, t);
      out.you.report = await studentReport(env, t, user.id);
    }
  }
  return json(out);
}

// ---------- POST /api/tests/:id/cancel: before the start only (LIVE-15) ----------
export async function cancel({ request, env, params }) {
  const user = await currentPlayer(request, env);
  const t = await testById(env, params.id);
  const { role } = await access(env, user, t);
  if (role !== 'owner') throw notFound('This test is not available.');
  if (t.status !== 'scheduled' || Date.now() >= Date.parse(t.starts_at)) throw new HttpError(409, 'A test can be cancelled only before it starts.', 'started');
  await env.DB.prepare("UPDATE live_tests SET status = 'cancelled', cancelled_at = ?1 WHERE id = ?2 AND status = 'scheduled'").bind(nowIso(), t.id).run();
  return json({ ok: true });
}

// ---------- POST /api/tests/:id/start: begin (or come back to) an attempt (LIVE-04, LIVE-08) ----------
export async function start({ request, env, params }) {
  const user = await currentPlayer(request, env);
  await liveSettings(env);
  await limit(env, 'live_test_start', user.id, 60, 3600);
  const t = await testById(env, params.id);
  const { league, role, member } = await access(env, user, t);
  if (role === 'owner') throw bad('This is your own test: you can see the paper in the class report after it closes.', 'own_test');
  if (!(await ownerActive(env, league.owner_id))) throw new HttpError(423, 'This league is paused for now, so its tests are on hold.', 'league_paused');
  const now = Date.now();
  const body = (await readJson(request).catch(() => null)) || {};
  let a = await env.DB.prepare('SELECT * FROM live_attempts WHERE test_id = ?1 AND user_id = ?2').bind(t.id, user.id).first();
  if (a) {
    // One attempt only (LIVE-18): coming back works only while it is still running.
    if (a.submitted_at || now > Date.parse(a.ends_at)) throw new HttpError(409, 'You have finished this test. One attempt only.', 'attempt_over');
  } else {
    if (t.status === 'cancelled') throw new HttpError(409, 'Your tutor cancelled this test.', 'cancelled');
    if (memberSince(member) >= t.starts_at) throw new HttpError(403, 'You joined this league after the test started, so you can sit its next test.', 'joined_late');
    const startMs = Date.parse(t.starts_at);
    if (now < startMs) throw new HttpError(409, 'The test hasn’t started yet.', 'not_started');
    if (now >= startMs + t.late_minutes * MIN) throw new HttpError(409, `Entry closed ${t.late_minutes} minutes after the start.`, 'entry_closed');
    const sitting = await env.DB.prepare('SELECT COUNT(*) AS n FROM live_attempts WHERE test_id = ?1').bind(t.id).first();
    if (sitting.n >= Number(league.max_members || 50)) throw new HttpError(409, 'This test is full.', 'full');
    const orderSeed = crypto.getRandomValues(new Uint32Array(1))[0];
    await env.DB.prepare(
      `INSERT OR IGNORE INTO live_attempts (test_id, user_id, started_at, ends_at, order_seed, answers, app_leaves, web)
       VALUES (?1, ?2, ?3, ?4, ?5, '{}', 0, ?6)`
    ).bind(t.id, user.id, new Date(now).toISOString(), new Date(now + t.duration_minutes * MIN).toISOString(), orderSeed, body.web ? 1 : 0).run();
    a = await env.DB.prepare('SELECT * FROM live_attempts WHERE test_id = ?1 AND user_id = ?2').bind(t.id, user.id).first();
  }
  const paper = JSON.parse(t.paper);
  const order = studentOrder(t.question_count, t.quant_count, a.order_seed);
  const saved = JSON.parse(a.answers || '{}');
  const exam = EXAMS[t.exam_id];
  return json({
    serverNow: new Date(now).toISOString(),
    test: summary(t, now),
    attempt: { startedAt: a.started_at, endsAt: a.ends_at, leaves: a.app_leaves },
    marking: { marks: exam.marks, negative: exam.negative },
    sections: [{ name: quantName(exam), from: 0, to: t.quant_count }, { name: 'Reasoning', from: t.quant_count, to: t.question_count }].filter((s) => s.to > s.from),
    questions: order.map((i) => served(asStudentSees(t, user.id, paper, i))),
    // What was saved, by position in this student's order.
    answers: order.map((i) => saved[i] || null),
  });
}

/** Checks and merges a batch of answers sent by the phone (positions in the student's order). */
function merge(t, a, body) {
  const order = studentOrder(t.question_count, t.quant_count, a.order_seed);
  const saved = JSON.parse(a.answers || '{}');
  const sent = body && typeof body.answers === 'object' && body.answers ? body.answers : {};
  const maxS = t.duration_minutes * 60;
  for (const [key, v] of Object.entries(sent)) {
    const pos = Number(key);
    if (!Number.isInteger(pos) || pos < 0 || pos >= order.length || !v || typeof v !== 'object') continue;
    const c = v.c === null || v.c === undefined ? null : Number(v.c);
    if (c !== null && !(Number.isInteger(c) && c >= 0 && c <= 3)) continue;
    saved[order[pos]] = { c, f: v.f ? 1 : 0, r: v.r ? 1 : 0, s: Math.max(0, Math.min(maxS, Math.round(Number(v.s) || 0))) };
  }
  const leaves = Math.max(a.app_leaves, Math.min(1000, Math.round(Number(body?.leaves) || 0)));
  return { answers: JSON.stringify(saved), leaves };
}

async function ownAttempt(env, user, t) {
  const a = await env.DB.prepare('SELECT * FROM live_attempts WHERE test_id = ?1 AND user_id = ?2').bind(t.id, user.id).first();
  if (!a) throw notFound('Start the test first.');
  if (a.submitted_at) throw new HttpError(409, 'You have submitted this test.', 'attempt_over');
  // Answers sent after the student's own end are refused (a few seconds' grace for the network).
  if (Date.now() > Date.parse(a.ends_at) + LIVE.saveGraceMs) throw new HttpError(409, 'Your time is up. The answers you saved before the end count.', 'time_up');
  return a;
}

// ---------- POST /api/tests/:id/answers: save a batch (LIVE-08) ----------
export async function save({ request, env, params }) {
  const user = await currentPlayer(request, env);
  await limit(env, 'live_test_save', user.id, 900, 3600);
  const t = await testById(env, params.id);
  await access(env, user, t);
  const a = await ownAttempt(env, user, t);
  const m = merge(t, a, await readJson(request));
  await env.DB.prepare('UPDATE live_attempts SET answers = ?1, app_leaves = ?2 WHERE test_id = ?3 AND user_id = ?4 AND submitted_at IS NULL')
    .bind(m.answers, m.leaves, t.id, user.id).run();
  return json({ ok: true, serverNow: nowIso(), endsAt: a.ends_at });
}

// ---------- POST /api/tests/:id/submit: the last answers and the end (LIVE-10) ----------
export async function submit({ request, env, params }) {
  const user = await currentPlayer(request, env);
  await limit(env, 'live_test_submit', user.id, 30, 3600);
  const t = await testById(env, params.id);
  await access(env, user, t);
  const a = await ownAttempt(env, user, t);
  const m = merge(t, a, await readJson(request));
  const now = Date.now();
  // Marked now, once: the answers can't change after this, and the reports read these marks (hidden until release).
  const s = mark(t, { user_id: user.id, answers: m.answers }, JSON.parse(t.paper));
  await env.DB.prepare(
    `UPDATE live_attempts SET answers = ?1, app_leaves = ?2, submitted_at = ?3, score_x12 = ?4, right_count = ?5, wrong_count = ?6, skipped_count = ?7, time_ms = ?8, marks = ?9
     WHERE test_id = ?10 AND user_id = ?11 AND submitted_at IS NULL`
  ).bind(m.answers, m.leaves, new Date(Math.min(now, Date.parse(a.ends_at))).toISOString(), s.x12, s.right, s.wrong, s.skipped, s.time, s.marks, t.id, user.id).run();
  return json({ ok: true, counts: counts({ answers: m.answers }, t.question_count) });
}

// ---------- the reports (Reports section) ----------

/**
 * Score, rank and topics against the batch, for one student, with what went well and what to do next
 * (livetest-insights.js). No questions (LIVE-19). viewer: 'student' (released tests only) or 'tutor'.
 */
async function studentReport(env, t, userId, { viewer = 'student' } = {}) {
  t = await withStats(env, t);
  const me = await env.DB.prepare('SELECT * FROM live_attempts WHERE test_id = ?1 AND user_id = ?2').bind(t.id, userId).first();
  if (!me || !me.marks || !t.batch) return null;
  const exam = EXAMS[t.exam_id];
  const outline = JSON.parse(t.outline);
  const batch = JSON.parse(t.batch);
  const answers = JSON.parse(me.answers || '{}');
  const sat = batch.sat || 1;
  // Accuracy and time per topic: this student against the batch.
  const by = {};
  outline.forEach(([, label], i) => {
    const o = (by[label] ||= { label, labelHi: LABEL_HI[label] || label, asked: 0, right: 0, seconds: 0, batchRight: 0, batchSeconds: 0 });
    o.asked++;
    if (me.marks[i] === 'r') o.right++;
    o.seconds += answers[i]?.s || 0;
    o.batchRight += batch.right[i] || 0;
    o.batchSeconds += batch.secs[i] || 0;
  });
  const topics = Object.values(by).map((x) => ({
    label: x.label, labelHi: x.labelHi, questions: x.asked,
    accuracy: Math.round((x.right / x.asked) * 100), batchAccuracy: Math.round((x.batchRight / (x.asked * sat)) * 100),
    secondsPerQuestion: Math.round(x.seconds / x.asked), batchSecondsPerQuestion: Math.round(x.batchSeconds / (x.asked * sat)),
  })).sort((p, q) => q.accuracy - p.accuracy || p.label.localeCompare(q.label));

  // What this test, and the league's tests before it, say about the student.
  const past = await history(env, t.league_id, userId, { releasedOnly: viewer === 'student', upTo: t.starts_at });
  const facts = attemptFacts({
    examId: t.exam_id, outline, marks: me.marks, answers, durationSec: t.duration_minutes * 60,
    usedSec: Math.round((Date.parse(me.submitted_at) - Date.parse(me.started_at)) / 1000), timedOut: me.submitted_at >= me.ends_at,
  });
  const scorePct = (x12, count) => Math.round((x12 / 12 / (count * exam.marks)) * 100);
  const before = past.filter((h) => h.id !== t.id).at(-1);
  return {
    score: me.score_x12 / 12, maxScore: t.question_count * exam.marks, rank: me.rank, of: batch.sat,
    right: me.right_count, wrong: me.wrong_count, skipped: me.skipped_count, timeMs: me.time_ms,
    average: Math.round((batch.sumX12 / sat / 12) * 100) / 100,
    topics,
    // Named only when the topics really differ (all at 0% has no strongest).
    strongest: topics.length > 1 && topics[0].accuracy > topics[topics.length - 1].accuracy ? topics[0].label : null,
    weakest: topics.length > 1 && topics[0].accuracy > topics[topics.length - 1].accuracy ? topics[topics.length - 1].label : null,
    insights: {
      facts: { attempted: facts.attempted, accuracy: facts.accuracy, lost: facts.lost, unseen: facts.unseen, secPerQuestion: facts.secPerQuestion, budgetSec: facts.budgetSec },
      good: highlight({ facts, rank: me.rank, of: batch.sat, scorePct: scorePct(me.score_x12, t.question_count), prevPct: before ? scorePct(before.score_x12, before.question_count) : null }),
      recs: recommendations({ examId: t.exam_id, facts, topics: topicMastery(past) }),
      tests: past.length,
    },
  };
}

/** A student of this league by user ID (the tutor's views): { id, realName, nickname, username } or 404. */
async function studentOf(env, leagueId, username) {
  const u = await env.DB.prepare(
    `SELECT u.id, COALESCE(u.display_name, u.nickname) AS nickname, u.nickname AS username, m.real_name
     FROM users u LEFT JOIN league_members m ON m.league_id = ?1 AND m.user_id = u.id WHERE u.nickname = ?2`
  ).bind(leagueId, String(username || '').toLowerCase()).first();
  if (!u) throw notFound('This student is not available.');
  return { id: u.id, realName: u.real_name || null, nickname: u.nickname, username: u.username };
}
const shown = (s) => ({ realName: s.realName, nickname: s.nickname, username: s.username });

// ---------- GET /api/tests/:id/report?student=<user ID>: one student's report, for the tutor ----------
export async function reportFor({ request, env, params }) {
  const user = await currentPlayer(request, env);
  let t = await testById(env, params.id);
  const { role } = await access(env, user, t);
  if (role !== 'owner') throw notFound('This test is not available.');
  if (t.status === 'cancelled') throw new HttpError(409, 'This test was cancelled.', 'cancelled');
  if (!closedForGood(t, Date.now()) && t.status !== 'released') throw new HttpError(409, 'Reports are ready when the test closes.', 'not_closed');
  t = await finalize(env, t);
  const student = await studentOf(env, t.league_id, new URL(request.url).searchParams.get('student'));
  const report = await studentReport(env, t, student.id, { viewer: 'tutor' });
  if (!report) throw notFound('This student didn’t sit the test.');
  return json({ test: summary(t), student: shown(student), report });
}

// ---------- GET /api/leagues/:id/progress[?student=<user ID>]: a student across the league's tests ----------
// A member sees their own (released tests); the tutor names a student and sees every marked test.
export async function progress({ request, env, params }) {
  const user = await currentPlayer(request, env);
  const l = await env.DB.prepare('SELECT * FROM leagues WHERE id = ?1').bind(params.id).first();
  if (!l) throw notFound('This league is not available.');
  const owner = l.owner_id === user.id;
  let student = null;
  if (owner) student = await studentOf(env, l.id, new URL(request.url).searchParams.get('student'));
  else {
    const m = await env.DB.prepare('SELECT state FROM league_members WHERE league_id = ?1 AND user_id = ?2').bind(l.id, user.id).first();
    if (!m || m.state !== 'member') throw notFound('This league is not available.');
  }
  const exam = EXAMS[l.exam_id];
  const past = await history(env, l.id, owner ? student.id : user.id, { releasedOnly: !owner });
  // The tutor can open only students of this league, so a guessed user ID tells them nothing.
  if (owner && !past.length && !student.realName) throw notFound('This student is not available.');
  const topics = topicMastery(past);
  return json({
    league: { id: l.id, name: l.name, exam: l.exam_id },
    viewer: owner ? 'tutor' : 'student',
    student: student ? shown(student) : null,
    tests: past.map((h) => ({
      id: h.id, title: h.title, startsAt: h.starts_at, released: h.status === 'released',
      score: h.score_x12 / 12, maxScore: h.question_count * exam.marks, rank: h.rank, of: h.batch.sat,
      average: Math.round((h.batch.sumX12 / (h.batch.sat || 1) / 12) * 100) / 100,
      right: h.right_count, wrong: h.wrong_count, skipped: h.skipped_count,
    })),
    topics,
    recs: recommendations({ examId: l.exam_id, topics }),
  });
}

// ---------- GET /api/tests/:id/class: the tutor's class report (Reports: class report, student list) ----------
export async function classReport({ request, env, params }) {
  const user = await currentPlayer(request, env);
  let t = await testById(env, params.id);
  const { role } = await access(env, user, t);
  if (role !== 'owner') throw notFound('This test is not available.');
  const now = Date.now();
  if (t.status === 'cancelled') throw new HttpError(409, 'This test was cancelled.', 'cancelled');
  if (!closedForGood(t, now) && t.status !== 'released') throw new HttpError(409, 'The class report is ready when the test closes.', 'not_closed');
  t = await finalize(env, t);
  const paper = JSON.parse(t.paper);
  const exam = EXAMS[t.exam_id];
  const people = await eligible(env, t);
  const names = Object.fromEntries(people.map((p) => [p.user_id, p]));
  const { results: atts } = await env.DB.prepare(
    `SELECT a.*, m.real_name, COALESCE(u.display_name, u.nickname) AS nickname, u.nickname AS username FROM live_attempts a
     JOIN users u ON u.id = a.user_id LEFT JOIN league_members m ON m.league_id = ?2 AND m.user_id = a.user_id
     WHERE a.test_id = ?1 ORDER BY a.rank ASC, a.time_ms ASC`
  ).bind(t.id, t.league_id).all();
  const startMs = Date.parse(t.starts_at);
  const students = atts.map((a) => {
    const answered = Object.values(JSON.parse(a.answers || '{}')).filter((x) => x.c !== null && x.c !== undefined);
    const secs = answered.map((x) => x.s).sort((p, q) => p - q);
    return {
      // A student who has deleted their account shows as "Deleted player".
      realName: a.real_name || names[a.user_id]?.real_name || null, nickname: a.nickname, username: a.username,
      score: a.score_x12 / 12, rank: a.rank, right: a.right_count, wrong: a.wrong_count, skipped: a.skipped_count, timeMs: a.time_ms,
      lateMinutes: Math.max(0, Math.floor((Date.parse(a.started_at) - startMs) / MIN)), appLeaves: a.app_leaves, web: !!a.web,
      medianSeconds: secs.length ? secs[Math.floor(secs.length / 2)] : null,
    };
  });
  // Per question: % right, % skipped, average time (in the paper's own order). Each attempt's answers are read once.
  const answersOf = atts.map((a) => JSON.parse(a.answers || '{}'));
  const perQuestion = paper.map((q, i) => {
    let right = 0; let skipped = 0; let seconds = 0;
    atts.forEach((a, k) => {
      const ans = answersOf[k][i];
      seconds += ans?.s || 0;
      const m = a.marks?.[i];
      if (m === 'r') right++;
      else if (m !== 'w') skipped++;
    });
    const n = atts.length || 1;
    return { n: i + 1, label: q.label, labelHi: q.hi?.label || q.label, rightPct: Math.round((right / n) * 100), skippedPct: Math.round((skipped / n) * 100), avgSeconds: Math.round(seconds / n) };
  });
  const topicMap = {};
  for (const q of perQuestion) { const o = (topicMap[q.label] ||= { label: q.label, labelHi: q.labelHi, questions: 0, right: 0 }); o.questions++; o.right += q.rightPct; }
  const topics = Object.values(topicMap).map((o) => ({ label: o.label, labelHi: o.labelHi, questions: o.questions, accuracy: Math.round(o.right / o.questions) })).sort((p, q) => p.accuracy - q.accuracy);
  const scores = students.map((s) => s.score);
  const sat = new Set(atts.map((a) => a.user_id));
  return json({
    test: summary(t, now), released: t.status === 'released', releasedAt: t.released_at,
    marking: { marks: exam.marks, negative: exam.negative, max: t.question_count * exam.marks },
    eligible: people.length, sat: atts.length,
    average: scores.length ? Math.round((scores.reduce((p, q) => p + q, 0) / scores.length) * 100) / 100 : null,
    highest: scores.length ? Math.max(...scores) : null,
    lowest: scores.length ? Math.min(...scores) : null,
    students,
    absent: people.filter((p) => !sat.has(p.user_id)).map((p) => ({ realName: p.real_name, nickname: p.nickname, username: p.username })),
    perQuestion,
    topics,
    // The full paper with answers and solutions, for the tutor only (LIVE-19).
    paper: paper.map((q, i) => ({ n: i + 1, label: q.label, text: q.text, options: q.options, answerIndex: q.answerIndex, answerText: q.answerText, steps: q.steps, hi: q.hi })),
  });
}

// ---------- POST /api/tests/:id/release: one button, for good (LIVE-11) ----------
export async function release({ request, env, params }) {
  const user = await currentPlayer(request, env);
  let t = await testById(env, params.id);
  const { role } = await access(env, user, t);
  if (role !== 'owner') throw notFound('This test is not available.');
  if (t.status === 'cancelled') throw new HttpError(409, 'This test was cancelled.', 'cancelled');
  if (t.status === 'released') return json({ ok: true, releasedAt: t.released_at });
  if (!closedForGood(t, Date.now())) throw new HttpError(409, 'You can release results after the test closes.', 'not_closed');
  t = await finalize(env, t);
  const at = nowIso();
  await env.DB.prepare("UPDATE live_tests SET status = 'released', released_at = ?1 WHERE id = ?2 AND status = 'scheduled'").bind(at, t.id).run();
  return json({ ok: true, releasedAt: at });
}

