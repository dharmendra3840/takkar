// POST /api/waitlist on Vercel — saves an early-access email to Upstash Redis
// (free through the Vercel Marketplace). Same rules as functions/api/waitlist.js,
// the Cloudflare version: email + age confirmation only (PRIV-01), never logs
// the email (SEC-27), same reply whether or not the email was already listed.
// Uses Upstash's REST API with fetch, so there are no dependencies.

const NOTICE_VERSION = '2026-10-beta';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RATE_LIMIT = 10; // sign-ups per visitor per hour (SEC-08)

// The Vercel integration sets one of these pairs.
function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

/** Runs Redis commands in one round trip and returns their results. */
async function redis(config, commands) {
  const res = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Redis returned ${res.status}`);
  const out = await res.json();
  const failed = out.find((r) => r.error);
  if (failed) throw new Error(failed.error);
  return out.map((r) => r.result);
}

async function readBody(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) return { data: await request.json(), wantsJson: true };
  const form = await request.formData();
  return {
    data: { email: form.get('email'), adult: form.get('adult') === 'yes', website: form.get('website') },
    wantsJson: false,
  };
}

function reply(wantsJson, ok, status) {
  if (wantsJson) {
    return new Response(JSON.stringify({ ok }), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  return new Response(null, {
    status: 303,
    headers: { Location: `/?waitlist=${ok ? 'ok' : 'error'}#join`, 'Cache-Control': 'no-store' },
  });
}

/** A one-way hash of the visitor's IP for the hour, so no raw IP is ever stored. */
async function visitorKey(request) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
  const hour = Math.floor(Date.now() / 3600000);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}:${hour}:takkar-waitlist`));
  return 'rl:' + [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request) {
  let body;
  try {
    body = await readBody(request);
  } catch {
    return reply(true, false, 400);
  }
  const { data, wantsJson } = body;

  // Bots fill the hidden field; tell them it worked and store nothing.
  if (data.website) return reply(wantsJson, true, 200);

  const email = String(data.email || '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email) || data.adult !== true) {
    return reply(wantsJson, false, 400);
  }

  const config = redisConfig();
  if (!config) return reply(wantsJson, false, 503);

  try {
    const key = await visitorKey(request);
    const [count] = await redis(config, [['INCR', key], ['EXPIRE', key, '3600']]);
    if (count > RATE_LIMIT) return reply(wantsJson, false, 429);

    const now = new Date().toISOString();
    // HSETNX keeps the first sign-up and ignores repeats.
    await redis(config, [['HSETNX', 'waitlist', email, JSON.stringify({ adult_confirmed_at: now, notice_version: NOTICE_VERSION, created_at: now })]]);
  } catch (error) {
    console.error('waitlist save failed:', error && error.message);
    return reply(wantsJson, false, 500);
  }
  return reply(wantsJson, true, 200);
}

export function GET() {
  return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
}
