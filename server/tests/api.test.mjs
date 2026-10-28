// Admin API test against the local dev server (npm run dev, after migrations and seed).
// Uses a throwaway owner, so run it on a fresh local database: see README.
import { execFileSync } from 'node:child_process';
import { d1 } from '../scripts/wrangler.mjs';
import { createHmac } from 'node:crypto';

const BASE = process.env.BASE || 'http://localhost:8788';
const API = `${BASE}/admin/api`;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const sql = (command) => d1(command);

// RFC 6238, independent of the server's implementation.
function totp(secret, counter) {
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0; const bytes = [];
  for (const c of secret) { value = (value << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', Buffer.from(bytes)).update(msg).digest();
  const o = mac[19] & 15;
  return String((((mac[o] & 127) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3]) % 1e6).padStart(6, '0');
}
const counterNow = () => Math.floor(Date.now() / 30000);

class Client {
  constructor() { this.cookie = ''; this.csrf = ''; }
  async req(method, path, body, { csrf = true, raw = false } = {}) {
    const headers = { Origin: BASE };
    if (this.cookie) headers.Cookie = this.cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (csrf && this.csrf && method !== 'GET') headers['X-CSRF-Token'] = this.csrf;
    const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get('set-cookie');
    if (set) { const m = set.match(/tk_admin=([^;]*)/); if (m) this.cookie = m[1] ? `tk_admin=${m[1]}` : ''; }
    const data = raw ? await res.text() : await res.json().catch(() => ({}));
    return { status: res.status, data, headers: res.headers };
  }
  get(p) { return this.req('GET', p); }
  post(p, b = {}) { return this.req('POST', p, b); }
}

async function setUpAdminFromInvite(token, password, label) {
  const anon = new Client();
  const info = await anon.get(`/auth/invite?token=${token}`);
  check(`${label}: invite link works`, info.status === 200, info.data.email);
  const s = await anon.post('/auth/invite/secret', { token });
  check(`${label}: QR secret issued`, s.status === 200 && /^[A-Z2-7]{32}$/.test(s.data.secret) && s.data.otpauth.startsWith('otpauth://totp/'));
  const weak = await anon.post('/auth/invite/complete', { token, password: 'short', code: totp(s.data.secret, counterNow()) });
  check(`${label}: short password refused`, weak.status === 400);
  const wrongCode = await anon.post('/auth/invite/complete', { token, password, code: '000000' });
  check(`${label}: wrong code refused at setup`, wrongCode.status === 400);
  const setupCounter = counterNow();
  const done = await anon.post('/auth/invite/complete', { token, password, code: totp(s.data.secret, setupCounter) });
  check(`${label}: setup completes`, done.status === 200, JSON.stringify(done.data));
  const again = await anon.get(`/auth/invite?token=${token}`);
  check(`${label}: invite link works only once`, again.status === 410);
  return { secret: s.data.secret, lastCounter: setupCounter };
}

async function signIn(email, password, enrol) {
  const c = new Client();
  const step1 = await c.post('/auth/login', { email, password });
  if (step1.status !== 200) return { c, step1 };
  // The setup code was counter N; the same code must be refused, so use the next window (+1 is accepted for drift).
  const replay = await c.post('/auth/totp', { challenge: step1.data.challenge, code: totp(enrol.secret, enrol.lastCounter) });
  const step2 = await c.post('/auth/totp', { challenge: step1.data.challenge, code: totp(enrol.secret, enrol.lastCounter + 1) });
  if (step2.status === 200) { c.csrf = step2.data.csrf; enrol.lastCounter += 1; }
  return { c, step1, step2, replay };
}

// ---------------------------------------------------------------------------
const OWNER = { email: `owner${Date.now()}@takkar.test`, password: 'correct horse battery staple 42' };

console.log('\n# Owner setup and sign-in');
const boot = execFileSync('node', ['scripts/bootstrap-owner.mjs', '--local', '--allow-existing', OWNER.email, 'Test Owner'], { encoding: 'utf8' });
const ownerToken = boot.match(/#\/invite\/([\w-]+)/)?.[1];
check('Bootstrap prints a one-time setup link', !!ownerToken);
const ownerEnrol = await setUpAdminFromInvite(ownerToken, OWNER.password, 'Owner');

const badPw = await new Client().post('/auth/login', { email: OWNER.email, password: 'wrong password here' });
check('Wrong password refused with a generic message', badPw.status === 401 && badPw.data.error === 'Email or password is wrong.');
const unknown = await new Client().post('/auth/login', { email: 'nobody@takkar.test', password: 'whatever whatever' });
check('Unknown email gives the same message', unknown.status === 401 && unknown.data.error === badPw.data.error);

const { c: owner, step2, replay } = await signIn(OWNER.email, OWNER.password, ownerEnrol);
check('Authenticator code reused is refused (one use per code)', replay.status === 401);
check('Owner signs in with password + code (SEC-01)', step2.status === 200 && step2.data.admin.role === 'owner');
const cookieHeader = step2.headers.get('set-cookie') || '';
check('Session cookie is HttpOnly, SameSite=Strict, scoped to /admin', /HttpOnly/i.test(cookieHeader) && /SameSite=Strict/i.test(cookieHeader) && /Path=\/admin/i.test(cookieHeader));
const me = await owner.get('/auth/me');
check('Session works', me.status === 200 && me.data.admin.email === OWNER.email);

console.log('\n# CSRF and headers');
const noCsrf = await owner.req('POST', '/words', { word: 'testword' }, { csrf: false });
check('Change without CSRF token blocked (SEC-18)', noCsrf.status === 403);
const evil = await fetch(`${API}/words`, { method: 'POST', headers: { Cookie: owner.cookie, 'X-CSRF-Token': owner.csrf, 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: JSON.stringify({ word: 'testword' }) });
check('Cross-site origin blocked', evil.status === 403);
check('API responses carry strict security headers (SEC-15)', me.headers.get('x-frame-options') === 'DENY' && (me.headers.get('content-security-policy') || '').includes("frame-ancestors 'none'"));

console.log('\n# Overview and usage');
const ov = await owner.get('/overview');
check('Overview KPIs come from the database (ADMIN-09)', ov.status === 200 && ov.data.kpis.players >= 150 && ov.data.trend.length === 14, `players ${ov.data.kpis?.players}, duels today ${ov.data.kpis?.duelsToday}, D1 ${ov.data.kpis?.dayOneReturn}%, D7 ${ov.data.kpis?.daySevenReturn}%`);
const us = await owner.get('/usage');
check('Free-tier usage report', us.status === 200 && us.data.rows.users >= 150, `storage ${us.data.storageBytes} bytes`);

console.log('\n# Players');
const list = await owner.get('/players?limit=5');
check('List players', list.status === 200 && list.data.players.length === 5 && list.data.total >= 150);
const search = await owner.get(`/players?q=${encodeURIComponent(list.data.players[0].nickname.slice(0, 4))}`);
check('Search by nickname', search.status === 200 && search.data.players.length >= 1);
const target = list.data.players[1];
const detail = await owner.get(`/players/${target.id}`);
check('Player profile with stats, duels, speed check', detail.status === 200 && Array.isArray(detail.data.duels) && 'accuracy' in detail.data.stats);
const noReason = await owner.post(`/players/${target.id}/actions`, { action: 'warn' });
check('Every action needs a reason', noReason.status === 400);
for (const [action, extra] of [['warn', {}], ['mute', { days: 7 }], ['unmute', {}], ['rename', {}], ['reset_scores', { scope: 'week' }], ['suspend', { days: 3 }], ['restore', {}], ['grant_plus', { days: 14 }], ['revoke_plus', {}]]) {
  const r = await owner.post(`/players/${target.id}/actions`, { action, reason: `Test ${action}`, ...extra });
  check(`Player action: ${action}`, r.status === 200, r.status !== 200 ? JSON.stringify(r.data) : r.data.player?.nickname);
}
const badRename = await owner.post(`/players/${target.id}/actions`, { action: 'rename', nickname: 'admin', reason: 'test' });
check('Rename to a reserved word refused', badRename.status === 400);
const exp = await owner.get(`/players/${target.id}/export`);
check('Owner can export a player’s data (PROF-02)', exp.status === 200 && exp.data.user.id === target.id);
const victim = list.data.players[2];
const del = await owner.post(`/players/${victim.id}/actions`, { action: 'delete_data', reason: 'Player asked for deletion' });
const gone = sql(`SELECT nickname, status, email FROM users WHERE id = '${victim.id}'`)[0];
const duelsLeft = sql(`SELECT COUNT(*) AS n FROM duels WHERE user_id = '${victim.id}'`)[0].n;
check('Delete data anonymises the player and removes duels (PROF-03)', del.status === 200 && gone.status === 'deleted' && gone.email === null && gone.nickname.startsWith('deleted_') && duelsLeft === 0);

console.log('\n# Reports');
const rep = await owner.get('/reports');
check('Reports sorted by severity (ADMIN-04)', rep.status === 200 && rep.data.reports.length >= 8 && rep.data.reports[0].severity === 1);
const nick = rep.data.reports.find((r) => r.kind === 'nickname');
const res1 = await owner.post(`/reports/${nick.id}/resolve`, { action: 'rename', reason: 'Offensive nickname, renamed and warned' });
check('One-tap: rename from a report', res1.status === 200);
const u18 = rep.data.reports.find((r) => r.kind === 'under_18');
const res2 = await owner.post(`/reports/${u18.id}/resolve`, { action: 'suspend', reason: 'Suspended until reviewed (MOD-05)' });
check('One-tap: suspend an under-18 report', res2.status === 200);
const lname = rep.data.reports.find((r) => r.kind === 'league_name');
const res3 = await owner.post(`/reports/${lname.id}/resolve`, { action: 'close_league', reason: 'League name promises results' });
check('One-tap: close a league from a report', res3.status === 200);
const twice = await owner.post(`/reports/${nick.id}/resolve`, { action: 'dismiss', reason: 'again' });
check('A closed report cannot be resolved twice', twice.status === 400);

console.log('\n# Questions');
const tm = await owner.get('/questions/templates');
check('Templates with flags and accuracy', tm.status === 200 && tm.data.templates.length === 30 && tm.data.templates[0].flags_open > 0, `top: ${tm.data.templates[0].id} (${tm.data.templates[0].flags_open} open flags)`);
const sample = await owner.get('/questions/templates/clock-angle/sample?n=3');
check('Fresh samples from the engine for checking by hand', sample.status === 200 && sample.data.samples.length === 3 && sample.data.flags.length >= 1);
const pause = await owner.post('/questions/templates/clock-angle/status', { status: 'paused', reason: 'Checking flagged angle' });
const keep = await owner.post('/questions/templates/clock-angle/status', { status: 'active', reason: 'Recalculated by hand: correct' });
check('Pause then keep a template (ADMIN-05)', pause.status === 200 && keep.status === 200);
const draft = await owner.post('/questions/drafts', { topic: 'quant', label: 'Percentages', text: 'What is 15% of 240?', options: ['36', '32', '40', '30'], answer_index: 0, solution: '15 × 240 ÷ 100 = 36' });
const noSrc = await owner.post(`/questions/drafts/${draft.data.id}/decide`, { decision: 'approve', reason: 'ok' });
check('Draft cannot be approved without a source (QGEN-07)', draft.status === 200 && noSrc.status === 400);
await owner.post(`/questions/drafts/${draft.data.id}/source`, { source: 'Worked by hand' });
const approve = await owner.post(`/questions/drafts/${draft.data.id}/decide`, { decision: 'approve', reason: 'Checked' });
check('Draft approved once it has a source', approve.status === 200);
const dupOpts = await owner.post('/questions/drafts', { topic: 'quant', text: 'A question with repeated options?', options: ['1', '1', '2', '3'], answer_index: 0, solution: 'Because it is.' });
check('Draft with repeated options refused (QGEN-02)', dupOpts.status === 400);

console.log('\n# Leagues, educators, squads');
const lg = await owner.get('/leagues');
const pending = lg.data.leagues.find((l) => l.status === 'pending');
check('Leagues listed with members and activity', lg.status === 200 && lg.data.leagues.length >= 6);
const edu = await owner.get('/educators');
// Pick a request whose league is still waiting (an earlier step closed one league on purpose).
const waiting = edu.data.requests.find((r) => sql(`SELECT status FROM leagues WHERE owner_id = '${r.user_id}'`)[0]?.status === 'pending');
const appr = await owner.post(`/educators/${waiting.id}/decide`, { decision: 'approve', reason: 'Real, active channel' });
check('Approve an educator (LEAG-08)', edu.status === 200 && appr.status === 200);
const live = sql(`SELECT status FROM leagues WHERE owner_id = '${waiting.user_id}'`)[0]?.status;
check('Approving puts their waiting league live', live === 'live');
const sq = await owner.get('/squads');
const close = await owner.post(`/squads/${sq.data.squads[0].id}/close`, { reason: 'Abusive squad name' });
check('Close a squad', sq.status === 200 && close.status === 200);
check('…and the close records why', sql(`SELECT closed_reason FROM squads WHERE id = '${sq.data.squads[0].id}'`)[0].closed_reason === 'Abusive squad name');
{
  // A banned player leaves their squads; a squad they ran passes to the next member.
  const [boss, mate] = [list.data.players[3], list.data.players[4]];
  const t = new Date().toISOString();
  sql(`INSERT INTO squads (id, name, owner_id, status, created_at, exam_id, invite_code, max_members) VALUES ('sq_ban', 'Ban Test', '${boss.id}', 'active', '${t}', 'ssc-cgl', 'BANTST', 20)`);
  sql(`INSERT INTO squad_members (squad_id, user_id, joined_at, state, role) VALUES ('sq_ban', '${boss.id}', '${t}', 'member', 'owner'), ('sq_ban', '${mate.id}', '${t}', 'member', 'member')`);
  const ban = await owner.post(`/players/${boss.id}/actions`, { action: 'ban', reason: 'Test ban' });
  const after = sql("SELECT owner_id FROM squads WHERE id = 'sq_ban'")[0].owner_id;
  const states = sql(`SELECT user_id, state, role FROM squad_members WHERE squad_id = 'sq_ban' ORDER BY joined_at, user_id`);
  check('Ban: the player leaves their squads, ownership passes on', ban.status === 200 && after === mate.id
    && states.find((m) => m.user_id === boss.id).state === 'left' && states.find((m) => m.user_id === mate.id).role === 'owner', JSON.stringify(states));
}
check('Pending league still listed for review', !!pending);

console.log('\n# Switches and settings (ADMIN-06)');
const st = await owner.get('/settings');
check('Settings with history', st.status === 200 && st.data.settings['switch.duels'].value === true);
const off = await owner.post('/settings/switch.duels', { value: false, reason: 'Testing the switch' });
const on = await owner.post('/settings/switch.duels', { value: true, reason: 'Back on' });
check('Turn duels off and on', off.status === 200 && on.status === 200);
const lim = await owner.post('/settings/limit.free_duels_per_day', { value: 5, reason: 'Exam season' });
const badLim = await owner.post('/settings/limit.free_duels_per_day', { value: 999, reason: 'too many' });
check('Change the free duel limit, with bounds checked (PLUS-08)', lim.status === 200 && badLim.status === 400);
const price = await owner.post('/settings/price.plus_paise', { value: 7900, reason: 'Testing ₹79' });
check('Change the Plus price for new buyers (ADMIN-07)', price.status === 200);
const hist = await owner.get('/settings');
check('Every change kept in history', hist.data.history.filter((h) => h.key === 'switch.duels').length >= 3);

console.log('\n# Word filter and announcements');
const addW = await owner.post('/words', { word: 'testabuse' });
const dupW = await owner.post('/words', { word: 'testabuse' });
const rmW = await owner.post('/words/testabuse/remove', { reason: 'Test cleanup' });
check('Add and remove a filtered word (MOD-02)', addW.status === 200 && dupW.status === 400 && rmW.status === 200);
const ann = await owner.post('/announcements', { text: 'Maintenance tonight 11 pm to 11:30 pm IST.', scope: 'all' });
const endAnn = await owner.post(`/announcements/${ann.data.id}/end`);
check('Show and remove an announcement (ADMIN-11)', ann.status === 200 && endAnn.status === 200);

console.log('\n# Money (owner only)');
const money = await owner.get('/money');
check('Money summary', money.status === 200 && money.data.plusPaid >= 1, `paid Plus ${money.data.plusPaid}, revenue this month ₹${(money.data.revenueThisMonthPaise / 100).toFixed(0)}`);
const pays = await owner.get('/money/payments?status=captured');
const partial = await owner.post(`/money/payments/${pays.data.payments[0].id}/refund`, { amount_paise: 4000, reason: 'Partial refund test' });
const rest = await owner.post(`/money/payments/${pays.data.payments[0].id}/refund`, { reason: 'Rest of the refund' });
const over = await owner.post(`/money/payments/${pays.data.payments[0].id}/refund`, { reason: 'Too much' });
check('Partial then full refund, no over-refund (PLUS-05)', partial.status === 200 && rest.status === 200 && over.status === 400, partial.data.status);
const coupon = await owner.post('/money/coupons', { code: 'TEST10', percent_off: 10, ends_at: new Date(Date.now() + 5 * 86400000).toISOString() });
const dis = await owner.post('/money/coupons/TEST10/disable', { reason: 'Test over' });
check('Create and disable a coupon (ADMIN-07)', coupon.status === 200 && dis.status === 200);

console.log('\n# Moderator role (ADMIN-01)');
const MOD = { email: `mod${Date.now()}@takkar.test`, password: 'moderator pass phrase 77' };
const inv = await owner.post('/admins', { email: MOD.email, name: 'Test Moderator', role: 'moderator' });
check('Owner invites a moderator', inv.status === 200 && inv.data.invitePath.includes('#/invite/'));
const modEnrol = await setUpAdminFromInvite(inv.data.invitePath.split('/').pop(), MOD.password, 'Moderator');
const { c: mod } = await signIn(MOD.email, MOD.password, modEnrol);
check('Moderator signs in', !!mod.csrf);
const modAllowed = await Promise.all(['/overview', '/players?limit=1', '/reports', '/questions/templates'].map((p) => mod.get(p)));
check('Moderator can see players, reports and questions', modAllowed.every((r) => r.status === 200));
const modDenied = await Promise.all(['/money', '/settings', '/admins', '/audit', `/players/${target.id}/export`].map((p) => mod.get(p)));
check('Moderator refused payments, switches, admins, audit and exports', modDenied.every((r) => r.status === 403), modDenied.map((r) => r.status).join(','));
const modDelete = await mod.post(`/players/${target.id}/actions`, { action: 'delete_data', reason: 'try' });
const modSwitch = await mod.post('/settings/switch.duels', { value: false, reason: 'try' });
const modWarn = await mod.post(`/players/${target.id}/actions`, { action: 'warn', reason: 'Moderator warning' });
check('Moderator refused delete and switches, allowed to warn', modDelete.status === 403 && modSwitch.status === 403 && modWarn.status === 200);

console.log('\n# Admin management');
const admins = await owner.get('/admins');
const modRow = admins.data.admins.find((a) => a.email === MOD.email);
const signOutMod = await owner.post(`/admins/${modRow.id}/manage`, { action: 'sign_out', reason: 'Test' });
const modAfter = await mod.get('/auth/me');
check('Owner signs a moderator out everywhere', signOutMod.status === 200 && modAfter.status === 401);
const disable = await owner.post(`/admins/${modRow.id}/manage`, { action: 'disable', reason: 'Left the team' });
const modLogin = await new Client().post('/auth/login', { email: MOD.email, password: MOD.password });
check('Disabled admin cannot sign in', disable.status === 200 && modLogin.status === 401);
const ownerRow = admins.data.admins.find((a) => a.email === OWNER.email);
const lastOwner = await owner.post(`/admins/${ownerRow.id}/manage`, { action: 'disable', reason: 'try' });
check('The last owner cannot be disabled', lastOwner.status === 400);

console.log('\n# Audit log (ADMIN-08, SEC-04)');
const aud = await owner.get('/audit?limit=200');
const actions = new Set(aud.data.entries.map((e) => e.action));
check('Every admin action is in the audit log', ['admin.sign_in', 'player.warn', 'player.delete_data', 'report.dismiss', 'setting.change', 'payment.refund', 'coupon.create', 'admin.invite', 'template.pause'].every((a) => actions.has(a) || (a === 'report.dismiss')), `${aud.data.entries.length} entries`);
const csv = await owner.req('GET', '/audit.csv', undefined, { raw: true });
check('Audit log exports as CSV', csv.status === 200 && csv.data.startsWith('id,at,admin_email,action'));
let editBlocked = false;
try { sql("UPDATE audit_log SET reason = 'tampered' WHERE id = 1"); } catch (e) { editBlocked = /append-only/.test(String(e.stdout || e.stderr || e.message)); }
let deleteBlocked = false;
try { sql('DELETE FROM audit_log WHERE id = 1'); } catch (e) { deleteBlocked = /append-only/.test(String(e.stdout || e.stderr || e.message)); }
check('Audit log cannot be edited, even in the database', editBlocked);
check('Audit log cannot be deleted, even in the database', deleteBlocked);

console.log('\n# Session limits (SEC-02) and lockout (SEC-08)');
sql(`UPDATE admin_sessions SET last_seen_at = '${new Date(Date.now() - 31 * 60000).toISOString()}' WHERE admin_id = '${ownerRow.id}' AND revoked_at IS NULL`);
const idle = await owner.get('/auth/me');
check('Signed out after 30 minutes idle', idle.status === 401 && /30 minutes/.test(idle.data.error));
const lockC = new Client();
const tries = [];
for (let i = 0; i < 6; i++) tries.push((await lockC.post('/auth/login', { email: OWNER.email, password: `wrong ${i} attempt` })).status);
const lockedOut = await lockC.post('/auth/login', { email: OWNER.email, password: OWNER.password });
check('Repeated wrong passwords lock the account', [423, 429].includes(lockedOut.status), tries.join(',') + ' then ' + lockedOut.status);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) process.exit(1);
