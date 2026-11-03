// Question of the day: builds the page for a date from the generated data (qotd-data.mjs).
// Used by api/question-of-the-day.js. Days change at midnight in India (IST, UTC+5:30).
import { FIRST_DAY, SHELL, EXAMS, DAYS } from './qotd-data.mjs';

const SITE = 'https://www.playtakkar.in';
const IST_MS = 5.5 * 3600 * 1000;
const DAY_MS = 86400000;
const ALL_DAYS = Object.keys(DAYS);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const istDay = (ms) => new Date(ms + IST_MS).toISOString().slice(0, 10);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const longDate = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** The question for a day. Past the generated range, the days start again from the first one. */
function questionFor(day) {
  if (DAYS[day]) return DAYS[day];
  const i = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${FIRST_DAY}T00:00:00Z`)) / DAY_MS);
  return DAYS[ALL_DAYS[((i % ALL_DAYS.length) + ALL_DAYS.length) % ALL_DAYS.length]];
}

function page({ title, desc, url, ogTitle, lds, main }) {
  const ld = lds.map((o) => `<script type="application/ld+json">\n${JSON.stringify(o).replace(/</g, '\\u003c')}\n</script>`).join('\n');
  // Function replacements, so "$" in the text is never read as a pattern.
  return SHELL
    .replace('__TITLE__', () => esc(title))
    .replace(/__DESC__/g, () => esc(desc))
    .replace(/__URL__/g, () => url)
    .replace('__OGTITLE__', () => esc(ogTitle))
    .replace('__LD__', () => ld)
    .replace('__MAIN__', () => main);
}

function render(day, today) {
  const q = questionFor(day);
  const exam = EXAMS[q.exam];
  const isToday = day === today;
  const url = isToday ? `${SITE}/question-of-the-day` : `${SITE}/question-of-the-day/${day}`;
  const when = longDate(day);
  const section = q.topic === 'quant' ? (q.exam === 'rrb-ntpc' ? 'Maths' : 'Quant') : 'Reasoning';
  const title = `${isToday ? 'Question of the day' : `Question for ${when}`}: ${exam.short} ${q.label.toLowerCase()} · Takkar`;
  const desc = `An ${exam.short} ${q.label.toLowerCase()} question for ${when}, with the answer and step-by-step solution. A new question every day on Takkar.`;
  const earlier = [];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(day, -i);
    if (d < FIRST_DAY) break;
    const e = questionFor(d);
    earlier.push(`<li><a href="/question-of-the-day/${d}">${esc(longDate(d))}</a><span>${esc(EXAMS[e.exam].short)} · ${esc(e.label)}</span></li>`);
  }
  const letters = 'ABCD';
  const main = `
    <section class="section wrap guide-hero qotd-hero" aria-labelledby="q-title">
      <p class="pill">Question of the day · ${esc(exam.short)} · ${section}</p>
      <h1 class="section__title guide-hero__title" id="q-title">${isToday ? 'Today’s question' : 'Question'}: ${esc(when)}</h1>
      <p class="section__lead">${isToday ? 'A new question every day at midnight, India time, in a different exam’s style. ' : ''}Give yourself ${exam.seconds} seconds, as in ${esc(exam.short)}, then open the steps.</p>
    </section>

    <section class="section wrap" aria-label="The question">
      <article class="sample panel qotd">
        <p class="sample__topic">${esc(exam.short)} · ${esc(q.label)}</p>
        <p class="sample__text">${esc(q.text).replace(/\n/g, '<br>')}</p>
        <ol class="sample__options" type="A">
          ${q.options.map((o) => `<li>${esc(o)}</li>`).join('\n          ')}
        </ol>
        <details class="sample__answer">
          <summary>Show the answer and steps</summary>
          <p><strong>Answer: ${letters[q.answerIndex]}. ${esc(q.answerText)}</strong></p>
          <ol class="sample__steps">${q.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        </details>
      </article>
      <div class="hero__actions">
        <a class="btn btn--saffron" href="/play/?exam=${q.exam}">Play today’s duel</a>
        ${q.practice ? `<a class="btn btn--ghost" href="/practice/${q.practice}">More ${esc(q.label.toLowerCase())} questions</a>` : `<a class="btn btn--ghost" href="/${q.exam}">${esc(exam.short)} exam guide</a>`}
      </div>
    </section>

    <section class="section wrap" aria-labelledby="q-earlier">
      ${earlier.length ? `<h2 class="section__title" id="q-earlier">Earlier questions</h2>
      <ul class="qotd-list">${earlier.join('')}</ul>
      <p class="guide-others"><a href="/question-of-the-day/archive">All earlier questions</a></p>` : '<h2 class="section__title" id="q-earlier">More practice</h2>'}
      <p class="guide-others">${isToday ? '' : '<a href="/question-of-the-day">Today’s question</a> · '}<a href="/practice">Practice questions</a> · Exam guides: ${Object.entries(EXAMS).map(([id, e]) => `<a href="/${id}">${esc(e.short)}</a>`).join(' · ')}</p>
    </section>`;
  const crumbs = [{ '@type': 'ListItem', position: 1, name: 'Takkar', item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: 'Question of the day', item: `${SITE}/question-of-the-day` }];
  if (!isToday) crumbs.push({ '@type': 'ListItem', position: 3, name: when, item: url });
  return page({ title, desc, url, ogTitle: `${isToday ? 'Question of the day' : when}: ${exam.short} ${q.label.toLowerCase()}`, main, lds: [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs }] });
}

/** Every day so far, newest first, a section a month. */
function renderArchive(today) {
  const url = `${SITE}/question-of-the-day/archive`;
  const months = new Map();
  for (let d = addDays(today, -1); d >= FIRST_DAY; d = addDays(d, -1)) {
    const month = new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const q = questionFor(d);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(`<li><a href="/question-of-the-day/${d}">${esc(longDate(d))}</a><span>${esc(EXAMS[q.exam].short)} · ${esc(q.label)}</span></li>`);
  }
  let n = 0;
  const sections = [...months].map(([month, items]) => `
    <section class="section wrap" aria-labelledby="m-${++n}">
      <h2 class="section__title" id="m-${n}">${esc(month)}</h2>
      <ul class="qotd-list">${items.join('')}</ul>
    </section>`).join('');
  const main = `
    <section class="section wrap guide-hero qotd-hero" aria-labelledby="a-title">
      <p class="pill">Question of the day · Archive</p>
      <h1 class="section__title guide-hero__title" id="a-title">Every question of the day</h1>
      <p class="section__lead">One quant or reasoning question a day in the SSC CGL, IBPS PO or RRB NTPC pattern, each with its answer and steps. <a href="/question-of-the-day">Today’s question</a> is on its own page.</p>
    </section>${sections || `
    <section class="section wrap"><p class="guide-others">The first questions will appear here tomorrow.</p></section>`}
    <section class="section wrap" aria-label="More practice">
      <p class="guide-others"><a href="/practice">Practice questions by topic</a> · Exam guides: ${Object.entries(EXAMS).map(([id, e]) => `<a href="/${id}">${esc(e.short)}</a>`).join(' · ')}</p>
    </section>`;
  return page({
    title: 'Question of the day archive: solved exam questions · Takkar',
    desc: 'Every Takkar question of the day so far, with answers and step-by-step solutions: quant and reasoning in the SSC CGL, IBPS PO and RRB NTPC pattern.',
    url, ogTitle: 'Question of the day: the archive', main,
    lds: [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Takkar', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Question of the day', item: `${SITE}/question-of-the-day` },
      { '@type': 'ListItem', position: 3, name: 'Archive', item: url },
    ] }],
  });
}

/** Seconds until the next midnight in India, so cached copies change with the question. */
const untilMidnight = (today, nowMs) => Math.max(60, Math.floor((Date.parse(`${addDays(today, 1)}T00:00:00Z`) - IST_MS - nowMs) / 1000));

/** /sitemap-qotd.xml: the archive and every past day, so they stay findable after they leave the 7-day list. */
export function qotdSitemap(nowMs = Date.now()) {
  const today = istDay(nowMs);
  const urls = [`  <url><loc>${SITE}/question-of-the-day/archive</loc><lastmod>${today}</lastmod></url>`];
  for (let d = addDays(today, -1); d >= FIRST_DAY; d = addDays(d, -1)) urls.push(`  <url><loc>${SITE}/question-of-the-day/${d}</loc><lastmod>${d}</lastmod></url>`);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': `public, max-age=3600, s-maxage=${untilMidnight(today, nowMs)}` } });
}

const html = (body, status, cache) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache } });

/**
 * The response for /question-of-the-day (dayParam empty), /question-of-the-day/YYYY-MM-DD or /question-of-the-day/archive.
 * Today's dated address sends people to the main one; days that haven't come yet don't exist.
 */
export function qotdResponse(dayParam, nowMs = Date.now()) {
  const today = istDay(nowMs);
  if (!dayParam) {
    // Cached by the CDN until the next midnight in India, so everyone gets the new question then.
    return html(render(today, today), 200, `public, max-age=300, s-maxage=${untilMidnight(today, nowMs)}`);
  }
  if (dayParam === 'archive') return html(renderArchive(today), 200, `public, max-age=300, s-maxage=${untilMidnight(today, nowMs)}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayParam) || Number.isNaN(Date.parse(`${dayParam}T00:00:00Z`)) || addDays(dayParam, 0) !== dayParam) {
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
  }
  if (dayParam === today) return new Response(null, { status: 302, headers: { Location: '/question-of-the-day', 'Cache-Control': 'public, max-age=60' } });
  if (dayParam > today || dayParam < FIRST_DAY) {
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=600' } });
  }
  return html(render(dayParam, today), 200, 'public, max-age=86400, s-maxage=604800');
}
