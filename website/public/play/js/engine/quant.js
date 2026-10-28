// Quant templates. Each picks numbers so the answer is exact, computes the
// answer in code, and offers wrong options that match real mistakes.
import { makeQuestion, twoNames, NAMES, inr, gcd, lcm, groupIndian } from './build.js?v=59e587e5a2';
import { MORE_QUANT } from './quant-more.js?v=59e587e5a2';

const days = (n) => `${n} days`;
const hrs = (n) => `${n} hours`;
const kmh = (n) => `${n} km/h`;
const sec = (n) => `${n} seconds`;
const pct = (n) => `${n}%`;
const yrs = (n) => `${n} years`;

export const QUANT = [
  {
    id: 'percent-of',
    label: 'Percentages',
    tiers: [1],
    make(rng) {
      const p = rng.pick([5, 10, 12, 15, 20, 25, 30, 35, 40, 45, 60, 75]);
      const base = rng.int(4, 60) * 20;
      const answer = (p * base) / 100;
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `What is ${p}% of ${groupIndian(base)}?`,
        answer,
        wrong: [answer * 10, answer / 10, base - answer, (p + 5) * base / 100, (p - 5) * base / 100],
        fmt: groupIndian,
        steps: [`${p}% of ${groupIndian(base)} = ${p} × ${groupIndian(base)} ÷ 100`, `= ${groupIndian(answer)}`],
      });
    },
  },
  {
    id: 'percent-change',
    label: 'Percentages',
    tiers: [2],
    make(rng) {
      const up = rng.pick([10, 20, 25, 30, 40, 50]);
      const down = rng.pick([10, 20, 25, 30, 40, 50]);
      // Net change for +up then -down: (1 + up/100)(1 - down/100) - 1
      const net = ((100 + up) * (100 - down) - 10000) / 100;
      const fmt = (n) => (n === 0 ? 'No change' : n > 0 ? `${n}% increase` : `${Math.abs(n)}% decrease`);
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `A price rises by ${up}% and then falls by ${down}%. What is the overall change?`,
        answer: net,
        wrong: [up - down, down - up, net + 5, net - 5, up * down / 100],
        fmt,
        nudge: 2,
        steps: [`Net change = ${up} − ${down} − (${up} × ${down}) ÷ 100`, `= ${up - down} − ${up * down / 100} = ${net}%`],
      });
    },
  },
  {
    id: 'profit-sp',
    label: 'Profit and loss',
    tiers: [1],
    make(rng) {
      const cp = rng.int(8, 60) * 50;
      const p = rng.pick([10, 12, 15, 20, 25, 30, 40]);
      const loss = rng.chance(0.35);
      const sp = loss ? cp * (100 - p) / 100 : cp * (100 + p) / 100;
      const name = rng.pick(NAMES);
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `${name} buys a cycle for ${inr(cp)} and sells it at a ${loss ? 'loss' : 'profit'} of ${p}%. What is the selling price?`,
        answer: sp,
        wrong: [loss ? cp * (100 + p) / 100 : cp * (100 - p) / 100, cp + p, cp * p / 100, sp + cp * 0.05],
        fmt: inr,
        steps: [`Selling price = ${inr(cp)} × (100 ${loss ? '−' : '+'} ${p}) ÷ 100`, `= ${inr(cp)} × ${loss ? 100 - p : 100 + p} ÷ 100 = ${inr(sp)}`],
      });
    },
  },
  {
    id: 'profit-percent',
    label: 'Profit and loss',
    tiers: [2],
    make(rng) {
      const cp = rng.int(4, 40) * 100;
      const p = rng.pick([5, 8, 10, 12, 15, 20, 25, 30, 35]);
      const sp = cp * (100 + p) / 100;
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `An article bought for ${inr(cp)} is sold for ${inr(sp)}. What is the profit percentage?`,
        answer: p,
        wrong: [Math.round((sp - cp) / sp * 1000) / 10, p + 5, p - 2, (sp - cp) / 10],
        fmt: pct,
        nudge: 2,
        steps: [`Profit = ${inr(sp)} − ${inr(cp)} = ${inr(sp - cp)}`, `Profit % = ${groupIndian(sp - cp)} ÷ ${groupIndian(cp)} × 100 = ${p}%`],
      });
    },
  },
  {
    id: 'discount',
    label: 'Discount',
    tiers: [1],
    make(rng) {
      const mp = rng.int(5, 80) * 100;
      const d = rng.pick([5, 10, 15, 20, 25, 30, 40]);
      const sp = mp * (100 - d) / 100;
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `A watch marked at ${inr(mp)} is sold at a discount of ${d}%. What does the buyer pay?`,
        answer: sp,
        wrong: [mp * d / 100, mp * (100 + d) / 100, mp - d, sp - mp * 0.05],
        fmt: inr,
        steps: [`Discount = ${d}% of ${inr(mp)} = ${inr(mp * d / 100)}`, `Price paid = ${inr(mp)} − ${inr(mp * d / 100)} = ${inr(sp)}`],
      });
    },
  },
  {
    id: 'successive-discount',
    label: 'Discount',
    tiers: [2, 3],
    make(rng, tier) {
      const d1 = rng.pick([10, 20, 25, 30, 40, 50]);
      const d2 = rng.pick([10, 20, 25, 30, 40, 50]);
      const single = (d1 + d2) - (d1 * d2) / 100;
      if (tier === 3) {
        const mp = rng.int(2, 20) * 400;
        const sp = mp * (100 - d1) * (100 - d2) / 10000;
        return makeQuestion(rng, {
          type: this.id, topic: 'quant',
          text: `A phone marked at ${inr(mp)} gets successive discounts of ${d1}% and ${d2}%. What is the final price?`,
          answer: sp,
          wrong: [mp * (100 - d1 - d2) / 100, mp * (d1 + d2) / 100, mp * (100 - d1) / 100, sp + mp * 0.02],
          fmt: inr,
          steps: [`After ${d1}%: ${inr(mp)} × ${100 - d1} ÷ 100 = ${inr(mp * (100 - d1) / 100)}`, `After ${d2}%: ${inr(mp * (100 - d1) / 100)} × ${100 - d2} ÷ 100 = ${inr(sp)}`],
        });
      }
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `Successive discounts of ${d1}% and ${d2}% equal a single discount of how much?`,
        answer: single,
        wrong: [d1 + d2, Math.abs(d1 - d2), single + 5, d1 * d2 / 100],
        fmt: pct,
        nudge: 2,
        steps: [`Single discount = ${d1} + ${d2} − (${d1} × ${d2}) ÷ 100`, `= ${d1 + d2} − ${d1 * d2 / 100} = ${single}%`],
      });
    },
  },
  {
    id: 'simple-interest',
    label: 'Simple interest',
    tiers: [1],
    make(rng) {
      const p = rng.int(2, 50) * 500;
      const r = rng.pick([4, 5, 6, 8, 10, 12]);
      const t = rng.int(2, 6);
      const si = p * r * t / 100;
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `What is the simple interest on ${inr(p)} at ${r}% a year for ${t} years?`,
        answer: si,
        wrong: [p + si, p * r / 100, si * 2, p * (r + 1) * t / 100],
        fmt: inr,
        steps: ['Simple interest = P × R × T ÷ 100', `= ${groupIndian(p)} × ${r} × ${t} ÷ 100 = ${inr(si)}`],
      });
    },
  },
  {
    id: 'compound-interest',
    label: 'Compound interest',
    tiers: [2, 3],
    make(rng, tier) {
      const r = rng.pick([5, 10, 20]);
      const t = tier === 3 ? 3 : 2;
      const p = rng.int(1, 20) * (t === 3 ? 8000 : 400);
      const amount = p * Math.pow(100 + r, t) / Math.pow(100, t);
      const ci = amount - p;
      const si = p * r * t / 100;
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `What is the compound interest on ${inr(p)} at ${r}% a year for ${t} years, compounded yearly?`,
        answer: ci,
        wrong: [si, amount, ci + p * r / 100, ci - (ci - si) / 2],
        fmt: inr,
        steps: [`Amount = ${groupIndian(p)} × (1 + ${r}/100)^${t} = ${inr(amount)}`, `Compound interest = ${inr(amount)} − ${inr(p)} = ${inr(ci)}`],
      });
    },
  },
  {
    id: 'work-together',
    label: 'Time and work',
    tiers: [1, 2],
    make(rng, tier) {
      // Pairs where a×b ÷ (a+b) is a whole number.
      const pairs = tier === 1
        ? [[12, 24], [10, 15], [6, 12], [20, 30], [12, 6], [15, 30], [10, 40], [18, 36]]
        : [[12, 18], [20, 30], [24, 40], [21, 28], [30, 45], [28, 84], [36, 45], [40, 60]];
      const [a, b] = rng.pick(pairs);
      const together = a * b / (a + b);
      const [n1, n2] = twoNames(rng);
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `${n1} can finish a job in ${a} days and ${n2} in ${b} days. Working together, how many days will they take?`,
        answer: together,
        wrong: [(a + b) / 2, Math.abs(a - b), a + b, together + 2, together - 2],
        fmt: days,
        steps: [`Together = (a × b) ÷ (a + b)`, `= ${a} × ${b} ÷ ${a + b} = ${together} days`],
      });
    },
  },
  {
    id: 'pipes',
    label: 'Pipes and cisterns',
    tiers: [2, 3],
    make(rng) {
      // Fill pipe a hours, empty pipe b hours (b > a), net = ab/(b-a)
      const pairs = [[4, 6], [6, 12], [10, 15], [12, 20], [8, 24], [6, 9], [15, 20], [20, 30]];
      const [a, b] = rng.pick(pairs);
      const net = a * b / (b - a);
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `Pipe A fills a tank in ${a} hours and pipe B empties it in ${b} hours. If both are open, how long will the empty tank take to fill?`,
        answer: net,
        wrong: [a * b / (a + b), b - a, a + b, net / 2],
        fmt: hrs,
        steps: [`Each hour: 1/${a} − 1/${b} = ${(b - a) / gcd(b - a, a * b)}/${a * b / gcd(b - a, a * b)} of the tank`, `Time = ${a} × ${b} ÷ (${b} − ${a}) = ${net} hours`],
      });
    },
  },
  {
    id: 'speed',
    label: 'Speed, time and distance',
    tiers: [1],
    make(rng) {
      const speed = rng.int(3, 18) * 5;
      const t = rng.int(2, 8);
      const d = speed * t;
      const name = rng.pick(NAMES);
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `${name} drives ${d} km in ${t} hours. What is the average speed?`,
        answer: speed,
        wrong: [d * t, speed + 5, speed - 5, Math.round(d / (t + 1))],
        fmt: kmh,
        steps: ['Speed = distance ÷ time', `= ${d} ÷ ${t} = ${speed} km/h`],
      });
    },
  },
  {
    id: 'train-platform',
    label: 'Trains',
    tiers: [2, 3],
    make(rng, tier) {
      const speed = rng.pick([36, 54, 72, 90, 108]);
      const ms = speed * 5 / 18;
      const t = rng.int(10, 30);
      const total = ms * t;
      if (tier === 2) {
        return makeQuestion(rng, {
          type: this.id, topic: 'quant',
          text: `A train running at ${speed} km/h crosses a pole in ${t} seconds. How long is the train?`,
          answer: total,
          wrong: [speed * t, total / 2, total + 50, Math.round(speed / 3.6 * (t - 2))],
          fmt: (n) => `${n} m`,
          steps: [`${speed} km/h = ${speed} × 5 ÷ 18 = ${ms} m/s`, `Length = ${ms} × ${t} = ${total} m`],
        });
      }
      const train = rng.int(4, Math.floor(total / 10) - 4) * 10;
      const platform = total - train;
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `A ${train} m long train at ${speed} km/h crosses a platform in ${t} seconds. How long is the platform?`,
        answer: platform,
        wrong: [total, train, total + train, platform + 50],
        fmt: (n) => `${n} m`,
        steps: [`${speed} km/h = ${ms} m/s, so in ${t} s the train covers ${ms} × ${t} = ${total} m`, `Platform = ${total} − ${train} = ${platform} m`],
      });
    },
  },
  {
    id: 'boats',
    label: 'Boats and streams',
    tiers: [2],
    make(rng) {
      const b = rng.int(4, 15) * 2;
      const s = rng.int(1, Math.min(6, b / 2 - 1));
      const down = b + s;
      const up = b - s;
      const askStream = rng.chance(0.5);
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `A boat goes ${down} km/h downstream and ${up} km/h upstream. What is the speed of the ${askStream ? 'stream' : 'boat in still water'}?`,
        answer: askStream ? s : b,
        wrong: askStream ? [down - up, b, s + 1, (down + up) / 4] : [s, down + up, b + 2, down - up],
        fmt: kmh,
        steps: askStream
          ? ['Stream speed = (downstream − upstream) ÷ 2', `= (${down} − ${up}) ÷ 2 = ${s} km/h`]
          : ['Boat speed = (downstream + upstream) ÷ 2', `= (${down} + ${up}) ÷ 2 = ${b} km/h`],
      });
    },
  },
  {
    id: 'ratio-share',
    label: 'Ratio and proportion',
    tiers: [1],
    make(rng) {
      let a = rng.int(1, 7);
      let b = rng.int(1, 7);
      while (b === a) b = rng.int(1, 7);
      const g = gcd(a, b); a /= g; b /= g;
      const unit = rng.int(5, 60) * 10;
      const total = (a + b) * unit;
      const [n1, n2] = twoNames(rng);
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `${inr(total)} is shared between ${n1} and ${n2} in the ratio ${a} : ${b}. How much does ${n2} get?`,
        answer: b * unit,
        wrong: [a * unit, total / 2, b * unit + unit, total - unit],
        fmt: inr,
        steps: [`Total parts = ${a} + ${b} = ${a + b}`, `${n2}'s share = ${b} × ${groupIndian(total)} ÷ ${a + b} = ${inr(b * unit)}`],
      });
    },
  },
  {
    id: 'average-new',
    label: 'Averages',
    tiers: [2],
    make(rng) {
      const n = rng.int(5, 12);
      const avg = rng.int(20, 60);
      const rise = rng.int(1, 4);
      const newcomer = avg + rise * (n + 1);
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `The average weight of ${n} students is ${avg} kg. When one more student joins, the average rises by ${rise} kg. What does the new student weigh?`,
        answer: newcomer,
        wrong: [avg + rise, avg + rise * n, newcomer + rise, newcomer - rise * 2],
        fmt: (x) => `${x} kg`,
        steps: [`New total = ${n + 1} × ${avg + rise} = ${(n + 1) * (avg + rise)} kg; old total = ${n} × ${avg} = ${n * avg} kg`, `New student = ${(n + 1) * (avg + rise)} − ${n * avg} = ${newcomer} kg`],
      });
    },
  },
  {
    id: 'ages-ratio',
    label: 'Ages',
    tiers: [3],
    make(rng) {
      // Present ages a:b = x:y; after k years ratio becomes p:q. Build from answer.
      let x = rng.int(2, 7);
      let y = rng.int(x + 1, 9);
      const g = gcd(x, y); x /= g; y /= g;
      const unit = rng.int(2, 6);
      const k = rng.int(2, 10);
      const A = x * unit; const B = y * unit;
      let p = A + k; let q = B + k;
      const g2 = gcd(p, q); p /= g2; q /= g2;
      const [n1, n2] = twoNames(rng);
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `The ages of ${n1} and ${n2} are in the ratio ${x} : ${y}. After ${k} years the ratio will be ${p} : ${q}. How old is ${n2} now?`,
        answer: B,
        wrong: [A, B + k, q * (unit + 1), B - x],
        fmt: yrs,
        steps: [`Let the ages be ${x}u and ${y}u. Then (${x}u + ${k}) ÷ (${y}u + ${k}) = ${p} ÷ ${q}`, `${q}(${x}u + ${k}) = ${p}(${y}u + ${k}) gives u = ${unit}, so ${n2} is ${y} × ${unit} = ${B} years`],
      });
    },
  },
  {
    id: 'simplify',
    label: 'Simplification',
    tiers: [1],
    make(rng) {
      const a = rng.int(12, 60);
      const b = rng.int(2, 9);
      const c = rng.int(2, 9);
      const d = rng.int(10, 90);
      const answer = a + b * c - d;
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `Simplify: ${a} + ${b} × ${c} − ${d}`,
        answer,
        wrong: [(a + b) * c - d, a + b * (c - d), answer + 10, answer - b],
        fmt: groupIndian,
        nudge: 3,
        steps: [`Multiply first: ${b} × ${c} = ${b * c}`, `${a} + ${b * c} − ${d} = ${answer}`],
      });
    },
  },
  {
    id: 'lcm-bells',
    label: 'LCM and HCF',
    tiers: [1, 2],
    make(rng, tier) {
      const sets = tier === 1 ? [[4, 6], [6, 8], [5, 6], [8, 12], [9, 12], [10, 15]] : [[4, 6, 10], [6, 8, 12], [5, 6, 8], [8, 12, 18], [9, 12, 15], [10, 12, 15]];
      const set = rng.pick(sets);
      const l = set.reduce(lcm);
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `${set.length === 2 ? 'Two' : 'Three'} bells ring every ${set.slice(0, -1).join(', ')} and ${set[set.length - 1]} minutes. They ring together now. After how many minutes will they next ring together?`,
        answer: l,
        wrong: [set.reduce((x, y) => x * y), set.reduce(gcd), set.reduce((x, y) => x + y), l * 2],
        fmt: (n) => `${n} minutes`,
        steps: [`They ring together after the LCM of ${set.join(', ')}`, `LCM = ${l} minutes`],
      });
    },
  },
  {
    id: 'mixture',
    label: 'Mixtures',
    tiers: [3],
    make(rng) {
      // Mix rice at c1 and c2 per kg to get mean m. Ratio = (c2 - m) : (m - c1)
      const c1 = rng.int(4, 10) * 5;
      const gap = rng.int(2, 6) * 5;
      const c2 = c1 + gap * 2;
      const shift = rng.pick([-5, 0, 5]);
      const m = c1 + gap + shift;
      let x = c2 - m; let y = m - c1;
      const g = gcd(x, y); x /= g; y /= g;
      const fmt = (v) => v;
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `In what ratio must rice at ${inr(c1)}/kg be mixed with rice at ${inr(c2)}/kg so that the mixture costs ${inr(m)}/kg?`,
        answer: `${x} : ${y}`,
        wrong: [`${y} : ${x}`, `${x + 1} : ${y}`, `${x} : ${y + 1}`, `${c1 / 5} : ${c2 / 5}`, '1 : 1'],
        fmt,
        steps: ['By alligation: cheaper : dearer = (dearer − mean) : (mean − cheaper)', `= (${c2} − ${m}) : (${m} − ${c1}) = ${c2 - m} : ${m - c1} = ${x} : ${y}`],
      });
    },
  },
  {
    id: 'partnership',
    label: 'Partnership',
    tiers: [2],
    make(rng) {
      const a = rng.int(2, 9) * 1000;
      let b = rng.int(2, 9) * 1000;
      while (b === a) b = rng.int(2, 9) * 1000;
      const ta = 12;
      const tb = rng.pick([6, 8, 9, 10]);
      const sa = a * ta; const sb = b * tb;
      const g = gcd(sa, sb);
      const unit = rng.int(1, 9) * 100;
      const profit = (sa / g + sb / g) * unit;
      const bShare = (sb / g) * unit;
      const [n1, n2] = twoNames(rng);
      return makeQuestion(rng, {
        type: this.id, topic: 'quant',
        text: `${n1} invests ${inr(a)} for 12 months and ${n2} invests ${inr(b)} for ${tb} months. Out of a profit of ${inr(profit)}, what is ${n2}'s share?`,
        answer: bShare,
        wrong: [(sa / g) * unit, Math.round(profit * b / (a + b)), profit / 2, bShare + unit],
        fmt: inr,
        steps: [`Ratio = ${groupIndian(a)} × 12 : ${groupIndian(b)} × ${tb} = ${sa / g} : ${sb / g}`, `${n2}'s share = ${groupIndian(profit)} × ${sb / g} ÷ ${sa / g + sb / g} = ${inr(bShare)}`],
      });
    },
  },
  // Question set 2 (app 0.4): BODMAS, number system, fractions, approximation, quadratic equations.
  ...MORE_QUANT,
];
