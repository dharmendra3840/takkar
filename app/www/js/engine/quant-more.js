// Quant types added in question set 2 (Phase 1, design/01-exam-patterns.md §1.4): BODMAS,
// number system, fractions and approximation. Built like quant.js: every answer is
// computed here, and tests/engine.test.mjs recomputes it from the question text.
import { makeQuestion, gcd } from './build.js';

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n) => [...String(n)].map((d) => SUP[d]).join('');
const MINUS = '−';
const m = (n) => (n < 0 ? `${MINUS}${-n}` : String(n)); // a proper minus sign

export const MORE_QUANT = [
  {
    id: 'bodmas',
    label: 'BODMAS',
    since: 2,
    tiers: [1, 2, 3],
    make(rng, tier) {
      let text; let answer; let wrong; let steps;
      if (tier === 1) {
        // a + b × c − d: multiplication before addition and subtraction.
        const a = rng.int(10, 60); const b = rng.int(2, 12); const c = rng.int(2, 12); const d = rng.int(1, a);
        answer = a + b * c - d;
        text = `Simplify: ${a} + ${b} × ${c} ${MINUS} ${d}`;
        wrong = [(a + b) * c - d, a + b * c + d, a + b * (c - d), answer + 10];
        steps = [`Multiply first: ${b} × ${c} = ${b * c}`, `${a} + ${b * c} ${MINUS} ${d} = ${answer}`];
      } else if (tier === 2) {
        // (a + b) × c ÷ d, with c a multiple of d so every step is a whole number.
        const a = rng.int(5, 40); const b = rng.int(5, 40); const d = rng.int(2, 9); const k = rng.int(2, 6); const c = d * k;
        answer = (a + b) * k;
        text = `Simplify: (${a} + ${b}) × ${c} ÷ ${d}`;
        wrong = [a + b * k, (a + b) * c - d, (a + b) * c, answer + k];
        steps = [`Brackets first: ${a} + ${b} = ${a + b}`, `Then left to right: ${a + b} × ${c} = ${(a + b) * c}, and ÷ ${d} = ${answer}`];
      } else {
        // x ÷ y of z + e − f: "of" is worked before division, so x ÷ (y × z).
        const y = rng.int(2, 6); const z = rng.int(2, 6); const m = rng.int(2, 9); const x = y * z * m;
        const e = rng.int(5, 30); const f = rng.int(1, e);
        answer = m + e - f;
        text = `Simplify: ${x} ÷ ${y} of ${z} + ${e} ${MINUS} ${f}`;
        wrong = [(x / y) * z + e - f, m + e + f, m * e - f, answer + 2];
        steps = [`"Of" comes before division: ${y} of ${z} = ${y} × ${z} = ${y * z}`, `${x} ÷ ${y * z} = ${m}`, `${m} + ${e} ${MINUS} ${f} = ${answer}`];
      }
      return makeQuestion(rng, { type: this.id, topic: 'quant', text, answer, wrong, steps });
    },
  },
  {
    id: 'unit-digit',
    label: 'Number system',
    since: 2,
    tiers: [2, 3],
    make(rng, tier) {
      let a = rng.int(12, tier === 2 ? 49 : 99);
      if (a % 10 === 0 || a % 10 === 1 || a % 10 === 5 || a % 10 === 6) a += 2; // keep the interesting cycles
      const n = rng.int(tier === 2 ? 11 : 31, tier === 2 ? 60 : 199);
      const u = a % 10;
      const cycle = [u, (u * u) % 10, (u * u * u) % 10, (u * u * u * u) % 10];
      const r = n % 4;
      const answer = cycle[(r + 3) % 4]; // remainder 1 → 1st in the cycle, 0 → 4th
      const others = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== answer);
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `What is the unit digit of ${a}${sup(n)}?`,
        answer,
        wrong: [u, ...cycle, (u * n) % 10, ...rng.shuffle(others)].filter((d) => d !== answer && d > 0),
        steps: [
          `Only the unit digit matters: ${u}`,
          `Powers of ${u} end in ${cycle.join(', ')}, and repeat every 4`,
          `${n} ÷ 4 leaves ${r}, so take the ${['4th', '1st', '2nd', '3rd'][r]} one: ${answer}`,
        ],
      });
    },
  },
  {
    id: 'divisible-add',
    label: 'Number system',
    since: 2,
    tiers: [1, 2],
    make(rng, tier) {
      const d = rng.pick(tier === 1 ? [7, 8, 9, 11, 12] : [13, 17, 19, 23, 27]);
      let n = rng.int(tier === 1 ? 150 : 1200, tier === 1 ? 999 : 9999);
      if (n % d === 0) n += 1;
      const r = n % d;
      const answer = d - r;
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `What is the smallest number that must be added to ${n} to make it divisible by ${d}?`,
        answer,
        wrong: [r, answer + 1, answer - 1, d, answer + d],
        steps: [`${n} ÷ ${d} = ${Math.floor(n / d)}, remainder ${r}`, `Add ${d} ${MINUS} ${r} = ${answer} to reach ${n + answer} = ${d} × ${(n + answer) / d}`],
      });
    },
  },
  {
    id: 'fraction-compare',
    label: 'Fractions',
    since: 2,
    tiers: [1, 2],
    make(rng, tier) {
      // Four fractions in lowest terms with different values; ask for the largest (or smallest).
      const fracs = [];
      while (fracs.length < 4) {
        const b = rng.int(3, 15); const a = rng.int(1, b - 1);
        if (gcd(a, b) !== 1) continue;
        if (fracs.some(([p, q]) => p * b === a * q)) continue;
        fracs.push([a, b]);
      }
      const largest = tier === 1;
      const sorted = [...fracs].sort(([p, q], [r, s]) => (largest ? r * q - p * s : p * s - r * q));
      const fmt = ([p, q]) => `${p}/${q}`;
      const answer = fmt(sorted[0]);
      const dec = ([p, q]) => (p / q).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `Which of these fractions is the ${largest ? 'largest' : 'smallest'}?`,
        answer,
        wrong: sorted.slice(1).map(fmt),
        steps: [`As decimals: ${fracs.map((f) => `${fmt(f)} ≈ ${dec(f)}`).join(', ')}`, `The ${largest ? 'largest' : 'smallest'} is ${answer}`],
      });
    },
  },
  {
    id: 'approximation',
    label: 'Approximation',
    since: 2,
    tiers: [1, 2],
    make(rng, tier) {
      // Numbers just off whole numbers; the answer uses the whole numbers, and the options are
      // far enough apart that the exact value is always nearest the right one.
      const near = (n) => {
        const delta = rng.int(1, 9) / 100 * (rng.chance(0.5) ? 1 : -1);
        return { show: (n + delta).toFixed(2), exact: n + delta };
      };
      const A = rng.int(12, 49); const B = rng.int(11, 29); const D = rng.int(5, 15); const k = rng.int(8, 30);
      const plus = tier === 1 || rng.chance(0.5);
      const a = near(A); const b = near(B); const c = near(D * k); const d = near(D);
      const answer = A * B + (plus ? k : -k);
      const exact = a.exact * b.exact + (plus ? 1 : -1) * (c.exact / d.exact);
      const off = Math.abs(exact - answer);
      const step = Math.max(20, Math.ceil((answer * 0.08) / 10) * 10, Math.ceil((off * 4) / 10) * 10);
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `What is the approximate value of ${a.show} × ${b.show} ${plus ? '+' : MINUS} ${c.show} ÷ ${d.show}?`,
        answer,
        wrong: [answer + step, answer - step, answer + 2 * step, answer - 2 * step],
        nudge: step,
        steps: [
          `Round each number: ${A} × ${B} ${plus ? '+' : MINUS} ${D * k} ÷ ${D}`,
          `${A} × ${B} = ${A * B}, and ${D * k} ÷ ${D} = ${k}`,
          `${A * B} ${plus ? '+' : MINUS} ${k} = ${answer}`,
        ],
      });
    },
  },
  {
    id: 'quadratic',
    label: 'Quadratic equations',
    since: 2,
    tiers: [1, 2, 3],
    make(rng, tier) {
      const root = () => (tier === 1 ? rng.int(1, 9) : rng.int(1, 9) * (rng.chance(0.4) ? -1 : 1));
      const two = () => { const p = root(); let q = root(); while (q === p) q = root(); return [p, q]; };
      const [x1, x2] = two(); const [y1, y2] = two();
      const eq = (v, [p, q]) => {
        const s = p + q; const c = p * q;
        const mid = s === 0 ? '' : ` ${s > 0 ? MINUS : '+'} ${Math.abs(s) === 1 ? '' : Math.abs(s)}${v}`;
        return `${v}² ${mid.trim() ? mid.trim() + ' ' : ''}${c > 0 ? '+' : MINUS} ${Math.abs(c)} = 0`;
      };
      const factor = (v, [p, q]) => [p, q].map((r) => `(${v} ${r > 0 ? MINUS : '+'} ${Math.abs(r)})`).join('');
      const xs = [x1, x2]; const ys = [y1, y2];
      const all = (f) => xs.every((x) => ys.every((y) => f(x, y)));
      const LABELS = ['x > y', 'x ≥ y', 'x < y', 'x ≤ y', 'x = y or no relation can be established'];
      const answer = all((x, y) => x > y) ? LABELS[0] : all((x, y) => x >= y) ? LABELS[1]
        : all((x, y) => x < y) ? LABELS[2] : all((x, y) => x <= y) ? LABELS[3] : LABELS[4];
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `I. ${eq('x', xs)}
II. ${eq('y', ys)}
How are x and y related?`,
        answer,
        wrong: LABELS.filter((l) => l !== answer),
        steps: [
          `I: ${factor('x', xs)} = 0, so x = ${m(x1)} or ${m(x2)}`,
          `II: ${factor('y', ys)} = 0, so y = ${m(y1)} or ${m(y2)}`,
          `Compare every x with every y: ${xs.flatMap((x) => ys.map((y) => `${m(x)} ${x > y ? '>' : x < y ? '<' : '='} ${m(y)}`)).join(', ')}`,
        ],
      });
    },
  },
];
