// Live test reports and recommendations (livetest-insights.js): the rules, on attempts built by hand.
import { INSIGHT, outlineOf, expectedQuestions, attemptFacts, topicMastery, recommendations, highlight, recText, highlightText } from '../www/js/livetest-insights.js';
import { EXAMS, EXAM_IDS } from '../www/js/exams.js';
import { TEMPLATES, LABEL_HI } from '../www/js/engine/index.js';
import { QUANT } from '../www/js/engine/quant.js';
import { REASONING } from '../www/js/engine/reasoning.js';

let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const HINDI = /[ऀ-ॿ]/;

// A paper: n questions of a label in a section.
const paper = (...parts) => parts.flatMap(([label, sec, n, type = label]) => Array.from({ length: n }, () => [type, label, sec]));
// Answers from a marks string: seconds per question by mark, unless given.
const answersOf = (marks, secs = { r: 30, w: 30 }, unseenFrom = Infinity) => Object.fromEntries([...marks].map((m, i) => [i, m === '-' ? (i >= unseenFrom ? null : { c: null, s: 20 }) : { c: 0, s: secs[m] }]).filter(([, v]) => v));
const kinds = (recs) => recs.map((r) => r.kind).join(',');

// ---------- the exam's shape ----------
for (const id of EXAM_IDS) {
  const e = expectedQuestions(id);
  const exam = EXAMS[id];
  const sum = (sec) => Object.entries(e).filter(([label]) => (sec === 'quant' ? QUANT : REASONING).some((t) => t.label === label)).reduce((s, [, v]) => s + v, 0);
  const size = (name) => exam.sections.find(([n]) => n === name)?.[1];
  const q = size(exam.quantLabel || 'Quant'); const r = size('Reasoning');
  check(`${exam.short}: topics share out the real paper’s ${q} quant and ${r} reasoning questions`, Math.abs(sum('quant') - q) < 1e-6 && Math.abs(sum('reasoning') - r) < 1e-6, `${sum('quant').toFixed(2)} / ${sum('reasoning').toFixed(2)}`);
}
check('Every topic has an expected count', TEMPLATES.every((t) => expectedQuestions('ssc-cgl')[t.label] > 0));
check('outlineOf keeps the template, the topic and the section', JSON.stringify(outlineOf([{ type: 'percent-of', label: 'Percentages', topic: 'quant' }, { type: 'coding', label: 'Coding and decoding', topic: 'reasoning' }])) === '[["percent-of","Percentages","q"],["coding","Coding and decoding","r"]]');

// ---------- one attempt's facts ----------
const P = paper(['Percentages', 'q', 5], ['Averages', 'q', 5], ['Syllogism', 'r', 5], ['Ranking', 'r', 5]);
let marks = 'rrwww' + 'rrrr-' + 'rrrrr' + 'rw---';
let f = attemptFacts({ examId: 'ssc-cgl', outline: P, marks, answers: answersOf(marks, { r: 40, w: 12 }, 17), durationSec: 20 * 36, usedSec: 20 * 36, timedOut: true });
check('Counts: right, wrong, skipped, attempted, accuracy', f.right === 12 && f.wrong === 4 && f.skipped === 4 && f.attempted === 16 && f.accuracy === 75);
check('Marks lost to wrong answers follow the exam (4 × 0.5)', f.lost === 2);
check('Never opened: skipped with no time on them', f.unseen === 3 && f.sections.r.unseen === 3 && f.sections.q.unseen === 0);
check('Sections add up', f.sections.q.asked === 10 && f.sections.q.right === 6 && f.sections.r.right === 6);
check('Time: budget per question, median on right and wrong answers', f.budgetSec === 36 && f.rightSec === 40 && f.wrongSec === 12);
check('RRB loses a third of a mark each', attemptFacts({ examId: 'rrb-ntpc', outline: P, marks, answers: answersOf(marks), durationSec: 1080 }).lost === 1.33);

// ---------- recommendations from one test ----------
let recs = recommendations({ examId: 'ssc-cgl', facts: f, topics: [] });
check('Rushed wrong answers (12 s against 40 s) are named', recs.some((r) => r.kind === 'rush' && r.wrongSec === 12 && r.rightSec === 40), kinds(recs));
check('Three unseen of 20 is named (at least 3 and a tenth)', recs.some((r) => r.kind === 'unseen' && r.n === 3));
check('4 wrong of 16 attempted is under 30%: no negative-marking advice', !recs.some((r) => r.kind === 'negative'));
check('At most three, each with its facts', recs.length <= INSIGHT.maxRecs && recs.every((r) => !('score' in r)));

marks = 'wwwww' + 'wwrrr' + 'rrrrr' + 'rrrr-';
f = attemptFacts({ examId: 'ssc-cgl', outline: P, marks, answers: answersOf(marks), durationSec: 720, usedSec: 700 });
recs = recommendations({ examId: 'ssc-cgl', facts: f, topics: [] });
check('7 wrong of 19: marks lost to wrong answers (3.5) is named', recs.some((r) => r.kind === 'negative' && r.lost === 3.5 && r.wrong === 7), kinds(recs));
check('Quant at 30% against Reasoning at 90%: the weaker section is named', recs.some((r) => r.kind === 'section' && r.section === 'q' && r.pct === 30 && r.otherPct === 90), JSON.stringify(recs.find((r) => r.kind === 'section')));
check('Same speed on right and wrong: no speed advice', !recs.some((r) => r.kind === 'rush' || r.kind === 'stuck'));

// Stuck: wrong answers took far longer than right ones and than the budget.
f = attemptFacts({ examId: 'ssc-cgl', outline: P, marks: 'rrrww' + 'rrrrw' + 'rrrrr' + 'rrrrr', answers: answersOf('rrrww' + 'rrrrw' + 'rrrrr' + 'rrrrr', { r: 25, w: 80 }), durationSec: 720, usedSec: 715 });
check('Long on the ones got wrong (80 s against 25 s, budget 36): move on sooner', kinds(recommendations({ examId: 'ssc-cgl', facts: f })).includes('stuck'));

// Handed in early with wrong answers: recheck; and no "didn't reach" for what was left on purpose.
marks = 'rrrww' + 'rrr--' + 'rrrrr' + '-----';
f = attemptFacts({ examId: 'ssc-cgl', outline: P, marks, answers: answersOf(marks, { r: 30, w: 30 }, 15), durationSec: 720, usedSec: 400 });
recs = recommendations({ examId: 'ssc-cgl', facts: f });
check('Handed in with 5 minutes to spare and 5 questions unopened: open every question first', recs.some((r) => r.kind === 'early' && r.minutes === 5 && r.n === 5), kinds(recs));
check('…not "you didn’t reach them", and not "recheck" on top', !recs.some((r) => r.kind === 'unseen' || r.kind === 'spare'));
marks = 'rrrww' + 'rrrrr' + 'rrrrr' + 'rrrr-';
f = attemptFacts({ examId: 'ssc-cgl', outline: P, marks, answers: answersOf(marks), durationSec: 720, usedSec: 400 });
recs = recommendations({ examId: 'ssc-cgl', facts: f });
check('Handed in with 5 minutes to spare, everything opened, 2 wrong: recheck', recs.some((r) => r.kind === 'spare' && r.minutes === 5 && r.wrong === 2) && !recs.some((r) => r.kind === 'early'), kinds(recs));

// Ran out of time in the section they are better at: start with it.
marks = 'rwwww' + 'rwwr-' + 'rrrr-' + '-----';
f = attemptFacts({ examId: 'ssc-cgl', outline: P, marks, answers: answersOf(marks, { r: 60, w: 60 }, 14), durationSec: 720, usedSec: 720, timedOut: true });
const unseen = recommendations({ examId: 'ssc-cgl', facts: f }).find((r) => r.kind === 'unseen');
check('Unseen questions mostly in the stronger section: start with it', unseen && unseen.n === 6 && unseen.section === 'r', JSON.stringify(unseen));

// A clean test: nothing to fix.
f = attemptFacts({ examId: 'ssc-cgl', outline: P, marks: 'r'.repeat(19) + 'w', answers: answersOf('r'.repeat(19) + 'w'), durationSec: 720, usedSec: 700 });
check('19 of 20 right: no advice invented', recommendations({ examId: 'ssc-cgl', facts: f }).length === 0);

// ---------- topics across tests ----------
const test = (marksOf, batchRight, sat = 10) => ({ outline: P, marks: marksOf, batch: { sat, right: batchRight } });
const full = new Array(20).fill(7);
let m1 = topicMastery([test('rwwww' + 'rrrrr' + 'rrrww' + 'rrrrr', full)]);
const byLabel = (list) => Object.fromEntries(list.map((t) => [t.label, t]));
check('One test of 5 questions a topic: levels from the share right', byLabel(m1).Percentages.level === 'weak' && byLabel(m1).Averages.level === 'strong' && byLabel(m1).Syllogism.level === 'ok' && byLabel(m1).Percentages.pct === 20 && byLabel(m1).Percentages.batchPct === 70);
check('Weakest first', m1[0].label === 'Percentages');
const P1 = paper(['Percentages', 'q', 2], ['Averages', 'q', 2]);
let few = topicMastery([{ outline: P1, marks: 'wwrr', batch: { sat: 5, right: [4, 4, 4, 4] } }]);
check('Two questions on a topic: "not enough yet", whatever the score', few.every((t) => t.level === 'few'));
check('…and no topic is recommended from them', recommendations({ examId: 'ssc-cgl', topics: few }).length === 0);
few = topicMastery([{ outline: P1, marks: 'wwrr', batch: { sat: 5, right: [4, 4, 4, 4] } }, { outline: P1, marks: 'wwrr', batch: { sat: 5, right: [4, 4, 4, 4] } }]);
check('A second test brings them to four: now they count', byLabel(few).Percentages.level === 'weak' && byLabel(few).Percentages.asked === 4 && byLabel(few).Averages.level === 'strong');
recs = recommendations({ examId: 'ssc-cgl', topics: few });
check('The weak topic is recommended, with the marks it is worth', recs.length === 1 && recs[0].kind === 'topic' && recs[0].label === 'Percentages' && recs[0].right === 0 && recs[0].asked === 4 && recs[0].batchPct === 80 && recs[0].gain >= 1, JSON.stringify(recs[0]));
// The estimate: (target − own) × the topic's questions in the real paper × coverage × marks.
const expect = Math.max(1, Math.round(0.8 * expectedQuestions('ssc-cgl').Percentages * INSIGHT.coverage * 2));
check('…as (batch − own) × the topic’s share of the real paper × marks', recs[0].gain === expect, `${recs[0].gain} vs ${expect}`);
check('Well behind the batch counts even above 50%', recommendations({ examId: 'ssc-cgl', topics: [{ label: 'Averages', section: 'q', asked: 10, right: 6, pct: 60, batchPct: 85, level: 'ok' }] }).length === 1);
check('At the batch’s level: nothing to recommend', recommendations({ examId: 'ssc-cgl', topics: [{ label: 'Averages', section: 'q', asked: 10, right: 8, pct: 80, batchPct: 85, level: 'strong' }] }).length === 0);
// A weak topic named in a section replaces the vaguer "weaker section".
marks = 'wwwww' + 'wwrrr' + 'rrrrr' + 'rrrr-';
f = attemptFacts({ examId: 'ssc-cgl', outline: P, marks, answers: answersOf(marks), durationSec: 720, usedSec: 700 });
recs = recommendations({ examId: 'ssc-cgl', facts: f, topics: topicMastery([test(marks, full)]) });
check('With a weak topic named, the section line is dropped', recs.some((r) => r.kind === 'topic' && r.label === 'Percentages') && !recs.some((r) => r.kind === 'section'), kinds(recs));

// ---------- what went well ----------
const facts = (attempted, accuracy) => ({ attempted, accuracy });
check('Top of the batch', highlight({ facts: facts(10, 60), rank: 1, of: 8, scorePct: 60 })?.kind === 'top');
check('Top quarter', highlight({ facts: facts(10, 60), rank: 2, of: 8, scorePct: 60 })?.kind === 'quarter');
check('Better than last time', highlight({ facts: facts(10, 60), rank: 5, of: 8, scorePct: 48, prevPct: 40 })?.kind === 'up');
check('Accurate', highlight({ facts: facts(10, 85), rank: 5, of: 8, scorePct: 48, prevPct: 47 })?.kind === 'accuracy');
check('Nothing to praise: nothing said', highlight({ facts: facts(10, 40), rank: 7, of: 8, scorePct: 20, prevPct: 30 }) === null);
check('Alone in the test: not "top of the batch"', highlight({ facts: facts(10, 40), rank: 1, of: 1, scorePct: 20 }) === null);

// ---------- the words ----------
const all = [
  { kind: 'topic', label: 'Percentages', section: 'q', right: 2, asked: 5, pct: 40, batchPct: 70, gain: 2 },
  { kind: 'topic', label: 'Syllogism', section: 'r', right: 1, asked: 4, pct: 25, batchPct: 60, gain: 0 },
  { kind: 'section', section: 'q', right: 3, asked: 10, pct: 30, otherPct: 90 },
  { kind: 'unseen', n: 6, section: 'r', budget: 36 }, { kind: 'unseen', n: 4, section: null, budget: 36 },
  { kind: 'negative', lost: 3.5, wrong: 7 }, { kind: 'rush', wrongSec: 12, rightSec: 40 }, { kind: 'stuck', wrongSec: 80, rightSec: 25, budget: 36 },
  { kind: 'spare', minutes: 5, wrong: 2 }, { kind: 'spare', minutes: 1, wrong: 2 }, { kind: 'early', n: 6, minutes: 9 },
];
const en = all.map((r) => recText(r, 'ssc-cgl', 'en'));
const hi = all.map((r) => recText(r, 'ssc-cgl', 'hi'));
check('Every recommendation has a title and a body in English', en.every((t) => t && t.title && t.body && !HINDI.test(t.title + t.body)));
check('…and in Hindi', hi.every((t) => t && HINDI.test(t.title) && HINDI.test(t.body)));
check('No holes in the sentences', [...en, ...hi].every((t) => !/undefined|NaN|null|\[object/.test(t.title + t.body + (t.action?.label || ''))));
check('The topic line reads as designed', en[0].title === 'Practise Percentages' && en[0].body === 'You got 2 of 5 right (40%); your batch got 70%. Closing that gap is worth about 2 marks in SSC CGL.', en[0].body);
check('…and opens that topic’s practice', en[0].action.practice === 'Percentages' && en[0].action.topic === 'quant' && en[1].action.topic === 'reasoning');
check('No marks claimed when the gain is small', !/worth/.test(en[1].body) && !/अंक/.test(hi[1].body));
check('Hindi topic names come from the engine', hi[0].title.includes(LABEL_HI.Percentages));
check('The marking is the exam’s own', /\+2 \/ −0\.5/.test(en[5].body) && /\+1 \/ −⅓/.test(recText(all[5], 'rrb-ntpc', 'en').body) && /Wrong answers cost you 3\.5 marks/.test(en[5].title));
check('Railways call quant "Maths"', /Maths/.test(recText(all[2], 'rrb-ntpc', 'en').title) && /Quant/.test(en[2].title));
check('One minute is "1 minute"', /1 minute to spare/.test(en[9].title) && /5 minutes to spare/.test(en[8].title));
check('What went well, in both languages', ['top', 'quarter', 'up', 'accuracy'].every((kind) => highlightText({ kind, of: 8, rank: 2, from: 40, to: 48, pct: 85 }, 'en') && HINDI.test(highlightText({ kind, of: 8, rank: 2, from: 40, to: 48, pct: 85 }, 'hi'))) && highlightText(null) === '');

console.log(failed ? `\n${failed} failed` : '\nInsights: all checks passed.');
process.exit(failed ? 1 : 0);
