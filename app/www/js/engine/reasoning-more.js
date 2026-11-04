// Reasoning types added in question set 2 (Phase 1, design/01-exam-patterns.md §1.4):
// inequalities, syllogism, blood relations, word and letter analogy, classification.
// Answers are worked out here; tests/engine.test.mjs re-checks them independently
// (inequalities and syllogisms by trying every possible arrangement).
import { makeQuestion } from './build.js';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// The five answers used by inequality and syllogism questions in bank exams.
export const FOLLOW = {
  one: 'Only I follows',
  two: 'Only II follows',
  either: 'Either I or II follows',
  neither: 'Neither I nor II follows',
  both: 'Both I and II follow',
};
// The same answers as the Hindi papers word them.
const FOLLOW_HI = {
  [FOLLOW.one]: 'केवल निष्कर्ष I अनुसरण करता है',
  [FOLLOW.two]: 'केवल निष्कर्ष II अनुसरण करता है',
  [FOLLOW.either]: 'या तो निष्कर्ष I या II अनुसरण करता है',
  [FOLLOW.neither]: 'न तो निष्कर्ष I और न ही II अनुसरण करता है',
  [FOLLOW.both]: 'निष्कर्ष I और II दोनों अनुसरण करते हैं',
};
const followHi = (v) => FOLLOW_HI[v];

/** Picks the answer from whether each conclusion always holds, and whether exactly one holds in every case. */
function verdict(cases) {
  const one = cases.every((c) => c[0]);
  const two = cases.every((c) => c[1]);
  if (one && two) return FOLLOW.both;
  if (one) return FOLLOW.one;
  if (two) return FOLLOW.two;
  if (cases.every((c) => c[0] !== c[1])) return FOLLOW.either;
  return FOLLOW.neither;
}

// ---------- Inequalities ----------

const SIGNS = ['>', '≥', '=', '<', '≤'];
const holds = (op, diff) => (op === '>' ? diff > 0 : op === '≥' ? diff >= 0 : op === '=' ? diff === 0 : op === '<' ? diff < 0 : diff <= 0);
/** Signs X − Y can take along a chain of relations from X (position i) to Y (position j). */
function possibleSigns(rel, i, j) {
  if (i === j) return new Set([0]);
  const [lo, hi, flip] = i < j ? [i, j, 1] : [j, i, -1];
  const seg = rel.slice(lo, hi);
  const down = seg.every((r) => r === '>' || r === '≥' || r === '=');
  const up = seg.every((r) => r === '<' || r === '≤' || r === '=');
  let s;
  if (down && up) s = [0];
  else if (down) s = seg.some((r) => r === '>') ? [1] : [0, 1];
  else if (up) s = seg.some((r) => r === '<') ? [-1] : [0, -1];
  else s = [-1, 0, 1];
  return new Set(s.map((x) => x * flip));
}

function inequality(rng, tier) {
  const n = tier === 1 ? 4 : 5;
  const letters = rng.shuffle([...'ABCDEFGHJKLMNPQRSTUVWXYZ']).slice(0, n);
  const rel = Array.from({ length: n - 1 }, () => rng.pick(['>', '>', '≥', '<', '<', '≤', '=']));
  const pair = () => { const i = rng.int(0, n - 1); let j = rng.int(0, n - 1); while (j === i) j = rng.int(0, n - 1); return [i, j]; };
  let c1; let c2;
  if (rng.chance(0.3)) {
    // A complementary pair on the same two letters: often "either I or II".
    const [i, j] = pair();
    const [p, q] = rng.pick([['≥', '<'], ['>', '≤'], ['>', '='], ['<', '='], ['≤', '>']]);
    c1 = [i, p, j]; c2 = [i, q, j];
  } else {
    // About half the time a conclusion is one that is certain, so every answer comes up fairly.
    const conclusion = () => {
      const [i, j] = pair();
      const sure = SIGNS.filter((op) => [...possibleSigns(rel, i, j)].every((d) => holds(op, d)));
      return [i, sure.length && rng.chance(0.55) ? rng.pick(sure) : rng.pick(SIGNS), j];
    };
    c1 = conclusion(); c2 = conclusion();
  }
  // Every sign X − Y can take, per conclusion pair, decides the answer.
  const s1 = possibleSigns(rel, c1[0], c1[2]); const s2 = possibleSigns(rel, c2[0], c2[2]);
  let cases;
  if (c1[0] === c2[0] && c1[2] === c2[2]) cases = [...s1].map((d) => [holds(c1[1], d), holds(c2[1], d)]);
  else if (c1[0] === c2[2] && c1[2] === c2[0]) cases = [...s1].map((d) => [holds(c1[1], d), holds(c2[1], -d)]);
  else cases = [...s1].flatMap((d1) => [...s2].map((d2) => [holds(c1[1], d1), holds(c2[1], d2)]));
  const answer = verdict(cases);

  const coded = tier === 3;
  const symbols = rng.shuffle(['@', '#', '$', '%', '&']);
  const code = Object.fromEntries(SIGNS.map((s, k) => [s, symbols[k]]));
  const show = (x, op, y) => `${letters[x]} ${coded ? code[op] : op} ${letters[y]}`;
  const statement = coded
    ? rel.map((r, k) => show(k, r, k + 1)).join(', ')
    : letters.map((l, k) => (k < n - 1 ? `${l} ${rel[k]} ` : l)).join('');
  const key = SIGNS.map((s) => `${code[s]} means ${s}`).join(', ');
  const explain = ([x, op, y], s) => {
    const sure = [...s].every((d) => holds(op, d));
    const what = s.size === 3 ? 'the signs between them point both ways, so it is not certain'
      : sure ? 'this is certain from the statement' : 'this is not certain from the statement';
    return `${letters[x]} ${op} ${letters[y]}: ${what}`;
  };
  const keyHi = SIGNS.map((s) => `${code[s]} का अर्थ है ${s}`).join(', ');
  const explainHi = ([x, op, y], s) => {
    const sure = [...s].every((d) => holds(op, d));
    const what = s.size === 3 ? `${letters[x]} और ${letters[y]} के बीच विपरीत दिशा के चिह्न हैं, इसलिए यह निश्चित नहीं है`
      : sure ? 'यह कथन से निश्चित है' : 'यह कथन से निश्चित नहीं है';
    return `${letters[x]} ${op} ${letters[y]}: ${what}`;
  };
  return makeQuestion(rng, {
    type: 'inequality', topic: 'reasoning',
    text: `${coded ? `Codes: ${key}
` : ''}Statement: ${statement}
Conclusions:
I. ${show(...c1)}
II. ${show(...c2)}`,
    answer,
    wrong: Object.values(FOLLOW).filter((v) => v !== answer),
    steps: [
      ...(coded ? [`Decode the signs: ${rel.map((r, k) => `${letters[k]} ${r} ${letters[k + 1]}`).join(', ')}`] : []),
      `I. ${explain(c1, s1)}`,
      `II. ${explain(c2, s2)}`,
    ],
    hi: {
      text: `${coded ? `कूट: ${keyHi}
` : ''}कथन: ${statement}
निष्कर्ष:
I. ${show(...c1)}
II. ${show(...c2)}`,
      fmt: followHi,
      steps: [
        ...(coded ? [`चिह्नों को डिकोड करें: ${rel.map((r, k) => `${letters[k]} ${r} ${letters[k + 1]}`).join(', ')}`] : []),
        `I. ${explainHi(c1, s1)}`,
        `II. ${explainHi(c2, s2)}`,
      ],
    },
  });
}

// ---------- Syllogism ----------

const THINGS = [['pen', 'pens', 'कलम', 'कलमें'], ['book', 'books', 'किताब', 'किताबें'], ['chair', 'chairs', 'कुर्सी', 'कुर्सियाँ'],
  ['table', 'tables', 'मेज़', 'मेज़ें'], ['cup', 'cups', 'कप', 'कप'], ['phone', 'phones', 'फ़ोन', 'फ़ोन'],
  ['bag', 'bags', 'बैग', 'बैग'], ['car', 'cars', 'कार', 'कारें'], ['tree', 'trees', 'पेड़', 'पेड़'], ['bird', 'birds', 'पक्षी', 'पक्षी'],
  ['box', 'boxes', 'डिब्बा', 'डिब्बे'], ['ring', 'rings', 'अंगूठी', 'अंगूठियाँ'], ['lamp', 'lamps', 'लैंप', 'लैंप'],
  ['coin', 'coins', 'सिक्का', 'सिक्के'], ['kite', 'kites', 'पतंग', 'पतंगें'], ['door', 'doors', 'दरवाज़ा', 'दरवाज़े'],
  ['shirt', 'shirts', 'कमीज़', 'कमीज़ें'], ['bottle', 'bottles', 'बोतल', 'बोतलें']];
const KINDS = ['all', 'some', 'no', 'somenot'];
/** Is a statement true in a world (a set of non-empty regions of the three-circle diagram)? */
export function syllogismTrue(kind, x, y, world) {
  const has = (m) => world.some((r) => (m(r)));
  const inX = (r) => (r >> x) & 1; const inY = (r) => (r >> y) & 1;
  if (kind === 'all') return !has((r) => inX(r) && !inY(r));
  if (kind === 'some') return has((r) => inX(r) && inY(r));
  if (kind === 'no') return !has((r) => inX(r) && inY(r));
  return has((r) => inX(r) && !inY(r)); // some X are not Y
}
/** Every picture (choice of non-empty regions) where all three groups exist and the statements hold. */
export function syllogismWorlds(statements) {
  const worlds = [];
  for (let mask = 1; mask < 128; mask++) {
    const world = [1, 2, 3, 4, 5, 6, 7].filter((r) => (mask >> (r - 1)) & 1);
    if (![0, 1, 2].every((s) => world.some((r) => (r >> s) & 1))) continue;
    if (statements.every(([k, x, y]) => syllogismTrue(k, x, y, world))) worlds.push(world);
  }
  return worlds;
}

function syllogism(rng, tier) {
  const [a, b, c] = rng.shuffle(THINGS).slice(0, 3);
  const nouns = [a, b, c];
  const say = ([k, x, y]) => {
    const X = nouns[x]; const Y = nouns[y];
    if (k === 'all') return `All ${X[1]} are ${Y[1]}`;
    if (k === 'some') return `Some ${X[1]} are ${Y[1]}`;
    if (k === 'no') return `No ${X[0]} is a ${Y[0]}`;
    return `Some ${X[1]} are not ${Y[1]}`;
  };
  const sayHi = ([k, x, y]) => {
    const X = nouns[x]; const Y = nouns[y];
    if (k === 'all') return `सभी ${X[3]} ${Y[3]} हैं`;
    if (k === 'some') return `कुछ ${X[3]} ${Y[3]} हैं`;
    if (k === 'no') return `कोई ${X[2]} ${Y[2]} नहीं है`;
    return `कुछ ${X[3]} ${Y[3]} नहीं हैं`;
  };
  const kinds = tier === 1 ? ['all', 'some', 'no'] : KINDS;
  const st = (x, y) => (rng.chance(0.5) ? [rng.pick(kinds), x, y] : [rng.pick(kinds), y, x]);
  const statements = [st(0, 1), st(1, 2)];
  const worlds = syllogismWorlds(statements);
  let c1; let c2;
  if (rng.chance(0.3)) {
    const [x, y] = rng.chance(0.5) ? [0, 2] : [2, 0];
    const [p, q] = rng.pick([['some', 'no'], ['all', 'somenot']]);
    [c1, c2] = rng.shuffle([[p, x, y], [q, x, y]]);
  } else {
    const pairs = [[0, 2], [2, 0], [0, 1], [1, 0], [1, 2], [2, 1]];
    // About half the time a conclusion is one that follows, so every answer comes up fairly.
    const conclusion = () => {
      const all = kinds.flatMap((k) => pairs.map(([x, y]) => [k, x, y]));
      const sure = all.filter((con) => worlds.every((w) => syllogismTrue(...con, w)));
      return sure.length && rng.chance(0.5) ? rng.pick(sure) : rng.pick(all);
    };
    c1 = conclusion(); c2 = conclusion();
    if (c2.join() === c1.join()) c2 = [c2[0] === 'some' ? 'no' : 'some', c2[1], c2[2]];
  }
  const answer = verdict(worlds.map((w) => [syllogismTrue(...c1, w), syllogismTrue(...c2, w)]));
  const sure = (con) => worlds.every((w) => syllogismTrue(...con, w));
  return makeQuestion(rng, {
    type: 'syllogism', topic: 'reasoning',
    text: `Statements: ${statements.map(say).join('. ')}.
Conclusions:
I. ${say(c1)}.
II. ${say(c2)}.`,
    answer,
    wrong: Object.values(FOLLOW).filter((v) => v !== answer),
    steps: [
      `Draw the statements as circles and try every way they can be drawn`,
      `I. ${say(c1)}: ${sure(c1) ? 'true in every drawing' : 'not true in every drawing'}`,
      `II. ${say(c2)}: ${sure(c2) ? 'true in every drawing' : 'not true in every drawing'}`,
    ],
    hi: {
      text: `कथन: ${statements.map(sayHi).join('। ')}।
निष्कर्ष:
I. ${sayHi(c1)}।
II. ${sayHi(c2)}।`,
      fmt: followHi,
      steps: [
        'कथनों को वेन आरेख (वृत्तों) द्वारा दर्शाएँ और सभी संभावित आरेख जाँचें',
        `I. ${sayHi(c1)}: ${sure(c1) ? 'हर आरेख में सत्य' : 'हर आरेख में सत्य नहीं'}`,
        `II. ${sayHi(c2)}: ${sure(c2) ? 'हर आरेख में सत्य' : 'हर आरेख में सत्य नहीं'}`,
      ],
    },
  });
}

// ---------- Blood relations ----------

// X's relation to Y, then Y's to Z, give X's relation to Z. [male word, female word] for each.
// Y's own word is chosen by Y's gender; in some patterns Y's gender is fixed by X's.
const PATTERNS = [
  { xy: ['father', 'mother'], yz: ['brother', 'sister'], xz: ['Father', 'Mother'] },
  { xy: ['brother', 'sister'], yz: ['father', 'mother'], xz: ['Uncle', 'Aunt'] },
  { xy: ['son', 'daughter'], yz: ['brother', 'sister'], xz: ['Nephew', 'Niece'] },
  { xy: ['father', 'mother'], yz: ['father', 'mother'], xz: ['Grandfather', 'Grandmother'] },
  { xy: ['son', 'daughter'], yz: ['son', 'daughter'], xz: ['Grandson', 'Granddaughter'] },
  { xy: ['husband', 'wife'], yz: ['father', 'mother'], xz: ['Father', 'Mother'], yOpposite: true },
  { xy: ['brother', 'sister'], yz: ['son', 'daughter'], xz: ['Son', 'Daughter'] },
  { xy: ['husband', 'wife'], yz: ['brother', 'sister'], xz: ['Brother-in-law', 'Sister-in-law'], yOpposite: true },
  { xy: ['father', 'mother'], yz: ['husband', 'wife'], xz: ['Father-in-law', 'Mother-in-law'] },
  { xy: ['son', 'daughter'], yz: ['father', 'mother'], xz: ['Brother', 'Sister'] },
];
const ALL_RELATIONS = ['Father', 'Mother', 'Brother', 'Sister', 'Son', 'Daughter', 'Uncle', 'Aunt', 'Nephew', 'Niece', 'Grandfather',
  'Grandmother', 'Grandson', 'Granddaughter', 'Cousin', 'Father-in-law', 'Mother-in-law', 'Brother-in-law', 'Sister-in-law', 'Husband', 'Wife'];
// Hindi: the words of the statements, and each pattern's answer by [X's gender][Y's gender]
// (Y decides the side of the family: father's brother चाचा, mother's brother मामा, and so on).
const REL_WORD_HI = { father: 'पिता', mother: 'माता', brother: 'भाई', sister: 'बहन', son: 'पुत्र', daughter: 'पुत्री', husband: 'पति', wife: 'पत्नी' };
const ANSWER_HI = [
  [['पिता', 'पिता'], ['माता', 'माता']],
  [['चाचा', 'मामा'], ['बुआ', 'मौसी']],
  [['भतीजा', 'भांजा'], ['भतीजी', 'भांजी']],
  [['दादा', 'नाना'], ['दादी', 'नानी']],
  [['पोता', 'नाती'], ['पोती', 'नातिन']],
  [['पिता', 'पिता'], ['माता', 'माता']],
  [['पुत्र', 'पुत्र'], ['पुत्री', 'पुत्री']],
  [['जीजा', 'जीजा'], ['भाभी', 'भाभी']],
  [['ससुर', 'ससुर'], ['सास', 'सास']],
  [['भाई', 'भाई'], ['बहन', 'बहन']],
];
// Other relations, as wrong options.
const REL_HI = {
  Father: 'पिता', Mother: 'माता', Brother: 'भाई', Sister: 'बहन', Son: 'पुत्र', Daughter: 'पुत्री', Uncle: 'चाचा', Aunt: 'बुआ',
  Nephew: 'भतीजा', Niece: 'भतीजी', Grandfather: 'दादा', Grandmother: 'दादी', Grandson: 'पोता', Granddaughter: 'पोती', Cousin: 'चचेरा भाई',
  'Father-in-law': 'ससुर', 'Mother-in-law': 'सास', 'Brother-in-law': 'जीजा', 'Sister-in-law': 'भाभी', Husband: 'पति', Wife: 'पत्नी',
};
// A relation passes from Z to Z's brother or sister (same parents, grandparents, uncles and aunts).
const SHARED = ['Father', 'Mother', 'Grandfather', 'Grandmother', 'Uncle', 'Aunt'];

function bloodRelation(rng, tier) {
  const [X, Y, Z, W] = rng.shuffle([...'ABCDEFGHJKLMNPQRSTUVW']).slice(0, 4);
  let pattern = rng.pick(PATTERNS);
  if (tier === 3) while (!pattern.xz.some((r) => SHARED.includes(r))) pattern = rng.pick(PATTERNS);
  const xg = rng.int(0, 1); // 0 male, 1 female
  const yg = pattern.yOpposite ? 1 - xg : rng.int(0, 1);
  const lines = [`${X} is the ${pattern.xy[xg]} of ${Y}`, `${Y} is the ${pattern.yz[yg]} of ${Z}`];
  let answer = pattern.xz[xg];
  let target = Z;
  const steps = [`${X} is the ${pattern.xy[xg]} of ${Y}, and ${Y} is the ${pattern.yz[yg]} of ${Z}, so ${X} is ${Z}'s ${answer.toLowerCase()}`];
  const ka = (g) => (g ? 'की' : 'का');
  const answerHi = ANSWER_HI[PATTERNS.indexOf(pattern)][xg][yg];
  const linesHi = [`${X}, ${Y} ${ka(xg)} ${REL_WORD_HI[pattern.xy[xg]]} है`, `${Y}, ${Z} ${ka(yg)} ${REL_WORD_HI[pattern.yz[yg]]} है`];
  const stepsHi = [`${linesHi[0]} और ${linesHi[1]}, इसलिए ${X}, ${Z} ${ka(xg)} ${answerHi} है`];
  if (tier === 3) {
    const zg = rng.int(0, 1);
    lines.push(`${Z} is the ${['brother', 'sister'][zg]} of ${W}`);
    steps.push(`${Z} and ${W} are siblings, so ${X} is ${W}'s ${answer.toLowerCase()} too`);
    linesHi.push(`${Z}, ${W} ${ka(zg)} ${['भाई', 'बहन'][zg]} है`);
    stepsHi.push(`${Z} और ${W} भाई-बहन हैं, इसलिए ${X}, ${W} ${ka(xg)} भी ${answerHi} है`);
    target = W;
  }
  return makeQuestion(rng, {
    type: 'blood-relation', topic: 'reasoning',
    text: `${lines.join('. ')}. How is ${X} related to ${target}?`,
    answer,
    wrong: rng.shuffle(ALL_RELATIONS.filter((r) => r !== answer)),
    steps,
    hi: {
      text: `${linesHi.join('। ')}। ${X}, ${target} से किस प्रकार संबंधित है?`,
      fmt: (r) => (r === answer ? answerHi : REL_HI[r]),
      steps: stepsHi,
    },
  });
}

// ---------- Word analogy ----------

// Each group: pairs with one relation. Within a group every second word is different, so only
// one option completes the pair.
// Each pair: [English, English, Hindi, Hindi]. Within a group the Hindi second words differ too.
const ANALOGY_GROUPS = [
  { what: 'a tool and what it is used for', whatHi: 'एक वस्तु और उसका उपयोग', pairs: [['Pen', 'Write', 'कलम', 'लिखना'], ['Knife', 'Cut', 'चाकू', 'काटना'], ['Broom', 'Sweep', 'झाड़ू', 'बुहारना'], ['Needle', 'Sew', 'सुई', 'सिलना'], ['Spade', 'Dig', 'फावड़ा', 'खोदना'], ['Oven', 'Bake', 'ओवन', 'सेंकना'], ['Axe', 'Chop', 'कुल्हाड़ी', 'चीरना'], ['Eraser', 'Rub', 'रबड़', 'मिटाना'], ['Key', 'Unlock', 'चाबी', 'खोलना'], ['Ladder', 'Climb', 'सीढ़ी', 'चढ़ना']] },
  { what: 'a worker and where they work', whatHi: 'एक कर्मचारी और उसके काम करने की जगह', pairs: [['Doctor', 'Hospital', 'डॉक्टर', 'अस्पताल'], ['Teacher', 'School', 'शिक्षक', 'विद्यालय'], ['Chef', 'Kitchen', 'रसोइया', 'रसोईघर'], ['Pilot', 'Cockpit', 'पायलट', 'कॉकपिट'], ['Farmer', 'Field', 'किसान', 'खेत'], ['Judge', 'Court', 'न्यायाधीश', 'न्यायालय'], ['Sailor', 'Ship', 'नाविक', 'जहाज़'], ['Miner', 'Mine', 'खनिक', 'खान'], ['Librarian', 'Library', 'पुस्तकालयाध्यक्ष', 'पुस्तकालय'], ['Mechanic', 'Garage', 'मिस्त्री', 'गैराज']] },
  { what: 'an animal and its young one', whatHi: 'एक जीव और उसका बच्चा', pairs: [['Dog', 'Puppy', 'कुत्ता', 'पिल्ला'], ['Cat', 'Kitten', 'बिल्ली', 'बिलौटा'], ['Cow', 'Calf', 'गाय', 'बछड़ा'], ['Lion', 'Cub', 'शेर', 'शावक'], ['Hen', 'Chick', 'मुर्गी', 'चूज़ा'], ['Horse', 'Foal', 'घोड़ा', 'बछेड़ा'], ['Sheep', 'Lamb', 'भेड़', 'मेमना'], ['Frog', 'Tadpole', 'मेंढक', 'बेंगची'], ['Duck', 'Duckling', 'बत्तख', 'बत्तख का बच्चा'], ['Goat', 'Kid', 'बकरी', 'छौना']] },
  { what: 'an animal and its home', whatHi: 'एक जीव और उसका घर', pairs: [['Bee', 'Hive', 'मधुमक्खी', 'छत्ता'], ['Bird', 'Nest', 'पक्षी', 'घोंसला'], ['Horse', 'Stable', 'घोड़ा', 'अस्तबल'], ['Spider', 'Web', 'मकड़ी', 'जाला'], ['Rabbit', 'Burrow', 'खरगोश', 'बिल'], ['Dog', 'Kennel', 'कुत्ता', 'कुत्ताघर'], ['Pig', 'Sty', 'सूअर', 'सूअरबाड़ा'], ['Lion', 'Den', 'शेर', 'माँद'], ['Ant', 'Anthill', 'दीमक', 'बाँबी'], ['Fish', 'Aquarium', 'मछली', 'मछलीघर']] },
  { what: 'opposites', whatHi: 'विलोम (उलटे अर्थ वाले) शब्द', pairs: [['Hot', 'Cold', 'गर्म', 'ठंडा'], ['Early', 'Late', 'जल्दी', 'देर'], ['Rich', 'Poor', 'अमीर', 'गरीब'], ['Strong', 'Weak', 'मज़बूत', 'कमज़ोर'], ['Ancient', 'Modern', 'प्राचीन', 'आधुनिक'], ['Victory', 'Defeat', 'जीत', 'हार'], ['Expand', 'Contract', 'फैलना', 'सिकुड़ना'], ['Accept', 'Reject', 'स्वीकार', 'अस्वीकार'], ['Arrive', 'Depart', 'आना', 'जाना'], ['Optimist', 'Pessimist', 'आशावादी', 'निराशावादी']] },
  { what: 'a quantity and its SI unit', whatHi: 'एक भौतिक राशि और उसकी SI इकाई', pairs: [['Length', 'Metre', 'लंबाई', 'मीटर'], ['Mass', 'Kilogram', 'द्रव्यमान', 'किलोग्राम'], ['Time', 'Second', 'समय', 'सेकंड'], ['Current', 'Ampere', 'विद्युत धारा', 'एम्पियर'], ['Temperature', 'Kelvin', 'ताप', 'केल्विन'], ['Force', 'Newton', 'बल', 'न्यूटन'], ['Energy', 'Joule', 'ऊर्जा', 'जूल'], ['Power', 'Watt', 'शक्ति', 'वाट'], ['Pressure', 'Pascal', 'दाब', 'पास्कल'], ['Resistance', 'Ohm', 'प्रतिरोध', 'ओम']] },
];

// ---------- Letter patterns ----------

const L = (i) => ALPHA[i];

export const MORE_REASONING = [
  { id: 'inequality', label: 'Inequalities', since: 2, tiers: [1, 2, 3], make: (rng, tier) => inequality(rng, tier) },
  { id: 'syllogism', label: 'Syllogism', since: 2, tiers: [1, 2, 3], make: (rng, tier) => syllogism(rng, tier) },
  { id: 'blood-relation', label: 'Blood relations', since: 2, tiers: [1, 2, 3], make: (rng, tier) => bloodRelation(rng, tier) },
  {
    id: 'word-analogy',
    label: 'Word analogy',
    since: 2,
    tiers: [1, 2],
    make(rng) {
      const group = rng.pick(ANALOGY_GROUPS);
      const [p1, p2, ...rest] = rng.shuffle(group.pairs);
      return makeQuestion(rng, {
        type: 'word-analogy', topic: 'reasoning',
        text: `${p1[0]} : ${p1[1]} :: ${p2[0]} : ?`,
        answer: p2[1],
        wrong: rest.map((p) => p[1]),
        steps: [`${p1[0]} and ${p1[1]} are ${group.what}`, `In the same way, ${p2[0]} goes with ${p2[1]}`],
        hi: {
          text: `${p1[2]} : ${p1[3]} :: ${p2[2]} : ?`,
          fmt: (w) => group.pairs.find((p) => p[1] === w)[3],
          steps: [`${p1[2]} और ${p1[3]}: ${group.whatHi}`, `इसी प्रकार, ${p2[2]} : ${p2[3]}`],
        },
      });
    },
  },
  {
    id: 'letter-analogy',
    label: 'Letter analogy',
    since: 2,
    tiers: [2, 3],
    make(rng) {
      const g = rng.int(1, 3); const k = rng.int(2, 6);
      const x = rng.int(0, 25 - g - k); let y = rng.int(0, 25 - g - k);
      while (y === x) y = rng.int(0, 25 - g - k);
      const pair = (i) => L(i) + L(i + g);
      const answer = pair(y + k);
      return makeQuestion(rng, {
        type: 'letter-analogy', topic: 'reasoning',
        text: `${pair(x)} : ${pair(x + k)} :: ${pair(y)} : ?`,
        answer,
        // All inside A–Z: y + k ≥ 2 and y + g + k ≤ 25.
        wrong: [L(y + k - 1) + L(y + k + g - 1), L(y + k + g) + L(y + k), L(y + k - 1) + L(y + k + g), L(y + k - 2) + L(y + k + g - 2)],
        steps: [`Each letter of ${pair(x)} moves ${k} places forward: ${pair(x)} → ${pair(x + k)}`, `So ${pair(y)} → ${answer}`],
        hi: {
          text: `${pair(x)} : ${pair(x + k)} :: ${pair(y)} : ?`,
          steps: [`${pair(x)} का हर अक्षर ${k} स्थान आगे जाता है: ${pair(x)} → ${pair(x + k)}`, `इसलिए ${pair(y)} → ${answer}`],
        },
      });
    },
  },
  {
    id: 'letter-classify',
    label: 'Classification',
    since: 2,
    tiers: [1, 2],
    make(rng, tier) {
      const s = rng.int(tier === 1 ? 1 : 2, tier === 1 ? 2 : 4);
      const group = (i, last = s) => L(i) + L(i + s) + L(i + s + last);
      const starts = new Set();
      while (starts.size < 4) starts.add(rng.int(0, 25 - 2 * s - 1));
      const [odd, ...fine] = [...starts];
      const answer = group(odd, s + 1);
      return makeQuestion(rng, {
        type: 'letter-classify', topic: 'reasoning',
        text: 'Which group of letters does not belong with the others?',
        answer,
        wrong: fine.map((i) => group(i)),
        steps: [`In ${fine.map((i) => group(i)).join(', ')} each letter is ${s} place${s > 1 ? 's' : ''} after the one before`, `In ${answer} the last gap is ${s + 1}, so it is the odd one`],
        hi: {
          text: 'अक्षरों का कौन-सा समूह अन्य समूहों से भिन्न है?',
          steps: [`${fine.map((i) => group(i)).join(', ')} में हर अक्षर पिछले अक्षर से ${s} स्थान आगे है`, `${answer} में अंतिम अंतर ${s + 1} है, इसलिए यह भिन्न है`],
        },
      });
    },
  },
];
