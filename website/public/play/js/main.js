// Takkar app: navigation, sign-in, the duel loop, actions, and keeping in step with the server.
import { store, signedIn, hasPlus, freeDuelsLeft, freeDuelsPerDay, recordStreakDay, liveStreak, weeklyTotal, rankedDuelsToday, correctThisWeek, topicStats, bestScore } from './store.js?v=8ef6f9fe8e';
import { createDuel, startQuestion, answerQuestion, nextQuestion, abandonDuel, toHistory, maxScore } from './game.js?v=8ef6f9fe8e';
import { encodeChallenge, decodeChallenge } from './code.js?v=8ef6f9fe8e';
import { squadMembers, weeklyBoard, leagueCode, leagueDailySeed, leagueTable, leagueReport, SQUAD } from './demo.js?v=8ef6f9fe8e';
import { istDay, weekStart, msUntilNextIstDay } from './time.js?v=8ef6f9fe8e';
import { nicknameError, leagueNameError } from './validate.js?v=8ef6f9fe8e';
import { esc, num, toast, announce, shareText, copyText, downloadText, openExternal, onBackButton, exitApp, vibrate } from './ui.js?v=8ef6f9fe8e';
import { APP_VERSION, APP_BUILD, TERMS_VERSION, IS_NATIVE, HERE, WEB_APP_URL } from './config.js?v=8ef6f9fe8e';
import { api, problem, setSessionToken } from './api.js?v=8ef6f9fe8e';
import { signInAvailable, googleSignIn, sendPhoneCode, confirmPhoneCode, firebaseSignOut } from './auth.js?v=8ef6f9fe8e';
import { refreshConfig, refreshAccount, syncDuels, flushOutbox, sendOrQueue, completeSignIn, signOutHere } from './sync.js?v=8ef6f9fe8e';
import { playIntro } from './intro.js?v=8ef6f9fe8e';
import { EXAMS, getExam } from './exams.js?v=8ef6f9fe8e';
import { generateSet } from './engine/index.js?v=8ef6f9fe8e';
import { randomSeed } from './engine/rng.js?v=8ef6f9fe8e';
import { createMock, goTo, choose, clearChoice, toggleMark, nextIndex, nextSection, submitMock, mockToHistory } from './mock.js?v=8ef6f9fe8e';
import { examPick, examMonth, examRules, goalScreen } from './screens/exam.js?v=8ef6f9fe8e';
import { practiceScreen, mockIntro, mockScreen, mockSubmitSheet, sectionEndSheet, mockResult, topicsBySection } from './screens/practice.js?v=8ef6f9fe8e';
import { enableTabSwipe } from './swipe.js?v=8ef6f9fe8e';
import { welcome } from './screens/welcome.js?v=8ef6f9fe8e';
import { phoneScreen, profileSetup, pausedScreen, updateScreen, blockedScreen, reportSheet } from './screens/signin.js?v=8ef6f9fe8e';
import { home, settingsSheet } from './screens/home.js?v=8ef6f9fe8e';
import { duelScreen, leaveSheet } from './screens/duel.js?v=8ef6f9fe8e';
import { resultScreen } from './screens/result.js?v=8ef6f9fe8e';
import { challengeEntry } from './screens/challenge.js?v=8ef6f9fe8e';
import { leagueIntro, leagueScreen } from './screens/league.js?v=8ef6f9fe8e';
import { squadScreen, ranksScreen, featureOff } from './screens/social.js?v=8ef6f9fe8e';
import { plusScreen, profileScreen, deleteSheet, signOutSheet } from './screens/account.js?v=8ef6f9fe8e';

const app = document.getElementById('app');
const TABS = ['home', 'practice', 'league', 'squad', 'profile'];
// Ranks sits inside League (a segment), but behaves like a tab.
const TAB_SCREENS = [...TABS, 'ranks'];
// Screens past onboarding that need an exam (Practice, mocks and the duel rules follow it).
const NEEDS_EXAM = new Set([...TAB_SCREENS, 'mock-intro', 'mock', 'goal']);
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
  examDraft: { exam: null, month: null, change: false }, // onboarding or You → Exam
  goalDraft: null,
  afterResult: null, // 'goal' after the first duel
  mock: null,
  rulesThen: null, // 'challenge': after the rules screen, open the challenge that brought them here
  goalReturn: null, // where "Set my goal" goes back to
  linkError: '', // a challenge link that did not work, shown once the first screen is up
};

let ticker = null;
let resendTimer = null;
let lastSheet = null;
const data = () => store.get();
const config = () => data().config;

// ---------- What the admin controls ----------

const isPaused = () => config()?.paused === true;
const mustUpdate = () => IS_NATIVE && !!config() && APP_BUILD < (config().app?.minBuild ?? 1);
const updateUrl = () => config()?.app?.updateUrl || BETA_URL;
const updateAvailable = () => IS_NATIVE && !!config() && APP_BUILD < (config().app?.latestBuild ?? 1);
const switchOn = (name) => config()?.switches?.[name] !== false;
const pausedTemplates = () => config()?.pausedTemplates || [];
const announcements = () => (config()?.announcements || []).filter((a) => !data().seenAnnouncements.includes(a.id));

// ---------- Rendering ----------

/** Finished duels, practice sets and mocks today: they all count for the daily goal. */
const goalDoneToday = () => data().history.filter((h) => h.day === istDay() && h.status === 'finished').length;

/** Where the result screen goes back to. */
const resultHome = () => ({ practice: 'practice', league: 'league' })[state.duel?.kind] || 'home';

function view() {
  const d = data();
  if (!d.exam && d.profile && NEEDS_EXAM.has(state.screen)) {
    state.examDraft = { exam: null, month: null, change: false };
    state.screen = 'exam-pick';
    state.stack = [];
  }
  // Screens the admin can put in front of everything (the duel in progress finishes first).
  if (state.screen !== 'duel' && state.screen !== 'result') {
    if (mustUpdate()) return updateScreen({ url: updateUrl() });
    if (isPaused()) return pausedScreen();
    if (state.blocked) return blockedScreen(state.blocked);
  }
  const exam = getExam(d.exam);
  const scale = exam ? (exam.marks * 10) / 40 : 1; // sample players' scores in this exam's marks
  switch (state.screen) {
    case 'exam-pick':
      return examPick({ selected: state.examDraft.exam, canGoBack: state.examDraft.change });
    case 'exam-month':
      return examMonth({ exam: state.examDraft.exam, month: state.examDraft.month });
    case 'exam-rules':
      // "Before your first duel" only in onboarding; from You it is a page with a back button.
      return examRules({ exam: d.exam || state.examDraft.exam, first: !d.rulesSeen && !state.stack.length, returning: d.history.length > 0 });
    case 'goal':
      return goalScreen({ goal: state.goalDraft });
    case 'practice':
      return practiceScreen({ exam: d.exam, stats: topicStats(), mocksLeft: mocksLeftToday(), plus: hasPlus() });
    case 'mock-intro':
      return mockIntro({ exam: d.exam, mocksLeft: mocksLeftToday(), plus: hasPlus() });
    case 'mock':
      return mockScreen({ mock: state.mock, timeLeft: Math.max(0, state.mock.deadline - Date.now()) });
    case 'mock-result':
      return mockResult({ mock: state.mock });
    case 'welcome':
      return welcome({ pendingChallenge: state.pendingChallenge, signInReady: signInAvailable(config()), busy: state.auth.busy, error: state.auth.error, exam: getExam(d.exam || state.examDraft.exam) });
    case 'phone':
      return phoneScreen({ ...state.phone, resendIn: Math.max(0, Math.ceil((state.phone.resendAt - Date.now()) / 1000)) });
    case 'setup':
      return profileSetup({ ...state.setup, pendingChallenge: state.pendingChallenge, signInReady: signInAvailable(config()) });
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
        signInReady: signInAvailable(config()),
        exam,
        examMonth: d.examMonth,
        goal: d.goal,
        goalDone: goalDoneToday(),
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
      if (!d.league) return leagueIntro({ ...state.leagueDraft, code: leagueCode((state.leagueDraft.name || '').trim() || 'Your channel'), scale });
      const code = d.league.code;
      const week = weekStart();
      const firsts = d.history.filter((h) => h.kind === 'league' && h.leagueCode === code && h.counted && weekStart(h.day) === week);
      const yourDays = firsts.map((h) => ({ day: h.day, score: h.score }));
      return leagueScreen({
        league: d.league,
        played: d.history.find((h) => h.kind === 'league' && h.leagueCode === code && h.day === istDay()) || null,
        table: leagueTable(code, d.profile.nickname, yourDays, scale),
        report: leagueReport(code, yourDays, scale),
        max: exam ? exam.marks * 10 : 40,
        msLeft: msUntilNextIstDay(),
      });
    }
    case 'squad': {
      if (!switchOn('squads')) return featureOff('squad', 'Squad');
      const members = squadMembers(d.profile.nickname, correctThisWeek());
      return squadScreen({ members, done: members.reduce((s, m) => s + m.right, 0), daysLeft: 6 - (istDay() - weekStart()) });
    }
    case 'ranks':
      return ranksScreen({ board: weeklyBoard(d.profile.nickname, weeklyTotal(), scale), rankedToday: rankedDuelsToday(), exam });
    case 'plus':
      return plusScreen({ plus: d.plus, plusUntil: !d.plus && hasPlus() ? d.account.plusUntil : null, reason: state.plusReason, freePerDay: freeDuelsPerDay() });
    case 'profile': {
      const stats = topicStats();
      const finished = d.history.filter((h) => h.status === 'finished');
      // Only the player's own answers count (the squad's sample members are demo data).
      const ownWeek = correctThisWeek();
      // Earned badges stay earned, even after the week ends.
      if (ownWeek >= SQUAD.target && !d.badges.squad) store.update((s) => { s.badges.squad = true; });
      return profileScreen({
        data: d,
        streak: liveStreak(),
        stats,
        plus: hasPlus(),
        exam,
        examMonth: d.examMonth,
        goal: d.goal,
        signInReady: signInAvailable(config()),
        badges: [
          { label: 'First win', icon: '1', earned: finished.some((h) => h.verdict === 'won') },
          { label: '7-day streak', icon: '7', earned: d.streak.best >= 7 },
          { label: `${SQUAD.target} right in a week`, icon: String(SQUAD.target), earned: !!d.badges.squad || ownWeek >= SQUAD.target },
          { label: 'Ten of ten', icon: '10', earned: finished.some((h) => h.right === 10 && h.kind !== 'mock') },
        ],
      });
    }
    default:
      return '';
  }
}

function sheetView() {
  if (state.sheet === 'settings') return settingsSheet(data().settings, getExam(data().exam));
  if (state.sheet === 'mock-submit') return mockSubmitSheet({ mock: state.mock });
  if (state.sheet === 'section-end') return sectionEndSheet({ mock: state.mock, timeLeft: Math.max(0, state.mock.deadline - Date.now()) });
  if (state.sheet === 'leave') return leaveSheet({ kind: state.duel?.kind });
  if (state.sheet === 'delete') return deleteSheet({ signedIn: signedIn() });
  if (state.sheet === 'sign-out') return signOutSheet();
  if (state.sheet === 'report') return reportSheet(state.report);
  return '';
}

const TITLES = {
  home: 'Home', practice: 'Practice', league: 'League', ranks: 'Ranks', squad: 'Squad', profile: 'You', plus: 'Plus',
  duel: 'Duel', result: 'Result', 'mock-intro': 'Mini mock', mock: 'Mini mock', 'mock-result': 'Mock result',
  'challenge-entry': 'Challenge', 'exam-pick': 'Your exam', 'exam-month': 'Exam month', 'exam-rules': 'Marking rules',
  goal: 'Daily goal', welcome: 'Welcome', setup: 'Your nickname', phone: 'Phone sign-in',
};

/** A selector that finds "the same control" again after a redraw. */
function signature(el) {
  if (!el || !el.dataset) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (!el.dataset.action) return null;
  const extra = ['value', 'index', 'to', 'group', 'label'].filter((k) => el.dataset[k] !== undefined)
    .map((k) => `[data-${k}="${CSS.escape(el.dataset[k])}"]`).join('');
  return `[data-action="${el.dataset.action}"]${extra}`;
}
function focusSig(sig) {
  const el = sig && app.querySelector(sig);
  if (!el || el.disabled) return false;
  el.focus({ preventScroll: true });
  return true;
}

let lastKey = '';
let inputLockUntil = 0; // a double tap must not land on the screen the first tap opened
let lastTap = { x: -99, y: -99, at: -1e9 };
let lastActionSig = null;
let sheetOpener = null;

function render({ keepScroll = false, enterFrom = null } = {}) {
  const y = window.scrollY;
  const active = document.activeElement;
  const activeSig = active && active !== document.body && app.contains(active) ? signature(active) : null;
  app.innerHTML = view() + sheetView();
  // Tab screens can be swiped; a tab change slides the new page in from the side it came from.
  const screen = app.firstElementChild;
  if (screen && TAB_SCREENS.includes(state.screen) && screen.querySelector('.tabbar')) {
    screen.classList.add('screen--tab');
    if (enterFrom) screen.querySelector('.screen__body')?.classList.add(`enter-from-${enterFrom}`);
  }
  if (keepScroll) window.scrollTo(0, y);
  const key = [state.screen, state.duel?.index, state.phase, state.mock?.current, state.mock?.section].join('|');
  const sheetOpened = !!state.sheet && state.sheet !== lastSheet;
  if (key !== lastKey || sheetOpened) inputLockUntil = performance.now() + 400;
  if (sheetOpened) {
    // Focus the sheet when it opens; when it closes, focus goes back to what opened it.
    sheetOpener = lastActionSig;
    app.querySelector('.sheet button, .sheet input, .sheet textarea')?.focus();
  } else if (key !== lastKey) {
    document.title = TITLES[state.screen] ? `${TITLES[state.screen]} · Takkar` : 'Takkar';
    // A new screen: keyboard and screen-reader users start at its heading.
    const h = state.sheet ? null : app.querySelector('h1');
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  } else if (!state.sheet && lastSheet) {
    if (!focusSig(sheetOpener)) focusSig(activeSig);
    sheetOpener = null;
  } else {
    focusSig(activeSig); // the same screen redrawn (an option picked): keep your place
  }
  lastKey = key;
  lastSheet = state.sheet;
}

function go(screen, { replace = false, reset = false, keepReason = false } = {}) {
  stopTicker();
  if (!keepReason) state.plusReason = '';
  const tabOf = (x) => TABS.indexOf(x === 'ranks' ? 'league' : x);
  const from = tabOf(state.screen);
  const to = tabOf(screen);
  // The goal question comes once, after the first duel's result.
  if (screen === 'home' && state.afterResult === 'goal') { state.afterResult = null; screen = 'goal'; }
  if (reset || to >= 0 || TAB_SCREENS.includes(screen)) state.stack = [];
  else if (!replace && state.screen !== screen) state.stack.push(state.screen);
  state.screen = screen;
  state.sheet = null;
  window.scrollTo(0, 0);
  render({ enterFrom: from >= 0 && to >= 0 && from !== to ? (to > from ? 'right' : 'left') : null });
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

/** True when Back would leave Takkar (nothing to close and no screen to go back to). */
function atRoot() {
  if (state.sheet || state.stack.length) return false;
  if (state.screen === 'duel' && state.duel?.status === 'playing') return false;
  if (state.screen === 'phone' && state.phone.step === 'code') return false;
  if (state.screen === 'exam-pick' && !data().exam) return true;
  return data().profile ? state.screen === 'home' : state.screen === 'welcome';
}

function back() {
  if (state.sheet) { closeSheet(); return; }
  if (state.screen === 'duel' && state.duel?.status === 'playing') {
    // After the last answer the duel is complete: back shows the result instead of throwing it away.
    if (onLastReveal()) nextOrFinish(); else openLeave();
    return;
  }
  if (state.screen === 'mock' && state.mock?.status === 'playing') { state.sheet = 'mock-submit'; render({ keepScroll: true }); return; }
  if (state.screen === 'mock-result') { go('practice', { reset: true }); return; }
  if (state.screen === 'exam-pick' && !data().exam) { exitApp(); return; }
  if (state.screen === 'result') { go(resultHome(), { reset: true }); return; }
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
  if (left <= 10000 && duel.lowAnnounced !== duel.index) { duel.lowAnnounced = duel.index; announce('10 seconds left'); }
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
  state.duel = createDuel({ playerKey: d.profile.nickname.toLowerCase(), paused: pausedTemplates(), exam: d.exam, ...options });
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
  announce(app.querySelector('.explain__head')?.textContent.trim() || '');
}

const onLastReveal = () => state.phase === 'reveal' && state.duel.index === state.duel.questions.length - 1;

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
    ? encodeChallenge({ seed: duel.seed, topic: duel.topic, level: duel.level, marking: duel.marking, score: duel.you, nickname: d.profile.nickname, exam: duel.exam })
    : '';
  if (duel.kind === 'practice') state.resultCode = '';
  // First finished duel ever: ask for a daily goal when they leave the result.
  if (duel.status === 'finished' && duel.kind === 'solo' && !d.goal && !d.goalAsked) state.afterResult = 'goal';
  state.screen = 'result';
  state.stack = [];
  state.sheet = null;
  render();
  window.scrollTo(0, 0);
  syncDuels(); // in the background; offline duels go up later
}

/** Topic practice: 10 questions of one topic, no rival, unlimited. */
function startPractice(label, topic) {
  if (!duelsAllowed()) return;
  const sections = topicsBySection();
  const item = (sections[topic] || []).find((t) => t.label === label);
  if (!item) return;
  const seed = randomSeed();
  const questions = generateSet(seed, { [topic]: 10 }, data().settings.level, { only: item.ids, paused: pausedTemplates(), weights: getExam(data().exam)?.weights || {} });
  startDuel({ kind: 'practice', seed, topic, level: data().settings.level, marking: 'exam', questions, practiceTopic: label });
}

const mocksLeftToday = () => 1 - data().history.filter((h) => h.kind === 'mock' && h.day === istDay()).length;

// A mock in progress is saved after every step, so a reload or a closed tab does not lose it.
const MOCK_KEY = 'takkar.mock';
function saveMock() {
  try { if (state.mock?.status === 'playing') localStorage.setItem(MOCK_KEY, JSON.stringify(state.mock)); } catch { /* storage full or blocked */ }
}
function clearSavedMock() {
  try { localStorage.removeItem(MOCK_KEY); } catch { /* nothing to do */ }
}
function restoreMock() {
  try {
    const m = JSON.parse(localStorage.getItem(MOCK_KEY) || 'null');
    if (!m || m.status !== 'playing' || !EXAMS[m.exam] || !data().profile || !data().exam) { clearSavedMock(); return false; }
    m.enteredAt = Date.now(); // time away is not counted against a question
    state.mock = m;
    state.stack = ['practice'];
    state.screen = 'mock';
    return true;
  } catch {
    clearSavedMock();
    return false;
  }
}

let mockClock = null;
function startMockClock() {
  clearInterval(mockClock);
  mockClock = setInterval(() => {
    const m = state.mock;
    if (!m || m.status !== 'playing') { clearInterval(mockClock); return; }
    const left = m.deadline - Date.now();
    const el = document.getElementById('mock-timer');
    if (el) {
      const t = Math.max(0, left);
      el.textContent = `${Math.floor(t / 60000)}:${String(Math.floor((t % 60000) / 1000)).padStart(2, '0')}`;
      el.classList.toggle('timer--low', t <= 60000);
    }
    if (left <= 60000 && left > 0 && m.lowAnnounced !== m.section) { m.lowAnnounced = m.section; announce('1 minute left'); }
    if (left > 0) return;
    // Time's up: next section (sectional mocks), or submit.
    if (nextSection(m)) {
      state.sheet = null;
      saveMock();
      toast(`Time for ${m.sections[m.section - 1].name} is up. ${m.sections[m.section].name} section started.`);
      if (state.screen === 'mock') { render(); window.scrollTo(0, 0); }
    } else {
      finishMock();
    }
  }, 500);
}

function finishMock() {
  clearInterval(mockClock);
  clearSavedMock();
  submitMock(state.mock);
  store.update((s) => {
    s.history.push(mockToHistory(state.mock));
    if (s.history.length > 500) s.history.splice(0, s.history.length - 500);
    recordStreakDay(state.mock.day);
  });
  state.sheet = null;
  go('mock-result', { reset: true });
}

/** Exam, month and goal go to the server for signed-in players (so a new phone gets them). */
function syncProfile() {
  if (!signedIn()) return;
  const d = data();
  api('POST', '/me/profile', { auth: true, body: { exam: d.exam, examMonth: d.examMonth, goal: d.goal } });
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
  if (openPendingChallenge()) return;
  if (!data().rulesSeen && data().exam) { go('exam-rules', { reset: true }); return; }
  if (!data().history.length) { state.screen = 'home'; startSoloDuel(); return; }
  go('home', { reset: true });
}

/** After sign-up: the challenge that brought them here, with the marking rules first if new. */
function openPendingChallenge() {
  if (!state.pendingChallenge) return false;
  state.challengeDraft = { ...emptyChallenge(), challenge: state.pendingChallenge };
  state.pendingChallenge = null;
  if (!data().rulesSeen && data().exam) { state.rulesThen = 'challenge'; go('exam-rules', { reset: true }); return true; }
  go('challenge-entry', { reset: true });
  return true;
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
    const result = await sendPhoneCode(`+91${number}`, { resend, config: config() });
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
      const result = await googleSignIn(config());
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
    if (openPendingChallenge()) return;
    // The exam's rules once, then straight into the first duel (UX-08).
    if (!data().rulesSeen && data().exam) { go('exam-rules', { reset: true }); return; }
    state.screen = 'home';
    startSoloDuel();
  },

  // Exam-first onboarding (and You → Exam)
  'pick-exam': (el) => { state.examDraft.exam = el.dataset.value; render({ keepScroll: true }); },
  'exam-continue': () => { if (state.examDraft.exam) go('exam-month'); },
  'pick-month': (el) => { state.examDraft.month = state.examDraft.month === el.dataset.value ? null : el.dataset.value; render({ keepScroll: true }); },
  'month-continue': () => {
    const { exam, month, change } = state.examDraft;
    const switched = data().exam && data().exam !== exam;
    store.update((s) => { s.exam = exam; s.examMonth = month === 'unknown' ? null : month; });
    syncProfile();
    if (change) {
      const returnTo = state.examDraft.returnTo || 'profile';
      toast(switched ? `Now preparing for ${EXAMS[exam].short}. Duels follow its pattern.` : 'Saved');
      if (switched) {
        store.update((s) => { s.rulesSeen = true; });
        go('exam-rules', { reset: true });
        state.stack = [returnTo]; // back from the new rules returns to where they started
      } else go(returnTo, { reset: true });
      return;
    }
    if (!data().profile) { go('welcome'); return; }
    // A player from before exams: the new rules once, then Home.
    go('exam-rules', { reset: true });
  },
  'rules-start': () => {
    store.update((s) => { s.rulesSeen = true; });
    if (state.rulesThen === 'challenge') { state.rulesThen = null; go('challenge-entry', { reset: true }); return; }
    state.screen = 'home';
    if (data().history.length) { go('home', { reset: true }); return; }
    startSoloDuel();
  },
  'change-exam': () => {
    const from = state.screen === 'ranks' ? 'league' : state.screen;
    state.examDraft = { exam: data().exam, month: data().examMonth, change: true, returnTo: TABS.includes(from) ? from : 'home' };
    go('exam-pick');
  },
  'show-rules': () => go('exam-rules'),
  'pick-goal': (el) => { state.goalDraft = Number(el.dataset.value); render({ keepScroll: true }); },
  'goal-save': () => {
    store.update((s) => { s.goal = state.goalDraft; s.goalAsked = true; });
    syncProfile();
    toast(`Goal set: ${state.goalDraft} a day`);
    go(state.goalReturn || 'home', { reset: true });
    state.goalReturn = null;
  },
  'goal-skip': () => {
    store.update((s) => { s.goalAsked = true; });
    go(state.goalReturn || 'home', { reset: true });
    state.goalReturn = null;
  },
  'change-goal': () => { state.goalDraft = data().goal; state.goalReturn = state.screen === 'profile' ? 'profile' : 'home'; go('goal'); },

  // Practice: topic practice and the mini mock
  'practice-topic': (el) => startPractice(el.dataset.label, el.dataset.topic),
  'mock-intro': () => go('mock-intro'),
  'mock-start': () => {
    if (!hasPlus() && mocksLeftToday() < 1) { toast('Today’s free mock is done. A new one is ready tomorrow.'); return; }
    state.mock = createMock({ exam: data().exam, playerKey: data().profile.nickname.toLowerCase(), paused: pausedTemplates() });
    saveMock();
    go('mock');
    startMockClock();
  },
  'mock-choose': (el) => { choose(state.mock, Number(el.dataset.index)); saveMock(); render({ keepScroll: true }); },
  'mock-go': (el) => { if (goTo(state.mock, Number(el.dataset.index))) { saveMock(); render(); window.scrollTo(0, 0); } },
  'mock-mark': () => { toggleMark(state.mock); saveMock(); render({ keepScroll: true }); },
  'mock-clear': () => { clearChoice(state.mock); saveMock(); render({ keepScroll: true }); },
  'mock-next': () => {
    const m = state.mock;
    const next = nextIndex(m);
    if (next === null) {
      // End of a section: ask before moving on (a finished section cannot be reopened), or submit.
      state.sheet = m.sectional && m.section < m.sections.length - 1 ? 'section-end' : 'mock-submit';
      render({ keepScroll: true });
      return;
    }
    goTo(m, next);
    saveMock();
    render();
    window.scrollTo(0, 0);
  },
  'mock-section-next': () => {
    if (!nextSection(state.mock)) return;
    state.sheet = null;
    saveMock();
    toast(`${state.mock.sections[state.mock.section].name} section started`);
    render();
    window.scrollTo(0, 0);
  },
  'mock-submit-ask': () => { state.sheet = 'mock-submit'; render({ keepScroll: true }); },
  'mock-submit': () => finishMock(),

  // Home and settings
  'set-topic': (el) => { store.update((s) => { s.settings.topic = el.dataset.value; }); render({ keepScroll: true }); },
  'open-settings': () => { state.sheet = 'settings'; render({ keepScroll: true }); },
  'set-setting': (el) => { store.update((s) => { s.settings[el.dataset.group] = el.dataset.value; }); render({ keepScroll: true }); },
  'start-duel': () => startSoloDuel(),
  // Ranks: "Play to climb" starts a duel that counts (exam level, exam marking).
  'quick-ranked': () => {
    store.update((s) => { s.settings.level = 'exam'; s.settings.marking = 'exam'; });
    startSoloDuel();
  },

  // Duel
  answer: (el) => submitAnswer(el.dataset.index === 'skip' ? null : Number(el.dataset.index)),
  'next-question': () => nextOrFinish(),
  'leave-duel': () => { if (state.duel?.status === 'playing' && onLastReveal()) nextOrFinish(); else openLeave(); },
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
    // Practice is unlimited, so "Practise again" never asks for a free duel.
    if (prev.kind === 'practice') { startPractice(prev.practiceTopic, prev.topic); return; }
    if (!requireFreeDuel()) return;
    startDuel({ kind: 'rematch', seed: prev.seed, topic: prev.topic, level: prev.level, marking: prev.marking, rival: prev.rival, exam: prev.exam });
  },
  'copy-code': () => copyText(state.resultCode),
  'share-code': () => {
    const d = state.duel;
    const exam = getExam(d.exam);
    shareText({
      title: 'Takkar challenge',
      text: `I scored ${num(d.you)} out of ${maxScore(d.marking, d.exam, d.questions.length)} in ${exam ? `an ${exam.short}-pattern` : 'a'} Takkar duel. Same ten questions, can you beat me?\nPlay it here: ${WEB_APP_URL}?c=${encodeURIComponent(state.resultCode)}\nIn the Takkar app, tap "Have a challenge code?" and paste:\n${state.resultCode}`,
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
    startDuel({ kind: 'challenge', seed: c.seed, topic: c.topic, level: c.level, marking: c.marking, challenge: c, exam: c.exam });
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
      text: `${l.channel} is trying Takkar leagues: one ten-question duel a day in the exam's pattern, the same questions for everyone, and a weekly table. Leagues open to students soon; for now, practise free in your browser: ${WEB_APP_URL}\nFor aspirants aged 18 and over.`,
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
    toast(`“${el.dataset.value}” saved. This is a demo squad, so nothing is sent yet.`);
  },
  'invite-squad': () => {
    shareText({
      title: 'Play Takkar with me',
      text: `I practise on Takkar every day: ten questions in the real exam pattern (SSC CGL, IBPS PO or RRB NTPC), against a rival. Play free in your browser: ${WEB_APP_URL}`,
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
  'export-data': () => {
    // Phones get the share sheet; computers (mouse, no touch screen) get a file.
    if (IS_NATIVE || (navigator.share && matchMedia('(pointer: coarse)').matches)) shareText({ title: 'My Takkar data', text: store.exportJson() });
    else downloadText('takkar-my-data.json', store.exportJson());
  },
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
    toast(`Signed out. You are playing as a guest on ${HERE}.`);
    go(data().profile ? 'home' : 'welcome', { reset: true });
  },
  'ask-delete': () => { state.sheet = 'delete'; render({ keepScroll: true }); },
  'dismiss-guest-note': () => { store.update((s) => { s.guestNoteSeen = true; }); render({ keepScroll: true }); },
  'confirm-delete': async () => {
    if (signedIn()) {
      const res = await api('POST', '/account/delete', { auth: true });
      if (!res.ok && res.status !== 401) { toast(problem(res, 'Could not delete your account. Please try again.')); return; }
      await firebaseSignOut();
    }
    store.wipe();
    clearSavedMock();
    clearInterval(mockClock);
    Object.assign(state, {
      sheet: null, duel: null, mock: null, blocked: null, challengeDraft: emptyChallenge(), pendingChallenge: null,
      leagueDraft: { name: '', error: '' }, welcomeTried: false, auth: { busy: null, error: '' },
      examDraft: { exam: null, month: null, change: false }, goalDraft: null, goalReturn: null, afterResult: null, rulesThen: null,
    });
    toast('Your account and data are deleted');
    go('exam-pick', { reset: true });
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
  if (!fn) return;
  event.preventDefault();
  // The second tap of a double tap lands where the first one was, on the screen it just opened
  // (an answer, the next question, "Finish this section"). Ignore it.
  const now = performance.now();
  const double = now - lastTap.at < 500 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 32;
  lastTap = { x: event.clientX, y: event.clientY, at: now };
  if (double && now < inputLockUntil) return;
  lastActionSig = signature(target);
  fn(target, event);
});

app.addEventListener('input', (event) => {
  const el = event.target;
  const kind = el.dataset.input;
  if (kind === 'nick' || kind === 'age') checkSetupForm();
  if (kind === 'channel') {
    state.leagueDraft.name = el.value;
    // The preview follows the name as it is typed, without redrawing the page.
    const shown = el.value.trim() || 'Your channel';
    const set = (id, text) => { const n = document.getElementById(id); if (n) n.textContent = text; };
    set('lp-name', shown);
    set('lp-initials', shown.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase());
    set('lp-code', leagueCode(shown));
  }
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
  if (state.sheet && event.key === 'Escape') { event.preventDefault(); closeSheet(); return; }
  if (state.sheet && event.key === 'Tab') {
    // Keep keyboard focus inside the open sheet.
    const items = [...app.querySelectorAll('.sheet button:not([disabled]), .sheet input, .sheet textarea, .sheet a[href]')];
    if (items.length) {
      const i = items.indexOf(document.activeElement);
      if (event.shiftKey && i <= 0) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && (i === -1 || i === items.length - 1)) { event.preventDefault(); items[0].focus(); }
    }
    return;
  }
  if (event.key === 'Enter' && event.target.id === 'code') { event.preventDefault(); actions['check-code'](); return; }
  if (state.screen !== 'duel' || state.sheet || event.target.matches('input, textarea')) return;
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  const key = event.key.toLowerCase();
  if (state.phase === 'question') {
    const index = 'abcd'.indexOf(key) >= 0 ? 'abcd'.indexOf(key) : '1234'.indexOf(key);
    if (index >= 0) { event.preventDefault(); submitAnswer(index); }
    else if (key === 's' && state.duel.marking === 'exam') { event.preventDefault(); submitAnswer(null); }
  } else if ((key === 'enter' || key === ' ') && !event.target.closest('button, a, summary')) {
    // On a focused button (Flag, Leave) Enter and Space press that button instead.
    event.preventDefault();
    nextOrFinish();
  }
});

onBackButton(() => back());

enableTabSwipe(app, {
  order: TABS,
  current: () => (TAB_SCREENS.includes(state.screen) && app.querySelector('.screen--tab') ? (state.screen === 'ranks' ? 'league' : state.screen) : null),
  allowed: () => !state.sheet,
  change: (tab) => { vibrate(8); go(tab); },
});

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

// ---------- Web: links into the app, the browser's back button, offline cache ----------

/**
 * ?c=CODE opens a friend's challenge (WEB_APP_URL links in shared messages);
 * ?open=challenge or ?open=plus come from the website's buttons.
 */
function openLinkTarget() {
  const params = new URLSearchParams(location.search);
  const code = params.get('c');
  const open = params.get('open');
  const examParam = params.get('exam');
  if (examParam && EXAMS[examParam] && !data().exam) {
    // From the website's "I'm preparing for…" picker: the exam is chosen, ask the month next.
    state.examDraft = { exam: examParam, month: null, change: false };
    state.stack = ['exam-pick'];
    state.screen = 'exam-month';
  } else if (examParam && EXAMS[examParam] && data().profile && data().exam !== examParam) {
    // A player who picked another exam on the website: offer the switch (Back keeps the old one).
    state.examDraft = { exam: examParam, month: null, change: true, returnTo: 'home' };
    state.stack = ['home'];
    state.screen = 'exam-month';
  }
  if (!code && !open) { if (examParam) history.replaceState(history.state, '', location.pathname); return; }
  history.replaceState(history.state, '', location.pathname); // a reload should not reopen it
  const hasProfile = !!data().profile;
  if (code) {
    const result = decodeChallenge(code);
    if (!result.ok && !hasProfile) state.linkError = `That challenge link did not work: ${result.reason}`;
    if (result.ok && !hasProfile) {
      state.pendingChallenge = result.challenge;
      // The friend's exam is a good first guess for a new player.
      if (!data().exam) { state.examDraft = { exam: result.challenge.exam, month: null, change: false }; state.screen = 'exam-pick'; }
      else state.screen = 'welcome';
      return;
    }
    if (hasProfile) {
      state.challengeDraft = result.ok ? { ...emptyChallenge(), challenge: result.challenge } : { codeText: code, error: result.reason, challenge: null };
      state.stack = ['home'];
      state.screen = 'challenge-entry';
    }
    return;
  }
  if (hasProfile && open === 'challenge') { state.stack = ['home']; state.screen = 'challenge-entry'; }
  if (hasProfile && open === 'plus') { state.stack = ['home']; state.screen = 'plus'; }
  // From the website: the league demo (educators), and the report form (contact page).
  if (hasProfile && data().exam && open === 'league') state.screen = 'league';
  if (open === 'report') {
    state.report = { kind: 'app_problem', details: '', nickname: '', error: '', busy: false };
    state.sheet = 'report';
  }
}

if (!IS_NATIVE) {
  // One extra history entry catches the browser's back button, so it works inside Takkar
  // (closing sheets, leaving screens) and only leaves the site from Home. Browsers ignore
  // entries added before the first tap, so it is added then.
  let guarded = false;
  const guard = () => {
    if (guarded) return;
    guarded = true;
    history.pushState({ takkar: true }, '');
  };
  // Not "once": when Back at Home finds no page to go back to (an installed app, a new tab),
  // the next tap arms the guard again.
  addEventListener('pointerdown', guard, { capture: true });
  addEventListener('keydown', guard, { capture: true });
  addEventListener('popstate', () => {
    if (!guarded) return;
    if (atRoot()) { guarded = false; history.back(); return; }
    back();
    history.pushState({ takkar: true }, '');
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}

// ---------- Start ----------

// Exam first: new players, and players from before exams, choose one before anything else.
state.screen = !data().exam ? 'exam-pick' : data().profile ? 'home' : 'welcome';
openLinkTarget();
// A mini mock that was running when the page closed comes back where it was.
const resumedMock = state.screen === 'home' && restoreMock();
render();
if (resumedMock) { startMockClock(); toast('Your mini mock is back where you left it.'); }
if (state.linkError) { toast(state.linkError); state.linkError = ''; }
const intro = playIntro({ once: !IS_NATIVE });
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
