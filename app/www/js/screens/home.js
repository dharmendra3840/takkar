import { esc, blobs, tabbar, icon } from '../ui.js';
import { LEVEL_LABELS, MARKING_LABELS, RIVALS, TIME_LIMITS } from '../game.js';
import { SQUAD } from '../demo.js';

export function home({ data, streak, freeLeft, freePerDay, plus, squadDone, best, accuracy, avgTime, announcements, update, duelsOn, guest }) {
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
  const banners = [
    ...announcements.map((a) => `<div class="banner mt-12" role="status"><span class="grow">${esc(a.text)}</span><button class="icon-btn icon-btn--sm" type="button" data-action="dismiss-announcement" data-id="${esc(a.id)}" aria-label="Dismiss">${icon('close')}</button></div>`),
    update ? `<button class="banner banner--update mt-12" type="button" data-action="open-url" data-url="${esc(update)}"><span class="grow"><strong>A new version of Takkar is ready.</strong> Tap to get it.</span>${icon('chevron')}</button>` : '',
    guest && data.history.length >= 3 ? '<button class="banner mt-12" type="button" data-action="go" data-to="welcome"><span class="grow">Playing as a guest: your games are on this phone only. <strong>Sign in to keep them.</strong></span></button>' : '',
  ].join('');

  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body">
      <div class="row row--between">
        <span class="eyebrow">Hi, ${name}</span>
        <span class="pill glass"><span class="pill__num">${streak}</span>day streak</span>
      </div>
      <h1 class="title mt-8">Today</h1>
      ${banners}

      <section class="feature mt-16" aria-label="Today’s duel">
        <div class="feature__glow feature__glow--a"></div><div class="feature__glow feature__glow--b"></div>
        <div class="small" style="color:#D7DBF5;font-weight:600">Today’s takkar</div>
        <h2 class="feature__title mt-8">Ten questions. One rival.</h2>
        <div class="segmented mt-16" role="group" aria-label="Topic">
          ${topicBtn('quant', 'Quant')}${topicBtn('reasoning', 'Reasoning')}${topicBtn('mixed', 'Mixed')}
        </div>
        <div class="chips mt-12">
          <button class="chip" type="button" data-action="open-settings">${LEVEL_LABELS[s.level]}, ${TIME_LIMITS[s.level]}s</button>
          <button class="chip" type="button" data-action="open-settings">${MARKING_LABELS[s.marking]}</button>
          <button class="chip" type="button" data-action="open-settings">Rival: ${RIVALS[s.rival].label} bot</button>
        </div>
        <button class="btn btn--saffron mt-16" type="button" data-action="start-duel" ${duelsOn ? '' : 'disabled'}>Start duel</button>
        <p class="small center mt-8" style="color:#D7DBF5">${freeLine}</p>
      </section>

      <button class="card glass card-link mt-12 row" type="button" data-action="go" data-to="challenge-entry">
        <span class="avatar avatar--saffron">${icon('code')}</span>
        <span class="grow"><span class="card__title" style="display:block">Have a challenge code?</span><span class="small muted">Play a friend’s ten questions and beat their score</span></span>
        ${icon('chevron')}
      </button>

      <button class="card tint card-link mt-12" type="button" data-action="go" data-to="${data.league ? 'league' : 'league'}">
        <div class="row row--between"><span class="card__title">${data.league ? esc(data.league.channel) + ' League' : 'Educator league demo'}</span><span style="font-weight:600;font-size:15px;color:#2A3BE8">Open</span></div>
        <p class="small muted">${data.league ? 'Today’s daily duel is ready' : 'See a channel’s private league in 60 seconds'}</p>
      </button>

      <button class="card tint card-link mt-12" type="button" data-action="go" data-to="squad">
        <div class="row row--between"><span class="card__title">${SQUAD.name} mission</span><span style="font-weight:600;font-size:15px;color:#2A3BE8">Open</span></div>
        <p class="small muted">${SQUAD.target} correct answers together this week</p>
        <div class="progress mt-8"><div class="progress__bar" style="width:${Math.min(100, Math.round((squadDone / SQUAD.target) * 100))}%"></div></div>
      </button>

      <div class="stats mt-12">
        <div class="stat tint"><div class="stat__label">Best score</div><div class="stat__value">${best ?? '–'}</div></div>
        <div class="stat tint"><div class="stat__label">Accuracy</div><div class="stat__value">${accuracy ?? '–'}</div></div>
        <div class="stat tint"><div class="stat__label">Avg time</div><div class="stat__value">${avgTime ?? '–'}</div></div>
      </div>
    </div>
    ${tabbar('home')}
  </div>`;
}

export function settingsSheet(s) {
  const pick = (group, value, label, sub) => `<button type="button" data-action="set-setting" data-group="${group}" data-value="${value}" aria-pressed="${s[group] === value}">${label}${sub ? `<small>${sub}</small>` : ''}</button>`;
  return `
  <div class="scrim" data-action="close-sheet">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title" data-stop>
      <div class="sheet__handle"></div>
      <h2 class="sheet__title" id="settings-title">Duel settings</h2>
      <h3>Level</h3>
      <div class="option-grid">
        ${pick('level', 'easy', 'Easy', '20 seconds')}${pick('level', 'exam', 'Exam level', '30 seconds')}${pick('level', 'hard', 'Hard', '35 seconds')}
      </div>
      <h3>Marking</h3>
      <div class="option-grid option-grid--2">
        ${pick('marking', 'exam', 'Exam marking', '+4, −1, skip 0')}${pick('marking', 'speed', 'Speed duel', '10 + speed bonus')}
      </div>
      <h3>Rival bot</h3>
      <div class="option-grid">
        ${pick('rival', 'relaxed', 'Relaxed', 'about 55% right')}${pick('rival', 'steady', 'Steady', 'about 70% right')}${pick('rival', 'sharp', 'Sharp', 'about 85% right')}
      </div>
      <p class="small muted mt-16">Weekly ranks count exam level duels with exam marking, your best 3 each day.</p>
      <button class="btn btn--cobalt mt-16" type="button" data-action="close-sheet">Done</button>
    </div>
  </div>`;
}
