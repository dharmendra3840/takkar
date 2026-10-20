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

async function call(method, path, { body, auth, origin } = {}) {
  const headers = {};
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
check('Other websites get no CORS permission', evil.status === 200 && !evil.headers.get('access-control-allow-origin'));
let cfg = await get('/config', { origin: 'https://localhost' });
check('Config lists switches, limits and app builds', cfg.status === 200 && cfg.data.switches.duels === true && Number.isInteger(cfg.data.limits.freeDuelsPerDay) && cfg.data.app.latestBuild === 2 && cfg.data.app.minBuild === 1);
check('Config says sign-in is set up', cfg.data.auth.firebase === true);
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
const otherSave = await post('/duels', { duels: [duel('local-a1')] }, { auth: phone.data.token });
const ashaId = (await post('/duels', { duels: [duel('local-a1')] }, { auth: asha })).data.ids['local-a1'];
check('Same local id from another player is a different duel', otherSave.status === 200 && otherSave.data.ids['local-a1'] !== ashaId);

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
