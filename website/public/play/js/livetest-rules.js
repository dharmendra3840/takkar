// Live tests in tutor leagues, shared by the app and the server (Live tests (beta) tab, LIVE-01 to LIVE-19).
// A tutor schedules a timed test from Takkar's question bank in the league's exam pattern; students start
// within the late window and each gets the full duration from their own start; results reach students
// only when the tutor releases them.
import { EXAMS } from './exams.js?v=a9e7f3de4a';

export const LIVE = {
  questionsMin: 10, questionsMax: 100,
  minutesMin: 10, minutesMax: 180,
  lateChoices: [5, 10],
  leadMinMinutes: 15, leadMaxDays: 30,
  perDayDefault: 2, // live tests per league per day (admin setting limit.live_tests_per_day)
  saveGraceMs: 5000, // an answer sent in the last seconds still counts if it arrives this late
  titleMax: 60,
};
export const DIFFICULTIES = { easy: 'Easier', exam: 'Exam level', hard: 'Harder' };

const MIN = 60 * 1000;
/** When the test closes for everyone: start + late window + duration (LIVE-09). */
export const closesAtMs = (startsAtMs, late, minutes) => startsAtMs + (late + minutes) * MIN;

/**
 * Where a test stands at a moment, for everyone:
 * scheduled (before the start), open (students can start), running (window over, some still sitting),
 * ended (closed, results not released), released, cancelled.
 */
export function testState(t, nowMs) {
  if (t.status === 'cancelled') return 'cancelled';
  if (t.status === 'released') return 'released';
  if (nowMs >= Date.parse(t.closesAt)) return 'ended';
  const start = Date.parse(t.startsAt);
  if (nowMs < start) return 'scheduled';
  if (nowMs < start + t.lateMinutes * MIN) return 'open';
  return 'running';
}

/** The quant and reasoning split for a test: the exam's mini-mock ratio, or all in one section. */
export function sectionCounts(examId, count, sections = ['quant', 'reasoning']) {
  if (sections.length === 1) return { quant: sections[0] === 'quant' ? count : 0, reasoning: sections[0] === 'reasoning' ? count : 0 };
  const m = EXAMS[examId]?.mock || { quant: 12, reasoning: 13 };
  const quant = Math.round((count * m.quant) / (m.quant + m.reasoning));
  return { quant, reasoning: count - quant };
}

/** '' when the title is fine. */
export function titleError(raw) {
  const t = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (t.length < 3) return 'Give the test a title of at least 3 letters.';
  if (t.length > LIVE.titleMax) return `Keep the title under ${LIVE.titleMax} letters.`;
  if (!/^[\p{L}\p{N}][\p{L}\p{M}\p{N} .,:&()'/#+-]*$/u.test(t)) return 'Use letters, numbers and simple punctuation only.';
  return '';
}

/** '' when the settings fit the beta limits (LIVE-01); the server checks again. */
export function scheduleError({ title, startsAtMs, minutes, late, count, difficulty }, nowMs) {
  const bad = titleError(title);
  if (bad) return bad;
  if (!Number.isFinite(startsAtMs)) return 'Pick the date and time the test starts.';
  if (startsAtMs < nowMs + LIVE.leadMinMinutes * MIN) return `Schedule the test at least ${LIVE.leadMinMinutes} minutes ahead, so students can see it.`;
  if (startsAtMs > nowMs + LIVE.leadMaxDays * 24 * 60 * MIN) return `Schedule the test within the next ${LIVE.leadMaxDays} days.`;
  if (!Number.isInteger(count) || count < LIVE.questionsMin || count > LIVE.questionsMax) return `Pick ${LIVE.questionsMin} to ${LIVE.questionsMax} questions.`;
  if (!Number.isInteger(minutes) || minutes < LIVE.minutesMin || minutes > LIVE.minutesMax) return `Pick a duration of ${LIVE.minutesMin} to ${LIVE.minutesMax} minutes.`;
  if (!LIVE.lateChoices.includes(late)) return 'Pick a late window of 5 or 10 minutes.';
  if (!DIFFICULTIES[difficulty]) return 'Pick a level.';
  return '';
}

/** Minutes and seconds left, for timers ("29:58"). */
export function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(s % 60).padStart(2, '0')}`;
}
