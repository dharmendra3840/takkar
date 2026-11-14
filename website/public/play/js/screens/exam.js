// Exam-first onboarding (design/02-user-flows.md §2.1): which exam, when, its rules, and a daily goal.
import { esc, blobs, icon, LOGO } from '../ui.js?v=a9e7f3de4a';
import { EXAMS, examGroups, markingLabel, quantName } from '../exams.js?v=a9e7f3de4a';

const back = (show) => (show ? `<div class="row"><button class="icon-btn glass" type="button" data-action="back" aria-label="Back">${icon('back')}</button></div>` : '');
const steps = (n, total = 3) => `<div class="steps" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`;

/** Step 1: which exam. */
export function examPick({ selected, canGoBack }) {
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full exam-flow">
      ${back(canGoBack)}
      ${canGoBack ? '' : `<div class="brand">${LOGO()}<span class="brand__word">takkar</span><span class="brand__hi" lang="hi">टक्कर</span></div>`}
      ${steps(1)}
      <h1 class="title mt-16">Which exam are you preparing for?</h1>
      <p class="muted mt-8">Duels, practice and mocks follow its pattern: marking, time and topics.</p>
      <div class="exam-list mt-20" role="radiogroup" aria-label="Exam">
        ${examGroups().map(([group, exams]) => `<p class="exam-list__group">${esc(group)}</p>${exams.map((e) => `
          <button class="exam-card ${selected === e.id ? 'is-on' : ''}" type="button" role="radio" aria-checked="${selected === e.id}" data-action="pick-exam" data-value="${e.id}">
            <span class="exam-card__badge" style="background:${e.color}">${esc(e.badge)}</span>
            <span class="grow"><span class="exam-card__name">${esc(e.short)}</span>
              <span class="exam-card__meta">${esc(e.name.replace(e.short, '').trim())} · ${e.paper.questions} questions · ${e.paper.minutes} min · <span class="nowrap">${markingLabel(e)}</span></span></span>
            <span class="exam-card__tick" aria-hidden="true">${icon('check')}</span>
          </button>`).join('')}`).join('')}
      </div>
      <p class="small muted center mt-12">More exams soon: IBPS Clerk, SBI PO and Clerk, SSC MTS…</p>
      <div class="mt-auto" style="padding-top:24px">
        <button class="btn btn--cobalt" type="button" data-action="exam-continue" ${selected ? '' : 'disabled'}>Continue</button>
      </div>
    </div>
  </div>`;
}

/** The next twelve months, for "When is your exam?". */
export function upcomingMonths(now = new Date()) {
  const out = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    out.push({ value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) });
  }
  return out;
}

/** Step 2 (optional): exam month. */
export function examMonth({ exam, month, switchFrom = null }) {
  const e = EXAMS[exam];
  const months = upcomingMonths();
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full exam-flow">
      ${back(true)}
      ${steps(2)}
      <h1 class="title mt-16">When is your ${esc(e.short)} exam?</h1>
      <p class="muted mt-8">We show a countdown on Home. You can change it any time.</p>
      ${switchFrom ? `<p class="notice mt-16">This switches your exam from ${esc(EXAMS[switchFrom]?.short || 'your current exam')} to ${esc(e.short)}. Your games and streak are kept. Tap Back to stay on ${esc(EXAMS[switchFrom]?.short || 'your current exam')}.</p>` : ''}
      <div class="month-grid mt-20" role="radiogroup" aria-label="Exam month">
        ${months.map((m) => `<button type="button" role="radio" aria-checked="${month === m.value}" class="${month === m.value ? 'is-on' : ''}" data-action="pick-month" data-value="${m.value}">${esc(m.label)}</button>`).join('')}
      </div>
      <button class="month-none mt-12 ${month === 'unknown' ? 'is-on' : ''}" type="button" data-action="pick-month" data-value="unknown" aria-pressed="${month === 'unknown'}">Not decided yet</button>
      <div class="mt-auto" style="padding-top:24px">
        <button class="btn btn--cobalt" type="button" data-action="month-continue">${switchFrom ? `Switch to ${esc(e.short)}` : month ? 'Continue' : 'Skip for now'}</button>
      </div>
    </div>
  </div>`;
}

/** "Play it like the real paper": the exam's marking and time, before the first duel and from You. */
export function examRules({ exam, first, returning = false, qlang = null }) {
  const e = EXAMS[exam];
  const neg = e.negative === 1 / 3 ? '⅓' : String(e.negative);
  const cancel = Math.round(e.marks / e.negative);
  return `
  <div class="screen screen--arena">
    ${blobs('arena')}
    <div class="screen__body screen__body--full exam-flow">
      ${first ? '' : back(true)}
      <span class="eyebrow mt-8" style="color:#FFB27A">${first ? (returning ? 'New in Takkar · ' : 'Before your first duel · ') : ''}${esc(e.short)} rules</span>
      <h1 class="title mt-8">Play it like the real paper.</h1>
      <div class="rules glass-dark mt-20">
        <div class="rules__row"><span>Right answer</span><strong class="rules__right">+${e.marks}</strong></div>
        <div class="rules__row"><span>Wrong answer</span><strong class="rules__wrong">−${neg}</strong></div>
        <div class="rules__row"><span>Skip</span><strong>0</strong></div>
        <div class="rules__row"><span>Time per question</span><strong>${e.seconds} s</strong></div>
      </div>
      <p class="mt-16" style="color:#D7DBF5">Not sure? Skipping costs nothing. ${cancel} wrong guesses cancel one right answer.</p>
      <p class="mt-8" style="color:#D7DBF5">Each duel: 5 ${quantName(e)} + 5 Reasoning questions. English and General Awareness are coming later.</p>
      ${e.note ? `<p class="mt-8 small" style="color:#AEB4DE">${esc(e.note)}</p>` : ''}
      ${first ? `
      <div class="mt-20" role="radiogroup" aria-labelledby="qlang-title">
        <p class="small" id="qlang-title" style="color:#D7DBF5;font-weight:600">Questions in <span lang="hi">· प्रश्नों की भाषा</span></p>
        <div class="qchoice mt-8">
          <button type="button" role="radio" aria-checked="${qlang === 'hi'}" class="qchoice__btn ${qlang === 'hi' ? 'is-on' : ''}" data-action="set-setting" data-group="qlang" data-value="hi" lang="hi">हिंदी</button>
          <button type="button" role="radio" aria-checked="${qlang !== 'hi'}" class="qchoice__btn ${qlang !== 'hi' ? 'is-on' : ''}" data-action="set-setting" data-group="qlang" data-value="en">English</button>
        </div>
        <p class="small mt-8" style="color:#AEB4DE">You can switch on any question, like in the exam.</p>
      </div>` : ''}
      <div class="mt-auto" style="padding-top:24px">
        <button class="btn btn--saffron" type="button" data-action="${first ? 'rules-start' : 'back'}">${first ? (returning ? 'Continue' : 'Start my first duel') : 'Got it'}</button>
      </div>
    </div>
  </div>`;
}

/** After the first duel: a daily goal. */
// remind: whether the daily reminder switch is on, or null when this device can't remind (web, older APKs) or it's on already.
export function goalScreen({ goal, remind = null }) {
  const opt = (n, label, sub) => `<button type="button" role="radio" aria-checked="${goal === n}" class="exam-card ${goal === n ? 'is-on' : ''}" data-action="pick-goal" data-value="${n}">
    <span class="exam-card__badge" style="background:${n === 1 ? '#4B5DFF' : n === 3 ? '#2A3BE8' : '#FF6A00'}">${n}</span>
    <span class="grow"><span class="exam-card__name">${label}</span><span class="exam-card__meta">${sub}</span></span>
    <span class="exam-card__tick" aria-hidden="true">${icon('check')}</span></button>`;
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full exam-flow">
      <span class="eyebrow mt-8">Nice start</span>
      <h1 class="title mt-8">How many a day?</h1>
      <p class="muted mt-8">A small daily goal beats a big weekend. Duels, challenges and practice sets all count, and Home shows how you are doing.</p>
      <div class="exam-list mt-20" role="radiogroup" aria-label="Daily goal">
        ${opt(1, '1 a day', 'About 5 minutes')}
        ${opt(3, '3 a day', 'About 15 minutes')}
        ${opt(5, '5 a day', 'About 25 minutes, for the last weeks before the exam')}
      </div>
      ${remind === null ? '' : `<div class="list glass mt-16"><label class="list__item" for="goal-remind">
        <span class="grow">Remind me every day at 7 pm<span class="small muted" style="display:block">Skipped on days you’ve played. Change the time on You.</span></span>
        <span class="switch"><input id="goal-remind" type="checkbox" ${remind ? 'checked' : ''} data-input="goal-remind"><span></span></span></label></div>`}
      <div class="mt-auto" style="padding-top:24px">
        <button class="btn btn--cobalt" type="button" data-action="goal-save" ${goal ? '' : 'disabled'}>Set my goal</button>
        <button class="btn btn--glass mt-12" type="button" data-action="goal-skip">Not now</button>
      </div>
    </div>
  </div>`;
}
