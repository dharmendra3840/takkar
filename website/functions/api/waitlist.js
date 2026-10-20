// POST /api/waitlist — saves an early-access email to D1 (binding: DB).
// Accepts JSON from site.js, or a plain form post when JavaScript is off.
// Never logs the email address (SEC-27). Collects only email + age confirmation (PRIV-01).

const NOTICE_VERSION = 'waitlist-2026-10';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function readBody(request) {
  const type = request.headers.get('Content-Type') || '';
  if (type.includes('application/json')) {
    return { data: await request.json(), wantsJson: true };
  }
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

export async function onRequestPost({ request, env }) {
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

  if (!env.DB) return reply(wantsJson, false, 503);

  const now = new Date().toISOString();
  try {
    // The same reply whether or not the email was already there, so the form
    // cannot be used to check who has signed up.
    await env.DB.prepare(
      'INSERT OR IGNORE INTO waitlist (email, adult_confirmed_at, notice_version, created_at) VALUES (?1, ?2, ?3, ?4)'
    ).bind(email, now, NOTICE_VERSION, now).run();
  } catch (error) {
    console.error('waitlist insert failed', error && error.message);
    return reply(wantsJson, false, 500);
  }
  return reply(wantsJson, true, 200);
}

export function onRequest() {
  return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
}
