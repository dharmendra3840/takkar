// Educator applications from the app (Live tests tab, EDU-01 to EDU-07). Tutors prove they control the
// channel or centre they name; an admin checks it by hand and decides in the console (community.js).
import { json, bad, HttpError, readJson, nowIso } from '../lib/http.js';
import { randomId } from '../lib/crypto.js';
import { blockedByFilter } from '../lib/names.js';
import { getSettings } from '../lib/settings.js';
import { currentPlayer, limit } from './player.js';
import { EXAMS } from '../../../app/www/js/exams.js';
import { CODE_ALPHABET } from '../../../app/www/js/squad-rules.js';
import {
  EDUCATOR_TERMS_VERSION, PROOF_DAYS, REAPPLY_DAYS, MAX_EXAMS, PLATFORMS, needsLink, centreNameError, linkError, audienceError,
} from '../../../app/www/js/educator-rules.js';

const DAY = 86400000;

function proofCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `TAKKAR-${[...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')}`;
}

const latest = (env, userId) => env.DB.prepare('SELECT * FROM educator_requests WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 1').bind(userId).first();

async function applicationsOpen(env) {
  const s = await getSettings(env);
  if (s['switch.educator_applications']?.value === false || s['switch.pause_all']?.value === true) {
    throw new HttpError(403, 'Educator applications are closed for a short while. Please try again later.', 'applications_closed');
  }
}

/** What the applicant sees. The admin's own reason stays in the audit log; only a rejection note is shown. */
function view(user, r) {
  const reapplyAt = r?.status === 'rejected' && r.decided_at ? new Date(Date.parse(r.decided_at) + REAPPLY_DAYS * DAY).toISOString() : null;
  const waiting = r?.status === 'pending' || (reapplyAt && Date.parse(reapplyAt) > Date.now());
  return {
    educator: user.role === 'educator',
    google: !!user.email,
    canApply: !!user.email && user.role !== 'educator' && !waiting,
    reapplyAt,
    application: r ? {
      id: r.id,
      status: r.status,
      name: r.channel_name,
      platform: r.platform,
      link: r.channel_url,
      audience: r.followers,
      exams: JSON.parse(r.exams || '[]'),
      code: r.status === 'pending' ? r.proof_code : null,
      codeExpiresAt: r.status === 'pending' ? r.proof_expires_at : null,
      verifiedBy: r.status === 'approved' ? r.verified_by : null,
      note: r.status === 'rejected' ? r.decision_note : null,
      createdAt: r.created_at,
      decidedAt: r.decided_at,
    } : null,
  };
}

// ---------- GET /api/educator: my application ----------
export async function mine({ request, env }) {
  const user = await currentPlayer(request, env);
  return json(view(user, await latest(env, user.id)));
}

// ---------- POST /api/educator/apply ----------
export async function apply({ request, env }) {
  const user = await currentPlayer(request, env);
  await applicationsOpen(env);
  await limit(env, 'educator-apply', user.id, 10, 86400);
  if (!user.email) throw new HttpError(403, 'Sign in with Google to apply as an educator.', 'google_only');
  if (user.role === 'educator') throw bad('You are already a verified educator.', 'already_educator');
  const last = await latest(env, user.id);
  const state = view(user, last);
  if (last?.status === 'pending') throw new HttpError(409, 'Your application is already waiting for review.', 'pending');
  if (!state.canApply) throw new HttpError(409, `You can apply again from ${new Date(state.reapplyAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}.`, 'reapply_later');

  const body = (await readJson(request)) || {};
  const name = String(body.name ?? '').trim().replace(/\s+/g, ' ');
  const nameError = centreNameError(name) || ((await blockedByFilter(env, name)) ? 'That name is not allowed.' : '');
  if (nameError) throw bad(nameError, 'name');
  const platform = String(body.platform ?? '');
  if (!PLATFORMS[platform]) throw bad('Choose how we can check your channel or centre.', 'platform');
  const link = needsLink(platform) ? String(body.link ?? '').trim() : null;
  const badLink = linkError(platform, link);
  if (badLink) throw bad(badLink, 'link');
  const audienceProblem = audienceError(body.audience);
  if (audienceProblem) throw bad(audienceProblem, 'audience');
  const exams = [...new Set(Array.isArray(body.exams) ? body.exams.map(String) : [])];
  if (!exams.length || exams.length > MAX_EXAMS || exams.some((e) => !EXAMS[e])) throw bad(`Choose 1 to ${MAX_EXAMS} exams you teach.`, 'exams');
  const note = String(body.note ?? '').trim().slice(0, 300) || null;
  if (body.termsVersion !== EDUCATOR_TERMS_VERSION) throw bad('Please read and accept the educator terms.', 'terms');

  const now = nowIso();
  const code = needsLink(platform) ? proofCode() : null;
  // Two taps at once: the database keeps one waiting application (0008), the second gets "already waiting".
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO educator_requests (id, user_id, channel_name, channel_url, followers, note, status, created_at, platform, exams, proof_code, proof_expires_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7, ?8, ?9, ?10, ?11)`
    ).bind(randomId('edu_'), user.id, name, link, Number(body.audience), note, now, platform, JSON.stringify(exams), code,
      code ? new Date(Date.now() + PROOF_DAYS * DAY).toISOString() : null),
    env.DB.prepare('UPDATE users SET educator_terms_version = ?1, educator_terms_at = ?2 WHERE id = ?3').bind(EDUCATOR_TERMS_VERSION, now, user.id),
  ]).catch((e) => {
    if (/UNIQUE/i.test(String(e?.message))) throw new HttpError(409, 'Your application is already waiting for review.', 'pending');
    throw e;
  });
  return json(view(user, await latest(env, user.id)), 201);
}

// ---------- POST /api/educator/code: a fresh code when the old one has run out ----------
export async function renewCode({ request, env }) {
  const user = await currentPlayer(request, env);
  await limit(env, 'educator-code', user.id, 5, 86400);
  const r = await latest(env, user.id);
  if (!r || r.status !== 'pending' || !r.proof_code) throw bad('There is no code to renew.', 'no_code');
  if (Date.parse(r.proof_expires_at) > Date.now()) return json(view(user, r));
  await env.DB.prepare('UPDATE educator_requests SET proof_code = ?1, proof_expires_at = ?2 WHERE id = ?3')
    .bind(proofCode(), new Date(Date.now() + PROOF_DAYS * DAY).toISOString(), r.id).run();
  return json(view(user, await latest(env, user.id)));
}
