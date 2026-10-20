// Question engine entry point. generateDuel(seed, topic, level) always returns
// the same ten questions for the same inputs.
import { createRng, hashString } from './rng.js';
import { QUANT } from './quant.js';
import { REASONING } from './reasoning.js';

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

export function generateDuel(seed, topic = 'mixed', level = 'exam') {
  const rng = createRng(seed);
  const allowed = LEVEL_TIERS[level] || LEVEL_TIERS.exam;
  const usable = poolFor(topic).filter((t) => t.tiers.some((tier) => allowed.includes(tier)));

  // Mixed duels alternate quant and reasoning so both get a fair share.
  let order;
  if (topic === 'mixed') {
    const q = rng.shuffle(usable.filter((t) => QUANT.includes(t)));
    const r = rng.shuffle(usable.filter((t) => REASONING.includes(t)));
    order = [];
    for (let i = 0; order.length < DUEL_LENGTH; i++) {
      order.push(i % 2 === 0 ? q[(i / 2) % q.length] : r[((i - 1) / 2) % r.length]);
    }
  } else {
    const shuffled = rng.shuffle(usable);
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
