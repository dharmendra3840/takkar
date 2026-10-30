// Practice tab: topic practice and the mini mock (design/02-user-flows.md §2.2).
import { esc, blobs, tabbar, icon, num } from '../ui.js?v=403d9c56d9';
import { EXAMS, markingLabel, quantName } from '../exams.js?v=403d9c56d9';
import { QUANT } from '../engine/quant.js?v=403d9c56d9';
import { REASONING } from '../engine/reasoning.js?v=403d9c56d9';
import { counts, sectionOf } from '../mock.js?v=403d9c56d9';

const KEYS = ['A', 'B', 'C', 'D'];

/** Topics (labels) in each section, with the template ids behind each. */
export function topicsBySection() {
  const group = (list) => {
    const map = new Map();
    for (const t of list) map.set(t.label, [...(map.get(t.label) || []), t.id]);
    return [...map].map(([label, ids]) => ({ label, ids }));
  };
  return { quant: group(QUANT), reasoning: group(REASONING) };
}

const fmtMin = (ms) => {
  const m = Math.floor(ms / 60000); const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export function practiceScreen({ exam, stats, mocksLeft, plus }) {
  const e = EXAMS[exam];
  const topics = topicsBySection();
  const row = (topic, t) => {
    const s = stats[topic]?.byLabel?.[t.label];
    const acc = s && s.seen ? Math.round((s.right / s.seen) * 100) : null;
    return `<button class="topic-row" type="button" data-action="practice-topic" data-label="${esc(t.label)}" data-topic="${topic}">
      <span class="grow"><span class="topic-row__name">${esc(t.label)}</span>
        <span class="progress mt-8"><span class="progress__bar" style="width:${acc ?? 0}%;${acc !== null && acc < 50 ? 'background:#FF6A00' : ''}"></span></span></span>
      <span class="topic-row__acc">${acc === null ? '<span class="tag">New</span>' : `${acc}%`}</span>
    </button>`;
  };
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body">
      <span class="eyebrow">${esc(e.short)} pattern · ${markingLabel(e)}</span>
      <h1 class="title mt-8">Practice</h1>
      <div class="dgrid dgrid--practice">
      <section class="feature mt-16 ga-a" aria-label="Mini mock">
        <div class="feature__glow feature__glow--a"></div><div class="feature__glow feature__glow--b"></div>
        <div class="row row--between"><span class="small" style="color:#D7DBF5;font-weight:600">Mini mock</span><span class="tag tag--dark">${e.mock.quant + e.mock.reasoning} Q · ${e.mock.minutes} min</span></div>
        <h2 class="feature__title mt-8">Feel the real paper.</h2>
        <p class="small mt-8" style="color:#D7DBF5">${e.mock.quant} ${quantName(e)} + ${e.mock.reasoning} Reasoning, ${esc(e.short)} timing${e.mock.sectional ? ' with a clock for each section' : ''}. Move between questions, mark for review, full analysis.</p>
        <button class="btn btn--white mt-16" type="button" data-action="mock-intro">Start a mini mock</button>
        <p class="small center mt-8" style="color:#D7DBF5">${plus ? 'Plus: unlimited mocks' : mocksLeft > 0 ? '1 free mock today' : 'Today’s free mock is done. New one tomorrow.'}</p>
      </section>
      <div class="ga-b">
        <h2 class="mt-20" style="font-size:20px">${quantName(e)} by topic</h2>
        <p class="small muted mt-4">10 questions, no rival, steps after each answer. Unlimited.</p>
        <div class="list glass mt-8">${topics.quant.map((t) => row('quant', t)).join('')}</div>
      </div>
      <div class="ga-c">
        <h2 class="mt-20" style="font-size:20px">Reasoning by topic</h2>
        <div class="list glass mt-8">${topics.reasoning.map((t) => row('reasoning', t)).join('')}</div>
        <p class="small muted mt-12">English and General Awareness are not in practice yet. They are coming later.</p>
      </div>
      </div>
    </div>
    ${tabbar('practice')}
  </div>`;
}

export function mockIntro({ exam, mocksLeft, plus }) {
  const e = EXAMS[exam];
  const total = e.mock.quant + e.mock.reasoning;
  const can = plus || mocksLeft > 0;
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full">
      <div class="row"><button class="icon-btn glass" type="button" data-action="back" aria-label="Back">${icon('back')}</button></div>
      <span class="eyebrow mt-16">${esc(e.short)} · mini mock</span>
      <h1 class="title mt-8">${total} questions, ${e.mock.minutes} minutes.</h1>
      <div class="list glass mt-20">
        <div class="list__item list__item--static"><span class="grow">${quantName(e)}</span><strong>${e.mock.quant} questions</strong></div>
        <div class="list__item list__item--static"><span class="grow">Reasoning</span><strong>${e.mock.reasoning} questions</strong></div>
        <div class="list__item list__item--static"><span class="grow">Marking</span><strong>${markingLabel(e)}, skip 0</strong></div>
        <div class="list__item list__item--static"><span class="grow">Time</span><strong>${e.mock.sectional ? `${e.mock.minutes / 2} min per section` : `${e.mock.minutes} min in all`}</strong></div>
      </div>
      <ul class="small muted mt-16" style="padding-left:20px;line-height:1.7">
        <li>Move between questions and change answers until you submit.</li>
        <li>Mark a question for review to come back to it.</li>
        ${e.mock.sectional ? '<li>Each section has its own clock. When it ends you move to the next section and cannot go back, as in the real paper.</li>' : '<li>When the time ends, the mock is submitted for you.</li>'}
      </ul>
      <div class="mt-auto" style="padding-top:24px">
        <button class="btn btn--cobalt" type="button" data-action="mock-start" ${can ? '' : 'disabled'}>${can ? 'Start the mock' : 'Today’s free mock is done'}</button>
        ${can ? '' : '<p class="small muted center mt-8">Topic practice is unlimited. A new free mock is ready tomorrow.</p>'}
      </div>
    </div>
  </div>`;
}

export function mockScreen({ mock, timeLeft }) {
  const q = mock.questions[mock.current];
  const sec = mock.sections[sectionOf(mock, mock.current)];
  const n = mock.current - sec.from + 1;
  const choice = mock.answers[mock.current];
  const tab = (s, i) => {
    const locked = mock.sectional && i !== mock.section;
    return `<button type="button" class="mock-tab ${sectionOf(mock, mock.current) === i ? 'is-on' : ''}" data-action="mock-go" data-index="${s.from}" ${locked ? 'disabled' : ''}>${esc(s.name)} ${s.to - s.from}</button>`;
  };
  const cell = (i) => {
    const st = mock.answers[i] !== null ? (mock.marked[i] ? 'answered-marked' : 'answered') : mock.marked[i] ? 'marked' : mock.visited[i] ? 'seen' : '';
    const said = { 'answered-marked': 'answered, marked for review', answered: 'answered', marked: 'marked for review', seen: 'not answered' }[st] || 'not seen';
    return `<button type="button" class="pal ${st ? `pal--${st}` : ''} ${i === mock.current ? 'pal--now' : ''}" data-action="mock-go" data-index="${i}" aria-label="Question ${i - sec.from + 1}, ${said}" ${i === mock.current ? 'aria-current="true"' : ''}>${i - sec.from + 1}</button>`;
  };
  const isLastInSection = mock.sectional && mock.current === sec.to - 1;
  return `
  <div class="screen screen--arena">
    ${blobs('arena')}
    <div class="screen__body screen__body--full mock-body" style="gap:12px">
      <div class="topbar glass-dark">
        <button class="icon-btn" type="button" data-action="mock-submit-ask" aria-label="Submit the mock" style="color:#fff">${icon('close')}</button>
        <span style="font-weight:600;font-size:15px">${esc(EXAMS[mock.exam].short)} mini mock</span>
        <span class="timer ${timeLeft <= 60000 ? 'timer--low' : ''}" id="mock-timer" role="timer" aria-live="off">${fmtMin(timeLeft)}</span>
      </div>
      <div class="mock-tabs">${mock.sections.map(tab).join('')}</div>
      <div class="qpanel reading">
        <div class="small" style="font-weight:600;color:#D7DBF5">${esc(sec.name)} · question ${n} of ${sec.to - sec.from} · ${esc(q.label)}</div>
        <h1 class="question" id="question-text">${esc(q.text)}</h1>
        <div class="options" role="radiogroup" aria-labelledby="question-text">
          ${q.options.map((text, i) => `<button class="option ${choice === i ? 'option--chosen' : ''}" type="button" role="radio" aria-checked="${choice === i}" data-action="mock-choose" data-index="${i}">
            <span class="option__key" aria-hidden="true">${KEYS[i]}</span><span class="option__text">${esc(text)}</span></button>`).join('')}
        </div>
        <div class="row row--between mt-12">
          <button class="link-btn" type="button" data-action="mock-mark" style="color:#FFB27A">${mock.marked[mock.current] ? 'Unmark review' : 'Mark for review'}</button>
          <button class="link-btn" type="button" data-action="mock-clear" style="color:#D7DBF5" ${choice === null ? 'disabled' : ''}>Clear answer</button>
        </div>
        <button class="btn btn--saffron mt-12" type="button" data-action="mock-next">${isLastInSection ? 'Finish this section' : 'Save and next'}</button>
      </div>
      <div class="palette glass-dark">
        <div class="palette__grid">${Array.from({ length: sec.to - sec.from }, (_, k) => cell(sec.from + k)).join('')}</div>
        <div class="palette__key small"><span><i class="pal pal--answered"></i>Answered</span><span><i class="pal pal--marked"></i>Marked</span><span><i class="pal pal--seen"></i>Not answered</span><span><i class="pal"></i>Not seen</span></div>
        <button class="btn btn--ghost-dark mt-12" type="button" data-action="mock-submit-ask">Submit the mock</button>
      </div>
    </div>
  </div>`;
}

export function mockSubmitSheet({ mock }) {
  const c = counts(mock);
  return `
  <div class="scrim" data-action="close-sheet">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ms-title" data-stop>
      <div class="sheet__handle"></div>
      <h2 class="sheet__title" id="ms-title">Submit the mock?</h2>
      <div class="stats mt-12">
        <div class="stat tint"><div class="stat__label">Answered</div><div class="stat__value">${c.answered}</div></div>
        <div class="stat tint"><div class="stat__label">Not answered</div><div class="stat__value">${c.notAnswered}</div></div>
        <div class="stat tint"><div class="stat__label">Marked</div><div class="stat__value">${c.marked}</div></div>
      </div>
      <p class="muted mt-12">Unanswered questions score 0. You cannot change answers after submitting.</p>
      <div class="btn-row mt-20">
        <button class="btn btn--line" type="button" data-action="close-sheet">Keep going</button>
        <button class="btn btn--cobalt" type="button" data-action="mock-submit">Submit</button>
      </div>
    </div>
  </div>`;
}

/** IBPS PO: finishing a section early cannot be undone, so it asks first. */
export function sectionEndSheet({ mock, timeLeft }) {
  const sec = mock.sections[mock.section];
  const range = Array.from({ length: sec.to - sec.from }, (_, k) => sec.from + k);
  const answered = range.filter((i) => mock.answers[i] !== null).length;
  const marked = range.filter((i) => mock.marked[i]).length;
  const next = mock.sections[mock.section + 1];
  return `
  <div class="scrim" data-action="close-sheet">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="se-title" data-stop>
      <div class="sheet__handle"></div>
      <h2 class="sheet__title" id="se-title">Finish ${esc(sec.name)} now?</h2>
      <div class="stats mt-12">
        <div class="stat tint"><div class="stat__label">Answered</div><div class="stat__value">${answered}</div></div>
        <div class="stat tint"><div class="stat__label">Not answered</div><div class="stat__value">${range.length - answered}</div></div>
        <div class="stat tint"><div class="stat__label">Time left</div><div class="stat__value">${fmtMin(timeLeft)}</div></div>
      </div>
      <p class="muted mt-12">${marked ? `${marked} marked for review. ` : ''}After this you move to ${esc(next.name)} and cannot come back to ${esc(sec.name)}, as in the real paper. Unused time is not carried over.</p>
      <div class="btn-row mt-20">
        <button class="btn btn--line" type="button" data-action="close-sheet">Keep working</button>
        <button class="btn btn--cobalt" type="button" data-action="mock-section-next">Start ${esc(next.name)}</button>
      </div>
    </div>
  </div>`;
}

export function mockResult({ mock }) {
  const r = mock.result;
  const e = EXAMS[mock.exam];
  const reviews = mock.questions.map((q, i) => {
    const a = r.answers[i];
    const yours = a.choice === null ? 'Not answered' : `You chose ${esc(q.options[a.choice])}`;
    return `<details class="review tint">
      <summary class="review__q" style="cursor:pointer">${a.correct ? '<span style="color:#0B6B50">✓</span>' : a.choice === null ? '–' : '<span style="color:#B3261E">✗</span>'} Q${i + 1}. ${esc(q.text)}</summary>
      <p class="review__a"><span style="font-weight:600">${yours}.</span> <span style="color:#0B6B50;font-weight:600">Correct: ${esc(q.answerText)}</span></p>
      <ol class="small mt-8" style="padding-left:20px;margin-bottom:0">${q.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    </details>`;
  }).join('');
  const weakest = r.lost[0];
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body" style="padding-bottom:calc(var(--safe-bottom) + 32px)">
      <div class="row row--between">
        <button class="icon-btn glass" type="button" data-action="go" data-to="practice" aria-label="Back to Practice">${icon('close')}</button>
        <span class="tag">${esc(e.short)} mini mock</span>
      </div>
      <div class="dgrid dgrid--result">
      <div class="ga-a">
        <h1 class="verdict mt-20">${num(r.score)} out of ${r.max}</h1>
        <p class="mt-8 muted">Right ${r.right} · Wrong ${r.wrong} · Skipped ${r.skipped} · ${fmtMin(r.timeMs)} min</p>
      </div>
      <section class="card--lg tint mt-16 ga-b" aria-label="By section">
        <h2 class="card__title" style="font-size:18px">By section</h2>
        ${r.bySection.map((s) => `<div class="bar-row mt-12"><span class="bar-row__label">${esc(s.name)}</span>
          <div class="progress grow"><div class="progress__bar" style="width:${Math.max(0, Math.round((s.score / s.max) * 100))}%"></div></div>
          <span class="bar-row__val" style="width:auto">${num(s.score)}/${s.max}</span></div>
          <p class="small muted" style="margin:2px 0 0 106px">${s.right} right · ${s.wrong} wrong · ${fmtMin(s.ms)} min</p>`).join('')}
      </section>
      <section class="card--lg tint mt-12 ga-c" aria-label="Where you lost marks">
        <h2 class="card__title" style="font-size:18px">Where you lost marks</h2>
        ${r.lost.length ? r.lost.slice(0, 4).map((l) => `<p class="small mt-8">${esc(l.label)}: <strong>−${num(l.marks)}</strong></p>`).join('') : '<p class="small mt-8">No negative marks. Well judged.</p>'}
      </section>
      <div class="btn-row mt-16 ga-d">
        ${weakest ? `<button class="btn btn--glass" type="button" data-action="practice-topic" data-label="${esc(weakest.label)}" data-topic="${QUANT.some((t) => t.label === weakest.label) ? 'quant' : 'reasoning'}">Practise ${esc(weakest.label.toLowerCase())}</button>` : ''}
        <button class="btn btn--saffron" type="button" data-action="go" data-to="practice">Back to Practice</button>
      </div>
      <div class="ga-e"><h2 class="mt-24" style="font-size:22px">Every question, with the steps</h2><div class="mt-12">${reviews}</div></div>
      </div>
    </div>
  </div>`;
}
