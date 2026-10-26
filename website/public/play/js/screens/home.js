import { esc, blobs, tabbar, icon, num } from '../ui.js?v=8f7566fc69';
import { HERE, IS_NATIVE } from '../config.js?v=8f7566fc69';
import { LEVEL_LABELS, MARKING_LABELS, RIVALS, TIME_LIMITS } from '../game.js?v=8f7566fc69';
import { markingLabel, quantName } from '../exams.js?v=8f7566fc69';

/** Days until the 1st of the exam month (the exact date comes with the official notice). */
function countdown(exam, month) {
  if (!exam || !month) return '';
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const days = Math.ceil((start - Date.now()) / 86400000);
  const label = start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  if (days < -31) return '';
  const left = days > 0 ? `${days} days to go` : 'This month. All the best!';
  return `<button class="countdown mt-12" type="button" data-action="change-exam" aria-label="${esc(exam.short)}, ${esc(label)}: ${left} Change exam or date">
    <span><span class="countdown__label">${esc(exam.name)} · ${esc(label)}</span><span class="countdown__days" style="display:block;margin-top:4px">${left}</span></span>
    ${icon('chevron')}</button>`;
}
import { SQUAD } from '../demo.js?v=8f7566fc69';

/** Today's goal: duels, challenges, practice sets and mocks all count. */
function goalLine(goal, done) {
  if (!goal) return '';
  const met = done >= goal;
  return `<div class="goal-line mt-12" role="status">
    <span class="goal-line__text">${met ? `${icon('check')} Today’s goal done: ${done} of ${goal}` : `Today’s goal: <strong>${done} of ${goal}</strong>`}</span>
    <span class="goal-line__bar" aria-hidden="true"><span style="width:${Math.min(100, Math.round((done / goal) * 100))}%"></span></span>
  </div>`;
}

export function home({ data, streak, freeLeft, freePerDay, plus, squadDone, best, accuracy, avgTime, announcements, update, duelsOn, guest, signInReady, exam, examMonth, goal, goalDone }) {
  const s = data.settings;
  const name = esc(data.profile.nickname);
  const topicBtn = (id, label) => `<button type="button" data-action="set-topic" data-value="${id}" aria-pressed="${s.topic === id}">${label}</button>`;
  const freeLine = !duelsOn
    ? 'Duels are paused for a short while. Please check back soon.'
    : plus
      ? `${data.plus ? 'Plus (demo)' : 'Plus'}: unlimited duels`
      : freeLeft > 0
        ? `${freeLeft} of ${freePerDay} free duels left today`
        : 'Free duels used for today';
  const topBanners = [
    ...announcements.map((a) => `<div class="banner mt-12" role="status"><span class="grow">${esc(a.text)}</span><button class="icon-btn icon-btn--sm" type="button" data-action="dismiss-announcement" data-id="${esc(a.id)}" aria-label="Dismiss">${icon('close')}</button></div>`),
    update ? `<button class="banner banner--update mt-12" type="button" data-action="open-url" data-url="${esc(update)}"><span class="grow"><strong>A new version of Takkar is ready.</strong> Tap to get it.</span>${icon('chevron')}</button>` : '',
  ].join('');
  // Guests: a sign-in nudge once sign-in works; until then, one honest note they can dismiss.
  // It sits under the duel card, so "Start duel" stays in view on small phones.
  const guestNote = [
    guest && data.history.length >= 3 && signInReady ? `<button class="banner mt-12" type="button" data-action="go" data-to="welcome"><span class="grow">Playing as a guest: your games are on ${HERE} only. <strong>Sign in to keep them.</strong></span></button>` : '',
    guest && data.history.length >= 3 && !signInReady && !data.guestNoteSeen ? `<div class="banner mt-12" role="note"><span class="grow">Your games are saved on ${HERE} only, so clearing ${IS_NATIVE ? 'the app’s data' : 'this site’s data'} removes them. Sign-in, to keep them on any device, is coming soon.</span><button class="icon-btn icon-btn--sm" type="button" data-action="dismiss-guest-note" aria-label="Dismiss">${icon('close')}</button></div>` : '',
  ].join('');

  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body">
      <div class="row row--between">
        <span class="eyebrow">Hi, ${name}${exam ? ` · <button class="link-btn" type="button" data-action="change-exam" style="padding:0;min-height:0;font-size:inherit">${esc(exam.short)}</button>` : ''}</span>
        <span class="pill glass"><span class="pill__num">${streak}</span>day streak</span>
      </div>
      <h1 class="title title--today mt-8">Today</h1>

      <div class="dgrid dgrid--home">
      <div class="home-side ga-s">
        ${countdown(exam, examMonth)}
        ${goal ? goalLine(goal, goalDone) : `<button class="goal-line goal-line--set mt-12" type="button" data-action="change-goal"><span class="goal-line__text">Set a daily goal</span><span class="goal-line__hint">1, 3 or 5 a day</span>${icon('chevron')}</button>`}
        ${topBanners}
      </div>
      <section class="feature mt-16 ga-a" aria-label="Today’s duel">
        <div class="feature__glow feature__glow--a"></div><div class="feature__glow feature__glow--b"></div>
        <div class="small" style="color:#D7DBF5;font-weight:600">Today’s takkar</div>
        <h2 class="feature__title mt-8">Ten questions. One rival.</h2>
        ${exam ? `<p class="small mt-8" style="color:#D7DBF5">${esc(exam.short)} pattern: ${markingLabel(exam)}, ${exam.seconds} s a question</p>` : ''}
        <div class="segmented mt-16" role="group" aria-label="Topic">
          ${topicBtn('quant', quantName(exam))}${topicBtn('reasoning', 'Reasoning')}${topicBtn('mixed', 'Mixed')}
        </div>
        <div class="chips mt-12">
          <button class="chip" type="button" data-action="open-settings">${LEVEL_LABELS[s.level]}${exam ? '' : `, ${TIME_LIMITS[s.level]}s`}</button>
          <button class="chip" type="button" data-action="open-settings">${MARKING_LABELS[s.marking]}</button>
          <button class="chip" type="button" data-action="open-settings">Rival: ${RIVALS[s.rival].label} bot</button>
        </div>
        <button class="btn btn--saffron mt-16" type="button" data-action="start-duel" ${duelsOn ? '' : 'disabled'}>Start duel</button>
        <p class="small center mt-8" style="color:#D7DBF5">${freeLine}</p>
      </section>

      ${guestNote ? `<div class="home-notes ga-n">${guestNote}</div>` : ''}

      <button class="card glass card-link mt-12 row ga-b" type="button" data-action="go" data-to="challenge-entry">
        <span class="avatar avatar--saffron">${icon('code')}</span>
        <span class="grow"><span class="card__title" style="display:block">Have a challenge code?</span><span class="small muted">Play a friend’s ten questions and beat their score</span></span>
        ${icon('chevron')}
      </button>

      <button class="card tint card-link mt-12 ga-c" type="button" data-action="go" data-to="league">
        <div class="row row--between"><span class="card__title">${data.league ? esc(data.league.channel) + ' League' : 'Educator league demo'}</span><span style="font-weight:600;font-size:15px;color:#2A3BE8">Open</span></div>
        <p class="small muted">${data.league ? 'Today’s daily duel is ready' : 'See a channel’s private league in 60 seconds'}</p>
      </button>

      <button class="card tint card-link mt-12 ga-d" type="button" data-action="go" data-to="squad">
        <div class="row row--between"><span class="card__title">Squad demo: ${SQUAD.name}</span><span style="font-weight:600;font-size:15px;color:#2A3BE8">Open</span></div>
        <p class="small muted">${SQUAD.target} correct answers together this week, with sample squad mates</p>
        <div class="progress mt-8"><div class="progress__bar" style="width:${Math.min(100, Math.round((squadDone / SQUAD.target) * 100))}%"></div></div>
      </button>

      <div class="stats mt-12 ga-e">
        <div class="stat tint"><div class="stat__label">Best score</div><div class="stat__value">${best === null || best === undefined ? '–' : num(best)}</div></div>
        <div class="stat tint"><div class="stat__label">Accuracy</div><div class="stat__value">${accuracy ?? '–'}</div></div>
        <div class="stat tint"><div class="stat__label">Avg time</div><div class="stat__value">${avgTime ?? '–'}</div></div>
      </div>
      </div>
    </div>
    ${tabbar('home')}
  </div>`;
}

export function settingsSheet(s, exam = null) {
  const pick = (group, value, label, sub) => `<button type="button" data-action="set-setting" data-group="${group}" data-value="${value}" aria-pressed="${s[group] === value}">${label}${sub ? `<small>${sub}</small>` : ''}</button>`;
  return `
  <div class="scrim" data-action="close-sheet">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title" data-stop>
      <div class="sheet__handle"></div>
      <h2 class="sheet__title" id="settings-title">Duel settings</h2>
      <h3>Level</h3>
      <div class="option-grid">
        ${exam
          ? `${pick('level', 'easy', 'Easier', 'basic questions')}${pick('level', 'exam', 'Exam level', `like ${esc(exam.short)}`)}${pick('level', 'hard', 'Harder', 'tougher ones')}`
          : `${pick('level', 'easy', 'Easier', '20 seconds')}${pick('level', 'exam', 'Exam level', '30 seconds')}${pick('level', 'hard', 'Harder', '35 seconds')}`}
      </div>
      <h3>Marking</h3>
      <div class="option-grid option-grid--2">
        ${pick('marking', 'exam', 'Exam marking', exam ? `${markingLabel(exam)}, skip 0` : '+4, −1, skip 0')}${pick('marking', 'speed', 'Speed duel', '10 + speed bonus')}
      </div>
      <h3>Rival bot</h3>
      <div class="option-grid">
        ${pick('rival', 'relaxed', 'Relaxed', 'about 55% right')}${pick('rival', 'steady', 'Steady', 'about 70% right')}${pick('rival', 'sharp', 'Sharp', 'about 85% right')}
      </div>
      <p class="small muted mt-16">${exam ? `Every question has ${exam.seconds} seconds, as in ${esc(exam.short)}. ` : ''}Weekly ranks count exam level duels with exam marking, your best 3 each day.</p>
      <button class="btn btn--cobalt mt-16" type="button" data-action="close-sheet">Done</button>
    </div>
  </div>`;
}
