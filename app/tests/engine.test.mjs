// Engine release test (QGEN-03): 100,000 generated questions per level, each
// checked for exactly 4 different options, one correct answer and a solution
// that ends on that answer. Run: npm test
import { generateDuel, generateQuestion, TEMPLATES, LEVEL_TIERS, orderForPlayer } from '../www/js/engine/index.js';
import { createRng } from '../www/js/engine/rng.js';

const PER_LEVEL = Number(process.env.PER_LEVEL || 100000);
let failures = 0;
const fail = (msg) => {
  failures++;
  if (failures <= 20) console.error('FAIL', msg);
};

function check(q, where) {
  if (!q.text || q.text.includes('undefined') || q.text.includes('NaN')) fail(`${where}: bad text "${q.text}"`);
  if (!Array.isArray(q.options) || q.options.length !== 4) return fail(`${where}: ${q.options?.length} options`);
  if (new Set(q.options).size !== 4) fail(`${where}: repeated options ${q.options.join(' | ')}`);
  for (const o of q.options) {
    if (o.includes('undefined') || o.includes('NaN') || o.includes('Infinity')) fail(`${where}: bad option "${o}"`);
    if (/\d\.\d{3,}/.test(o)) fail(`${where}: long decimal option "${o}" in ${q.text}`);
  }
  if (q.options[q.answerIndex] !== q.answerText) fail(`${where}: answerIndex does not point at the answer`);
  const last = q.steps[q.steps.length - 1];
  if (!last.endsWith(q.answerText)) fail(`${where}: solution does not end on the answer`);
  if (/\d\.\d{3,}/.test(q.answerText)) fail(`${where}: answer has a long decimal "${q.answerText}" in ${q.text}`);
}

// Independent recalculation for multi-step types: re-derive the answer from
// the numbers in the question text, without using the template code.
const RECHECK = {
  'work-together': (q) => {
    const [a, b] = q.text.match(/\d+/g).map(Number);
    return `${a * b / (a + b)} days`;
  },
  'row-position': (q) => {
    const [l, r] = q.text.match(/\d+/g).map(Number);
    return String(l + r - 1);
  },
  'simple-interest': (q) => {
    const [p, r, t] = q.text.replace(/,/g, '').match(/\d+/g).map(Number);
    return '₹' + (p * r * t / 100).toLocaleString('en-IN');
  },
  'calendar': (q) => {
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const start = DAYS.findIndex((d) => q.text.startsWith(`Today is ${d}`));
    const n = Number(q.text.match(/after (\d+) days/)[1]);
    return DAYS[(start + n) % 7];
  },
};

const counts = {};
for (const level of Object.keys(LEVEL_TIERS)) {
  const rng = createRng(level.length * 7919);
  const tiers = LEVEL_TIERS[level];
  const usable = TEMPLATES.filter((t) => t.tiers.some((x) => tiers.includes(x)));
  for (let i = 0; i < PER_LEVEL; i++) {
    const template = usable[i % usable.length];
    const tier = rng.pick(template.tiers.filter((x) => tiers.includes(x)));
    let q;
    try {
      q = generateQuestion(template, rng, tier);
    } catch (e) {
      fail(`${level}/${template.id}: threw ${e.message}`);
      continue;
    }
    if (!tiers.includes(q.tier)) fail(`${level}/${template.id}: served tier ${q.tier}`);
    check(q, `${level}/${template.id}`);
    const recheck = RECHECK[template.id];
    if (recheck && recheck(q) !== q.answerText) fail(`${template.id}: recheck ${recheck(q)} vs ${q.answerText} for "${q.text}"`);
    counts[template.id] = (counts[template.id] || 0) + 1;
  }
}

// Same seed, same duel (challenge codes depend on this).
for (const topic of ['quant', 'reasoning', 'mixed']) {
  for (const level of ['easy', 'exam', 'hard']) {
    const a = generateDuel(12345, topic, level);
    const b = generateDuel(12345, topic, level);
    if (JSON.stringify(a) !== JSON.stringify(b)) fail(`generateDuel not deterministic for ${topic}/${level}`);
    if (a.length !== 10) fail(`duel length ${a.length}`);
    a.forEach((q, i) => check(q, `duel ${topic}/${level} #${i}`));
  }
}

// Per-player order keeps the same answer but usually moves it.
let moved = 0;
for (let i = 0; i < 200; i++) {
  const q = generateDuel(i, 'mixed', 'exam')[0];
  const a = orderForPlayer(q, 'riya', 0);
  const b = orderForPlayer(q, 'rohit', 0);
  if (a.options[a.answerIndex] !== q.answerText || b.options[b.answerIndex] !== q.answerText) fail('orderForPlayer lost the answer');
  if (a.options.join() !== b.options.join()) moved++;
}
if (moved < 150) fail(`per-player shuffle too weak: ${moved}/200 differ`);

const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`Templates: ${TEMPLATES.length}. Questions checked: ${total.toLocaleString('en-IN')} (${PER_LEVEL.toLocaleString('en-IN')} per level).`);
if (failures) {
  console.error(`${failures} failures`);
  process.exit(1);
}
console.log('Engine release test passed: 0 defects.');
