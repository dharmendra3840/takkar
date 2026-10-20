// Takkar prototype app: navigation, duel loop and actions.
import { store, freeDuelsLeft, recordStreakDay, liveStreak, weeklyTotal, rankedDuelsToday, correctThisWeek, topicStats, bestScore } from './store.js';
import { createDuel, startQuestion, answerQuestion, nextQuestion, abandonDuel, toHistory, RIVALS } from './game.js';
import { encodeChallenge, decodeChallenge } from './code.js';
import { squadMembers, weeklyBoard, leagueCode, leagueDailySeed, leagueTable, leagueReport, SQUAD } from './demo.js';
import { istDay, weekStart, msUntilNextIstDay } from './time.js';
import { hashString } from './engine/rng.js';
import { nicknameError, leagueNameError } from './validate.js';
import { esc, num, toast, shareText, copyText, openExternal, onBackButton, exitApp, vibrate } from './ui.js';
import { welcome } from './screens/welcome.js';
import { home, settingsSheet } from './screens/home.js';
import { duelScreen, leaveSheet, collisionShare } from './screens/duel.js';
import { resultScreen } from './screens/result.js';
import { challengeEntry } from './screens/challenge.js';
import { leagueIntro, leagueScreen } from './screens/league.js';
import { squadScreen, ranksScreen } from './screens/social.js';
import { plusScreen, profileScreen, deleteSheet } from './screens/account.js';

const app = document.getElementById('app');
const TERMS_VERSION = '2026-10-prototype';
const TABS = ['home', 'league', 'squad', 'ranks', 'profile'];

const state = {
  screen: 'welcome',
  stack: [],
  sheet: null,
  duel: null,
  phase: 'question',
  last: null,
  flagged: false,
  resultCode: '',
  leagueNote: '',
  challengeDraft: { codeText: '', error: '', challenge: null },
  pendingChallenge: null,
  leagueDraft: { name: '', error: '' },
  plusReason: '',
  welcomeTried: false,
};

let ticker = null;
const data = () => store.get();

// ---------- Rendering ----------

function view() {
  const d = data();
  switch (state.screen) {
    case 'welcome':
      return welcome({ pendingChallenge: state.pendingChallenge });
    case 'home': {
      const stats = topicStats();
      const all = Object.values(stats).reduce((a, s) => ({ right: a.right + s.right, answered: a.answered + s.answered, timeMs: a.timeMs + s.timeMs }), { right: 0, answered: 0, timeMs: 0 });
      return home({
        data: d,
        streak: liveStreak(),
        freeLeft: freeDuelsLeft(),
        squadDone: squadMembers(d.profile.nickname, correctThisWeek()).reduce((s, m) => s + m.right, 0),
        best: bestScore(),
        accuracy: all.answered ? `${Math.round((all.right / all.answered) * 100)}%` : null,
        avgTime: all.answered ? `${(all.timeMs / all.answered / 1000).toFixed(1)}s` : null,
      });
    }
    case 'duel': {
      const elapsed = Date.now() - state.duel.questionStartedAt;
      const bot = state.duel.bot?.[state.duel.index];
      return duelScreen({
        duel: state.duel,
        phase: state.phase,
        last: state.last,
        timeLeft: Math.max(0, state.duel.limitMs - elapsed),
        botLocked: !!bot && elapsed >= bot.timeMs,
        flagged: state.flagged,
      });
    }
    case 'result':
      return resultScreen({ duel: state.duel, code: state.resultCode, leagueNote: state.leagueNote });
    case 'challenge-entry':
      return challengeEntry(state.challengeDraft);
    case 'league': {
      if (!d.league) return leagueIntro(state.leagueDraft);
      const code = d.league.code;
      const week = weekStart();
      const firsts = d.history.filter((h) => h.kind === 'league' && h.leagueCode === code && h.counted && weekStart(h.day) === week);
      const yourDays = firsts.map((h) => ({ day: h.day, score: h.score }));
      return leagueScreen({
        league: d.league,
        played: firsts.find((h) => h.day === istDay()) || null,
        table: leagueTable(code, d.profile.nickname, yourDays),
        report: leagueReport(code, yourDays),
        msLeft: msUntilNextIstDay(),
      });
    }
    case 'squad': {
      const members = squadMembers(d.profile.nickname, correctThisWeek());
      return squadScreen({ members, done: members.reduce((s, m) => s + m.right, 0), daysLeft: 6 - (istDay() - weekStart()) });
    }
    case 'ranks':
      return ranksScreen({ board: weeklyBoard(d.profile.nickname, weeklyTotal()), rankedToday: rankedDuelsToday() });
    case 'plus':
      return plusScreen({ plus: d.plus, reason: state.plusReason });
    case 'profile': {
      const stats = topicStats();
      const finished = d.history.filter((h) => h.status === 'finished');
      const squadDone = squadMembers(d.profile.nickname, correctThisWeek()).reduce((s, m) => s + m.right, 0);
      return profileScreen({
        data: d,
        streak: liveStreak(),
        stats,
        badges: [
          { label: 'First win', icon: '1', earned: finished.some((h) => h.verdict === 'won') },
          { label: '7-day streak', icon: '7', earned: d.streak.best >= 7 },
          { label: 'Squad mission', icon: '30', earned: squadDone >= SQUAD.target },
          { label: 'Ten of ten', icon: '10', earned: finished.some((h) => h.right === 10) },
        ],
      });
    }
    default:
      return '';
  }
}

function sheetView() {
  if (state.sheet === 'settings') return settingsSheet(data().settings);
  if (state.sheet === 'leave') return leaveSheet();
  if (state.sheet === 'delete') return deleteSheet();
  return '';
}

function render({ keepScroll = false } = {}) {
  const y = window.scrollY;
  app.innerHTML = view() + sheetView();
  if (keepScroll) window.scrollTo(0, y);
  if (state.sheet) app.querySelector('.sheet button, .sheet input')?.focus();
}

function go(screen, { replace = false, reset = false } = {}) {
  stopTicker();
  if (reset || TABS.includes(screen)) state.stack = [];
  else if (!replace && state.screen !== screen) state.stack.push(state.screen);
  state.screen = screen;
  state.sheet = null;
  render();
  window.scrollTo(0, 0);
}

function back() {
  if (state.sheet) { state.sheet = null; render({ keepScroll: true }); return; }
  if (state.screen === 'duel' && state.duel?.status === 'playing') { openLeave(); return; }
  if (state.screen === 'result') { go('home', { reset: true }); return; }
  const prev = state.stack.pop();
  if (prev && prev !== 'duel') { state.screen = prev; render(); window.scrollTo(0, 0); return; }
  if (state.screen !== 'home' && data().profile) { go('home', { reset: true }); return; }
  exitApp();
}

// ---------- Duel loop ----------

function stopTicker() {
  clearInterval(ticker);
  ticker = null;
}

function tick() {
  const duel = state.duel;
  if (!duel || state.screen !== 'duel' || state.phase !== 'question') return stopTicker();
  const elapsed = Date.now() - duel.questionStartedAt;
  const left = duel.limitMs - elapsed;
  if (left <= 0) { submitAnswer('timeout'); return; }
  const timer = document.getElementById('timer');
  if (timer) {
    timer.textContent = `${Math.ceil(left / 1000)}s`;
    timer.classList.toggle('timer--low', left <= 5000);
  }
  const bar = document.getElementById('time-bar');
  if (bar) bar.style.width = `${Math.round((left / duel.limitMs) * 100)}%`;
  const bot = duel.bot?.[duel.index];
  const status = document.getElementById('rival-status');
  if (status && bot) status.textContent = elapsed >= bot.timeMs ? 'Rival locked in' : 'Rival is thinking';
}

function beginQuestion() {
  state.phase = 'question';
  state.last = null;
  state.flagged = false;
  startQuestion(state.duel);
  render();
  window.scrollTo(0, 0);
  stopTicker();
  ticker = setInterval(tick, 250);
}

function startDuel(options) {
  const d = data();
  state.duel = createDuel({ playerKey: d.profile.nickname.toLowerCase(), ...options });
  state.leagueNote = '';
  state.stack = [];
  state.screen = 'duel';
  state.sheet = null;
  beginQuestion();
}

function requireFreeDuel() {
  if (freeDuelsLeft() > 0) return true;
  // PLUS-08: the fourth free duel shows Plus, never a dead end.
  state.plusReason = 'You have used today’s 3 free duels. Come back tomorrow, or try Plus.';
  go('plus');
  return false;
}

function startSoloDuel() {
  if (!requireFreeDuel()) return;
  const s = data().settings;
  startDuel({ kind: 'solo', topic: s.topic, level: s.level, marking: s.marking, rival: s.rival });
}

function submitAnswer(choice) {
  if (state.phase !== 'question' || !state.duel) return;
  stopTicker();
  state.last = answerQuestion(state.duel, choice);
  state.phase = 'reveal';
  vibrate(state.last.correct ? 15 : 40);
  render();
  document.getElementById('next-btn')?.focus({ preventScroll: true });
}

function nextOrFinish() {
  nextQuestion(state.duel);
  if (state.duel.status === 'finished') finishDuel();
  else beginQuestion();
}

function finishDuel() {
  stopTicker();
  const duel = state.duel;
  const d = data();
  let firstLeagueAttempt = true;
  if (duel.kind === 'league') {
    firstLeagueAttempt = !d.history.some((h) => h.kind === 'league' && h.leagueCode === duel.league.code && h.day === duel.day && h.counted);
    state.leagueNote = firstLeagueAttempt
      ? 'Your first attempt today counts for the league table.'
      : 'Only your first attempt at each daily duel counts, so this one does not change the table.';
  }
  const record = toHistory(duel, { firstLeagueAttempt });
  store.update((s) => {
    s.history.push(record);
    if (s.history.length > 500) s.history.splice(0, s.history.length - 500);
    if (duel.status === 'finished') recordStreakDay(duel.day);
  });
  state.resultCode = duel.status === 'finished'
    ? encodeChallenge({ seed: duel.seed, topic: duel.topic, level: duel.level, marking: duel.marking, score: duel.you, nickname: d.profile.nickname })
    : '';
  state.screen = 'result';
  state.stack = [];
  state.sheet = null;
  render();
  window.scrollTo(0, 0);
}

function openLeave() {
  state.sheet = 'leave';
  render({ keepScroll: true });
}

// ---------- Actions ----------

const actions = {
  go: (el) => go(el.dataset.to),
  back: () => back(),
  toast: (el) => toast(el.dataset.text),
  'open-url': (el) => openExternal(el.dataset.url),
  'close-sheet': () => { state.sheet = null; render({ keepScroll: true }); if (state.screen === 'duel' && state.phase === 'question' && !ticker) ticker = setInterval(tick, 250); },

  'welcome-start': () => {
    const form = app.querySelector('[data-form="welcome"]');
    const nick = form.nick.value.trim();
    const error = nicknameError(nick);
    state.welcomeTried = true;
    if (error || !form.age.checked) {
      app.querySelector('#nick-error').textContent = error || '';
      if (!form.age.checked && !error) toast('Please confirm you are 18 or older.');
      return;
    }
    const now = new Date().toISOString();
    store.update((s) => {
      s.profile = { nickname: nick, ageConfirmedAt: now, termsVersion: TERMS_VERSION, createdAt: now };
    });
    if (state.pendingChallenge) {
      state.challengeDraft = { codeText: '', error: '', challenge: state.pendingChallenge };
      state.pendingChallenge = null;
      go('challenge-entry', { reset: true });
      return;
    }
    // UX-08: straight into the first duel.
    startSoloDuel();
  },

  'set-topic': (el) => { store.update((s) => { s.settings.topic = el.dataset.value; }); render({ keepScroll: true }); },
  'open-settings': () => { state.sheet = 'settings'; render({ keepScroll: true }); },
  'set-setting': (el) => { store.update((s) => { s.settings[el.dataset.group] = el.dataset.value; }); render({ keepScroll: true }); },
  'start-duel': () => startSoloDuel(),
  'quick-ranked': () => {
    store.update((s) => { s.settings.level = 'exam'; s.settings.marking = 'exam'; });
    startSoloDuel();
  },

  answer: (el) => submitAnswer(el.dataset.index === 'skip' ? null : Number(el.dataset.index)),
  'next-question': () => nextOrFinish(),
  'leave-duel': () => { if (state.phase === 'question') stopTicker(); openLeave(); },
  'confirm-leave': () => {
    abandonDuel(state.duel);
    state.sheet = null;
    finishDuel();
  },
  flag: () => {
    const q = state.duel.questions[state.duel.index];
    store.update((s) => { s.flags.push({ at: new Date().toISOString(), type: q.type, text: q.text }); });
    state.flagged = true;
    render({ keepScroll: true });
    toast('Thanks. The question goes to review.');
  },

  rematch: () => {
    const prev = state.duel;
    if (!requireFreeDuel()) return;
    startDuel({ kind: 'rematch', seed: prev.seed, topic: prev.topic, level: prev.level, marking: prev.marking, rival: prev.rival });
  },
  'copy-code': () => copyText(state.resultCode),
  'share-code': () => {
    const d = state.duel;
    shareText({
      title: 'Takkar challenge',
      text: `I scored ${num(d.you)} in a Takkar duel. Same ten questions, can you beat me?\nOpen Takkar, tap "Have a challenge code?" and paste:\n${state.resultCode}`,
      url: 'https://takkar.info',
    });
  },

  'paste-code': async () => {
    let text = '';
    try {
      const clip = window.Capacitor?.Plugins?.Clipboard;
      text = clip ? (await clip.read()).value : await navigator.clipboard.readText();
    } catch { /* clipboard blocked */ }
    if (!text) { toast('Nothing to paste. Long-press the box to paste instead.'); return; }
    state.challengeDraft = { codeText: text.trim(), error: '', challenge: null };
    actions['check-code']();
  },
  'check-code': () => {
    const input = app.querySelector('#code');
    const text = input ? input.value : state.challengeDraft.codeText;
    const result = decodeChallenge(text);
    state.challengeDraft = result.ok
      ? { codeText: text, error: '', challenge: result.challenge }
      : { codeText: text, error: result.reason, challenge: null };
    render();
  },
  'clear-challenge': () => { state.challengeDraft = { codeText: '', error: '', challenge: null }; render(); },
  'play-challenge': () => {
    const c = state.challengeDraft.challenge;
    if (!data().profile) { state.pendingChallenge = c; go('welcome', { reset: true }); return; }
    startDuel({ kind: 'challenge', seed: c.seed, topic: c.topic, level: c.level, marking: c.marking, challenge: c });
  },

  'create-league': () => {
    const input = app.querySelector('#channel');
    const name = (input?.value || '').trim();
    const error = leagueNameError(name);
    if (error) { state.leagueDraft = { name, error }; render(); return; }
    store.update((s) => { s.league = { channel: name, code: leagueCode(name), createdAt: new Date().toISOString() }; });
    state.leagueDraft = { name: '', error: '' };
    render();
    window.scrollTo(0, 0);
    toast(`${name} League is ready`);
  },
  'play-league': () => {
    const l = data().league;
    startDuel({ kind: 'league', seed: leagueDailySeed(l.code), topic: 'mixed', level: 'exam', marking: 'exam', rival: 'steady', league: l });
  },
  'copy-league': () => copyText(data().league.code),
  'share-league': () => {
    const l = data().league;
    shareText({
      title: `${l.channel} League on Takkar`,
      text: `Join the ${l.channel} League on Takkar: one 4-minute quiz duel a day, the same questions for everyone, and a weekly table.\nLeague code: ${l.code}\nFor aspirants aged 18 and over.`,
      url: 'https://takkar.info',
    });
  },
  'close-league': () => {
    store.update((s) => { s.league = null; });
    render();
    toast('Demo league closed');
  },

  react: (el) => {
    store.update((s) => { s.reactions.push({ at: new Date().toISOString(), reaction: el.dataset.value }); });
    vibrate();
    toast(`Sent “${el.dataset.value}” to ${SQUAD.name}`);
  },
  'invite-squad': () => {
    const code = (hashString(`squad-invite:${data().profile.nickname}`) % 900000 + 100000).toString();
    shareText({
      title: `Join ${SQUAD.name} on Takkar`,
      text: `Join my Takkar squad ${SQUAD.name}: we do a weekly mission together. Squad code: SQ-${code}`,
      url: 'https://takkar.info',
    });
  },

  'plus-on': () => {
    store.update((s) => { s.plus = { demo: true, since: new Date().toISOString() }; });
    state.plusReason = '';
    toast('Plus is on in demo mode');
    back();
  },
  'plus-off': () => { store.update((s) => { s.plus = null; }); render(); toast('Demo Plus turned off'); },

  'export-data': () => shareText({ title: 'My Takkar data', text: store.exportJson() }),
  'report-problem': () => {
    const body = encodeURIComponent(`What happened:\n\n\nApp: Takkar prototype 0.1\nDevice: ${navigator.userAgent.replace(/\(.*?\)/, '').trim().slice(0, 80)}`);
    openExternal(`mailto:support@takkar.info?subject=${encodeURIComponent('Problem in the Takkar app')}&body=${body}`);
  },
  'ask-delete': () => { state.sheet = 'delete'; render({ keepScroll: true }); },
  'confirm-delete': () => {
    store.wipe();
    state.sheet = null;
    state.duel = null;
    toast('Your account and data are deleted');
    go('welcome', { reset: true });
  },
};

app.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target || !app.contains(target)) return;
  // A click inside a sheet must not close it through the scrim behind.
  if (target.classList.contains('scrim') && event.target.closest('[data-stop]')) return;
  const fn = actions[target.dataset.action];
  if (fn) {
    event.preventDefault();
    fn(target, event);
  }
});

app.addEventListener('input', (event) => {
  const el = event.target;
  const kind = el.dataset.input;
  if (kind === 'nick' || kind === 'age') {
    const form = app.querySelector('[data-form="welcome"]');
    const nick = form.nick.value.trim();
    const error = nicknameError(nick);
    const showError = nick.length >= 3 || state.welcomeTried;
    app.querySelector('#nick-error').textContent = showError ? error : '';
    app.querySelector('#welcome-start').disabled = !!error || !form.age.checked;
  }
  if (kind === 'channel') state.leagueDraft.name = el.value;
  if (kind === 'code') state.challengeDraft.codeText = el.value;
});

app.addEventListener('change', (event) => {
  if (event.target.dataset.input === 'reminders') {
    const on = event.target.checked;
    store.update((s) => { s.settings.reminders = on; });
    toast(on ? 'Saved. Reminders arrive in the full app; this prototype sends none.' : 'Daily reminder off');
  }
});

app.addEventListener('submit', (event) => event.preventDefault());

// DUEL-03: keys A to D or 1 to 4; S to skip in exam marking; Enter for next.
document.addEventListener('keydown', (event) => {
  if (state.screen !== 'duel' || state.sheet || event.target.matches('input, textarea')) return;
  const key = event.key.toLowerCase();
  if (state.phase === 'question') {
    const index = 'abcd'.indexOf(key) >= 0 ? 'abcd'.indexOf(key) : '1234'.indexOf(key);
    if (index >= 0) { event.preventDefault(); submitAnswer(index); }
    else if (key === 's' && state.duel.marking === 'exam') { event.preventDefault(); submitAnswer(null); }
  } else if (key === 'enter' || key === ' ') {
    event.preventDefault();
    nextOrFinish();
  }
});

onBackButton(() => back());

// Time keeps running while the app is in the background, as it would on the server.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.screen === 'duel' && state.phase === 'question') tick();
});

// ---------- Visual quality (UX-04, UX-05) ----------

// Start in light mode; turn on glass only if this phone draws frames smoothly.
// The result is remembered so the check runs once per phone.
const GLASS_KEY = 'takkar.glass';
function measureGlass() {
  let saved = null;
  try { saved = localStorage.getItem(GLASS_KEY); } catch { /* storage blocked */ }
  if (saved === 'on') { document.documentElement.classList.remove('lite'); return; }
  if (saved === 'off') return;
  const reduce = matchMedia('(prefers-reduced-transparency: reduce), (prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  // Try glass and time 20 frames that each repaint the whole screen (an invisible
  // one-step change to the screen background), so the blur cost is really measured. Keep glass
  // only if the median frame takes 20 ms or less (50 fps, UX-04).
  const root = document.documentElement;
  root.classList.remove('lite');
  const frames = [];
  let last = 0;
  const step = (now) => {
    if (last) frames.push(now - last);
    last = now;
    root.style.setProperty('--mist', frames.length % 2 ? '#ECEFF8' : '#ECEFF9');
    if (frames.length < 20) { requestAnimationFrame(step); return; }
    root.style.removeProperty('--mist');
    frames.sort((a, b) => a - b);
    const smooth = frames[10] <= 20;
    if (!smooth) root.classList.add('lite');
    try { localStorage.setItem(GLASS_KEY, smooth ? 'on' : 'off'); } catch { /* storage blocked */ }
  };
  requestAnimationFrame(step);
}

// ---------- Start ----------

state.screen = data().profile ? 'home' : 'welcome';
render();
// Keep the Takkar splash up until the browser reports the first screen is on
// display (first contentful paint), so a slow phone shows the logo, never an
// empty screen. A 12-second limit makes sure the splash always goes.
let splashHidden = false;
const hideSplash = () => {
  if (splashHidden) return;
  splashHidden = true;
  window.Capacitor?.Plugins?.SplashScreen?.hide({ fadeOutDuration: 250 });
};
try {
  new PerformanceObserver((list, observer) => {
    if (list.getEntries().some((e) => e.name === 'first-contentful-paint')) {
      observer.disconnect();
      setTimeout(hideSplash, 150);
    }
  }).observe({ type: 'paint', buffered: true });
} catch {
  requestAnimationFrame(() => requestAnimationFrame(hideSplash));
}
setTimeout(hideSplash, 12000);
// Measure after the first screen is up, so it never delays the first paint.
setTimeout(measureGlass, 1200);
