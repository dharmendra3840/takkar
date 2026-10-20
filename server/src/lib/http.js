// Responses, errors, cookies and security headers.

export class HttpError extends Error {
  constructor(status, message, code = 'error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const bad = (message, code = 'bad_request') => new HttpError(400, message, code);
export const unauthorised = (message = 'Please sign in.') => new HttpError(401, message, 'unauthorised');
export const forbidden = (message = 'Your role cannot do this.') => new HttpError(403, message, 'forbidden');
export const notFound = (message = 'Not found.') => new HttpError(404, message, 'not_found');

// SEC-15: strict headers on every API response.
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cache-Control': 'no-store',
};

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS, ...extra },
  });
}

export function text(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { ...SECURITY_HEADERS, ...extra } });
}

export function errorResponse(err) {
  if (err instanceof HttpError) return json({ error: err.message, code: err.code }, err.status);
  // Never put personal data in logs (SEC-27): log only the message.
  console.error('Unhandled error:', err && err.message);
  return json({ error: 'Something went wrong on our side.', code: 'server_error' }, 500);
}

export async function readJson(request) {
  const type = request.headers.get('Content-Type') || '';
  if (!type.includes('application/json')) throw bad('Send JSON.');
  try {
    return await request.json();
  } catch {
    throw bad('That request body is not valid JSON.');
  }
}

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** SEC-05 style cookie: Secure, HttpOnly, SameSite=Strict, scoped to /admin. */
export function sessionCookie(name, value, { maxAge, secure = true } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/admin', 'HttpOnly', 'SameSite=Strict'];
  if (secure) parts.push('Secure');
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

export const nowIso = () => new Date().toISOString();

/** IST day number, matching the app (FRS: all times are IST). */
export function istDay(ms = Date.now()) {
  return Math.floor((ms + 5.5 * 3600000) / 86400000);
}

export function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function requireString(value, name, { min = 1, max = 500 } = {}) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (s.length < min) throw bad(`${name} is required${min > 1 ? ` (at least ${min} characters)` : ''}.`);
  if (s.length > max) throw bad(`${name} is too long (${max} characters at most).`);
  return s;
}
