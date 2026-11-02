// Builds the guide pages from the app's own exam settings and question engine, so marking, timing and
// questions always match the game: the exam guides (/ssc-cgl, /ibps-po, /rrb-ntpc) and the topic practice
// pages (/practice, /practice/<topic>).
// Run: node website/scripts/build-guides.mjs   (add --check to fail if a page is out of date)
//
// Facts that the app doesn't hold (section timing, how each stage counts) are written below and were
// checked on 4 November 2026 against the patterns most sites report; the official notice always wins.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXAMS } from '../../app/www/js/exams.js';
import { QUANT } from '../../app/www/js/engine/quant.js';
import { REASONING } from '../../app/www/js/engine/reasoning.js';
import { generateQuestion } from '../../app/www/js/engine/index.js';
import { createRng, hashString } from '../../app/www/js/engine/rng.js';
import { topicSlug } from '../../app/www/js/topics.js';

const OUT = fileURLToPath(new URL('../public/', import.meta.url));
const SITE = 'https://www.playtakkar.in';
const CSS_VERSION = 21;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const frac = (n) => (Math.abs(n - 1 / 3) < 1e-9 ? '⅓' : Math.abs(n - 0.25) < 1e-9 ? '0.25' : String(n));
const num = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''));

// What each page says beyond the app's settings.
const EXTRA = {
  'ssc-cgl': {
    stage: 'Tier 1',
    sectionNames: { Reasoning: 'General Intelligence and Reasoning', 'General Awareness': 'General Awareness', Quant: 'Quantitative Aptitude', English: 'English Comprehension' },
    clock: 'One clock for the whole paper: you can move between sections.',
    stageNote: 'In recent cycles Tier 1 has decided who goes on to Tier 2, and the final merit list has come from Tier 2.',
    official: { name: 'ssc.gov.in', url: 'https://ssc.gov.in' },
    example: { right: 60, wrong: 16, of: 'the whole paper' },
    extraFaq: null,
    tier2: true,
    notYet: 'English, General Awareness, geometry, mensuration, trigonometry and data interpretation',
  },
  'ibps-po': {
    stage: 'Prelims',
    sectionNames: { English: 'English Language', Quant: 'Quantitative Aptitude', Reasoning: 'Reasoning Ability' },
    clock: '20 minutes for each section, one after the other; you can’t go back to a section once its time is up.',
    stageNote: 'Prelims decide who goes on to the Mains; the prelims marks are not added to the final merit.',
    official: { name: 'ibps.in', url: 'https://ibps.in' },
    marksNote: 'Since 2025, Reasoning is reported to carry 40 marks and Quantitative Aptitude 30 for their 35 questions each (English 30 marks, 100 in all). Some sites still list 35 marks each, so check the official notice.',
    example: { right: 22, wrong: 4, of: 'the English section (30 questions, 1 mark each)', perSection: 'English' },
    notYet: 'English, data interpretation, and seating and puzzles',
  },
  'rrb-ntpc': {
    stage: 'CBT 1',
    sectionNames: { 'General Awareness': 'General Awareness', Maths: 'Mathematics', Reasoning: 'General Intelligence and Reasoning' },
    clock: 'One clock for the whole paper: you can move between sections.',
    stageNote: 'CBT 1 decides who goes on to CBT 2 and the later stages of selection.',
    official: { name: 'indianrailways.gov.in and your regional RRB website', url: 'https://indianrailways.gov.in' },
    example: { right: 63, wrong: 15, of: 'the whole paper' },
    notYet: 'General Awareness, geometry, mensuration and data interpretation',
  },
};

const quantIds = new Set(QUANT.map((t) => t.id));
const byId = Object.fromEntries([...QUANT, ...REASONING].map((t) => [t.id, t]));

/** Topic names Takkar practises for this exam, weighted ones first. */
function topics(exam, list) {
  const seen = new Set();
  return list
    .filter((t) => (exam.weights[t.id] ?? 1) >= 1)
    .sort((a, b) => (exam.weights[b.id] ?? 1) - (exam.weights[a.id] ?? 1))
    .map((t) => t.label)
    .filter((l) => !seen.has(l) && seen.add(l));
}

/** One sample question of the exam's most weighted type, the same every build. */
function sample(exam, list, salt) {
  const top = [...list].sort((a, b) => (exam.weights[b.id] ?? 1) - (exam.weights[a.id] ?? 1))[0];
  const rng = createRng(hashString(`guide-${exam.id}-${salt}-v1`));
  return generateQuestion(top, rng, top.tiers.includes(2) ? 2 : top.tiers[0]);
}

const LEVEL = { 1: 'Easy', 2: 'Exam level', 3: 'Harder' };

/** A question card; on a topic page the label is its number and level instead of the topic. */
function questionHtml(q, n, numbered = false) {
  const letters = 'ABCD';
  return `
        <article class="sample panel">
          <p class="sample__topic">${numbered ? `Question ${n + 1} · ${LEVEL[q.tier] || 'Exam level'}` : esc(q.label)}</p>
          <p class="sample__text">${esc(q.text).replace(/\n/g, '<br>')}</p>
          <ol class="sample__options" type="A">
            ${q.options.map((o) => `<li>${esc(o)}</li>`).join('\n            ')}
          </ol>
          <details class="sample__answer">
            <summary>Show the answer and steps</summary>
            <p><strong>Answer: ${letters[q.answerIndex]}. ${esc(q.answerText)}</strong></p>
            <ol class="sample__steps">${q.steps.filter((s) => !/^Answer:/.test(s)).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
          </details>
        </article>`;
}

function faqs(exam, x) {
  const neg = frac(exam.negative);
  const quant = exam.id === 'rrb-ntpc' ? 'maths' : 'quant';
  const list = [
    [`Is there negative marking in ${exam.short} ${x.stage}?`,
      exam.id === 'ibps-po'
        ? `Yes. A quarter of the question’s marks is deducted for each wrong answer. A skipped question costs nothing, so guess only when you can rule options out.`
        : `Yes. ${neg} of a mark is deducted for each wrong answer, and a right answer gets ${exam.marks} mark${exam.marks > 1 ? 's' : ''}. A skipped question costs nothing.`],
    [exam.id === 'ibps-po' ? `Does IBPS PO ${x.stage} have sectional timing?` : `How much time do you get per question in ${exam.short} ${x.stage}?`,
      exam.id === 'ibps-po'
        ? `Yes. You get 20 minutes each for English, Quantitative Aptitude and Reasoning, 60 minutes in all, and you can’t switch between sections.`
        : `${exam.paper.minutes} minutes for ${exam.paper.questions} questions: ${exam.seconds} seconds a question on average. ${x.clock}`],
    [`Which sections are in ${exam.short} ${x.stage}?`,
      `${exam.sections.length} sections: ${exam.sections.map(([s, q]) => `${x.sectionNames[s] || s} (${q} questions)`).join(', ')}. ${exam.paper.questions} questions in all.`],
    [`How can I practise ${exam.short} ${quant} and reasoning every day for free?`,
      `On Takkar, each duel gives you ten new questions, five ${quant} and five reasoning, in ${exam.short} marking and timing, with step-by-step solutions. It’s free in any browser at playtakkar.in/play, with no sign-up.`],
    [`Is Takkar an official ${exam.group === 'SSC' ? 'SSC' : exam.group === 'Banking' ? 'IBPS' : 'RRB'} website?`,
      `No. Takkar is an independent practice game and isn’t affiliated with any exam-conducting body. For notices, dates and results, see ${x.official.name}.`],
  ];
  if (exam.id === 'ibps-po') {
    list.splice(3, 0, [`How many marks are Quant and Reasoning in IBPS PO ${x.stage}?`, x.marksNote]);
  }
  return list;
}

/** What a guess is worth on average under this marking, worked out rather than claimed. */
function guessNote(marks, negative, lead = 'On average') {
  const four = marks / 4 - (3 / 4) * negative;
  const two = marks / 2 - negative / 2;
  const say = (v) => (Math.abs(v) < 1e-9 ? 'nothing' : `about ${num(Math.round(v * 100) / 100)} of a mark`);
  return `${lead}, a blind guess among four options gains ${say(four)}; ruling out two options first raises that to ${say(two)}.`;
}

function page(exam) {
  const x = EXTRA[exam.id];
  const neg = frac(exam.negative);
  const quantTopics = topics(exam, QUANT);
  const reasonTopics = topics(exam, REASONING);
  const qs = [sample(exam, QUANT, 'q'), sample(exam, REASONING, 'r')];
  const ex = x.example;
  const exMarks = ex.perSection ? 1 : exam.marks;
  const exNeg = ex.perSection ? 0.25 : exam.negative;
  const exScore = ex.right * exMarks - ex.wrong * exNeg;
  const total = exam.paper.questions * exam.marks;
  const title = `${exam.short} ${x.stage} pattern, marking and free daily practice · Takkar`;
  const desc = `${exam.name}: ${exam.paper.questions} questions, ${exam.paper.minutes} minutes, ${exam.id === 'ibps-po' ? '−¼ of the marks' : `−${neg}`} for a wrong answer. Sections, scoring and free daily quant and reasoning practice.`;
  const url = `${SITE}/${exam.id}`;
  const faqList = faqs(exam, x);
  const play = `/play/?exam=${exam.id}`;
  const ld = (o) => `<script type="application/ld+json">\n${JSON.stringify(o).replace(/</g, '\\u003c')}\n</script>`;
  const others = Object.values(EXAMS).filter((e) => e.id !== exam.id);

  const sectionRows = exam.sections.map(([s, q]) => {
    const marks = exam.id === 'ibps-po' ? ({ English: '30', Quant: '30*', Reasoning: '40*' }[s]) : String(q * exam.marks);
    const covered = s === 'Quant' || s === 'Maths' || s === 'Reasoning';
    return `<tr><td>${esc(x.sectionNames[s] || s)}</td><td>${q}</td><td>${marks}</td>${exam.id === 'ibps-po' ? '<td>20 min</td>' : ''}<td>${covered ? 'Yes' : 'Not yet'}</td></tr>`;
  }).join('\n              ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Generated by website/scripts/build-guides.mjs from the app's exam settings and question engine. Edit the script, not this page. -->
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#070A1F">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-48.png" sizes="48x48" type="image/png">
<link rel="icon" href="/favicon-96.png" sizes="96x96" type="image/png">
<link rel="icon" href="/favicon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/styles.css?v=${CSS_VERSION}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Takkar">
<meta property="og:title" content="${esc(`${exam.short} ${x.stage}: pattern, marking and free practice`)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/og-image.png">
<meta property="og:image:alt" content="Takkar: a daily quiz duel for exam aspirants">
<meta property="og:locale" content="en_IN">
<meta name="twitter:card" content="summary_large_image">
${ld({ '@context': 'https://schema.org', '@type': 'FAQPage', url, mainEntity: faqList.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) })}
${ld({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Takkar', item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: `${exam.short} ${x.stage}`, item: url }] })}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<div class="page">
  <div class="glows" aria-hidden="true"><span class="glow glow--cobalt hero-glow-a"></span><span class="glow glow--saffron hero-glow-b"></span></div>
  <header class="site-header wrap">
    <div class="nav glass">
      <a class="brand" href="/" aria-label="Takkar home">
        <svg class="brand__mark" viewBox="0 0 40 32" aria-hidden="true"><circle cx="14" cy="16" r="11" fill="#4B5DFF"/><circle cx="26" cy="16" r="11" fill="#FF6A00"/><path d="M20 6.78 A11 11 0 0 0 20 25.22 A11 11 0 0 0 20 6.78 Z" fill="#FFFFFF"/></svg>
        <span class="brand__word">takkar</span>
      </a>
      <nav class="nav__links" aria-label="Exam guides">
        ${Object.values(EXAMS).map((e) => `<a href="/${e.id}"${e.id === exam.id ? ' aria-current="page"' : ''}>${esc(e.short)}</a>`).join('\n        ')}
        <a href="/tutors">For tutors</a>
      </nav>
      <a class="btn btn--white btn--small" href="${play}">Practise free</a>
    </div>
  </header>

  <main id="main" class="guide">
    <section class="section wrap guide-hero" aria-labelledby="g-title">
      <p class="pill">Exam guide · ${esc(exam.group)}</p>
      <h1 class="section__title guide-hero__title" id="g-title">${esc(exam.short)} ${esc(x.stage)}: pattern, marking and free daily practice</h1>
      <p class="section__lead">${exam.paper.questions} questions in ${exam.paper.minutes} minutes, ${exam.id === 'ibps-po' ? 'a quarter of the question’s marks off' : `${neg} of a mark off`} for each wrong answer. Here’s how the paper is built, how it’s scored, and two questions to try, with the steps.</p>
      <div class="hero__actions">
        <a class="btn btn--saffron" href="${play}">Practise ${esc(exam.short)} free</a>
        <a class="btn btn--ghost" href="#try">Try two questions</a>
      </div>
      <p class="tutors-note">Takkar is independent and not affiliated with any exam body. Patterns can change: the official notice on <a href="${x.official.url}" rel="noopener">${esc(x.official.name)}</a> always wins.</p>
    </section>

    <section class="section wrap" aria-labelledby="g-pattern">
      <h2 class="section__title" id="g-pattern">The paper at a glance</h2>
      <div class="guide-card glass">
        <div class="guide-facts">
          <div><strong>${exam.paper.questions}</strong><span>questions</span></div>
          <div><strong>${exam.paper.minutes} min</strong><span>${exam.id === 'ibps-po' ? '20 per section' : 'one clock'}</span></div>
          <div><strong>${exam.id === 'ibps-po' ? '−¼' : `+${exam.marks} / −${neg}`}</strong><span>${exam.id === 'ibps-po' ? 'of the marks, per wrong answer' : 'right / wrong'}</span></div>
          <div><strong>${exam.seconds} s</strong><span>a question on average</span></div>
        </div>
        <div class="guide-table">
          <table>
            <thead><tr><th>Section</th><th><span class="th-long">Questions</span><span class="th-short" aria-hidden="true">Qs</span></th><th>Marks</th>${exam.id === 'ibps-po' ? '<th>Time</th>' : ''}<th><span class="th-long">On Takkar</span><span class="th-short" aria-hidden="true">Takkar</span></th></tr></thead>
            <tbody>
              ${sectionRows}
            </tbody>
          </table>
        </div>
        ${exam.id === 'ibps-po' ? `<p class="guide-note">* ${esc(x.marksNote)}</p>` : `<p class="guide-note">${exam.paper.questions} questions × ${exam.marks} mark${exam.marks > 1 ? 's' : ''} = ${total} marks. ${esc(x.clock)}</p>`}
        <p class="guide-note">${esc(x.stageNote)}</p>
      </div>
    </section>

    <section class="section wrap" aria-labelledby="g-score">
      <h2 class="section__title" id="g-score">How the scoring works</h2>
      <p class="section__lead">Every wrong answer takes marks away, so a skipped question can be worth more than a guess.</p>
      <div class="guide-card glass guide-score">
        <p>Say you answer <strong>${ex.right} right</strong> and <strong>${ex.wrong} wrong</strong> in ${esc(ex.of)}:</p>
        <p class="guide-sum">${ex.right} × ${num(exMarks)} − ${ex.wrong} × ${frac(exNeg)} = ${num(ex.right * exMarks)} − ${num(ex.wrong * exNeg)} = <strong>${num(exScore)}</strong></p>
        <p class="guide-note">${guessNote(exMarks, exNeg, ex.perSection ? `In ${esc(ex.perSection)}, at 1 mark a question, on average` : 'On average')}</p>
      </div>
    </section>

    <section class="section wrap" aria-labelledby="g-topics">
      <h2 class="section__title" id="g-topics">What Takkar practises for ${esc(exam.short)}</h2>
      <p class="section__lead">A mixed duel has five ${exam.id === 'rrb-ntpc' ? 'maths' : 'quant'} and five reasoning questions, chosen in proportion to how often these topics come up in ${esc(exam.short)}; you can also play ${exam.id === 'rrb-ntpc' ? 'maths' : 'quant'} or reasoning only.</p>
      <div class="guide-topics">
        <div class="guide-card glass"><h3>${exam.id === 'rrb-ntpc' ? 'Mathematics' : 'Quantitative Aptitude'}</h3><ul class="guide-chips">${quantTopics.map(chip).join('')}</ul></div>
        <div class="guide-card glass"><h3>Reasoning</h3><ul class="guide-chips">${reasonTopics.map(chip).join('')}</ul></div>
      </div>
      <p class="guide-note">Topics with a link have a page of solved questions. <a href="/practice">All practice pages</a>.</p>
      <p class="guide-note">Not in Takkar yet: ${esc(x.notYet)}.</p>${exam.note ? `
      <p class="guide-note">${esc(exam.note)}</p>` : ''}
    </section>

    <section class="section wrap" id="try" aria-labelledby="g-try">
      <h2 class="section__title" id="g-try">Try two questions</h2>
      <p class="section__lead">Made by Takkar’s question engine in ${esc(exam.short)} style, with every answer calculated, not copied. Allow yourself ${exam.seconds} seconds each.</p>
      <div class="sample-grid">${qs.map((q, i) => questionHtml(q, i)).join('')}
      </div>
      <div class="hero__actions"><a class="btn btn--saffron" href="${play}">Play ten like these, free</a></div>
    </section>
${x.tier2 ? `
    <section class="section wrap" aria-labelledby="g-tier2">
      <div class="guide-card glass">
        <h2 class="guide-card__title" id="g-tier2">Preparing for Tier 2?</h2>
        <p>Tier 2’s maths and reasoning cover the same topics at a harder level, with its own marking. On Takkar, choose the <strong>Harder</strong> level for tougher numbers in the same time, and check Tier 2’s marking in the official notice.</p>
      </div>
    </section>
` : ''}
    <section class="section wrap faq" aria-labelledby="g-faq">
      <h2 class="section__title" id="g-faq">${esc(exam.short)} questions people ask</h2>
      <div class="faq__list glass">
        ${faqList.map(([q, a]) => `<details>\n          <summary>${esc(q)}</summary>\n          <p>${esc(a)}</p>\n        </details>`).join('\n        ')}
      </div>
    </section>

    <section class="section wrap" aria-label="Other exam guides">
      <p class="guide-others">Other exam guides: ${others.map((e) => `<a href="/${e.id}">${esc(e.short)} ${esc(EXTRA[e.id].stage)}</a>`).join(' · ')} · <a href="/tutors">For tutors and coaching centres</a></p>
    </section>
  </main>
  __FOOTER__
</div>
</body>
</html>
`;
}

// ---------- Topic practice pages: /practice and /practice/<topic> ----------

// The topics with a page, and the method for each in a few plain lines (checked by hand).
const PRACTICE = [
  { label: 'Percentages', method: [
    'x% of N = N × x ÷ 100.',
    'Two changes one after the other, a% then b% (with a minus sign for a fall), make a + b + (a × b) ÷ 100 percent in all.',
  ] },
  { label: 'Profit and loss', method: [
    'Profit % = profit ÷ cost price × 100. Loss % works the same way.',
    'Selling price = cost price × (100 + profit %) ÷ 100; for a loss, use (100 − loss %).',
  ] },
  { label: 'Time and work', method: [
    'If A finishes a job in a days, A does 1/a of it each day.',
    'A and B together do 1/a + 1/b a day, so they finish in (a × b) ÷ (a + b) days.',
  ] },
  { label: 'Syllogism', method: [
    'Draw each statement as circles, and try every way the circles can be drawn.',
    'A conclusion follows only if it is true in every drawing. When two conclusions are opposites and neither is certain, the answer is “Either I or II follows”.',
  ] },
  { label: 'Number series', method: [
    'Look at the differences between terms first, then the ratios.',
    'Many series mix the two, like × 2 + 3 or × 3 + 4. Squares, cubes and primes are the other usual patterns.',
  ] },
  { label: 'Coding and decoding', method: [
    'Work out the rule from the coded example, letter by letter: a shift along the alphabet (A → C is +2), a reversal, or position numbers (A = 1 … Z = 26).',
    'Check the rule on every letter before you apply it to the new word.',
  ] },
];

const sectionOf = (label) => (QUANT.some((t) => t.label === label) ? 'quant' : 'reasoning');
const templatesOf = (label) => [...QUANT, ...REASONING].filter((t) => t.label === label);
const PRACTICE_SLUGS = new Set(PRACTICE.map((p) => topicSlug(p.label)));

/** A topic chip on an exam guide: a link when the topic has a practice page. */
function chip(label) {
  return PRACTICE_SLUGS.has(topicSlug(label)) ? `<li><a href="/practice/${topicSlug(label)}">${esc(label)}</a></li>` : `<li>${esc(label)}</li>`;
}

/** Five different questions, easier ones first, the same every build. */
function practiceQuestions(label) {
  const templates = templatesOf(label);
  const slug = topicSlug(label);
  const wanted = [1, 1, 2, 2, 3];
  const out = [];
  const seen = new Set();
  for (let tries = 0; out.length < 5 && tries < 80; tries++) {
    const t = templates[tries % templates.length];
    const want = wanted[out.length];
    const tier = t.tiers.includes(want) ? want : t.tiers.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a));
    const q = generateQuestion(t, createRng(hashString(`practice-${slug}-${tries}-v1`)), tier);
    if (seen.has(q.text)) continue;
    seen.add(q.text);
    out.push(q);
  }
  if (out.length < 5) throw new Error(`not enough different questions for ${label}`);
  return out.sort((a, b) => a.tier - b.tier);
}

/** The exams whose duels ask this topic often (Takkar weights topics by how often each exam asks them). */
function examsFor(label) {
  const ids = templatesOf(label).map((t) => t.id);
  return Object.values(EXAMS).filter((e) => Math.max(...ids.map((id) => e.weights[id] ?? 1)) >= 2).map((e) => e.short);
}
const list = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

function shell({ title, desc, url, ogTitle, lds, main, ctaHref, ctaText }) {
  const ld = (o) => `<script type="application/ld+json">\n${JSON.stringify(o).replace(/</g, '\\u003c')}\n</script>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Generated by website/scripts/build-guides.mjs from the app's question engine. Edit the script, not this page. -->
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#070A1F">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-48.png" sizes="48x48" type="image/png">
<link rel="icon" href="/favicon-96.png" sizes="96x96" type="image/png">
<link rel="icon" href="/favicon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/styles.css?v=${CSS_VERSION}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Takkar">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/og-image.png">
<meta property="og:image:alt" content="Takkar: a daily quiz duel for exam aspirants">
<meta property="og:locale" content="en_IN">
<meta name="twitter:card" content="summary_large_image">
${lds.map(ld).join('\n')}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<div class="page">
  <div class="glows" aria-hidden="true"><span class="glow glow--cobalt hero-glow-a"></span><span class="glow glow--saffron hero-glow-b"></span></div>
  <header class="site-header wrap">
    <div class="nav glass">
      <a class="brand" href="/" aria-label="Takkar home">
        <svg class="brand__mark" viewBox="0 0 40 32" aria-hidden="true"><circle cx="14" cy="16" r="11" fill="#4B5DFF"/><circle cx="26" cy="16" r="11" fill="#FF6A00"/><path d="M20 6.78 A11 11 0 0 0 20 25.22 A11 11 0 0 0 20 6.78 Z" fill="#FFFFFF"/></svg>
        <span class="brand__word">takkar</span>
      </a>
      <nav class="nav__links" aria-label="Guides">
        <a href="/practice"${url === `${SITE}/practice` ? ' aria-current="page"' : ''}>Practice</a>
        ${Object.values(EXAMS).map((e) => `<a href="/${e.id}">${esc(e.short)}</a>`).join('\n        ')}
      </nav>
      <a class="btn btn--white btn--small" href="${ctaHref}">${esc(ctaText)}</a>
    </div>
  </header>

  <main id="main" class="guide">${main}
  </main>
  __FOOTER__
</div>
</body>
</html>
`;
}

function practicePage(topic) {
  const { label, method } = topic;
  const slug = topicSlug(label);
  const url = `${SITE}/practice/${slug}`;
  const qs = practiceQuestions(label);
  const exams = examsFor(label);
  const section = sectionOf(label) === 'quant' ? 'Quant' : 'Reasoning';
  const play = `/play/?practice=${slug}`;
  const long = `${label} questions with solutions: SSC, bank, railway · Takkar`;
  const title = long.length <= 65 ? long : `${label} questions with solutions · Takkar`;
  const desc = `${label} questions with step-by-step solutions for SSC CGL, IBPS PO and RRB NTPC: the quick method, 5 solved examples, free practice.`;
  const faqList = [
    [`Which exams ask ${label.toLowerCase()} questions?`,
      exams.length
        ? `Takkar asks ${label.toLowerCase()} questions often in the ${list(exams)} patterns, because those papers often include them. Check each exam’s latest syllabus for its exact weight.`
        : `They appear in the SSC CGL, IBPS PO and RRB NTPC patterns, though less often than the main topics. Check each exam’s latest syllabus.`],
    [`What is the quickest method for ${label.toLowerCase()} questions?`, method.join(' ')],
    [`How can I practise ${label.toLowerCase()} for free every day?`,
      `On Takkar, open Practice and pick ${label}: ten questions at a time, with the steps after each answer. Topic practice is free and unlimited, in any browser at playtakkar.in/play.`],
  ];
  const others = PRACTICE.filter((p) => p.label !== label);
  const main = `
    <section class="section wrap guide-hero" aria-labelledby="p-title">
      <p class="pill">Practice · ${section}</p>
      <h1 class="section__title guide-hero__title" id="p-title">${esc(label)} questions with step-by-step solutions</h1>
      <p class="section__lead">The quick method, then five questions from easy to hard, each with its working. ${exams.length ? `A regular topic in ${esc(list(exams))}.` : ''}</p>
      <div class="hero__actions">
        <a class="btn btn--saffron" href="${play}">Practise ${esc(label.toLowerCase())} free</a>
        <a class="btn btn--ghost" href="#questions">See the questions</a>
      </div>
    </section>

    <section class="section wrap" aria-labelledby="p-method">
      <div class="guide-card glass">
        <h2 class="guide-card__title" id="p-method">The method</h2>
        <ul class="method-list">${method.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      </div>
    </section>

    <section class="section wrap" id="questions" aria-labelledby="p-qs">
      <h2 class="section__title" id="p-qs">Five ${esc(label.toLowerCase())} questions</h2>
      <p class="section__lead">Made by Takkar’s question engine, with every answer calculated, not copied. Try each before you open the steps.</p>
      <div class="sample-grid">${qs.map((q, i) => questionHtml(q, i, true)).join('')}
      </div>
      <div class="hero__actions"><a class="btn btn--saffron" href="${play}">Practise 10 more, free</a></div>
    </section>

    <section class="section wrap faq" aria-labelledby="p-faq">
      <h2 class="section__title" id="p-faq">${esc(label)}: questions people ask</h2>
      <div class="faq__list glass">
        ${faqList.map(([q, a]) => `<details>\n          <summary>${esc(q)}</summary>\n          <p>${esc(a)}</p>\n        </details>`).join('\n        ')}
      </div>
    </section>

    <section class="section wrap" aria-label="More practice">
      <p class="guide-others">More practice: ${others.map((p) => `<a href="/practice/${topicSlug(p.label)}">${esc(p.label)}</a>`).join(' · ')} · <a href="/practice">All topics</a></p>
      <p class="guide-others">Exam guides: ${Object.values(EXAMS).map((e) => `<a href="/${e.id}">${esc(e.short)}</a>`).join(' · ')}</p>
    </section>`;
  return shell({
    title, desc, url, ogTitle: `${label} questions with solutions`, main, ctaHref: play, ctaText: 'Practise free',
    lds: [
      { '@context': 'https://schema.org', '@type': 'FAQPage', url, mainEntity: faqList.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Takkar', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Practice', item: `${SITE}/practice` },
        { '@type': 'ListItem', position: 3, name: label, item: url },
      ] },
    ],
  });
}

function practiceIndex() {
  const url = `${SITE}/practice`;
  const card = (p) => `
        <a class="offer panel practice-card" href="/practice/${topicSlug(p.label)}">
          <span class="offer__tag offer__tag--now">${sectionOf(p.label) === 'quant' ? 'Quant' : 'Reasoning'}</span>
          <h3>${esc(p.label)}</h3>
          <p>${esc(p.method[0])}</p>
          <span class="practice-card__go">5 solved questions →</span>
        </a>`;
  const main = `
    <section class="section wrap guide-hero" aria-labelledby="pi-title">
      <p class="pill">Free practice</p>
      <h1 class="section__title guide-hero__title" id="pi-title">Practice questions with step-by-step solutions</h1>
      <p class="section__lead">Quant and reasoning topics from SSC CGL, IBPS PO and RRB NTPC: the quick method for each, five solved questions, and unlimited free practice in the app.</p>
      <div class="hero__actions"><a class="btn btn--saffron" href="/play/">Play today’s duel</a></div>
    </section>
    <section class="section wrap" aria-labelledby="pi-quant">
      <h2 class="section__title" id="pi-quant">Quant</h2>
      <div class="offer-grid">${PRACTICE.filter((p) => sectionOf(p.label) === 'quant').map(card).join('')}
      </div>
    </section>
    <section class="section wrap" aria-labelledby="pi-reasoning">
      <h2 class="section__title" id="pi-reasoning">Reasoning</h2>
      <div class="offer-grid">${PRACTICE.filter((p) => sectionOf(p.label) === 'reasoning').map(card).join('')}
      </div>
      <p class="guide-others">More topics are in the app’s Practice tab. Exam guides: ${Object.values(EXAMS).map((e) => `<a href="/${e.id}">${esc(e.short)}</a>`).join(' · ')}</p>
    </section>`;
  return shell({
    title: 'Free quant and reasoning practice with solutions · Takkar',
    desc: 'Free practice questions with step-by-step solutions for SSC CGL, IBPS PO and RRB NTPC: percentages, profit and loss, time and work, syllogism and more.',
    url, ogTitle: 'Free practice questions with solutions', main, ctaHref: '/play/', ctaText: 'Play free',
    lds: [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Takkar', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Practice', item: url },
    ] }],
  });
}

// ---------- Write (or check) every page ----------

// The footer is copied from the home page, so every page's footer stays the same.
const home = readFileSync(OUT + 'index.html', 'utf8');
const footer = home.slice(home.indexOf('<footer class="site-footer wrap">'), home.indexOf('</footer>') + '</footer>'.length);
if (!footer.startsWith('<footer')) throw new Error('home page footer not found');

const pages = [
  ...Object.values(EXAMS).map((exam) => [`${exam.id}.html`, page(exam)]),
  ['practice.html', practiceIndex()],
  ...PRACTICE.map((t) => [`practice/${topicSlug(t.label)}.html`, practicePage(t)]),
];
const check = process.argv.includes('--check');
let stale = 0;
for (const [name, body] of pages) {
  const html = body.replace('__FOOTER__', footer);
  const file = OUT + name;
  if (check) {
    if (!existsSync(file) || readFileSync(file, 'utf8') !== html) { console.log(`out of date: ${name}`); stale++; }
  } else {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
    console.log(`wrote ${name}`);
  }
}
if (stale) process.exit(1);
