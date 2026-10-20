// Takkar app: navigation, sign-in, the duel loop, actions, and keeping in step with the server.
import { store, signedIn, hasPlus, freeDuelsLeft, freeDuelsPerDay, recordStreakDay, liveStreak, weeklyTotal, rankedDuelsToday, correctThisWeek, topicStats, bestScore } from './store.js';
import { createDuel, startQuestion, answerQuestion, nextQuestion, abandonDuel, toHistory } from './game.js';
import { encodeChallenge, decodeChallenge } from './code.js';
import { squadMembers, weeklyBoard, leagueCode, leagueDailySeed, leagueTable, leagueReport, SQUAD } from './demo.js';
import { istDay, weekStart, msUntilNextIstDay } from './time.js';
import { nicknameError, leagueNameError } from './validate.js';
import { esc, num, toast, shareText, copyText, openExternal, onBackButton, exitApp, vibrate } from './ui.js';
import { APP_VERSION, APP_BUILD, TERMS_VERSION } from './config.js';
import { api, problem, setSessionToken } from './api.js';
import { signInAvailable, googleSignIn, sendPhoneCode, confirmPhoneCode, firebaseSignOut } from './auth.js';
import { refreshConfig, refreshAccount, syncDuels, flushOutbox, sendOrQueue, completeSignIn, signOutHere } from './sync.js';
import { playIntro } from './intro.js';
import { welcome } from './screens/welcome.js';
import { phoneScreen, profileSetup, pausedScreen, updateScreen, blockedScreen, reportSheet } from './screens/signin.js';
import { home, settingsSheet } from './screens/home.js';
import { duelScreen, leaveSheet } from './screens/duel.js';
import { resultScreen } from './screens/result.js';
import { challengeEntry } from './screens/challenge.js';
import { leagueIntro, leagueScreen } from './screens/league.js';
import { squadScreen, ranksScreen, featureOff } from './screens/social.js';
import { plusScreen, profileScreen, deleteSheet, signOutSheet } from './screens/account.js';

const app = document.getElementById('app');
const TABS = ['home', 'league', 'squad', 'ranks', 'profile'];
const BETA_URL = 'https://takkar.vercel.app/beta';

const emptyChallenge = () => ({ codeText: '', error: '', challenge: null });
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
  challengeDraft: emptyChallenge(),
  pendingChallenge: null,
  leagueDraft: { name: '', error: '' },
  plusReason: '',
  welcomeTried: false,
  auth: { busy: null, error: '' }, // welcome screen
  phone: { step: 'number', number: '', verificationId: null, error: '', busy: false, resendAt: 0 },
  setup: { mode: 'guest', provider: null, idToken: null, nickname: '', error: '', busy: false },
  report: { kind: 'app_problem', details: '', nickname: '', error: '', busy: false },
  blocked: null, // { code, message, until } from the server
};

let ticker = null;
let resendTimer = null;
let lastSheet = null;
const data = () => store.get();
const config = () => data().config;

// ---------- What the admin controls ----------

const isPaused = () => config()?.paused === true;
const mustUpdate = () => !!config() && APP_BUILD < (config().app?.minBuild ?? 1);
const updateUrl = () => config()?.app?.updateUrl || BETA_URL;
const updateAvailable = () => !!config() && APP_BUILD < (config().app?.latestBuild ?? 1);
const switchOn = (name) => config()?.switches?.[name] !== false;
const pausedTemplates = () => config()?.pausedTemplates || [];
const announcements = () => (config()?.announcements || []).filter((a) => !data().seenAnnouncements.includes(a.id));

// ---------- Rendering ----------

function view() {
  const d = data();
  // Screens the admin can put in front of everything (the duel in progress finishes first).
  if (state.screen !== 'duel' && state.screen !== 'result') {
    if (mustUpdate()) return updateScreen({ url: updateUrl() });
    if (isPaused()) return pausedScreen();
    if (state.blocked) return blockedScreen(state.blocked);
  }
  switch (state.screen) {
    case 'welcome':
      return welcome({ pendingChallenge: state.pendingChallenge, signInReady: signInAvailable(config()), busy: state.auth.busy, error: state.auth.error });
    case 'phone':
      return phoneScreen({ ...state.phone, resendIn: Math.max(0, Math.ceil((state.phone.resendAt - Date.now()) / 1000)) });
    case 'setup':
      return profileSetup({ ...state.setup, pendingChallenge: state.pendingChallenge });
    case 'home': {
      const stats = topicStats();
      const all = Object.values(stats).reduce((a, s) => ({ right: a.right + s.right, answered: a.answered + s.answered, timeMs: a.timeMs + s.timeMs }), { right: 0, answered: 0, timeMs: 0 });
      return home({
        data: d,
        streak: liveStreak(),
        freeLeft: freeDuelsLeft(),
        freePerDay: freeDuelsPerDay(),
        plus: hasPlus(),
        squadDone: squadMembers(d.profile.nickname, correctThisWeek()).reduce((s, m) => s + m.right, 0),
        best: bestScore(),
        accuracy: all.answered ? `${Math.round((all.right / all.answered) * 100)}%` : null,
        avgTime: all.answered ? `${(all.timeMs / all.answered / 1000).toFixed(1)}s` : null,
        announcements: announcements(),
        update: updateAvailable() ? updateUrl() : null,
        duelsOn: switchOn('duels'),
        guest: !signedIn(),
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
      if (!switchOn('leagues')) return featureOff('league', 'League');
      if (!d.league) return leagueIntro(state.leagueDraft);
      const code = d.league.code;
      const week = weekStart();
      const firsts = d.history.filter((h) => h.kind === 'league' && h.leagueCode === code && h.counted && weekStart(h.day) === week);
      const yourDays = firsts.map((h) => ({ day: h.day, score: h.score }));
      return leagueScreen({
        league: d.league,
        played: d.history.find((h) => h.kind === 'league' && h.leagueCode === code && h.day === istDay()) || null,
        table: leagueTable(code, d.profile.nickname, yourDays),
        report: leagueReport(code, yourDays),
        msLeft: msUntilNextIstDay(),
      });
    }
    case 'squad': {
      if (!switchOn('squads')) return featureOff('squad', 'Squad');
      const members = squadMembers(d.profile.nickname, correctThisWeek());
      return squadScreen({ members, done: members.reduce((s, m) => s + m.right, 0), daysLeft: 6 - (istDay() - weekStart()) });
    }
    case 'ranks':
      return ranksScreen({ board: weeklyBoard(d.profile.nickname, weeklyTotal()), rankedToday: rankedDuelsToday() });
    case 'plus':
      return plusScreen({ plus: d.plus, plusUntil: !d.plus && hasPlus() ? d.account.plusUntil : null, reason: state.plusReason, freePerDay: freeDuelsPerDay() });
    case 'profile': {
      const stats = topicStats();
      const finished = d.history.filter((h) => h.status === 'finished');
      const squadDone = squadMembers(d.profile.nickname, correctThisWeek()).reduce((s, m) => s + m.right, 0);
      // Earned badges stay earned, even after the squad's week ends.
      if (squadDone >= SQUAD.target && !d.badges.squad) store.update((s) => { s.badges.squad = true; });
      return profileScreen({
        data: d,
        streak: liveStreak(),
        stats,
        plus: hasPlus(),
        badges: [
          { label: 'First win', icon: '1', earned: finished.some((h) => h.verdict === 'won') },
          { label: '7-day streak', icon: '7', earned: d.streak.best >= 7 },
          { label: 'Squad mission', icon: '30', earned: !!d.badges.squad || squadDone >= SQUAD.target },
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
  if (state.sheet === 'delete') return deleteSheet({ signedIn: signedIn() });
  if (state.sheet === 'sign-out') return signOutSheet();
  if (state.sheet === 'report') return reportSheet(state.report);
  return '';
}

function render({ keepScroll = false } = {}) {
  const y = window.scrollY;
  app.innerHTML = view() + sheetView();
  if (keepScroll) window.scrollTo(0, y);
  // Focus the sheet when it opens, not on every redraw (picking an option keeps your place).
  if (state.sheet && state.sheet !== lastSheet) app.querySelector('.sheet button, .sheet input')?.focus();
  lastSheet = state.sheet;
}

function go(screen, { replace = false, reset = false, keepReason = false } = {}) {
  stopTicker();
  if (!keepReason) state.plusReason = '';
  if (reset || TABS.includes(screen)) state.stack = [];
  else if (!replace && state.screen !== screen) state.stack.push(state.screen);
  state.screen = screen;
  state.sheet = null;
  render();
  window.scrollTo(0, 0);
}

/** Closes any sheet. In a duel, the clock starts showing again (it never stopped running). */
function closeSheet() {
  state.sheet = null;
  render({ keepScroll: true });
  if (state.screen === 'duel' && state.phase === 'question' && !ticker) {
    ticker = setInterval(tick, 250);
    tick();
  }
}

function back() {
  if (state.sheet) { closeSheet(); return; }
  if (state.screen === 'duel' && state.duel?.status === 'playing') { openLeave(); return; }
  if (state.screen === 'result') { go('home', { reset: true }); return; }
  if (state.screen === 'phone' && state.phone.step === 'code') { state.phone = { ...state.phone, step: 'number', error: '', busy: false }; render(); return; }
  const prev = state.stack.pop();
  if (prev && prev !== 'duel') { state.screen = prev; render(); window.scrollTo(0, 0); return; }
  if (state.screen !== 'home' && data().profile) { go('home', { reset: true }); return; }
  if (state.screen !== 'welcome' && !data().profile) { go('welcome', { reset: true }); return; }
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
  if (left <= 0) { if (state.sheet) { state.sheet = null; } submitAnswer('timeout'); return; }
  const timer = document.getElementById('timer');
  if (timer) {
    timer.textContent = `${Math.ceil(left / 1000)}s`;
    timer.classList.toggle('timer--low', left <= 5000);
  }
  const bar = document.getElementById('time-bar');
  if (bar) bar.style.width = `${Math.round((left / duel.limitMs) * 100)}%`;
  const bot = duel.bot?.[duel.index];
  const status = document.getElementById('rival-status');
  if (status && bot) {
    const text = elapsed >= bot.timeMs ? 'Rival locked in' : 'Rival is thinking';
    if (status.textContent !== text) status.textContent = text;
  }
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
  state.duel = createDuel({ playerKey: d.profile.nickname.toLowerCase(), paused: pausedTemplates(), ...options });
  state.leagueNote = '';
  state.stack = [];
  state.screen = 'duel';
  state.sheet = null;
  beginQuestion();
}

function duelsAllowed() {
  if (switchOn('duels') && !isPaused()) return true;
  toast('Duels are paused for a short while. Please try again soon.');
  return false;
}

function requireFreeDuel() {
  if (!duelsAllowed()) return false;
  if (freeDuelsLeft() > 0) return true;
  // PLUS-08: the duel after the free ones shows Plus, never a dead end.
  state.plusReason = `You have used today’s ${freeDuelsPerDay()} free duels. Come back tomorrow, or try Plus.`;
  go('plus', { keepReason: true });
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

let nextLock = 0;
function nextOrFinish() {
  // A double tap on "Next" must not also answer the next question.
  if (Date.now() < nextLock || state.phase !== 'reveal') return;
  nextLock = Date.now() + 350;
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
    // Any earlier attempt today, finished or left, means this one does not count.
    firstLeagueAttempt = !d.history.some((h) => h.kind === 'league' && h.leagueCode === duel.league.code && h.day === duel.day);
    state.leagueNote = firstLeagueAttempt && duel.status === 'finished'
      ? 'Your first attempt today counts for the league table.'
      : 'Only your first attempt at each daily duel counts, so this one does not change the table.';
  }
  const record = toHistory(duel, { firstLeagueAttempt });
  store.update((s) => {
    s.history.push(record);
    if (s.history.length > 500) s.history.splice(0, s.history.length - 500);
    if (duel.status === 'finished') recordStreakDay(duel.day);
  });
  if (duel.kind === 'challenge') state.challengeDraft = emptyChallenge();
  state.resultCode = duel.status === 'finished'
    ? encodeChallenge({ seed: duel.seed, topic: duel.topic, level: duel.level, marking: duel.marking, score: duel.you, nickname: d.profile.nickname })
    : '';
  state.screen = 'result';
  state.stack = [];
  state.sheet = null;
  render();
  window.scrollTo(0, 0);
  syncDuels(); // in the background; offline duels go up later
}

function openLeave() {
  if (state.phase === 'question') stopTicker();
  state.sheet = 'leave';
  render({ keepScroll: true });
}

// ---------- Sign-in ----------

/** Swaps a Firebase ID token for a Takkar session, or asks for a nickname first. */
async function exchangeToken(idToken, from) {
  const res = await api('POST', '/auth/firebase', { body: { idToken } });
  if (!res.ok) {
    await firebaseSignOut();
    showSignInError(problem(res, 'Sign-in did not work. Please try again.'), from);
    return;
  }
  if (res.data.needsProfile) {
    const guestName = data().profile?.nickname || '';
    state.setup = { mode: 'account', provider: res.data.provider, idToken, nickname: guestName, error: '', busy: false };
    state.auth.busy = null;
    state.phone.busy = false;
    go('setup', { replace: true });
    if (guestName) checkSetupForm();
    return;
  }
  await finishSignIn(res.data);
}

async function finishSignIn(result) {
  await completeSignIn(result);
  await firebaseSignOut();
  state.auth = { busy: null, error: '' };
  state.phone = { step: 'number', number: '', verificationId: null, error: '', busy: false, resendAt: 0 };
  state.blocked = null;
  toast(`Signed in as ${data().profile.nickname}`);
  if (state.pendingChallenge) {
    state.challengeDraft = { ...emptyChallenge(), challenge: state.pendingChallenge };
    state.pendingChallenge = null;
    go('challenge-entry', { reset: true });
    return;
  }
  if (!data().history.length) { state.screen = 'home'; startSoloDuel(); return; }
  go('home', { reset: true });
}

function showSignInError(message, from) {
  if (from === 'phone') {
    state.phone.busy = false;
    state.phone.error = message;
  } else {
    state.auth = { busy: null, error: message };
  }
  render();
}

function startResendCountdown() {
  clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    const el = document.getElementById('resend');
    if (state.screen !== 'phone' || state.phone.step !== 'code' || !el) { clearInterval(resendTimer); return; }
    const left = Math.max(0, Math.ceil((state.phone.resendAt - Date.now()) / 1000));
    el.textContent = left > 0 ? `New code in ${left}s` : 'Send a new code';
    el.disabled = left > 0 || state.phone.busy;
    if (left === 0) clearInterval(resendTimer);
  }, 1000);
}

async function sendCode({ resend = false } = {}) {
  const number = state.phone.number;
  state.phone = { ...state.phone, busy: true, error: '' };
  render();
  try {
    const result = await sendPhoneCode(`+91${number}`, { resend });
    if (result.idToken) { await exchangeToken(result.idToken, 'phone'); return; }
    state.phone = { ...state.phone, step: 'code', verificationId: result.verificationId, busy: false, resendAt: Date.now() + 30000 };
    render();
    app.querySelector('#otp')?.focus();
    startResendCountdown();
  } catch (e) {
    showSignInError(e.message, 'phone');
  }
}

function checkSetupForm() {
  const form = app.querySelector('[data-form="welcome"]');
  if (!form) return;
  const nick = form.nick.value.trim();
  const error = nicknameError(nick);
  const showError = nick.length >= 3 || state.welcomeTried;
  app.querySelector('#nick-error').textContent = showError ? error : state.setup.error && nick === state.setup.nickname ? state.setup.error : '';
  app.querySelector('#welcome-start').disabled = !!error || !form.age.checked || state.setup.busy;
}

// ---------- Server sync ----------

let lastAccountCheck = 0;
async function syncWithServer({ force = false } = {}) {
  const before = JSON.stringify([config()?.paused, config()?.switches, config()?.limits, config()?.announcements, config()?.app, data().account, data().profile?.nickname]);
  await refreshConfig({ force });
  if (signedIn() && (force || Date.now() - lastAccountCheck > 5 * 60 * 1000)) {
    lastAccountCheck = Date.now();
    const acc = await refreshAccount();
    if (acc.blocked) state.blocked = acc.blocked;
    else if (acc.ok && !acc.offline) state.blocked = null;
    if (acc.ended) {
      setSessionToken(null);
      store.update((s) => { s.account = { mode: 'guest' }; });
      toast('You were signed out. Sign in again from the You tab to keep saving your games.');
    }
  }
  await syncDuels();
  await flushOutbox();
  const after = JSON.stringify([config()?.paused, config()?.switches, config()?.limits, config()?.announcements, config()?.app, data().account, data().profile?.nickname]);
  // Redraw only where it cannot interrupt: not mid-duel, not while typing, not with a sheet open.
  const calm = !state.sheet && !['duel', 'phone', 'setup', 'challenge-entry'].includes(state.screen);
  if ((before !== after || state.blocked) && calm) render({ keepScroll: true });
}

// ---------- Actions ----------

const actions = {
  go: (el) => go(el.dataset.to),
  back: () => back(),
  toast: (el) => toast(el.dataset.text),
  'open-url': (el) => openExternal(el.dataset.url),
  'close-sheet': () => closeSheet(),
  'retry-config': async () => { toast('Checking…'); await syncWithServer({ force: true }); render(); },
  'dismiss-announcement': (el) => { store.update((s) => { s.seenAnnouncements = [...s.seenAnnouncements, el.dataset.id].slice(-30); }); render({ keepScroll: true }); },

  // Welcome
  'signin-google': async () => {
    if (!signInAvailable(config())) { toast('Sign-in is not available yet. Play as a guest for now.'); return; }
    state.auth = { busy: 'google', error: '' };
    render();
    try {
      const result = await googleSignIn();
      if (result.cancelled) { state.auth.busy = null; render(); return; }
      await exchangeToken(result.idToken, 'google');
    } catch (e) {
      showSignInError(e.message, 'google');
    }
  },
  'signin-phone': () => {
    if (!signInAvailable(config())) { toast('Sign-in is not available yet. Play as a guest for now.'); return; }
    state.auth.error = '';
    state.phone = { step: 'number', number: '', verificationId: null, error: '', busy: false, resendAt: 0 };
    go('phone');
  },
  'guest-start': () => {
    // Someone already playing as a guest just goes back to their games.
    if (data().profile) { go('home', { reset: true }); return; }
    state.setup = { mode: 'guest', provider: null, idToken: null, nickname: '', error: '', busy: false };
    state.welcomeTried = false;
    go('setup');
  },

  // Phone
  'phone-send': () => {
    const raw = (app.querySelector('#phone')?.value || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
    state.phone.number = raw;
    if (!/^[6-9]\d{9}$/.test(raw)) { state.phone.error = 'Enter a 10-digit Indian mobile number.'; render(); return; }
    sendCode();
  },
  'phone-resend': () => { if (Date.now() >= state.phone.resendAt) sendCode({ resend: true }); },
  'phone-change': () => { state.phone = { ...state.phone, step: 'number', error: '', busy: false }; render(); },
  'phone-verify': async () => {
    const code = (app.querySelector('#otp')?.value || '').replace(/\D/g, '');
    if (code.length !== 6) { state.phone.error = 'Enter the 6-digit code from the SMS.'; render(); return; }
    state.phone = { ...state.phone, busy: true, error: '' };
    render();
    try {
      const { idToken } = await confirmPhoneCode(state.phone.verificationId, code);
      await exchangeToken(idToken, 'phone');
    } catch (e) {
      showSignInError(e.message, 'phone');
    }
  },

  // Nickname and 18+ (guest or new account)
  'profile-save': async () => {
    const form = app.querySelector('[data-form="welcome"]');
    const nick = form.nick.value.trim();
    const error = nicknameError(nick);
    state.welcomeTried = true;
    if (error || !form.age.checked) {
      app.querySelector('#nick-error').textContent = error || '';
      if (!form.age.checked && !error) toast('Please confirm you are 18 or older.');
      return;
    }
    if (state.setup.mode === 'account') {
      state.setup = { ...state.setup, nickname: nick, busy: true, error: '' };
      checkSetupForm();
      const res = await api('POST', '/auth/firebase', { body: { idToken: state.setup.idToken, profile: { nickname: nick, ageConfirmed: true, termsVersion: TERMS_VERSION } } });
      if (!res.ok) {
        if (res.status === 401) {
          state.auth = { busy: null, error: 'Sign-in took too long. Please sign in again.' };
          go('welcome', { reset: true });
          return;
        }
        state.setup = { ...state.setup, busy: false, error: problem(res) };
        render();
        if (form) checkSetupForm();
        return;
      }
      await finishSignIn(res.data);
      return;
    }
    const now = new Date().toISOString();
    store.update((s) => {
      s.profile = { nickname: nick, ageConfirmedAt: now, termsVersion: TERMS_VERSION, createdAt: now };
      s.account = { mode: 'guest' };
    });
    if (state.pendingChallenge) {
      state.challengeDraft = { ...emptyChallenge(), challenge: state.pendingChallenge };
      state.pendingChallenge = null;
      go('challenge-entry', { reset: true });
      return;
    }
    // UX-08: straight into the first duel.
    state.screen = 'home';
    startSoloDuel();
  },

  // Home and settings
  'set-topic': (el) => { store.update((s) => { s.settings.topic = el.dataset.value; }); render({ keepScroll: true }); },
  'open-settings': () => { state.sheet = 'settings'; render({ keepScroll: true }); },
  'set-setting': (el) => { store.update((s) => { s.settings[el.dataset.group] = el.dataset.value; }); render({ keepScroll: true }); },
  'start-duel': () => startSoloDuel(),

  // Duel
  answer: (el) => submitAnswer(el.dataset.index === 'skip' ? null : Number(el.dataset.index)),
  'next-question': () => nextOrFinish(),
  'leave-duel': () => openLeave(),
  'confirm-leave': () => {
    abandonDuel(state.duel);
    state.sheet = null;
    finishDuel();
  },
  flag: () => {
    const q = state.duel.questions[state.duel.index];
    store.update((s) => { s.flags.push({ at: new Date().toISOString(), type: q.type, text: q.text }); });
    sendOrQueue('/flags', { template: q.type, text: q.text, reason: 'wrong' });
    state.flagged = true;
    render({ keepScroll: true });
    toast('Thanks. The question goes to the Takkar team for review.');
  },

  // Result and challenges
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
      text: `I scored ${num(d.you)} in a Takkar duel. Same ten questions, can you beat me?\nGet Takkar: ${BETA_URL}\nThen tap "Have a challenge code?" and paste:\n${state.resultCode}`,
    });
  },
  'paste-code': async () => {
    let text = '';
    try {
      const clip = window.Capacitor?.Plugins?.Clipboard;
      text = clip ? (await clip.read()).value : await navigator.clipboard.readText();
    } catch { /* clipboard blocked */ }
    if (!text) { toast('Nothing to paste. Long-press the box to paste instead.'); return; }
    checkCode(text.trim());
  },
  'check-code': () => checkCode(app.querySelector('#code')?.value ?? state.challengeDraft.codeText),
  'clear-challenge': () => { state.challengeDraft = emptyChallenge(); render(); },
  'play-challenge': () => {
    const c = state.challengeDraft.challenge;
    if (!data().profile) { state.pendingChallenge = c; go('welcome', { reset: true }); return; }
    if (!duelsAllowed()) return;
    startDuel({ kind: 'challenge', seed: c.seed, topic: c.topic, level: c.level, marking: c.marking, challenge: c });
  },

  // League demo
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
    if (!duelsAllowed()) return;
    const l = data().league;
    startDuel({ kind: 'league', seed: leagueDailySeed(l.code), topic: 'mixed', level: 'exam', marking: 'exam', rival: 'steady', league: l });
  },
  'copy-league': () => copyText(data().league.code),
  'share-league': () => {
    const l = data().league;
    shareText({
      title: `${l.channel} League on Takkar`,
      text: `${l.channel} is trying Takkar leagues: one 4-minute quiz duel a day, the same questions for everyone, and a weekly table. Leagues open to students soon; for now, get the Takkar beta and play the daily duel: ${BETA_URL}\nFor aspirants aged 18 and over.`,
    });
  },
  'close-league': () => {
    store.update((s) => { s.league = null; });
    render();
    toast('Demo league closed');
  },

  // Squad
  react: (el) => {
    store.update((s) => { s.reactions.push({ at: new Date().toISOString(), reaction: el.dataset.value }); });
    vibrate();
    toast(`Sent “${el.dataset.value}” to ${SQUAD.name}`);
  },
  'invite-squad': () => {
    shareText({
      title: 'Play Takkar with me',
      text: `I play Takkar every day: ten Quant and Reasoning questions, one rival, four minutes. Squads are coming soon, join me now: ${BETA_URL}`,
    });
  },

  // Plus (demo)
  'plus-on': () => {
    store.update((s) => { s.plus = { demo: true, since: new Date().toISOString() }; });
    state.plusReason = '';
    toast('Plus is on in demo mode');
    back();
  },
  'plus-off': () => { store.update((s) => { s.plus = null; }); render(); toast('Demo Plus turned off'); },

  // Profile, reports and account
  'export-data': () => shareText({ title: 'My Takkar data', text: store.exportJson() }),
  'open-report': () => {
    state.report = { kind: 'app_problem', details: '', nickname: '', error: '', busy: false };
    state.sheet = 'report';
    render({ keepScroll: true });
  },
  'report-kind': (el) => { state.report.kind = el.dataset.value; render({ keepScroll: true }); },
  'send-report': async () => {
    const r = state.report;
    if (r.details.trim().length < 5) { r.error = 'Please tell us a little about what happened.'; render({ keepScroll: true }); return; }
    r.busy = true;
    render({ keepScroll: true });
    const body = {
      kind: r.kind, details: r.details.trim(), nickname: r.nickname.trim() || undefined,
      appVersion: APP_VERSION, device: navigator.userAgent.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().slice(0, 80),
    };
    const sent = await sendOrQueue('/reports', body);
    if (!sent.ok) { state.report = { ...r, busy: false, error: sent.error }; render({ keepScroll: true }); return; }
    state.sheet = null;
    render({ keepScroll: true });
    toast(sent.queued ? 'Saved. It will be sent when you are back online.' : 'Thanks. Sent to the Takkar team.');
  },
  'ask-sign-out': () => { state.sheet = 'sign-out'; render({ keepScroll: true }); },
  'sign-out': async () => {
    await signOutHere();
    await firebaseSignOut();
    state.blocked = null;
    state.sheet = null;
    toast('Signed out. You are playing as a guest on this phone.');
    go(data().profile ? 'home' : 'welcome', { reset: true });
  },
  'ask-delete': () => { state.sheet = 'delete'; render({ keepScroll: true }); },
  'confirm-delete': async () => {
    if (signedIn()) {
      const res = await api('POST', '/account/delete', { auth: true });
      if (!res.ok && res.status !== 401) { toast(problem(res, 'Could not delete your account. Please try again.')); return; }
      await firebaseSignOut();
    }
    store.wipe();
    Object.assign(state, {
      sheet: null, duel: null, blocked: null, challengeDraft: emptyChallenge(), pendingChallenge: null,
      leagueDraft: { name: '', error: '' }, welcomeTried: false, auth: { busy: null, error: '' },
    });
    toast('Your account and data are deleted');
    go('welcome', { reset: true });
    refreshConfig({ force: true });
  },
};

function checkCode(text) {
  const result = decodeChallenge(text);
  state.challengeDraft = result.ok
    ? { codeText: text, error: '', challenge: result.challenge }
    : { codeText: text, error: result.reason, challenge: null };
  render();
}

app.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target || !app.contains(target) || target.disabled) return;
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
  if (kind === 'nick' || kind === 'age') checkSetupForm();
  if (kind === 'channel') state.leagueDraft.name = el.value;
  if (kind === 'code') state.challengeDraft.codeText = el.value;
  if (kind === 'phone') {
    el.value = el.value.replace(/\D/g, '').slice(0, 10);
    state.phone.number = el.value;
    if (state.phone.error) { state.phone.error = ''; el.closest('.field').querySelector('.field__error').textContent = ''; }
  }
  if (kind === 'otp') {
    el.value = el.value.replace(/\D/g, '').slice(0, 6);
    if (el.value.length === 6 && !state.phone.busy) actions['phone-verify']();
  }
  if (kind === 'report-details') state.report.details = el.value;
  if (kind === 'report-nick') state.report.nickname = el.value;
});

app.addEventListener('change', (event) => {
  if (event.target.dataset.input === 'reminders') {
    const on = event.target.checked;
    store.update((s) => { s.settings.reminders = on; });
    toast(on ? 'Saved. Reminders arrive in a later version; this beta sends none.' : 'Daily reminder off');
  }
});

// The keyboard's Go / Enter key does the form's main action.
const FORM_ACTIONS = { welcome: 'profile-save', phone: 'phone-send', otp: 'phone-verify', league: 'create-league' };
app.addEventListener('submit', (event) => {
  event.preventDefault();
  const action = FORM_ACTIONS[event.target.dataset.form];
  if (action === 'profile-save' && app.querySelector('#welcome-start')?.disabled) return;
  if (action) actions[action]();
});

// DUEL-03: keys A to D or 1 to 4; S to skip in exam marking; Enter for next.
document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target.id === 'code') { event.preventDefault(); actions['check-code'](); return; }
  if (state.screen !== 'duel' || state.sheet || event.target.matches('input, textarea')) return;
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
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

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  // Time keeps running while the app is in the background, as it would on the server.
  if (state.screen === 'duel' && state.phase === 'question') tick();
  syncWithServer();
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
const intro = playIntro();
// Keep the Takkar splash up until the first screen (and the intro) is on display, so a slow
// phone shows the logo, never an empty screen. A 12-second limit makes sure the splash always goes.
let splashHidden = false;
const hideSplash = () => {
  if (splashHidden) return;
  splashHidden = true;
  window.Capacitor?.Plugins?.SplashScreen?.hide({ fadeOutDuration: 150 });
};
try {
  new PerformanceObserver((list, observer) => {
    if (list.getEntries().some((e) => e.name === 'first-contentful-paint')) {
      observer.disconnect();
      setTimeout(hideSplash, 50);
    }
  }).observe({ type: 'paint', buffered: true });
} catch {
  requestAnimationFrame(() => requestAnimationFrame(hideSplash));
}
setTimeout(hideSplash, 12000);
// Talk to the server while the intro plays; measure glass after it, so neither delays the first paint.
syncWithServer({ force: true });
intro.then(() => setTimeout(measureGlass, 300));
