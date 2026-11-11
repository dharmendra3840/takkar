// Live tests in tutor leagues (Live tests (beta) tab: LIVE-01 to LIVE-19, test cases LT-01 to LT-22),
// run by `npm test` after the live duel test. Times are moved in D1 to open and close tests.
import { createSign, createPrivateKey } from 'node:crypto';
import { d1 } from '../scripts/wrangler.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:8789';
const PROJECT = 'takkar-test';
const KEY = createPrivateKey(process.env.TEST_PRIVATE_KEY);
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const sql = (command) => d1(command);
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(sub, email) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', kid: 'test-key', typ: 'JWT' });
  const payload = b64({ iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, auth_time: now - 5, iat: now - 5, exp: now + 3600, sub, email, email_verified: true, firebase: { sign_in_provider: 'google.com' } });
  return `${head}.${payload}.${createSign('RSA-SHA256').update(`${head}.${payload}`).sign(KEY).toString('base64url')}`;
}
async function call(method, path, { body, auth } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) headers.Authorization = `Bearer ${auth}`;
  const res = await fetch(`${BASE}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
async function account(sub, nickname) {
  const r = await call('POST', '/auth/firebase', { body: { idToken: token(sub, `${sub}@example.com`), profile: { nickname, ageConfirmed: true, termsVersion: '2026-10-beta' } } });
  await call('POST', '/me/profile', { auth: r.data.token, body: { exam: 'ssc-gd', examMonth: null, goal: null } });
  return r.data.token;
}
const idOf = (nick) => sql(`SELECT id FROM users WHERE nickname = ${q(nick.toLowerCase())}`)[0].id;
const at = (ms) => new Date(ms).toISOString();
const MIN = 60000;
/** Moves a test's start (and close) in D1, to open or close it. */
const moveStart = (id, startMs, late = 10, minutes = 30) => sql(`UPDATE live_tests SET starts_at = ${q(at(startMs))}, closes_at = ${q(at(startMs + (late + minutes) * MIN))} WHERE id = ${q(id)}`);

console.log('\n# Live tests');
// The earlier test files sign in many times from this address: start with a fresh sign-in allowance.
sql("DELETE FROM rate_limits WHERE key LIKE 'auth:%'");
const tutor = await account('uid-lt-tutor', 'LtTutor');
const [s1, s2, s3, s4] = await Promise.all(['LtAmit', 'LtBela', 'LtChand', 'LtDivya'].map((n, i) => account(`uid-lt-${i + 1}`, n)));
const late = await account('uid-lt-5', 'LtLate');
const outsider = await account('uid-lt-6', 'LtOut');
sql(`UPDATE users SET role = 'educator' WHERE nickname = 'lttutor'`);
const lg = await call('POST', '/leagues', { auth: tutor, body: { name: 'GD Morning Batch', exam: 'ssc-gd', approval: false } });
const leagueId = lg.data.league.id;
const code = lg.data.league.inviteCode;
for (const [tok, name] of [[s1, 'Amit Kumar'], [s2, 'Bela Singh'], [s3, 'Chand Verma'], [s4, 'Divya Rao']]) {
  await call('POST', `/leagues/invite/${code}/join`, { auth: tok, body: { realName: name, consent: true } });
}
// They joined long before any test.
sql(`UPDATE league_members SET joined_at = '2026-01-01T00:00:00.000Z' WHERE league_id = ${q(leagueId)}`);

// ---------- scheduling (LIVE-01) ----------
const now = Date.now();
const plan = (over = {}) => ({ title: 'Mock Test 1', startsAt: at(now + 20 * MIN), durationMinutes: 30, lateMinutes: 10, questionCount: 20, difficulty: 'exam', topics: [], ...over });
check('A student cannot schedule in someone else’s league', (await call('POST', `/leagues/${leagueId}/tests`, { auth: s1, body: plan() })).status === 404);
const soon = await call('POST', `/leagues/${leagueId}/tests`, { auth: tutor, body: plan({ startsAt: at(now + 5 * MIN) }) });
const far = await call('POST', `/leagues/${leagueId}/tests`, { auth: tutor, body: plan({ startsAt: at(now + 31 * 86400000) }) });
check('Less than 15 minutes ahead, or more than 30 days: refused', soon.status === 400 && far.status === 400, `${soon.status} ${far.status}`);
const limits = await Promise.all([plan({ questionCount: 5 }), plan({ durationMinutes: 200 }), plan({ lateMinutes: 7 }), plan({ topics: ['Astrology'] }), plan({ title: 'x' })]
  .map((b) => call('POST', `/leagues/${leagueId}/tests`, { auth: tutor, body: b })));
check('Outside the beta limits (10–100 questions, 10–180 minutes, 5 or 10 late, real topics, a title): refused', limits.every((r) => r.status === 400), limits.map((r) => r.status).join(' '));
const t1 = await call('POST', `/leagues/${leagueId}/tests`, { auth: tutor, body: plan() });
check('A test is scheduled; the paper never leaves the server', t1.status === 201 && t1.data.test.count === 20 && !JSON.stringify(t1.data).includes('answer') && t1.data.test.state === 'scheduled', JSON.stringify(t1.data).slice(0, 140));
const testId = t1.data.test.id;
const t2 = await call('POST', `/leagues/${leagueId}/tests`, { auth: tutor, body: plan({ title: 'Mock Test 2', startsAt: at(now + 60 * MIN) }) });
const t3 = await call('POST', `/leagues/${leagueId}/tests`, { auth: tutor, body: plan({ title: 'Mock Test 3', startsAt: at(now + 90 * MIN) }) });
// Two tests the same India day is the limit; if the times cross midnight in India the third may land on the next day.
const sameDay = new Date(now + 20 * MIN + 5.5 * 3600000).toISOString().slice(0, 10) === new Date(now + 90 * MIN + 5.5 * 3600000).toISOString().slice(0, 10);
check('Two tests a day per league in the beta', t2.status === 201 && (sameDay ? t3.status === 409 && t3.data.code === 'tests_per_day' : true), `${t2.status} ${t3.status}`);
const reasoningOnly = await call('POST', `/leagues/${leagueId}/tests`, { auth: tutor, body: plan({ title: 'Reasoning drill', startsAt: at(now + 3 * 86400000), questionCount: 10, topics: ['Syllogism', 'Blood relations'] }) });
const paperLabels = JSON.parse(sql(`SELECT paper FROM live_tests WHERE id = ${q(reasoningOnly.data.test?.id)}`)[0].paper).map((x) => x.label);
check('Topics chosen by the tutor: the paper has only those', reasoningOnly.status === 201 && paperLabels.length === 10 && paperLabels.every((l) => ['Syllogism', 'Blood relations'].includes(l)), [...new Set(paperLabels)].join(', '));
const stored = JSON.parse(sql(`SELECT paper FROM live_tests WHERE id = ${q(testId)}`)[0].paper);
check('The paper is in both languages, with the answer key kept on the server', stored.length === 20 && stored.every((x) => Number.isInteger(x.answerIndex) && x.hi && x.hi.options.length === 4));

// ---------- before the start ----------
const list = await call('GET', `/leagues/${leagueId}/tests`, { auth: s1 });
check('Members see the upcoming test (LIVE-03)', list.status === 200 && list.data.tests.some((t) => t.id === testId && t.state === 'scheduled' && t.you === 'none'));
const outList = await call('GET', `/leagues/${leagueId}/tests`, { auth: outsider });
const outDetail = await call('GET', `/tests/${testId}`, { auth: outsider });
check('Someone outside the league sees nothing', outList.status === 404 && outDetail.status === 404, `${outList.status} ${outDetail.status} ${JSON.stringify(outDetail.data).slice(0, 120)}`);
const early = await call('POST', `/tests/${testId}/start`, { auth: s1, body: {} });
check('LT-01: a minute before the start, no questions', early.status === 409 && early.data.code === 'not_started' && !early.data.questions);

// ---------- open: start, answer, resume (LIVE-04 to LIVE-08) ----------
moveStart(testId, Date.now() - 1 * MIN);
await call('POST', `/leagues/invite/${code}/join`, { auth: late, body: { realName: 'Late Comer', consent: true } });
const lateTry = await call('POST', `/tests/${testId}/start`, { auth: late, body: {} });
check('LT-15: someone who joined after the start can’t sit it', lateTry.status === 403 && lateTry.data.code === 'joined_late', `${lateTry.status} ${JSON.stringify(lateTry.data).slice(0, 160)}`);
const a1 = await call('POST', `/tests/${testId}/start`, { auth: s1, body: { web: true } });
check('A member starts within the window and gets 20 questions', a1.status === 200 && a1.data.questions?.length === 20 && a1.data.sections?.length === 2, `${a1.status} ${JSON.stringify(a1.data).slice(0, 200)}`);
if (a1.status !== 200) { console.log('cannot go on'); process.exit(1); }
const wire = JSON.stringify(a1.data);
check('LT-08: no answers or solutions in what the phone gets', !/answerIndex|answerText|"steps"/.test(wire));
check('Each question comes in Hindi too', a1.data.questions.every((x) => x.hi && x.hi.options.length === 4));
const a2 = await call('POST', `/tests/${testId}/start`, { auth: s2, body: {} });
const order = (r) => r.data.questions.map((x) => x.text).join('|');
check('LT-09: two students get a different order', order(a1) !== order(a2) && [...a1.data.questions.map((x) => x.text)].sort().join() === [...a2.data.questions.map((x) => x.text)].sort().join());
check('Sections stay together: the quant part first', a1.data.questions.slice(0, a1.data.sections[0].to).every((x) => x.topic === 'quant'));
const sent = { 0: { c: 1, s: 20 }, 1: { c: 0, s: 15, r: true }, 2: { c: null, f: true, s: 30 }, 3: { c: 2, s: 12 }, 4: { c: 3, s: 9 }, 5: { c: 7, s: 5 } };
const saved = await call('POST', `/tests/${testId}/answers`, { auth: s1, body: { answers: sent, leaves: 2 } });
check('Answers save to the server (LIVE-08)', saved.status === 200 && saved.data.ok);
const back = await call('POST', `/tests/${testId}/start`, { auth: s1, body: {} });
check('LT-05: coming back gives the same order and every saved answer', back.status === 200 && order(back) === order(a1)
  && back.data.answers[0]?.c === 1 && back.data.answers[1]?.r === 1 && back.data.answers[2]?.f === 1 && back.data.answers[4]?.c === 3 && back.data.answers[5] === null, JSON.stringify(back.data.answers.slice(0, 6)));
const progress = await call('GET', `/tests/${testId}`, { auth: tutor });
check('The tutor sees who has started, live', progress.data.progress?.started === 2 && progress.data.progress?.eligible === 4, JSON.stringify(progress.data.progress));
const sub = await call('POST', `/tests/${testId}/submit`, { auth: s1, body: { answers: { 6: { c: 1, s: 11 } }, leaves: 3 } });
check('LT-12: after submitting, only the counts', sub.status === 200 && JSON.stringify(sub.data.counts) === JSON.stringify({ attempted: 5, skipped: 15, flagged: 1, review: 1 }) && !('score' in sub.data), JSON.stringify(sub.data));
const again = await call('POST', `/tests/${testId}/start`, { auth: s1, body: {} });
check('LT-19: one attempt only', again.status === 409 && again.data.code === 'attempt_over');
check('Nothing more can be saved after submitting', (await call('POST', `/tests/${testId}/answers`, { auth: s1, body: { answers: { 7: { c: 1 } } } })).status === 409);

// LT-02 and LT-03: late starters get the full time; after the window, nobody starts.
moveStart(testId, Date.now() - 7 * MIN);
const a3 = await call('POST', `/tests/${testId}/start`, { auth: s3, body: {} });
const full = a3.status === 200 ? Date.parse(a3.data.attempt.endsAt) - Date.parse(a3.data.attempt.startedAt) : 0;
check('LT-02: starting 7 minutes late still gives the full 30 minutes', full === 30 * MIN, `${full / MIN} min`);
moveStart(testId, Date.now() - 11 * MIN);
const closedDoor = await call('POST', `/tests/${testId}/start`, { auth: s4, body: {} });
check('LT-03: after the window, entry is closed and no paper is sent', closedDoor.status === 409 && closedDoor.data.code === 'entry_closed' && !closedDoor.data.questions);
// Bela's own time runs out: what she sends afterwards is refused.
sql(`UPDATE live_attempts SET ends_at = ${q(at(Date.now() - 10000))} WHERE test_id = ${q(testId)} AND user_id = ${q(idOf('LtBela'))}`);
check('Answers sent after a student’s own end are refused', (await call('POST', `/tests/${testId}/answers`, { auth: s2, body: { answers: { 0: { c: 1 } } } })).data.code === 'time_up');
check('Before the test closes, there is no class report or release', (await call('GET', `/tests/${testId}/class`, { auth: tutor })).status === 409 && (await call('POST', `/tests/${testId}/release`, { auth: tutor })).status === 409);
check('The educator can’t cancel a test that has started', (await call('POST', `/tests/${testId}/cancel`, { auth: tutor })).status === 409);

// ---------- closed: marks, class report, release (LIVE-09 to LIVE-12) ----------
check('A submitted attempt is marked at submit, one mark per question', sql(`SELECT marks FROM live_attempts WHERE test_id = ${q(testId)} AND submitted_at IS NOT NULL`).every((x) => /^[rw-]{20}$/.test(x.marks || '')));
sql(`UPDATE live_tests SET closes_at = ${q(at(Date.now() - 1000))} WHERE id = ${q(testId)}`);
check('Just after the close, answers still on their way can land: no marking or report yet', (await call('GET', `/tests/${testId}/class`, { auth: tutor })).status === 409 && sql(`SELECT marked_at FROM live_tests WHERE id = ${q(testId)}`)[0].marked_at === null);
sql(`UPDATE live_tests SET closes_at = ${q(at(Date.now() - 10000))} WHERE id = ${q(testId)}`);
sql(`UPDATE live_attempts SET ends_at = ${q(at(Date.now() - 12000))} WHERE test_id = ${q(testId)} AND submitted_at IS NULL`);
const beforeRelease = await call('GET', `/tests/${testId}`, { auth: s1 });
check('Closed but not released: the student still sees only counts', beforeRelease.data.you?.state === 'done' && beforeRelease.data.you?.counts && !beforeRelease.data.you?.report);
const report = await call('GET', `/tests/${testId}/class`, { auth: tutor });
const r = report.data;
check('The class report is ready when the test closes (LIVE-11)', report.status === 200 && r.sat === 3 && r.eligible === 4 && r.students.length === 3 && r.perQuestion.length === 20 && r.paper.length === 20, `${report.status} sat ${r.sat}`);
check('LT-07: unsubmitted attempts were submitted at their own end', sql(`SELECT COUNT(*) AS n FROM live_attempts WHERE test_id = ${q(testId)} AND submitted_at IS NULL`)[0].n === 0);
const amit = r.students.find((x) => x.realName === 'Amit Kumar');
check('Marks follow SSC GD (+2 / −0.25) and add up', amit && amit.right + amit.wrong === 5 && amit.skipped === 15 && Math.abs(amit.score - (amit.right * 2 - amit.wrong * 0.25)) < 1e-9, JSON.stringify(amit));
check('Real names for the tutor, the absentee, app leaves and web use (Reports)', r.absent.length === 1 && r.absent[0].realName === 'Divya Rao' && amit.appLeaves === 3 && amit.web === true);
check('Each question’s % right agrees with the students’ right answers', Math.abs(r.perQuestion.reduce((p, x) => p + x.rightPct * r.sat / 100, 0) - r.students.reduce((p, x) => p + x.right, 0)) <= r.perQuestion.length * 0.5 * r.sat / 100 + 1e-9);
check('Ranks are 1, 2, 3 (or shared on a tie)', r.students.map((x) => x.rank).every((x, i, arr) => x >= 1 && (i === 0 || x >= arr[i - 1])));
check('The tutor gets the full paper with answers and solutions', r.paper.every((x) => Number.isInteger(x.answerIndex) && x.steps.length));
const rel = await call('POST', `/tests/${testId}/release`, { auth: tutor });
const relAgain = await call('POST', `/tests/${testId}/release`, { auth: tutor });
check('Results are released with one button, and stay released (LIVE-11)', rel.status === 200 && relAgain.status === 200 && relAgain.data.releasedAt === rel.data.releasedAt);
const mine = await call('GET', `/tests/${testId}`, { auth: s1 });
const rep = mine.data.you?.report;
check('LT-13: after release the student sees score, rank and topics', rep && rep.rank >= 1 && rep.of === 3 && Math.abs(rep.score - amit.score) < 1e-9 && rep.topics.length >= 1 && 'batchAccuracy' in rep.topics[0], JSON.stringify(rep).slice(0, 160));
check('LT-20: a released test gives the report only, never the paper', !/"options"|answerIndex|"steps"/.test(JSON.stringify(mine.data)) && (await call('POST', `/tests/${testId}/start`, { auth: s1, body: {} })).status === 409);
check('Students can’t open the class report', (await call('GET', `/tests/${testId}/class`, { auth: s1 })).status === 404);

// ---------- reports and recommendations (design/03 §3.4; livetest-insights.js) ----------
const ins = rep?.insights;
const KINDS = ['topic', 'section', 'unseen', 'early', 'negative', 'rush', 'stuck', 'spare'];
check('The report says how the test went: accuracy, marks lost, questions not reached, pace', ins && ins.facts.attempted === rep.right + rep.wrong && ins.facts.lost === rep.wrong * 0.25 && ins.facts.unseen <= rep.skipped && ins.facts.budgetSec === 90 && ins.tests === 1, JSON.stringify(ins?.facts));
check('…with at most three recommendations, each a known kind with its figures', ins && Array.isArray(ins.recs) && ins.recs.length <= 3 && ins.recs.every((x) => KINDS.includes(x.kind) && !('score' in x)), JSON.stringify(ins?.recs));
check('One test of 20 questions is too thin to name a weak topic', ins && !ins.recs.some((x) => x.kind === 'topic' && x.asked < 4));
const kept = sql(`SELECT outline, batch FROM live_tests WHERE id = ${q(testId)}`)[0];
const batch = JSON.parse(kept.batch || '{}');
check('The test keeps its outline and the batch’s figures once marked', JSON.parse(kept.outline || '[]').length === 20 && batch.sat === 3 && batch.right.length === 20 && batch.secs.length === 20 && Math.abs(batch.sumX12 / 12 / 3 - r.average) < 0.01);
const prog = await call('GET', `/leagues/${leagueId}/progress`, { auth: s1 });
check('My progress: the released tests I sat, with topics across them', prog.status === 200 && prog.data.viewer === 'student' && prog.data.student === null && prog.data.tests.length === 1 && prog.data.tests[0].id === testId
  && Math.abs(prog.data.tests[0].score - rep.score) < 1e-9 && prog.data.tests[0].of === 3 && prog.data.topics.length >= 5 && prog.data.topics.every((t) => ['few', 'weak', 'ok', 'strong'].includes(t.level) && t.asked >= 1), JSON.stringify(prog.data).slice(0, 200));
check('…topics with under four questions are "not enough yet"', prog.data.topics.filter((t) => t.asked < 4).every((t) => t.level === 'few'));
check('…and never the paper', !/"options"|answerIndex|"steps"|"text"/.test(JSON.stringify(prog.data)));
check('A student can’t open someone else’s progress: the name is ignored', (await call('GET', `/leagues/${leagueId}/progress?student=ltbela`, { auth: s1 })).data.tests?.[0]?.score === prog.data.tests[0].score);
check('Outsiders get nothing', (await call('GET', `/leagues/${leagueId}/progress`, { auth: outsider })).status === 404 && (await call('GET', `/tests/${testId}/report?student=ltamit`, { auth: outsider })).status === 404);
const tProg = await call('GET', `/leagues/${leagueId}/progress?student=ltamit`, { auth: tutor });
check('The tutor opens a student’s progress by user ID, with their real name', tProg.status === 200 && tProg.data.viewer === 'tutor' && tProg.data.student?.realName === 'Amit Kumar' && tProg.data.tests.length === 1 && JSON.stringify(tProg.data.topics) === JSON.stringify(prog.data.topics));
check('…but must name one, and a stranger’s ID gives nothing', (await call('GET', `/leagues/${leagueId}/progress`, { auth: tutor })).status === 404 && (await call('GET', `/leagues/${leagueId}/progress?student=ltout`, { auth: tutor })).status === 404);
const tRep = await call('GET', `/tests/${testId}/report?student=ltamit`, { auth: tutor });
check('The tutor opens a student’s report for one test', tRep.status === 200 && tRep.data.student.realName === 'Amit Kumar' && tRep.data.report.rank === rep.rank && JSON.stringify(tRep.data.report.insights.recs) === JSON.stringify(ins.recs) && !/"options"|answerIndex|"steps"/.test(JSON.stringify(tRep.data)));
check('…not for a student who didn’t sit it, and students can’t use it', (await call('GET', `/tests/${testId}/report?student=ltdivya`, { auth: tutor })).status === 404 && (await call('GET', `/tests/${testId}/report?student=ltbela`, { auth: s1 })).status === 404);
// Before release the student's progress has nothing; the tutor's view already has the marked test.
sql(`UPDATE live_tests SET status = 'scheduled' WHERE id = ${q(testId)}`);
const hidden = await call('GET', `/leagues/${leagueId}/progress`, { auth: s1 });
const tutorEarly = await call('GET', `/leagues/${leagueId}/progress?student=ltamit`, { auth: tutor });
sql(`UPDATE live_tests SET status = 'released' WHERE id = ${q(testId)}`);
check('Until results are released, a student’s progress leaves the test out; the tutor’s view has it', hidden.status === 200 && hidden.data.tests.length === 0 && hidden.data.topics.length === 0 && tutorEarly.data.tests.length === 1 && tutorEarly.data.tests[0].released === false);
// A test marked before these figures were kept gets them on first use.
sql(`UPDATE live_tests SET outline = NULL, batch = NULL WHERE id = ${q(testId)}`);
const reread = await call('GET', `/tests/${testId}`, { auth: s1 });
const refilled = sql(`SELECT outline, batch FROM live_tests WHERE id = ${q(testId)}`)[0];
check('An older test without the kept figures gets them on first use, and the report is the same', JSON.stringify(reread.data.you?.report) === JSON.stringify(rep) && refilled.outline === kept.outline && refilled.batch === kept.batch);

// ---------- class insights (design/03 §3.4) ----------
const pickRows = sql(`SELECT user_id, marks, picks FROM live_attempts WHERE test_id = ${q(testId)}`);
check('Each attempt keeps the option picked for every question, matching its marks', pickRows.length === 3 && pickRows.every((x) => /^[0-3-]{20}$/.test(x.picks || '') && [...x.marks].every((m, i) => (m === '-') === (x.picks[i] === '-'))), JSON.stringify(pickRows.map((x) => x.picks)));
const paperRows = JSON.parse(sql(`SELECT paper FROM live_tests WHERE id = ${q(testId)}`)[0].paper);
check('…a right mark is always the right option', pickRows.every((x) => [...x.marks].every((m, i) => m !== 'r' || Number(x.picks[i]) === paperRows[i].answerIndex)) && pickRows.every((x) => [...x.marks].every((m, i) => m !== 'w' || Number(x.picks[i]) !== paperRows[i].answerIndex)));
const kept2 = JSON.parse(sql(`SELECT batch FROM live_tests WHERE id = ${q(testId)}`)[0].batch);
check('The batch counts how many picked each option', kept2.picks.length === 20 && kept2.picks.every((c, i) => c.length === 4 && c.reduce((a, b) => a + b, 0) === pickRows.filter((x) => x.picks[i] !== '-').length) && kept2.picks.every((c, i) => c[paperRows[i].answerIndex] === kept2.right[i]));
const cls2 = (await call('GET', `/tests/${testId}/class`, { auth: tutor })).data;
check('Class report: "re-teach first" and "common wrong answers" are there', Array.isArray(cls2.reteach) && Array.isArray(cls2.commonWrong) && cls2.reteach.every((x) => x.label && x.pct < 55 && x.questions >= 1) && cls2.commonWrong.every((c) => c.picked !== c.answer && c.count >= 2 && c.of === 3 && c.n >= 1 && c.n <= 20), JSON.stringify({ r: cls2.reteach, c: cls2.commonWrong }).slice(0, 300));
// Make a common wrong answer certain: Amit and Bela both pick the same wrong option on question 1.
const wrongOpt = (paperRows[0].answerIndex + 1) % 4;
sql(`UPDATE live_attempts SET picks = '${wrongOpt}' || substr(picks, 2) WHERE test_id = ${q(testId)} AND user_id IN (${q(idOf('LtAmit'))}, ${q(idOf('LtBela'))})`);
sql(`UPDATE live_tests SET batch = NULL WHERE id = ${q(testId)}`);
const cls3 = (await call('GET', `/tests/${testId}/class`, { auth: tutor })).data;
const q1 = cls3.commonWrong?.find((c) => c.n === 1);
check('Two of three picking the same wrong option shows, with the option and the right answer', q1 && q1.count >= 2 && q1.of === 3 && q1.picked === paperRows[0].options[wrongOpt] && q1.answer === paperRows[0].answerText && q1.label === paperRows[0].label, JSON.stringify(q1));
check('…in Hindi too', !paperRows[0].hi || (q1?.hi?.picked === paperRows[0].hi.options[wrongOpt] && q1?.hi?.answer === paperRows[0].hi.options[paperRows[0].answerIndex]));
check('Students never get the class pointers', (await call('GET', `/tests/${testId}/class`, { auth: s1 })).status === 404);
// A test marked before picks were kept gets them on first use.
sql(`UPDATE live_attempts SET picks = NULL WHERE test_id = ${q(testId)} AND user_id = ${q(idOf('LtChand'))}`);
sql(`UPDATE live_tests SET batch = NULL WHERE id = ${q(testId)}`);
await call('GET', `/tests/${testId}/class`, { auth: tutor });
check('Older attempts get their picks worked out from their answers, once', /^[0-3-]{20}$/.test(sql(`SELECT picks FROM live_attempts WHERE test_id = ${q(testId)} AND user_id = ${q(idOf('LtChand'))}`)[0].picks || ''));
const insight = await call('GET', `/leagues/${leagueId}/insights`, { auth: tutor });
const I = insight.data;
check('Class insights: the tests with the batch’s average and who sat', insight.status === 200 && I.tests.length === 1 && I.tests[0].id === testId && I.tests[0].sat === 3 && I.tests[0].eligible === 4 && Number.isInteger(I.tests[0].averagePct), JSON.stringify(I).slice(0, 300));
check('…re-teach topics across tests, and the watch lists (empty after one test)', Array.isArray(I.reteach) && I.reteach.every((x) => x.pct < 55) && I.slipping.length === 0 && I.improved.length === 0 && Array.isArray(I.missed));
check('…for the tutor only', (await call('GET', `/leagues/${leagueId}/insights`, { auth: s1 })).status === 404 && (await call('GET', `/leagues/${leagueId}/insights`, { auth: outsider })).status === 404);
check('…and never the paper', !/answerIndex|"steps"|"options"/.test(JSON.stringify(I)));

// ---------- cancelling, switches, a paused educator ----------
const later = await call('POST', `/leagues/${leagueId}/tests`, { auth: tutor, body: plan({ title: 'Sunday Mock', startsAt: at(now + 5 * 86400000) }) });
const cancelled = await call('POST', `/tests/${later.data.test.id}/cancel`, { auth: tutor });
moveStart(later.data.test.id, Date.now() - MIN);
const cancelledStart = await call('POST', `/tests/${later.data.test.id}/start`, { auth: s1, body: {} });
check('LIVE-15: a cancelled test can’t be started, and members see it cancelled', cancelled.status === 200 && cancelledStart.status === 409 && cancelledStart.data.code === 'cancelled'
  && (await call('GET', `/leagues/${leagueId}/tests`, { auth: s1 })).data.tests.find((t) => t.id === later.data.test.id)?.state === 'cancelled');
sql("UPDATE settings SET value = 'false' WHERE key = 'switch.live_tests'");
const off = await call('POST', `/leagues/${leagueId}/tests`, { auth: tutor, body: plan({ startsAt: at(now + 6 * 86400000) }) });
check('Live tests switched off: no scheduling', off.data.code === 'live_tests_off', `${off.status} ${JSON.stringify(off.data).slice(0, 160)} setting=${JSON.stringify(sql("SELECT value FROM settings WHERE key = 'switch.live_tests'"))}`);
sql("UPDATE settings SET value = 'true' WHERE key = 'switch.live_tests'");
const paused = await call('POST', `/leagues/${leagueId}/tests`, { auth: tutor, body: plan({ title: 'Paused Mock', startsAt: at(now + 7 * 86400000) }) });
moveStart(paused.data.test.id, Date.now() - MIN);
sql(`UPDATE users SET status = 'suspended', suspended_until = ${q(at(Date.now() + 86400000))} WHERE nickname = 'lttutor'`);
const pausedStart = await call('POST', `/tests/${paused.data.test.id}/start`, { auth: s4, body: {} });
const pausedList = await call('GET', `/leagues/${leagueId}/tests`, { auth: s4 });
sql(`UPDATE users SET status = 'active', suspended_until = NULL WHERE nickname = 'lttutor'`);
check('LT-16: a suspended educator’s test is paused, and members are told', pausedStart.status === 423 && pausedList.data.paused === true);

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
if (failed) process.exit(1);
