// What the app remembers on this phone, in one local record.
// Guests: everything stays here, and it is gone if the app is uninstalled.
// Signed-in players: the same record, and duels are also saved on the Takkar server.
import { istDay, weekStart } from './time.js?v=0f36455e6e';

const KEY = 'takkar.v1';
export const DEFAULT_FREE_DUELS = 3; // PLUS-08; the admin can change it (limit.free_duels_per_day)

function blank() {
  return {
    profile: null, // { nickname, ageConfirmedAt, termsVersion, createdAt }
    account: null, // { mode: 'guest' } or { mode: 'google' | 'phone', playerId, email, phoneLast4, plusUntil, mutedUntil }
    settings: { topic: 'mixed', level: 'exam', marking: 'exam', rival: 'steady', reminders: false },
    history: [], // finished and abandoned duels; synced: true once the server has it
    streak: { current: 0, best: 0, lastDay: null },
    plus: null, // demo Plus { demo: true, since }
    flags: [], // { at, type, text, reason }
    league: null, // { channel, code, createdAt }
    reactions: [], // { at, reaction }
    badges: {}, // earned badges that should stay earned, e.g. { squad: true }
    outbox: [], // reports and question flags waiting for a connection: { path, body, at }
    config: null, // last config from the server, with fetchedAt
    seenAnnouncements: [],
    exam: null, // 'ssc-cgl' | 'ibps-po' | 'rrb-ntpc' (exams.js)
    examMonth: null, // 'YYYY-MM' or null
    goal: null, // duels a day: 1, 3 or 5
    goalAsked: false,
    rulesSeen: false,
  };
}

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const saved = { ...blank(), ...JSON.parse(raw) };
    // Players from the 0.1 prototype become guests, with everything they had.
    if (saved.profile && !saved.account) saved.account = { mode: 'guest' };
    return saved;
  } catch {
    return blank();
  }
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked: the app keeps working for this session.
  }
}

export const store = {
  get: () => data,
  update(fn) {
    fn(data);
    save();
  },
  /** PROF-03: deletes everything Takkar stored on this phone. */
  wipe() {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem('takkar.session');
      localStorage.removeItem('takkar.glass');
    } catch { /* nothing to do */ }
    data = blank();
  },
  exportJson() {
    const { config, outbox, ...mine } = data;
    return JSON.stringify({ exportedAt: new Date().toISOString(), app: 'Takkar', data: mine }, null, 2);
  },
};

export const signedIn = () => !!data.account && data.account.mode !== 'guest';

// ---------- Derived numbers ----------

export function hasPlus() {
  if (data.plus) return true;
  const until = data.account?.plusUntil;
  return !!until && Date.parse(until) > Date.now();
}

export const freeDuelsPerDay = () => data.config?.limits?.freeDuelsPerDay ?? DEFAULT_FREE_DUELS;

/** Duels that use up the free allowance today (solo duels and rematches). */
export function freeDuelsUsedToday() {
  const today = istDay();
  return data.history.filter((d) => d.day === today && (d.kind === 'solo' || d.kind === 'rematch')).length;
}

export function freeDuelsLeft() {
  if (hasPlus()) return Infinity;
  return Math.max(0, freeDuelsPerDay() - freeDuelsUsedToday());
}

/** STRK-01: +1 for each IST day with at least one finished duel. */
export function recordStreakDay(day = istDay()) {
  const s = data.streak;
  if (s.lastDay === day) return;
  if (s.lastDay === day - 1) s.current += 1;
  else s.current = 1;
  s.lastDay = day;
  s.best = Math.max(s.best, s.current);
}

/** Streak shown today: still alive if the last duel was today or yesterday. */
export function liveStreak() {
  const s = data.streak;
  if (s.lastDay === null) return 0;
  return istDay() - s.lastDay <= 1 ? s.current : 0;
}

/** RANK-01: weekly total = best 3 ranked duels per day, exam level and exam marking only. */
/** Duels in the player's current exam (ranks and bests are kept per exam). */
const sameExam = (d) => (d.exam || null) === (data.exam || null);

export function weeklyTotal(week = weekStart()) {
  const byDay = new Map();
  for (const d of data.history) {
    if (!d.counted || d.level !== 'exam' || d.marking !== 'exam' || !sameExam(d)) continue;
    if (weekStart(d.day) !== week) continue;
    if (!byDay.has(d.day)) byDay.set(d.day, []);
    byDay.get(d.day).push(d.score);
  }
  let total = 0;
  for (const scores of byDay.values()) {
    total += scores.sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + Math.max(0, b), 0);
  }
  return total;
}

export function rankedDuelsToday() {
  const today = istDay();
  return data.history.filter((d) => d.day === today && d.counted && d.level === 'exam' && d.marking === 'exam' && sameExam(d)).length;
}

/** Correct answers this week from counted duels (squad missions, SQUAD-02). */
export function correctThisWeek(week = weekStart()) {
  return data.history
    .filter((d) => d.counted && weekStart(d.day) === week)
    .reduce((sum, d) => sum + d.right, 0);
}

/** PROF-01: accuracy and average time by topic, from every answered question. */
export function topicStats() {
  const stats = {};
  for (const d of data.history) {
    for (const a of d.answers || []) {
      const key = a.topic;
      if (!key) continue;
      stats[key] = stats[key] || { right: 0, answered: 0, timeMs: 0, byLabel: {} };
      const s = stats[key];
      if (a.choice !== null) {
        s.answered += 1;
        s.timeMs += a.timeMs;
        if (a.correct) s.right += 1;
      }
      s.byLabel[a.label] = s.byLabel[a.label] || { right: 0, seen: 0 };
      s.byLabel[a.label].seen += 1;
      if (a.correct) s.byLabel[a.label].right += 1;
    }
  }
  return stats;
}

export function bestScore() {
  const exam = data.history.filter((d) => d.status === 'finished' && d.marking === 'exam' && d.kind !== 'mock' && d.kind !== 'practice' && sameExam(d));
  return exam.length ? Math.max(...exam.map((d) => d.score)) : null;
}
