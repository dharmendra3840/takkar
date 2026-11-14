// Bank-exam question types (question set 3, app 0.10.0): seating arrangement, floor puzzles and data interpretation,
// the biggest parts of IBPS PO and RRB papers. Built like the other types: the answer is computed, every puzzle's clues
// are checked by trying every arrangement (exactly one fits), and the Hindi comes from the same values.
//
// Each question also carries `view` for apps from 0.10.0: the data as a table, or the clues as a list, with the
// question line apart. `text` keeps everything in plain sentences, so older apps, the website and the tutor's paper
// still show the whole question. `time: 2` gives these types twice the usual time in a duel.
import { makeQuestion, inr } from './build.js?v=a9e7f3de4a';

// ---------- shared ----------

const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
const ORD_HI = ['', 'पहले', 'दूसरे', 'तीसरे', 'चौथे', 'पाँचवें', 'छठे'];
const COUNT = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
const COUNT_CAP = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
const COUNT_HI = ['', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात'];
// Letters for people, as the papers use them; never I (it reads as a word) or O (it looks like zero).
const LETTER_SETS = ['ABCDEF', 'JKLMNP', 'PQRSTU', 'EFGHJK', 'LMNPQR'];

/** "J, K, L, M and N" / "J, K, L, M और N". */
const listOf = (names, and = 'and') => `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;

const PERMS = {};
/** Every order of 0..n-1 (n up to 6: 720), made once. */
function perms(n) {
  if (PERMS[n]) return PERMS[n];
  const out = [];
  const a = Array.from({ length: n }, (_, i) => i);
  const go = (k) => {
    if (k === n) { out.push(a.slice()); return; }
    for (let i = k; i < n; i++) { [a[k], a[i]] = [a[i], a[k]]; go(k + 1); [a[k], a[i]] = [a[i], a[k]]; }
  };
  go(0);
  return (PERMS[n] = out);
}

/**
 * How many arrangements fit all the clues (stops at 2). pos[person] = place. `fixed`: person 0 stays at place 0
 * (circles, where turning the whole table changes nothing).
 */
function fits(n, clues, test, fixed = false) {
  let found = 0;
  for (const pos of perms(n)) {
    if (fixed && pos[0] !== 0) continue;
    if (clues.every((c) => test(c, pos, n))) { found++; if (found > 1) return found; }
  }
  return found;
}

/** Picks clues true of `pos` until only it fits, then drops any that the rest make unnecessary. */
function chooseClues(rng, n, pos, candidates, test, fixed) {
  const chosen = [];
  for (const c of rng.shuffle(candidates)) {
    chosen.push(c);
    if (fits(n, chosen, test, fixed) === 1) break;
  }
  if (fits(n, chosen, test, fixed) !== 1) return null;
  for (let i = chosen.length - 1; i >= 0; i--) {
    const without = chosen.filter((_, j) => j !== i);
    if (fits(n, without, test, fixed) === 1) chosen.splice(i, 1);
  }
  return chosen;
}

/** A random arrangement: pos[person] = place. */
const shuffledPlaces = (rng, n) => rng.shuffle(Array.from({ length: n }, (_, i) => i));

/** The four options for "who": the answer and three others. */
const others = (names, answer) => names.filter((x) => x !== answer);

// ---------- seating in a row, facing north ----------
// Places 0 (left end) to n-1 (right end), as the people see them: facing north, their right is the higher place.

function rowTest(c, p, n) {
  switch (c.k) {
    case 'end': return p[c.a] === 0 || p[c.a] === n - 1;
    case 'notEnd': return p[c.a] !== 0 && p[c.a] !== n - 1;
    case 'right': return p[c.a] === p[c.b] + c.d;
    case 'left': return p[c.a] === p[c.b] - c.d;
    case 'gap': return Math.abs(p[c.a] - p[c.b]) - 1 === c.g;
    case 'next': return Math.abs(p[c.a] - p[c.b]) === 1;
    case 'notNext': return Math.abs(p[c.a] - p[c.b]) !== 1;
    case 'fromLeft': return p[c.a] === c.i;
    default: return false;
  }
}

function rowCandidates(n, p, hard) {
  const out = [];
  for (let a = 0; a < n; a++) {
    if (p[a] === 0 || p[a] === n - 1) out.push({ k: 'end', a }); else out.push({ k: 'notEnd', a });
    if (!hard && (p[a] === 1 || p[a] === 2)) out.push({ k: 'fromLeft', a, i: p[a] });
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const d = p[a] - p[b];
      if (d > 0 && d <= 3) out.push({ k: 'right', a, b, d });
      if (d < 0 && -d <= 3) out.push({ k: 'left', a, b, d: -d });
      if (a < b) {
        const g = Math.abs(d) - 1;
        if (g >= 1 && g <= 3) out.push({ k: 'gap', a, b, g });
        if (g === 0) out.push({ k: 'next', a, b }); else out.push({ k: 'notNext', a, b });
      }
    }
  }
  return out;
}

function rowClue(c, N) {
  const a = N[c.a]; const b = N[c.b];
  switch (c.k) {
    case 'end': return [`${a} sits at one of the ends.`, `${a} किसी एक छोर पर बैठा है।`];
    case 'notEnd': return [`${a} does not sit at either end.`, `${a} किसी भी छोर पर नहीं बैठा है।`];
    case 'right': return c.d === 1 ? [`${a} sits immediately to the right of ${b}.`, `${a}, ${b} के ठीक दाएँ बैठा है।`]
      : [`${a} sits ${ORD[c.d]} to the right of ${b}.`, `${a}, ${b} के दाएँ से ${ORD_HI[c.d]} स्थान पर बैठा है।`];
    case 'left': return c.d === 1 ? [`${a} sits immediately to the left of ${b}.`, `${a}, ${b} के ठीक बाएँ बैठा है।`]
      : [`${a} sits ${ORD[c.d]} to the left of ${b}.`, `${a}, ${b} के बाएँ से ${ORD_HI[c.d]} स्थान पर बैठा है।`];
    case 'gap': return c.g === 1 ? [`Only one person sits between ${a} and ${b}.`, `${a} और ${b} के बीच केवल एक व्यक्ति बैठा है।`]
      : [`Exactly ${COUNT[c.g]} people sit between ${a} and ${b}.`, `${a} और ${b} के बीच ठीक ${COUNT_HI[c.g]} व्यक्ति बैठे हैं।`];
    case 'next': return [`${a} sits next to ${b}.`, `${a}, ${b} के ठीक बगल में बैठा है।`];
    case 'notNext': return [`${a} does not sit next to ${b}.`, `${a}, ${b} के बगल में नहीं बैठा है।`];
    case 'fromLeft': return [`${a} sits ${ORD[c.i + 1]} from the left end.`, `${a} बाएँ छोर से ${ORD_HI[c.i + 1]} स्थान पर बैठा है।`];
    default: return ['', ''];
  }
}

function seatingRow(rng, tier) {
  const n = tier === 1 ? 5 : 6;
  const N = [...rng.pick(LETTER_SETS).slice(0, n)];
  let p; let clues;
  for (let tries = 0; tries < 30 && !clues; tries++) {
    p = shuffledPlaces(rng, n);
    clues = chooseClues(rng, n, p, rowCandidates(n, p, tier === 3), rowTest, false);
    if (clues && clues.length > (tier === 1 ? 6 : 7)) clues = null;
  }
  if (!clues) throw new Error('seating-row: no clue set');
  const at = (place) => N[p.indexOf(place)];
  const order = Array.from({ length: n }, (_, i) => at(i));

  // The question: something the clues don't say outright.
  const stated = (k, a, b, d) => clues.some((c) => c.k === k && c.a === a && c.b === b && (d === undefined || c.d === d));
  const asks = [];
  for (let a = 0; a < n; a++) {
    for (const d of [1, 2, 3]) {
      if (p[a] + d < n && !stated('right', p.indexOf(p[a] + d), a, d)) asks.push({ k: 'right', a, d, ans: at(p[a] + d) });
      if (p[a] - d >= 0 && !stated('left', p.indexOf(p[a] - d), a, d)) asks.push({ k: 'left', a, d, ans: at(p[a] - d) });
    }
  }
  if (tier >= 2) {
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      const g = Math.abs(p[a] - p[b]) - 1;
      if (!clues.some((c) => c.k === 'gap' && ((c.a === a && c.b === b) || (c.a === b && c.b === a)))) asks.push({ k: 'between', a, b, ans: g });
    }
  }
  asks.push({ k: 'endLeft', ans: at(0) }, { k: 'endRight', ans: at(n - 1) });
  const ask = rng.pick(asks);
  const A = N[ask.a]; const B = N[ask.b];
  let q; let qHi; let why; let whyHi;
  if (ask.k === 'right' || ask.k === 'left') {
    const side = ask.k; const sideHi = side === 'right' ? 'दाएँ' : 'बाएँ';
    q = ask.d === 1 ? `Who sits immediately to the ${side} of ${A}?` : `Who sits ${ORD[ask.d]} to the ${side} of ${A}?`;
    qHi = ask.d === 1 ? `${A} के ठीक ${sideHi} कौन बैठा है?` : `${A} के ${sideHi} से ${ORD_HI[ask.d]} स्थान पर कौन बैठा है?`;
    why = ask.d === 1 ? `Immediately to the ${side} of ${A} sits ${ask.ans}` : `${ORD[ask.d][0].toUpperCase()}${ORD[ask.d].slice(1)} to the ${side} of ${A} sits ${ask.ans}`;
    whyHi = ask.d === 1 ? `${A} के ठीक ${sideHi} ${ask.ans} बैठा है` : `${A} के ${sideHi} से ${ORD_HI[ask.d]} स्थान पर ${ask.ans} बैठा है`;
  } else if (ask.k === 'between') {
    q = `How many people sit between ${A} and ${B}?`;
    qHi = `${A} और ${B} के बीच कितने व्यक्ति बैठे हैं?`;
    why = `Between ${A} and ${B}: ${ask.ans}`;
    whyHi = `${A} और ${B} के बीच: ${ask.ans}`;
  } else {
    const left = ask.k === 'endLeft';
    q = `Who sits at the extreme ${left ? 'left' : 'right'} end of the row?`;
    qHi = `पंक्ति के बिल्कुल ${left ? 'बाएँ' : 'दाएँ'} छोर पर कौन बैठा है?`;
    why = `At the ${left ? 'left' : 'right'} end sits ${ask.ans}`;
    whyHi = `${left ? 'बाएँ' : 'दाएँ'} छोर पर ${ask.ans} बैठा है`;
  }
  const lines = clues.map((c) => rowClue(c, N));
  const intro = `${COUNT_CAP[n]} people, ${listOf(N)}, sit in a row facing north.`;
  const introHi = `${COUNT_HI[n]} व्यक्ति ${listOf(N, 'और')} एक पंक्ति में उत्तर की ओर मुख करके बैठे हैं।`;
  const numeric = typeof ask.ans === 'number';
  const out = makeQuestion(rng, {
    type: 'seating-row', topic: 'reasoning',
    text: [intro, ...lines.map((l) => l[0]), q].join(' '),
    answer: ask.ans,
    wrong: numeric ? Array.from({ length: n - 1 }, (_, i) => i).filter((x) => x !== ask.ans) : others(N, ask.ans),
    fmt: String,
    nudge: 1,
    steps: [`The only order that fits every clue, left to right: ${order.join(', ')}`, why],
    hi: { text: [introHi, ...lines.map((l) => l[1]), qHi].join(' '), steps: [`सभी शर्तों पर खरा उतरने वाला एकमात्र क्रम (बाएँ से दाएँ): ${order.join(', ')}`, whyHi] },
  });
  out.view = { intro, clues: lines.map((l) => l[0]), ask: q };
  out.hi.view = { intro: introHi, clues: lines.map((l) => l[1]), ask: qHi };
  return out;
}

// ---------- seating around a circular table, facing the centre ----------
// Places 0..n-1 clockwise seen from above. Facing the centre, a person's left is the next place clockwise.

function circleTest(c, p, n) {
  const step = (from, d) => (((from + d) % n) + n) % n;
  switch (c.k) {
    case 'left': return p[c.a] === step(p[c.b], c.d);
    case 'right': return p[c.a] === step(p[c.b], -c.d);
    case 'opposite': return p[c.a] === step(p[c.b], n / 2);
    case 'next': return p[c.a] === step(p[c.b], 1) || p[c.a] === step(p[c.b], -1);
    case 'notNext': return p[c.a] !== step(p[c.b], 1) && p[c.a] !== step(p[c.b], -1);
    default: return false;
  }
}

function circleCandidates(n, p) {
  const out = [];
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const cw = (((p[a] - p[b]) % n) + n) % n;
      if (cw === n / 2) { if (a < b) out.push({ k: 'opposite', a, b }); continue; }
      if (cw <= 2) out.push({ k: 'left', a, b, d: cw });
      if (n - cw <= 2) out.push({ k: 'right', a, b, d: n - cw });
      if (a < b) { if (cw === 1 || cw === n - 1) out.push({ k: 'next', a, b }); else out.push({ k: 'notNext', a, b }); }
    }
  }
  return out;
}

function circleClue(c, N) {
  const a = N[c.a]; const b = N[c.b];
  switch (c.k) {
    case 'left': return c.d === 1 ? [`${a} sits immediately to the left of ${b}.`, `${a}, ${b} के ठीक बाएँ बैठा है।`]
      : [`${a} sits ${ORD[c.d]} to the left of ${b}.`, `${a}, ${b} के बाएँ से ${ORD_HI[c.d]} स्थान पर बैठा है।`];
    case 'right': return c.d === 1 ? [`${a} sits immediately to the right of ${b}.`, `${a}, ${b} के ठीक दाएँ बैठा है।`]
      : [`${a} sits ${ORD[c.d]} to the right of ${b}.`, `${a}, ${b} के दाएँ से ${ORD_HI[c.d]} स्थान पर बैठा है।`];
    case 'opposite': return [`${a} sits opposite ${b}.`, `${a}, ${b} के ठीक सामने बैठा है।`];
    case 'next': return [`${a} is an immediate neighbour of ${b}.`, `${a}, ${b} का निकटतम पड़ोसी है।`];
    case 'notNext': return [`${a} is not an immediate neighbour of ${b}.`, `${a}, ${b} का निकटतम पड़ोसी नहीं है।`];
    default: return ['', ''];
  }
}

function seatingCircle(rng) {
  const n = 6;
  const N = [...rng.pick(LETTER_SETS).slice(0, n)];
  let p; let clues;
  for (let tries = 0; tries < 30 && !clues; tries++) {
    // Turn the table so that the first person is at place 0: the clues can't tell turns apart.
    const raw = shuffledPlaces(rng, n);
    p = raw.map((x) => (((x - raw[0]) % n) + n) % n);
    clues = chooseClues(rng, n, p, circleCandidates(n, p), circleTest, true);
    if (clues && clues.length > 6) clues = null;
  }
  if (!clues) throw new Error('seating-circle: no clue set');
  const at = (place) => N[p.indexOf((((place) % n) + n) % n)];
  const clockwise = Array.from({ length: n }, (_, i) => at(i));
  const asks = [];
  for (let a = 0; a < n; a++) {
    for (const d of [1, 2]) {
      if (!clues.some((c) => c.k === 'left' && c.b === a && c.d === d)) asks.push({ k: 'left', a, d, ans: at(p[a] + d) });
      if (!clues.some((c) => c.k === 'right' && c.b === a && c.d === d)) asks.push({ k: 'right', a, d, ans: at(p[a] - d) });
    }
    if (!clues.some((c) => c.k === 'opposite' && (c.a === a || c.b === a))) asks.push({ k: 'opposite', a, ans: at(p[a] + n / 2) });
  }
  const ask = rng.pick(asks);
  const A = N[ask.a];
  let q; let qHi; let why; let whyHi;
  if (ask.k === 'opposite') {
    q = `Who sits opposite ${A}?`; qHi = `${A} के ठीक सामने कौन बैठा है?`;
    why = `Opposite ${A} sits ${ask.ans}`; whyHi = `${A} के सामने ${ask.ans} बैठा है`;
  } else {
    const side = ask.k; const sideHi = side === 'right' ? 'दाएँ' : 'बाएँ';
    q = ask.d === 1 ? `Who sits immediately to the ${side} of ${A}?` : `Who sits ${ORD[ask.d]} to the ${side} of ${A}?`;
    qHi = ask.d === 1 ? `${A} के ठीक ${sideHi} कौन बैठा है?` : `${A} के ${sideHi} से ${ORD_HI[ask.d]} स्थान पर कौन बैठा है?`;
    why = `${ask.d === 1 ? 'Immediately' : `${ORD[ask.d][0].toUpperCase()}${ORD[ask.d].slice(1)}`} to the ${side} of ${A} sits ${ask.ans}`;
    whyHi = ask.d === 1 ? `${A} के ठीक ${sideHi} ${ask.ans} बैठा है` : `${A} के ${sideHi} से ${ORD_HI[ask.d]} स्थान पर ${ask.ans} बैठा है`;
  }
  const lines = clues.map((c) => circleClue(c, N));
  const intro = `Six friends, ${listOf(N)}, sit around a circular table facing the centre.`;
  const introHi = `छह मित्र ${listOf(N, 'और')} एक गोल मेज़ के चारों ओर केंद्र की ओर मुख करके बैठे हैं।`;
  const out = makeQuestion(rng, {
    type: 'seating-circle', topic: 'reasoning',
    text: [intro, ...lines.map((l) => l[0]), q].join(' '),
    answer: ask.ans, wrong: others(N, ask.ans), fmt: String,
    steps: [`Going round the table clockwise from ${clockwise[0]}, the only seating that fits every clue: ${clockwise.join(', ')} (facing the centre, each person’s left is the next seat clockwise)`, why],
    hi: { text: [introHi, ...lines.map((l) => l[1]), qHi].join(' '), steps: [`${clockwise[0]} से घड़ी की दिशा में, सभी शर्तों पर खरा उतरने वाला एकमात्र क्रम: ${clockwise.join(', ')} (केंद्र की ओर मुख होने पर हर व्यक्ति का बायाँ, घड़ी की दिशा में अगली सीट है)`, whyHi] },
  });
  out.view = { intro, clues: lines.map((l) => l[0]), ask: q };
  out.hi.view = { intro: introHi, clues: lines.map((l) => l[1]), ask: qHi };
  return out;
}

// ---------- people on the floors of a building ----------
// Floors 1 (bottom) to n (top); p[person] = floor − 1.

function floorTest(c, p, n) {
  switch (c.k) {
    case 'above': return p[c.a] === p[c.b] + c.d;
    case 'below': return p[c.a] === p[c.b] - c.d;
    case 'higher': return p[c.a] > p[c.b];
    case 'gap': return Math.abs(p[c.a] - p[c.b]) - 1 === c.g;
    case 'top': return p[c.a] === n - 1;
    case 'bottom': return p[c.a] === 0;
    case 'even': return (p[c.a] + 1) % 2 === 0;
    case 'odd': return (p[c.a] + 1) % 2 === 1;
    case 'floor': return p[c.a] === c.f;
    case 'notEnds': return p[c.a] !== 0 && p[c.a] !== n - 1;
    default: return false;
  }
}

function floorCandidates(n, p, hard) {
  const out = [];
  for (let a = 0; a < n; a++) {
    if (p[a] === n - 1) out.push({ k: 'top', a }); else if (p[a] === 0) out.push({ k: 'bottom', a }); else out.push({ k: 'notEnds', a });
    out.push({ k: (p[a] + 1) % 2 === 0 ? 'even' : 'odd', a });
    if (!hard && p[a] > 0 && p[a] < n - 1) out.push({ k: 'floor', a, f: p[a] });
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const d = p[a] - p[b];
      if (d > 0 && d <= 3) out.push({ k: 'above', a, b, d });
      if (d < 0 && -d <= 2) out.push({ k: 'below', a, b, d: -d });
      if (d > 1) out.push({ k: 'higher', a, b });
      if (a < b && Math.abs(d) - 1 >= 1 && Math.abs(d) - 1 <= 3) out.push({ k: 'gap', a, b, g: Math.abs(d) - 1 });
    }
  }
  return out;
}

function floorClue(c, N) {
  const a = N[c.a]; const b = N[c.b];
  const times = (d) => (d === 2 ? 'two' : d === 3 ? 'three' : 'one');
  const timesHi = (d) => COUNT_HI[d];
  switch (c.k) {
    case 'above': return c.d === 1 ? [`${a} lives immediately above ${b}.`, `${a}, ${b} के ठीक ऊपर रहता है।`]
      : [`${a} lives ${times(c.d)} floors above ${b}.`, `${a}, ${b} से ${timesHi(c.d)} मंज़िल ऊपर रहता है।`];
    case 'below': return c.d === 1 ? [`${a} lives immediately below ${b}.`, `${a}, ${b} के ठीक नीचे रहता है।`]
      : [`${a} lives ${times(c.d)} floors below ${b}.`, `${a}, ${b} से ${timesHi(c.d)} मंज़िल नीचे रहता है।`];
    case 'higher': return [`${a} lives on a floor above ${b}, but not immediately above.`, `${a}, ${b} से ऊपर की किसी मंज़िल पर रहता है, पर ठीक ऊपर नहीं।`];
    case 'gap': return c.g === 1 ? [`Only one person lives between ${a} and ${b}.`, `${a} और ${b} के बीच केवल एक व्यक्ति रहता है।`]
      : [`Exactly ${COUNT[c.g]} people live between ${a} and ${b}.`, `${a} और ${b} के बीच ठीक ${COUNT_HI[c.g]} व्यक्ति रहते हैं।`];
    case 'top': return [`${a} lives on the top floor.`, `${a} सबसे ऊपर की मंज़िल पर रहता है।`];
    case 'bottom': return [`${a} lives on the bottom floor.`, `${a} सबसे नीचे की मंज़िल पर रहता है।`];
    case 'even': return [`${a} lives on an even-numbered floor.`, `${a} सम संख्या वाली मंज़िल पर रहता है।`];
    case 'odd': return [`${a} lives on an odd-numbered floor.`, `${a} विषम संख्या वाली मंज़िल पर रहता है।`];
    case 'floor': return [`${a} lives on floor ${c.f + 1}.`, `${a} मंज़िल ${c.f + 1} पर रहता है।`];
    case 'notEnds': return [`${a} lives neither on the top floor nor on the bottom floor.`, `${a} न सबसे ऊपर की मंज़िल पर रहता है, न सबसे नीचे की।`];
    default: return ['', ''];
  }
}

function floorPuzzle(rng, tier) {
  const n = tier === 3 ? 6 : 5;
  const N = [...rng.pick(LETTER_SETS).slice(0, n)];
  let p; let clues;
  for (let tries = 0; tries < 30 && !clues; tries++) {
    p = shuffledPlaces(rng, n);
    clues = chooseClues(rng, n, p, floorCandidates(n, p, tier === 3), floorTest, false);
    if (clues && clues.length > (tier === 3 ? 7 : 6)) clues = null;
  }
  if (!clues) throw new Error('floor-puzzle: no clue set');
  const on = (floor) => N[p.indexOf(floor)];
  const fromTop = Array.from({ length: n }, (_, i) => `${n - i}: ${on(n - 1 - i)}`);
  const asks = [];
  for (let f = 0; f < n; f++) if (!clues.some((c) => (c.k === 'floor' && c.f === f) || ((c.k === 'top' && f === n - 1) || (c.k === 'bottom' && f === 0)))) asks.push({ k: 'on', f, ans: on(f) });
  for (let a = 0; a < n; a++) {
    if (p[a] < n - 1 && !clues.some((c) => c.k === 'above' && c.b === a && c.d === 1)) asks.push({ k: 'above', a, ans: on(p[a] + 1) });
    if (p[a] > 0 && !clues.some((c) => c.k === 'below' && c.b === a && c.d === 1)) asks.push({ k: 'below', a, ans: on(p[a] - 1) });
  }
  if (tier >= 2) {
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      if (!clues.some((c) => c.k === 'gap' && ((c.a === a && c.b === b) || (c.a === b && c.b === a)))) asks.push({ k: 'between', a, b, ans: Math.abs(p[a] - p[b]) - 1 });
    }
  }
  const ask = rng.pick(asks);
  const A = N[ask.a]; const B = N[ask.b];
  let q; let qHi; let why; let whyHi;
  if (ask.k === 'on') {
    q = `Who lives on floor ${ask.f + 1}?`; qHi = `मंज़िल ${ask.f + 1} पर कौन रहता है?`;
    why = `Floor ${ask.f + 1}: ${ask.ans}`; whyHi = `मंज़िल ${ask.f + 1}: ${ask.ans}`;
  } else if (ask.k === 'above' || ask.k === 'below') {
    const up = ask.k === 'above';
    q = `Who lives immediately ${up ? 'above' : 'below'} ${A}?`; qHi = `${A} के ठीक ${up ? 'ऊपर' : 'नीचे'} कौन रहता है?`;
    why = `Immediately ${up ? 'above' : 'below'} ${A} lives ${ask.ans}`; whyHi = `${A} के ठीक ${up ? 'ऊपर' : 'नीचे'} ${ask.ans} रहता है`;
  } else {
    q = `How many people live between ${A} and ${B}?`; qHi = `${A} और ${B} के बीच कितने व्यक्ति रहते हैं?`;
    why = `Between ${A} and ${B}: ${ask.ans}`; whyHi = `${A} और ${B} के बीच: ${ask.ans}`;
  }
  const lines = clues.map((c) => floorClue(c, N));
  const intro = `${COUNT_CAP[n]} people, ${listOf(N)}, live on different floors of a ${COUNT[n]}-storey building, one on each floor. The bottom floor is floor 1 and the top floor is floor ${n}.`;
  const introHi = `${COUNT_HI[n]} व्यक्ति ${listOf(N, 'और')} एक ${COUNT_HI[n]} मंज़िला इमारत की अलग-अलग मंज़िलों पर रहते हैं, हर मंज़िल पर एक। सबसे नीचे की मंज़िल 1 है और सबसे ऊपर की मंज़िल ${n}।`;
  const numeric = typeof ask.ans === 'number';
  const out = makeQuestion(rng, {
    type: 'floor-puzzle', topic: 'reasoning',
    text: [intro, ...lines.map((l) => l[0]), q].join(' '),
    answer: ask.ans,
    wrong: numeric ? Array.from({ length: n - 1 }, (_, i) => i).filter((x) => x !== ask.ans) : others(N, ask.ans),
    fmt: String, nudge: 1,
    steps: [`The only arrangement that fits every clue, from the top floor down: ${fromTop.join(', ')}`, why],
    hi: { text: [introHi, ...lines.map((l) => l[1]), qHi].join(' '), steps: [`सभी शर्तों पर खरा उतरने वाली एकमात्र व्यवस्था, ऊपर से नीचे: ${fromTop.join(', ')}`, whyHi] },
  });
  out.view = { intro, clues: lines.map((l) => l[0]), ask: q };
  out.hi.view = { intro: introHi, clues: lines.map((l) => l[1]), ask: qHi };
  return out;
}

// ---------- data interpretation: two series over five years ----------

const SERIES = [
  { what: 'units sold (in hundreds) by two shops', a: 'Shop A', b: 'Shop B', thing: 'sales', hiWhat: 'दो दुकानों द्वारा बेची गई इकाइयाँ (सैकड़ों में)', hiA: 'दुकान A', hiB: 'दुकान B', hiThing: 'बिक्री' },
  { what: 'students admitted to two colleges', a: 'College P', b: 'College Q', thing: 'admissions', hiWhat: 'दो कॉलेजों में प्रवेश पाने वाले छात्र', hiA: 'कॉलेज P', hiB: 'कॉलेज Q', hiThing: 'प्रवेश' },
  { what: 'cars made (in thousands) by two plants', a: 'Plant X', b: 'Plant Y', thing: 'production', hiWhat: 'दो संयंत्रों द्वारा बनाई गई कारें (हज़ारों में)', hiA: 'संयंत्र X', hiB: 'संयंत्र Y', hiThing: 'उत्पादन' },
  { what: 'books issued (in hundreds) by two libraries', a: 'Library M', b: 'Library N', thing: 'issues', hiWhat: 'दो पुस्तकालयों द्वारा जारी की गई पुस्तकें (सैकड़ों में)', hiA: 'पुस्तकालय M', hiB: 'पुस्तकालय N', hiThing: 'जारी पुस्तकें' },
];
const NICE_UP = [10, 20, 25, 30, 40, 50, 60, 75];
const NICE_OF = [40, 50, 60, 75, 80, 120, 125, 150];

function ratio(a, b) {
  const g = (x, y) => (y ? g(y, x % y) : x);
  const k = g(a, b);
  return `${a / k} : ${b / k}`;
}

function diTable(rng, tier) {
  const S = rng.pick(SERIES);
  const start = rng.int(2018, 2021);
  const years = Array.from({ length: 5 }, (_, i) => start + i);
  const A = years.map(() => rng.int(4, 19) * 5);
  const B = years.map(() => rng.int(4, 19) * 5);
  const kinds = tier === 1 ? ['diff', 'sumYear'] : tier === 2 ? ['avg', 'up'] : ['ratio', 'of', 'maxGap'];
  const kind = rng.pick(kinds);
  let ask; let askHi; let answer; let wrong; let fmt = String; let steps; let stepsHi;
  const sum = (xs) => xs.reduce((s, x) => s + x, 0);
  if (kind === 'diff') {
    const sa = sum(A); let sb = sum(B);
    if (sa === sb) { B[4] += 5; sb += 5; }
    answer = Math.abs(sa - sb);
    ask = `What is the difference between the total ${S.thing} of ${S.a} and of ${S.b} over the five years?`;
    askHi = `पाँच वर्षों में ${S.hiA} और ${S.hiB} की कुल ${S.hiThing} का अंतर कितना है?`;
    wrong = [answer + 5, answer + 10, Math.max(5, answer - 5), answer + 15, sa, sb];
    steps = [`Total for ${S.a} = ${A.join(' + ')} = ${sa}`, `Total for ${S.b} = ${B.join(' + ')} = ${sb}`, `Difference = ${answer}`];
    stepsHi = [`${S.hiA} का योग = ${A.join(' + ')} = ${sa}`, `${S.hiB} का योग = ${B.join(' + ')} = ${sb}`, `अंतर = ${answer}`];
  } else if (kind === 'sumYear') {
    const [y1, y2] = rng.shuffle([0, 1, 2, 3, 4]).slice(0, 2).sort((x, y) => x - y);
    answer = A[y1] + A[y2] + B[y1] + B[y2];
    ask = `What were the combined ${S.thing} of both in ${years[y1]} and ${years[y2]} together?`;
    askHi = `${years[y1]} और ${years[y2]} में दोनों की कुल मिलाकर ${S.hiThing} कितनी थी?`;
    wrong = [answer + 10, answer - 10, A[y1] + A[y2], B[y1] + B[y2], answer + 5];
    steps = [`${years[y1]}: ${A[y1]} + ${B[y1]} = ${A[y1] + B[y1]}`, `${years[y2]}: ${A[y2]} + ${B[y2]} = ${A[y2] + B[y2]}`, `Together: ${answer}`];
    stepsHi = [`${years[y1]}: ${A[y1]} + ${B[y1]} = ${A[y1] + B[y1]}`, `${years[y2]}: ${A[y2]} + ${B[y2]} = ${A[y2] + B[y2]}`, `कुल: ${answer}`];
  } else if (kind === 'avg') {
    const who = rng.pick(['a', 'b']); const xs = who === 'a' ? A : B;
    answer = sum(xs) / 5;
    const name = S[who]; const nameHi = who === 'a' ? S.hiA : S.hiB;
    ask = `What were the average yearly ${S.thing} of ${name} over the five years?`;
    askHi = `पाँच वर्षों में ${nameHi} की औसत वार्षिक ${S.hiThing} कितनी थी?`;
    wrong = [sum(xs) / 4, answer + 5, answer - 5, answer + 2, answer - 3];
    fmt = (x) => String(x);
    steps = [`Total = ${xs.join(' + ')} = ${sum(xs)}`, `Average = ${sum(xs)} ÷ 5 = ${answer}`];
    stepsHi = [`योग = ${xs.join(' + ')} = ${sum(xs)}`, `औसत = ${sum(xs)} ÷ 5 = ${answer}`];
  } else if (kind === 'up') {
    const who = rng.pick(['a', 'b']); const xs = who === 'a' ? A : B;
    const [y1, y2] = rng.shuffle([0, 1, 2, 3, 4]).slice(0, 2).sort((x, y) => x - y);
    const pct = rng.pick(NICE_UP);
    // Pick a starting figure the percentage divides evenly, then set the later year from it.
    const bases = [20, 40, 60, 80].filter((v) => (v * pct) % 100 === 0 && v * (1 + pct / 100) <= 140);
    xs[y1] = rng.pick(bases.length ? bases : [40]);
    xs[y2] = (xs[y1] * (100 + pct)) / 100;
    answer = pct;
    const name = S[who]; const nameHi = who === 'a' ? S.hiA : S.hiB;
    ask = `By what percent did the ${S.thing} of ${name} rise from ${years[y1]} to ${years[y2]}?`;
    askHi = `${years[y1]} से ${years[y2]} तक ${nameHi} की ${S.hiThing} कितने प्रतिशत बढ़ी?`;
    const rise = xs[y2] - xs[y1];
    wrong = [Math.round((rise / xs[y2]) * 100), pct + 10, pct - 5, rise, pct + 5];
    fmt = (x) => `${x}%`;
    steps = [`Rise = ${xs[y2]} − ${xs[y1]} = ${rise}`, `Percent rise = ${rise} ÷ ${xs[y1]} × 100 = ${pct}%`];
    stepsHi = [`वृद्धि = ${xs[y2]} − ${xs[y1]} = ${rise}`, `प्रतिशत वृद्धि = ${rise} ÷ ${xs[y1]} × 100 = ${pct}%`];
  } else if (kind === 'ratio') {
    const [y1, y2] = rng.shuffle([0, 1, 2, 3, 4]).slice(0, 2).sort((x, y) => x - y);
    const ta = A[y1] + A[y2]; let tb = B[y1] + B[y2];
    if (ta === tb) { B[y2] += 5; tb += 5; }
    answer = ratio(ta, tb);
    ask = `What is the ratio of the ${S.thing} of ${S.a} to those of ${S.b} in ${years[y1]} and ${years[y2]} taken together?`;
    askHi = `${years[y1]} और ${years[y2]} को मिलाकर ${S.hiA} और ${S.hiB} की ${S.hiThing} का अनुपात क्या है?`;
    wrong = [ratio(tb, ta), ratio(A[y1], B[y1]), ratio(A[y2], B[y2]), ratio(ta + 5, tb), ratio(ta, tb + 5)];
    steps = [`${S.a}: ${A[y1]} + ${A[y2]} = ${ta}`, `${S.b}: ${B[y1]} + ${B[y2]} = ${tb}`, `Ratio = ${ta} : ${tb} = ${answer}`];
    stepsHi = [`${S.hiA}: ${A[y1]} + ${A[y2]} = ${ta}`, `${S.hiB}: ${B[y1]} + ${B[y2]} = ${tb}`, `अनुपात = ${ta} : ${tb} = ${answer}`];
  } else if (kind === 'of') {
    const y = rng.int(0, 4);
    const pct = rng.pick(NICE_OF);
    const bases = [20, 40, 60, 80, 100].filter((v) => (v * pct) % 100 === 0 && (v * pct) / 100 <= 150);
    A[y] = rng.pick(bases);
    B[y] = (A[y] * pct) / 100;
    answer = pct;
    ask = `In ${years[y]}, the ${S.thing} of ${S.b} were what percent of those of ${S.a}?`;
    askHi = `${years[y]} में ${S.hiB} की ${S.hiThing}, ${S.hiA} की ${S.hiThing} का कितना प्रतिशत थी?`;
    wrong = [Math.round((A[y] / B[y]) * 100), pct + 10, pct - 10, pct + 25, Math.abs(B[y] - A[y])];
    fmt = (x) => `${x}%`;
    steps = [`${S.b} ÷ ${S.a} × 100 = ${B[y]} ÷ ${A[y]} × 100`, `= ${pct}%`];
    stepsHi = [`${S.hiB} ÷ ${S.hiA} × 100 = ${B[y]} ÷ ${A[y]} × 100`, `= ${pct}%`];
  } else {
    // The year with the widest gap; nudge it so that it is clearly the widest.
    const gaps = A.map((a, i) => Math.abs(a - B[i]));
    const best = gaps.indexOf(Math.max(...gaps));
    if (gaps.filter((g) => g === gaps[best]).length > 1) { if (A[best] >= B[best]) A[best] += 10; else B[best] += 10; }
    answer = years[best];
    ask = `In which year was the gap between the ${S.thing} of ${S.a} and ${S.b} the largest?`;
    askHi = `किस वर्ष ${S.hiA} और ${S.hiB} की ${S.hiThing} का अंतर सबसे अधिक था?`;
    wrong = years.filter((y) => y !== answer);
    const g2 = A.map((a, i) => Math.abs(a - B[i]));
    steps = [`Gaps: ${years.map((y, i) => `${y}: ${g2[i]}`).join(', ')}`, `Largest: ${answer}`];
    stepsHi = [`अंतर: ${years.map((y, i) => `${y}: ${g2[i]}`).join(', ')}`, `सबसे अधिक: ${answer}`];
  }
  const intro = `The table shows ${S.what} from ${years[0]} to ${years[4]}.`;
  const introHi = `तालिका में ${years[0]} से ${years[4]} तक ${S.hiWhat} दी गई हैं।`;
  const data = years.map((y, i) => `${y}: ${S.a.split(' ')[1]} ${A[i]}, ${S.b.split(' ')[1]} ${B[i]}`).join('; ');
  const out = makeQuestion(rng, {
    type: 'di-table', topic: 'quant',
    text: `${intro} ${data}. ${ask}`,
    answer, wrong, fmt, nudge: 5,
    steps, hi: { text: `${introHi} ${data}। ${askHi}`, steps: stepsHi },
  });
  const rows = years.map((y, i) => [String(y), String(A[i]), String(B[i])]);
  out.view = { intro, table: { head: ['Year', S.a, S.b], rows }, ask };
  out.hi.view = { intro: introHi, table: { head: ['वर्ष', S.hiA, S.hiB], rows }, ask: askHi };
  return out;
}

// ---------- data interpretation: how a total is shared ----------

const BUDGETS = [
  { what: 'A family’s monthly spending', items: ['Rent', 'Food', 'Education', 'Travel', 'Savings'], hiWhat: 'एक परिवार का मासिक खर्च', hiItems: ['किराया', 'भोजन', 'शिक्षा', 'यात्रा', 'बचत'] },
  { what: 'A company’s yearly expenses', items: ['Salaries', 'Raw material', 'Transport', 'Advertising', 'Rent'], hiWhat: 'एक कंपनी का वार्षिक खर्च', hiItems: ['वेतन', 'कच्चा माल', 'परिवहन', 'विज्ञापन', 'किराया'] },
  { what: 'A school’s yearly budget', items: ['Teachers', 'Buildings', 'Books', 'Sports', 'Events'], hiWhat: 'एक विद्यालय का वार्षिक बजट', hiItems: ['शिक्षक', 'भवन', 'पुस्तकें', 'खेल', 'कार्यक्रम'] },
];

function diShare(rng, tier) {
  const S = rng.pick(BUDGETS);
  // Five shares, multiples of 5, adding up to 100, no two the same.
  let shares;
  for (let tries = 0; tries < 50; tries++) {
    const cuts = rng.shuffle(Array.from({ length: 19 }, (_, i) => (i + 1) * 5)).slice(0, 4).sort((x, y) => x - y);
    const s = [cuts[0], cuts[1] - cuts[0], cuts[2] - cuts[1], cuts[3] - cuts[2], 100 - cuts[3]];
    if (new Set(s).size === 5 && s.every((x) => x >= 5)) { shares = s; break; }
  }
  if (!shares) shares = [30, 25, 20, 15, 10];
  const total = rng.pick([24000, 36000, 40000, 48000, 60000, 80000, 120000]);
  const amount = (i) => (total * shares[i]) / 100;
  let ask; let askHi; let answer; let wrong; let fmt = inr; let steps; let stepsHi;
  if (tier === 1) {
    const i = rng.int(0, 4);
    answer = amount(i);
    ask = `How much goes on ${S.items[i]}?`; askHi = `${S.hiItems[i]} पर कितना खर्च होता है?`;
    wrong = [amount((i + 1) % 5), amount((i + 2) % 5), answer + total / 20, answer * 2];
    steps = [`${S.items[i]} = ${shares[i]}% of ${inr(total)}`, `= ${inr(total)} × ${shares[i]} ÷ 100`];
    stepsHi = [`${S.hiItems[i]} = ${inr(total)} का ${shares[i]}%`, `= ${inr(total)} × ${shares[i]} ÷ 100`];
  } else if (tier === 2) {
    const [i, j] = rng.shuffle([0, 1, 2, 3, 4]).slice(0, 2).sort((x, y) => shares[y] - shares[x]);
    answer = amount(i) - amount(j);
    ask = `How much more goes on ${S.items[i]} than on ${S.items[j]}?`; askHi = `${S.hiItems[j]} की तुलना में ${S.hiItems[i]} पर कितना अधिक खर्च होता है?`;
    wrong = [amount(i) + amount(j), amount(i), answer + total / 20, Math.max(total / 100, answer - total / 20)];
    steps = [`Difference in shares = ${shares[i]}% − ${shares[j]}% = ${shares[i] - shares[j]}%`, `${shares[i] - shares[j]}% of ${inr(total)}`];
    stepsHi = [`हिस्सों का अंतर = ${shares[i]}% − ${shares[j]}% = ${shares[i] - shares[j]}%`, `${inr(total)} का ${shares[i] - shares[j]}%`];
  } else {
    // A pair whose shares make a whole percentage; otherwise their ratio.
    const pairs = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (i !== j && (shares[i] * 100) % shares[j] === 0) pairs.push([i, j]);
    const [i, j] = pairs.length ? rng.pick(pairs) : [0, 1];
    if (pairs.length) {
      answer = (shares[i] * 100) / shares[j];
      fmt = (x) => `${x}%`;
      ask = `Spending on ${S.items[i]} is what percent of spending on ${S.items[j]}?`;
      askHi = `${S.hiItems[i]} पर खर्च, ${S.hiItems[j]} पर खर्च का कितना प्रतिशत है?`;
      wrong = [Math.round((shares[j] * 100) / shares[i]), answer + 10, Math.max(5, answer - 10), shares[i], answer + 25];
      steps = [`${shares[i]}% ÷ ${shares[j]}% × 100`, `= ${answer}% (the total doesn’t matter)`];
      stepsHi = [`${shares[i]}% ÷ ${shares[j]}% × 100`, `= ${answer}% (कुल राशि से फ़र्क नहीं पड़ता)`];
    } else {
      answer = ratio(shares[i], shares[j]);
      fmt = String;
      ask = `What is the ratio of spending on ${S.items[i]} to spending on ${S.items[j]}?`;
      askHi = `${S.hiItems[i]} और ${S.hiItems[j]} पर खर्च का अनुपात क्या है?`;
      wrong = [ratio(shares[j], shares[i]), ratio(shares[i] + 5, shares[j]), ratio(shares[i], shares[j] + 5)];
      steps = [`${shares[i]} : ${shares[j]}`, `= ${answer}`];
      stepsHi = [`${shares[i]} : ${shares[j]}`, `= ${answer}`];
    }
  }
  const intro = `${S.what} of ${inr(total)} is shared as the table shows.`;
  const introHi = `${S.hiWhat} ${inr(total)} है, जो तालिका के अनुसार बँटा है।`;
  const data = S.items.map((it, i) => `${it} ${shares[i]}%`).join(', ');
  const dataHi = S.hiItems.map((it, i) => `${it} ${shares[i]}%`).join(', ');
  const out = makeQuestion(rng, {
    type: 'di-share', topic: 'quant',
    text: `${intro} ${data}. ${ask}`,
    answer, wrong, fmt, nudge: typeof answer === 'number' && fmt === inr ? total / 20 : 5,
    steps, hi: { text: `${introHi} ${dataHi}। ${askHi}`, steps: stepsHi },
  });
  out.view = { intro, table: { head: ['Item', 'Share'], rows: S.items.map((it, i) => [it, `${shares[i]}%`]) }, ask };
  out.hi.view = { intro: introHi, table: { head: ['मद', 'हिस्सा'], rows: S.hiItems.map((it, i) => [it, `${shares[i]}%`]) }, ask: askHi };
  return out;
}

export const BANK_QUANT = [
  { id: 'di-table', label: 'Data interpretation', since: 3, time: 2, tiers: [1, 2, 3], make: (rng, tier) => diTable(rng, tier) },
  { id: 'di-share', label: 'Data interpretation', since: 3, time: 2, tiers: [1, 2, 3], make: (rng, tier) => diShare(rng, tier) },
];
export const BANK_REASONING = [
  { id: 'seating-row', label: 'Seating arrangement', since: 3, time: 2, tiers: [1, 2, 3], make: (rng, tier) => seatingRow(rng, tier) },
  { id: 'seating-circle', label: 'Seating arrangement', since: 3, time: 2, tiers: [2, 3], make: (rng) => seatingCircle(rng) },
  { id: 'floor-puzzle', label: 'Puzzles', since: 3, time: 2, tiers: [1, 2, 3], make: (rng, tier) => floorPuzzle(rng, tier) },
];

// For the release test: the arrangement checks, so it can solve each puzzle from its words.
export const PUZZLE_TESTS = { rowTest, circleTest, floorTest, perms };
