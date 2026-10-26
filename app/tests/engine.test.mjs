// Engine release test (QGEN-03): 100,000 generated questions per level, each
// checked for exactly 4 different options, one correct answer and a solution
// that ends on that answer. Run: npm test
import { generateDuel, generateQuestion, TEMPLATES, LEVEL_TIERS, orderForPlayer } from '../www/js/engine/index.js';
import { createRng } from '../www/js/engine/rng.js';
import { syllogismWorlds, syllogismTrue } from '../www/js/engine/reasoning-more.js';

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
  // ---- Question set 2 ----
  bodmas: (q) => {
    // "y of z" is multiplication done first; then normal precedence.
    const expr = q.text.replace('Simplify: ', '').replace(/(\d+) of (\d+)/, '($1*$2)').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    return String(Function(`return (${expr})`)());
  },
  'unit-digit': (q) => {
    const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    const [, a, s] = q.text.match(/unit digit of (\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/);
    const n = [...s].map((c) => SUP.indexOf(c)).join('');
    return String(BigInt(a) ** BigInt(n) % 10n);
  },
  'divisible-add': (q) => {
    const [n, d] = q.text.match(/\d+/g).map(Number);
    return String((d - (n % d)) % d);
  },
  'fraction-compare': (q) => {
    const val = (o) => { const [a, b] = o.split('/').map(Number); return a / b; };
    const sorted = [...q.options].sort((x, y) => val(x) - val(y));
    return q.text.includes('largest') ? sorted[3] : sorted[0];
  },
  approximation: (q) => {
    const [a, b, c, d] = q.text.match(/\d+\.\d+/g).map(Number);
    const exact = a * b + (q.text.includes(' + ') ? 1 : -1) * (c / d);
    const dist = q.options.map((o) => Math.abs(Number(o) - exact)).sort((x, y) => x - y);
    if (dist[1] - dist[0] < 5) return 'too close to call';
    return q.options.reduce((best, o) => (Math.abs(Number(o) - exact) < Math.abs(Number(best) - exact) ? o : best));
  },
  quadratic: (q) => {
    const roots = (v) => {
      const m = q.text.replace(/\s/g, '').match(new RegExp(`${v}²(?:([+−])(\\d*)${v})?([+−])(\\d+)=0`));
      const b = m[1] ? (m[1] === '−' ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2])) : 0;
      const c = (m[3] === '−' ? -1 : 1) * Number(m[4]);
      const disc = Math.sqrt(b * b - 4 * c);
      return [(-b + disc) / 2, (-b - disc) / 2];
    };
    const xs = roots('x'); const ys = roots('y');
    const all = (f) => xs.every((x) => ys.every((y) => f(x, y)));
    return all((x, y) => x > y) ? 'x > y' : all((x, y) => x >= y) ? 'x ≥ y' : all((x, y) => x < y) ? 'x < y'
      : all((x, y) => x <= y) ? 'x ≤ y' : 'x = y or no relation can be established';
  },
  // Brute force: every way to give the letters values that fits the statement.
  inequality: (q) => {
    const OPS = { '>': (a, b) => a > b, '≥': (a, b) => a >= b, '=': (a, b) => a === b, '<': (a, b) => a < b, '≤': (a, b) => a <= b };
    let text = q.text;
    const key = {};
    for (const [, sym, op] of (text.match(/Codes: (.*)\n/)?.[1] || '').matchAll(/(\S) means (\S)/g)) key[sym] = op;
    const decode = (s) => s.replace(/(?<=\s)(\S)(?=\s)/g, (m, sym) => key[sym] || sym);
    const statement = decode(` ${text.match(/Statement: (.*)\n/)[1]} `).trim();
    const rels = Object.keys(key).length
      ? statement.split(', ').map((p) => p.split(' '))
      : (() => { const t = statement.split(' '); const out = []; for (let i = 0; i + 2 < t.length; i += 2) out.push([t[i], t[i + 1], t[i + 2]]); return out; })();
    const [, i1, i2] = text.match(/\nI\. (.*)\nII\. (.*)$/);
    const c1 = decode(` ${i1} `).trim().split(' '); const c2 = decode(` ${i2} `).trim().split(' ');
    const letters = [...new Set(rels.flatMap(([a, , b]) => [a, b]))];
    const cases = [];
    const vals = {};
    const walk = (k) => {
      if (k === letters.length) {
        if (rels.every(([a, op, b]) => OPS[op](vals[a], vals[b]))) cases.push([OPS[c1[1]](vals[c1[0]], vals[c1[2]]), OPS[c2[1]](vals[c2[0]], vals[c2[2]])]);
        return;
      }
      for (let v = 0; v < letters.length; v++) { vals[letters[k]] = v; walk(k + 1); }
    };
    walk(0);
    const one = cases.every((c) => c[0]); const two = cases.every((c) => c[1]);
    const samePair = [c1[0], c1[2]].sort().join() === [c2[0], c2[2]].sort().join();
    if (one && two) return 'Both I and II follow';
    if (one) return 'Only I follows';
    if (two) return 'Only II follows';
    if (samePair && cases.every((c) => c[0] !== c[1])) return 'Either I or II follows';
    return 'Neither I nor II follows';
  },
  'letter-analogy': (q) => {
    const [a, b, c] = q.text.match(/[A-Z]{2}/g);
    const k = b.charCodeAt(0) - a.charCodeAt(0);
    return [...c].map((ch) => String.fromCharCode(ch.charCodeAt(0) + k)).join('');
  },
  'letter-classify': (q) => {
    const gaps = (o) => [o.charCodeAt(1) - o.charCodeAt(0), o.charCodeAt(2) - o.charCodeAt(1)].join();
    const count = {};
    for (const o of q.options) count[gaps(o)] = (count[gaps(o)] || 0) + 1;
    return q.options.find((o) => count[gaps(o)] === 1);
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

// Syllogisms: textbook cases, worked by hand.
{
  const A = 0, B = 1, C = 2;
  const follows = (st, con) => syllogismWorlds(st).every((w) => syllogismTrue(...con, w));
  const either = (st, c1, c2) => syllogismWorlds(st).every((w) => syllogismTrue(...c1, w) !== syllogismTrue(...c2, w));
  const cases = [
    [follows([['all', A, B], ['all', B, C]], ['all', A, C]), 'All A are B, all B are C: all A are C'],
    [follows([['all', A, B], ['all', B, C]], ['some', C, A]), 'All A are B, all B are C: some C are A'],
    [!follows([['some', A, B], ['some', B, C]], ['some', A, C]), 'Some A are B, some B are C: some A are C does not follow'],
    [follows([['all', A, B], ['no', B, C]], ['no', A, C]), 'All A are B, no B is C: no A is C'],
    [follows([['some', A, B], ['no', B, C]], ['somenot', A, C]), 'Some A are B, no B is C: some A are not C'],
    [either([['no', A, B], ['no', B, C]], ['some', A, C], ['no', A, C]), 'No A is B, no B is C: either some A are C or no A is C'],
    [!follows([['all', A, B], ['some', B, C]], ['some', A, C]), 'All A are B, some B are C: some A are C does not follow'],
  ];
  for (const [ok, name] of cases) if (!ok) fail(`syllogism rule: ${name}`);
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
