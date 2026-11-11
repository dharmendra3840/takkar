// An independent solver for the set-3 question types (engine/bank.js), used by the release test.
// It reads only the question's plain text: the people, every clue and the question, or the table's numbers,
// then tries every arrangement. It shares no code with the generator, so a bug there can't hide here.

function permutations(n) {
  const out = [];
  const go = (rest, acc) => {
    if (!rest.length) { out.push(acc); return; }
    rest.forEach((x, i) => go([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, x]));
  };
  go(Array.from({ length: n }, (_, i) => i), []);
  return out;
}
const WORD_ORD = { immediately: 1, second: 2, third: 3, fourth: 4, first: 1, fifth: 5, sixth: 6 };
const WORD_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const sentences = (text) => text.match(/[^.?]+[.?]/g).map((s) => s.trim());

/** Returns { answer } (as option text), or { error }. */
export function solvePuzzle(type, text) {
  const parts = sentences(text);
  const names = (parts[0].match(/, ([A-Z](?:, [A-Z])* and [A-Z]),/) || [])[1]?.split(/, | and /);
  if (!names) return { error: 'no names' };
  const n = names.length;
  const ix = (x) => names.indexOf(x);
  const circle = type === 'seating-circle';
  const floors = type === 'floor-puzzle';
  const question = parts[parts.length - 1];
  const clueParts = parts.slice(floors ? 2 : 1, -1);
  // Each clue becomes a test on pos[] (place of each person). Row: 0 = left end. Circle: clockwise, left = +1.
  // Floors: 0 = floor 1.
  const mod = (x) => ((x % n) + n) % n;
  const tests = [];
  for (const c of clueParts) {
    let m;
    const add = (f) => tests.push(f);
    if (floors) {
      if ((m = c.match(/^([A-Z]) lives immediately (above|below) ([A-Z])\.$/))) { const [a, b, s] = [ix(m[1]), ix(m[3]), m[2] === 'above' ? 1 : -1]; add((p) => p[a] === p[b] + s); }
      else if ((m = c.match(/^([A-Z]) lives (one|two|three) floors (above|below) ([A-Z])\.$/))) { const [a, b, d] = [ix(m[1]), ix(m[4]), WORD_NUM[m[2]] * (m[3] === 'above' ? 1 : -1)]; add((p) => p[a] === p[b] + d); }
      else if ((m = c.match(/^([A-Z]) lives on a floor above ([A-Z]), but not immediately above\.$/))) { const [a, b] = [ix(m[1]), ix(m[2])]; add((p) => p[a] > p[b] + 1); }
      else if ((m = c.match(/^Only one person lives between ([A-Z]) and ([A-Z])\.$/))) { const [a, b] = [ix(m[1]), ix(m[2])]; add((p) => Math.abs(p[a] - p[b]) === 2); }
      else if ((m = c.match(/^Exactly (\w+) people live between ([A-Z]) and ([A-Z])\.$/))) { const [g, a, b] = [WORD_NUM[m[1]], ix(m[2]), ix(m[3])]; add((p) => Math.abs(p[a] - p[b]) === g + 1); }
      else if ((m = c.match(/^([A-Z]) lives on the (top|bottom) floor\.$/))) { const [a, top] = [ix(m[1]), m[2] === 'top']; add((p) => p[a] === (top ? n - 1 : 0)); }
      else if ((m = c.match(/^([A-Z]) lives on an (even|odd)-numbered floor\.$/))) { const [a, r] = [ix(m[1]), m[2] === 'even' ? 0 : 1]; add((p) => (p[a] + 1) % 2 === r); }
      else if ((m = c.match(/^([A-Z]) lives on floor (\d)\.$/))) { const [a, f] = [ix(m[1]), Number(m[2]) - 1]; add((p) => p[a] === f); }
      else if ((m = c.match(/^([A-Z]) lives neither on the top floor nor on the bottom floor\.$/))) { const a = ix(m[1]); add((p) => p[a] !== 0 && p[a] !== n - 1); }
      else return { error: `clue not read: ${c}` };
    } else if (circle) {
      if ((m = c.match(/^([A-Z]) sits (immediately|second) to the (left|right) of ([A-Z])\.$/))) { const [a, b, d] = [ix(m[1]), ix(m[4]), WORD_ORD[m[2]] * (m[3] === 'left' ? 1 : -1)]; add((p) => p[a] === mod(p[b] + d)); }
      else if ((m = c.match(/^([A-Z]) sits opposite ([A-Z])\.$/))) { const [a, b] = [ix(m[1]), ix(m[2])]; add((p) => p[a] === mod(p[b] + n / 2)); }
      else if ((m = c.match(/^([A-Z]) is (not )?an immediate neighbour of ([A-Z])\.$/))) { const [a, b, not] = [ix(m[1]), ix(m[3]), !!m[2]]; add((p) => (p[a] === mod(p[b] + 1) || p[a] === mod(p[b] - 1)) !== not); }
      else return { error: `clue not read: ${c}` };
    } else {
      if ((m = c.match(/^([A-Z]) sits at one of the ends\.$/))) { const a = ix(m[1]); add((p) => p[a] === 0 || p[a] === n - 1); }
      else if ((m = c.match(/^([A-Z]) does not sit at either end\.$/))) { const a = ix(m[1]); add((p) => p[a] !== 0 && p[a] !== n - 1); }
      else if ((m = c.match(/^([A-Z]) sits (immediately|second|third) to the (left|right) of ([A-Z])\.$/))) { const [a, b, d] = [ix(m[1]), ix(m[4]), WORD_ORD[m[2]] * (m[3] === 'right' ? 1 : -1)]; add((p) => p[a] === p[b] + d); }
      else if ((m = c.match(/^Only one person sits between ([A-Z]) and ([A-Z])\.$/))) { const [a, b] = [ix(m[1]), ix(m[2])]; add((p) => Math.abs(p[a] - p[b]) === 2); }
      else if ((m = c.match(/^Exactly (\w+) people sit between ([A-Z]) and ([A-Z])\.$/))) { const [g, a, b] = [WORD_NUM[m[1]], ix(m[2]), ix(m[3])]; add((p) => Math.abs(p[a] - p[b]) === g + 1); }
      else if ((m = c.match(/^([A-Z]) sits next to ([A-Z])\.$/))) { const [a, b] = [ix(m[1]), ix(m[2])]; add((p) => Math.abs(p[a] - p[b]) === 1); }
      else if ((m = c.match(/^([A-Z]) does not sit next to ([A-Z])\.$/))) { const [a, b] = [ix(m[1]), ix(m[2])]; add((p) => Math.abs(p[a] - p[b]) !== 1); }
      else if ((m = c.match(/^([A-Z]) sits (second|third) from the left end\.$/))) { const [a, i] = [ix(m[1]), WORD_ORD[m[2]] - 1]; add((p) => p[a] === i); }
      else return { error: `clue not read: ${c}` };
    }
  }
  const fitting = permutations(n).filter((p) => (!circle || p[0] === 0) && tests.every((t) => t(p)));
  if (fitting.length !== 1) return { error: `${fitting.length} arrangements fit` };
  const p = fitting[0];
  const at = (place) => names[p.indexOf(circle ? mod(place) : place)];
  let m;
  if (floors) {
    if ((m = question.match(/^Who lives on floor (\d)\?$/))) return { answer: at(Number(m[1]) - 1) };
    if ((m = question.match(/^Who lives immediately (above|below) ([A-Z])\?$/))) return { answer: at(p[ix(m[2])] + (m[1] === 'above' ? 1 : -1)) };
    if ((m = question.match(/^How many people live between ([A-Z]) and ([A-Z])\?$/))) return { answer: String(Math.abs(p[ix(m[1])] - p[ix(m[2])]) - 1) };
  } else if (circle) {
    if ((m = question.match(/^Who sits opposite ([A-Z])\?$/))) return { answer: at(p[ix(m[1])] + n / 2) };
    if ((m = question.match(/^Who sits (immediately|second) to the (left|right) of ([A-Z])\?$/))) return { answer: at(p[ix(m[3])] + WORD_ORD[m[1]] * (m[2] === 'left' ? 1 : -1)) };
  } else {
    if ((m = question.match(/^Who sits (immediately|second|third) to the (left|right) of ([A-Z])\?$/))) return { answer: at(p[ix(m[3])] + WORD_ORD[m[1]] * (m[2] === 'right' ? 1 : -1)) };
    if ((m = question.match(/^How many people sit between ([A-Z]) and ([A-Z])\?$/))) return { answer: String(Math.abs(p[ix(m[1])] - p[ix(m[2])]) - 1) };
    if ((m = question.match(/^Who sits at the extreme (left|right) end of the row\?$/))) return { answer: at(m[1] === 'left' ? 0 : n - 1) };
  }
  return { error: `question not read: ${question}` };
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const rat = (a, b) => `${a / gcd(a, b)} : ${b / gcd(a, b)}`;
const inrText = (n) => '₹' + n.toLocaleString('en-IN');

/** The two data types, from their plain text. */
export function solveData(type, text) {
  let m;
  if (type === 'di-table') {
    const rows = [...text.matchAll(/(\d{4}): \w (\d+), \w (\d+)/g)].map((r) => ({ y: Number(r[1]), a: Number(r[2]), b: Number(r[3]) }));
    if (rows.length !== 5) return { error: 'table not read' };
    const [nameA, nameB] = [...text.matchAll(/\d{4}: (\w) \d+, (\w) \d+/g)][0].slice(1);
    const q = text.slice(text.lastIndexOf('. ') + 2);
    const pick = (letter) => (letter === nameA ? 'a' : 'b');
    const yr = (y) => rows.find((r) => r.y === Number(y));
    const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
    if (/difference between the total/.test(q)) return { answer: String(Math.abs(sum('a') - sum('b'))) };
    if ((m = q.match(/combined .* in (\d{4}) and (\d{4}) together/))) return { answer: String(yr(m[1]).a + yr(m[1]).b + yr(m[2]).a + yr(m[2]).b) };
    if ((m = q.match(/average yearly .* of \w+ (\w) over/))) return { answer: String(sum(pick(m[1])) / 5) };
    if ((m = q.match(/percent did the .* of \w+ (\w) rise from (\d{4}) to (\d{4})/))) { const k = pick(m[1]); return { answer: `${((yr(m[3])[k] - yr(m[2])[k]) / yr(m[2])[k]) * 100}%` }; }
    if ((m = q.match(/ratio of .* in (\d{4}) and (\d{4}) taken together/))) return { answer: rat(yr(m[1]).a + yr(m[2]).a, yr(m[1]).b + yr(m[2]).b) };
    if ((m = q.match(/^In (\d{4}), the .* of \w+ (\w) were what percent of those of \w+ (\w)\?/))) { const r = yr(m[1]); return { answer: `${(r[pick(m[2])] / r[pick(m[3])]) * 100}%` }; }
    if (/which year was the gap/.test(q)) { const best = rows.reduce((x, r) => (Math.abs(r.a - r.b) > Math.abs(x.a - x.b) ? r : x)); return { answer: String(best.y) }; }
    return { error: `question not read: ${q}` };
  }
  const total = Number(text.match(/of ₹([\d,]+) is shared/)[1].replace(/,/g, ''));
  const shares = Object.fromEntries([...text.matchAll(/([A-Z][\w ]*?) (\d+)%/g)].map((r) => [r[1].trim(), Number(r[2])]));
  const q = text.slice(text.lastIndexOf('. ') + 2);
  const amt = (k) => (total * shares[k]) / 100;
  if ((m = q.match(/^How much goes on (.+)\?$/))) return { answer: inrText(amt(m[1])) };
  if ((m = q.match(/^How much more goes on (.+) than on (.+)\?$/))) return { answer: inrText(amt(m[1]) - amt(m[2])) };
  if ((m = q.match(/^Spending on (.+) is what percent of spending on (.+)\?$/))) return { answer: `${(shares[m[1]] / shares[m[2]]) * 100}%` };
  if ((m = q.match(/^What is the ratio of spending on (.+) to spending on (.+)\?$/))) return { answer: rat(shares[m[1]], shares[m[2]]) };
  return { error: `question not read: ${q}` };
}
