// Crypto helpers built on Web Crypto (no third-party libraries, SEC-23).

const enc = new TextEncoder();
const dec = new TextDecoder();

export function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function toBase64Url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text) {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export const randomToken = (n = 32) => toBase64Url(randomBytes(n));

export function randomId(prefix = '') {
  return prefix + toBase64Url(randomBytes(12));
}

export async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return toBase64Url(new Uint8Array(digest));
}

/** Constant-time comparison of two strings. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- Passwords: PBKDF2-SHA256 ----------

const PBKDF2_ITERATIONS = 100000; // the maximum Workers allows

export async function hashPassword(password, iterations = PBKDF2_ITERATIONS) {
  const salt = randomBytes(16);
  const hash = await pbkdf2(password, salt, iterations);
  return `pbkdf2-sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored) return false;
  const [scheme, iter, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2-sha256') return false;
  const candidate = await pbkdf2(password, fromBase64Url(salt), Number(iter));
  return safeEqual(toBase64Url(candidate), hash);
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

// ---------- Secret encryption: AES-GCM with a key from a Worker secret ----------

async function aesKey(secretB64) {
  const raw = fromBase64Url(secretB64);
  if (raw.length !== 32) throw new Error('TOTP_KEY must be 32 bytes, base64url encoded');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(plain, secretB64) {
  const iv = randomBytes(12);
  const key = await aesKey(secretB64);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ct))}`;
}

export async function decryptSecret(sealed, secretB64) {
  const [v, iv, ct] = sealed.split('.');
  if (v !== 'v1') throw new Error('Unknown secret format');
  const key = await aesKey(secretB64);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64Url(iv) }, key, fromBase64Url(ct));
  return dec.decode(pt);
}

// ---------- TOTP (RFC 6238): 6 digits, 30 seconds, SHA-1, as authenticator apps expect ----------

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes) {
  let bits = 0; let value = 0; let out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  const clean = text.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0; let value = 0; const out = [];
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

export async function totpCode(secretB32, counter) {
  const key = await crypto.subtle.importKey('raw', base32Decode(secretB32), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new Uint8Array(8);
  let c = BigInt(counter);
  for (let i = 7; i >= 0; i--) { msg[i] = Number(c & 0xffn); c >>= 8n; }
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const offset = mac[19] & 0xf;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 1000000).padStart(6, '0');
}

/** Accepts the current code or one step either side (clock drift). Returns the matched counter or null. */
export async function verifyTotp(secretB32, code, now = Date.now(), lastCounter = -1) {
  if (!/^\d{6}$/.test(String(code || ''))) return null;
  const counter = Math.floor(now / 30000);
  for (const c of [counter, counter - 1, counter + 1]) {
    if (c <= lastCounter) continue; // a code can be used only once
    if (safeEqual(await totpCode(secretB32, c), String(code))) return c;
  }
  return null;
}

export function otpauthUrl(secretB32, email) {
  const label = encodeURIComponent(`Takkar admin:${email}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent('Takkar admin')}&algorithm=SHA1&digits=6&period=30`;
}
