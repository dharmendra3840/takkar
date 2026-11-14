// Live tests in tutor leagues (Live tests (beta) tab, LIVE-01 to LIVE-19): the tests on a league page,
// the tutor's schedule form and class report, and the student's test, submit summary and report.
// The server keeps the paper, the answer key and the clock; these screens only show what it sends.
import { questionHtml } from '../qview.js?v=a9e7f3de4a';
import { esc, blobs, icon, num } from '../ui.js?v=a9e7f3de4a';
import { EXAMS, quantName, markingLabel } from '../exams.js?v=a9e7f3de4a';
import { QUANT } from '../engine/quant.js?v=a9e7f3de4a';
import { REASONING } from '../engine/reasoning.js?v=a9e7f3de4a';
import { LABEL_HI } from '../engine/index.js?v=a9e7f3de4a';
import { LIVE, DIFFICULTIES, clock } from '../livetest-rules.js?v=a9e7f3de4a';
import { inLang, langSwitch } from '../lang.js?v=a9e7f3de4a';
import { recText, highlightText, LEVEL_TEXT } from '../livetest-insights.js?v=a9e7f3de4a';

const KEYS = ['A', 'B', 'C', 'D'];
const back = (action = 'back', label = 'Back') => `<div class="row"><button class="icon-btn glass" type="button" data-action="${action}" aria-label="${label}">${icon('back')}</button></div>`;
export const when = (iso) => new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const timeOf = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
/** "in 2 h 5 min", "in 12 min", "in 40 s". */
export function untilText(ms) {
  if (ms <= 0) return 'now';
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `in ${s} s`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `in ${h} h${m % 60 ? ` ${m % 60} min` : ''}`;
  return `in ${Math.round(h / 24)} days`;
}
const topicOf = (label) => (QUANT.some((t) => t.label === label) ? 'quant' : 'reasoning');
const topicName = (label, lang) => (lang === 'hi' ? LABEL_HI[label] || label : label);

// ---------- the tests on a league page ----------

/** The test cards for the tutor (role owner) or a student (role member). */
// remind: 'off' (Android can remind but isn't set to), 'on', or null (no reminders on this device: the web app, older APKs).
export function testsSection({ lt, role, nowMs, canSchedule, liveOn, remind = null }) {
  // A student's progress across tests opens once one of their tests has results.
  // The server says so (however old the tests); older servers don't, so the list on screen decides.
  const marked = lt.hasResults ?? (lt.list || []).some((t) => (role === 'member' ? t.state === 'released' && t.you === 'done' : t.state === 'ended' || t.state === 'released'));
  const hasResults = role === 'member' && marked;
  const head = `<div class="row row--between mt-24" style="align-items:center"><h2 style="font-size:18px">Live tests</h2>
    ${role === 'owner' && canSchedule ? '<button class="btn btn--sm btn--saffron" type="button" data-action="lt-new">Schedule a test</button>' : ''}
    ${hasResults ? '<button class="btn btn--sm btn--line" type="button" data-action="lt-progress">My progress</button>' : ''}</div>
    ${role === 'owner' && marked ? '<button class="btn btn--sm btn--line mt-8" type="button" data-action="lt-insights">Class insights across your tests</button>' : ''}`;
  if (!liveOn) return `${head}<p class="small muted mt-8">Live tests are paused for a short while.</p>`;
  if (lt.listError) return `${head}<p class="notice mt-8">${esc(lt.listError)} <button class="link-btn" type="button" data-action="lt-refresh">Try again</button></p>`;
  if (!lt.list) return `${head}<p class="small muted mt-8">Loading tests…</p>`;
  const tests = lt.list;
  const empty = role === 'owner'
    ? `<p class="small muted mt-8">No tests yet. Schedule one: Takkar builds the paper from its question bank in this league’s exam pattern, students start within a short window, and you release results when you’re ready.</p>`
    : '<p class="small muted mt-8">No tests yet. Your tutor will schedule timed tests here; everyone starts within a few minutes of the start time and gets the full time.</p>';
  return `${head}
    ${lt.paused ? '<p class="notice mt-8">This league is paused for now, so its tests are on hold.</p>' : ''}
    ${tests.length ? `<div class="lt-list mt-8">${tests.map((t) => testCard(t, role, nowMs, remind)).join('')}</div>` : empty}`;
}

const STATE_TAG = { scheduled: ['Scheduled', ''], open: ['Open now', 'tag--live'], running: ['In progress', 'tag--live'], ended: ['Closed', ''], released: ['Results out', 'tag--cobalt'], cancelled: ['Cancelled', 'tag--muted'] };

function testCard(t, role, nowMs, remind) {
  const [tag, cls] = STATE_TAG[t.state] || ['', ''];
  const meta = `${t.count} questions · ${t.durationMinutes} min · ${DIFFICULTIES[t.difficulty] || ''}`;
  const startMs = Date.parse(t.startsAt);
  const entryEnds = new Date(startMs + t.lateMinutes * 60000).toISOString();
  let line = ''; let actions = '';
  if (role === 'owner') {
    if (t.state === 'scheduled') {
      line = `Starts ${esc(when(t.startsAt))} · <span data-countdown="${esc(t.startsAt)}">${untilText(startMs - nowMs)}</span>`;
      actions = `<button class="link-btn small" type="button" data-action="lt-cancel-ask" data-id="${esc(t.id)}">Cancel the test</button>`;
    } else if (t.state === 'open' || t.state === 'running') {
      line = `Live now: ${t.started} started, ${t.submitted} submitted · closes ${esc(timeOf(t.closesAt))}`;
      actions = '<button class="link-btn small" type="button" data-action="lt-refresh">Refresh</button>';
    } else if (t.state === 'ended' || t.state === 'released') {
      line = t.state === 'ended' ? `Closed ${esc(when(t.closesAt))} · ${t.started} sat · results not released yet` : `${t.started} sat · results released`;
      actions = `<button class="btn btn--sm btn--cobalt" type="button" data-action="lt-class" data-id="${esc(t.id)}">Class report</button>`;
    } else line = `Was due ${esc(when(t.startsAt))}`;
  } else {
    if (t.state === 'cancelled') line = 'Your tutor cancelled this test.';
    else if (t.state === 'scheduled') {
      line = `Starts ${esc(when(t.startsAt))} · <span data-countdown="${esc(t.startsAt)}">${untilText(startMs - nowMs)}</span> · entry open for ${t.lateMinutes} min`;
      actions = `${remind === 'off' ? '<button class="link-btn small" type="button" data-action="lt-remind">Remind me</button>' : remind === 'on' ? '<span class="small muted">Reminder on</span>' : ''}
        <button class="link-btn small" type="button" data-action="lt-calendar" data-id="${esc(t.id)}">Add to calendar</button>`;
    } else if (t.you === 'sitting') {
      line = 'You’re in the middle of this test. The clock is running.';
      actions = `<button class="btn btn--sm btn--saffron" type="button" data-action="lt-start" data-id="${esc(t.id)}">Resume the test</button>`;
    } else if (t.state === 'open' && t.you === 'none') {
      line = `Open now · entry closes at ${esc(timeOf(entryEnds))}`;
      actions = `<button class="btn btn--sm btn--saffron" type="button" data-action="lt-start-ask" data-id="${esc(t.id)}">Start the test</button>`;
    } else if (t.you === 'done') {
      line = t.state === 'released' ? 'Results are out.' : 'Submitted. Your tutor will release results.';
      if (t.state === 'released') actions = `<button class="btn btn--sm btn--cobalt" type="button" data-action="lt-report" data-id="${esc(t.id)}">See your report</button>`;
    } else line = t.state === 'running' ? `Entry closed at ${esc(timeOf(entryEnds))}.` : 'You missed this test.';
  }
  return `
      <div class="lt-card glass">
        <div class="row row--between" style="gap:8px;align-items:flex-start">
          <div class="grow" style="min-width:0"><div class="lt-card__title">${esc(t.title)}</div><div class="small muted">${esc(meta)}</div></div>
          <span class="tag ${cls}">${tag}</span>
        </div>
        <p class="small mt-8">${line}</p>
        ${actions ? `<div class="row mt-8" style="gap:12px;flex-wrap:wrap;align-items:center">${actions}</div>` : ''}
      </div>`;
}

// ---------- the tutor schedules a test (LIVE-01) ----------

/** The schedule form's summary line: when students can start and when the test closes. '' until the date and time are set. */
export function scheduleWindowText(form) {
  const startMs = Date.parse(`${form.date}T${form.time}`);
  if (!Number.isFinite(startMs)) return '';
  return `Students can start from ${timeOf(new Date(startMs).toISOString())} to ${timeOf(new Date(startMs + form.late * 60000).toISOString())}. Each gets ${form.minutes || '…'} minutes; the test closes for everyone at ${timeOf(new Date(startMs + (form.late + (Number(form.minutes) || 0)) * 60000).toISOString())}.`;
}

export function scheduleScreen({ form, error, busy, exam }) {
  const e = EXAMS[exam];
  const pick = (name, value, label, on) => `<button type="button" data-action="${name}" data-value="${value}" aria-pressed="${on}">${label}</button>`;
  const chip = (t) => `<button type="button" class="chip-toggle ${form.topics.includes(t) ? 'is-on' : ''}" data-action="lt-topic" data-label="${esc(t)}" aria-pressed="${form.topics.includes(t)}">${esc(t)}</button>`;
  const labels = (list) => [...new Set(list.map((t) => t.label))];
  const window = scheduleWindowText(form);
  return `
  <div class="screen screen--lobby">${blobs()}
    <div class="screen__body screen__body--full">${back()}
      <span class="eyebrow mt-16">${esc(e.short)} pattern · ${esc(markingLabel(e))}</span>
      <h1 class="title mt-8">Schedule a live test</h1>
      <p class="muted mt-8">Takkar builds the paper from its question bank in your league’s exam pattern. Students who are in the league before the start can sit it, once.</p>
      <form class="glass mt-20 lt-form" data-form="lt-schedule" novalidate>
        <div class="field"><label for="lt-title">Title</label><input id="lt-title" type="text" maxlength="${LIVE.titleMax}" value="${esc(form.title)}" data-input="lt-title" placeholder="Mock Test 1"></div>
        <div class="lt-form__row">
          <div class="field"><label for="lt-date">Date</label><input id="lt-date" type="date" value="${esc(form.date)}" data-input="lt-date"></div>
          <div class="field"><label for="lt-time">Start time</label><input id="lt-time" type="time" value="${esc(form.time)}" data-input="lt-time"></div>
        </div>
        <div class="lt-form__row">
          <div class="field"><label for="lt-minutes">Duration (minutes)</label><input id="lt-minutes" type="number" inputmode="numeric" min="${LIVE.minutesMin}" max="${LIVE.minutesMax}" value="${esc(form.minutes)}" data-input="lt-minutes"></div>
          <div class="field"><label for="lt-count">Questions</label><input id="lt-count" type="number" inputmode="numeric" min="${LIVE.questionsMin}" max="${LIVE.questionsMax}" value="${esc(form.count)}" data-input="lt-count"></div>
        </div>
      </form>
      <h2 class="lt-form__label mt-20">Late entry</h2>
      <div class="segmented segmented--light mt-8" role="group" aria-label="Late entry">${LIVE.lateChoices.map((m) => pick('lt-late', m, `${m} minutes`, form.late === m)).join('')}</div>
      <h2 class="lt-form__label mt-20">Level</h2>
      <div class="segmented segmented--light mt-8" role="group" aria-label="Level">${Object.entries(DIFFICULTIES).map(([k, v]) => pick('lt-level', k, v, form.difficulty === k)).join('')}</div>
      <h2 class="lt-form__label mt-20">Topics</h2>
      <div class="segmented segmented--light mt-8" role="group" aria-label="Topics">${pick('lt-topics-mode', 'all', 'All topics', !form.pick)}${pick('lt-topics-mode', 'pick', 'Choose topics', form.pick)}</div>
      ${form.pick ? `
      <p class="small muted mt-8">${esc(quantName(e))}</p><div class="chip-row mt-4">${labels(QUANT).map(chip).join('')}</div>
      <p class="small muted mt-12">Reasoning</p><div class="chip-row mt-4">${labels(REASONING).map(chip).join('')}</div>`
    : `<p class="small muted mt-8">${esc(quantName(e))} and Reasoning, picked by how often ${esc(e.short)} asks each topic.</p>`}
      <p class="notice mt-20" id="lt-window" ${window ? '' : 'hidden'}>${esc(window)}</p>
      ${error ? `<p class="notice mt-12" role="alert">${esc(error)}</p>` : ''}
      <div class="mt-auto" style="padding-top:24px">
        <button class="btn btn--saffron" type="button" data-action="lt-schedule" ${busy ? 'disabled' : ''}>${busy ? 'Scheduling…' : 'Schedule the test'}</button>
        <p class="small muted center mt-8">Beta: ${LIVE.questionsMin}–${LIVE.questionsMax} questions, ${LIVE.minutesMin}–${LIVE.minutesMax} minutes, at least ${LIVE.leadMinMinutes} minutes ahead.</p>
      </div>
    </div>
  </div>`;
}

// ---------- the student's test (LIVE-04 to LIVE-08) ----------

/** The palette's state for one question. */
function cellState(a, seen) {
  if (a && a.c !== null && a.c !== undefined) return a.r ? 'answered-marked' : 'answered';
  if (a?.r) return 'marked';
  return seen ? 'seen' : '';
}

export function testScreen({ run, timeLeft, lang }) {
  const pos = run.pos;
  const sec = run.sections.find((s) => pos >= s.from && pos < s.to) || run.sections[0];
  const hasHi = !!run.questions[pos].hi;
  const q = inLang(run.questions[pos], lang);
  const hi = q.isHi ? ' lang="hi"' : '';
  const a = run.answers[pos];
  const choice = a && a.c !== null && a.c !== undefined ? a.c : null;
  const saving = { saved: 'Saved', saving: 'Saving…', offline: 'Offline: answers will save when you’re back', waiting: 'Not saved yet' }[run.saveState] || '';
  const cell = (i) => {
    const st = cellState(run.answers[i], run.seen[i]);
    const said = { 'answered-marked': 'answered, marked for review', answered: 'answered', marked: 'marked for review', seen: 'not answered' }[st] || 'not seen';
    const flagged = run.answers[i]?.f;
    return `<button type="button" class="pal ${st ? `pal--${st}` : ''} ${flagged ? 'pal--flag' : ''} ${i === pos ? 'pal--now' : ''}" data-action="lt-go" data-index="${i}" aria-label="Question ${i - sec.from + 1}, ${said}${flagged ? ', flagged' : ''}" ${i === pos ? 'aria-current="true"' : ''}>${i - sec.from + 1}</button>`;
  };
  return `
  <div class="screen screen--arena">
    ${blobs('arena')}
    <div class="screen__body screen__body--full mock-body" style="gap:12px">
      <div class="topbar glass-dark">
        <button class="icon-btn" type="button" data-action="lt-submit-ask" aria-label="Submit the test" style="color:#fff">${icon('close')}</button>
        <span class="lt-topbar__title"><span>${esc(run.title)}</span><span class="small" id="lt-save" aria-live="polite">${esc(saving)}</span></span>
        <span class="timer ${timeLeft <= 60000 ? 'timer--low' : ''}" id="lt-timer" role="timer" aria-live="off">${clock(timeLeft)}</span>
      </div>
      <div class="mock-tabs">${run.sections.map((s) => `<button type="button" class="mock-tab ${s === sec ? 'is-on' : ''}" data-action="lt-go" data-index="${s.from}">${esc(s.name)} ${s.to - s.from}</button>`).join('')}</div>
      <div class="qpanel reading">
        <div class="row row--between" style="gap:10px;align-items:center">
          <div class="small" style="font-weight:600;color:#D7DBF5">${esc(sec.name)} · question ${pos - sec.from + 1} of ${sec.to - sec.from} · <span${hi}>${esc(q.label)}</span></div>
          ${hasHi ? langSwitch(lang) : ''}
        </div>
        ${questionHtml(q, hi)}
        <div class="options" role="radiogroup" aria-labelledby="question-text">
          ${q.options.map((text, i) => `<button class="option ${choice === i ? 'option--chosen' : ''}" type="button" role="radio" aria-checked="${choice === i}" data-action="lt-choose" data-index="${i}">
            <span class="option__key" aria-hidden="true">${KEYS[i]}</span><span class="option__text"${hi}>${esc(text)}</span></button>`).join('')}
        </div>
        <div class="lt-tools mt-12">
          <button class="link-btn" type="button" data-action="lt-mark" style="color:#FFB27A" aria-pressed="${!!a?.r}">${a?.r ? 'Unmark review' : 'Mark for review'}</button>
          <button class="link-btn" type="button" data-action="lt-flag" style="color:#D7DBF5" aria-pressed="${!!a?.f}" aria-label="${a?.f ? 'Remove the flag' : 'Flag a problem with this question'}">${a?.f ? 'Unflag' : 'Flag'}</button>
          <button class="link-btn" type="button" data-action="lt-clear" style="color:#D7DBF5" ${choice === null ? 'disabled' : ''}>Clear</button>
        </div>
        <div class="btn-row mt-12">
          <button class="btn btn--ghost-dark" type="button" data-action="lt-prev" ${pos === 0 ? 'disabled' : ''}>Previous</button>
          <button class="btn btn--saffron" type="button" data-action="lt-next">${pos === run.questions.length - 1 ? 'Review and submit' : 'Save and next'}</button>
        </div>
      </div>
      <div class="palette glass-dark">
        <div class="palette__grid">${Array.from({ length: sec.to - sec.from }, (_, k) => cell(sec.from + k)).join('')}</div>
        <div class="palette__key small"><span><i class="pal pal--answered"></i>Answered</span><span><i class="pal pal--marked"></i>Marked</span><span><i class="pal pal--seen"></i>Not answered</span><span><i class="pal"></i>Not seen</span><span><i class="pal pal--flag"></i>Flagged</span></div>
        <button class="btn btn--ghost-dark mt-12" type="button" data-action="lt-submit-ask">Submit the test</button>
      </div>
    </div>
  </div>`;
}

/** Counts of what the student did: attempted, skipped, flagged, marked for review (LIVE-10). */
export function runCounts(run) {
  const answered = run.answers.filter((a) => a && a.c !== null && a.c !== undefined).length;
  return { attempted: answered, skipped: run.answers.length - answered, flagged: run.answers.filter((a) => a?.f).length, review: run.answers.filter((a) => a?.r).length };
}
const countTiles = (c) => `
      <div class="stats mt-12">
        <div class="stat tint"><div class="stat__label">Attempted</div><div class="stat__value">${c.attempted}</div></div>
        <div class="stat tint"><div class="stat__label">Skipped</div><div class="stat__value">${c.skipped}</div></div>
        <div class="stat tint"><div class="stat__label">Marked</div><div class="stat__value">${c.review}</div></div>
      </div>
      ${c.flagged ? `<p class="small muted mt-8">You flagged ${c.flagged} question${c.flagged === 1 ? '' : 's'} for your tutor.</p>` : ''}`;

export function submitSheet({ run, timeLeft }) {
  return `
  <div class="scrim" data-action="close-sheet">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="lts-title" data-stop>
      <div class="sheet__handle"></div>
      <h2 class="sheet__title" id="lts-title">Submit the test?</h2>
      ${countTiles(runCounts(run))}
      <p class="muted mt-12">${clock(timeLeft)} left. You can’t change answers after submitting, and there’s one attempt only.</p>
      <div class="btn-row mt-20">
        <button class="btn btn--line" type="button" data-action="close-sheet">Keep going</button>
        <button class="btn btn--cobalt" type="button" data-action="lt-submit">Submit</button>
      </div>
    </div>
  </div>`;
}

export function startSheet({ test }) {
  const e = EXAMS[test.exam];
  return `
  <div class="scrim" data-action="close-sheet">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ltst-title" data-stop>
      <div class="sheet__handle"></div>
      <h2 class="sheet__title" id="ltst-title">${esc(test.title)}</h2>
      <ul class="lt-rules mt-12">
        <li>${test.count} questions, ${test.durationMinutes} minutes from when you start.</li>
        <li>${esc(e.short)} marking: ${esc(markingLabel(e))}. Skipping costs nothing.</li>
        <li>The clock keeps running if you close the app; come back and resume.</li>
        <li>One attempt only. Leaving the app is counted for your tutor.</li>
        <li>You’ll see your score when your tutor releases results.</li>
      </ul>
      <div class="btn-row mt-20">
        <button class="btn btn--line" type="button" data-action="close-sheet">Not now</button>
        <button class="btn btn--saffron" type="button" data-action="lt-start" data-id="${esc(test.id)}">Start now</button>
      </div>
    </div>
  </div>`;
}

/** After submitting (or when the time ran out): counts only, no score (LIVE-10). */
export function doneScreen({ title, counts, timedOut, offline }) {
  return `
  <div class="screen screen--lobby">${blobs()}
    <div class="screen__body screen__body--full">${back('lt-back-league', 'Back to the league')}
      <span class="eyebrow mt-16">${esc(title)}</span>
      <h1 class="title mt-8">${timedOut ? 'Time’s up. Your test is in.' : 'Submitted.'}</h1>
      <p class="muted mt-8">Your tutor checks the class first, then releases results. You’ll see your score, rank and topic report here.</p>
      ${offline ? '<p class="notice mt-12">You were offline at the end. The answers saved before the end count.</p>' : ''}
      ${countTiles(counts)}
      <div class="mt-auto" style="padding-top:24px"><button class="btn btn--saffron" type="button" data-action="lt-back-league">Back to the league</button></div>
    </div>
  </div>`;
}

// ---------- the student's report, after release ----------

const hiAttr = (lang) => (lang === 'hi' ? ' lang="hi"' : '');

/** The recommendations as a list; the practice buttons are for the student, not the tutor reading along. */
function recList(recs, exam, lang, withActions) {
  return `<ol class="lt-recs mt-8">${recs.map((r) => recText(r, exam, lang)).filter(Boolean).map((t) => `
    <li class="lt-rec"><p class="lt-rec__title"${hiAttr(lang)}>${esc(t.title)}</p><p class="small muted"${hiAttr(lang)}>${esc(t.body)}</p>
      ${withActions && t.action?.practice ? `<button class="btn btn--sm btn--cobalt mt-8" type="button" data-action="practice-topic" data-label="${esc(t.action.practice)}" data-topic="${t.action.topic}"${hiAttr(lang)}>${esc(t.action.label)}</button>` : ''}
      ${withActions && t.action?.go ? `<button class="btn btn--sm btn--line mt-8" type="button" data-action="go" data-to="${t.action.go}"${hiAttr(lang)}>${esc(t.action.label)}</button>` : ''}</li>`).join('')}</ol>`;
}

// student: { realName, nickname } when the tutor is reading a student's report; stacked: Back returns to the screen before.
export function reportScreen({ test, report, lang, student = null, stacked = false }) {
  const pct = (x) => `${x}%`;
  const weak = report.weakest;
  const ins = report.insights || null; // absent from servers before reports and recommendations
  const tutor = !!student;
  const who = student ? student.realName || student.nickname : '';
  const good = ins ? highlightText(ins.good, lang) : '';
  const f = ins?.facts;
  const fact = (label, value, sub) => `<div class="lt-fact tint"><div class="stat__label">${label}</div><div class="lt-fact__value">${value}</div><div class="small muted">${sub}</div></div>`;
  return `
  <div class="screen screen--lobby">${blobs()}
    <div class="screen__body">${stacked ? back() : back('lt-back-league', 'Back to the league')}
      <span class="eyebrow mt-16">${tutor ? `${esc(who)} · ` : ''}${esc(test.title)} · ${esc(when(test.startsAt))}</span>
      <h1 class="verdict mt-8">Rank ${report.rank} of ${report.of}</h1>
      <p class="mt-8" style="font-size:20px;font-weight:600"><span style="color:#2A3BE8">${num(report.score)}</span> <span class="muted" style="font-weight:400">out of ${num(report.maxScore)} · batch average ${num(report.average)}</span></p>
      ${good ? `<p class="lt-good mt-12"${hiAttr(lang)}>${esc(good)}</p>` : ''}
      <div class="stats mt-16">
        <div class="stat tint"><div class="stat__label">Correct</div><div class="stat__value" style="color:#0B6B50">${report.right}</div></div>
        <div class="stat tint"><div class="stat__label">Wrong</div><div class="stat__value" style="color:#B3261E">${report.wrong}</div></div>
        <div class="stat tint"><div class="stat__label">Skipped</div><div class="stat__value">${report.skipped}</div></div>
      </div>
      ${f ? `<div class="lt-facts mt-10">
        ${fact('Accuracy', f.accuracy === null ? '–' : pct(f.accuracy), 'of the answers given')}
        ${fact('Lost to wrong answers', f.lost ? `−${num(f.lost)}` : '0', f.lost === 1 ? 'mark' : 'marks')}
        ${fact('Pace', `${f.secPerQuestion} s`, `a question, of ${f.budgetSec} s allowed`)}
        ${fact('Not opened', f.unseen, f.unseen === 1 ? 'question' : 'questions')}
      </div>` : ''}
      ${ins ? `
      <section class="card--lg glass mt-16" aria-labelledby="lt-next">
        <h2 class="card__title" id="lt-next" style="font-size:18px">${tutor ? 'Advice shown to this student' : 'What to do next'}</h2>
        ${ins.recs.length ? recList(ins.recs, test.exam, lang, !tutor) : `<p class="small muted mt-8">Nothing stands out to fix from this test. ${tutor ? '' : 'Keep to your routine.'}</p>`}
        ${ins.tests < 2 ? '<p class="small muted mt-12">Topic advice gets sharper with every test: a topic is judged once it has had four questions.</p>' : ''}
      </section>` : ''}
      <section class="card--lg glass mt-16" aria-labelledby="lt-topics">
        <h2 class="card__title" id="lt-topics" style="font-size:18px">By topic, against ${tutor ? 'the' : 'your'} batch</h2>
        <div class="lt-table mt-8" role="table" aria-label="Accuracy and time by topic">
          <div class="lt-table__row lt-table__head" role="row"><span role="columnheader">Topic</span><span role="columnheader">${tutor ? 'Right' : 'You'}</span><span role="columnheader">Batch</span><span role="columnheader">Time / Q</span></div>
          ${report.topics.map((t) => `<div class="lt-table__row" role="row"><span role="cell"${hiAttr(lang)}>${esc(topicName(t.label, lang))}</span><span role="cell"><b>${pct(t.accuracy)}</b></span><span role="cell">${pct(t.batchAccuracy)}</span><span role="cell">${t.secondsPerQuestion} s <span class="muted">(${t.batchSecondsPerQuestion} s)</span></span></div>`).join('')}
        </div>
        ${report.strongest && weak ? `<p class="small muted mt-12">Strongest: ${esc(topicName(report.strongest, lang))}. Weakest: ${esc(topicName(weak, lang))}.</p>` : ''}
      </section>
      ${!ins && weak ? `<button class="btn btn--saffron mt-16" type="button" data-action="practice-topic" data-label="${esc(weak)}" data-topic="${topicOf(weak)}">Practise ${esc(weak.toLowerCase())}: 10 questions</button>` : ''}
      ${ins && !tutor && !stacked ? '<button class="btn btn--line mt-16" type="button" data-action="lt-progress">My progress in this league</button>' : ''}
      ${tutor ? '' : '<p class="small muted mt-16">Want to go over the questions? Ask your tutor: they have the paper with solutions.</p>'}
    </div>
  </div>`;
}

// ---------- a student across the league's tests (My progress; the tutor's view of one student) ----------

export function progressScreen({ data, error, lang }) {
  if (!data) {
    return `
  <div class="screen screen--lobby">${blobs()}
    <div class="screen__body screen__body--full">${back()}
      <h1 class="title mt-16">Progress</h1>
      <p class="${error ? 'notice' : 'muted'} mt-16">${esc(error || 'Loading…')}</p>
    </div>
  </div>`;
  }
  const d = data;
  const tutor = d.viewer === 'tutor';
  const who = d.student ? d.student.realName || d.student.nickname : '';
  const exam = EXAMS[d.league.exam];
  const n = d.tests.length;
  const share = (t) => Math.round((t.score / t.maxScore) * 100);
  const judged = d.topics.filter((t) => t.level !== 'few');
  const few = d.topics.filter((t) => t.level === 'few');
  const L = LEVEL_TEXT.en;
  const group = (level, color) => {
    const list = judged.filter((t) => t.level === level);
    return list.length ? `<h3 class="lt-level" style="color:${color}">${L[level]}</h3>
      <div class="lt-table lt-table--2">${list.map((t) => `<div class="lt-table__row"><span${hiAttr(lang)}>${esc(topicName(t.label, lang))}</span><span><b>${t.pct}%</b> <span class="muted">· ${t.right} of ${t.asked} · batch ${t.batchPct}%</span></span></div>`).join('')}</div>` : '';
  };
  return `
  <div class="screen screen--lobby">${blobs()}
    <div class="screen__body">${back()}
      <span class="eyebrow mt-16">${esc(d.league.name)} · ${esc(exam.short)}</span>
      <h1 class="title mt-8">${tutor ? esc(who) : 'My progress'}</h1>
      ${tutor && d.student.username ? `<p class="small muted mt-4">${esc(d.student.nickname)} · @${esc(d.student.username)}</p>` : ''}
      ${n ? `
      ${n >= 2 ? `<p class="lt-good mt-12">Share of the marks, test by test: ${d.tests.slice(-6).map((t) => `${share(t)}%`).join(' → ')}</p>` : ''}
      <section class="mt-16" aria-labelledby="lt-ptests">
        <h2 id="lt-ptests" style="font-size:18px">${n === 1 ? '1 test' : `${n} tests`}</h2>
        <div class="list glass mt-8">${[...d.tests].reverse().map((t) => `
          <button class="list__item" type="button" data-action="${tutor ? 'lt-student-report' : 'lt-report'}" data-id="${esc(t.id)}" style="align-items:flex-start">
            <span class="lt-rank">${t.rank}</span>
            <span class="grow" style="min-width:0"><span style="font-weight:600;overflow-wrap:anywhere">${esc(t.title)}</span>
              <span class="small muted" style="display:block">${esc(when(t.startsAt))} · rank ${t.rank} of ${t.of} · batch average ${num(t.average)}${tutor && !t.released ? ' · not released yet' : ''}</span></span>
            <span style="font-weight:700;white-space:nowrap">${num(t.score)} <span class="muted" style="font-weight:400">/ ${num(t.maxScore)}</span></span>
          </button>`).join('')}</div>
      </section>
      <section class="card--lg glass mt-16" aria-labelledby="lt-pwork">
        <h2 class="card__title" id="lt-pwork" style="font-size:18px">${tutor ? 'Advice shown to this student' : 'What to work on'}</h2>
        ${d.recs.length ? recList(d.recs, d.league.exam, lang, !tutor)
    : `<p class="small muted mt-8">${judged.length ? 'No weak topics so far.' : 'Not enough questions on any one topic yet. A topic is judged once it has had four questions across tests.'}</p>`}
      </section>
      <section class="card--lg glass mt-16" aria-labelledby="lt-ptopics">
        <h2 class="card__title" id="lt-ptopics" style="font-size:18px">Topics across ${n === 1 ? 'this test' : `these ${n} tests`}</h2>
        ${group('weak', '#B3261E')}${group('ok', '#B84700')}${group('strong', '#0B6B50')}
        ${few.length ? `<h3 class="lt-level">${L.few}</h3><p class="small muted"${hiAttr(lang)}>${few.map((t) => `${esc(topicName(t.label, lang))} (${t.asked})`).join(', ')}</p>` : ''}
      </section>` : `<p class="notice mt-16">${tutor ? 'This student hasn’t sat a marked test in this league yet.' : 'Your progress shows here once your tutor releases the results of a test you sat.'}</p>`}
    </div>
  </div>`;
}

// ---------- the tutor's class report (Reports: class report, student list) ----------

export function classScreen({ data, error, lang, busy }) {
  if (!data) {
    return `
  <div class="screen screen--lobby">${blobs()}
    <div class="screen__body screen__body--full">${back('lt-back-league', 'Back to the league')}
      <h1 class="title mt-16">Class report</h1>
      <p class="${error ? 'notice' : 'muted'} mt-16">${esc(error || 'Loading…')}</p>
    </div>
  </div>`;
  }
  const d = data;
  const m = d.marking;
  // Score spread: five bands between 0 (or the lowest, if negative) and the maximum.
  const lo = Math.min(0, d.lowest ?? 0);
  const width = (m.max - lo) / 5;
  const bands = Array.from({ length: 5 }, (_, i) => ({ from: lo + i * width, to: lo + (i + 1) * width, n: 0 }));
  for (const s of d.students) bands[Math.min(4, Math.max(0, Math.floor((s.score - lo) / width)))].n++;
  const most = Math.max(1, ...bands.map((b) => b.n));
  const flags = (s) => [
    s.lateMinutes ? `${s.lateMinutes} min late` : '',
    s.appLeaves >= 3 ? `left the app ${s.appLeaves}×` : '',
    s.medianSeconds !== null && s.medianSeconds < 5 && s.right > 0 ? 'answered very fast' : '',
    s.web ? 'browser' : '',
  ].filter(Boolean).join(' · ');
  return `
  <div class="screen screen--lobby">${blobs()}
    <div class="screen__body">${back('lt-back-league', 'Back to the league')}
      <span class="eyebrow mt-16">Class report · ${esc(when(d.test.startsAt))}</span>
      <h1 class="title mt-8">${esc(d.test.title)}</h1>
      ${d.released
    ? `<p class="notice mt-12">Results released ${esc(when(d.releasedAt))}. Each student sees their score, rank and topic report.</p>`
    : `<p class="muted mt-8">Students see only what they attempted until you release results. Released results can’t be taken back.</p>
      <button class="btn btn--saffron mt-12" type="button" data-action="lt-release-ask" ${busy ? 'disabled' : ''}>Release results to ${d.sat} student${d.sat === 1 ? '' : 's'}</button>`}
      <div class="stats mt-16">
        <div class="stat tint"><div class="stat__label">Sat</div><div class="stat__value">${d.sat}<span class="muted" style="font-size:15px"> / ${d.eligible}</span></div></div>
        <div class="stat tint"><div class="stat__label">Average</div><div class="stat__value">${d.average === null ? '–' : num(d.average)}</div></div>
        <div class="stat tint"><div class="stat__label">Highest</div><div class="stat__value">${d.highest === null ? '–' : num(d.highest)}</div></div>
      </div>
      <p class="small muted mt-8">Out of ${num(m.max)} (${esc(markingLabel({ marks: m.marks, negative: m.negative }))}).</p>
      ${d.students.length ? `
      <section class="card--lg glass mt-16" aria-labelledby="lt-spread">
        <h2 class="card__title" id="lt-spread" style="font-size:18px">Score spread</h2>
        <div class="lt-bars mt-8">${bands.map((b) => `<div class="lt-bars__row"><span class="small">${num(Math.round(b.from * 4) / 4)} to ${num(Math.round(b.to * 4) / 4)}</span><span class="lt-bars__track"><span class="lt-bars__bar" style="width:${Math.round((b.n / most) * 100)}%"></span></span><span class="small"><b>${b.n}</b></span></div>`).join('')}</div>
      </section>
      <section class="mt-16" aria-labelledby="lt-students">
        <div class="row row--between" style="align-items:center"><h2 id="lt-students" style="font-size:18px">Students</h2>
          ${d.released ? '<button class="btn btn--sm btn--line" type="button" data-action="lt-csv">Download CSV</button>' : ''}</div>
        <div class="list glass mt-8">${d.students.map((s) => `
          <${s.username ? `button type="button" data-action="lt-student" data-user="${esc(s.username)}" aria-label="${esc(s.realName || s.nickname)}: progress and advice" class="list__item"` : 'div class="list__item list__item--static"'} style="align-items:flex-start">
            <span class="lt-rank">${s.rank}</span>
            <span class="grow" style="min-width:0"><span style="font-weight:600;overflow-wrap:anywhere">${esc(s.realName || 'Deleted player')}</span>
              <span class="small muted" style="display:block">${esc(s.nickname)}${s.username ? ` · @${esc(s.username)}` : ''} · ${s.right} right, ${s.wrong} wrong, ${s.skipped} skipped</span>
              ${flags(s) ? `<span class="small" style="display:block;color:#B84700">${esc(flags(s))}</span>` : ''}</span>
            <span style="font-weight:700">${num(s.score)}</span>${s.username ? icon('chevron') : ''}
          </${s.username ? 'button' : 'div'}>`).join('')}</div>
        <p class="small muted mt-8">Tap a student for their progress across tests and what would help them most.</p>
      </section>` : '<p class="notice mt-16">Nobody sat this test.</p>'}
      ${d.absent.length ? `<p class="small muted mt-12"><b>Didn’t sit it (${d.absent.length}):</b> ${d.absent.map((p) => esc(p.realName || p.nickname)).join(', ')}</p>` : ''}
      ${d.reteach?.length ? `
      <section class="card--lg glass mt-16" aria-labelledby="lt-reteach">
        <h2 class="card__title" id="lt-reteach" style="font-size:18px">Re-teach first</h2>
        <p class="small muted mt-4">Topics most of the batch got wrong, the ones worth most marks in ${esc(EXAMS[d.test.exam]?.short || 'the exam')} first.</p>
        ${reteachList(d.reteach, lang)}
      </section>` : ''}
      ${d.commonWrong?.length ? `
      <section class="card--lg glass mt-16" aria-labelledby="lt-common">
        <h2 class="card__title" id="lt-common" style="font-size:18px">Common wrong answers</h2>
        <p class="small muted mt-4">Many students picked the same wrong option: a sign of the same misunderstanding.</p>
        <div class="mt-8">${d.commonWrong.map((c) => commonItem(c, lang)).join('')}</div>
      </section>` : ''}
      ${d.topics.length ? `
      <section class="card--lg glass mt-16" aria-labelledby="lt-weak">
        <h2 class="card__title" id="lt-weak" style="font-size:18px">Topics, weakest first</h2>
        <div class="lt-table lt-table--2 mt-8" role="table" aria-label="Class accuracy by topic">
          ${d.topics.map((t) => `<div class="lt-table__row" role="row"><span role="cell">${esc(topicName(t.label, lang))} <span class="muted">(${t.questions} Q)</span></span><span role="cell"><b>${t.accuracy}%</b> right</span></div>`).join('')}
        </div>
      </section>` : ''}
      <section class="card--lg glass mt-16" aria-labelledby="lt-qs">
        <h2 class="card__title" id="lt-qs" style="font-size:18px">Each question</h2>
        <div class="lt-table lt-table--q mt-8" role="table" aria-label="Each question: percent right, skipped and average time">
          <div class="lt-table__row lt-table__head" role="row"><span role="columnheader">Q</span><span role="columnheader">Topic</span><span role="columnheader">Right</span><span role="columnheader">Skipped</span><span role="columnheader">Time</span></div>
          ${d.perQuestion.map((x) => `<div class="lt-table__row" role="row"><span role="cell">${x.n}</span><span role="cell">${esc(topicName(x.label, lang))}</span><span role="cell"><b>${x.rightPct}%</b></span><span role="cell">${x.skippedPct}%</span><span role="cell">${x.avgSeconds} s</span></div>`).join('')}
        </div>
      </section>
      <section class="mt-16" aria-labelledby="lt-paper">
        <div class="row row--between" style="align-items:center"><h2 id="lt-paper" style="font-size:18px">The paper, with solutions</h2>
          <button class="btn btn--sm btn--line" type="button" data-action="lt-paper">Download</button></div>
        <p class="small muted mt-4">Only you can see the paper; students can’t open it after the test.</p>
        <div class="mt-8">${d.paper.map((q) => paperItem(q, lang)).join('')}</div>
      </section>
    </div>
  </div>`;
}

function reteachList(list, lang) {
  return `<div class="lt-table lt-table--2 mt-8" role="table" aria-label="Topics to re-teach">${list.map((t) => `<div class="lt-table__row" role="row"><span role="cell"${hiAttr(lang)}>${esc(topicName(t.label, lang))} <span class="muted">(${t.questions} Q)</span></span><span role="cell"><b>${t.pct}%</b> right</span></div>`).join('')}</div>`;
}

function commonItem(c, lang) {
  const hi = lang === 'hi' && c.hi;
  const q = hi ? c.hi : c;
  return `<div class="lt-common">
    <p class="small muted"${hi ? ' lang="hi"' : ''}>Q${c.n} · ${esc(topicName(c.label, lang))}</p>
    <p class="lt-common__q"${hi ? ' lang="hi"' : ''}>${esc(q.text)}</p>
    <p class="small"><b style="color:#B3261E">${c.count} of ${c.of}</b> chose <b${hi ? ' lang="hi"' : ''}>${esc(q.picked)}</b> · right answer <b style="color:#0B6B50"${hi ? ' lang="hi"' : ''}>${esc(q.answer)}</b></p>
  </div>`;
}

// ---------- the class across a league's tests (Class insights, for the tutor) ----------

export function insightsScreen({ data, error, lang }) {
  if (!data) {
    return `
  <div class="screen screen--lobby">${blobs()}
    <div class="screen__body screen__body--full">${back()}
      <h1 class="title mt-16">Class insights</h1>
      <p class="${error ? 'notice' : 'muted'} mt-16">${esc(error || 'Loading…')}</p>
    </div>
  </div>`;
  }
  const d = data;
  const n = d.tests.length;
  const name = (s) => esc(s.realName || s.nickname);
  const person = (s, line) => `
          <button class="list__item" type="button" data-action="lt-student" data-user="${esc(s.username)}" style="align-items:flex-start">
            <span class="grow" style="min-width:0"><span style="font-weight:600;overflow-wrap:anywhere">${name(s)}</span>
              <span class="small muted" style="display:block">${esc(s.nickname)} · @${esc(s.username)} · ${line}</span></span>${icon('chevron')}
          </button>`;
  const group = (title, list, line, note) => (list.length ? `
      <section class="mt-16"><h2 style="font-size:18px">${title}</h2><p class="small muted mt-4">${note}</p>
        <div class="list glass mt-8">${list.map((s) => person(s, line(s))).join('')}</div></section>` : '');
  const watching = d.slipping.length + d.missed.length;
  return `
  <div class="screen screen--lobby">${blobs()}
    <div class="screen__body">${back()}
      <span class="eyebrow mt-16">${esc(d.league.name)} · ${esc(EXAMS[d.league.exam]?.short || '')}</span>
      <h1 class="title mt-8">Class insights</h1>
      <p class="muted mt-8">Across ${n === 1 ? 'your 1 marked test' : `your ${n} marked tests`}. Tap a student for their progress and the advice they’re shown.</p>
      <section class="card--lg glass mt-16" aria-labelledby="lt-trend">
        <h2 class="card__title" id="lt-trend" style="font-size:18px">The batch, test by test</h2>
        <div class="lt-table lt-table--2 mt-8" role="table" aria-label="Average share of the marks in each test">
          ${[...d.tests].reverse().map((t) => `<div class="lt-table__row" role="row"><span role="cell" style="min-width:0"><span style="font-weight:600;overflow-wrap:anywhere">${esc(t.title)}</span><span class="small muted" style="display:block">${esc(when(t.startsAt))} · ${t.sat} of ${t.eligible} sat${t.released ? '' : ' · not released'}</span></span><span role="cell">${t.averagePct === null ? '<span class="muted">nobody sat</span>' : `<b>${t.averagePct}%</b> average`}</span></div>`).join('')}
        </div>
      </section>
      <section class="card--lg glass mt-16" aria-labelledby="lt-creteach">
        <h2 class="card__title" id="lt-creteach" style="font-size:18px">Re-teach first</h2>
        ${d.reteach.length ? `<p class="small muted mt-4">Across all your tests: the topics most of the batch gets wrong, the ones worth most marks in ${esc(EXAMS[d.league.exam]?.short || 'the exam')} first.</p>${reteachList(d.reteach, lang)}`
    : '<p class="small muted mt-8">No topic stands out: the batch gets at least half of every topic right so far.</p>'}
      </section>
      ${group('Slipping', d.slipping, (s) => `${s.to}% of the marks last time, against ${s.from}% before`, 'Their last score was well below their own average.')}
      ${group('Missed tests', d.missed, (s) => `missed the last ${s.of} tests`, 'Members who could have sat the last two tests and sat neither.')}
      ${group('Most improved', d.improved, (s) => `${s.to}% of the marks last time, up from ${s.from}%`, 'Worth a word of praise.')}
      ${!watching && !d.improved.length ? `<p class="small muted mt-16">${n < 2 ? 'Students to watch and the most improved show here after two or more tests.' : 'Nobody is slipping or missing tests.'}</p>` : ''}
    </div>
  </div>`;
}

function paperItem(raw, lang) {
  const q = inLang(raw, lang);
  const hi = q.isHi ? ' lang="hi"' : '';
  return `
          <details class="review tint">
            <summary class="review__q" style="cursor:pointer"${hi}>Q${raw.n}. ${esc(q.text)}</summary>
            <ol class="small mt-8" type="A" style="padding-left:20px;margin-bottom:0"${hi}>${q.options.map((o, i) => `<li${i === raw.answerIndex ? ' style="color:#0B6B50;font-weight:700"' : ''}>${esc(o)}${i === raw.answerIndex ? ' ✓' : ''}</li>`).join('')}</ol>
            <ol class="small mt-8" style="padding-left:20px;margin-bottom:0"${hi}>${q.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
          </details>`;
}

/** The student list as CSV, for the tutor (after release). */
export function studentsCsv(d) {
  // Text starting = + - @ would run as a formula in a spreadsheet: a ' in front keeps it text (numbers stay numbers).
  const cell = (v) => `"${(typeof v === 'string' ? v.replace(/^[=+\-@\t\r]/, "'$&") : String(v ?? '')).replace(/"/g, '""')}"`;
  const rows = [['Rank', 'Name', 'Nickname', 'User ID', 'Score', `Out of`, 'Right', 'Wrong', 'Skipped', 'Minutes taken', 'Started late (min)', 'Left the app', 'Device']];
  for (const s of d.students) rows.push([s.rank, s.realName || 'Deleted player', s.nickname, s.username || '', s.score, d.marking.max, s.right, s.wrong, s.skipped, Math.round(s.timeMs / 60000), s.lateMinutes, s.appLeaves, s.web ? 'Browser' : 'App']);
  for (const p of d.absent) rows.push(['', p.realName || '', p.nickname, p.username || '', 'Absent', d.marking.max, '', '', '', '', '', '', '']);
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

/** The paper with answers and solutions, as plain text in English and Hindi, for the tutor. */
export function paperText(d) {
  const lines = [`${d.test.title} (${EXAMS[d.test.exam].short}, ${when(d.test.startsAt)})`, `${d.paper.length} questions, ${d.test.durationMinutes} minutes, ${markingLabel({ marks: d.marking.marks, negative: d.marking.negative })}`, ''];
  for (const q of d.paper) {
    lines.push(`Q${q.n}. ${q.text}`, ...q.options.map((o, i) => `   ${KEYS[i]}. ${o}`), `   Answer: ${KEYS[q.answerIndex]}. ${q.answerText}`, ...q.steps.filter((s) => !/^Answer:/.test(s)).map((s) => `   - ${s}`));
    if (q.hi) lines.push('', `   ${q.hi.text}`, ...q.hi.options.map((o, i) => `   ${KEYS[i]}. ${o}`), `   उत्तर: ${KEYS[q.answerIndex]}. ${q.hi.answerText}`, ...q.hi.steps.filter((s) => !/^उत्तर:/.test(s)).map((s) => `   - ${s}`));
    lines.push('');
  }
  return lines.join('\r\n');
}

// ---------- confirmations ----------

export function confirmSheet({ kind, test, sat }) {
  const t = {
    cancel: ['Cancel this test?', `${test.title} on ${when(test.startsAt)} is cancelled for everyone. Students see it as cancelled.`, 'Cancel the test', 'lt-cancel'],
    release: ['Release results?', `${sat} student${sat === 1 ? '' : 's'} will see their score, rank and topic report. Released results can’t be taken back.`, 'Release results', 'lt-release'],
  }[kind];
  return `
  <div class="scrim" data-action="close-sheet">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ltc-title" data-stop>
      <div class="sheet__handle"></div>
      <h2 class="sheet__title" id="ltc-title">${t[0]}</h2>
      <p class="muted mt-12">${esc(t[1])}</p>
      <div class="btn-row mt-20">
        <button class="btn btn--line" type="button" data-action="close-sheet">Keep it</button>
        <button class="btn ${kind === 'cancel' ? 'btn--danger' : 'btn--cobalt'}" type="button" data-action="${t[3]}">${t[2]}</button>
      </div>
    </div>
  </div>`;
}
