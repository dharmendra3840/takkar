// Shared helpers for question templates (QGEN-01, QGEN-02).
// Every template computes its answer in code; this file turns the answer and a
// list of plausible mistakes into exactly four different options.

export const NAMES = [
  'Riya', 'Arjun', 'Meera', 'Kabir', 'Zoya', 'Imran', 'Priya', 'Rahul',
  'Ananya', 'Dev', 'Fatima', 'Harpreet', 'Sana', 'Vikram', 'Neha', 'Joseph',
];

export function twoNames(rng) {
  const a = rng.pick(NAMES);
  let b = rng.pick(NAMES);
  while (b === a) b = rng.pick(NAMES);
  return [a, b];
}

export function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
export const lcm = (a, b) => (a / gcd(a, b)) * b;

/** Indian digit grouping: 125000 -> 1,25,000. */
export function inr(n) {
  return '₹' + groupIndian(n);
}
export function groupIndian(n) {
  const neg = n < 0;
  const [whole, frac] = String(Math.abs(n)).split('.');
  let out = whole;
  if (whole.length > 3) {
    const last3 = whole.slice(-3);
    const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    out = rest + ',' + last3;
  }
  return (neg ? '−' : '') + out + (frac ? '.' + frac : '');
}

/** Round to 2 decimals without float noise. */
export const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Make a question.
 * answer: the correct value (number or string), computed by the template.
 * wrong:  candidate wrong values (common mistakes). Extra ones are made if
 *         there are not enough different ones.
 * fmt:    turns a value into option text.
 */
export function makeQuestion(rng, { type, topic, text, answer, wrong, fmt = String, steps, nudge }) {
  if (typeof answer === 'number') answer = r2(answer);
  const answerText = fmt(answer);
  const seen = new Set([answerText]);
  const options = [answerText];

  const tryAdd = (value) => {
    if (options.length >= 4) return;
    if (value === undefined || value === null || Number.isNaN(value)) return;
    if (typeof value === 'number') value = r2(value);
    if (typeof value === 'number' && value <= 0 && !(typeof answer === 'number' && answer <= 0)) return;
    const textValue = fmt(value);
    if (seen.has(textValue)) return;
    seen.add(textValue);
    options.push(textValue);
  };

  for (const value of rng.shuffle(wrong)) tryAdd(value);

  // Fill any gap with nearby values so there are always four options.
  if (typeof answer === 'number') {
    const step = nudge || Math.max(1, Math.round(Math.abs(answer) * 0.1));
    let k = 1;
    while (options.length < 4 && k < 50) {
      tryAdd(r2(answer + step * k));
      tryAdd(r2(answer - step * k));
      k++;
    }
  }
  if (options.length < 4) throw new Error(`${type}: could not make 4 options`);

  const shuffled = rng.shuffle(options);
  return {
    type,
    topic,
    text,
    options: shuffled,
    answerIndex: shuffled.indexOf(answerText),
    answerText,
    steps: [...steps, `Answer: ${answerText}`],
  };
}
