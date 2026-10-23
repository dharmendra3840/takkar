// Keeps the phone and the Takkar server in step:
// - config: the admin's switches, limits, announcements and paused question types
// - account: nickname, Plus, suspensions (signed-in players)
// - duels: uploaded after each duel, and later if the phone was offline
// - outbox: reports and question flags written while offline
import { api, setSessionToken, sessionToken } from './api.js?v=5a018ff99f';
import { store, signedIn } from './store.js?v=5a018ff99f';
import { QUANT } from './engine/quant.js?v=5a018ff99f';
import { REASONING } from './engine/reasoning.js?v=5a018ff99f';

const CONFIG_MAX_AGE_MS = 5 * 60 * 1000;
const TEMPLATE_INFO = Object.fromEntries([
  ...QUANT.map((t) => [t.id, { label: t.label, topic: 'quant' }]),
  ...REASONING.map((t) => [t.id, { label: t.label, topic: 'reasoning' }]),
]);

/** Fetches the config if it is older than 5 minutes (or when forced). Returns the config in use. */
export async function refreshConfig({ force = false } = {}) {
  const current = store.get().config;
  if (!force && current && Date.now() - current.fetchedAt < CONFIG_MAX_AGE_MS) return current;
  const res = await api('GET', '/config');
  if (!res.ok) return current;
  store.update((s) => { s.config = { ...res.data, fetchedAt: Date.now() }; });
  return store.get().config;
}

/** Copies what the server knows about the player onto the phone. */
function applyPlayer(player) {
  store.update((s) => {
    if (s.profile) s.profile.nickname = player.nickname;
    else s.profile = { nickname: player.nickname, ageConfirmedAt: player.ageConfirmedAt, termsVersion: player.termsVersion, createdAt: player.createdAt };
    s.account = {
      mode: player.signInMethod,
      playerId: player.id,
      email: player.email,
      phoneLast4: player.phoneLast4,
      plusUntil: player.plusUntil,
      mutedUntil: player.mutedUntil,
    };
    // A new phone takes the exam, month and goal saved with the account; this phone's choice wins otherwise.
    if (!s.exam && player.exam) { s.exam = player.exam; s.examMonth = player.examMonth; s.rulesSeen = true; }
    if (s.goal === null && player.goal) { s.goal = player.goal; s.goalAsked = true; }
    // The server's streak includes duels from other phones.
    const st = player.streak;
    if (st && (st.lastDay ?? -1) >= (s.streak.lastDay ?? -1)) s.streak = { current: st.current, best: Math.max(st.best, s.streak.best), lastDay: st.lastDay };
  });
}

/**
 * Checks the account. Returns { ok } or { blocked: { code, message, until } }
 * for a suspended or banned player, or { ended: true } when the session is gone.
 */
export async function refreshAccount() {
  if (!signedIn() || !sessionToken()) return { ok: true };
  const res = await api('GET', '/me', { auth: true });
  if (res.ok) { applyPlayer(res.data.player); return { ok: true }; }
  if (res.status === 403) return { blocked: { code: res.data.code, message: res.data.error, until: res.data.until || null } };
  if (res.status === 401) return { ended: true };
  return { ok: true, offline: res.offline };
}

/** Turns a history record into what POST /api/duels expects (null if it cannot be sent). */
function forUpload(h) {
  if (!h.answers || h.answers.some((a) => !a.template)) return null; // 0.1 records have no question types
  if (h.kind === 'practice' || h.kind === 'mock') return null; // practice and mocks stay on the phone for now
  return {
    id: h.id, at: h.at, day: h.day, kind: h.kind, seed: h.seed, topic: h.topic, level: h.level, marking: h.marking,
    rival: h.kind === 'challenge' ? null : h.rival, exam: h.exam || null, status: h.status, score: h.score, rivalScore: h.rivalScore,
    verdict: h.verdict, counted: h.counted, right: h.right, wrong: h.wrong, skipped: h.skipped, timeMs: h.timeMs,
    answers: h.answers.map((a) => ({ template: a.template, choice: a.choice, correct: a.correct, points: a.points ?? 0, timeMs: a.timeMs })),
  };
}

let syncing = null;
let again = false;
/**
 * Uploads every duel the server does not have yet. Safe to call often: a call made while an
 * upload is running (a duel finished meanwhile) makes it go round once more.
 */
export function syncDuels() {
  if (!signedIn() || !sessionToken()) return Promise.resolve({ ok: true, sent: 0 });
  if (syncing) { again = true; return syncing; }
  syncing = (async () => {
    let sent = 0;
    try {
      do {
        again = false;
        sent += await uploadPending();
      } while (again && signedIn() && sessionToken());
      return { ok: true, sent };
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

async function uploadPending() {
  let sent = 0;
  const pending = store.get().history.filter((h) => !h.synced && !h.localOnly);
  for (let i = 0; i < pending.length; i += 50) {
    const batch = pending.slice(i, i + 50);
    const body = batch.map(forUpload);
    // Records the server can never take (too old, or from 0.1) stay on the phone only.
    batch.forEach((h, j) => { if (!body[j]) h.localOnly = true; });
    const send = body.filter(Boolean);
    if (!send.length) continue;
    const res = await api('POST', '/duels', { auth: true, body: { duels: send } });
    if (res.status === 400) {
      // One bad record must not block the rest: send them one by one and mark the bad one.
      for (const d of send) {
        const one = await api('POST', '/duels', { auth: true, body: { duels: [d] } });
        const h = batch.find((x) => x.id === d.id);
        if (one.ok) { h.synced = true; sent++; } else if (one.status === 400) h.localOnly = true; else break;
      }
      store.update(() => {});
      continue;
    }
    if (!res.ok) break;
    store.update(() => { for (const h of batch) if (res.data.ids[h.id]) h.synced = true; });
    sent += send.length;
    if (res.data.streak) applyPlayer({ ...accountAsPlayer(), streak: res.data.streak });
  }
  store.update(() => {});
  return sent;
}

function accountAsPlayer() {
  const s = store.get();
  return { ...s.account, id: s.account.playerId, signInMethod: s.account.mode, nickname: s.profile.nickname };
}

/** Sends reports and flags written while offline. */
export async function flushOutbox() {
  const queue = store.get().outbox;
  if (!queue.length) return;
  const left = [];
  for (const item of queue) {
    const res = await api('POST', item.path, { auth: signedIn(), body: item.body });
    // Keep it only if it failed for lack of signal; a refused one (400, 429) is dropped.
    if (res.offline || res.status >= 500) left.push(item);
  }
  store.update((s) => { s.outbox = left.slice(-50); });
}

/** Sends now, or queues for later. Returns { ok, queued, error }. */
export async function sendOrQueue(path, body) {
  const res = await api('POST', path, { auth: signedIn(), body });
  if (res.ok) return { ok: true };
  if (res.offline || res.status >= 500) {
    store.update((s) => { s.outbox.push({ path, body, at: Date.now() }); });
    return { ok: true, queued: true };
  }
  return { ok: false, error: res.data?.error || 'That did not go through.' };
}

/**
 * After a successful POST /api/auth/firebase: keeps the session, then merges this phone's
 * duels with the account's (uploads ours, downloads theirs).
 */
export async function completeSignIn({ token, player }) {
  setSessionToken(token);
  applyPlayer(player);
  // Duels played as a guest on this phone now belong to the account.
  store.update((s) => { for (const h of s.history) if (!h.synced) h.localOnly = false; });
  await syncDuels();
  const res = await api('GET', '/me?history=1', { auth: true });
  if (res.ok && Array.isArray(res.data.history)) {
    applyPlayer(res.data.player);
    store.update((s) => {
      const local = s.history.filter((h) => !h.synced); // anything the server could not take stays
      const remote = res.data.history.map((h) => ({
        ...h,
        synced: true,
        answers: h.answers.map((a) => ({ ...a, label: TEMPLATE_INFO[a.template]?.label || a.template, topic: TEMPLATE_INFO[a.template]?.topic })),
      }));
      s.history = [...remote, ...local].sort((a, b) => a.at - b.at).slice(-500);
    });
  }
}

/** Signs out on this phone. The duels stay here as a guest's. */
export async function signOutHere() {
  await api('POST', '/auth/logout', { auth: true });
  setSessionToken(null);
  store.update((s) => { s.account = { mode: 'guest' }; for (const h of s.history) h.localOnly = true; });
}
