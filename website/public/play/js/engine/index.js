// Question engine entry point. generateDuel(seed, topic, level) always returns
// the same ten questions for the same inputs.
import { createRng, hashString } from './rng.js?v=8ef6f9fe8e';
import { QUANT } from './quant.js?v=8ef6f9fe8e';
import { REASONING } from './reasoning.js?v=8ef6f9fe8e';

export const TEMPLATES = [...QUANT, ...REASONING];

// QGEN-04: Easy uses tier 1, Exam tiers 1-2, Hard tiers 2-3.
export const LEVEL_TIERS = { easy: [1], exam: [1, 2], hard: [2, 3] };
export const DUEL_LENGTH = 10;

function poolFor(topic) {
  if (topic === 'quant') return QUANT;
  if (topic === 'reasoning') return REASONING;
  return TEMPLATES;
}

export function generateQuestion(template, rng, tier) {
  const q = template.make(rng, tier);
  return { ...q, tier, label: template.label };
}

/**
 * Weighted order without repeats (Efraimidis-Spirakis): each type gets a key
 * u^(1/weight), highest first. Same seed, same order. Weight 1 = normal.
 */
function weightedOrder(rng, list, weights) {
  return list
    .map((t) => ({ t, k: Math.pow(rng.next(), 1 / Math.max(0.05, weights[t.id] ?? 1)) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.t);
}

/** Keeps the types that fit the level and are not paused (unless that leaves too few). */
function usableTemplates(list, allowed, paused, min) {
  const fits = list.filter((t) => t.tiers.some((tier) => allowed.includes(tier)));
  const kept = fits.filter((t) => !paused.includes(t.id));
  return kept.length >= min ? kept : fits;
}

/**
 * A set of questions for an exam: mini mocks (12 quant + 13 reasoning) and topic practice.
 * counts: { quant, reasoning }. only: limit to these template ids (topic practice).
 * Types repeat (with new numbers) when a section asks for more than there are types.
 */
export function generateSet(seed, counts, level = 'exam', { paused = [], weights = {}, only = null } = {}) {
  const rng = createRng(seed);
  const allowed = LEVEL_TIERS[level] || LEVEL_TIERS.exam;
  const pick = (pool, n) => {
    if (!n) return [];
    let list = usableTemplates(only ? pool.filter((t) => only.includes(t.id)) : pool, allowed, paused, 1);
    if (!list.length && only) list = pool.filter((t) => only.includes(t.id)); // a topic with no type at this level: use any level
    if (!list.length) return [];
    const order = weightedOrder(rng, list, weights);
    return Array.from({ length: n }, (_, i) => order[i % order.length]);
  };
  const quant = pick(QUANT, counts.quant || 0);
  const reasoning = pick(REASONING, counts.reasoning || 0);
  return [...quant, ...reasoning].map((template) => {
    let tiers = template.tiers.filter((tier) => allowed.includes(tier));
    if (!tiers.length) tiers = template.tiers;
    return generateQuestion(template, rng, rng.pick(tiers));
  });
}

export function generateDuel(seed, topic = 'mixed', level = 'exam', paused = [], weights = null) {
  const rng = createRng(seed);
  const allowed = LEVEL_TIERS[level] || LEVEL_TIERS.exam;
  const fits = poolFor(topic).filter((t) => t.tiers.some((tier) => allowed.includes(tier)));
  // QGEN-06: question types paused in the admin are left out (unless that would leave none).
  const kept = fits.filter((t) => !paused.includes(t.id));
  const usable = kept.length >= 2 && (topic !== 'mixed' || (kept.some((t) => QUANT.includes(t)) && kept.some((t) => REASONING.includes(t)))) ? kept : fits;

  // Mixed duels alternate quant and reasoning so both get a fair share.
  let order;
  // With an exam's weights, its favourite question types come up more often.
  const arrange = (list) => (weights ? weightedOrder(rng, list, weights) : rng.shuffle(list));
  if (topic === 'mixed') {
    const q = arrange(usable.filter((t) => QUANT.includes(t)));
    const r = arrange(usable.filter((t) => REASONING.includes(t)));
    order = [];
    for (let i = 0; order.length < DUEL_LENGTH; i++) {
      order.push(i % 2 === 0 ? q[(i / 2) % q.length] : r[((i - 1) / 2) % r.length]);
    }
  } else {
    const shuffled = arrange(usable);
    order = Array.from({ length: DUEL_LENGTH }, (_, i) => shuffled[i % shuffled.length]);
  }

  return order.map((template) => {
    const tiers = template.tiers.filter((tier) => allowed.includes(tier));
    return generateQuestion(template, rng, rng.pick(tiers));
  });
}

/**
 * QGEN-05: everyone gets the same questions, but each player sees the options
 * in their own order, so answer letters shared in a group chat are useless.
 */
export function orderForPlayer(question, playerKey, index) {
  const rng = createRng(hashString(`${playerKey}:${index}:${question.text}`));
  const options = rng.shuffle(question.options);
  return { ...question, options, answerIndex: options.indexOf(question.answerText) };
}
