// Hindi questions (design/01-exam-patterns.md §1.5): every type, every level, many seeds.
// Each Hindi question must line up with its English one: four different options, the answer in the
// same place (also after each player's own option order), the same numbers in each option, an
// "उत्तर" line, a Hindi topic name, and no English words left over (capital letters are fine:
// coding, series and inequality questions use them in the Hindi papers too).
import { TEMPLATES, generateQuestion, orderForPlayer } from '../www/js/engine/index.js';
import { createRng } from '../www/js/engine/rng.js';

const SEEDS = 3000;
const problems = [];
const fail = (t, tier, seed, what) => { if (problems.length < 30) problems.push(`${t.id} tier ${tier} seed ${seed}: ${what}`); };
const numbers = (s) => (String(s).match(/\d+(?:[.,]\d+)*/g) || []).join(' ');
// Lowercase English words; single letters (x, y, u, k) are maths variables.
const english = (s) => (String(s).match(/\b[a-z]{2,}\b/g) || []).filter((w) => w !== 'of'); // "का" (of) is explained once
let checked = 0;

for (const t of TEMPLATES) {
  for (const tier of t.tiers) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const q = generateQuestion(t, createRng(seed * 2654435761 + tier), tier);
      checked++;
      const h = q.hi;
      if (!h) { fail(t, tier, seed, 'no Hindi'); continue; }
      if (!h.text || typeof h.text !== 'string') fail(t, tier, seed, 'no Hindi text');
      if (!/[ऀ-ॿ]/.test(h.text) && !/^[A-Z]{2} : /.test(h.text) && !/^\d/.test(h.text)) fail(t, tier, seed, `text has no Hindi: ${h.text}`);
      if (!/[ऀ-ॿ]/.test(h.label || '')) fail(t, tier, seed, `label not in Hindi: ${h.label}`);
      if (h.options.length !== 4 || new Set(h.options).size !== 4 || h.options.some((o) => !o)) fail(t, tier, seed, `options: ${h.options.join(' | ')}`);
      if (h.options[q.answerIndex] !== h.answerText) fail(t, tier, seed, 'answer not in the same place');
      if (h.steps[h.steps.length - 1] !== `उत्तर: ${h.answerText}`) fail(t, tier, seed, 'no उत्तर line');
      if (h.steps.length !== q.steps.length) fail(t, tier, seed, `steps ${h.steps.length} vs ${q.steps.length}`);
      q.options.forEach((o, i) => { if (numbers(o) !== numbers(h.options[i])) fail(t, tier, seed, `option ${i}: ${o} vs ${h.options[i]}`); });
      const left = [h.text, ...h.options, ...h.steps].flatMap(english);
      if (left.length) fail(t, tier, seed, `English words: ${[...new Set(left)].join(', ')}`);
      const mine = orderForPlayer(q, `usr_${seed}`, seed % 10);
      if (mine.hi.options[mine.answerIndex] !== h.answerText) fail(t, tier, seed, 'player order moved the Hindi answer');
      mine.options.forEach((o, i) => { if (numbers(o) !== numbers(mine.hi.options[i])) fail(t, tier, seed, 'player order split the languages'); });
    }
  }
}

if (problems.length) {
  console.error(`Hindi questions: ${problems.length}${problems.length >= 30 ? '+' : ''} problems\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Hindi questions: ${checked.toLocaleString('en-IN')} checked across ${TEMPLATES.length} types, all line up with the English.`);
