// Admin sign-in (password, then authenticator code), sessions and invites.
import { json, bad, unauthorised, HttpError, readJson, nowIso, sessionCookie, requireString } from '../lib/http.js';
import { sha256, randomToken, verifyPassword, hashPassword, encryptSecret, decryptSecret, newTotpSecret, verifyTotp, otpauthUrl } from '../lib/crypto.js';
import { SESSION_COOKIE, ABSOLUTE_MS, requireAdmin, tooManyAttempts, recordAttempt, clientIp, audit } from '../lib/auth.js';

const CHALLENGE_MS = 5 * 60 * 1000;
const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60 * 1000;
// Used when the email is unknown, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = 'pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const isSecure = (request) => new URL(request.url).protocol === 'https:';
const publicAdmin = (a) => ({ id: a.id, email: a.email, name: a.name, role: a.role });

/** Step 1: email and password. Returns a short-lived challenge for the authenticator code. */
export async function login({ request, env }) {
  const body = await readJson(request);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const ip = clientIp(request);
  const keys = [`ip:${ip}`, `email:${email}`];
  if (await tooManyAttempts(env, [`ip:${ip}`], 20) || await tooManyAttempts(env, [`email:${email}`], 8)) {
    throw new HttpError(429, 'Too many sign-in attempts. Wait 15 minutes and try again.', 'rate_limited');
  }

  const admin = await env.DB.prepare('SELECT * FROM admins WHERE email = ?1').bind(email).first();
  const ok = await verifyPassword(password, admin?.password_hash || DUMMY_HASH);
  const locked = admin?.locked_until && Date.now() < Date.parse(admin.locked_until);

  if (!admin || !ok || admin.status !== 'active' || locked) {
    await recordAttempt(env, keys);
    if (admin && !ok) {
      const failed = admin.failed_logins + 1;
      const lockUntil = failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MS).toISOString() : null;
      await env.DB.prepare('UPDATE admins SET failed_logins = ?1, locked_until = COALESCE(?2, locked_until) WHERE id = ?3').bind(failed, lockUntil, admin.id).run();
      if (lockUntil) await audit(env, null, 'admin.locked', { targetType: 'admin', targetId: admin.id, reason: `${failed} wrong passwords` });
    }
    if (locked) throw new HttpError(423, 'This account is locked for 15 minutes after repeated wrong passwords.', 'locked');
    throw unauthorised('Email or password is wrong.');
  }

  const token = randomToken();
  await env.DB.prepare('INSERT INTO login_challenges (token_hash, admin_id, expires_at) VALUES (?1, ?2, ?3)')
    .bind(await sha256(token), admin.id, new Date(Date.now() + CHALLENGE_MS).toISOString()).run();
  return json({ next: 'totp', challenge: token });
}

/** Step 2: the 6-digit code. SEC-01: required on every sign-in; no SMS. */
export async function verifyCode({ request, env }) {
  const body = await readJson(request);
  const hash = await sha256(String(body.challenge || ''));
  const ch = await env.DB.prepare('SELECT * FROM login_challenges WHERE token_hash = ?1').bind(hash).first();
  if (!ch || Date.now() > Date.parse(ch.expires_at) || ch.attempts >= 5) {
    if (ch) await env.DB.prepare('DELETE FROM login_challenges WHERE token_hash = ?1').bind(hash).run();
    throw unauthorised('That sign-in expired. Enter your email and password again.');
  }
  const admin = await env.DB.prepare('SELECT * FROM admins WHERE id = ?1').bind(ch.admin_id).first();
  const secret = await decryptSecret(admin.totp_secret_enc, env.TOTP_KEY);
  const counter = await verifyTotp(secret, body.code, Date.now(), admin.totp_last_counter);
  if (counter === null) {
    await env.DB.prepare('UPDATE login_challenges SET attempts = attempts + 1 WHERE token_hash = ?1').bind(hash).run();
    await recordAttempt(env, [`ip:${clientIp(request)}`, `email:${admin.email}`]);
    throw unauthorised('That code is not right. Use the current code from your authenticator app.');
  }

  const token = randomToken();
  const csrf = randomToken(24);
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM login_challenges WHERE token_hash = ?1 OR expires_at < ?2').bind(hash, now),
    env.DB.prepare('UPDATE admins SET totp_last_counter = ?1, failed_logins = 0, locked_until = NULL, last_login_at = ?2 WHERE id = ?3').bind(counter, now, admin.id),
    env.DB.prepare('INSERT INTO admin_sessions (id_hash, admin_id, csrf, created_at, last_seen_at, expires_at, user_agent) VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6)')
      .bind(await sha256(token), admin.id, csrf, now, new Date(Date.now() + ABSOLUTE_MS).toISOString(), (request.headers.get('User-Agent') || '').slice(0, 200)),
  ]);
  await audit(env, admin, 'admin.sign_in');
  return json({ admin: publicAdmin(admin), csrf }, 200, {
    'Set-Cookie': sessionCookie(SESSION_COOKIE, token, { maxAge: ABSOLUTE_MS / 1000, secure: isSecure(request) }),
  });
}

export async function me({ request, env }) {
  const admin = await requireAdmin(request, env, { csrf: false });
  return json({ admin: publicAdmin(admin), csrf: admin.csrf });
}

export async function logout({ request, env }) {
  const admin = await requireAdmin(request, env);
  await env.DB.prepare('UPDATE admin_sessions SET revoked_at = ?1 WHERE id_hash = ?2').bind(nowIso(), admin.sessionHash).run();
  await audit(env, admin, 'admin.sign_out');
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(SESSION_COOKIE, '', { maxAge: 0, secure: isSecure(request) }) });
}

/** Signs this admin out on every device. */
export async function logoutAll({ request, env }) {
  const admin = await requireAdmin(request, env);
  await env.DB.prepare('UPDATE admin_sessions SET revoked_at = ?1 WHERE admin_id = ?2 AND revoked_at IS NULL').bind(nowIso(), admin.id).run();
  await audit(env, admin, 'admin.sign_out_everywhere');
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(SESSION_COOKIE, '', { maxAge: 0, secure: isSecure(request) }) });
}

// ---------- Invites: set a password and enrol the authenticator ----------

async function loadInvite(env, token) {
  const row = await env.DB.prepare(
    `SELECT i.token_hash, i.expires_at, i.used_at, i.purpose, a.id, a.email, a.name, a.role, a.status
       FROM admin_invites i JOIN admins a ON a.id = i.admin_id WHERE i.token_hash = ?1`
  ).bind(await sha256(String(token || ''))).first();
  if (!row || row.used_at || Date.now() > Date.parse(row.expires_at) || row.status === 'disabled') {
    throw new HttpError(410, 'This invite link has expired or was already used. Ask the owner for a new one.', 'invite_invalid');
  }
  return row;
}

export async function inviteInfo({ env, query }) {
  const inv = await loadInvite(env, query.get('token'));
  return json({ email: inv.email, name: inv.name, role: inv.role, purpose: inv.purpose });
}

/** Creates a fresh authenticator secret for this invite and returns it for the QR code. */
export async function inviteSecret({ request, env }) {
  const body = await readJson(request);
  const inv = await loadInvite(env, body.token);
  const secret = newTotpSecret();
  await env.DB.prepare('UPDATE admins SET totp_secret_enc = ?1, totp_last_counter = -1 WHERE id = ?2')
    .bind(await encryptSecret(secret, env.TOTP_KEY), inv.id).run();
  return json({ secret, otpauth: otpauthUrl(secret, inv.email) });
}

/** Finishes the invite: password + a correct code from the newly scanned authenticator. */
export async function inviteComplete({ request, env }) {
  const body = await readJson(request);
  const inv = await loadInvite(env, body.token);
  const password = String(body.password || '');
  if (password.length < 12) throw bad('Use a password of at least 12 characters.');
  if (password.length > 200) throw bad('That password is too long.');
  if (password.toLowerCase().includes(inv.email.split('@')[0].toLowerCase())) throw bad('Do not use your email name inside the password.');
  const admin = await env.DB.prepare('SELECT totp_secret_enc FROM admins WHERE id = ?1').bind(inv.id).first();
  if (!admin.totp_secret_enc) throw bad('Scan the QR code first.');
  const secret = await decryptSecret(admin.totp_secret_enc, env.TOTP_KEY);
  const counter = await verifyTotp(secret, body.code);
  if (counter === null) throw bad('That code is not right. Check the time on your phone and use the current code.');
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare("UPDATE admins SET password_hash = ?1, status = 'active', totp_last_counter = ?2, failed_logins = 0, locked_until = NULL WHERE id = ?3")
      .bind(await hashPassword(password), counter, inv.id),
    env.DB.prepare('UPDATE admin_invites SET used_at = ?1 WHERE token_hash = ?2').bind(now, inv.token_hash),
    env.DB.prepare('UPDATE admin_sessions SET revoked_at = ?1 WHERE admin_id = ?2 AND revoked_at IS NULL').bind(now, inv.id),
  ]);
  await audit(env, { id: inv.id, email: inv.email }, inv.purpose === 'reset' ? 'admin.reset_complete' : 'admin.setup_complete', { targetType: 'admin', targetId: inv.id });
  return json({ ok: true });
}

export const INVITE_TTL_MS = 48 * 3600 * 1000;

/** Creates an invite token for an admin row. Returns the raw token (shown once). */
export async function createInvite(env, adminId, purpose, createdBy) {
  const token = randomToken();
  await env.DB.prepare('INSERT INTO admin_invites (token_hash, admin_id, purpose, expires_at, created_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(await sha256(token), adminId, purpose, new Date(Date.now() + INVITE_TTL_MS).toISOString(), createdBy, nowIso()).run();
  return token;
}

export { requireString };
