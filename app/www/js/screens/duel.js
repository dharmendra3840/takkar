import { esc, blobs, icon, num } from '../ui.js';
import { TOPIC_LABELS } from '../game.js';
import { getExam } from '../exams.js';

const KEYS = ['A', 'B', 'C', 'D'];

function rivalName(duel) {
  if (duel.kind === 'practice') return 'Right so far';
  return duel.kind === 'challenge' ? `${esc(duel.challenge.nickname)}’s score` : 'Rival (bot)';
}

function rivalScore(duel) {
  if (duel.kind === 'practice') return duel.answers.filter((a) => a.correct).length;
  return duel.kind === 'challenge' ? duel.challenge.score : duel.them;
}

/** Share of the collision bar that is yours (cobalt). */
export function collisionShare(duel) {
  const floor = duel.marking === 'exam' ? 10 : 0;
  const you = duel.you + floor;
  const them = rivalScore(duel) + floor;
  if (you + them <= 0) return 50;
  return Math.max(6, Math.min(94, Math.round((you / (you + them)) * 100)));
}

function dots(duel, phase) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = duel.answers[i];
    if (a) {
      if (a.choice === null) return '<span class="dot dot--skip" aria-hidden="true">–</span>';
      return a.correct ? '<span class="dot dot--right" aria-hidden="true">✓</span>' : '<span class="dot dot--wrong" aria-hidden="true">✗</span>';
    }
    return `<span class="dot ${i === duel.index && phase === 'question' ? 'dot--now' : ''}" aria-hidden="true"></span>`;
  }).join('');
}

function rivalStatus(duel, phase, botLocked) {
  if (duel.kind === 'practice') return `Practice · ${esc(duel.practiceTopic || '')}`;
  if (duel.kind === 'challenge') return `Beat ${num(duel.challenge.score)} to win`;
  if (phase === 'reveal') return 'Rival answered';
  return botLocked ? 'Rival locked in' : 'Rival is thinking';
}

export function duelScreen({ duel, phase, last, timeLeft, botLocked, flagged }) {
  const q = duel.questions[duel.index];
  const share = collisionShare(duel);
  const n = duel.index + 1;
  const right = duel.answers.filter((a) => a.correct).length;
  const wrong = duel.answers.filter((a) => a.choice !== null && !a.correct).length;

  let optionsHtml;
  if (phase === 'question') {
    optionsHtml = q.options.map((text, i) => `
      <button class="option" type="button" data-action="answer" data-index="${i}" aria-label="Option ${KEYS[i]}: ${esc(text)}">
        <span class="option__key" aria-hidden="true">${KEYS[i]}</span><span class="option__text">${esc(text)}</span>
      </button>`).join('');
  } else {
    optionsHtml = q.options.map((text, i) => {
      const isAnswer = i === q.answerIndex;
      const isPick = i === last.choice;
      let cls = 'option--faded'; let mark = '';
      if (isAnswer) { cls = 'option--correct'; mark = `${icon('check')} Correct`; }
      else if (isPick) { cls = 'option--wrong'; mark = `${icon('cross')} Your answer`; }
      return `<button class="option ${cls}" type="button" disabled>
        <span class="option__key" aria-hidden="true">${KEYS[i]}</span><span class="option__text">${esc(text)}</span>
        ${mark ? `<span class="option__mark row" style="gap:4px">${mark}</span>` : ''}
      </button>`;
    }).join('');
  }

  let explain = '';
  if (phase === 'reveal') {
    const pts = last.points;
    const ptsText = duel.marking === 'exam'
      ? (pts > 0 ? `+${num(pts)} mark${pts === 1 ? '' : 's'}` : pts < 0 ? `−${num(-pts)} mark${pts === -1 ? '' : 's'}` : '0 marks')
      : `+${pts} points`;
    let head; let cls;
    if (last.correct) { head = `${icon('check')} Correct. ${ptsText}.`; cls = 'right'; }
    else if (last.timedOut) { head = `Time up. ${ptsText}.`; cls = 'wrong'; }
    else if (last.choice === null) { head = `Skipped. ${ptsText}.`; cls = 'wrong'; }
    else { head = `${icon('cross')} Wrong. ${ptsText}.`; cls = 'wrong'; }

    let rival = '';
    if (last.bot) {
      if (last.bot.choice === null) rival = 'The rival skipped this one.';
      else if (last.bot.correct) rival = last.correct ? 'The rival got this one too.' : 'The rival got this one right.';
      else rival = 'The rival got this one wrong.';
    }
    // The first wrong guess of a duel: how negative marking works, once, without nagging.
    const exam = getExam(duel.exam);
    const wrongSoFar = duel.answers.filter((a) => a.choice !== null && !a.correct).length;
    const tip = duel.marking === 'exam' && exam && !last.correct && last.choice !== null && wrongSoFar === 1
      ? `<p class="tip mt-8">Not sure? Skipping costs 0. In ${esc(exam.short)}, ${Math.round(exam.marks / exam.negative)} wrong answers cancel one right one.</p>` : '';
    explain = `
      <div class="explain">
        <div class="explain__head explain__head--${cls} row" style="gap:6px">${head}</div>
        ${rival ? `<p class="small muted mt-8" style="color:#D7DBF5">${rival}</p>` : ''}
        ${tip}
        <ol>${q.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      </div>
      <div class="row row--between">
        <button class="flag-btn" type="button" data-action="flag" ${flagged ? 'disabled' : ''}>${flagged ? 'Thanks, flagged for review' : 'Flag this question'}</button>
        <span class="small" style="color:#D7DBF5">${esc(q.label)}</span>
      </div>`;
  }

  const timerText = phase === 'question' ? `${Math.ceil(timeLeft / 1000)}s` : 'Locked';
  const timerCls = phase === 'question' ? (timeLeft <= 5000 ? 'timer--low' : '') : 'timer--locked';

  return `
  <div class="screen screen--arena">
    ${blobs('arena')}
    <div class="screen__body screen__body--full duel-body" style="gap:12px;padding-top:calc(var(--safe-top) + 14px)">
      <div class="topbar glass-dark">
        <button class="icon-btn" type="button" data-action="leave-duel" aria-label="Leave duel" style="color:#fff">${icon('close')}</button>
        <span style="font-weight:600;font-size:16px">Question ${n} of 10</span>
        <span class="timer ${timerCls}" id="timer" role="timer" aria-live="off">${timerText}</span>
      </div>

      <div class="scorecard glass-dark">
        <div class="progress progress--dark" aria-hidden="true" style="height:6px"><div class="progress__bar" id="time-bar" style="width:${phase === 'question' ? Math.round((timeLeft / duel.limitMs) * 100) : 0}%;transition:width 0.25s linear"></div></div>
        <div class="row row--between mt-12" style="align-items:flex-end">
          <div><div class="score-label">You</div><div class="score score--you">${num(duel.you)}</div></div>
          <div style="text-align:right"><div class="score-label">${rivalName(duel)}</div><div class="score score--rival">${num(rivalScore(duel))}</div></div>
        </div>
        <div class="collision mt-12" role="img" aria-label="You ${num(duel.you)}, ${duel.kind === 'challenge' ? 'target' : duel.kind === 'practice' ? 'right so far' : 'rival'} ${num(rivalScore(duel))}">
          <div class="collision__you" style="width:${share}%"></div>
          <div class="collision__dot" style="left:${share}%"></div>
        </div>
        <div class="row row--between mt-12">
          <div class="dots" role="img" aria-label="${right} right, ${wrong} wrong so far">${dots(duel, phase)}</div>
          <span class="small" id="rival-status" style="color:#D7DBF5">${rivalStatus(duel, phase, botLocked)}</span>
        </div>
      </div>

      <div class="qpanel reading">
        <div class="small" style="font-weight:600;color:#D7DBF5">${TOPIC_LABELS[q.topic]}, ${esc(q.label.toLowerCase())}</div>
        <h1 class="question" id="question-text">${esc(q.text)}</h1>
        <div class="options" role="group" aria-labelledby="question-text">${optionsHtml}</div>
        ${phase === 'question' && duel.marking === 'exam' ? '<button class="skip" type="button" data-action="answer" data-index="skip">Skip this question, 0 marks</button>' : ''}
        ${explain}
        ${phase === 'reveal' ? `<button class="btn btn--saffron mt-16" type="button" data-action="next-question" id="next-btn">${duel.index === 9 ? 'See the result' : 'Next question'}</button>` : ''}
      </div>
    </div>
  </div>`;
}

export function leaveSheet({ kind } = {}) {
  const what = kind === 'practice' ? 'practice set' : 'duel';
  const note = {
    practice: 'Answers you gave still count for your topic accuracy. Practice is unlimited, so you can start again any time.',
    challenge: 'The rest of the questions count as skipped and your score is final for this challenge.',
    league: 'Only your first attempt each day counts for the league, so leaving uses up today’s attempt.',
  }[kind] || 'The rest of the questions count as skipped. An unfinished duel does not count for ranks, and it still uses one of today’s free duels.';
  return `
  <div class="scrim" data-action="close-sheet">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="leave-title" data-stop>
      <div class="sheet__handle"></div>
      <h2 class="sheet__title" id="leave-title">Leave this ${what}?</h2>
      <p class="muted mt-8">${note} The clock keeps running while you decide.</p>
      <div class="btn-row mt-20">
        <button class="btn btn--line" type="button" data-action="close-sheet">Keep playing</button>
        <button class="btn btn--danger" type="button" data-action="confirm-leave">Leave</button>
      </div>
    </div>
  </div>`;
}
