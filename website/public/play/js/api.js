// Talking to the Takkar server. Every call can fail (no signal, server down), and the app
// keeps working from what it saved last time. Guests only read the config and send
// reports or question flags they choose to send; nothing else leaves the phone.
import { apiBase, APP_VERSION } from './config.js?v=ffd6767078';

const SESSION_KEY = 'takkar.session';
const TIMEOUT_MS = 10000;

export function sessionToken() {
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
}
export function setSessionToken(token) {
  try {
    if (token) localStorage.setItem(SESSION_KEY, token);
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* storage blocked: signed in for this session only */ }
}

/**
 * Returns { ok, status, data, offline }. Never throws.
 * auth: send the session token (signed-in calls).
 */
export async function api(method, path, { body, auth = false } = {}) {
  const headers = { 'X-Takkar-App': APP_VERSION };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? sessionToken() : null;
  if (auth && !token) return { ok: false, status: 401, data: { code: 'unauthorised' }, offline: false };
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(apiBase() + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal, cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data, offline: false };
  } catch {
    return { ok: false, status: 0, data: {}, offline: true };
  } finally {
    clearTimeout(timer);
  }
}

/** A friendly message for a failed call. */
export function problem(result, fallback = 'Something went wrong. Please try again.') {
  if (result.offline) return 'No internet connection. Check your signal and try again.';
  return result.data?.error || fallback;
}
