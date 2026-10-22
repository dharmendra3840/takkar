// Duel rules. Prototype: runs on the phone. MVP: the same rules run on the server.
import { generateDuel, orderForPlayer } from './engine/index.js?v=91402d5159';
import { EXAMS } from './exams.js?v=91402d5159';
import { createRng, hashString, randomSeed } from './engine/rng.js?v=91402d5159';
import { istDay } from './time.js?v=91402d5159';

// DUEL-02: seconds per question by level, for duels made before exams (old challenge codes).
// With an exam, the time per question is the exam's (exams.js).
export const TIME_LIMITS = { easy: 20, exam: 30, hard: 35 };

/** Marks for a right answer and the penalty for a wrong one: the exam's, or +4 / −1 before exams. */
export function scoring(examId) {
  const exam = EXAMS[examId];
  return exam ? { marks: exam.marks, negative: exam.negative } : { marks: 4, negative: 1 };
}

/** Scores are kept in twelfths so −0.25, −⅓ and −0.5 add up exactly. */
export const tidy = (n) => Math.round(n * 12) / 12;

export const RIVALS = {
  relaxed: { label: 'Relaxed', accuracy: 0.55, pace: [0.5, 0.95] },
  steady: { label: 'Steady', accuracy: 0.7, pace: [0.35, 0.8] },
  sharp: { label: 'Sharp', accuracy: 0.85, pace: [0.2, 0.6] },
};

export const LEVEL_LABELS = { easy: 'Easier', exam: 'Exam level', hard: 'Harder' };
export const TOPIC_LABELS = { quant: 'Quant', reasoning: 'Reasoning', mixed: 'Mixed' };
export const MARKING_LABELS = { exam: 'Exam marking', speed: 'Speed duel' };

/** SCORE-01 and SCORE-02. examId picks the exam's marking (+2 / −0.5, +1 / −0.25, +1 / −⅓). */
export function points(marking, correct, skipped, timeLeftMs, limitMs, examId = null) {
  if (marking === 'exam') {
    const { marks, negative } = scoring(examId);
    return skipped ? 0 : correct ? marks : -negative;
  }
  if (!correct) return 0;
  // 1 to 5 bonus points: a full 5 for answering in the first fifth of the time.
  return 10 + Math.ceil((5 * Math.max(0, timeLeftMs)) / limitMs);
}

export const maxScore = (marking, examId = null, questions = 10) => (marking === 'exam' ? scoring(examId).marks * questions : 15 * questions);

/**
 * kind: 'solo' | 'rematch' | 'challenge' | 'league' | 'practice'
 * exam: an exams.js id (marking, time, question mix); null for duels from before exams.
 * playerKey: personalises option order (QGEN-05).
 * questions: a ready list (topic practice) instead of generating a duel.
 */
export function createDuel({ kind = 'solo', seed = randomSeed(), topic, level, marking, rival = 'steady', playerKey, challenge = null, league = null, paused = [], exam = null, questions: given = null, practiceTopic = null }) {
  const examInfo = EXAMS[exam] || null;
  const limitMs = (examInfo ? examInfo.seconds : TIME_LIMITS[level]) * 1000;
  const raw = given || generateDuel(seed, topic, level, paused, examInfo ? examInfo.weights : null);
  const questions = raw.map((q, i) => orderForPlayer(q, playerKey, i));

  // The bot's choices are fixed up front from the seed, so a rematch replays them.
  let bot = null;
  if (kind !== 'challenge' && kind !== 'practice') {
    const profile = RIVALS[rival] || RIVALS.steady;
    const rng = createRng(hashString(`bot:${seed}:${rival}`));
    bot = questions.map((q) => {
      const accuracy = profile.accuracy - (q.tier === 3 ? 0.1 : 0);
      const timeMs = Math.round(limitMs * (profile.pace[0] + rng.next() * (profile.pace[1] - profile.pace[0])));
      if (rng.chance(accuracy)) return { choice: q.answerIndex, timeMs };
      if (marking === 'exam' && rng.chance(0.4)) return { choice: null, timeMs };
      const wrong = [0, 1, 2, 3].filter((i) => i !== q.answerIndex);
      return { choice: rng.pick(wrong), timeMs };
    });
  }

  return {
    id: `${Date.now().toString(36)}-${seed.toString(36)}`,
    kind, seed, topic, level, marking, rival, challenge, league, practiceTopic,
    exam: examInfo ? examInfo.id : null,
    day: istDay(),
    limitMs,
    questions,
    bot,
    index: 0,
    answers: [],
    you: 0,
    them: 0,
    status: 'playing',
    questionStartedAt: null,
  };
}

export function startQuestion(duel, now = Date.now()) {
  duel.questionStartedAt = now;
}

/** choice: option index, or null for skip / time up. Returns the answer record. */
export function answerQuestion(duel, choice, now = Date.now()) {
  const q = duel.questions[duel.index];
  const elapsed = Math.min(duel.limitMs, now - duel.questionStartedAt);
  const timedOut = choice === 'timeout';
  const picked = timedOut ? null : choice;
  const skipped = picked === null;
  const correct = !skipped && picked === q.answerIndex;
  const gained = points(duel.marking, correct, skipped, duel.limitMs - elapsed, duel.limitMs, duel.exam);

  let botMove = null;
  if (duel.bot) {
    const b = duel.bot[duel.index];
    const botCorrect = b.choice === q.answerIndex;
    botMove = {
      ...b,
      correct: botCorrect,
      points: points(duel.marking, botCorrect, b.choice === null, duel.limitMs - b.timeMs, duel.limitMs, duel.exam),
    };
    duel.them = tidy(duel.them + botMove.points);
  }
  duel.you = tidy(duel.you + gained);

  const record = {
    index: duel.index,
    topic: q.topic,
    label: q.label,
    type: q.type,
    choice: picked,
    timedOut,
    correct,
    points: gained,
    timeMs: elapsed,
    bot: botMove,
  };
  duel.answers.push(record);
  return record;
}

export function nextQuestion(duel) {
  duel.index += 1;
  if (duel.index >= duel.questions.length) duel.status = 'finished';
}

/** DUEL-05: leaving counts the rest as skipped and marks the duel abandoned. */
export function abandonDuel(duel) {
  duel.status = 'abandoned';
}

export function totals(duel) {
  const right = duel.answers.filter((a) => a.correct).length;
  const answered = duel.answers.filter((a) => a.choice !== null).length;
  const timeMs = duel.answers.reduce((s, a) => s + a.timeMs, 0);
  const botTime = duel.bot ? duel.bot.slice(0, duel.answers.length).reduce((s, b) => s + b.timeMs, 0) : 0;
  return { right, wrong: answered - right, skipped: duel.questions.length - answered, timeMs, botTime };
}

/** 'won' | 'lost' | 'tied'. SCORE-04: ties go to the lower total answer time. */
export function verdict(duel) {
  if (duel.kind === 'practice') return null;
  const target = duel.kind === 'challenge' ? duel.challenge.score : duel.them;
  if (duel.you > target) return 'won';
  if (duel.you < target) return 'lost';
  if (duel.kind === 'challenge') return 'tied';
  const t = totals(duel);
  if (t.timeMs < t.botTime) return 'won';
  if (t.timeMs > t.botTime) return 'lost';
  return 'tied';
}

/** History record kept on the phone. DUEL-09: rematches never count. */
export function toHistory(duel, { firstLeagueAttempt = true } = {}) {
  const t = totals(duel);
  const counted = duel.status === 'finished' && (duel.kind === 'solo' || (duel.kind === 'league' && firstLeagueAttempt));
  return {
    id: duel.id,
    at: Date.now(),
    day: duel.day,
    kind: duel.kind,
    seed: duel.seed,
    topic: duel.topic,
    level: duel.level,
    marking: duel.marking,
    exam: duel.exam,
    rival: duel.rival,
    status: duel.status,
    score: duel.you,
    rivalScore: duel.kind === 'challenge' ? duel.challenge.score : duel.them,
    verdict: duel.status === 'finished' ? verdict(duel) : null,
    counted,
    leagueCode: duel.league?.code || null,
    right: t.right,
    wrong: t.wrong,
    skipped: t.skipped,
    timeMs: t.timeMs,
    answers: duel.answers.map((a) => ({ template: a.type, topic: a.topic, label: a.label, choice: a.choice, correct: a.correct, points: a.points, timeMs: a.timeMs })),
  };
}
