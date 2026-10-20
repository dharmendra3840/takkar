// Checks Firebase ID tokens (Google and phone sign-in) with Web Crypto, no SDK.
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
import { fromBase64Url } from './crypto.js';
import { HttpError } from './http.js';

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const PROVIDERS = ['google.com', 'phone'];
const SKEW_S = 300;

let cache = { keys: null, until: 0 };

const invalid = (why) => new HttpError(401, 'Sign-in could not be confirmed. Please try again.', `bad_token:${why}`);

/** Google's signing keys, cached for as long as Google says (Cache-Control max-age). */
async function signingKeys(env, request) {
  // Tests sign their own tokens. Honoured only on a local dev server, never on workers.dev or a domain.
  if (env.INSECURE_TEST_JWKS) {
    const host = new URL(request.url).hostname;
    if (host !== '127.0.0.1' && host !== 'localhost') throw new HttpError(500, 'Test keys are set on a live server.', 'misconfigured');
    return JSON.parse(env.INSECURE_TEST_JWKS).keys;
  }
  if (cache.keys && Date.now() < cache.until) return cache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new HttpError(503, 'Sign-in is unavailable right now. Please try again in a minute.', 'jwks_unavailable');
  const maxAge = Number((res.headers.get('Cache-Control') || '').match(/max-age=(\d+)/)?.[1] || 3600);
  cache = { keys: (await res.json()).keys, until: Date.now() + Math.min(maxAge, 86400) * 1000 };
  return cache.keys;
}

const decodePart = (part) => JSON.parse(new TextDecoder().decode(fromBase64Url(part)));

/**
 * Returns { uid, provider, email, phone } for a valid token, or throws 401.
 * env.FIREBASE_PROJECT_ID must be set (wrangler.jsonc "vars").
 */
export async function verifyFirebaseToken(env, request, token) {
  const projectId = env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new HttpError(503, 'Google and phone sign-in are not set up yet.', 'auth_not_configured');
  if (typeof token !== 'string' || token.length > 4096) throw invalid('shape');
  const parts = token.split('.');
  if (parts.length !== 3) throw invalid('shape');

  let header, payload;
  try {
    header = decodePart(parts[0]);
    payload = decodePart(parts[1]);
  } catch {
    throw invalid('decode');
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw invalid('alg');

  const keys = await signingKeys(env, request);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    cache.until = 0; // Google rotated its keys: fetch fresh ones next time.
    throw invalid('kid');
  }
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromBase64Url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw invalid('signature');

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw invalid('aud');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw invalid('iss');
  if (typeof payload.exp !== 'number' || payload.exp < now - SKEW_S) throw invalid('expired');
  if (typeof payload.iat !== 'number' || payload.iat > now + SKEW_S) throw invalid('iat');
  if (typeof payload.auth_time === 'number' && payload.auth_time > now + SKEW_S) throw invalid('auth_time');
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) throw invalid('sub');

  const provider = payload.firebase?.sign_in_provider;
  if (!PROVIDERS.includes(provider)) throw invalid('provider');
  if (provider === 'google.com' && (!payload.email || payload.email_verified !== true)) throw invalid('email');
  if (provider === 'phone' && !payload.phone_number) throw invalid('phone');

  return {
    uid: payload.sub,
    provider: provider === 'google.com' ? 'google' : 'phone',
    email: provider === 'google.com' ? String(payload.email).toLowerCase() : null,
    phone: provider === 'phone' ? String(payload.phone_number) : null,
  };
}
