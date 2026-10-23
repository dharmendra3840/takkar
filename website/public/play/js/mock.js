// Mini mock: 25 questions in the exam's pattern, played like the real CBT
// (move between questions, change answers, mark for review, one clock or sectional clocks).
import { generateSet, orderForPlayer } from './engine/index.js?v=7095c77cc1';
import { randomSeed } from './engine/rng.js?v=7095c77cc1';
import { EXAMS, quantName } from './exams.js?v=7095c77cc1';
import { tidy } from './game.js?v=7095c77cc1';
import { istDay } from './time.js?v=7095c77cc1';

/** A new mock for an exam. paused: question types switched off in the admin. */
export function createMock({ exam, playerKey, paused = [], seed = randomSeed(), now = Date.now() }) {
  const e = EXAMS[exam];
  const { quant, reasoning, minutes, sectional } = e.mock;
  const questions = generateSet(seed, { quant, reasoning }, 'exam', { paused, weights: e.weights })
    .map((q, i) => orderForPlayer(q, playerKey, i));
  const totalMs = minutes * 60000;
  const sections = [
    { name: quantName(e), from: 0, to: quant, ms: sectional ? totalMs / 2 : null },
    { name: 'Reasoning', from: quant, to: quant + reasoning, ms: sectional ? totalMs / 2 : null },
  ];
  return {
    id: `m-${now.toString(36)}-${seed.toString(36)}`,
    exam, seed, sectional, sections, totalMs,
    questions,
    answers: questions.map(() => null), // chosen option index or null
    marked: questions.map(() => false),
    visited: questions.map((_, i) => i === 0),
    spent: questions.map(() => 0), // ms on each question
    current: 0,
    section: 0,
    startedAt: now,
    // One clock for the whole mock, or one per section (IBPS PO).
    deadline: now + (sectional ? sections[0].ms : totalMs),
    enteredAt: now,
    day: istDay(now),
    status: 'playing',
  };
}

export const sectionOf = (mock, index) => (index < mock.sections[1].from ? 0 : 1);

/** Time on the current question is added up whenever the player moves away from it. */
function leave(mock, now) {
  mock.spent[mock.current] += Math.max(0, now - mock.enteredAt);
  mock.enteredAt = now;
}

/** Go to a question. In sectional mocks, a finished section cannot be reopened. */
export function goTo(mock, index, now = Date.now()) {
  if (index < 0 || index >= mock.questions.length || mock.status !== 'playing') return false;
  if (mock.sectional && sectionOf(mock, index) !== mock.section) return false;
  leave(mock, now);
  mock.current = index;
  mock.visited[index] = true;
  return true;
}

export function choose(mock, choice) {
  if (mock.status !== 'playing') return;
  mock.answers[mock.current] = choice;
}

export const clearChoice = (mock) => { if (mock.status === 'playing') mock.answers[mock.current] = null; };
export const toggleMark = (mock) => { if (mock.status === 'playing') mock.marked[mock.current] = !mock.marked[mock.current]; };

/** The next question in the same section, wrapping round; null at the end of a sectional section. */
export function nextIndex(mock) {
  const sec = mock.sections[mock.section];
  if (mock.current + 1 < (mock.sectional ? sec.to : mock.questions.length)) return mock.current + 1;
  return mock.sectional ? null : 0;
}

/** Sectional mocks: when a section's clock ends (or the player moves on), the next section starts. */
export function nextSection(mock, now = Date.now()) {
  if (!mock.sectional || mock.section >= mock.sections.length - 1) return false;
  leave(mock, now);
  mock.section += 1;
  const sec = mock.sections[mock.section];
  mock.current = sec.from;
  mock.visited[sec.from] = true;
  mock.deadline = now + sec.ms;
  mock.enteredAt = now;
  return true;
}

/** Counts for the submit dialog and the palette. */
export function counts(mock, from = 0, to = mock.questions.length) {
  let answered = 0; let marked = 0; let notVisited = 0;
  for (let i = from; i < to; i++) {
    if (mock.answers[i] !== null) answered++;
    if (mock.marked[i]) marked++;
    if (!mock.visited[i]) notVisited++;
  }
  return { answered, marked, notVisited, notAnswered: to - from - answered };
}

/** Ends the mock and works out the result in the exam's marks. */
export function submitMock(mock, now = Date.now()) {
  if (mock.status !== 'playing') return mock.result;
  leave(mock, now);
  const e = EXAMS[mock.exam];
  let score = 0;
  const bySection = mock.sections.map((s) => ({ name: s.name, score: 0, right: 0, wrong: 0, skipped: 0, ms: 0, max: (s.to - s.from) * e.marks }));
  const lost = {}; // label -> marks lost to wrong answers
  const answers = mock.questions.map((q, i) => {
    const choice = mock.answers[i];
    const correct = choice !== null && choice === q.answerIndex;
    const pts = choice === null ? 0 : correct ? e.marks : -e.negative;
    score = tidy(score + pts);
    const s = bySection[sectionOf(mock, i)];
    s.score = tidy(s.score + pts);
    s.ms += mock.spent[i];
    if (choice === null) s.skipped++; else if (correct) s.right++; else { s.wrong++; lost[q.label] = tidy((lost[q.label] || 0) + e.negative); }
    return { template: q.type, topic: q.topic, label: q.label, choice, correct, points: pts, timeMs: mock.spent[i] };
  });
  const right = answers.filter((a) => a.correct).length;
  const wrong = answers.filter((a) => a.choice !== null && !a.correct).length;
  mock.status = 'finished';
  mock.result = {
    score, max: mock.questions.length * e.marks, right, wrong, skipped: mock.questions.length - right - wrong,
    timeMs: now - mock.startedAt, bySection,
    lost: Object.entries(lost).sort((a, b) => b[1] - a[1]).map(([label, marks]) => ({ label, marks })),
    answers,
  };
  return mock.result;
}

/** The record kept in history (topic accuracy uses it; it never counts for ranks). */
export function mockToHistory(mock) {
  const r = mock.result;
  return {
    id: mock.id, at: Date.now(), day: mock.day, kind: 'mock', seed: mock.seed, topic: 'mixed', level: 'exam', marking: 'exam',
    exam: mock.exam, rival: null, status: 'finished', score: r.score, rivalScore: null, verdict: null, counted: false,
    right: r.right, wrong: r.wrong, skipped: r.skipped, timeMs: r.timeMs, answers: r.answers,
  };
}
