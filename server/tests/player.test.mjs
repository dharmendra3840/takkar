// Player API test (the app's side), run by `npm test` after the admin API test.
// The test server trusts a throwaway signing key (INSECURE_TEST_JWKS), so these
// checks can mint Firebase-style sign-in tokens the way Google would.
import { createSign, createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { d1 } from '../scripts/wrangler.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:8789';
const PROJECT = 'takkar-test';
const KEY = createPrivateKey(process.env.TEST_PRIVATE_KEY);
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const sql = (command) => d1(command);
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
function token(claims = {}, { kid = 'test-key', key = KEY } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, auth_time: now - 5, iat: now - 5, exp: now + 3600,
    sub: 'uid-google-1', email: 'asha@example.com', email_verified: true, firebase: { sign_in_provider: 'google.com' },
    ...claims,
  };
  const head = b64({ alg: 'RS256', kid, typ: 'JWT' });
  const payload = b64(body);
  const sig = createSign('RSA-SHA256').update(`${head}.${payload}`).sign(key).toString('base64url');
  return `${head}.${payload}.${sig}`;
}

async function call(method, path, { body, auth, origin, headers: extra } = {}) {
  const headers = { ...(extra || {}) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) headers.Authorization = `Bearer ${auth}`;
  if (origin) headers.Origin = origin;
  const res = await fetch(`${BASE}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}
const get = (p, o) => call('GET', p, o);
const post = (p, body, o = {}) => call('POST', p, { ...o, body });
const setSetting = (key, value) => sql(`UPDATE settings SET value = ${q(JSON.stringify(value))} WHERE key = ${q(key)}`);

const today = Math.floor((Date.now() + 5.5 * 3600000) / 86400000);
function duel(id, extra = {}) {
  const answers = Array.from({ length: 10 }, (_, i) => ({ template: i % 2 ? 'percent-of' : 'percent-change', choice: i < 7 ? 0 : null, correct: i < 6, points: i < 6 ? 4 : i < 7 ? -1 : 0, timeMs: 9000 }));
  return { id, at: Date.now(), day: today, kind: 'solo', seed: 12345, topic: 'mixed', level: 'exam', marking: 'exam', rival: 'steady', status: 'finished',
    score: 23, rivalScore: 20, verdict: 'won', counted: true, right: 6, wrong: 1, skipped: 3, timeMs: 90000, answers, ...extra };
}

console.log('\n# CORS and config');
const pre = await call('OPTIONS', '/config', { origin: 'https://localhost' });
check('App origin passes CORS preflight', pre.status === 204 && pre.headers.get('access-control-allow-origin') === 'https://localhost' && /Authorization/.test(pre.headers.get('access-control-allow-headers')));
const evil = await get('/config', { origin: 'https://evil.example' });
const web = await call('OPTIONS', '/config', { origin: 'https://takkar.vercel.app' });
check('The web app on takkar.vercel.app passes CORS', web.status === 204 && web.headers.get('access-control-allow-origin') === 'https://takkar.vercel.app');
check('Other websites get no CORS permission', evil.status === 200 && !evil.headers.get('access-control-allow-origin'));
let cfg = await get('/config', { origin: 'https://localhost', headers: { 'X-Takkar-App': '0.3.1' } });
check('Config lists switches, limits and app builds', cfg.status === 200 && cfg.data.switches.duels === true && Number.isInteger(cfg.data.limits.freeDuelsPerDay) && cfg.data.app.latestBuild === 2 && cfg.data.app.minBuild === 1);
check('Config says sign-in is set up', cfg.data.auth.firebase === true);
const oldApp = await get('/config', { origin: 'https://localhost', headers: { 'X-Takkar-App': '0.3.0' } });
check('Android 0.3.0 (no Firebase file) is told sign-in is off', oldApp.data.auth.firebase === false);
const newApp = await get('/config', { origin: 'https://localhost', headers: { 'X-Takkar-App': '0.3.1' } });
check('Android 0.3.1 gets sign-in', newApp.data.auth.firebase === true);
const webApp = await get('/config', { origin: 'https://takkar.vercel.app', headers: { 'X-Takkar-App': '0.3.0' } });
check('The web app gets sign-in whatever its version', webApp.data.auth.firebase === true);
check('Web sign-in settings are sent when set', cfg.data.auth.web && cfg.data.auth.web.apiKey === 'test-web-key' && cfg.data.auth.web.authDomain === 'takkar-test.firebaseapp.com');
check('Config is briefly cacheable', /max-age=30/.test(cfg.headers.get('cache-control')));
check('Unknown player endpoint is 404', (await get('/nope')).status === 404);

console.log('\n# Sign-in tokens are checked properly');
const { privateKey: otherKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const bad = async (label, t) => {
  const r = await post('/auth/firebase', { idToken: t });
  check(`Refused: ${label}`, r.status === 401, `${r.status} ${r.data.code}`);
};
await bad('garbage', 'not.a.token');
await bad('signed by another key', token({}, { key: otherKey }));
await bad('unknown key id', token({}, { kid: 'other' }));
await bad('another Firebase project', token({ aud: 'someone-else' }));
await bad('wrong issuer', token({ iss: 'https://evil.example' }));
await bad('expired', token({ exp: Math.floor(Date.now() / 1000) - 3600 }));
await bad('email not verified', token({ email_verified: false }));
await bad('password sign-in (not offered)', token({ firebase: { sign_in_provider: 'password' } }));
check('Missing token is refused', (await post('/auth/firebase', {})).status === 401);

console.log('\n# First sign-in creates the account');
const first = await post('/auth/firebase', { idToken: token() });
check('New Google user is asked for a profile', first.status === 200 && first.data.needsProfile === true && first.data.provider === 'google');
const taken = sql("SELECT nickname FROM users WHERE status = 'active' LIMIT 1")[0]?.nickname;
const tries = [
  ['bad nickname', { nickname: 'a b', ageConfirmed: true, termsVersion: 't1' }],
  ['reserved nickname', { nickname: 'takkaradmin', ageConfirmed: true, termsVersion: 't1' }],
  ['taken nickname', { nickname: taken || 'zz', ageConfirmed: true, termsVersion: 't1' }],
  ['no 18+ confirmation', { nickname: 'Asha23', ageConfirmed: false, termsVersion: 't1' }],
];
for (const [label, profile] of tries) {
  const r = await post('/auth/firebase', { idToken: token(), profile });
  check(`Sign-up refused: ${label}`, r.status === 400, r.data.error);
}
setSetting('switch.signups', false);
const off = await post('/auth/firebase', { idToken: token(), profile: { nickname: 'Asha23', ageConfirmed: true, termsVersion: 't1' } });
check('Sign-ups switched off in the admin: refused', off.status === 403 && off.data.code === 'signups_off');
setSetting('switch.signups', true);
const made = await post('/auth/firebase', { idToken: token(), profile: { nickname: 'Asha23', ageConfirmed: true, termsVersion: '2026-10-beta' } });
check('Sign-up works', made.status === 201 && made.data.token && made.data.player.nickname === 'Asha23' && made.data.player.signInMethod === 'google');
const asha = made.data.token;
const again = await post('/auth/firebase', { idToken: token() });
check('Signing in again finds the same account', again.status === 200 && again.data.created === false && again.data.player.id === made.data.player.id);
const tokenRow = sql(`SELECT COUNT(*) AS n FROM player_sessions WHERE token_hash = ${q(asha)}`)[0].n;
check('Session token is stored only as a hash', tokenRow === 0);

const phone = await post('/auth/firebase', { idToken: token({ sub: 'uid-phone-1', email: undefined, email_verified: undefined, phone_number: '+919876543210', firebase: { sign_in_provider: 'phone' } }), profile: { nickname: 'Ravi7', ageConfirmed: true, termsVersion: '2026-10-beta' } });
check('Phone sign-up works', phone.status === 201 && phone.data.player.signInMethod === 'phone' && phone.data.player.phoneLast4 === '3210');
const stored = sql("SELECT phone_last4, email FROM users WHERE nickname = 'Ravi7'")[0];
const anywhere = sql("SELECT COUNT(*) AS n FROM users WHERE phone_last4 LIKE '%9876543210%' OR email LIKE '%9876543210%'")[0].n;
check('Only the last 4 digits of the phone are stored', stored.phone_last4 === '3210' && !stored.email && anywhere === 0);

console.log('\n# Profile and duels');
check('Me without sign-in is 401', (await get('/me')).status === 401);
let me = await get('/me', { auth: asha });
check('Me returns the profile', me.status === 200 && me.data.player.nickname === 'Asha23' && me.data.player.streak.current === 0);
let save = await post('/duels', { duels: [duel('local-a1')] }, { auth: asha });
check('Finished duel saves', save.status === 200 && save.data.ids['local-a1'] && save.data.streak.current === 1, JSON.stringify(save.data).slice(0, 120));
save = await post('/duels', { duels: [duel('local-a1')] }, { auth: asha });
const copies = sql(`SELECT COUNT(*) AS n FROM duels WHERE user_id = ${q(made.data.player.id)}`)[0].n;
check('Sending the same duel twice stores it once', save.status === 200 && copies === 1);
save = await post('/duels', { duels: [duel('local-a0', { day: today - 1 }), duel('local-a2', { kind: 'rematch' })] }, { auth: asha });
check('Yesterday’s duel, uploaded late, extends the streak', save.status === 200 && save.data.streak.current === 2 && save.data.streak.best === 2);
const rematch = sql(`SELECT counted FROM duels WHERE id = ${q(save.data.ids['local-a2'])}`)[0];
check('Rematches never count for ranks', rematch.counted === 0);
const rejects = [
  ['counts that do not add up', duel('x1', { right: 7 })],
  ['impossible score', duel('x2', { score: 99 })],
  ['unknown question type', duel('x3', { answers: [{ template: 'made-up', choice: 0, correct: true, points: 4, timeMs: 1000 }] })],
  ['a day far in the past', duel('x4', { day: today - 60 })],
];
for (const [label, d] of rejects) check(`Duel refused: ${label}`, (await post('/duels', { duels: [d] }, { auth: asha })).status === 400);
check('Duels need sign-in', (await post('/duels', { duels: [duel('g1')] })).status === 401);
const hist = await get('/me?history=1', { auth: asha });
check('A new phone gets the history back', hist.status === 200 && hist.data.history.length === 3 && hist.data.history[2].answers.length === 10 && hist.data.history.some((h) => h.verdict === 'won'));

console.log('\n# Exams');
// Six right, one wrong, three skipped, in each exam's marking.
function examDuel(id, exam, right, wrong, extra = {}) {
  const answers = Array.from({ length: 10 }, (_, i) => ({ template: 'percent-of', choice: i < 7 ? 0 : null, correct: i < 6, points: i < 6 ? right : i < 7 ? wrong : 0, timeMs: 30000 }));
  return duel(id, { exam, answers, score: 6 * right + wrong, rivalScore: 4 * right, timeMs: 300000, ...extra });
}
save = await post('/duels', { duels: [examDuel('e-cgl', 'ssc-cgl', 2, -0.5), examDuel('e-po', 'ibps-po', 1, -0.25), examDuel('e-ntpc', 'rrb-ntpc', 1, -1 / 3)] }, { auth: asha });
check('Exam duels save (+2/−0.5, +1/−0.25, +1/−⅓)', save.status === 200, JSON.stringify(save.data).slice(0, 160));
const ntpcRow = sql(`SELECT exam_id, score FROM duels WHERE id = ${q(save.data.ids?.['e-ntpc'] || '')}`)[0];
check('The exam and a fractional score are stored', ntpcRow?.exam_id === 'rrb-ntpc' && Math.abs(ntpcRow.score - 17 / 3) < 1e-9, JSON.stringify(ntpcRow));
const ntpcSlow = examDuel('e-slow', 'rrb-ntpc', 1, -1 / 3, {});
ntpcSlow.answers[0].timeMs = 50000;
check('NTPC answers may take up to 54 s', (await post('/duels', { duels: [ntpcSlow] }, { auth: asha })).status === 200);
const examRejects = [
  ['an unknown exam', examDuel('ex1', 'upsc', 2, -0.5)],
  ['CGL score above 20', examDuel('ex2', 'ssc-cgl', 2, -0.5, { score: 21 })],
  ['a score that is not a twelfth', examDuel('ex3', 'ibps-po', 1, -0.25, { score: 5.3 })],
  ['CGL points of +4', examDuel('ex4', 'ssc-cgl', 4, -1)],
  ['a CGL answer over 36 s', (() => { const d = examDuel('ex5', 'ssc-cgl', 2, -0.5); d.answers[0].timeMs = 40000; return d; })()],
];
for (const [label, d] of examRejects) check(`Duel refused: ${label}`, (await post('/duels', { duels: [d] }, { auth: asha })).status === 400);
const examHist = await get('/me?history=1', { auth: asha });
check('History brings the exam back', examHist.data.history.some((h) => h.exam === 'ibps-po' && h.score === 5.75));

check('Profile needs sign-in', (await post('/me/profile', { exam: 'ssc-cgl' })).status === 401);
check('Nickname change needs sign-in', (await post('/me/nickname', { nickname: 'NewName1' })).status === 401);
const rename = await post('/me/nickname', { nickname: 'AshaNew' }, { auth: asha });
check('Nickname changes', rename.status === 200 && rename.data.player.nickname === 'AshaNew');
const renameAgain = await post('/me/nickname', { nickname: 'AshaTwo' }, { auth: asha });
check('A second change within 7 days waits', renameAgain.status === 400 && renameAgain.data.code === 'nickname_wait', renameAgain.data.error);
sql(`UPDATE users SET nickname_changed_at = '2026-01-01T00:00:00.000Z' WHERE nickname = 'AshaNew'`);
check('Taken nicknames are refused', (await post('/me/nickname', { nickname: 'Ravi7' }, { auth: asha })).data.code === 'bad_nickname');
check('Bad nicknames are refused', (await post('/me/nickname', { nickname: 'a b' }, { auth: asha })).status === 400);
const back2 = await post('/me/nickname', { nickname: 'Asha23' }, { auth: asha });
check('…and a valid one later works', back2.status === 200 && back2.data.player.nickname === 'Asha23');
const prof = await post('/me/profile', { exam: 'ssc-cgl', examMonth: '2027-01', goal: 3 }, { auth: asha });
check('Exam, month and goal save', prof.status === 200 && prof.data.player.exam === 'ssc-cgl' && prof.data.player.examMonth === '2027-01' && prof.data.player.goal === 3);
check('…and come back with the profile', (await get('/me', { auth: asha })).data.player.exam === 'ssc-cgl');
check('Month is optional', (await post('/me/profile', { exam: 'rrb-ntpc', examMonth: null, goal: null }, { auth: asha })).data.player.examMonth === null);
for (const [label, body] of [['an unknown exam', { exam: 'neet' }], ['a bad month', { exam: 'ssc-cgl', examMonth: '2027-13' }], ['a goal of 7', { exam: 'ssc-cgl', goal: 7 }]]) {
  check(`Profile refused: ${label}`, (await post('/me/profile', body, { auth: asha })).status === 400);
}

const otherSave = await post('/duels', { duels: [duel('local-a1')] }, { auth: phone.data.token });
const ashaId = (await post('/duels', { duels: [duel('local-a1')] }, { auth: asha })).data.ids['local-a1'];
check('Same local id from another player is a different duel', otherSave.status === 200 && otherSave.data.ids['local-a1'] !== ashaId);

console.log('\n# Squads');
{
  const ravi = phone.data.token;
  const third = (await post('/auth/firebase', { idToken: token({ sub: 'uid-sq-3', email: 'third@example.com' }), profile: { nickname: 'Third3', ageConfirmed: true, termsVersion: '2026-10-beta' } })).data.token;
  check('Squads need sign-in', (await get('/squads')).status === 401 && (await post('/squads', { name: 'Night Owls', exam: 'ssc-cgl' })).status === 401);
  check('Squad name is checked', (await post('/squads', { name: 'x', exam: 'ssc-cgl' }, { auth: asha })).data.code === 'bad_name');
  check('Squad exam is checked', (await post('/squads', { name: 'Night Owls', exam: 'upsc' }, { auth: asha })).data.code === 'bad_exam');
  const made = await post('/squads', { name: 'Night Owls', exam: 'ssc-cgl' }, { auth: asha });
  const sq = made.data.squad;
  check('Create a squad: owner, invite code', made.status === 201 && sq.role === 'owner' && /^[A-Z2-9]{6}$/.test(sq.inviteCode) && sq.max === 20, JSON.stringify(sq));
  const mine = await get('/squads', { auth: asha });
  check('My squads lists it', mine.data.squads.length === 1 && mine.data.squads[0].name === 'Night Owls');
  const pv = await get(`/squads/invite/${sq.inviteCode.toLowerCase()}`);
  check('Invite preview works without sign-in (any case)', pv.status === 200 && pv.data.squad.name === 'Night Owls' && pv.data.squad.members === 1);
  check('A wrong code: clear 404', (await get('/squads/invite/ZZZZZZ')).status === 404);
  const j = await post(`/squads/invite/${sq.inviteCode}/join`, {}, { auth: ravi });
  check('Join with the code', j.status === 200 && j.data.squad.members === 2);
  check('Joining twice changes nothing', (await post(`/squads/invite/${sq.inviteCode}/join`, {}, { auth: ravi })).data.squad.members === 2);

  const pg = await get(`/squads/${sq.id}`, { auth: ravi });
  check('Squad page: members by nickname, owner first', pg.status === 200 && pg.data.members.map((m) => m.nickname).join() === 'Asha23,Ravi7' && pg.data.members[0].role === 'owner');
  check('…no emails or phone numbers anywhere', !JSON.stringify(pg.data).match(/@example|9876|3210|email|phone/i));
  check('…member ids only for the owner', pg.data.members.every((m) => m.id === undefined) && (await get(`/squads/${sq.id}`, { auth: asha })).data.members.every((m) => typeof m.id === 'string'));
  check('…today\'s squad duel seed, mission target 30', Number.isInteger(pg.data.today.seed) && pg.data.today.exam === 'ssc-cgl' && pg.data.mission.target === 30);
  check('Outsiders cannot see the squad', (await get(`/squads/${sq.id}`, { auth: third })).status === 404);

  // Squad duels: the right seed only, members only, first attempt counts.
  const seed = pg.data.today.seed;
  const sd = (id, extra = {}) => duel(id, { kind: 'squad', squadId: sq.id, seed, exam: null, rival: 'steady', ...extra });
  check('Squad duel with the wrong questions is refused', (await post('/duels', { duels: [sd('sq-x', { seed: seed + 1 })] }, { auth: ravi })).status === 400);
  check('Squad duel from a non-member is refused', (await post('/duels', { duels: [sd('sq-y')] }, { auth: third })).status === 400);
  const first = await post('/duels', { duels: [sd('sq-1', { score: 30 }), sd('sq-2', { score: 40 })] }, { auth: ravi });
  check('Squad duels save', first.status === 200);
  const table = (await get(`/squads/${sq.id}`, { auth: asha })).data.today.table;
  check('Only the first attempt goes on the squad table', table.length === 1 && table[0].nickname === 'Ravi7' && table[0].score === 30, JSON.stringify(table));
  check('The squad knows Ravi played today', (await get(`/squads/${sq.id}`, { auth: ravi })).data.you.playedToday === true);
  // Playing a squad mate's challenge code first (same questions) means the squad duel does not count.
  const ashaSeed = (await get(`/squads/${sq.id}`, { auth: asha })).data.today.seed;
  await post('/duels', { duels: [duel('ch-peek', { kind: 'challenge', seed: ashaSeed, rival: null, counted: false })] }, { auth: asha });
  await post('/duels', { duels: [duel('sq-asha', { kind: 'squad', squadId: sq.id, seed: ashaSeed, exam: null, rival: 'steady', score: 40 })] }, { auth: asha });
  check('A challenge with the same questions played first: the squad duel does not count', (await get(`/squads/${sq.id}`, { auth: asha })).data.today.table.length === 1);
  check('A stray % in the path is a 404, not a server error', (await get('/squads/%E0%A4%A', { auth: asha })).status === 404);
  const mission = (await get(`/squads/${sq.id}`, { auth: ravi })).data.mission;
  check('Weekly mission counts members\' correct answers', mission.done >= 12, JSON.stringify(mission));

  // Reactions: presets only.
  check('Free-text reactions are refused', (await post(`/squads/${sq.id}/react`, { reaction: 'hello' }, { auth: ravi })).data.code === 'bad_reaction');
  check('A preset reaction is sent', (await post(`/squads/${sq.id}/react`, { reaction: 'Well played' }, { auth: ravi })).status === 201);
  check('…and shows with the nickname', (await get(`/squads/${sq.id}`, { auth: asha })).data.reactions[0].nickname === 'Ravi7');

  // Muted players cannot send reactions.
  sql(`UPDATE users SET muted_until = '2099-01-01T00:00:00.000Z' WHERE nickname = 'Ravi7'`);
  check('A muted player cannot send reactions', (await post(`/squads/${sq.id}/react`, { reaction: 'On it' }, { auth: ravi })).data.code === 'muted');
  sql(`UPDATE users SET muted_until = NULL WHERE nickname = 'Ravi7'`);

  // The admin's squads switch stops new squads, joins and reactions (the page still opens).
  setSetting('switch.squads', false);
  const offCreate = await post('/squads', { name: 'Paused Squad', exam: 'ssc-cgl' }, { auth: asha });
  const offJoin = await post(`/squads/invite/${sq.inviteCode}/join`, {}, { auth: third });
  const offReact = await post(`/squads/${sq.id}/react`, { reaction: 'On it' }, { auth: ravi });
  check('Squads switched off: create, join and react refused', [offCreate, offJoin, offReact].every((r) => r.status === 403 && r.data.code === 'squads_off'));
  check('…but members can still open the squad', (await get(`/squads/${sq.id}`, { auth: ravi })).status === 200);
  setSetting('switch.squads', true);

  // Owner actions.
  await post(`/squads/invite/${sq.inviteCode}/join`, {}, { auth: third });
  const thirdId = (await get(`/squads/${sq.id}`, { auth: asha })).data.members.find((m) => m.nickname === 'Third3').id;
  const raviId = (await get(`/squads/${sq.id}`, { auth: asha })).data.members.find((m) => m.nickname === 'Ravi7').id;
  check('Only the owner removes members', (await post(`/squads/${sq.id}/members/${thirdId}/remove`, {}, { auth: ravi })).status === 403);
  check('Owner removes a member', (await post(`/squads/${sq.id}/members/${thirdId}/remove`, {}, { auth: asha })).status === 200);
  check('A removed member cannot rejoin with the code', (await post(`/squads/invite/${sq.inviteCode}/join`, {}, { auth: third })).data.code === 'removed');
  check('A report from the squad page records the squad', (await post('/reports', { kind: 'harassment', details: 'Squad test report', nickname: 'Third3', squadId: sq.id }, { auth: asha })).status === 201
    && sql(`SELECT COUNT(*) AS n FROM reports WHERE target_ref = ${q(sq.id)}`)[0].n === 1);
  const reset = await post(`/squads/${sq.id}/invite/reset`, {}, { auth: asha });
  check('Reset the invite code: the old one stops working', reset.status === 200 && reset.data.inviteCode !== sq.inviteCode && (await get(`/squads/invite/${sq.inviteCode}`)).status === 404);
  check('Hand over ownership', (await post(`/squads/${sq.id}/members/${raviId}/owner`, {}, { auth: asha })).status === 200
    && (await get(`/squads/${sq.id}`, { auth: ravi })).data.you.role === 'owner');

  // Limits.
  const small = (await post('/squads', { name: 'Tiny Squad', exam: 'ibps-po' }, { auth: third })).data.squad;
  sql(`UPDATE squads SET max_members = 1 WHERE id = ${q(small.id)}`);
  check('A full squad refuses new members', (await post(`/squads/invite/${small.inviteCode}/join`, {}, { auth: ravi })).data.code === 'squad_full');
  check('The last member leaving closes the squad', (await post(`/squads/${small.id}/leave`, {}, { auth: third })).status === 200
    && sql(`SELECT status FROM squads WHERE id = ${q(small.id)}`)[0].status === 'closed');
  const more = [];
  for (let i = 0; i < 3; i++) more.push((await post('/squads', { name: `Owl Group ${i}`, exam: 'rrb-ntpc' }, { auth: third })).status);
  check(`One player runs at most 3 squads`, more.join() === '201,201,201' && (await post('/squads', { name: 'Owl Group 9', exam: 'rrb-ntpc' }, { auth: third })).data.code === 'too_many_owned', more.join());

  // The admin's size limit applies to new squads.
  setSetting('limit.squad_max_members', 8);
  const eight = (await post('/squads', { name: 'Eight Max', exam: 'ssc-cgl' }, { auth: asha })).data.squad;
  check('New squads follow the admin size limit', eight.max === 8 && sql(`SELECT max_members FROM squads WHERE id = ${q(eight.id)}`)[0].max_members === 8);
  setSetting('limit.squad_max_members', 20);
  await post(`/squads/${eight.id}/close`, {}, { auth: asha });

  // Nobody is in more than 5 squads.
  const fives = [];
  for (let i = 0; i < 2; i++) fives.push((await post('/squads', { name: `Five Test ${i}`, exam: 'ssc-cgl' }, { auth: ravi })).data.squad);
  const inNow = (await get('/squads', { auth: ravi })).data.squads.length;
  const extra = [];
  for (let i = 0; i < 3; i++) extra.push((await post('/squads', { name: `Five Extra ${i}`, exam: 'ssc-cgl' }, { auth: asha })).data.squad);
  const joins = [];
  for (const x of extra) joins.push((await post(`/squads/invite/${x.inviteCode}/join`, {}, { auth: ravi })).data.code || 'ok');
  check('A player is in at most 5 squads', inNow + joins.filter((j) => j === 'ok').length === 5 && joins.includes('too_many_squads'), `${inNow} + ${joins.join()}`);
  for (const x of fives) await post(`/squads/${x.id}/close`, {}, { auth: ravi });
  for (const x of extra) await post(`/squads/${x.id}/close`, {}, { auth: asha });

  // An owner leaving hands over; an owner deleting their account hands over too.
  const g = (await post('/squads', { name: 'Hand Over', exam: 'ssc-cgl' }, { auth: ravi })).data.squad;
  await post(`/squads/invite/${g.inviteCode}/join`, {}, { auth: asha });
  check('Owner leaves: the longest-standing member becomes owner', (await post(`/squads/${g.id}/leave`, {}, { auth: ravi })).status === 200
    && (await get(`/squads/${g.id}`, { auth: asha })).data.you.role === 'owner');
  const thirdSquads = (await get('/squads', { auth: third })).data.squads;
  await post(`/squads/invite/${thirdSquads[0].inviteCode}/join`, {}, { auth: ravi });
  await post('/account/delete', {}, { auth: third });
  check('Owner deletes their account: a member takes over', sql(`SELECT owner_id FROM squads WHERE id = ${q(thirdSquads[0].id)}`)[0].owner_id
    === sql("SELECT id FROM users WHERE nickname = 'Ravi7'")[0].id);
  check('…and their other squads with nobody left close', sql(`SELECT COUNT(*) AS n FROM squads WHERE id IN (${thirdSquads.slice(1).map((s) => q(s.id)).join(',')}) AND status = 'closed'`)[0].n === thirdSquads.length - 1);
  check('Closed squads are not listed', !(await get('/squads', { auth: asha })).data.squads.some((s) => s.name === 'Tiny Squad'));
}

console.log('\n# What the admin changes, the app sees');
const uid = made.data.player.id;
setSetting('switch.duels', false);
setSetting('limit.free_duels_per_day', 5);
sql(`INSERT INTO announcements (id, text, scope, active, created_by, created_at) VALUES ('ann_test', 'Mock test this Sunday', 'all', 1, 'test', ${q(new Date().toISOString())})`);
sql("UPDATE templates SET status = 'paused' WHERE id = 'profit-sp'");
cfg = await get('/config');
check('Switch off duels: config says so', cfg.data.switches.duels === false);
check('Free duel limit change reaches the app', cfg.data.limits.freeDuelsPerDay === 5);
check('Announcement reaches the app', cfg.data.announcements.some((a) => a.text === 'Mock test this Sunday'));
check('Paused question type reaches the app', cfg.data.pausedTemplates.includes('profit-sp'));
setSetting('switch.duels', true);
setSetting('limit.free_duels_per_day', 3);
sql("UPDATE announcements SET active = 0 WHERE id = 'ann_test'");
sql("UPDATE templates SET status = 'active' WHERE id = 'profit-sp'");

sql(`UPDATE users SET plus_until = ${q(new Date(Date.now() + 7 * 86400000).toISOString())}, nickname = 'AshaR' WHERE id = ${q(uid)}`);
me = await get('/me', { auth: asha });
check('Plus granted in the admin shows in the app', !!me.data.player.plusUntil);
check('Rename in the admin shows in the app', me.data.player.nickname === 'AshaR');
sql(`UPDATE users SET status = 'suspended', suspended_until = ${q(new Date(Date.now() + 86400000).toISOString())} WHERE id = ${q(uid)}`);
me = await get('/me', { auth: asha });
check('Suspended player is stopped, with the end date', me.status === 403 && me.data.code === 'suspended' && !!me.data.until);
check('Suspended player cannot save duels', (await post('/duels', { duels: [duel('s1')] }, { auth: asha })).status === 403);
sql(`UPDATE users SET suspended_until = ${q(new Date(Date.now() - 1000).toISOString())} WHERE id = ${q(uid)}`);
me = await get('/me', { auth: asha });
check('Suspension ends by itself when it runs out', me.status === 200 && sql(`SELECT status FROM users WHERE id = ${q(uid)}`)[0].status === 'active');
sql(`UPDATE users SET status = 'banned' WHERE id = ${q(uid)}`);
check('Banned player cannot sign in', (await post('/auth/firebase', { idToken: token() })).status === 403);
sql(`UPDATE users SET status = 'active' WHERE id = ${q(uid)}`);

console.log('\n# Reports and question flags');
let rep = await post('/reports', { kind: 'app_problem', details: 'The timer froze on question 4', appVersion: '0.2.0', device: 'Pixel 7' });
check('Guest can report a problem', rep.status === 201);
rep = await post('/reports', { kind: 'nickname', details: 'Rude nickname in my league', nickname: 'Ravi7' }, { auth: asha });
const repRow = sql("SELECT kind, target_user_id, reporter_id FROM reports WHERE details LIKE 'Rude nickname%'")[0];
check('Signed-in report names the reporter and the player', rep.status === 201 && repRow.reporter_id === uid && repRow.target_user_id === phone.data.player.id);
check('Report with an unknown kind is refused', (await post('/reports', { kind: 'spam', details: 'hello there' })).status === 400);
check('Report with no details is refused', (await post('/reports', { kind: 'other', details: '' })).status === 400);

setSetting('flags.pause_after', 3);
let f = await post('/flags', { template: 'percent-of', text: 'What is 20% of 50? (options looked wrong)', reason: 'wrong' }, { auth: asha });
check('Question flag saves', f.status === 201);
f = await post('/flags', { template: 'percent-of', text: 'What is 20% of 50? (options looked wrong)', reason: 'wrong' }, { auth: asha });
check('Same player flagging the same question twice counts once', f.data.duplicate === true);
check('Flag for an unknown question type is refused', (await post('/flags', { template: 'nope', text: 'x' })).status === 400);
await post('/flags', { template: 'percent-of', text: 'Another one', reason: 'unclear' });
await post('/flags', { template: 'percent-of', text: 'And another', reason: 'wrong' });
const tpl = sql("SELECT status, reason FROM templates WHERE id = 'percent-of'")[0];
const autoAudit = sql("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'template.auto_pause' AND target_id = 'percent-of'")[0].n;
check('Too many flags pause the question type automatically', tpl.status === 'paused' && /automatically/.test(tpl.reason) && autoAudit === 1);
cfg = await get('/config');
check('…and the app stops using it', cfg.data.pausedTemplates.includes('percent-of'));
sql("UPDATE templates SET status = 'active', reason = NULL WHERE id = 'percent-of'");
setSetting('flags.pause_after', 25);

console.log('\n# Sessions, sign-out and deleting the account');
const out = await post('/auth/logout', {}, { auth: phone.data.token });
check('Sign-out works', out.status === 200 && (await get('/me', { auth: phone.data.token })).status === 401);
sql(`UPDATE player_sessions SET expires_at = ${q(new Date(Date.now() - 1000).toISOString())} WHERE user_id = ${q(uid)}`);
check('Expired session is refused', (await get('/me', { auth: asha })).status === 401);
const back = await post('/auth/firebase', { idToken: token() });
const fresh = back.data.token;
check('Signing in again gives a new session', back.status === 200 && (await get('/me', { auth: fresh })).status === 200);
const del = await post('/account/delete', {}, { auth: fresh });
const gone = sql(`SELECT status, email, firebase_uid FROM users WHERE id = ${q(uid)}`)[0];
const duelsLeft = sql(`SELECT COUNT(*) AS n FROM duels WHERE user_id = ${q(uid)}`)[0].n;
check('Delete my account removes personal data and duels', del.status === 200 && gone.status === 'deleted' && !gone.email && !gone.firebase_uid && duelsLeft === 0);
check('Deleted account’s session stops working', (await get('/me', { auth: fresh })).status === 401);
const reborn = await post('/auth/firebase', { idToken: token() });
check('The same Google account can start fresh later', reborn.status === 200 && reborn.data.needsProfile === true);
check('Self-delete is in the audit log', sql(`SELECT COUNT(*) AS n FROM audit_log WHERE action = 'player.self_delete' AND target_id = ${q(uid)}`)[0].n === 1);

console.log('\n# Rate limits');
const statuses = [];
for (let i = 0; i < 12; i++) statuses.push((await post('/reports', { kind: 'other', details: `Spam report number ${i}` })).status);
check('Too many reports are slowed down', statuses.includes(429), statuses.join(','));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) process.exit(1);
