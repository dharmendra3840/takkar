// Live friend duels (DuelRoom over WebSockets), run by `npm test` after the player test.
import { createSign, createPrivateKey } from 'node:crypto';
import { d1 } from '../scripts/wrangler.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:8789';
const WS = BASE.replace(/^http/, 'ws');
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

/** Opens the live connection and plays: ready, then answers (choose(q, i) → option index or null), until done. */
function play(code, ticket, { choose = () => 0, leaveAt = null, log = [] } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS}/api/live/duel/${code}?ticket=${encodeURIComponent(ticket)}`);
    const timer = setTimeout(() => { ws.close(); reject(new Error('duel timed out')); }, 60000);
    let readied = false;
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      log.push(m);
      if (m.t === 'lobby' && !readied && m.players.host?.here && m.players.guest?.here) { readied = true; ws.send(JSON.stringify({ t: 'ready' })); }
      if (m.t === 'question') {
        if (leaveAt === m.i) { ws.send(JSON.stringify({ t: 'leave' })); return; }
        ws.send(JSON.stringify({ t: 'answer', i: m.i, choice: choose(m.q, m.i) }));
      }
      if (m.t === 'reveal' && !m.last) ws.send(JSON.stringify({ t: 'next' }));
      if (m.t === 'done' || m.t === 'expired') { clearTimeout(timer); ws.close(); resolve(m); }
    };
    ws.onerror = () => { clearTimeout(timer); reject(new Error('socket error')); };
  });
}

console.log('\n# Live friend duels');
const asha = await account('uid-live-1', 'LiveAsha');
const ravi = await account('uid-live-2', 'LiveRavi');
const kiran = await account('uid-live-3', 'LiveKiran');

check('Starting a duel needs sign-in', (await call('POST', '/duels/friend', {})).status === 401);
const made = await call('POST', '/duels/friend', { auth: asha, body: {} });
check('A duel opens: 6-letter code, link, one-minute ticket', made.status === 201 && /^[A-Z]{6}$/.test(made.data.duel.code) && made.data.duel.link.endsWith(`?duel=${made.data.duel.code}`) && !!made.data.ticket, JSON.stringify(made.data).slice(0, 160));
const code = made.data.duel.code;
const look = await call('GET', `/duels/friend/${code.toLowerCase()}`);
check('Anyone can look at the invite (code in any case): host and exam', look.status === 200 && look.data.duel.host.nickname === 'LiveAsha' && look.data.duel.exam === 'ssc-gd' && look.data.duel.open === true);
check('The seed never leaves the server', !JSON.stringify(look.data).includes('seed') && !JSON.stringify(made.data).includes('seed'));
const joined = await call('POST', `/duels/friend/${code}/join`, { auth: ravi });
check('A friend joins as the guest, with a ticket', joined.status === 200 && joined.data.duel.you === 'guest' && !!joined.data.ticket);
check('A third player cannot', (await call('POST', `/duels/friend/${code}/join`, { auth: kiran })).status === 409);

const hostLog = [], guestLog = [];
const [hostEnd, guestEnd] = await Promise.all([
  play(code, made.data.ticket, { log: hostLog, choose: (qq, i) => (i % 3 === 2 ? null : 0) }),
  play(code, joined.data.ticket, { log: guestLog, choose: () => 1 }),
]);
const qs = hostLog.filter((m) => m.t === 'question');
check('Both get a countdown, then 10 questions', hostLog.some((m) => m.t === 'lobby' && m.status === 'countdown') && qs.length === 10 && guestLog.filter((m) => m.t === 'question').length === 10);
check('Questions arrive without their answer', qs.every((m) => !('answerIndex' in m.q) && !('answerText' in m.q) && !('steps' in m.q)));
check('…each with the exam’s 45 seconds', qs.every((m) => m.limitMs === 45000));
check('Each answer is revealed after it is given, with the steps', hostLog.filter((m) => m.t === 'reveal').every((m) => Number.isInteger(m.answerIndex) && Array.isArray(m.steps)));
check('The opponent’s progress comes live', hostLog.filter((m) => m.t === 'opp').some((m) => m.answered >= 1));
const sum = (log) => Math.round(log.filter((m) => m.t === 'reveal').reduce((t, m) => t + m.points, 0) * 12) / 12;
check('Scores use SSC GD marking (+2 / −0.25)', hostLog.filter((m) => m.t === 'reveal').every((m) => [2, -0.25, 0].includes(m.points)) && Math.abs(hostEnd.you - sum(hostLog)) < 1e-9, `${hostEnd.you}`);
check('Both see the same result from each side', hostEnd.you === guestEnd.them && hostEnd.them === guestEnd.you && ((hostEnd.verdict === 'won' && guestEnd.verdict === 'lost') || (hostEnd.verdict === 'lost' && guestEnd.verdict === 'won') || (hostEnd.verdict === 'tied' && guestEnd.verdict === 'tied')), `${hostEnd.you} vs ${hostEnd.them}: ${hostEnd.verdict}`);
check('The result has each question with who got it right', hostEnd.review.length === 10 && hostEnd.review.every((r) => typeof r.themCorrect === 'boolean' && Array.isArray(r.steps)));
check('Each player sees their own option order', JSON.stringify(hostEnd.review.map((r) => r.options)) !== JSON.stringify(guestEnd.review.map((r) => r.options)) && hostEnd.review.every((r, i) => r.text === guestEnd.review[i].text));
const fd = sql(`SELECT status, host_score, guest_score, winner_id, left_id FROM friend_duels WHERE code = ${q(code)}`)[0];
check('The duel is recorded as done', fd.status === 'done' && fd.host_score === hostEnd.you && fd.left_id === null);
const rows = sql(`SELECT d.kind, d.status, d.verdict, d.counted, d.exam_id, d.score, (SELECT COUNT(*) FROM duel_answers a WHERE a.duel_id = d.id) AS answers FROM duels d WHERE d.id IN (${q(hostEnd.duelIds)}, ${q(guestEnd.duelIds)})`);
check('Each player gets a duel in their history, counted, with 10 answers', rows.length === 2 && rows.every((r) => r.kind === 'live' && r.status === 'finished' && r.counted === 1 && r.exam_id === 'ssc-gd' && r.answers === 10), JSON.stringify(rows));
const streak = sql(`SELECT s.current FROM streaks s JOIN users u ON u.id = s.user_id WHERE u.nickname = 'liveasha'`)[0];
check('…and it counts for the streak', streak?.current === 1);
check('A finished duel cannot be joined again', (await call('POST', `/duels/friend/${code}/join`, { auth: kiran })).status === 409);

const reuse = await new Promise((resolve) => { const ws = new WebSocket(`${WS}/api/live/duel/${code}?ticket=${encodeURIComponent(made.data.ticket)}`); ws.onopen = () => { ws.close(); resolve('opened'); }; ws.onerror = () => resolve('refused'); });
check('A ticket works once', reuse === 'refused');

// Leaving mid-duel is a loss, whatever the scores.
const two = await call('POST', '/duels/friend', { auth: asha, body: {} });
const in2 = await call('POST', `/duels/friend/${two.data.duel.code}/join`, { auth: ravi });
const [h2, g2] = await Promise.all([
  play(two.data.duel.code, two.data.ticket, { choose: () => null }),
  play(two.data.duel.code, in2.data.ticket, { leaveAt: 3, choose: () => 0 }),
]);
check('Leaving mid-duel: the one who stays wins', h2.verdict === 'won' && g2.verdict === 'lost' && g2.youLeft === true, `${h2.verdict}/${g2.verdict}`);
const left = sql(`SELECT f.left_id = u.id AS ok FROM friend_duels f JOIN users u ON u.nickname = 'liveravi' WHERE f.code = ${q(two.data.duel.code)}`)[0];
check('…recorded, and the duel does not count for ranks', left?.ok === 1 && sql(`SELECT SUM(counted) AS n FROM duels WHERE id IN (${q(h2.duelIds)}, ${q(g2.duelIds)})`)[0].n === 0);

// Gone mid-duel (app closed, no network) and not back in time: it counts as leaving.
const four = await call('POST', '/duels/friend', { auth: asha, body: {} });
const in4 = await call('POST', `/duels/friend/${four.data.duel.code}/join`, { auth: ravi });
const vanish = new Promise((resolve) => {
  const ws = new WebSocket(`${WS}/api/live/duel/${four.data.duel.code}?ticket=${encodeURIComponent(in4.data.ticket)}`);
  let readied = false;
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'lobby' && !readied && m.players.host?.here && m.players.guest?.here) { readied = true; ws.send(JSON.stringify({ t: 'ready' })); }
    if (m.t === 'question' && m.i === 1) { ws.close(); resolve(); }
    else if (m.t === 'question') ws.send(JSON.stringify({ t: 'answer', i: m.i, choice: 0 }));
    if (m.t === 'reveal') ws.send(JSON.stringify({ t: 'next' }));
  };
});
const [h4] = await Promise.all([play(four.data.duel.code, four.data.ticket, { choose: () => null }), vanish]);
check('Gone mid-duel and not back: the one who stays wins', h4.verdict === 'won' && h4.themLeft === true, `${h4.verdict} ${h4.themLeft}`);

// A lobby nobody joins closes after 10 minutes.
const three = await call('POST', '/duels/friend', { auth: asha, body: {} });
sql(`UPDATE friend_duels SET expires_at = '2026-01-01T00:00:00.000Z' WHERE code = ${q(three.data.duel.code)}`);
check('An expired lobby cannot be joined', (await call('POST', `/duels/friend/${three.data.duel.code}/join`, { auth: ravi })).status === 410);
const back3 = await call('POST', `/duels/friend/${three.data.duel.code}/join`, { auth: asha });
const said = back3.status === 200 && await new Promise((resolve) => { const ws = new WebSocket(`${WS}/api/live/duel/${three.data.duel.code}?ticket=${encodeURIComponent(back3.data.ticket)}`); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === 'expired') { ws.close(); resolve(true); } }; ws.onerror = () => resolve(false); setTimeout(() => resolve(false), 8000); });
check('…while its host, coming back, is told it closed', said === true, String(back3.status));
const cgl = await call('POST', '/duels/friend', { auth: asha, body: { exam: 'ssc-cgl' } });
check('The duel follows the exam on the host’s phone', cgl.status === 201 && cgl.data.duel.exam === 'ssc-cgl');
check('An unknown code says so', (await call('GET', '/duels/friend/ZZZZZZ')).status === 404);

// Squad duels: only the member it was made for can join.
const sq = await call('POST', '/squads', { auth: asha, body: { name: 'Live Owls', exam: 'ssc-gd' } });
await call('POST', `/squads/invite/${sq.data.squad.inviteCode}/join`, { auth: ravi });
const raviId = sql("SELECT id FROM users WHERE nickname = 'liveravi'")[0].id;
check('A squad duel needs both players in the squad', (await call('POST', '/duels/friend', { auth: asha, body: { squadId: sq.data.squad.id, invitee: sql("SELECT id FROM users WHERE nickname = 'livekiran'")[0].id } })).status === 400);
const sd = await call('POST', '/duels/friend', { auth: asha, body: { squadId: sq.data.squad.id, invitee: raviId } });
check('A squad duel’s link asks a signed-out visitor to sign in', (await call('GET', `/duels/friend/${sd.data.duel.code}`)).data.duel.open === true);
const sdJoin = await call('POST', `/duels/friend/${sd.data.duel.code}/join`, { auth: ravi });
check('A squad duel is for that member only', sd.status === 201 && sd.data.duel.open === false && (await call('POST', `/duels/friend/${sd.data.duel.code}/join`, { auth: kiran })).status === 409 && sdJoin.status === 200);
const [sh] = await Promise.all([play(sd.data.duel.code, sd.data.ticket), play(sd.data.duel.code, sdJoin.data.ticket)]);
const sqRows = sql(`SELECT COUNT(*) AS n FROM duels WHERE id = ${q(sh.duelIds)} AND squad_id IS NULL`)[0].n;
check('A squad live duel stays off the squad’s daily table', sqRows === 1 && sql(`SELECT squad_id FROM friend_duels WHERE code = ${q(sd.data.duel.code)}`)[0].squad_id === sq.data.squad.id);

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
if (failed) process.exit(1);
