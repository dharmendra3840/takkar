// Builds the guide pages from the app's own exam settings and question engine, so marking, timing and
// questions always match the game: the exam guides (/exams, one page per exam, and in Hindi under /hi/),
// the topic practice pages (/practice, /practice/<topic>), and the question-of-the-day data (website/lib/qotd-data.mjs).
// Run: node website/scripts/build-guides.mjs   (add --check to fail if a page is out of date)
//
// Facts that the app doesn't hold (section timing, how each stage counts) are written below and were
// checked on 3 November 2026 against the patterns most sites report; the official notice always wins.
// sectionMinutes: minutes for each section, for exams with a clock per section.
// sectionMarks: marks for each section, where they differ from questions × marks (IBPS PO).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXAMS, quantName, examGroups, markingLabel } from '../../app/www/js/exams.js';
import { QUANT } from '../../app/www/js/engine/quant.js';
import { REASONING } from '../../app/www/js/engine/reasoning.js';
import { generateQuestion } from '../../app/www/js/engine/index.js';
import { createRng, hashString } from '../../app/www/js/engine/rng.js';
import { topicSlug } from '../../app/www/js/topics.js';

const OUT = fileURLToPath(new URL('../public/', import.meta.url));
const SITE = 'https://www.playtakkar.in';
const CSS_VERSION = 24;

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
    sectionMinutes: { English: 20, Quant: 20, Reasoning: 20 },
    sectionMarks: { English: '30', Quant: '30*', Reasoning: '40*' },
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
  'ssc-chsl': {
    stage: 'Tier 1',
    sectionNames: { English: 'English Language', Reasoning: 'General Intelligence', Quant: 'Quantitative Aptitude', 'General Awareness': 'General Awareness' },
    sectionMinutes: { English: 15, Reasoning: 15, Quant: 15, 'General Awareness': 15 },
    clock: '15 minutes for each section, one after the other (reported as new in 2026); you can’t go back to a section once its time is up.',
    stageNote: 'Tier 1 decides who is called for Tier 2; check the notice for how each tier counts towards the final merit.',
    official: { name: 'ssc.gov.in', url: 'https://ssc.gov.in' },
    example: { right: 58, wrong: 14, of: 'the whole paper' },
    tier2: true,
    notYet: 'English, General Awareness, algebra, geometry, mensuration, trigonometry and data interpretation',
  },
  'ssc-gd': {
    stage: 'Constable',
    sectionNames: { Reasoning: 'General Intelligence and Reasoning', 'General Knowledge': 'General Knowledge and General Awareness', Maths: 'Elementary Mathematics', 'English or Hindi': 'English or Hindi' },
    clock: 'One clock for the whole paper: you can move between sections.',
    stageNote: 'The CBT is followed by the physical tests (PET and PST), a medical exam and document checks.',
    official: { name: 'ssc.gov.in', url: 'https://ssc.gov.in' },
    example: { right: 50, wrong: 12, of: 'the whole paper' },
    notYet: 'General Knowledge, English and Hindi, and mensuration',
  },
  'ibps-rrb': {
    stage: 'Prelims',
    title: 'IBPS RRB PO and Clerk prelims pattern and free practice · Takkar',
    heading: 'IBPS RRB PO and Clerk Prelims',
    sectionNames: { Reasoning: 'Reasoning', Quant: 'Quantitative Aptitude' },
    sectionMinutes: { Reasoning: 25, Quant: 20 },
    clock: 'Reasoning has 25 minutes and Quant 20, one after the other; you can’t go back to a section once its time is up.',
    stageNote: 'The same prelims serve Officer Scale I (PO) and Office Assistant (Clerk), where the quant section is called Numerical Ability. Prelims decide who goes on to the mains; their marks are not added to the final merit.',
    official: { name: 'ibps.in', url: 'https://ibps.in' },
    example: { right: 55, wrong: 12, of: 'the whole paper' },
    notYet: 'data interpretation, and seating and puzzles',
  },
  'rrb-group-d': {
    stage: 'CBT',
    sectionNames: { 'General Science': 'General Science', Maths: 'Mathematics', Reasoning: 'General Intelligence and Reasoning', 'General Awareness': 'General Awareness and Current Affairs' },
    clock: 'One clock for the whole paper: you can move between sections.',
    stageNote: 'The CBT is followed by a physical efficiency test (PET), then document checks and a medical exam.',
    official: { name: 'indianrailways.gov.in and your regional RRB website', url: 'https://indianrailways.gov.in' },
    example: { right: 62, wrong: 15, of: 'the whole paper' },
    notYet: 'General Science, General Awareness, geometry and mensuration',
  },
};

/** [section, minutes] for an exam with a clock per section, else []. */
const sectionClocks = (exam, x) => exam.sections.filter(([s]) => x.sectionMinutes?.[s]).map(([s]) => [s, x.sectionMinutes[s]]);
const sameClock = (clocks) => clocks.every(([, m]) => m === clocks[0][1]);
/** The section clocks in short: "20 per section", "25 + 20 by section". */
const clocksShort = (clocks) => (sameClock(clocks) ? `${clocks[0][1]} per section` : `${clocks.map(([, m]) => m).join(' + ')} by section`);
/** The other exams in the same group, for "more exam guides". */
const sameGroup = (exam) => Object.values(EXAMS).filter((e) => e.group === exam.group && e.id !== exam.id);
const groupWord = (group) => ({ Banking: 'bank', Railways: 'railway' })[group] || group;

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

/**
 * A question card; on a topic page the label is its number and level instead of the topic.
 * On a Hindi page the words around the question are Hindi and the question itself is marked as English.
 */
function questionHtml(q, n, numbered = false, words = { show: 'Show the answer and steps', answer: 'Answer', lang: '' }) {
  const letters = 'ABCD';
  const en = words.lang ? ` lang="${words.lang}"` : '';
  return `
        <article class="sample panel">
          <p class="sample__topic">${numbered ? `Question ${n + 1} · ${LEVEL[q.tier] || 'Exam level'}` : esc(q.label)}</p>
          <p class="sample__text"${en}>${esc(q.text).replace(/\n/g, '<br>')}</p>
          <ol class="sample__options" type="A"${en}>
            ${q.options.map((o) => `<li>${esc(o)}</li>`).join('\n            ')}
          </ol>
          <details class="sample__answer">
            <summary>${esc(words.show)}</summary>
            <p><strong>${esc(words.answer)}: ${letters[q.answerIndex]}. ${en ? `<span${en}>${esc(q.answerText)}</span>` : esc(q.answerText)}</strong></p>
            <ol class="sample__steps"${en}>${q.steps.filter((s) => !/^Answer:/.test(s)).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
          </details>
        </article>`;
}

function faqs(exam, x) {
  const neg = frac(exam.negative);
  const quant = quantName(exam).toLowerCase();
  const clocks = sectionClocks(exam, x);
  const faq = [
    [`Is there negative marking in ${exam.short} ${x.stage}?`,
      x.sectionMarks
        ? `Yes. A quarter of the question’s marks is deducted for each wrong answer. A skipped question costs nothing, so guess only when you can rule options out.`
        : `Yes. ${neg} of a mark is deducted for each wrong answer, and a right answer gets ${exam.marks} mark${exam.marks > 1 ? 's' : ''}. A skipped question costs nothing.`],
    [clocks.length ? `Does ${exam.short} ${x.stage} have sectional timing?` : `How much time do you get per question in ${exam.short} ${x.stage}?`,
      clocks.length
        ? `Yes. You get ${sameClock(clocks) ? `${clocks[0][1]} minutes each for ${list(clocks.map(([s]) => x.sectionNames[s] || s))}` : list(clocks.map(([s, m]) => `${m} minutes for ${x.sectionNames[s] || s}`))}, ${exam.paper.minutes} minutes in all, and you can’t go back to a section once its time is up.`
        : `${exam.paper.minutes} minutes for ${exam.paper.questions} questions: ${exam.seconds} seconds a question on average. ${x.clock}`],
    [`Which sections are in ${exam.short} ${x.stage}?`,
      `${exam.sections.length} sections: ${exam.sections.map(([s, q]) => `${x.sectionNames[s] || s} (${q} questions)`).join(', ')}. ${exam.paper.questions} questions in all.`],
    [`How can I practise ${exam.short} ${quant} and reasoning every day for free?`,
      `On Takkar, each duel gives you ten new questions, five ${quant} and five reasoning, in ${exam.short} marking and timing, with step-by-step solutions. It’s free in any browser at playtakkar.in/play, with no sign-up.`],
    [`Is Takkar an official ${exam.group === 'SSC' ? 'SSC' : exam.group === 'Banking' ? 'IBPS' : 'RRB'} website?`,
      `No. Takkar is an independent practice game and isn’t affiliated with any exam-conducting body. For notices, dates and results, see ${x.official.name}.`],
  ];
  if (x.marksNote) faq.splice(3, 0, [`How many marks are Quant and Reasoning in ${exam.short} ${x.stage}?`, x.marksNote]);
  return faq;
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
  const varied = !!x.sectionMarks;
  const clocks = sectionClocks(exam, x);
  const quantTitle = x.sectionNames[exam.quantLabel || 'Quant'];
  const quantWord = quantName(exam).toLowerCase();
  const title = x.title || `${exam.short} ${x.stage} exam pattern, marking and free practice · Takkar`;
  const desc = `${exam.name}: ${exam.paper.questions} questions, ${exam.paper.minutes} minutes, ${varied ? '−¼ of the marks' : `−${neg}`} for a wrong answer. Sections, scoring and free daily quant and reasoning practice.`;
  const url = `${SITE}/${exam.id}`;
  const faqList = faqs(exam, x);
  const play = `/play/?exam=${exam.id}`;
  const ld = (o) => `<script type="application/ld+json">\n${JSON.stringify(o).replace(/</g, '\\u003c')}\n</script>`;
  const others = sameGroup(exam);

  const sectionRows = exam.sections.map(([s, q]) => {
    const marks = varied ? x.sectionMarks[s] : String(q * exam.marks);
    const covered = s === 'Quant' || s === 'Maths' || s === 'Reasoning';
    return `<tr><td>${esc(x.sectionNames[s] || s)}</td><td>${q}</td><td>${marks}</td>${clocks.length ? `<td>${x.sectionMinutes[s]} min</td>` : ''}<td>${covered ? 'Yes' : 'Not yet'}</td></tr>`;
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
<link rel="alternate" hreflang="en-IN" href="${url}">
<link rel="alternate" hreflang="hi-IN" href="${SITE}/hi/${exam.id}">
<link rel="alternate" hreflang="x-default" href="${url}">
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
<meta property="og:locale:alternate" content="hi_IN">
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
      <nav class="nav__links" aria-label="Guides">
        <a href="/exams" aria-current="true">Exam guides</a>
        <a href="/practice">Practice</a>
        <a href="/question-of-the-day">Daily question</a>
        <a href="/tutors">For tutors</a>
      </nav>
      <a class="btn btn--white btn--small" href="${play}">Practise free</a>
    </div>
  </header>

  <main id="main" class="guide">
    <section class="section wrap guide-hero" aria-labelledby="g-title">
      <p class="pill">Exam guide · ${esc(exam.group)}</p>
      <h1 class="section__title guide-hero__title" id="g-title">${esc(x.heading || `${exam.short} ${x.stage}`)}: exam pattern, marking and free daily practice</h1>
      <p class="section__lead">${exam.paper.questions} questions in ${exam.paper.minutes} minutes, ${varied ? 'a quarter of the question’s marks off' : `${neg} of a mark off`} for each wrong answer. Here’s how the paper is built, how it’s scored, and two questions to try, with the steps.</p>
      <div class="hero__actions">
        <a class="btn btn--saffron" href="${play}">Practise ${esc(exam.short)} free</a>
        <a class="btn btn--ghost" href="#try">Try two questions</a>
      </div>
      <p class="tutors-note">Takkar is independent and not affiliated with any exam body. Patterns can change: the official notice on <a href="${x.official.url}" rel="noopener">${esc(x.official.name)}</a> always wins. <a href="/hi/${exam.id}" lang="hi" hreflang="hi">हिंदी में पढ़ें</a></p>
    </section>

    <section class="section wrap" aria-labelledby="g-pattern">
      <h2 class="section__title" id="g-pattern">The paper at a glance</h2>
      <div class="guide-card glass">
        <div class="guide-facts">
          <div><strong>${exam.paper.questions}</strong><span>questions</span></div>
          <div><strong>${exam.paper.minutes} min</strong><span>${clocks.length ? clocksShort(clocks) : 'one clock'}</span></div>
          <div><strong>${varied ? '−¼' : `+${exam.marks} / −${neg}`}</strong><span>${varied ? 'of the marks, per wrong answer' : 'right / wrong'}</span></div>
          <div><strong>${exam.seconds} s</strong><span>a question on average</span></div>
        </div>
        <div class="guide-table">
          <table>
            <thead><tr><th>Section</th><th><span class="th-long">Questions</span><span class="th-short" aria-hidden="true">Qs</span></th><th>Marks</th>${clocks.length ? '<th>Time</th>' : ''}<th><span class="th-long">On Takkar</span><span class="th-short" aria-hidden="true">Takkar</span></th></tr></thead>
            <tbody>
              ${sectionRows}
            </tbody>
          </table>
        </div>
        ${varied ? `<p class="guide-note">* ${esc(x.marksNote)}</p>` : `<p class="guide-note">${exam.paper.questions} questions × ${exam.marks} mark${exam.marks > 1 ? 's' : ''} = ${total} marks. ${esc(x.clock)}</p>`}
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
      <p class="section__lead">A mixed duel has five ${quantWord} and five reasoning questions, chosen in proportion to how often these topics come up in ${esc(exam.short)}; you can also play ${quantWord} or reasoning only.</p>
      <div class="guide-topics">
        <div class="guide-card glass"><h3>${esc(quantTitle)}</h3><ul class="guide-chips">${quantTopics.map(chip).join('')}</ul></div>
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
      <p class="guide-others">More ${esc(groupWord(exam.group))} exam guides: ${others.map((e) => `<a href="/${e.id}">${esc(e.short)} ${esc(EXTRA[e.id].stage)}</a>`).join(' · ')} · <a href="/exams">All exam guides</a> · <a href="/tutors">For tutors and coaching centres</a></p>
    </section>
  </main>
  __FOOTER__
</div>
</body>
</html>
`;
}

// ---------- Hindi exam guides: /hi and /hi/<exam> ----------
// The same facts and numbers as the English guides, in Hindi. Questions stay in English, as in the app.

const HI_TOPIC = {
  Percentages: 'प्रतिशत', 'Profit and loss': 'लाभ और हानि', Discount: 'छूट (बट्टा)', 'Simple interest': 'साधारण ब्याज',
  'Compound interest': 'चक्रवृद्धि ब्याज', 'Time and work': 'समय और कार्य', 'Pipes and cisterns': 'पाइप और टंकी',
  'Speed, time and distance': 'चाल, समय और दूरी', Trains: 'रेलगाड़ी', 'Boats and streams': 'नाव और धारा',
  'Ratio and proportion': 'अनुपात और समानुपात', Averages: 'औसत', Ages: 'आयु', Simplification: 'सरलीकरण',
  'LCM and HCF': 'LCM और HCF', Mixtures: 'मिश्रण', Partnership: 'साझेदारी', BODMAS: 'BODMAS', 'Number system': 'संख्या पद्धति',
  Fractions: 'भिन्न', Approximation: 'सन्निकटन', 'Quadratic equations': 'द्विघात समीकरण', 'Number series': 'संख्या श्रृंखला',
  'Letter series': 'अक्षर श्रृंखला', 'Coding and decoding': 'कोडिंग-डिकोडिंग', 'Direction sense': 'दिशा ज्ञान', 'Odd one out': 'विषम को चुनें',
  'Number analogy': 'संख्या सादृश्य', Ranking: 'क्रम (रैंकिंग)', Clocks: 'घड़ी', Calendar: 'कैलेंडर', 'Alphabet test': 'वर्णमाला परीक्षण',
  Inequalities: 'असमानता', Syllogism: 'न्याय निगमन (सिलॉजिज़्म)', 'Blood relations': 'रक्त संबंध', 'Word analogy': 'शब्द सादृश्य',
  'Letter analogy': 'अक्षर सादृश्य', Classification: 'वर्गीकरण',
};
const hiTopic = (label) => HI_TOPIC[label] || label;

const HI = {
  'ssc-cgl': {
    stage: 'टियर 1',
    sectionNames: { Reasoning: 'सामान्य बुद्धि एवं तर्कशक्ति', 'General Awareness': 'सामान्य जागरूकता', Quant: 'मात्रात्मक योग्यता', English: 'अंग्रेज़ी बोध' },
    clock: 'पूरे पेपर के लिए एक ही घड़ी: आप खंडों के बीच आ-जा सकते हैं।',
    stageNote: 'हाल के चक्रों में टियर 1 से तय हुआ है कि कौन टियर 2 में जाएगा, और अंतिम मेरिट सूची टियर 2 से बनी है।',
    official: 'ssc.gov.in',
    exampleOf: 'पूरे पेपर',
    notYet: 'अंग्रेज़ी, सामान्य जागरूकता, ज्यामिति, क्षेत्रमिति, त्रिकोणमिति और आँकड़ों का विश्लेषण (DI)',
    body: 'SSC',
  },
  'ibps-po': {
    stage: 'प्रीलिम्स',
    sectionNames: { English: 'अंग्रेज़ी भाषा', Quant: 'मात्रात्मक अभियोग्यता', Reasoning: 'तर्कशक्ति क्षमता' },
    clock: 'हर खंड के लिए 20 मिनट, एक के बाद एक; समय पूरा होने पर उस खंड में लौट नहीं सकते।',
    stageNote: 'प्रीलिम्स से तय होता है कि कौन मेन्स में जाएगा; प्रीलिम्स के अंक अंतिम मेरिट में नहीं जुड़ते।',
    official: 'ibps.in',
    exampleOf: 'अंग्रेज़ी खंड (30 प्रश्न, हर प्रश्न 1 अंक)',
    marksNote: '2025 से बताया गया है कि तर्कशक्ति के 35 प्रश्न 40 अंक के और मात्रात्मक अभियोग्यता के 35 प्रश्न 30 अंक के हैं (अंग्रेज़ी 30 अंक, कुल 100)। कुछ साइटें अब भी दोनों को 35-35 अंक बताती हैं, इसलिए आधिकारिक सूचना देखें।',
    appNote: 'Takkar में हर प्रश्न 1 अंक का गिना जाता है; ¼ की कटौती उसी तरह लागू होती है।',
    notYet: 'अंग्रेज़ी, आँकड़ों का विश्लेषण (DI), और बैठक व्यवस्था व पहेलियाँ',
    body: 'IBPS',
  },
  'rrb-ntpc': {
    stage: 'CBT 1',
    sectionNames: { 'General Awareness': 'सामान्य जागरूकता', Maths: 'गणित', Reasoning: 'सामान्य बुद्धि एवं तर्क' },
    clock: 'पूरे पेपर के लिए एक ही घड़ी: आप खंडों के बीच आ-जा सकते हैं।',
    stageNote: 'CBT 1 से तय होता है कि कौन CBT 2 और चयन के अगले चरणों में जाएगा।',
    official: 'indianrailways.gov.in और अपने क्षेत्रीय RRB की वेबसाइट',
    exampleOf: 'पूरे पेपर',
    notYet: 'सामान्य जागरूकता, ज्यामिति, क्षेत्रमिति और आँकड़ों का विश्लेषण (DI)',
    body: 'RRB',
  },
  'ssc-chsl': {
    stage: 'टियर 1',
    sectionNames: { English: 'अंग्रेज़ी भाषा', Reasoning: 'सामान्य बुद्धि', Quant: 'मात्रात्मक योग्यता', 'General Awareness': 'सामान्य जागरूकता' },
    clock: 'हर खंड के लिए 15 मिनट, एक के बाद एक (बताया गया है कि यह 2026 से है); समय पूरा होने पर उस खंड में लौट नहीं सकते।',
    stageNote: 'टियर 1 से तय होता है कि कौन टियर 2 में जाएगा; अंतिम मेरिट में कौन-सा टियर कैसे गिना जाता है, यह आधिकारिक सूचना में देखें।',
    official: 'ssc.gov.in',
    exampleOf: 'पूरे पेपर',
    notYet: 'अंग्रेज़ी, सामान्य जागरूकता, बीजगणित, ज्यामिति, क्षेत्रमिति, त्रिकोणमिति और आँकड़ों का विश्लेषण (DI)',
    body: 'SSC',
  },
  'ssc-gd': {
    stage: 'कॉन्स्टेबल',
    sectionNames: { Reasoning: 'सामान्य बुद्धि एवं तर्क', 'General Knowledge': 'सामान्य ज्ञान एवं सामान्य जागरूकता', Maths: 'प्रारंभिक गणित', 'English or Hindi': 'अंग्रेज़ी या हिंदी' },
    clock: 'पूरे पेपर के लिए एक ही घड़ी: आप खंडों के बीच आ-जा सकते हैं।',
    stageNote: 'CBT के बाद शारीरिक परीक्षा (PET और PST), मेडिकल और दस्तावेज़ों की जाँच होती है।',
    official: 'ssc.gov.in',
    exampleOf: 'पूरे पेपर',
    notYet: 'सामान्य ज्ञान, अंग्रेज़ी और हिंदी, और क्षेत्रमिति',
    body: 'SSC',
  },
  'ibps-rrb': {
    stage: 'प्रीलिम्स',
    sectionNames: { Reasoning: 'तर्कशक्ति', Quant: 'मात्रात्मक अभियोग्यता' },
    clock: 'तर्कशक्ति के लिए 25 मिनट और मात्रात्मक अभियोग्यता के लिए 20 मिनट, एक के बाद एक; समय पूरा होने पर उस खंड में लौट नहीं सकते।',
    stageNote: 'यही प्रीलिम्स ऑफ़िसर स्केल I (PO) और ऑफ़िस असिस्टेंट (क्लर्क) दोनों के लिए है; क्लर्क में गणित के खंड को न्यूमेरिकल एबिलिटी कहते हैं। प्रीलिम्स से तय होता है कि कौन मेन्स में जाएगा; प्रीलिम्स के अंक अंतिम मेरिट में नहीं जुड़ते।',
    official: 'ibps.in',
    exampleOf: 'पूरे पेपर',
    appNote: 'Takkar में हर प्रश्न को 34 सेकंड मिलते हैं, जो असली पेपर के औसत के क़रीब है।',
    notYet: 'आँकड़ों का विश्लेषण (DI), और बैठक व्यवस्था व पहेलियाँ',
    body: 'IBPS',
  },
  'rrb-group-d': {
    stage: 'CBT',
    sectionNames: { 'General Science': 'सामान्य विज्ञान', Maths: 'गणित', Reasoning: 'सामान्य बुद्धि एवं तर्क', 'General Awareness': 'सामान्य जागरूकता और करेंट अफ़ेयर्स' },
    clock: 'पूरे पेपर के लिए एक ही घड़ी: आप खंडों के बीच आ-जा सकते हैं।',
    stageNote: 'CBT के बाद शारीरिक दक्षता परीक्षा (PET), फिर दस्तावेज़ों की जाँच और मेडिकल होता है।',
    official: 'indianrailways.gov.in और अपने क्षेत्रीय RRB की वेबसाइट',
    exampleOf: 'पूरे पेपर',
    notYet: 'सामान्य विज्ञान, सामान्य जागरूकता, ज्यामिति और क्षेत्रमिति',
    body: 'RRB',
  },
};
const HI_GROUP = { SSC: 'SSC', Banking: 'बैंक', Railways: 'रेलवे' };
const listHi = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} और ${items.at(-1)}`);

/** What a guess is worth on average, in Hindi; the same sums as guessNote. */
function guessNoteHi(marks, negative, lead) {
  const four = marks / 4 - (3 / 4) * negative;
  const two = marks / 2 - negative / 2;
  const say = (v) => (Math.abs(v) < 1e-9 ? 'कुछ नहीं मिलता' : `लगभग ${num(Math.round(v * 100) / 100)} अंक मिलता है`);
  return `${lead}, चार विकल्पों में से बिना सोचे अंदाज़ा लगाने पर ${say(four)}; पहले दो विकल्प हटा दें तो ${say(two)}।`;
}

function faqsHi(exam, h) {
  const neg = frac(exam.negative);
  const quant = h.sectionNames.Quant || h.sectionNames.Maths;
  const x = EXTRA[exam.id];
  const clocks = sectionClocks(exam, x);
  const faq = [
    [`क्या ${exam.short} ${h.stage} में नेगेटिव मार्किंग है?`,
      x.sectionMarks
        ? 'हाँ। हर ग़लत उत्तर पर उस प्रश्न के अंकों का एक-चौथाई कटता है। छोड़े गए प्रश्न पर कुछ नहीं कटता, इसलिए अंदाज़ा तभी लगाएँ जब कुछ विकल्प हटा सकें।'
        : `हाँ। हर ग़लत उत्तर पर ${neg} अंक कटता है, और सही उत्तर पर ${exam.marks} ${exam.marks > 1 ? 'अंक मिलते हैं' : 'अंक मिलता है'}। छोड़े गए प्रश्न पर कोई अंक नहीं कटता।`],
    [clocks.length ? `क्या ${exam.short} ${h.stage} में हर खंड का अलग समय होता है?` : `${exam.short} ${h.stage} में प्रति प्रश्न कितना समय मिलता है?`,
      clocks.length
        ? `हाँ। ${sameClock(clocks) ? `${listHi(clocks.map(([s]) => h.sectionNames[s] || s))}, हर खंड के लिए ${clocks[0][1]} मिनट` : listHi(clocks.map(([s, m]) => `${h.sectionNames[s] || s} के लिए ${m} मिनट`))}, कुल ${exam.paper.minutes} मिनट, और समय पूरा होने पर उस खंड में लौट नहीं सकते।`
        : `${exam.paper.questions} प्रश्नों के लिए ${exam.paper.minutes} मिनट: औसतन ${exam.seconds} सेकंड प्रति प्रश्न। ${h.clock}`],
    [`${exam.short} ${h.stage} में कौन-कौन से खंड होते हैं?`,
      `${exam.sections.length} खंड: ${exam.sections.map(([s, q]) => `${h.sectionNames[s] || s} (${q} प्रश्न)`).join(', ')}। कुल ${exam.paper.questions} प्रश्न।`],
    [`${exam.short} के लिए ${quant} और तर्कशक्ति का रोज़ मुफ़्त अभ्यास कैसे करें?`,
      `Takkar पर हर ड्यूएल में दस नए प्रश्न मिलते हैं, पाँच ${quant} के और पाँच तर्कशक्ति के, ${exam.short} की अंक योजना और समय के साथ, चरण-दर-चरण हल सहित। यह किसी भी ब्राउज़र में playtakkar.in/play पर मुफ़्त है, बिना साइन-अप के।`],
    [`क्या Takkar ${h.body} की आधिकारिक वेबसाइट है?`,
      `नहीं। Takkar एक स्वतंत्र अभ्यास खेल है और किसी परीक्षा आयोजित करने वाली संस्था से जुड़ा नहीं है। सूचना, तिथियों और परिणामों के लिए ${h.official} देखें।`],
  ];
  if (h.marksNote) faq.splice(3, 0, [`${exam.short} ${h.stage} में मात्रात्मक अभियोग्यता और तर्कशक्ति कितने अंक की होती हैं?`, h.marksNote]);
  return faq;
}

function pageHi(exam) {
  const x = EXTRA[exam.id];
  const h = HI[exam.id];
  const neg = frac(exam.negative);
  const varied = !!x.sectionMarks;
  const clocks = sectionClocks(exam, x);
  const quantTopics = topics(exam, QUANT);
  const reasonTopics = topics(exam, REASONING);
  const qs = [sample(exam, QUANT, 'q'), sample(exam, REASONING, 'r')];
  const ex = x.example;
  const exMarks = ex.perSection ? 1 : exam.marks;
  const exNeg = ex.perSection ? 0.25 : exam.negative;
  const total = exam.paper.questions * exam.marks;
  const quantHi = h.sectionNames.Quant || h.sectionNames.Maths;
  const url = `${SITE}/hi/${exam.id}`;
  const en = `${SITE}/${exam.id}`;
  const title = `${exam.short} ${h.stage} परीक्षा पैटर्न और नेगेटिव मार्किंग · Takkar`;
  const desc = `${exam.short} ${h.stage}: ${exam.paper.questions} प्रश्न, ${exam.paper.minutes} मिनट, ग़लत उत्तर पर ${varied ? 'प्रश्न के अंकों का ¼' : `${neg} अंक`} की कटौती। खंड, अंक गणना और रोज़ मुफ़्त अभ्यास, हल सहित।`;
  const faqList = faqsHi(exam, h);
  const play = `/play/?exam=${exam.id}`;
  const ld = (o) => `<script type="application/ld+json">\n${JSON.stringify(o).replace(/</g, '\\u003c')}\n</script>`;
  const others = sameGroup(exam);
  const chipHi = (label) => (PRACTICE_SLUGS.has(topicSlug(label)) ? `<li><a href="/practice/${topicSlug(label)}">${esc(hiTopic(label))}</a></li>` : `<li>${esc(hiTopic(label))}</li>`);
  const sectionRows = exam.sections.map(([s, q]) => {
    const marks = varied ? x.sectionMarks[s] : String(q * exam.marks);
    const covered = s === 'Quant' || s === 'Maths' || s === 'Reasoning';
    return `<tr><td>${esc(h.sectionNames[s] || s)}</td><td>${q}</td><td>${marks}</td>${clocks.length ? `<td>${x.sectionMinutes[s]} मिनट</td>` : ''}<td>${covered ? 'हाँ' : 'अभी नहीं'}</td></tr>`;
  }).join('\n              ');
  const question = (q, n) => questionHtml({ ...q, label: hiTopic(q.label) }, n, false, { show: 'उत्तर और हल देखें', answer: 'उत्तर', lang: 'en' });

  return `<!doctype html>
<html lang="hi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Generated by website/scripts/build-guides.mjs from the app's exam settings and question engine. Edit the script, not this page. -->
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="en-IN" href="${en}">
<link rel="alternate" hreflang="hi-IN" href="${url}">
<link rel="alternate" hreflang="x-default" href="${en}">
<meta name="theme-color" content="#070A1F">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-48.png" sizes="48x48" type="image/png">
<link rel="icon" href="/favicon-96.png" sizes="96x96" type="image/png">
<link rel="icon" href="/favicon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/styles.css?v=${CSS_VERSION}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Takkar">
<meta property="og:title" content="${esc(`${exam.short} ${h.stage}: परीक्षा पैटर्न, अंक योजना और मुफ़्त अभ्यास`)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/og-image.png">
<meta property="og:image:alt" content="Takkar: a daily quiz duel for exam aspirants">
<meta property="og:locale" content="hi_IN">
<meta property="og:locale:alternate" content="en_IN">
<meta name="twitter:card" content="summary_large_image">
${ld({ '@context': 'https://schema.org', '@type': 'FAQPage', url, inLanguage: 'hi-IN', mainEntity: faqList.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) })}
${ld({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Takkar', item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: 'हिंदी गाइड', item: `${SITE}/hi` }, { '@type': 'ListItem', position: 3, name: `${exam.short} ${h.stage}`, item: url }] })}
</head>
<body>
<a class="skip-link" href="#main">मुख्य सामग्री पर जाएँ</a>
<div class="page">
  <div class="glows" aria-hidden="true"><span class="glow glow--cobalt hero-glow-a"></span><span class="glow glow--saffron hero-glow-b"></span></div>
  <header class="site-header wrap">
    <div class="nav glass">
      <a class="brand" href="/" aria-label="Takkar होम">
        <svg class="brand__mark" viewBox="0 0 40 32" aria-hidden="true"><circle cx="14" cy="16" r="11" fill="#4B5DFF"/><circle cx="26" cy="16" r="11" fill="#FF6A00"/><path d="M20 6.78 A11 11 0 0 0 20 25.22 A11 11 0 0 0 20 6.78 Z" fill="#FFFFFF"/></svg>
        <span class="brand__word">takkar</span>
      </a>
      <nav class="nav__links" aria-label="गाइड">
        <a href="/hi" aria-current="true">सभी हिंदी गाइड</a>
        <a href="/practice" hreflang="en">अभ्यास</a>
        <a href="/${exam.id}" lang="en" hreflang="en">English</a>
      </nav>
      <a class="btn btn--white btn--small" href="${play}">मुफ़्त अभ्यास</a>
    </div>
  </header>

  <main id="main" class="guide">
    <section class="section wrap guide-hero" aria-labelledby="g-title">
      <p class="pill">परीक्षा गाइड · ${esc(exam.short)}</p>
      <h1 class="section__title guide-hero__title" id="g-title">${esc(exam.short)} ${esc(h.stage)}: परीक्षा पैटर्न, अंक योजना और मुफ़्त दैनिक अभ्यास</h1>
      <p class="section__lead">${exam.paper.questions} प्रश्न, ${exam.paper.minutes} मिनट, और हर ग़लत उत्तर पर ${varied ? 'प्रश्न के अंकों का एक-चौथाई' : `${neg} अंक`} कटता है। यहाँ पढ़ें कि पेपर कैसा होता है, अंक कैसे गिने जाते हैं, और हल सहित दो प्रश्न आज़माएँ।</p>
      <div class="hero__actions">
        <a class="btn btn--saffron" href="${play}">${esc(exam.short)} का मुफ़्त अभ्यास करें</a>
        <a class="btn btn--ghost" href="#try">दो प्रश्न आज़माएँ</a>
      </div>
      <p class="tutors-note">Takkar स्वतंत्र है और किसी परीक्षा संस्था से जुड़ा नहीं है। पैटर्न बदल सकता है: अंतिम जानकारी के लिए <a href="${x.official.url}" rel="noopener">${esc(x.official.url.replace('https://', ''))}</a> पर आधिकारिक सूचना देखें। <a href="/${exam.id}" lang="en" hreflang="en">Read in English</a></p>
    </section>

    <section class="section wrap" aria-labelledby="g-pattern">
      <h2 class="section__title" id="g-pattern">पेपर एक नज़र में</h2>
      <div class="guide-card glass">
        <div class="guide-facts">
          <div><strong>${exam.paper.questions}</strong><span>प्रश्न</span></div>
          <div><strong>${exam.paper.minutes} मिनट</strong><span>${clocks.length ? (sameClock(clocks) ? `हर खंड के ${clocks[0][1]}` : `खंडवार ${clocks.map(([, m]) => m).join(' + ')}`) : 'एक ही घड़ी'}</span></div>
          <div><strong>${varied ? '−¼' : `+${exam.marks} / −${neg}`}</strong><span>${varied ? 'प्रश्न के अंकों का, ग़लत उत्तर पर' : 'सही / ग़लत'}</span></div>
          <div><strong>${exam.seconds} सेकंड</strong><span>औसतन प्रति प्रश्न</span></div>
        </div>
        <div class="guide-table">
          <table>
            <thead><tr><th>खंड</th><th>प्रश्न</th><th>अंक</th>${clocks.length ? '<th>समय</th>' : ''}<th>Takkar पर</th></tr></thead>
            <tbody>
              ${sectionRows}
            </tbody>
          </table>
        </div>
        ${varied ? `<p class="guide-note">* ${esc(h.marksNote)}</p>` : `<p class="guide-note">${exam.paper.questions} प्रश्न × ${exam.marks} अंक = ${total} अंक। ${esc(h.clock)}</p>`}
        <p class="guide-note">${esc(h.stageNote)}</p>
      </div>
    </section>

    <section class="section wrap" aria-labelledby="g-score">
      <h2 class="section__title" id="g-score">अंक कैसे गिने जाते हैं</h2>
      <p class="section__lead">हर ग़लत उत्तर अंक घटाता है, इसलिए छोड़ा गया प्रश्न कभी-कभी अंदाज़े से बेहतर होता है।</p>
      <div class="guide-card glass guide-score">
        <p>मान लीजिए ${esc(h.exampleOf)} में आपके <strong>${ex.right} उत्तर सही</strong> और <strong>${ex.wrong} ग़लत</strong> हैं:</p>
        <p class="guide-sum">${ex.right} × ${num(exMarks)} − ${ex.wrong} × ${frac(exNeg)} = ${num(ex.right * exMarks)} − ${num(ex.wrong * exNeg)} = <strong>${num(ex.right * exMarks - ex.wrong * exNeg)}</strong></p>
        <p class="guide-note">${guessNoteHi(exMarks, exNeg, ex.perSection ? 'अंग्रेज़ी खंड में (हर प्रश्न 1 अंक) औसतन' : 'औसतन')}</p>
      </div>
    </section>

    <section class="section wrap" aria-labelledby="g-topics">
      <h2 class="section__title" id="g-topics">Takkar पर ${esc(exam.short)} का अभ्यास</h2>
      <p class="section__lead">मिक्स्ड ड्यूएल में ${quantHi} के पाँच और तर्कशक्ति के पाँच प्रश्न होते हैं, जो इस परीक्षा में इन टॉपिक के आने की बारंबारता के अनुसार चुने जाते हैं; आप केवल ${quantHi} या केवल तर्कशक्ति भी खेल सकते हैं।</p>
      <div class="guide-topics">
        <div class="guide-card glass"><h3>${quantHi}</h3><ul class="guide-chips">${quantTopics.map(chipHi).join('')}</ul></div>
        <div class="guide-card glass"><h3>तर्कशक्ति</h3><ul class="guide-chips">${reasonTopics.map(chipHi).join('')}</ul></div>
      </div>
      <p class="guide-note">लिंक वाले टॉपिक के हल सहित प्रश्नों के पेज हैं (अंग्रेज़ी में)। <a href="/practice">सभी अभ्यास पेज</a>।</p>
      <p class="guide-note">अभी Takkar में नहीं: ${esc(h.notYet)}।</p>${h.appNote ? `\n      <p class="guide-note">${esc(h.appNote)}</p>` : ''}
    </section>

    <section class="section wrap" id="try" aria-labelledby="g-try">
      <h2 class="section__title" id="g-try">दो प्रश्न आज़माएँ</h2>
      <p class="section__lead">Takkar के प्रश्न-इंजन से बने, हर उत्तर गणना से निकला है, कहीं से कॉपी नहीं। हर प्रश्न के लिए ${exam.seconds} सेकंड रखें। प्रश्न अभी अंग्रेज़ी में हैं, जैसे Takkar ऐप में।</p>
      <div class="sample-grid">${qs.map((q, i) => question(q, i)).join('')}
      </div>
      <div class="hero__actions"><a class="btn btn--saffron" href="${play}">ऐसे दस प्रश्न खेलें, मुफ़्त</a></div>
    </section>
${x.tier2 ? `
    <section class="section wrap" aria-labelledby="g-tier2">
      <div class="guide-card glass">
        <h2 class="guide-card__title" id="g-tier2">टियर 2 की तैयारी कर रहे हैं?</h2>
        <p>टियर 2 में गणित और तर्कशक्ति के यही टॉपिक कठिन स्तर पर आते हैं, और उसकी अंक योजना अलग है। Takkar पर <strong>Harder</strong> स्तर चुनें, और टियर 2 की अंक योजना आधिकारिक सूचना में देखें।</p>
      </div>
    </section>
` : ''}
    <section class="section wrap faq" aria-labelledby="g-faq">
      <h2 class="section__title" id="g-faq">${esc(exam.short)}: अक्सर पूछे जाने वाले प्रश्न</h2>
      <div class="faq__list glass">
        ${faqList.map(([q, a]) => `<details>\n          <summary>${esc(q)}</summary>\n          <p>${esc(a)}</p>\n        </details>`).join('\n        ')}
      </div>
    </section>

    <section class="section wrap" aria-label="अन्य परीक्षा गाइड">
      <p class="guide-others">${HI_GROUP[exam.group]} की अन्य परीक्षा गाइड: ${others.map((e) => `<a href="/hi/${e.id}">${esc(e.short)} ${esc(HI[e.id].stage)}</a>`).join(' · ')} · <a href="/hi">सभी हिंदी गाइड</a> · <a href="/question-of-the-day" hreflang="en">आज का प्रश्न (अंग्रेज़ी में)</a></p>
    </section>
  </main>
  __FOOTER__
</div>
</body>
</html>
`;
}

/** /hi: the Hindi guides in one place, for Hindi searches about the exams. */
function hiIndex() {
  const url = `${SITE}/hi`;
  const title = 'SSC, बैंक और रेलवे परीक्षा पैटर्न हिंदी में · Takkar';
  const desc = 'SSC CGL, CHSL और GD, IBPS PO और RRB, और RRB NTPC और Group D का परीक्षा पैटर्न, नेगेटिव मार्किंग और खंड हिंदी में, साथ में हल सहित प्रश्न।';
  const ld = (o) => `<script type="application/ld+json">\n${JSON.stringify(o).replace(/</g, '\\u003c')}\n</script>`;
  const card = (e) => {
    const neg = EXTRA[e.id].sectionMarks ? 'प्रश्न के अंकों का ¼' : `${frac(e.negative)} अंक`;
    return `
        <a class="offer panel practice-card" href="/hi/${e.id}">
          <span class="offer__tag offer__tag--now">${EXTRA[e.id].sectionMarks ? '−¼' : markingLabel(e)}</span>
          <h3>${esc(e.short)} ${esc(HI[e.id].stage)}</h3>
          <p>${e.paper.questions} प्रश्न, ${e.paper.minutes} मिनट, ग़लत उत्तर पर ${neg} कटता है।</p>
          <span class="practice-card__go">पूरी गाइड पढ़ें →</span>
        </a>`;
  };
  return `<!doctype html>
<html lang="hi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Generated by website/scripts/build-guides.mjs. Edit the script, not this page. -->
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
<meta property="og:type" content="website">
<meta property="og:site_name" content="Takkar">
<meta property="og:title" content="SSC, बैंक और रेलवे परीक्षा गाइड हिंदी में">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/og-image.png">
<meta property="og:image:alt" content="Takkar: a daily quiz duel for exam aspirants">
<meta property="og:locale" content="hi_IN">
<meta name="twitter:card" content="summary_large_image">
${ld({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Takkar', item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: 'हिंदी गाइड', item: url }] })}
</head>
<body>
<a class="skip-link" href="#main">मुख्य सामग्री पर जाएँ</a>
<div class="page">
  <div class="glows" aria-hidden="true"><span class="glow glow--cobalt hero-glow-a"></span><span class="glow glow--saffron hero-glow-b"></span></div>
  <header class="site-header wrap">
    <div class="nav glass">
      <a class="brand" href="/" aria-label="Takkar होम">
        <svg class="brand__mark" viewBox="0 0 40 32" aria-hidden="true"><circle cx="14" cy="16" r="11" fill="#4B5DFF"/><circle cx="26" cy="16" r="11" fill="#FF6A00"/><path d="M20 6.78 A11 11 0 0 0 20 25.22 A11 11 0 0 0 20 6.78 Z" fill="#FFFFFF"/></svg>
        <span class="brand__word">takkar</span>
      </a>
      <nav class="nav__links" aria-label="गाइड">
        <a href="/hi" aria-current="page">सभी हिंदी गाइड</a>
        <a href="/practice" hreflang="en">अभ्यास</a>
        <a href="/exams" lang="en" hreflang="en">English</a>
      </nav>
      <a class="btn btn--white btn--small" href="/play/">मुफ़्त अभ्यास</a>
    </div>
  </header>

  <main id="main" class="guide">
    <section class="section wrap guide-hero" aria-labelledby="hi-title">
      <p class="pill">परीक्षा गाइड · हिंदी</p>
      <h1 class="section__title guide-hero__title" id="hi-title">SSC, बैंक और रेलवे परीक्षा गाइड हिंदी में</h1>
      <p class="section__lead">हर गाइड में पेपर का पैटर्न, अंक योजना, प्रति प्रश्न समय, Takkar पर किन टॉपिक का अभ्यास होता है, और हल सहित दो प्रश्न हैं।</p>
      <div class="hero__actions"><a class="btn btn--saffron" href="/play/">आज का मुफ़्त अभ्यास करें</a><a class="btn btn--ghost" href="/practice" hreflang="en">अभ्यास प्रश्न (अंग्रेज़ी में)</a></div>
    </section>
    <section class="section wrap" aria-labelledby="hi-exams">
      <h2 class="section__title" id="hi-exams">अपनी परीक्षा चुनें</h2>${examGroups().map(([group, exams]) => `
      <h3 class="guide-group">${esc(HI_GROUP[group])}</h3>
      <div class="offer-grid exam-grid">${exams.map(card).join('')}
      </div>`).join('')}
      <p class="guide-others">Takkar एक मुफ़्त दैनिक क्विज़ है जिसमें आपकी परीक्षा के पैटर्न और समय में मात्रात्मक योग्यता और तर्कशक्ति के दस प्रश्न होते हैं। Takkar स्वतंत्र है और किसी परीक्षा संस्था से जुड़ा नहीं है। <a href="/" lang="en" hreflang="en">Read in English</a></p>
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
  { label: 'Simple interest', method: [
    'Simple interest = principal × rate × time ÷ 100, with the rate in % a year and the time in years.',
    'Amount = principal + interest. To find the rate or the time instead, turn the same formula round: rate = interest × 100 ÷ (principal × time).',
  ] },
  { label: 'Compound interest', method: [
    'Amount = principal × (1 + rate ÷ 100)^years, and compound interest = amount − principal.',
    'For 2 years, compound interest is more than simple interest by principal × (rate ÷ 100)²: the interest earned on the first year’s interest.',
  ] },
  { label: 'Ratio and proportion', method: [
    'To share an amount in the ratio a : b, add the parts: the shares are amount × a ÷ (a + b) and amount × b ÷ (a + b).',
    'To join a : b and b : c into one ratio, first make the two b values equal by multiplying each ratio, then read off a : b : c.',
  ] },
  { label: 'Averages', method: [
    'Average = total ÷ number of items, so total = average × number of items.',
    'When someone joins or leaves, work with totals: the newcomer = new average × new count − old average × old count.',
  ] },
  { label: 'Discount', method: [
    'Price paid = marked price × (100 − discount %) ÷ 100.',
    'Two discounts of a% and b% one after the other equal a single discount of a + b − (a × b) ÷ 100 percent, not a + b.',
  ] },
  { label: 'Number system', method: [
    'Unit digit of a power: only the last digit matters, and its powers repeat every 4 (2, 4, 8, 6 for 2). Divide the power by 4 and use the remainder; a remainder of 0 means the 4th one.',
    'To make a number divisible by n, divide it by n and add n − remainder.',
  ] },
  { label: 'BODMAS', method: [
    'Work in this order: brackets, then “of”, then division and multiplication from left to right, then addition and subtraction from left to right.',
    '“Of” means multiply and comes before division: 30 ÷ 3 of 5 = 30 ÷ 15 = 2.',
  ] },
  { label: 'Approximation', method: [
    'Round each number to the nearest whole number (27.03 → 27, 13.92 → 14), then work it out.',
    'The options are usually far apart, so the rounded answer is enough: don’t spend time on the decimals.',
  ] },
  { label: 'Quadratic equations', method: [
    'For x² + bx + c = 0, the two roots add up to −b and multiply to c: for x² − 8x + 12 = 0 they are 6 and 2.',
    'Compare every value of x with every value of y. If x is bigger in every pair, x > y; if it is equal in one pair and bigger in the rest, x ≥ y; if the pairs go both ways, no relation can be established.',
  ] },
  { label: 'Blood relations', method: [
    'Draw a small family tree: one generation to a row, a line from parent to child, and = between a married couple.',
    'Join two statements through the person they share: if G is the mother of L and L is the wife of W, G is the mother of W’s wife, so W’s mother-in-law.',
  ] },
  { label: 'Direction sense', method: [
    'Draw the walk with north at the top. Facing north, right is east; facing south, right is west and left is east.',
    'For the distance from the start, add up the north–south moves and the east–west moves separately, then use √(a² + b²). The 6-8-10 and 5-12-13 triangles come up often.',
  ] },
  { label: 'Inequalities', method: [
    'A conclusion follows only if every sign on the path between its two letters points the same way: A > B ≥ C gives A > C, but A > B < C says nothing about A and C.',
    'One strict sign (> or <) on the path makes the result strict. If two conclusions about the same pair are each uncertain but together cover every case, like A > B and A ≤ B, “Either I or II follows”.',
  ] },
  { label: 'Word analogy', method: [
    'Say the link in the first pair as a sentence: “a pig lives in a sty”, “a spade is used to dig”, “force is measured in newtons”.',
    'Pick the option that fits the same sentence for the third word; if two fit, make the sentence more exact.',
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
        <a href="/exams"${url === `${SITE}/exams` ? ' aria-current="page"' : ''}>Exam guides</a>
        <a href="/practice"${url === `${SITE}/practice` ? ' aria-current="page"' : url.startsWith(`${SITE}/practice/`) ? ' aria-current="true"' : ''}>Practice</a>
        <a href="/question-of-the-day">Daily question</a>
        <a href="/tutors">For tutors</a>
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
  // The exam words matter more than the brand (Google shows the site name above the title anyway).
  const title = [`${label} questions with solutions: SSC, bank, railway · Takkar`, `${label} questions with solutions: SSC, bank, railway`, `${label} questions with solutions · Takkar`]
    .find((t) => t.length <= 65);
  const desc = `${label} questions with step-by-step solutions for SSC, bank and railway exams: the quick method, 5 solved examples, free practice.`;
  const faqList = [
    [`Which exams ask ${label.toLowerCase()} questions?`,
      exams.length
        ? `Takkar asks ${label.toLowerCase()} questions often in the ${list(exams)} patterns, because those papers often include them. Check each exam’s latest syllabus for its exact weight.`
        : `They appear in SSC, bank and railway exams, though less often than the main topics. Check each exam’s latest syllabus.`],
    [`What is the quickest method for ${label.toLowerCase()} questions?`, method.join(' ')],
    [`How can I practise ${label.toLowerCase()} for free every day?`,
      `On Takkar, open Practice and pick ${label}: ten questions at a time, with the steps after each answer. Topic practice is free and unlimited, in any browser at playtakkar.in/play.`],
  ];
  const others = PRACTICE.filter((p) => p.label !== label);
  const tiers = new Set(qs.map((q) => q.tier));
  const spread = tiers.size > 1 ? 'five questions from easy to hard' : { 1: 'five easy questions', 2: 'five exam-level questions', 3: 'five harder questions' }[qs[0].tier];
  const main = `
    <section class="section wrap guide-hero" aria-labelledby="p-title">
      <p class="pill">Practice · ${section}</p>
      <h1 class="section__title guide-hero__title" id="p-title">${esc(label)} questions with step-by-step solutions</h1>
      <p class="section__lead">The quick method, then ${spread}, each with its working. ${exams.length ? `A regular topic in ${esc(list(exams))}.` : ''}</p>
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
      <h1 class="section__title guide-hero__title" id="pi-title">SSC, bank and railway practice questions with solutions</h1>
      <p class="section__lead">Quant and reasoning topics from SSC, bank and railway exams: the quick method for each, five solved questions, and unlimited free practice in the app.</p>
      <div class="hero__actions"><a class="btn btn--saffron" href="/play/">Play today’s duel</a><a class="btn btn--ghost" href="/question-of-the-day">Question of the day</a></div>
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
    title: 'SSC, bank and railway practice questions with solutions · Takkar',
    desc: `Free quant and reasoning practice for SSC, bank and railway exams: ${PRACTICE.length} topics, each with the quick method and solved questions.`,
    url, ogTitle: 'Free practice questions with solutions', main, ctaHref: '/play/', ctaText: 'Play free',
    lds: [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Takkar', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Practice', item: url },
    ] }],
  });
}

/** /exams: every exam guide, by group. */
function examsIndex() {
  const url = `${SITE}/exams`;
  const card = (e) => {
    const x = EXTRA[e.id];
    return `
        <a class="offer panel practice-card" href="/${e.id}">
          <span class="offer__tag offer__tag--now">${x.sectionMarks ? '−¼ of the marks' : markingLabel(e)}</span>
          <h3>${esc(e.short)} ${esc(x.stage)}</h3>
          <p>${e.paper.questions} questions in ${e.paper.minutes} minutes: ${e.seconds} seconds a question.</p>
          <span class="practice-card__go">Pattern and free practice →</span>
        </a>`;
  };
  const main = `
    <section class="section wrap guide-hero" aria-labelledby="ex-title">
      <p class="pill">Exam guides</p>
      <h1 class="section__title guide-hero__title" id="ex-title">SSC, bank and railway exam patterns</h1>
      <p class="section__lead">Every guide has the paper at a glance, how it’s scored, the topics Takkar practises for it and two solved questions. Pick your exam and practise it free, in its own marking and timing.</p>
      <div class="hero__actions"><a class="btn btn--saffron" href="/play/">Play today’s duel</a><a class="btn btn--ghost" href="/practice">Practice questions</a></div>
    </section>${examGroups().map(([group, exams]) => `
    <section class="section wrap" aria-labelledby="ex-${group.toLowerCase()}">
      <h2 class="section__title" id="ex-${group.toLowerCase()}">${esc(group)}</h2>
      <div class="offer-grid exam-grid">${exams.map(card).join('')}
      </div>
    </section>`).join('')}
    <section class="section wrap" aria-label="More">
      <p class="guide-others">In Hindi: <a href="/hi" lang="hi" hreflang="hi">सभी हिंदी गाइड</a> · <a href="/question-of-the-day">Question of the day</a> · <a href="/tutors">For tutors and coaching centres</a></p>
    </section>`;
  return shell({
    title: 'SSC, bank and railway exam patterns and free practice · Takkar',
    desc: 'Exam patterns, marking and free practice for SSC CGL, CHSL and GD, IBPS PO and RRB, and RRB NTPC and Group D, each with solved questions.',
    url, ogTitle: 'SSC, bank and railway exam patterns', main, ctaHref: '/play/', ctaText: 'Play free',
    lds: [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Takkar', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Exam guides', item: url },
    ] }],
  });
}

// ---------- Question of the day: data for website/lib (served by api/question-of-the-day.js) ----------

const QOTD_FIRST = '2026-11-01';
const QOTD_LAST = '2027-12-31'; // rerun this script before then to add more days
// Days before this were published rotating through the first three exams and must not change;
// from it on, every exam takes its turn.
const QOTD_ALL_EXAMS_FROM = '2026-11-06';
const QOTD_FIRST_EXAMS = ['ssc-cgl', 'ibps-po', 'rrb-ntpc'];

/** One question per IST day: exams take turns, quant and reasoning alternate, topics follow the exam's weights. */
function qotdDays() {
  const first = QOTD_FIRST_EXAMS.map((id) => EXAMS[id]);
  const all = Object.values(EXAMS);
  const out = {};
  const end = Date.parse(`${QOTD_LAST}T00:00:00Z`);
  for (let t = Date.parse(`${QOTD_FIRST}T00:00:00Z`), i = 0; t <= end; t += 86400000, i++) {
    const day = new Date(t).toISOString().slice(0, 10);
    const exams = day < QOTD_ALL_EXAMS_FROM ? first : all;
    const exam = exams[i % exams.length];
    const list = i % 2 === 0 ? QUANT : REASONING;
    const rng = createRng(hashString(`qotd-${day}-v1`));
    const weight = (x) => Math.max(0, exam.weights[x.id] ?? 1);
    let r = rng.next() * list.reduce((sum, x) => sum + weight(x), 0);
    const template = list.find((x) => (r -= weight(x)) <= 0) || list[0];
    const q = generateQuestion(template, rng, template.tiers.includes(2) ? 2 : template.tiers[0]);
    out[day] = {
      exam: exam.id, topic: list === QUANT ? 'quant' : 'reasoning', label: q.label,
      practice: PRACTICE_SLUGS.has(topicSlug(q.label)) ? topicSlug(q.label) : null,
      text: q.text, options: q.options, answerIndex: q.answerIndex, answerText: q.answerText,
      steps: q.steps.filter((s) => !/^Answer:/.test(s)),
    };
  }
  return out;
}

/** The data module: the page around the question (same head, header and footer as the guides) and every day's question. */
function qotdData() {
  const page = shell({
    title: '__TITLE__', desc: '__DESC__', url: '__URL__', ogTitle: '__OGTITLE__', lds: [], main: '__MAIN__', ctaHref: '/play/', ctaText: 'Play free',
  }).replace('</head>', '__LD__\n</head>').replace('__FOOTER__', footer); // the footer goes in before quoting
  const exams = Object.fromEntries(Object.values(EXAMS).map((e) => [e.id, { short: e.short, name: e.name, seconds: e.seconds, quant: quantName(e) }]));
  return `// Generated by website/scripts/build-guides.mjs: one question a day from the app's question engine. Edit the script, not this file.
export const FIRST_DAY = '${QOTD_FIRST}';
export const SHELL = ${JSON.stringify(page)};
export const EXAMS = ${JSON.stringify(exams)};
export const DAYS = ${JSON.stringify(qotdDays())};
`;
}

// ---------- Write (or check) every page ----------

// The footer is copied from the home page, so every page's footer stays the same.
const home = readFileSync(OUT + 'index.html', 'utf8');
const footer = home.slice(home.indexOf('<footer class="site-footer wrap">'), home.indexOf('</footer>') + '</footer>'.length);
if (!footer.startsWith('<footer')) throw new Error('home page footer not found');

const pages = [
  ...Object.values(EXAMS).map((exam) => [`${exam.id}.html`, page(exam)]),
  ...Object.values(EXAMS).map((exam) => [`hi/${exam.id}.html`, pageHi(exam)]),
  ['hi/index.html', hiIndex()],
  ['exams.html', examsIndex()],
  ['practice.html', practiceIndex()],
  ...PRACTICE.map((t) => [`practice/${topicSlug(t.label)}.html`, practicePage(t)]),
  ['../lib/qotd-data.mjs', qotdData()],
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
