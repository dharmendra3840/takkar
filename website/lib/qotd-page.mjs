// Question of the day: builds the page for a date from the generated data (qotd-data.mjs), in English
// (/question-of-the-day) or Hindi (/hi/question-of-the-day). Used by api/question-of-the-day.js.
// Days change at midnight in India (IST, UTC+5:30).
import { FIRST_DAY, SHELL, SHELL_HI, EXAMS, DAYS } from './qotd-data.mjs';
import { questionTextHtml } from './question-view.mjs';

const SITE = 'https://www.playtakkar.in';
const IST_MS = 5.5 * 3600 * 1000;
const DAY_MS = 86400000;
const ALL_DAYS = Object.keys(DAYS);
const BASE = { en: '/question-of-the-day', hi: '/hi/question-of-the-day' };
const other = (lang) => (lang === 'hi' ? 'en' : 'hi');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const istDay = (ms) => new Date(ms + IST_MS).toISOString().slice(0, 10);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const longDate = (day, lang = 'en') => new Date(`${day}T00:00:00Z`).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthOf = (day, lang) => new Date(`${day}T00:00:00Z`).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
/** A day's address in a language: the main address for today, a dated one otherwise. */
const dayUrl = (day, today, lang) => `${SITE}${BASE[lang]}${day === today ? '' : `/${day}`}`;

/** The question for a day. Past the generated range, the days start again from the first one. */
function questionFor(day) {
  if (DAYS[day]) return DAYS[day];
  const i = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${FIRST_DAY}T00:00:00Z`)) / DAY_MS);
  return DAYS[ALL_DAYS[((i % ALL_DAYS.length) + ALL_DAYS.length) % ALL_DAYS.length]];
}
/** The question as shown in a language (the Hindi has the same options in the same order). */
const shown = (q, lang) => (lang === 'hi' && q.hi ? { ...q, ...q.hi } : q);

function page({ lang, title, desc, url, altUrl, ogTitle, lds, main }) {
  const ld = lds.map((o) => `<script type="application/ld+json">\n${JSON.stringify(o).replace(/</g, '\\u003c')}\n</script>`).join('\n');
  // Function replacements, so "$" in the text is never read as a pattern.
  return (lang === 'hi' ? SHELL_HI : SHELL)
    .replace('__TITLE__', () => esc(title))
    .replace(/__DESC__/g, () => esc(desc))
    .replace(/__URL__/g, () => url)
    .replace(/__ALTURL__/g, () => altUrl)
    .replace('__OGTITLE__', () => esc(ogTitle))
    .replace('__LD__', () => ld)
    .replace('__MAIN__', () => main);
}

// The words on the page, in each language.
const W = {
  en: {
    pill: 'Question of the day', today: 'Question of the day', todayHead: 'Today’s question', head: 'Question', forDay: (d) => `Question for ${d}`,
    section: (q, exam) => (q.topic === 'quant' ? exam.quant || 'Quant' : 'Reasoning'),
    title: (isToday, when, exam, label) => `${isToday ? 'Question of the day' : `Question for ${when}`}: ${exam.short} ${label.toLowerCase()} · Takkar`,
    desc: (when, exam, label) => `An ${exam.short} ${label.toLowerCase()} question for ${when}, with the answer and step-by-step solution. A new question every day on Takkar.`,
    lead: (isToday, exam) => `${isToday ? 'A new question every day at midnight, India time, in a different exam’s style. ' : ''}Give yourself ${exam.seconds} seconds, as in ${esc(exam.short)}, then open the steps.`,
    question: 'The question', show: 'Show the answer and steps', answer: 'Answer', play: 'Play today’s duel',
    more: (label) => `More ${esc(label.toLowerCase())} questions`, guide: (exam) => `${esc(exam.short)} exam guide`,
    earlier: 'Earlier questions', morePractice: 'More practice', all: 'All earlier questions', todays: 'Today’s question', practice: 'Practice questions', guides: 'Exam guides',
    switchTo: '<a href="__ALT__" lang="hi" hreflang="hi">यह प्रश्न हिंदी में</a>',
    crumb: 'Question of the day',
    archive: {
      title: 'Question of the day archive: solved exam questions · Takkar',
      desc: 'Every Takkar question of the day so far, with answers and step-by-step solutions: quant and reasoning in SSC, bank and railway exam patterns.',
      og: 'Question of the day: the archive', pill: 'Question of the day · Archive', head: 'Every question of the day',
      lead: 'One quant or reasoning question a day in an SSC, bank or railway exam pattern, each with its answer and steps.',
      todayLink: (link) => `${link} is on its own page.`,
      none: 'The first questions will appear here tomorrow.', byTopic: 'Practice questions by topic', crumb: 'Archive',
      switchTo: '<a href="/hi/question-of-the-day/archive" lang="hi" hreflang="hi">हिंदी में</a>',
    },
    practicePath: '/practice', guidePath: '',
  },
  hi: {
    pill: 'आज का प्रश्न', today: 'आज का प्रश्न', todayHead: 'आज का प्रश्न', head: 'प्रश्न', forDay: (d) => `${d} का प्रश्न`,
    section: (q) => (q.topic === 'quant' ? 'गणित' : 'तर्कशक्ति'),
    title: (isToday, when, exam, label) => `${isToday ? 'आज का प्रश्न' : `${when} का प्रश्न`}: ${exam.short} ${label} · Takkar`,
    desc: (when, exam, label) => `${when} के लिए ${exam.short} ${label} का प्रश्न हिंदी में, उत्तर और चरण-दर-चरण हल के साथ। Takkar पर हर दिन एक नया प्रश्न।`,
    lead: (isToday, exam) => `${isToday ? 'हर दिन आधी रात (भारतीय समय) को एक नया प्रश्न, हर बार किसी अलग परीक्षा की शैली में। ' : ''}${esc(exam.short)} की तरह ${exam.seconds} सेकंड में हल करके देखें, फिर हल खोलें।`,
    question: 'प्रश्न', show: 'उत्तर और हल देखें', answer: 'उत्तर', play: 'आज का मुकाबला खेलें',
    more: (label) => `${esc(label)} के और प्रश्न`, guide: (exam) => `${esc(exam.short)} परीक्षा गाइड`,
    earlier: 'पिछले प्रश्न', morePractice: 'और अभ्यास', all: 'पिछले सभी प्रश्न', todays: 'आज का प्रश्न', practice: 'अभ्यास प्रश्न', guides: 'परीक्षा गाइड',
    switchTo: '<a href="__ALT__" lang="en" hreflang="en">Read in English</a>',
    crumb: 'आज का प्रश्न',
    archive: {
      title: 'आज का प्रश्न: पिछले सभी प्रश्न, हल सहित · Takkar',
      desc: 'Takkar के अब तक के सभी दैनिक प्रश्न हिंदी में, उत्तर और चरण-दर-चरण हल के साथ: SSC, बैंक और रेलवे परीक्षाओं के पैटर्न में गणित और तर्कशक्ति।',
      og: 'आज का प्रश्न: पिछले सभी प्रश्न', pill: 'आज का प्रश्न · संग्रह', head: 'पिछले सभी दैनिक प्रश्न',
      lead: 'हर दिन SSC, बैंक या रेलवे परीक्षा के पैटर्न में गणित या तर्कशक्ति का एक प्रश्न, उत्तर और हल के साथ।',
      todayLink: (link) => `${link} अलग पेज पर है।`,
      none: 'पहले प्रश्न कल से यहाँ दिखेंगे।', byTopic: 'टॉपिक के अनुसार अभ्यास प्रश्न', crumb: 'संग्रह',
      switchTo: '<a href="/question-of-the-day/archive" lang="en" hreflang="en">Read in English</a>',
    },
    practicePath: '/hi/practice', guidePath: '/hi',
  },
};

function render(day, today, lang = 'en') {
  const w = W[lang];
  const q = shown(questionFor(day), lang);
  const exam = EXAMS[q.exam];
  const isToday = day === today;
  const url = dayUrl(day, today, lang);
  const altUrl = dayUrl(day, today, other(lang));
  const when = longDate(day, lang);
  const earlier = [];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(day, -i);
    if (d < FIRST_DAY) break;
    const e = shown(questionFor(d), lang);
    earlier.push(`<li><a href="${BASE[lang]}/${d}">${esc(longDate(d, lang))}</a><span>${esc(EXAMS[e.exam].short)} · ${esc(e.label)}</span></li>`);
  }
  const letters = 'ABCD';
  const main = `
    <section class="section wrap guide-hero qotd-hero" aria-labelledby="q-title">
      <p class="pill">${w.pill} · ${esc(exam.short)} · ${esc(w.section(q, exam))}</p>
      <h1 class="section__title guide-hero__title" id="q-title">${isToday ? w.todayHead : w.head}: ${esc(when)}</h1>
      <p class="section__lead">${w.lead(isToday, exam)}</p>
      <p class="tutors-note">${w.switchTo.replace('__ALT__', altUrl.replace(SITE, ''))}</p>
    </section>

    <section class="section wrap" aria-label="${w.question}">
      <article class="sample panel qotd">
        <p class="sample__topic">${esc(exam.short)} · ${esc(q.label)}</p>
        ${questionTextHtml(q, esc)}
        <ol class="sample__options" type="A">
          ${q.options.map((o) => `<li>${esc(o)}</li>`).join('\n          ')}
        </ol>
        <details class="sample__answer">
          <summary>${w.show}</summary>
          <p><strong>${w.answer}: ${letters[q.answerIndex]}. ${esc(q.answerText)}</strong></p>
          <ol class="sample__steps">${q.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        </details>
      </article>
      <div class="hero__actions">
        <a class="btn btn--saffron" href="/play/?exam=${q.exam}${lang === 'hi' ? '&amp;lang=hi' : ''}">${w.play}</a>
        ${q.practice ? `<a class="btn btn--ghost" href="${w.practicePath}/${q.practice}">${w.more(q.label)}</a>` : `<a class="btn btn--ghost" href="${w.guidePath}/${q.exam}">${w.guide(exam)}</a>`}
      </div>
    </section>

    <section class="section wrap" aria-labelledby="q-earlier">
      ${earlier.length ? `<h2 class="section__title" id="q-earlier">${w.earlier}</h2>
      <ul class="qotd-list">${earlier.join('')}</ul>
      <p class="guide-others"><a href="${BASE[lang]}/archive">${w.all}</a></p>` : `<h2 class="section__title" id="q-earlier">${w.morePractice}</h2>`}
      <p class="guide-others">${isToday ? '' : `<a href="${BASE[lang]}">${w.todays}</a> · `}<a href="${w.practicePath}">${w.practice}</a> · ${w.guides}: ${Object.entries(EXAMS).map(([id, e]) => `<a href="${w.guidePath}/${id}">${esc(e.short)}</a>`).join(' · ')}</p>
    </section>`;
  const crumbs = [{ '@type': 'ListItem', position: 1, name: 'Takkar', item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: w.crumb, item: `${SITE}${BASE[lang]}` }];
  if (!isToday) crumbs.push({ '@type': 'ListItem', position: 3, name: when, item: url });
  return page({
    lang, url, altUrl, main,
    title: w.title(isToday, when, exam, q.label),
    desc: w.desc(when, exam, q.label),
    ogTitle: `${isToday ? w.today : when}: ${exam.short} ${lang === 'hi' ? q.label : q.label.toLowerCase()}`,
    lds: [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs }],
  });
}

/** Every day so far, newest first, a section a month. */
function renderArchive(today, lang = 'en') {
  const w = W[lang];
  const a = w.archive;
  const url = `${SITE}${BASE[lang]}/archive`;
  const months = new Map();
  for (let d = addDays(today, -1); d >= FIRST_DAY; d = addDays(d, -1)) {
    const month = monthOf(d, lang);
    const q = shown(questionFor(d), lang);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(`<li><a href="${BASE[lang]}/${d}">${esc(longDate(d, lang))}</a><span>${esc(EXAMS[q.exam].short)} · ${esc(q.label)}</span></li>`);
  }
  let n = 0;
  const sections = [...months].map(([month, items]) => `
    <section class="section wrap" aria-labelledby="m-${++n}">
      <h2 class="section__title" id="m-${n}">${esc(month)}</h2>
      <ul class="qotd-list">${items.join('')}</ul>
    </section>`).join('');
  const main = `
    <section class="section wrap guide-hero qotd-hero" aria-labelledby="a-title">
      <p class="pill">${a.pill}</p>
      <h1 class="section__title guide-hero__title" id="a-title">${a.head}</h1>
      <p class="section__lead">${a.lead} ${a.todayLink(`<a href="${BASE[lang]}">${w.todays}</a>`)}</p>
      <p class="tutors-note">${a.switchTo}</p>
    </section>${sections || `
    <section class="section wrap"><p class="guide-others">${a.none}</p></section>`}
    <section class="section wrap" aria-label="${w.morePractice}">
      <p class="guide-others"><a href="${w.practicePath}">${a.byTopic}</a> · ${w.guides}: ${Object.entries(EXAMS).map(([id, e]) => `<a href="${w.guidePath}/${id}">${esc(e.short)}</a>`).join(' · ')}</p>
    </section>`;
  return page({
    lang, url, altUrl: `${SITE}${BASE[other(lang)]}/archive`, main,
    title: a.title, desc: a.desc, ogTitle: a.og,
    lds: [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Takkar', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: w.crumb, item: `${SITE}${BASE[lang]}` },
      { '@type': 'ListItem', position: 3, name: a.crumb, item: url },
    ] }],
  });
}

/** Seconds until the next midnight in India, so cached copies change with the question. */
const untilMidnight = (today, nowMs) => Math.max(60, Math.floor((Date.parse(`${addDays(today, 1)}T00:00:00Z`) - IST_MS - nowMs) / 1000));

/** /sitemap-qotd.xml: both archives and every past day in both languages, so they stay findable after they leave the 7-day list. */
export function qotdSitemap(nowMs = Date.now()) {
  const today = istDay(nowMs);
  const urls = [];
  for (const lang of ['en', 'hi']) {
    urls.push(`  <url><loc>${SITE}${BASE[lang]}/archive</loc><lastmod>${today}</lastmod></url>`);
    for (let d = addDays(today, -1); d >= FIRST_DAY; d = addDays(d, -1)) urls.push(`  <url><loc>${SITE}${BASE[lang]}/${d}</loc><lastmod>${d}</lastmod></url>`);
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': `public, max-age=3600, s-maxage=${untilMidnight(today, nowMs)}` } });
}

const html = (body, status, cache) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache } });

/**
 * The response for /question-of-the-day (dayParam empty), /question-of-the-day/YYYY-MM-DD or
 * /question-of-the-day/archive, and the same under /hi/ with lang 'hi'.
 * Today's dated address sends people to the main one; days that haven't come yet don't exist.
 */
export function qotdResponse(dayParam, nowMs = Date.now(), lang = 'en') {
  if (lang !== 'hi') lang = 'en';
  const today = istDay(nowMs);
  if (!dayParam) {
    // Cached by the CDN until the next midnight in India, so everyone gets the new question then.
    return html(render(today, today, lang), 200, `public, max-age=300, s-maxage=${untilMidnight(today, nowMs)}`);
  }
  if (dayParam === 'archive') return html(renderArchive(today, lang), 200, `public, max-age=300, s-maxage=${untilMidnight(today, nowMs)}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayParam) || Number.isNaN(Date.parse(`${dayParam}T00:00:00Z`)) || addDays(dayParam, 0) !== dayParam) {
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
  }
  if (dayParam === today) return new Response(null, { status: 302, headers: { Location: BASE[lang], 'Cache-Control': 'public, max-age=60' } });
  if (dayParam > today || dayParam < FIRST_DAY) {
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=600' } });
  }
  return html(render(dayParam, today, lang), 200, 'public, max-age=86400, s-maxage=604800');
}
