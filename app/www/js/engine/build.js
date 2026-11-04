// Shared helpers for question templates (QGEN-01, QGEN-02).
// Every template computes its answer in code; this file turns the answer and a
// list of plausible mistakes into exactly four different options.

export const NAMES = [
  'Riya', 'Arjun', 'Meera', 'Kabir', 'Zoya', 'Imran', 'Priya', 'Rahul',
  'Ananya', 'Dev', 'Fatima', 'Harpreet', 'Sana', 'Vikram', 'Neha', 'Joseph',
];

// Hindi spelling and gender of each name (for verb endings: करता / करती).
const NAME_HI = {
  Riya: ['रिया', 'f'], Arjun: ['अर्जुन', 'm'], Meera: ['मीरा', 'f'], Kabir: ['कबीर', 'm'], Zoya: ['ज़ोया', 'f'], Imran: ['इमरान', 'm'],
  Priya: ['प्रिया', 'f'], Rahul: ['राहुल', 'm'], Ananya: ['अनन्या', 'f'], Dev: ['देव', 'm'], Fatima: ['फ़ातिमा', 'f'], Harpreet: ['हरप्रीत', 'f'],
  Sana: ['सना', 'f'], Vikram: ['विक्रम', 'm'], Neha: ['नेहा', 'f'], Joseph: ['जोसेफ़', 'm'],
};
export const hiName = (name) => NAME_HI[name]?.[0] || name;
/** The masculine or feminine form, by the name's gender. */
export const byGender = (name, m, f) => (NAME_HI[name]?.[1] === 'f' ? f : m);

// Units in Hindi, as the papers write them.
export const HI = {
  days: (n) => `${n} दिन`, hours: (n) => `${n} घंटे`, kmh: (n) => `${n} किमी/घंटा`, seconds: (n) => `${n} सेकंड`,
  years: (n) => `${n} वर्ष`, metres: (n) => `${n} मीटर`, kg: (n) => `${n} किग्रा`, minutes: (n) => `${n} मिनट`, km: (n) => `${n} किमी`,
};

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
 * hi:     the Hindi version: { text, steps, fmt } (fmt defaults to the English one, for numbers).
 *         It is built from the same values, so the Hindi options line up with the English ones.
 */
export function makeQuestion(rng, { type, topic, text, answer, wrong, fmt = String, steps, nudge, hi }) {
  if (typeof answer === 'number') answer = r2(answer);
  const answerText = fmt(answer);
  const seen = new Set([answerText]);
  const options = [answerText];
  const values = [answer];

  const tryAdd = (value) => {
    if (options.length >= 4) return;
    if (value === undefined || value === null || Number.isNaN(value)) return;
    if (typeof value === 'number') value = r2(value);
    if (typeof value === 'number' && value <= 0 && !(typeof answer === 'number' && answer <= 0)) return;
    const textValue = fmt(value);
    if (seen.has(textValue)) return;
    seen.add(textValue);
    options.push(textValue);
    values.push(value);
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

  // Shuffling the positions draws the same random numbers as shuffling the options did.
  const order = rng.shuffle(options.map((_, i) => i));
  const shuffled = order.map((i) => options[i]);
  const q = {
    type,
    topic,
    text,
    options: shuffled,
    answerIndex: shuffled.indexOf(answerText),
    answerText,
    steps: [...steps, `Answer: ${answerText}`],
  };
  if (hi) {
    const hf = hi.fmt || fmt;
    q.hi = { text: hi.text, options: order.map((i) => hf(values[i])), answerText: hf(answer), steps: [...hi.steps, `उत्तर: ${hf(answer)}`] };
  }
  return q;
}
