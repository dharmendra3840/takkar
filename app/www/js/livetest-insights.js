// What a student's live tests say about them, and what to do next (design/03 §3.4 "Reports and recommendations").
// Rules only, no AI: every line comes from the student's own answers, their batch's, and their exam's pattern,
// so it can be checked. The server works out the facts and recommendations; the app words them in English or Hindi.
// Only the tutor's live tests are used, never a student's own duels or practice.
import { EXAMS, quantName } from './exams.js';
import { QUANT } from './engine/quant.js';
import { REASONING } from './engine/reasoning.js';
import { LABEL_HI } from './engine/index.js';

export const INSIGHT = {
  topicMin: 4, // questions on a topic, across the league's tests, before it is called strong or weak
  weakBelow: 50, strongFrom: 75, // % right
  behindBy: 20, // points behind the batch that make a topic worth practising
  targetFloor: 70, targetCap: 90, // the accuracy a "marks to gain" estimate aims for: the batch's, within these
  sectionMin: 5, // questions in a section before the sections are compared
  unseenMin: 3, unseenShare: 0.1, // questions never opened: at least 3 and a tenth of the paper
  wrongMin: 3, wrongShare: 0.3, // wrong answers: at least 3 and 30% of those attempted
  rushRatio: 0.6, stuckRatio: 1.5, // wrong answers' median time against right answers'
  spareShare: 0.25, // of the duration left unused
  coverage: 0.7, // Takkar's bank leaves out some of the real paper's topics (geometry, DI), so a topic's share of it is scaled down
  maxRecs: 3,
};

const SECTIONS = { q: QUANT, r: REASONING };
const pctOf = (right, asked) => (asked ? Math.round((right / asked) * 100) : 0);
const median = (list) => { const s = [...list].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/** One entry per question, in the paper's order: [template id, topic label, 'q' | 'r']. Stored with the test. */
export const outlineOf = (paper) => paper.map((q) => [q.type, q.label, q.topic === 'quant' ? 'q' : 'r']);

/** How many questions on each topic the real paper has, on average: the section's size shared out by the exam's weights. */
export function expectedQuestions(examId) {
  const exam = EXAMS[examId];
  const out = {};
  if (!exam) return out;
  for (const [sec, templates] of Object.entries(SECTIONS)) {
    const name = sec === 'q' ? quantName(exam) : 'Reasoning';
    const size = (exam.sections.find(([n]) => n === name) || exam.sections.find(([n]) => n === (sec === 'q' ? 'Quant' : 'Reasoning')) || [0, 25])[1];
    const w = (t) => exam.weights?.[t.id] ?? 1;
    const total = templates.reduce((s, t) => s + w(t), 0);
    for (const t of templates) out[t.label] = (out[t.label] || 0) + (size * w(t)) / total;
  }
  return out;
}

/**
 * How one attempt went. marks: 'r' | 'w' | '-' per question; answers: by paper index, { c, s } (choice, seconds).
 * usedSec: from the student's start to their submit; timedOut: the clock ended it.
 */
export function attemptFacts({ examId, outline, marks, answers = {}, durationSec, usedSec = null, timedOut = false }) {
  const exam = EXAMS[examId];
  const count = outline.length;
  const f = { count, right: 0, wrong: 0, skipped: 0, unseen: 0, seconds: 0, sections: { q: sec(), r: sec() }, rightSecs: [], wrongSecs: [] };
  function sec() { return { asked: 0, right: 0, wrong: 0, unseen: 0 }; }
  outline.forEach(([, , s], i) => {
    const a = answers[i];
    const m = marks[i];
    const part = f.sections[s];
    part.asked++;
    f.seconds += a?.s || 0;
    if (m === 'r') { f.right++; part.right++; f.rightSecs.push(a?.s || 0); }
    else if (m === 'w') { f.wrong++; part.wrong++; f.wrongSecs.push(a?.s || 0); }
    else {
      f.skipped++;
      // Never opened: no record of it, or no time on it.
      if (!a || !a.s) { f.unseen++; part.unseen++; }
    }
  });
  f.attempted = f.right + f.wrong;
  f.accuracy = f.attempted ? pctOf(f.right, f.attempted) : null;
  f.lost = Math.round(f.wrong * exam.negative * 100) / 100;
  f.budgetSec = Math.round(durationSec / count);
  const seen = count - f.unseen;
  f.secPerQuestion = seen ? Math.round(f.seconds / seen) : 0;
  f.rightSec = median(f.rightSecs);
  f.wrongSec = median(f.wrongSecs);
  f.durationSec = durationSec;
  f.spareSec = usedSec === null || timedOut ? 0 : Math.max(0, durationSec - usedSec);
  return f;
}

/**
 * Topics across tests. tests: [{ outline, marks, batch: { sat, right: [per question] } }], oldest first.
 * level: 'few' (under INSIGHT.topicMin questions), 'weak', 'ok' or 'strong'.
 */
export function topicMastery(tests) {
  const by = {};
  for (const t of tests) {
    t.outline.forEach(([, label, s], i) => {
      const o = (by[label] ||= { label, section: s, asked: 0, right: 0, batchAsked: 0, batchRight: 0 });
      o.asked++;
      if (t.marks[i] === 'r') o.right++;
      o.batchAsked += t.batch?.sat || 0;
      o.batchRight += t.batch?.right?.[i] || 0;
    });
  }
  return Object.values(by).map((o) => {
    const pct = pctOf(o.right, o.asked);
    return { label: o.label, section: o.section, asked: o.asked, right: o.right, pct, batchPct: pctOf(o.batchRight, o.batchAsked),
      level: o.asked < INSIGHT.topicMin ? 'few' : pct >= INSIGHT.strongFrom ? 'strong' : pct < INSIGHT.weakBelow ? 'weak' : 'ok' };
  }).sort((a, b) => a.pct - b.pct || b.asked - a.asked || a.label.localeCompare(b.label));
}

/**
 * The recommendations, most marks first. facts: one attempt's (null on the progress page, which has topics only);
 * topics: topicMastery() over the league's tests so far.
 */
export function recommendations({ examId, facts = null, topics = [] }) {
  const exam = EXAMS[examId];
  const I = INSIGHT;
  const recs = [];
  const expected = expectedQuestions(examId);

  // Topics to practise: enough questions to judge, and weak or well behind the batch.
  const weakIn = { q: false, r: false };
  for (const t of topics) {
    if (t.asked < I.topicMin) continue;
    if (!(t.pct < I.weakBelow || t.pct <= t.batchPct - I.behindBy)) continue;
    const target = Math.min(I.targetCap, Math.max(t.batchPct, I.targetFloor));
    if (t.pct >= target) continue;
    const gain = ((target - t.pct) / 100) * (expected[t.label] || 0) * I.coverage * exam.marks;
    weakIn[t.section] = true;
    recs.push({ kind: 'topic', label: t.label, section: t.section, right: t.right, asked: t.asked, pct: t.pct, batchPct: t.batchPct, gain: gain >= 0.75 ? Math.max(1, Math.round(gain)) : 0, score: gain + 0.5 });
  }

  if (facts) {
    const f = facts;
    const spare = f.spareSec >= I.spareShare * f.durationSec;
    // Questions never reached (not when they handed in early: then leaving them was a choice).
    if (!spare && f.unseen >= Math.max(I.unseenMin, Math.ceil(I.unseenShare * f.count))) {
      // If they were mostly in the section this student does better in, that section should come first.
      const [a, b] = f.sections.q.unseen >= f.sections.r.unseen ? ['q', 'r'] : ['r', 'q'];
      const seenA = f.sections[a].asked - f.sections[a].unseen;
      const better = f.sections[a].unseen >= 0.7 * f.unseen && seenA >= 3 && f.sections[b].asked >= 3
        && pctOf(f.sections[a].right, seenA) > pctOf(f.sections[b].right, f.sections[b].asked - f.sections[b].unseen || 1);
      recs.push({ kind: 'unseen', n: f.unseen, section: better ? a : null, budget: f.budgetSec, score: f.unseen * ((f.accuracy ?? 50) / 100) * exam.marks });
    }
    // Marks lost to wrong answers.
    if (f.wrong >= I.wrongMin && f.wrong >= I.wrongShare * f.attempted) {
      recs.push({ kind: 'negative', lost: f.lost, wrong: f.wrong, score: f.lost });
    }
    // Speed: wrong answers given much faster, or much slower, than right ones.
    if (f.wrongSecs.length >= 3 && f.rightSecs.length >= 3 && f.rightSec > 0) {
      if (f.wrongSec <= I.rushRatio * f.rightSec) {
        const n = f.wrongSecs.filter((s) => s <= I.rushRatio * f.rightSec).length;
        recs.push({ kind: 'rush', wrongSec: f.wrongSec, rightSec: f.rightSec, score: n * (exam.marks + exam.negative) * 0.5 });
      } else if (f.wrongSec >= I.stuckRatio * f.rightSec && f.wrongSec > f.budgetSec) {
        const n = f.wrongSecs.filter((s) => s >= I.stuckRatio * f.rightSec).length;
        recs.push({ kind: 'stuck', wrongSec: f.wrongSec, rightSec: f.rightSec, budget: f.budgetSec, score: n * exam.marks * 0.3 });
      }
    }
    // Handed in early with questions never opened: those come before rechecking.
    const early = spare && f.unseen >= Math.max(I.unseenMin, Math.ceil(I.unseenShare * f.count));
    if (early) recs.push({ kind: 'early', n: f.unseen, minutes: Math.floor(f.spareSec / 60), score: f.unseen * ((f.accuracy ?? 50) / 100) * exam.marks + 0.5 });
    // Time left over, with wrong answers that a second look might have caught.
    if (spare && !early && f.wrong >= 2) recs.push({ kind: 'spare', minutes: Math.floor(f.spareSec / 60), wrong: f.wrong, score: f.wrong * exam.marks * 0.15 });
    // A weaker section, when no single topic in it has enough questions to name yet.
    const q = f.sections.q; const r = f.sections.r;
    if (q.asked >= I.sectionMin && r.asked >= I.sectionMin) {
      const pq = pctOf(q.right, q.asked); const pr = pctOf(r.right, r.asked);
      const low = pq <= pr - I.behindBy ? 'q' : pr <= pq - I.behindBy ? 'r' : null;
      if (low && !weakIn[low]) {
        const s = f.sections[low];
        recs.push({ kind: 'section', section: low, right: s.right, asked: s.asked, pct: low === 'q' ? pq : pr, otherPct: low === 'q' ? pr : pq, score: (Math.abs(pq - pr) / 100) * s.asked * exam.marks * 0.5 });
      }
    }
  }
  return recs.sort((x, y) => y.score - x.score).slice(0, I.maxRecs).map(({ score, ...rest }) => rest);
}

/** One thing that went well, or null. prev: the test before's score as a % of its maximum. */
export function highlight({ facts, rank, of, scorePct, prevPct = null }) {
  if (of >= 3 && rank === 1) return { kind: 'top', of };
  if (of >= 4 && rank <= Math.ceil(of / 4)) return { kind: 'quarter', rank, of };
  if (prevPct !== null && scorePct - prevPct >= 5) return { kind: 'up', from: prevPct, to: scorePct };
  if (facts.attempted >= 5 && facts.accuracy >= 80) return { kind: 'accuracy', pct: facts.accuracy };
  return null;
}

// ---------- the words ----------

const fmt = (x) => String(Math.round(x * 100) / 100).replace(/^-/, '−');
const neg = (exam) => (exam.negative === 1 / 3 ? '⅓' : String(exam.negative));
const SECTION_HI = { q: 'गणित', r: 'तर्कशक्ति' };
export const sectionName = (s, exam, lang) => (lang === 'hi' ? SECTION_HI[s] : s === 'q' ? quantName(exam) : 'Reasoning');
export const topicName = (label, lang) => (lang === 'hi' ? LABEL_HI[label] || label : label);

/** { title, body, action } for one recommendation. action: { practice: label, topic } | { go: 'practice' } | null. */
export function recText(rec, examId, lang = 'en') {
  const exam = EXAMS[examId];
  const hi = lang === 'hi';
  const S = (s) => sectionName(s, exam, lang);
  switch (rec.kind) {
    case 'topic': {
      const name = topicName(rec.label, lang);
      const gain = rec.gain ? (hi ? ` यह अंतर भरने से ${exam.short} में लगभग ${rec.gain} अंक बढ़ सकते हैं।` : ` Closing that gap is worth about ${rec.gain} ${rec.gain === 1 ? 'mark' : 'marks'} in ${exam.short}.`) : '';
      return {
        title: hi ? `${name} की प्रैक्टिस करें` : `Practise ${name}`,
        body: (hi ? `आपने ${rec.asked} में से ${rec.right} सही किए (${rec.pct}%); आपके बैच ने ${rec.batchPct}%।` : `You got ${rec.right} of ${rec.asked} right (${rec.pct}%); your batch got ${rec.batchPct}%.`) + gain,
        action: { practice: rec.label, topic: rec.section === 'q' ? 'quant' : 'reasoning', label: hi ? '10 सवाल प्रैक्टिस करें' : 'Practise 10 questions' },
      };
    }
    case 'section':
      return {
        title: hi ? `${S(rec.section)} आपका कमज़ोर सेक्शन है` : `${S(rec.section)} is your weaker section`,
        body: hi ? `${S(rec.section)} में आपने ${rec.asked} में से ${rec.right} सही किए (${rec.pct}%), जबकि ${S(rec.section === 'q' ? 'r' : 'q')} में ${rec.otherPct}%। इस हफ़्ते पहले ${S(rec.section)} की प्रैक्टिस करें।`
          : `You got ${rec.right} of ${rec.asked} right in ${S(rec.section)} (${rec.pct}%), against ${rec.otherPct}% in ${S(rec.section === 'q' ? 'r' : 'q')}. Practise ${S(rec.section)} topics first this week.`,
        action: { go: 'practice', label: hi ? 'प्रैक्टिस खोलें' : 'Open practice' },
      };
    case 'unseen':
      return {
        title: hi ? `आप ${rec.n} सवालों तक नहीं पहुँचे` : `You didn’t reach ${rec.n} questions`,
        body: rec.section
          ? (hi ? `इनमें ज़्यादातर ${S(rec.section)} के थे, जिसमें आप बेहतर हैं। अगली बार ${S(rec.section)} से शुरू करें।` : `Most were ${S(rec.section)}, where you do better. Start with ${S(rec.section)} next time.`)
          : (hi ? `हर सवाल पर लगभग ${rec.budget} सेकंड रखें: जो सवाल लंबा खिंचे, उसे review के लिए mark करके आगे बढ़ें।` : `Keep to about ${rec.budget} seconds a question: when one drags on, mark it for review and move on.`),
        action: null,
      };
    case 'early':
      return {
        title: hi ? `${rec.n} सवाल खोले ही नहीं गए` : `${rec.n} questions left unopened`,
        body: hi ? `आपने ${rec.minutes} मिनट पहले submit कर दिया। Submit करने से पहले हर सवाल एक बार खोलें: आसान सवाल आखिर में भी हो सकते हैं।`
          : `You handed in with ${rec.minutes} ${rec.minutes === 1 ? 'minute' : 'minutes'} to spare. Open every question before you submit: the easy ones may be at the end.`,
        action: null,
      };
    case 'negative':
      return {
        title: hi ? `गलत जवाबों से ${fmt(rec.lost)} अंक कटे` : `Wrong answers cost you ${fmt(rec.lost)} marks`,
        body: hi ? `${exam.short} (+${exam.marks} / −${neg(exam)}) में तभी अंदाज़ा लगाएँ जब कम से कम एक विकल्प हटा सकें; वरना सवाल छोड़ दें।`
          : `In ${exam.short} (+${exam.marks} / −${neg(exam)}), guess when you can rule out at least one option; if you can’t narrow it down, skip.`,
        action: null,
      };
    case 'rush':
      return {
        title: hi ? 'गलत जवाबों में जल्दबाज़ी' : 'You rushed the ones you got wrong',
        body: hi ? `आपके गलत जवाबों में लगभग ${rec.wrongSec} सेकंड लगे, सही जवाबों में ${rec.rightSec} सेकंड। जो सवाल आसान लगे, उसे जवाब देने से पहले एक बार और पढ़ें।`
          : `Your wrong answers took about ${rec.wrongSec} seconds each; your right ones, ${rec.rightSec}. When a question looks easy, read it once more before you answer.`,
        action: null,
      };
    case 'stuck':
      return {
        title: hi ? 'कुछ सवालों पर ज़्यादा समय गया' : 'Too long on questions you got wrong',
        body: hi ? `जो सवाल गलत हुए, उन पर लगभग ${rec.wrongSec} सेकंड लगे (सही पर ${rec.rightSec})। ${rec.budget} सेकंड के बाद सवाल को review के लिए mark करके आगे बढ़ें।`
          : `The ones you got wrong took about ${rec.wrongSec} seconds each (${rec.rightSec} for the right ones). After ${rec.budget} seconds, mark it for review and move on.`,
        action: null,
      };
    case 'spare':
      return {
        title: hi ? `${rec.minutes} मिनट बचे थे` : `You had ${rec.minutes} ${rec.minutes === 1 ? 'minute' : 'minutes'} to spare`,
        body: hi ? `Submit करने से पहले बचे समय में अपने जवाब दोबारा जाँचें: इस बार ${rec.wrong} जवाब गलत हुए।` : `Use spare time to recheck your answers before you submit: ${rec.wrong} were wrong this time.`,
        action: null,
      };
    default:
      return null;
  }
}

/** The line for highlight(). */
export function highlightText(h, lang = 'en') {
  const hi = lang === 'hi';
  if (!h) return '';
  if (h.kind === 'top') return hi ? `बैच में पहला स्थान, ${h.of} छात्रों में।` : `Top of your batch of ${h.of}.`;
  if (h.kind === 'quarter') return hi ? 'आप अपने बैच के शीर्ष चौथाई में हैं।' : 'You’re in the top quarter of your batch.';
  if (h.kind === 'up') return hi ? `पिछले टेस्ट से बेहतर: ${h.from}% से ${h.to}%।` : `Up from ${h.from}% to ${h.to}% of the marks since your last test.`;
  if (h.kind === 'accuracy') return hi ? `आपके ${h.pct}% जवाब सही थे।` : `${h.pct}% of the answers you gave were right.`;
  return '';
}

export const LEVEL_TEXT = {
  en: { strong: 'Strong', ok: 'Getting there', weak: 'Needs work', few: 'Not enough questions yet' },
  hi: { strong: 'मज़बूत', ok: 'सुधार जारी', weak: 'ध्यान चाहिए', few: 'अभी कम सवाल आए हैं' },
};
