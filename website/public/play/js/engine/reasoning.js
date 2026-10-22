// Reasoning templates, built the same way as quant.js.
import { makeQuestion, NAMES } from './build.js?v=6915aac052';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letter = (i) => ALPHA[((i % 26) + 26) % 26];
const shiftWord = (word, k) => [...word].map((c) => letter(ALPHA.indexOf(c) + k)).join('');
const ordinal = (n) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
};
const WORDS = ['TRAIN', 'MONEY', 'PLANT', 'CLOCK', 'RIVER', 'BOARD', 'SMART', 'LIGHT', 'NOBLE', 'QUICK', 'STORM', 'FAITH', 'CHAIR', 'GRAPE', 'HONEY'];

export const REASONING = [
  {
    id: 'number-series',
    label: 'Number series',
    tiers: [1, 2, 3],
    make(rng, tier) {
      let seq; let rule;
      if (tier === 1) {
        const a = rng.int(2, 30); const d = rng.int(3, 12);
        seq = Array.from({ length: 6 }, (_, i) => a + d * i);
        rule = `Each term adds ${d}`;
      } else if (tier === 2) {
        const a = rng.int(2, 6); const r = rng.pick([2, 3]);
        const add = rng.int(1, 4);
        seq = [a];
        for (let i = 1; i < 6; i++) seq.push(seq[i - 1] * r + add);
        rule = `Each term is the previous × ${r} + ${add}`;
      } else {
        const a = rng.int(3, 20); const d0 = rng.int(1, 5); const dd = rng.int(2, 4);
        seq = [a];
        for (let i = 1; i < 6; i++) seq.push(seq[i - 1] + d0 + dd * (i - 1));
        rule = `The differences grow by ${dd}: ${seq.slice(1).map((v, i) => v - seq[i]).join(', ')}`;
      }
      const answer = seq[5];
      const prev = seq[4];
      return makeQuestion(rng, {
        type: this.id, topic: 'reasoning',
        text: `What comes next? ${seq.slice(0, 5).join(', ')}, ?`,
        answer,
        wrong: [answer + 1, answer - 1, prev + (seq[4] - seq[3]), answer + (seq[1] - seq[0]), answer * 2 - prev],
        steps: [rule, `So the next term is ${answer}`],
      });
    },
  },
  {
    id: 'letter-series',
    label: 'Letter series',
    tiers: [2],
    make(rng) {
      const start = rng.int(0, 10); const step = rng.int(2, 4);
      const seq = Array.from({ length: 5 }, (_, i) => letter(start + step * i));
      const answer = seq[4];
      return makeQuestion(rng, {
        type: this.id, topic: 'reasoning',
        text: `What comes next? ${seq.slice(0, 4).join(', ')}, ?`,
        answer,
        wrong: [letter(start + step * 4 + 1), letter(start + step * 4 - 1), letter(start + step * 5), letter(start + step * 3 + step + 2)],
        steps: [`Each letter moves ${step} places forward in the alphabet`, `${seq[3]} + ${step} = ${answer}`],
      });
    },
  },
  {
    id: 'coding',
    label: 'Coding and decoding',
    tiers: [2, 3],
    make(rng, tier) {
      const k = rng.pick([1, 2, 3, -1, -2]);
      let w1 = rng.pick(WORDS); let w2 = rng.pick(WORDS);
      while (w2 === w1) w2 = rng.pick(WORDS);
      const coded1 = shiftWord(w1, k);
      const answer = tier === 3 ? [...shiftWord(w2, k)].reverse().join('') : shiftWord(w2, k);
      const intro = tier === 3
        ? `In a code, ${w1} is written as ${[...coded1].reverse().join('')}.`
        : `In a code, ${w1} is written as ${coded1}.`;
      const dir = k > 0 ? `${k} forward` : `${-k} back`;
      return makeQuestion(rng, {
        type: this.id, topic: 'reasoning',
        text: `${intro} How is ${w2} written in that code?`,
        answer,
        wrong: [shiftWord(w2, -k), shiftWord(w2, k + 1), [...answer].reverse().join(''), shiftWord(w2, k === 1 ? 2 : 1)],
        steps: tier === 3
          ? [`Each letter moves ${dir}, then the word is reversed`, `${w2} → ${shiftWord(w2, k)} → ${answer}`]
          : [`Each letter moves ${dir} in the alphabet`, `${w2} → ${answer}`],
      });
    },
  },
  {
    id: 'direction',
    label: 'Direction sense',
    tiers: [2, 3],
    make(rng) {
      const triples = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 6, 10], [9, 12, 15], [12, 5, 13]];
      const [x, y, h] = rng.pick(triples);
      const name = rng.pick(NAMES);
      const first = rng.pick(['north', 'south']);
      const turn = rng.pick(['left', 'right']);
      // Facing north, right is east; facing south, right is west.
      const east = (first === 'north') === (turn === 'right');
      const ns = first === 'north' ? 'north' : 'south';
      const ew = east ? 'east' : 'west';
      return makeQuestion(rng, {
        type: this.id, topic: 'reasoning',
        text: `${name} walks ${x} km ${first}, turns ${turn} and walks ${y} km. How far is ${name} from the starting point?`,
        answer: h,
        wrong: [x + y, Math.abs(x - y), h + 1, h - 2],
        fmt: (n) => `${n} km`,
        steps: [`${name} ends ${x} km ${ns} and ${y} km ${ew} of the start`, `Distance = √(${x}² + ${y}²) = √${x * x + y * y} = ${h} km`],
      });
    },
  },
  {
    id: 'odd-prime',
    label: 'Odd one out',
    tiers: [1],
    make(rng) {
      const primes = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73];
      const composites = [21, 25, 27, 33, 35, 39, 45, 49, 51, 55, 57, 63, 65, 69, 77, 81, 85, 87, 91, 93];
      const odd = rng.pick(composites);
      const group = rng.shuffle(primes).slice(0, 3);
      return makeQuestion(rng, {
        type: this.id, topic: 'reasoning',
        text: `Which number does not belong with the others?`,
        answer: odd,
        wrong: group,
        steps: [`${group.join(', ')} are prime numbers`, `${odd} is not prime, so it is the odd one out`],
      });
    },
  },
  {
    id: 'analogy',
    label: 'Number analogy',
    tiers: [1, 2],
    make(rng, tier) {
      const rules = tier === 1
        ? [['squared', (n) => n * n], ['times 3', (n) => n * 3]]
        : [['cubed', (n) => n * n * n], ['squared plus 1', (n) => n * n + 1], ['squared minus itself', (n) => n * n - n]];
      const [name, f] = rng.pick(rules);
      const a = rng.int(2, tier === 1 ? 9 : 6);
      let b = rng.int(3, tier === 1 ? 12 : 8);
      while (b === a) b = rng.int(3, tier === 1 ? 12 : 8);
      const answer = f(b);
      return makeQuestion(rng, {
        type: this.id, topic: 'reasoning',
        text: `${a} : ${f(a)} :: ${b} : ?`,
        answer,
        wrong: [answer + b, answer - 1, b * b + b, f(b + 1), f(b - 1)],
        steps: [`${f(a)} is ${a} ${name}`, `${b} ${name} = ${answer}`],
      });
    },
  },
  {
    id: 'row-position',
    label: 'Ranking',
    tiers: [1],
    make(rng) {
      const left = rng.int(4, 25); const right = rng.int(4, 25);
      const total = left + right - 1;
      const name = rng.pick(NAMES);
      return makeQuestion(rng, {
        type: this.id, topic: 'reasoning',
        text: `In a row, ${name} is ${ordinal(left)} from the left end and ${ordinal(right)} from the right end. How many people are in the row?`,
        answer: total,
        wrong: [left + right, total - 1, total + 2, Math.abs(left - right) + 1],
        steps: ['Total = position from left + position from right − 1', `= ${left} + ${right} − 1 = ${total}`],
      });
    },
  },
  {
    id: 'clock-angle',
    label: 'Clocks',
    tiers: [3],
    make(rng) {
      const h = rng.int(1, 11);
      const m = rng.pick([0, 10, 20, 30, 40, 50]);
      let angle = Math.abs(30 * h - 5.5 * m);
      if (angle > 180) angle = 360 - angle;
      return makeQuestion(rng, {
        type: this.id, topic: 'reasoning',
        text: `What is the smaller angle between the hour and minute hands at ${h}:${String(m).padStart(2, '0')}?`,
        answer: angle,
        wrong: [Math.abs(30 * h - 6 * m) % 360, 360 - angle, angle + 15, Math.abs(angle - 30)],
        fmt: (n) => `${n}°`,
        nudge: 5,
        steps: ['Angle = |30 × hours − 5.5 × minutes|', `= |${30 * h} − ${5.5 * m}| = ${Math.abs(30 * h - 5.5 * m)}°${Math.abs(30 * h - 5.5 * m) > 180 ? `, and 360° − that = ${angle}°` : ''}`],
      });
    },
  },
  {
    id: 'calendar',
    label: 'Calendar',
    tiers: [2],
    make(rng) {
      const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const start = rng.int(0, 6);
      const n = rng.int(10, 120);
      const answer = DAYS[(start + n) % 7];
      return makeQuestion(rng, {
        type: this.id, topic: 'reasoning',
        text: `Today is ${DAYS[start]}. What day of the week will it be after ${n} days?`,
        answer,
        wrong: [DAYS[(start + n + 1) % 7], DAYS[(start + n + 6) % 7], DAYS[(start + n + 2) % 7], DAYS[start]],
        steps: [`${n} ÷ 7 leaves remainder ${n % 7}`, `${DAYS[start]} + ${n % 7} days = ${answer}`],
      });
    },
  },
  {
    id: 'alphabet-position',
    label: 'Alphabet test',
    tiers: [1, 2],
    make(rng, tier) {
      const k = rng.int(3, 20);
      if (tier === 1) {
        const answer = letter(26 - k);
        return makeQuestion(rng, {
          type: this.id, topic: 'reasoning',
          text: `Which letter is ${ordinal(k)} from the right end of the English alphabet?`,
          answer,
          wrong: [letter(k - 1), letter(26 - k + 1), letter(26 - k - 1), letter(26 - k + 2), letter(26 - k - 2)],
          steps: ['kth from the right = (27 − k)th from the left', `27 − ${k} = ${27 - k}, which is ${answer}`],
        });
      }
      const j = rng.int(2, Math.min(8, 26 - k));
      const pos = k + j; // kth from left, then j to the right
      const answer = letter(pos - 1);
      return makeQuestion(rng, {
        type: this.id, topic: 'reasoning',
        text: `Which letter is ${j} places to the right of the ${ordinal(k)} letter from the left of the alphabet?`,
        answer,
        wrong: [letter(k - j - 1), letter(pos), letter(pos - 2), letter(k - 1), letter(pos + 1), letter(pos - 3)],
        steps: [`The ${ordinal(k)} letter is ${letter(k - 1)}`, `${j} places to its right is letter ${pos}, which is ${answer}`],
      });
    },
  },
];
