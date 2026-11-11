// Question engine entry point. generateDuel(seed, topic, level) always returns
// the same ten questions for the same inputs.
import { createRng, hashString } from './rng.js?v=f6b54a8ed7';
import { QUANT } from './quant.js?v=f6b54a8ed7';
import { REASONING } from './reasoning.js?v=f6b54a8ed7';

export const TEMPLATES = [...QUANT, ...REASONING];

// Question sets. A challenge code records the set it was made with, so it always opens with the
// same questions, even after new types are added. Set 1: the 30 types up to app 0.3. Set 2: 0.4.
// Set 3: app 0.10.0, the bank-exam types (bank.js): seating arrangement, puzzles, data interpretation.
export const CURRENT_SET = 3;
const inSet = (set) => (t) => (t.since || 1) <= set;

// QGEN-04: Easy uses tier 1, Exam tiers 1-2, Hard tiers 2-3.
export const LEVEL_TIERS = { easy: [1], exam: [1, 2], hard: [2, 3] };
export const DUEL_LENGTH = 10;

function poolFor(topic, set) {
  const list = topic === 'quant' ? QUANT : topic === 'reasoning' ? REASONING : TEMPLATES;
  return list.filter(inSet(set));
}

// Topic names in Hindi, as the papers and coaching books use them.
export const LABEL_HI = {
  Percentages: 'प्रतिशत', 'Profit and loss': 'लाभ और हानि', Discount: 'बट्टा (छूट)', 'Simple interest': 'साधारण ब्याज',
  'Compound interest': 'चक्रवृद्धि ब्याज', 'Time and work': 'समय और कार्य', 'Pipes and cisterns': 'पाइप और टंकी',
  'Speed, time and distance': 'चाल, समय और दूरी', Trains: 'रेलगाड़ी', 'Boats and streams': 'नाव और धारा',
  'Ratio and proportion': 'अनुपात और समानुपात', Averages: 'औसत', Ages: 'आयु', Simplification: 'सरलीकरण',
  'LCM and HCF': 'ल.स.प. और म.स.प.', Mixtures: 'मिश्रण', Partnership: 'साझेदारी', BODMAS: 'BODMAS (सरलीकरण)',
  'Number system': 'संख्या पद्धति', Fractions: 'भिन्न', Approximation: 'सन्निकटन', 'Quadratic equations': 'द्विघात समीकरण',
  'Number series': 'संख्या श्रृंखला', 'Letter series': 'अक्षर श्रृंखला', 'Coding and decoding': 'कोडिंग-डिकोडिंग',
  'Direction sense': 'दिशा ज्ञान', 'Odd one out': 'विषम को चुनें', 'Number analogy': 'संख्या सादृश्यता', Ranking: 'क्रम व्यवस्था',
  Clocks: 'घड़ी', Calendar: 'कैलेंडर', 'Alphabet test': 'वर्णमाला परीक्षण', Inequalities: 'असमानता', Syllogism: 'न्याय निगमन',
  'Blood relations': 'रक्त संबंध', 'Word analogy': 'शब्द सादृश्यता', 'Letter analogy': 'अक्षर सादृश्यता', Classification: 'वर्गीकरण',
  'Seating arrangement': 'बैठक व्यवस्था', Puzzles: 'पहेली', 'Data interpretation': 'आँकड़ा निर्वचन (DI)',
};

export function generateQuestion(template, rng, tier) {
  const q = template.make(rng, tier);
  const out = { ...q, tier, label: template.label };
  // Types that take longer to read (puzzles, tables) get a multiple of the usual time in a duel.
  if (template.time) out.time = template.time;
  if (q.hi) out.hi = { ...q.hi, label: LABEL_HI[template.label] || template.label };
  return out;
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

export function generateDuel(seed, topic = 'mixed', level = 'exam', paused = [], weights = null, set = CURRENT_SET) {
  const rng = createRng(seed);
  const allowed = LEVEL_TIERS[level] || LEVEL_TIERS.exam;
  const fits = poolFor(topic, set).filter((t) => t.tiers.some((tier) => allowed.includes(tier)));
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
  // Shuffling positions gives the same order as shuffling the options, and moves the Hindi ones with them.
  const order = rng.shuffle(question.options.map((_, i) => i));
  const options = order.map((i) => question.options[i]);
  const out = { ...question, options, answerIndex: options.indexOf(question.answerText) };
  if (question.hi) out.hi = { ...question.hi, options: order.map((i) => question.hi.options[i]) };
  return out;
}

/** This player's option order as positions in the question's own options: the order orderForPlayer shows them in. */
export function optionOrderForPlayer(question, playerKey, index) {
  const rng = createRng(hashString(`${playerKey}:${index}:${question.text}`));
  return rng.shuffle(question.options.map((_, i) => i));
}

/** Where the right answer sits in this player's option order: orderForPlayer(...).answerIndex without copying the question (marking many attempts). */
export function answerIndexForPlayer(question, playerKey, index) {
  return optionOrderForPlayer(question, playerKey, index).findIndex((i) => question.options[i] === question.answerText);
}
