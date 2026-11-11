// Takkar app: navigation, sign-in, the duel loop, actions, and keeping in step with the server.
import { store, signedIn, hasPlus, plusTrialOpen, freeDuelsLeft, freeDuelsPerDay, recordStreakDay, liveStreak, weeklyTotal, rankedDuelsToday, correctThisWeek, topicStats, bestScore } from './store.js';
import { createDuel, startQuestion, answerQuestion, nextQuestion, abandonDuel, toHistory, maxScore } from './game.js';
import { encodeChallenge, decodeChallenge } from './code.js';
import { weeklyBoard, SQUAD } from './demo.js';
import { istDay } from './time.js';
import { nicknameError, usernameError, usernameFrom, leagueNameError } from './validate.js';
import { esc, num, toast, announce, shareText, copyText, downloadText, openExternal, onBackButton, exitApp, vibrate } from './ui.js';
import { APP_VERSION, APP_BUILD, TERMS_VERSION, IS_NATIVE, HERE, WEB_APP_URL, SITE_URL, OLD_WEB_HOST, APK_URL, apiBase } from './config.js';
import { liveStart, liveInvite, liveLobby, mmss } from './screens/live.js';
import { testsSection, scheduleScreen, scheduleWindowText, testScreen, submitSheet as ltSubmitSheet, startSheet as ltStartSheet, doneScreen as ltDoneScreen, reportScreen as ltReportScreen, progressScreen as ltProgressScreen, insightsScreen as ltInsightsScreen, classScreen, confirmSheet as ltConfirmSheet, studentsCsv, paperText, runCounts, untilText } from './screens/livetest.js';
import { scheduleError, clock } from './livetest-rules.js';
import { api, problem, setSessionToken } from './api.js';
import { signInAvailable, googleSignIn, sendPhoneCode, confirmPhoneCode, firebaseSignOut } from './auth.js';
import { canSelfUpdate, downloadUpdate, installAllowed, openInstallSettings, installUpdate } from './updater.js';
import { refreshConfig, refreshAccount, syncDuels, flushOutbox, sendOrQueue, completeSignIn, signOutHere } from './sync.js';
import { playIntro } from './intro.js';
import { initSystemBars, matchSystemBars } from './systembars.js';
import { remindersAvailable, notificationPermission, planDaily, planTests, applyPlan, onReminderTap, REMINDER_TIMES, DEFAULT_REMINDER_TIME, timeLabel } from './reminders.js';
import { educatorScreen, educatorItem } from './screens/educator.js';
import { topicSlug } from './topics.js';
import { EDUCATOR_TERMS_VERSION, MAX_EXAMS, needsLink, centreNameError, linkError, audienceError } from './educator-rules.js';
import { EXAMS, getExam } from './exams.js';
import { generateSet, CURRENT_SET } from './engine/index.js';
import { randomSeed } from './engine/rng.js';
import { createMock, goTo, choose, clearChoice, toggleMark, nextIndex, nextSection, submitMock, mockToHistory } from './mock.js';
import { examPick, examMonth, examRules, goalScreen } from './screens/exam.js';
import { practiceScreen, mockIntro, mockScreen, mockSubmitSheet, sectionEndSheet, mockResult, topicsBySection } from './screens/practice.js';
import { enableTabSwipe } from './swipe.js';
import { welcome } from './screens/welcome.js';
import { phoneScreen, profileSetup, pausedScreen, updateScreen, updateSheet, blockedScreen, reportSheet, UID_HELP } from './screens/signin.js';
import { home, settingsSheet } from './screens/home.js';
import { duelScreen, leaveSheet } from './screens/duel.js';
import { resultScreen } from './screens/result.js';
import { challengeEntry } from './screens/challenge.js';
import { leagueHome, leagueCreate, leagueJoin, leaguePage, leagueConfirmSheet } from './screens/league.js';
import { cleanLeagueCode, isLeagueCode, realNameError, cleanRealName } from './league-rules.js';
import { ranksScreen, featureOff } from './screens/social.js';
import { squadGate, squadHome, squadCreate, squadJoin, squadPage, squadMemberSheet, squadConfirmSheet } from './screens/squads.js';
import { cleanCode, CODE_LENGTH, SQUAD_MAX } from './squad-rules.js';
import { plusScreen, profileScreen, deleteSheet, signOutSheet, nicknameScreen, usernameScreen } from './screens/account.js';

const app = document.getElementById('app');
const FIRST_TITLE = document.title;
const TABS = ['home', 'practice', 'league', 'squad', 'profile'];
// Ranks sits inside League (a segment), but behaves like a tab.
const TAB_SCREENS = [...TABS, 'ranks'];
// Screens past onboarding that need an exam (Practice, mocks and the duel rules follow it).
const NEEDS_EXAM = new Set([...TAB_SCREENS, 'mock-intro', 'mock', 'goal']);
const BETA_URL = `${SITE_URL}/beta`;

const emptyChallenge = () => ({ codeText: '', error: '', challenge: null });
/** Forgets what belonged to the last signed-in account (squads, leagues, educator application). */
function resetAccountState() {
  state.sq = emptySquads();
  state.lg = emptyLeagues();
  state.edu = emptyEducator();
}
// Tutor leagues (screens/league.js): the League tab, invites, league pages.
// Live tests in tutor leagues (screens/livetest.js): the open league's tests, the schedule form, a test being sat.
const emptyLiveTests = () => ({ leagueId: null, list: null, listError: '', paused: false, offset: 0, form: null, formError: '', busy: false, run: null, done: null, report: null, prog: null, ins: null, cls: null, clsError: '', sheetTest: null });
const emptyLeagues = () => ({
  list: null, loading: false, error: '', code: '', codeError: '',
  invite: null, preview: null, previewError: '', realName: '', consent: false, joinError: '', consentError: '',
  draft: { name: '', exam: null, approval: true }, createError: '', busy: false,
  id: null, page: null, pageLoading: false, pageError: '', confirm: null,
});
// For tutors: the educator application (screens/educator.js).
const emptyEducator = () => ({
  data: null, loading: false, error: '', busy: false, fieldErrors: {},
  form: { name: '', platform: '', link: '', audience: '', exams: [], terms: false },
});
const emptySquads = () => ({
  loaded: false, loading: false, error: '', code: '', codeError: '', // the list and "Have a squad code?"
  name: '', exam: null, createError: '', busy: false, // start a squad
  invite: null, preview: null, previewError: '', // an invite being looked at
  id: null, page: null, pageLoading: false, pageError: '', // the open squad
  member: null, confirm: null, // sheets
});
const state = {
  screen: 'welcome',
  stack: [],
  sheet: null,
  notifyGranted: false, // Android lets Takkar show notifications (reminders.js); checked on start and resume
  duel: null,
  phase: 'question',
  last: null,
  flagged: false,
  resultCode: '',
  leagueNote: '',
  challengeDraft: emptyChallenge(),
  pendingChallenge: null,
  lg: emptyLeagues(), // League tab, league invites and pages
  lt: emptyLiveTests(),
  plusReason: '',
  upd: null, // in-app update: { phase: 'download' | 'ready' | 'permission' | 'error', percent, version, error }
  welcomeTried: false,
  auth: { busy: null, error: '' }, // welcome screen
  phone: { step: 'number', number: '', verificationId: null, error: '', busy: false, resendAt: 0 },
  // username: the user ID box (signed-in accounts); uid: what the server said about it ({ value, taken, suggestion }).
  setup: { mode: 'guest', provider: null, idToken: null, nickname: '', username: '', uidEdited: false, uid: null, error: '', busy: false },
  report: { kind: 'app_problem', details: '', nickname: '', error: '', busy: false },
  blocked: null, // { code, message, until } from the server
  examDraft: { exam: null, month: null, change: false }, // onboarding or You → Exam
  goalDraft: null,
  afterResult: null, // 'goal' after the first duel
  mock: null,
  nick: { value: '', error: '', busy: false }, // You → Change nickname
  uidEdit: { value: '', error: '', suggestion: null, busy: false }, // You → Change user ID
  rulesThen: null, // 'challenge': after the rules screen, open the challenge that brought them here
  goalReturn: null, // where "Set my goal" goes back to
  linkError: '', // a challenge link that did not work, shown once the first screen is up
  sq: emptySquads(), // Squad tab, squad pages and invites
  edu: emptyEducator(), // For tutors: educator application
  pendingSquad: null, // an invite code waiting for sign-in
  pendingDuel: null, // a live duel code waiting for sign-in
  // A live friend duel (design/03 §3.1): { code, link, sock, lobby, status: connecting | lobby | live | expired, error, retries, reconnecting }
  live: null,
  liveForm: { code: '', error: '', busy: null },
  livePreview: { preview: null, error: '' },
  pendingLeague: null, // a league code waiting for sign-in
  pendingEducator: false, // the tutors page sent them to apply; open it after sign-in
  pendingPractice: null, // ?practice=topic from a website practice page: { label, topic }
};

let ticker = null;
let resendTimer = null;
let lastSheet = null;
const data = () => store.get();
/** The question language: 'hi' or 'en' (design/01 §1.5). */
const qlang = () => (data().settings?.qlang === 'hi' ? 'hi' : 'en');
const config = () => data().config;

// ---------- What the admin controls ----------

const isPaused = () => config()?.paused === true;
const mustUpdate = () => IS_NATIVE && !!config() && APP_BUILD < (config().app?.minBuild ?? 1);
const updateUrl = () => config()?.app?.updateUrl || BETA_URL;
const apkUrl = () => config()?.app?.apkUrl || APK_URL;
const latestBuild = () => config()?.app?.latestBuild ?? 1;
const updateSnoozed = () => { const z = data().updateSnooze; return !!z && z.build === latestBuild() && Date.now() < z.until; };
const updateAvailable = () => IS_NATIVE && !!config() && APP_BUILD < latestBuild() && !updateSnoozed();
const switchOn = (name) => config()?.switches?.[name] !== false;
const pausedTemplates = () => config()?.pausedTemplates || [];
const announcements = () => (config()?.announcements || []).filter((a) => !data().seenAnnouncements.includes(a.id));

// ---------- Rendering ----------

/** Finished duels, practice sets and mocks today: they all count for the daily goal. */
const goalDoneToday = () => data().history.filter((h) => h.day === istDay() && h.status === 'finished').length;

/** Where the result screen goes back to. */
const resultHome = () => ({ practice: 'practice', league: 'league' })[state.duel?.kind] || 'home';
const squadNotice = (res, fallback) => (res.offline ? 'You are offline. Try again when you are back online.' : problem(res, fallback));

function view() {
  const d = data();
  if (!d.exam && d.profile && NEEDS_EXAM.has(state.screen)) {
    state.examDraft = { exam: null, month: null, change: false };
    state.screen = 'exam-pick';
    state.stack = [];
  }
  // Screens the admin can put in front of everything (the duel in progress finishes first).
  if (state.screen !== 'duel' && state.screen !== 'result') {
    if (mustUpdate()) return updateScreen();
    if (isPaused()) return pausedScreen();
    if (state.blocked) return blockedScreen(state.blocked);
  }
  const exam = getExam(d.exam);
  const scale = exam ? (exam.marks * 10) / 40 : 1; // sample players' scores in this exam's marks
  switch (state.screen) {
    case 'exam-pick':
      return examPick({ selected: state.examDraft.exam, canGoBack: state.examDraft.change });
    case 'exam-month':
      return examMonth({ exam: state.examDraft.exam, month: state.examDraft.month, switchFrom: state.examDraft.change && d.exam && d.exam !== state.examDraft.exam ? d.exam : null });
    case 'exam-rules':
      // "Before your first duel" only in onboarding; from You it is a page with a back button.
      return examRules({ exam: d.exam || state.examDraft.exam, first: !d.rulesSeen && !state.stack.length, returning: d.history.length > 0, qlang: d.settings.qlang || null });
    case 'goal':
      return goalScreen({ goal: state.goalDraft, remind: remindersAvailable() && !(data().settings.reminders && state.notifyGranted) ? !!state.goalRemind : null });
    case 'practice':
      return practiceScreen({ exam: d.exam, stats: topicStats(), mocksLeft: mocksLeftToday(), plus: hasPlus() });
    case 'mock-intro':
      return mockIntro({ exam: d.exam, mocksLeft: mocksLeftToday(), plus: hasPlus() });
    case 'mock':
      return mockScreen({ mock: state.mock, timeLeft: Math.max(0, state.mock.deadline - Date.now()), lang: qlang() });
    case 'mock-result':
      return mockResult({ mock: state.mock, lang: qlang() });
    case 'welcome':
      return welcome({ pendingChallenge: state.pendingChallenge, signInReady: signInAvailable(config()), phoneReady: config()?.auth?.phone === true, busy: state.auth.busy, error: state.auth.error, exam: getExam(d.exam || state.examDraft.exam) });
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
        squads: signedIn() && switchOn('squads') ? d.squads : null,
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
        moved: onOldAddress ? { signedIn: signedIn(), url: WEB_APP_URL } : null,
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
        lang: qlang(),
      });
    }
    case 'result':
      return resultScreen({ duel: state.duel, code: state.resultCode, leagueNote: state.leagueNote, lang: qlang() });
    case 'challenge-entry':
      return challengeEntry(state.challengeDraft);
    case 'league':
      if (!switchOn('leagues')) return featureOff('league', 'League');
      if (signedIn() && !state.lg.list && !state.lg.loading && !state.lg.error) queueMicrotask(loadLeagues);
      return leagueHome({ lg: state.lg, signedIn: signedIn(), signInReady: signInAvailable(config()) });
    case 'league-create':
      if (!switchOn('leagues')) return featureOff('league', 'League');
      return leagueCreate({ draft: state.lg.draft, error: state.lg.createError, busy: state.lg.busy });
    case 'league-join':
      if (!switchOn('leagues')) return featureOff('league', 'League');
      return leagueJoin({ lg: state.lg, signedIn: signedIn(), signInReady: signInAvailable(config()) });
    case 'league-page':
      if (!switchOn('leagues')) return featureOff('league', 'League');
      return leaguePage({ page: state.lg.page, loading: state.lg.pageLoading, error: state.lg.pageError, busy: state.lg.busy, tests: ltSection() });
    case 'lt-schedule':
      return scheduleScreen({ form: state.lt.form, error: state.lt.formError, busy: state.lt.busy, exam: state.lg.page?.league.exam || d.exam });
    case 'lt-test':
      return testScreen({ run: state.lt.run, timeLeft: ltTimeLeft(), lang: qlang() });
    case 'lt-done':
      return ltDoneScreen(state.lt.done);
    case 'lt-report':
      return ltReportScreen({ test: state.lt.report.test, report: state.lt.report.report, student: state.lt.report.student || null, stacked: !!state.lt.report.stacked, lang: qlang() });
    case 'lt-insights':
      return ltInsightsScreen({ data: state.lt.ins?.data || null, error: state.lt.ins?.error || '', lang: qlang() });
    case 'lt-progress':
      return ltProgressScreen({ data: state.lt.prog?.data || null, error: state.lt.prog?.error || '', lang: qlang() });
    case 'lt-class':
      return classScreen({ data: state.lt.cls, error: state.lt.clsError, lang: qlang(), busy: state.lt.busy });
    case 'squad': {
      if (!switchOn('squads')) return featureOff('squad', 'Squad');
      if (!signedIn()) return squadGate({ signInReady: signInAvailable(config()) });
      const sq = state.sq;
      return squadHome({ list: sq.loaded ? d.squads : d.squads.length ? d.squads : null, loading: sq.loading, error: sq.error, code: sq.code, codeError: sq.codeError, max: SQUAD_MAX });
    }
    case 'educator':
      return educatorScreen({ edu: state.edu, signedIn: signedIn(), google: isGoogle(), signInReady: signInAvailable(config()) });
    case 'squad-create':
      return squadCreate({ name: state.sq.name, exam: state.sq.exam, error: state.sq.createError, busy: state.sq.busy });
    case 'squad-join':
      return squadJoin({ preview: state.sq.preview, error: state.sq.previewError, busy: state.sq.busy, signedIn: signedIn(), signInReady: signInAvailable(config()) });
    case 'squad-page': {
      const page = state.sq.page;
      const view = page && !page.you.playedToday && playedSquadToday(page.squad.id, page.today.seed, page.today.day)
        ? { ...page, you: { ...page.you, playedToday: true } } : page;
      return squadPage({ page: view, loading: state.sq.pageLoading, error: state.sq.pageError, canPlay: !page || page.today.set <= CURRENT_SET });
    }
    case 'ranks':
      return ranksScreen({ board: weeklyBoard(d.profile.nickname, weeklyTotal(), scale), rankedToday: rankedDuelsToday(), exam });
    case 'nickname':
      return nicknameScreen({ ...state.nick, signedIn: signedIn() });
    case 'username':
      return usernameScreen(state.uidEdit);
    case 'live-start':
      return liveStart({ ...state.liveForm, signedIn: signedIn(), signInReady: signInAvailable(config()) });
    case 'live-invite':
      return liveInvite({ ...state.livePreview, signInReady: signInAvailable(config()) });
    case 'live-lobby':
      return liveLobby({ lobby: state.live?.lobby, status: state.live?.status, error: state.live?.error, reconnecting: state.live?.reconnecting, now: Date.now(), link: state.live?.link, canShare: IS_NATIVE || !!navigator.share });
    case 'plus':
      const demoPlus = !!d.plus && plusTrialOpen();
      return plusScreen({ plus: demoPlus, plusUntil: !demoPlus && hasPlus() ? d.account.plusUntil : null, trialOpen: plusTrialOpen(), reason: state.plusReason, freePerDay: freeDuelsPerDay() });
    case 'profile': {
      const stats = topicStats();
      const finished = d.history.filter((h) => h.status === 'finished');
      // Only the player's own answers count (the squad's sample members are demo data).
      const ownWeek = correctThisWeek();
      // Earned badges stay earned, even after the week ends.
      if (ownWeek >= SQUAD.target && !d.badges.squad) store.update((s) => { s.badges.squad = true; });
      if (isGoogle() && !state.edu.data && !state.edu.loading && !state.edu.error) queueMicrotask(loadEducator);
      return profileScreen({
        data: d,
        reminders: remindersAvailable() ? { on: !!d.settings.reminders && state.notifyGranted, blocked: !!d.settings.reminders && !state.notifyGranted, time: reminderTime(), times: REMINDER_TIMES.map((t) => [t, timeLabel(t)]), tests: testRemindersOn() && state.notifyGranted } : null,
        educator: educatorItem(state.edu),
        isEducator: !!state.edu.data?.educator,
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
  if (state.sheet === 'lt-submit' && state.lt.run) return ltSubmitSheet({ run: state.lt.run, timeLeft: ltTimeLeft() });
  if (state.sheet === 'lt-start' && state.lt.sheetTest) return ltStartSheet({ test: state.lt.sheetTest });
  if (state.sheet === 'lt-cancel' && state.lt.sheetTest) return ltConfirmSheet({ kind: 'cancel', test: state.lt.sheetTest });
  if (state.sheet === 'lt-release' && state.lt.cls) return ltConfirmSheet({ kind: 'release', test: state.lt.cls.test, sat: state.lt.cls.sat });
  if (state.sheet === 'section-end') return sectionEndSheet({ mock: state.mock, timeLeft: Math.max(0, state.mock.deadline - Date.now()) });
  if (state.sheet === 'leave') return leaveSheet({ kind: state.duel?.kind });
  if (state.sheet === 'delete') return deleteSheet({ signedIn: signedIn() });
  if (state.sheet === 'sign-out') return signOutSheet();
  if (state.sheet === 'report') return reportSheet(state.report);
  if (state.sheet === 'update') return updateSheet(state.upd);
  if (state.sheet === 'league-confirm') return leagueConfirmSheet(state.lg.confirm);
  if (state.sheet === 'squad-member') return squadMemberSheet(state.sq.member);
  if (state.sheet === 'squad-confirm') {
    const s = state.sq.page.squad;
    return squadConfirmSheet({ kind: state.sq.confirm, name: s.name, owner: state.sq.page.you.role === 'owner', members: s.members });
  }
  return '';
}

const TITLES = {
  home: 'Home', practice: 'Practice', league: 'League', ranks: 'Ranks', squad: 'Squad', profile: 'You', plus: 'Plus', nickname: 'Nickname', username: 'User ID', 'live-start': 'Duel a friend', 'live-invite': 'Live duel', 'live-lobby': 'Live duel',
  'lt-schedule': 'Schedule a test', 'lt-test': 'Live test', 'lt-done': 'Test submitted', 'lt-report': 'Test report', 'lt-progress': 'Progress', 'lt-insights': 'Class insights', 'lt-class': 'Class report',
  educator: 'For tutors', 'league-create': 'Create a league', 'league-join': 'League invite', 'league-page': 'League', 'squad-create': 'Start a squad', 'squad-join': 'Squad invite', 'squad-page': 'Squad',
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

let introPlaying = false;
const syncSystemBars = () => matchSystemBars(introPlaying || !!app.querySelector('.screen--arena'));

function render({ keepScroll = false, enterFrom = null } = {}) {
  if (state.live && state.live.status !== 'live' && state.screen !== 'live-lobby') dropLiveLobby();
  const y = window.scrollY;
  const active = document.activeElement;
  const activeSig = active && active !== document.body && app.contains(active) ? signature(active) : null;
  app.innerHTML = view() + sheetView();
  syncSystemBars();
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
    // New visitors (and search engines) keep the page's own title; players see the screen's name.
    document.title = !data().profile ? FIRST_TITLE : TITLES[state.screen] ? `${TITLES[state.screen]} · Takkar` : 'Takkar';
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
  if (screen === 'squad' && signedIn() && switchOn('squads')) loadSquads();
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
  if (state.screen === 'lt-test' && state.lt.run) return false;
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
  if (state.screen === 'lt-test' && state.lt.run) { ltLeaveQuestion(); state.sheet = 'lt-submit'; render({ keepScroll: true }); return; }
  // A report opened from the league page goes back to it afresh; one opened from a progress page goes back there.
  if (state.screen === 'lt-done' || (state.screen === 'lt-report' && !state.lt.report?.stacked)) { ltBackToLeague(); return; }
  if (state.screen === 'mock-result') { go('practice', { reset: true }); return; }
  if (state.screen === 'exam-pick' && !data().exam) { exitApp(); return; }
  if (state.screen === 'result' && state.duel?.kind === 'squad') { openSquad(state.duel.squad.id); return; }
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
  if (status && duel.kind === 'live') {
    const text = `${duel.live.opponent.nickname} ${duel.live.oppAnswered > duel.index ? 'answered' : state.phase === 'reveal' ? 'is still answering' : 'is thinking'}`;
    if (status.textContent !== text) status.textContent = text;
  } else if (status && bot) {
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
  state.plusReason = `You have used today’s ${freeDuelsPerDay()} free duels. Come back tomorrow${plusTrialOpen() ? ', or try Plus' : ''}.`;
  go('plus', { keepReason: true });
  return false;
}

// ---------- Live friend duel (design/03-duels-squads-leagues-rooms.md §3.1) ----------
// The server (a DuelRoom) keeps the clock and the score and sends one question at a time;
// the duel and result screens are the usual ones, with the friend in place of the bot.

let liveClock = null;
function startLiveClock() {
  clearInterval(liveClock);
  liveClock = setInterval(() => {
    const lobby = state.live?.lobby;
    if (state.screen !== 'live-lobby' || !state.live) { clearInterval(liveClock); liveClock = null; return; }
    if (!lobby) return;
    const now = Date.now();
    const title = document.getElementById('live-title');
    if (title && lobby.status === 'countdown') title.textContent = `Starting in ${Math.max(0, Math.ceil((lobby.startAt - now) / 1000))}…`;
    const left = document.getElementById('live-left');
    if (left) left.textContent = mmss(lobby.expiresAt - now);
  }, 250);
}
function closeLiveSocket() {
  const L = state.live;
  if (!L) return;
  L.closing = true;
  clearInterval(L.beat);
  if (!L.sock) return;
  try { L.sock.close(1000, 'bye'); } catch { /* gone */ }
  L.sock = null;
}
/** Away from the lobby before the duel starts (Back, a tab): the friend sees you go. */
function dropLiveLobby() {
  liveSend({ t: 'leave' });
  closeLiveSocket();
  state.live = null;
}
const liveSend = (msg) => { const ws = state.live?.sock; if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };
function renderLive() { if (state.screen === 'live-lobby') render({ keepScroll: true }); }

const LIVE_BEAT_MS = 20000;
function connectLive(ticket) {
  const L = state.live;
  if (!L) return;
  if (L.sock) { try { L.sock.close(); } catch { /* gone */ } }
  clearInterval(L.beat);
  L.closing = false;
  let ws;
  try { ws = new WebSocket(`${apiBase().replace(/^http/, 'ws')}/live/duel/${L.code}?ticket=${encodeURIComponent(ticket)}`); } catch { reconnectLive(); return; }
  L.sock = ws;
  L.lastSeen = Date.now();
  // A heartbeat: mobile networks can drop a connection without closing it. No reply in time, connect again.
  const beat = setInterval(() => {
    if (L !== state.live || L.sock !== ws) { clearInterval(beat); return; }
    if (ws.readyState !== 1) return;
    if (Date.now() - L.lastSeen > LIVE_BEAT_MS * 2 + 5000) {
      clearInterval(beat);
      L.sock = null;
      try { ws.close(); } catch { /* gone */ }
      reconnectLive({ now: true });
      return;
    }
    try { ws.send('ping'); } catch { /* closing */ }
  }, LIVE_BEAT_MS);
  L.beat = beat;
  ws.onmessage = (e) => {
    if (L !== state.live || L.sock !== ws) return;
    L.lastSeen = Date.now();
    if (e.data === 'pong') return;
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    L.retries = 0;
    if (L.reconnecting) { L.reconnecting = false; renderLive(); }
    onLiveMessage(m);
  };
  ws.onclose = () => {
    if (L !== state.live || L.sock !== ws) return;
    L.sock = null;
    if (L.closing || L.status === 'expired' || L.status === 'done') return;
    reconnectLive();
  };
}

/** A dropped connection comes back with a fresh ticket; the duel's clock never stopped (one rejoin at a time). */
async function reconnectLive({ now = false } = {}) {
  const L = state.live;
  if (!L || L.rejoining || L.closing) return;
  L.rejoining = true;
  L.reconnecting = true;
  L.error = '';
  renderLive();
  if (state.screen === 'duel') toast('Reconnecting…');
  try {
    for (;;) {
      if (L.retries >= 6) {
        L.reconnecting = false;
        L.error = 'Lost the connection. Check your internet and try again.';
        renderLive();
        if (state.screen === 'duel') toast('Lost the connection. It comes back when you are online.');
        return;
      }
      L.retries += 1;
      if (!now || L.retries > 1) await new Promise((r) => setTimeout(r, Math.min(8000, 800 * 2 ** (L.retries - 1))));
      if (L !== state.live || L.closing) return;
      const res = await api('POST', `/duels/friend/${L.code}/join`, { auth: true });
      if (L !== state.live || L.closing) return;
      if (res.ok) { connectLive(res.data.ticket); return; }
      if (res.status === 410) { L.status = 'expired'; L.reconnecting = false; renderLive(); return; }
      if (res.status >= 400 && res.status < 500 && res.status !== 429) { L.reconnecting = false; L.error = problem(res, 'Could not rejoin this duel.'); renderLive(); return; }
    }
  } finally {
    L.rejoining = false;
  }
}
/** Back in the app or back online: a duel whose connection dropped tries again straight away. */
function wakeLive() {
  const L = state.live;
  if (!L || !L.code || L.closing || L.rejoining || L.status === 'expired' || L.status === 'done') return;
  if (L.sock && L.sock.readyState <= 1) return;
  L.retries = 0;
  reconnectLive({ now: true });
}

async function startLive({ squadId = null, invitee = null } = {}) {
  if (!signedIn()) { go('live-start'); return; }
  closeLiveSocket();
  state.live = { code: null, link: '', status: 'connecting', lobby: null, error: '', retries: 0 };
  go('live-lobby');
  const res = await api('POST', '/duels/friend', { auth: true, body: { exam: data().exam || null, ...(squadId ? { squadId, invitee } : {}) } });
  if (!state.live || state.live.code) return;
  if (!res.ok) { state.live.error = res.offline ? 'You are offline. Try again when you are back online.' : problem(res, 'Could not open a duel. Please try again.'); renderLive(); return; }
  state.live.code = res.data.duel.code;
  state.live.link = res.data.duel.link;
  connectLive(res.data.ticket);
  startLiveClock();
}

async function joinLive(raw) {
  const code = String(raw || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (code.length !== 6) { state.liveForm = { ...state.liveForm, code, error: 'A duel code has 6 letters.' }; render({ keepScroll: true }); return; }
  state.liveForm = { code: '', error: '', busy: null };
  if (!signedIn()) {
    state.pendingDuel = code;
    state.livePreview = { preview: null, error: '' };
    go('live-invite');
    const res = await api('GET', `/duels/friend/${code}`);
    state.livePreview = res.ok ? { preview: res.data.duel, error: '' } : { preview: null, error: problem(res, 'Could not open this duel.') };
    if (state.screen === 'live-invite') render();
    return;
  }
  closeLiveSocket();
  state.live = { code, link: `${WEB_APP_URL}?duel=${code}`, status: 'connecting', lobby: null, error: '', retries: 0 };
  go('live-lobby');
  const res = await api('POST', `/duels/friend/${code}/join`, { auth: true });
  if (!state.live || state.live.code !== code) return;
  if (!res.ok) {
    if (res.status === 410) state.live.status = 'expired';
    else state.live.error = res.offline ? 'You are offline. Try again when you are back online.' : problem(res, 'Could not join this duel.');
    renderLive();
    return;
  }
  state.live.link = res.data.duel.link;
  connectLive(res.data.ticket);
  startLiveClock();
}

function onLiveMessage(m) {
  const L = state.live;
  if (m.t === 'lobby') {
    // The server's times, on this phone's clock (which may be off).
    const now = Date.now();
    L.lobby = { ...m, expiresAt: now + m.closesInMs, startAt: m.startsInMs == null ? null : now + m.startsInMs };
    if (L.status !== 'live') L.status = 'lobby';
    renderLive();
  } else if (m.t === 'expired') {
    L.status = 'expired';
    closeLiveSocket();
    renderLive();
  } else if (m.t === 'question') {
    L.status = 'live';
    liveQuestion(m);
  } else if (m.t === 'reveal') {
    liveReveal(m);
  } else if (m.t === 'opp') {
    const duel = state.duel;
    if (duel?.kind !== 'live') return;
    duel.them = m.score;
    duel.live.oppAnswered = m.answered;
    if (state.screen === 'duel') render({ keepScroll: true });
  } else if (m.t === 'done') {
    liveDone(m);
  }
}

/** The live duel as the duel and result screens know it; questions fill in as the server sends them. */
function newLiveDuel(L, { total, limitMs, exam, opponent }) {
  state.stack = [];
  state.sheet = null;
  state.leagueNote = '';
  return {
    id: `live-${L.code}`, kind: 'live', seed: 0, set: CURRENT_SET, topic: 'mixed', level: 'exam', marking: 'exam', rival: null,
    exam: exam || data().exam, day: istDay(), limitMs, bot: null, index: 0, answers: [], you: 0, them: 0, status: 'playing',
    questions: Array.from({ length: total }, () => ({ text: '', options: [], answerIndex: -1, answerText: '', steps: [], label: '', topic: '' })),
    live: { code: L.code, opponent: { nickname: opponent?.nickname || 'Your friend', username: opponent?.username || null }, oppAnswered: 0, done: null, waitingForEnd: false },
    questionStartedAt: Date.now(),
  };
}

function liveQuestion(m) {
  const L = state.live;
  let duel = state.duel;
  if (duel?.kind !== 'live' || duel.live.code !== L.code) {
    duel = state.duel = newLiveDuel(L, { total: m.total, limitMs: m.limitMs, exam: L.lobby?.exam?.id, opponent: L.lobby?.players?.[L.lobby.you === 'host' ? 'guest' : 'host'] });
  }
  duel.questions[m.i] = { ...m.q, answerIndex: -1, answerText: '', steps: [] };
  duel.index = m.i;
  duel.waiting = false;
  duel.questionStartedAt = Date.now() - Math.max(0, m.limitMs - m.leftMs);
  state.screen = 'duel';
  state.phase = 'question';
  state.last = null;
  state.flagged = false;
  render();
  window.scrollTo(0, 0);
  stopTicker();
  ticker = setInterval(tick, 250);
}

function liveReveal(m) {
  const duel = state.duel;
  if (duel?.kind !== 'live') return;
  const q = duel.questions[m.i];
  Object.assign(q, { answerIndex: m.answerIndex, answerText: m.answerText, steps: m.steps });
  if (q.hi && m.hi) Object.assign(q.hi, m.hi);
  const record = { index: m.i, topic: q.topic, label: q.label, type: q.type, choice: m.choice, timedOut: m.timedOut, correct: m.correct, points: m.points, timeMs: Math.min(duel.limitMs, Date.now() - duel.questionStartedAt), bot: null };
  duel.answers[m.i] = record;
  duel.index = m.i;
  duel.you = m.score;
  duel.waiting = false;
  stopTicker();
  state.last = record;
  state.phase = 'reveal';
  state.screen = 'duel';
  vibrate(m.correct ? 15 : 40);
  render();
  document.getElementById('next-btn')?.focus({ preventScroll: true });
}

/** The server's result: shown at once if the friend left or you were waiting, else after your last "Next". */
function liveDone(m) {
  let duel = state.duel;
  if (duel?.kind !== 'live' || duel.live.code !== state.live.code) {
    // It ended while this phone was away (closed, reloaded, offline): show the result now.
    duel = state.duel = newLiveDuel(state.live, { total: m.review.length, limitMs: m.exam.seconds * 1000, exam: m.exam.id, opponent: m.opponent });
    duel.live.done = m;
    finishLive();
    return;
  }
  duel.live.done = m;
  const onLast = state.phase === 'reveal' && duel.index === duel.questions.length - 1;
  if (m.youLeft || m.themLeft || duel.live.waitingForEnd || !onLast) finishLive();
  else render({ keepScroll: true });
}

function finishLive() {
  const duel = state.duel;
  const m = duel.live.done;
  stopTicker();
  if (state.live) { state.live.status = 'done'; closeLiveSocket(); }
  duel.questions = m.review.map((r) => ({ text: r.text, options: r.options, answerIndex: r.answerIndex, answerText: r.answerText, steps: r.steps, label: r.label, topic: r.topic, type: r.type, ...(r.hi ? { hi: r.hi } : {}) }));
  duel.answers = m.review.map((r, i) => (r.you ? { index: i, topic: r.topic, label: r.label, type: r.type, choice: r.you.choice, timedOut: r.you.timedOut, correct: r.you.correct, points: r.you.points, timeMs: r.you.timeMs, bot: null } : null)).filter(Boolean);
  duel.you = m.you;
  duel.them = m.them;
  duel.status = m.youLeft ? 'abandoned' : 'finished';
  Object.assign(duel.live, { verdict: m.verdict, review: m.review, opponent: m.opponent, themLeft: m.themLeft });
  // Saved by the server already (both players' duels), so this phone never uploads it.
  const record = { ...toHistory(duel), synced: true, serverId: m.duelIds, counted: !m.youLeft && !m.themLeft, rivalScore: m.them, verdict: m.youLeft ? null : m.verdict, opponent: m.opponent.nickname };
  store.update((s) => {
    if (s.history.some((h) => h.id === record.id)) return; // the same duel's result seen again
    s.history.push(record);
    if (s.history.length > 500) s.history.splice(0, s.history.length - 500);
    if (duel.status === 'finished') recordStreakDay(duel.day);
  });
  planDailyReminders();
  state.live = null;
  state.resultCode = '';
  state.screen = 'result';
  state.stack = [];
  state.sheet = null;
  render();
  window.scrollTo(0, 0);
}

function startSoloDuel() {
  if (!requireFreeDuel()) return;
  const s = data().settings;
  startDuel({ kind: 'solo', topic: s.topic, level: s.level, marking: s.marking, rival: s.rival });
}

function submitAnswer(choice) {
  if (state.phase !== 'question' || !state.duel) return;
  if (state.duel.kind === 'live') {
    if (state.duel.waiting) return;
    state.duel.waiting = true; // the server answers with the reveal
    stopTicker();
    liveSend({ t: 'answer', i: state.duel.index, choice: choice === 'timeout' ? null : choice });
    return;
  }
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
  if (state.duel.kind === 'live') {
    if (state.duel.index < state.duel.questions.length - 1) { liveSend({ t: 'next' }); return; }
    if (state.duel.live.done) { finishLive(); return; }
    state.duel.live.waitingForEnd = true;
    toast(`Waiting for ${state.duel.live.opponent.nickname} to finish (${state.duel.live.oppAnswered} of ${state.duel.questions.length} answered)…`);
    return;
  }
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
  if (duel.kind === 'squad') {
    const page = state.sq.page?.squad.id === duel.squad.id ? state.sq.page : null;
    const first = !playedSquadToday(duel.squad.id, duel.seed, duel.day) && !(page?.you.playedToday && page.today.day === duel.day);
    state.leagueNote = first && duel.status === 'finished'
      ? `Your first try today goes on ${esc(duel.squad.name)}'s table.`
      : 'Only your first try at each day\'s squad duel goes on the table, so this one does not change it.';
  }
  const record = toHistory(duel, { firstLeagueAttempt });
  store.update((s) => {
    s.history.push(record);
    if (s.history.length > 500) s.history.splice(0, s.history.length - 500);
    if (duel.status === 'finished') recordStreakDay(duel.day);
  });
  planDailyReminders();
  if (duel.kind === 'challenge') state.challengeDraft = emptyChallenge();
  state.resultCode = duel.status === 'finished'
    ? encodeChallenge({ seed: duel.seed, topic: duel.topic, level: duel.level, marking: duel.marking, score: duel.you, nickname: d.profile.nickname, exam: duel.exam, set: duel.set })
    : '';
  if (duel.kind === 'practice' || duel.kind === 'squad') state.resultCode = '';
  // First finished duel ever: ask for a daily goal when they leave the result.
  if (duel.status === 'finished' && duel.kind === 'solo' && !d.goal && !d.goalAsked) state.afterResult = 'goal';
  state.screen = 'result';
  state.stack = [];
  state.sheet = null;
  render();
  window.scrollTo(0, 0);
  // In the background; offline duels go up later. A squad duel then refreshes the squad's table.
  syncDuels().then(() => { if (duel.kind === 'squad' && state.sq.id === duel.squad.id) loadSquadPage({ quiet: true }); });
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
  planDailyReminders();
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
    state.setup = { mode: 'account', provider: res.data.provider, idToken, nickname: guestName, username: usernameFrom(guestName), uidEdited: false, uid: null, error: '', busy: false };
    state.auth.busy = null;
    state.phone.busy = false;
    go('setup', { replace: true });
    if (guestName) { checkSetupForm(); checkUid(); }
    return;
  }
  await finishSignIn(res.data);
}

async function finishSignIn(result) {
  await completeSignIn(result);
  await firebaseSignOut();
  resetAccountState();
  state.auth = { busy: null, error: '' };
  state.phone = { step: 'number', number: '', verificationId: null, error: '', busy: false, resendAt: 0 };
  state.blocked = null;
  toast(`Signed in as ${data().profile.nickname}`);
  if (openPendingChallenge()) return;
  if (state.pendingDuel) { const code = state.pendingDuel; state.pendingDuel = null; state.stack = []; joinLive(code); return; }
  if (state.pendingSquad) { const code = state.pendingSquad; state.pendingSquad = null; state.stack = []; state.screen = 'squad'; openInvite(code); return; }
  if (state.pendingLeague) { const code = state.pendingLeague; state.pendingLeague = null; state.stack = []; state.screen = 'league'; openLeagueInvite(code); return; }
  if (state.pendingEducator) { state.pendingEducator = false; state.stack = ['home']; state.screen = 'educator'; render(); window.scrollTo(0, 0); loadEducator(); return; }
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
  const uid = form.uid ? form.uid.value.trim() : null;
  const uidBad = uid !== null && (!!usernameError(uid) || (state.setup.uid?.value === uid && state.setup.uid.taken));
  app.querySelector('#welcome-start').disabled = !!error || uidBad || !form.age.checked || state.setup.busy;
}

let uidTimer = null;
/** First sign-in: is the user ID in the box free? Checked a moment after typing stops; the server checks again on save. */
function checkUid() {
  clearTimeout(uidTimer);
  const input = app.querySelector('#uid');
  if (!input) return;
  const value = input.value.trim();
  const error = usernameError(value);
  if (error) { showUid(value.length >= 3 || state.welcomeTried ? { tone: 'bad', text: error } : { text: UID_HELP }); checkSetupForm(); return; }
  if (state.setup.uid?.value === value) { showUidResult(state.setup.uid); return; }
  showUid({ text: 'Checking…' });
  uidTimer = setTimeout(async () => {
    const res = await api('GET', `/username?u=${encodeURIComponent(value)}`);
    if (app.querySelector('#uid')?.value.trim() !== value) return; // typed on since
    if (!res.ok) { showUid({ text: UID_HELP }); return; } // offline or busy: the server still checks on save
    state.setup.uid = { value, taken: !res.data.available, error: res.data.error, suggestion: res.data.suggestion };
    showUidResult(state.setup.uid);
    checkSetupForm();
  }, 400);
}
const showUidResult = (u) => showUid(u.taken ? { tone: 'bad', text: u.error || 'That user ID is taken.', suggestion: u.suggestion } : { tone: 'ok', text: `${u.value} is free.` });
function showUid({ tone = '', text, suggestion = null }) {
  const hint = app.querySelector('#uid-hint');
  if (!hint) return;
  hint.className = `uid-hint${tone ? ` uid-hint--${tone}` : ''}`;
  hint.innerHTML = `${esc(text)}${suggestion ? ` <button class="link-btn" type="button" data-action="use-uid" data-value="${esc(suggestion)}">Use ${esc(suggestion)}</button>` : ''}`;
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
      resetAccountState();
      if (['league-page', 'league-create', 'squad-page', 'squad-create', 'educator'].includes(state.screen)) go('home', { reset: true });
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

// ---------- Squads ----------

/** Any duel on this phone today with the squad's questions (a squad duel, or a challenge with the same seed). */
const playedSquadToday = (squadId, seed, day) => data().history.some((h) => h.day === day && (h.seed === seed || (h.kind === 'squad' && h.squadId === squadId)));

/** Refreshes the Squad tab's list (kept on the phone, so it shows at once next time). */
async function loadSquads() {
  const sq = state.sq;
  if (sq.loading) return;
  sq.loading = true;
  const res = await api('GET', '/squads', { auth: true });
  sq.loading = false;
  if (res.ok) {
    sq.loaded = true;
    sq.error = '';
    store.update((s) => { s.squads = res.data.squads; });
  } else {
    sq.error = squadNotice(res, 'Could not load your squads.');
  }
  if (state.screen === 'squad' && !state.sheet) render({ keepScroll: true });
}

/** Opens a squad page; Back goes to the Squad tab. */
function openSquad(id) {
  const sq = state.sq;
  if (sq.id !== id) { sq.page = null; sq.id = id; }
  sq.pageError = '';
  stopTicker();
  state.stack = ['squad'];
  state.screen = 'squad-page';
  state.sheet = null;
  render();
  window.scrollTo(0, 0);
  loadSquadPage();
}

async function loadSquadPage({ quiet = false } = {}) {
  const sq = state.sq;
  const id = sq.id;
  if (!id) return;
  sq.pageLoading = true;
  if (!quiet && state.screen === 'squad-page') render({ keepScroll: true });
  const res = await api('GET', `/squads/${id}`, { auth: true });
  if (sq.id !== id) return;
  sq.pageLoading = false;
  if (res.status === 404) {
    // Removed, or the squad closed: back to the list.
    store.update((s) => { s.squads = s.squads.filter((x) => x.id !== id); });
    sq.id = null;
    sq.page = null;
    if (state.screen === 'squad-page') { toast('You are no longer in that squad.'); go('squad'); }
    return;
  }
  if (res.ok) {
    sq.page = res.data;
    sq.pageError = '';
    const { squad, you } = res.data;
    store.update((s) => { s.squads = s.squads.map((x) => (x.id === id ? { ...x, name: squad.name, members: squad.members, role: you.role, inviteCode: squad.inviteCode } : x)); });
  } else {
    sq.pageError = squadNotice(res, 'Could not load the squad.');
  }
  // Never redraw over an open sheet or a duel.
  if (state.screen === 'squad-page' && !state.sheet) render({ keepScroll: true });
}

/** An invite (a code or a ?squad= link): shows the squad, then Join. */
function openInvite(code, { draw = true } = {}) {
  const sq = state.sq;
  sq.invite = code;
  sq.preview = null;
  sq.previewError = '';
  sq.busy = false;
  if (state.screen !== 'squad-join') state.stack.push(state.screen);
  state.screen = 'squad-join';
  state.sheet = null;
  if (draw) render();
  api('GET', `/squads/invite/${code}`, { auth: signedIn() }).then((res) => {
    if (sq.invite !== code) return;
    if (res.ok) sq.preview = res.data;
    else sq.previewError = res.status === 404 ? 'That code does not match a squad. Check it with the friend who sent it; codes change when a squad resets its invite.' : squadNotice(res, 'Could not find the squad.');
    if (state.screen === 'squad-join') render();
  });
}

async function squadOwnerAction(kind, done) {
  const m = state.sq.member;
  const res = await api('POST', `/squads/${state.sq.id}/members/${encodeURIComponent(m.id)}/${kind}`, { auth: true, body: {} });
  state.sheet = null;
  if (!res.ok) { render({ keepScroll: true }); toast(squadNotice(res, 'That did not work. Please try again.')); return; }
  toast(done(m.name));
  loadSquadPage();
}

async function squadExit(kind) {
  const id = state.sq.id;
  const name = state.sq.page.squad.name;
  const res = await api('POST', `/squads/${id}/${kind}`, { auth: true, body: {} });
  if (!res.ok) { state.sheet = null; render({ keepScroll: true }); toast(squadNotice(res, 'That did not work. Please try again.')); return; }
  store.update((s) => { s.squads = s.squads.filter((x) => x.id !== id); });
  state.sq.id = null;
  state.sq.page = null;
  toast(kind === 'close' ? `${name} is closed` : `You left ${name}`);
  go('squad');
}

// ---------- Actions ----------

const actions = {
  go: (el) => go(el.dataset.to),
  back: () => back(),
  toast: (el) => toast(el.dataset.text),
  'open-url': (el) => openExternal(el.dataset.url),
  'get-update': () => startUpdate(),
  'update-install': () => installNow(),
  'update-allow': () => openInstallSettings(),
  'update-website': () => { closeSheet(); openExternal(updateUrl()); },
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
    state.setup = { mode: 'guest', provider: null, idToken: null, nickname: '', username: '', uidEdited: false, uid: null, error: '', busy: false };
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
      const username = form.uid.value.trim();
      const uidError = usernameError(username);
      if (uidError) { showUid({ tone: 'bad', text: uidError }); return; }
      state.setup = { ...state.setup, nickname: nick, username, busy: true, error: '' };
      checkSetupForm();
      const res = await api('POST', '/auth/firebase', { body: { idToken: state.setup.idToken, profile: { nickname: nick, username, ageConfirmed: true, termsVersion: TERMS_VERSION } } });
      if (!res.ok) {
        if (res.status === 401) {
          state.auth = { busy: null, error: 'Sign-in took too long. Please sign in again.' };
          go('welcome', { reset: true });
          return;
        }
        const taken = res.data?.code === 'username';
        if (taken) state.setup.uid = { value: username, taken: true, error: res.data.error, suggestion: res.data.suggestion };
        state.setup = { ...state.setup, busy: false, error: taken ? '' : problem(res) };
        render();
        if (taken) showUidResult(state.setup.uid);
        checkSetupForm();
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
    store.update((s) => { s.rulesSeen = true; s.settings.qlangAsked = true; });
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
  'goal-save': async () => {
    store.update((s) => { s.goal = state.goalDraft; s.goalAsked = true; });
    syncProfile();
    toast(`Goal set: ${state.goalDraft} a day`);
    if (state.goalRemind) { state.goalRemind = false; await setDailyReminder({ checked: true }); }
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
  'set-setting': (el) => {
    store.update((s) => { s.settings[el.dataset.group] = el.dataset.value; if (el.dataset.group === 'qlang') s.settings.qlangAsked = true; });
    render({ keepScroll: true });
  },
  // The हिंदी / EN switch on a question (the choice is kept for the next ones).
  qlang: (el) => { store.update((s) => { s.settings.qlang = el.dataset.value; s.settings.qlangAsked = true; }); render({ keepScroll: true }); },
  'qlang-pick': (el) => {
    store.update((s) => { s.settings.qlang = el.dataset.value; s.settings.qlangAsked = true; });
    if (el.dataset.value === 'hi') toast('अब प्रश्न हिंदी में आएँगे');
    render({ keepScroll: true });
  },
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
    if (state.duel?.kind === 'live') {
      state.sheet = null;
      if (state.live?.sock?.readyState === 1) { liveSend({ t: 'leave' }); render({ keepScroll: true }); return; } // the result comes back
      // No connection: leave here. The server counts it as leaving when the minute is up.
      stopTicker();
      closeLiveSocket();
      state.live = null;
      state.duel = null;
      toast('You left the duel');
      go('home', { reset: true });
      return;
    }
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
    startDuel({ kind: 'rematch', seed: prev.seed, topic: prev.topic, level: prev.level, marking: prev.marking, rival: prev.rival, exam: prev.exam, set: prev.set });
  },
  'copy-code': () => copyText(state.resultCode),
  'share-code': () => {
    const d = state.duel;
    const exam = getExam(d.exam);
    if (qlang() === 'hi') {
      shareText({
        title: 'Takkar चुनौती',
        text: `मैंने Takkar पर ${exam ? `${exam.short} पैटर्न के ` : ''}मुकाबले में ${maxScore(d.marking, d.exam, d.questions.length)} में से ${num(d.you)} अंक बनाए। वही दस प्रश्न, क्या तुम मुझे हरा सकते हो?
यहाँ खेलें: ${WEB_APP_URL}?c=${encodeURIComponent(state.resultCode)}
Takkar ऐप में "Have a challenge code?" पर टैप करें और यह कोड पेस्ट करें:
${state.resultCode}
ऐप में कोड न खुले तो Takkar अपडेट करें: ${BETA_URL}`,
      });
      return;
    }
    shareText({
      title: 'Takkar challenge',
      text: `I scored ${num(d.you)} out of ${maxScore(d.marking, d.exam, d.questions.length)} in ${exam ? `an ${exam.short}-pattern` : 'a'} Takkar duel. Same ten questions, can you beat me?\nPlay it here: ${WEB_APP_URL}?c=${encodeURIComponent(state.resultCode)}\nIn the Takkar app, tap "Have a challenge code?" and paste:\n${state.resultCode}\nCode not opening in the app? Update Takkar: ${BETA_URL}`,
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
    startDuel({ kind: 'challenge', seed: c.seed, topic: c.topic, level: c.level, marking: c.marking, challenge: c, exam: c.exam, set: c.set });
  },

  // Tutor leagues
  'league-retry': () => (state.screen === 'league-page' ? loadLeaguePage() : loadLeagues()),
  'league-open': (el) => openLeague(el.dataset.id),
  'league-new': () => {
    const lg = state.lg;
    lg.draft = { name: '', exam: getExam(data().exam) ? data().exam : null, approval: true };
    lg.createError = '';
    go('league-create');
  },
  'league-exam': (el) => {
    const dr = state.lg.draft;
    dr.name = app.querySelector('#league-name')?.value ?? dr.name;
    dr.exam = el.dataset.value;
    render({ keepScroll: true });
  },
  'league-create': async () => {
    const lg = state.lg;
    const dr = lg.draft;
    if (lg.busy) return;
    dr.name = (app.querySelector('#league-name')?.value || '').trim().replace(/\s+/g, ' ');
    lg.createError = leagueNameError(dr.name) || (!dr.exam ? 'Pick the exam this league prepares for.' : '');
    if (lg.createError) { render({ keepScroll: true }); return; }
    lg.busy = true;
    render({ keepScroll: true });
    const res = await api('POST', '/leagues', { auth: true, body: { name: dr.name, exam: dr.exam, approval: dr.approval } });
    lg.busy = false;
    if (!res.ok) { lg.createError = problem(res, 'Could not create the league. Please try again.'); render({ keepScroll: true }); return; }
    lg.list = null;
    toast(`${res.data.league.name} is ready. Share its code with your students.`);
    openLeague(res.data.league.id);
  },
  'league-find': () => {
    const lg = state.lg;
    const typed = app.querySelector('#league-code')?.value || '';
    const code = cleanLeagueCode(typed);
    lg.code = typed;
    if (!isLeagueCode(code)) {
      lg.codeError = code ? 'League codes have 7 letters and numbers. Check it with your tutor.' : 'Type the code your tutor sent.';
      render({ keepScroll: true });
      return;
    }
    lg.codeError = '';
    openLeagueInvite(code);
  },
  'league-sign-in': () => {
    if (state.screen === 'league-join' && state.lg.invite) state.pendingLeague = state.lg.invite;
    go('welcome');
  },
  'league-join': async () => {
    const lg = state.lg;
    if (lg.busy) return;
    lg.realName = cleanRealName(app.querySelector('#league-real-name')?.value);
    lg.joinError = realNameError(lg.realName);
    lg.consentError = lg.consent ? '' : 'Tick this to join.';
    if (lg.joinError || lg.consentError) { render({ keepScroll: true }); return; }
    lg.busy = true;
    render({ keepScroll: true });
    const res = await api('POST', `/leagues/invite/${lg.invite}/join`, { auth: true, body: { realName: lg.realName, consent: true } });
    lg.busy = false;
    if (!res.ok) {
      if (res.data?.code === 'consent') lg.consentError = problem(res);
      else lg.joinError = problem(res, 'Could not join the league. Please try again.');
      render({ keepScroll: true });
      return;
    }
    lg.list = null;
    lg.realName = '';
    lg.consent = false;
    toast(res.data.state === 'pending' ? 'Request sent. Your tutor will let you in.' : `You joined ${res.data.league.name}.`);
    openLeague(res.data.league.id);
  },
  'league-copy': async () => { await copyText(state.lg.page?.league.inviteCode || ''); toast('Code copied'); },
  'league-share': () => {
    const l = state.lg.page.league;
    const exam = getExam(l.exam);
    if (qlang() === 'hi') {
      shareText({
        title: `Takkar पर ${l.name} से जुड़ें`,
        text: `Takkar पर मेरे ${exam ? `${exam.short} ` : ''}बैच ${l.name} से जुड़ें और लाइव टेस्ट दें। ${WEB_APP_URL}?league=${l.inviteCode} खोलें या League टैब में कोड ${l.inviteCode} डालें।
18 वर्ष या उससे अधिक आयु के अभ्यर्थियों के लिए।`,
      });
      return;
    }
    shareText({
      title: `Join ${l.name} on Takkar`,
      text: `Join my ${exam ? `${exam.short} ` : ''}batch ${l.name} on Takkar for live tests. Open ${WEB_APP_URL}?league=${l.inviteCode} or type the code ${l.inviteCode} in the League tab.\nFor aspirants aged 18 and over.`,
    });
  },
  'league-approve': (el) => leagueMember(el.dataset.uid, 'approve', 'Student let in'),
  'league-decline': (el) => leagueMember(el.dataset.uid, 'decline', 'Request declined'),
  'league-remove-ask': (el) => {
    const m = state.lg.page?.members.find((x) => x.id === el.dataset.uid);
    state.lg.confirm = { kind: 'remove', name: m?.realName || m?.nickname || 'this student', uid: el.dataset.uid };
    state.sheet = 'league-confirm';
    render({ keepScroll: true });
  },
  'league-reset-ask': () => askLeague('reset'),
  'league-close-ask': () => askLeague('close'),
  'league-leave-ask': () => askLeague('leave'),
  'league-confirm': async () => {
    const lg = state.lg;
    const c = lg.confirm;
    const id = lg.id;
    if (!c || !id || lg.busy) return;
    state.sheet = null;
    lg.busy = true;
    render({ keepScroll: true });
    const path = { remove: `/leagues/${id}/members/${c.uid}/remove`, reset: `/leagues/${id}/invite/reset`, close: `/leagues/${id}/close`, leave: `/leagues/${id}/leave` }[c.kind];
    const res = await api('POST', path, { auth: true, body: {} });
    lg.busy = false;
    lg.confirm = null;
    if (!res.ok) { toast(problem(res, 'That did not work. Please try again.')); render({ keepScroll: true }); return; }
    lg.list = null;
    if (c.kind === 'leave' || c.kind === 'close') {
      lg.id = null;
      lg.page = null;
      toast(c.kind === 'leave' ? 'You left the league' : 'League closed');
      go('league', { reset: true });
      return;
    }
    toast(c.kind === 'remove' ? 'Student removed' : 'New code ready. The old one no longer works.');
    loadLeaguePage({ quiet: true });
  },

  // Squads
  'squad-sign-in': () => {
    if (state.screen === 'squad-join' && state.sq.invite) state.pendingSquad = state.sq.invite;
    go('welcome');
  },
  'squad-retry': () => (state.screen === 'squad-page' ? loadSquadPage() : loadSquads()),
  'squad-open': (el) => openSquad(el.dataset.id),
  'squad-find': () => {
    const raw = app.querySelector('#squad-code')?.value || '';
    const code = cleanCode(raw.replace(/^.*[?&]squad=/i, ''));
    if (code.length !== CODE_LENGTH) { state.sq.code = raw; state.sq.codeError = raw.trim() ? `A squad code has ${CODE_LENGTH} letters and numbers.` : 'Type the code your friend sent.'; render({ keepScroll: true }); return; }
    state.sq.code = '';
    state.sq.codeError = '';
    openInvite(code);
  },
  'squad-exam': (el) => {
    state.sq.name = app.querySelector('#squad-name')?.value ?? state.sq.name;
    state.sq.exam = el.dataset.value;
    render({ keepScroll: true });
  },
  // For tutors: educator application (EDU-01 to EDU-07)
  'edu-sign-in': () => { state.pendingEducator = true; go('welcome'); },
  'edu-open': () => { state.edu.error = ''; go('educator'); loadEducator(); },
  'edu-platform': (el) => {
    state.edu.form.platform = el.dataset.value;
    delete state.edu.fieldErrors.platform;
    delete state.edu.fieldErrors.link;
    render({ keepScroll: true });
  },
  'edu-exam': (el) => {
    const f = state.edu.form;
    const id = el.dataset.value;
    if (f.exams.includes(id)) f.exams = f.exams.filter((x) => x !== id);
    else if (f.exams.length >= MAX_EXAMS) { toast(`Choose up to ${MAX_EXAMS} exams.`); return; }
    else f.exams = [...f.exams, id];
    delete state.edu.fieldErrors.exams;
    render({ keepScroll: true });
  },
  'edu-apply': async () => {
    const edu = state.edu;
    if (edu.busy) return;
    const f = edu.form;
    const errors = {};
    const nameError = centreNameError(f.name);
    if (nameError) errors.name = nameError;
    if (!f.platform) errors.platform = 'Choose how we can check it.';
    else if (needsLink(f.platform) && linkError(f.platform, f.link)) errors.link = linkError(f.platform, f.link);
    if (String(f.audience).trim() === '' || audienceError(f.audience)) errors.audience = 'Enter a number, for example 120.';
    if (!f.exams.length) errors.exams = 'Choose at least one exam.';
    if (!f.terms) errors.terms = 'Please accept the educator terms.';
    edu.fieldErrors = errors;
    edu.error = '';
    if (Object.keys(errors).length) { render({ keepScroll: true }); app.querySelector('.field__error:not(:empty)')?.scrollIntoView({ block: 'center' }); return; }
    edu.busy = true;
    render({ keepScroll: true });
    const res = await api('POST', '/educator/apply', { auth: true, body: {
      name: f.name.trim(), platform: f.platform, link: needsLink(f.platform) ? f.link.trim() : undefined,
      audience: Number(String(f.audience).trim()), exams: f.exams, termsVersion: EDUCATOR_TERMS_VERSION,
    } });
    edu.busy = false;
    if (!res.ok) {
      const field = res.data?.code;
      if (['name', 'platform', 'link', 'audience', 'exams', 'terms'].includes(field)) edu.fieldErrors = { [field]: problem(res) };
      else edu.error = problem(res, 'Could not send your application. Please try again.');
      render({ keepScroll: true });
      return;
    }
    edu.data = res.data;
    edu.form = emptyEducator().form;
    toast('Application sent');
    render();
  },
  'edu-copy': async () => {
    await copyText(state.edu.data?.application?.code || '');
    toast('Code copied');
  },
  'edu-renew': async () => {
    state.edu.busy = true;
    render({ keepScroll: true });
    const res = await api('POST', '/educator/code', { auth: true, body: {} });
    state.edu.busy = false;
    if (res.ok) state.edu.data = res.data;
    else state.edu.error = problem(res, 'Could not get a new code. Please try again.');
    render({ keepScroll: true });
  },
  'squad-create': async () => {
    const sq = state.sq;
    sq.name = (app.querySelector('#squad-name')?.value || '').trim();
    sq.createError = leagueNameError(sq.name);
    if (!sq.createError && !sq.exam) sq.createError = 'Pick the exam this squad prepares for.';
    if (sq.createError) { render({ keepScroll: true }); return; }
    sq.busy = true;
    render({ keepScroll: true });
    const res = await api('POST', '/squads', { auth: true, body: { name: sq.name, exam: sq.exam } });
    sq.busy = false;
    if (!res.ok) { sq.createError = squadNotice(res, 'Could not start the squad. Please try again.'); render({ keepScroll: true }); return; }
    store.update((s) => { s.squads = [...s.squads, res.data.squad]; });
    toast(`${res.data.squad.name} is ready. Invite your friends.`);
    openSquad(res.data.squad.id);
  },
  'squad-join': async () => {
    const sq = state.sq;
    sq.busy = true;
    render({ keepScroll: true });
    const res = await api('POST', `/squads/invite/${sq.invite}/join`, { auth: true, body: {} });
    sq.busy = false;
    if (!res.ok) { sq.previewError = squadNotice(res, 'Could not join the squad. Please try again.'); sq.preview = null; render(); return; }
    store.update((s) => { s.squads = [...s.squads.filter((x) => x.id !== res.data.squad.id), res.data.squad]; });
    toast(`You joined ${res.data.squad.name}`);
    openSquad(res.data.squad.id);
  },
  'squad-play': () => {
    const page = state.sq.page;
    if (!page || !duelsAllowed()) return;
    const t = page.today;
    if (t.day !== istDay()) { toast('A new day: loading today’s squad duel…'); loadSquadPage(); return; }
    startDuel({ kind: 'squad', seed: t.seed, set: t.set, exam: t.exam, topic: 'mixed', level: 'exam', marking: 'exam', rival: 'steady', squad: { id: page.squad.id, name: page.squad.name } });
  },
  'squad-react': async (el) => {
    const res = await api('POST', `/squads/${state.sq.id}/react`, { auth: true, body: { reaction: el.dataset.value } });
    if (!res.ok) { toast(squadNotice(res, 'Could not send that. Please try again.')); return; }
    vibrate();
    toast(`“${el.dataset.value}” sent to the squad`);
    loadSquadPage({ quiet: true });
  },
  'squad-copy': () => copyText(state.sq.page.squad.inviteCode),
  'squad-share': () => {
    const s = state.sq.page.squad;
    const exam = getExam(s.exam);
    if (qlang() === 'hi') {
      shareText({
        title: `Takkar पर ${s.name} से जुड़ें`,
        text: `Takkar पर मेरे स्टडी स्क्वॉड ${s.name} से जुड़ें: हम सबके लिए रोज़ वही दस ${exam ? `${exam.short} ` : ''}प्रश्न, और रोज़ की तालिका। ${WEB_APP_URL}?squad=${s.inviteCode} खोलें या Squad टैब में कोड ${s.inviteCode} डालें।
18 वर्ष या उससे अधिक आयु के अभ्यर्थियों के लिए।`,
      });
      return;
    }
    shareText({
      title: `Join ${s.name} on Takkar`,
      text: `Join my study squad ${s.name} on Takkar: the same ten ${exam ? `${exam.short} ` : ''}questions for all of us every day, and a daily table. Open ${WEB_APP_URL}?squad=${s.inviteCode} or type the code ${s.inviteCode} in the Squad tab.\nFor aspirants aged 18 and over.`,
    });
  },
  'squad-member': (el) => {
    state.sq.member = { id: el.dataset.id, name: el.dataset.name };
    state.sheet = 'squad-member';
    render({ keepScroll: true });
  },
  'squad-make-owner': () => squadOwnerAction('owner', (name) => `${name} now runs the squad`),
  'squad-remove': () => squadOwnerAction('remove', (name) => `${name} was removed from the squad`),
  'squad-reset': async () => {
    const res = await api('POST', `/squads/${state.sq.id}/invite/reset`, { auth: true, body: {} });
    if (!res.ok) { toast(squadNotice(res, 'Could not reset the code. Please try again.')); return; }
    toast('New invite code ready. The old code and links no longer work.');
    loadSquadPage({ quiet: true });
  },
  'squad-leave-ask': () => { state.sq.confirm = 'leave'; state.sheet = 'squad-confirm'; render({ keepScroll: true }); },
  'squad-close-ask': () => { state.sq.confirm = 'close'; state.sheet = 'squad-confirm'; render({ keepScroll: true }); },
  'squad-leave': () => squadExit('leave'),
  'squad-close': () => squadExit('close'),
  'squad-report': () => {
    state.report = { kind: 'harassment', details: '', nickname: '', error: '', busy: false, squadId: state.sq.id };
    state.sheet = 'report';
    render({ keepScroll: true });
  },

  // Plus (demo)
  'plus-on': () => {
    if (!plusTrialOpen()) { render(); toast('The Plus trial is closed right now.'); return; }
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
      kind: r.kind, details: r.details.trim(), nickname: r.nickname.trim() || undefined, squadId: r.squadId || undefined,
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
    applyPlan('tests', []); // the tests were this account's
    await signOutHere();
    await firebaseSignOut();
    state.blocked = null;
    state.sheet = null;
    resetAccountState();
    state.pendingSquad = null;
    state.pendingLeague = null;
    state.pendingEducator = false;
    toast(`Signed out. You are playing as a guest on ${HERE}.`);
    go(data().profile ? 'home' : 'welcome', { reset: true });
  },
  'ask-delete': () => { state.sheet = 'delete'; render({ keepScroll: true }); },
  // Live tests: the tutor
  'lt-new': () => { state.lt.form = ltDefaultForm(); state.lt.formError = ''; go('lt-schedule'); },
  'lt-late': (el) => { state.lt.form.late = Number(el.dataset.value); render({ keepScroll: true }); },
  'lt-level': (el) => { state.lt.form.difficulty = el.dataset.value; render({ keepScroll: true }); },
  'lt-topics-mode': (el) => { state.lt.form.pick = el.dataset.value === 'pick'; render({ keepScroll: true }); },
  'lt-topic': (el) => {
    const f = state.lt.form;
    const label = el.dataset.label;
    f.topics = f.topics.includes(label) ? f.topics.filter((x) => x !== label) : [...f.topics, label];
    render({ keepScroll: true });
  },
  'lt-schedule': () => ltSchedule(),
  'lt-refresh': () => loadLiveTests(),
  'lt-cancel-ask': (el) => { state.lt.sheetTest = state.lt.list?.find((t) => t.id === el.dataset.id) || null; state.sheet = 'lt-cancel'; render({ keepScroll: true }); },
  'lt-cancel': async () => {
    const t = state.lt.sheetTest;
    state.sheet = null;
    const res = await api('POST', `/tests/${t.id}/cancel`, { auth: true });
    toast(res.ok ? 'Test cancelled' : problem(res, 'Could not cancel the test.'));
    loadLiveTests();
  },
  'lt-class': (el) => ltOpenClass(el.dataset.id),
  'lt-release-ask': () => { state.sheet = 'lt-release'; render({ keepScroll: true }); },
  'lt-release': async () => {
    const lt = state.lt;
    state.sheet = null;
    lt.busy = true;
    render({ keepScroll: true });
    const res = await api('POST', `/tests/${lt.cls.test.id}/release`, { auth: true });
    lt.busy = false;
    if (!res.ok) { toast(problem(res, 'Could not release results.')); render({ keepScroll: true }); return; }
    toast('Results released');
    ltOpenClass(lt.cls.test.id);
  },
  'lt-csv': () => { const d = state.lt.cls; downloadText(`${d.test.title.replace(/[^\p{L}\p{N}]+/gu, '-')}-results.csv`, studentsCsv(d)); },
  'lt-paper': () => { const d = state.lt.cls; downloadText(`${d.test.title.replace(/[^\p{L}\p{N}]+/gu, '-')}-paper.txt`, paperText(d)); },
  'lt-back-league': () => ltBackToLeague(),
  // Live tests: the student
  'lt-remind': () => setTestReminders(true),
  'lt-calendar': (el) => { const t = state.lt.list?.find((x) => x.id === el.dataset.id); if (t) openExternal(ltCalendarUrl(t)); },
  'lt-start-ask': (el) => { state.lt.sheetTest = state.lt.list?.find((t) => t.id === el.dataset.id) || null; state.sheet = 'lt-start'; render({ keepScroll: true }); },
  'lt-start': (el) => ltStart(el.dataset.id),
  'lt-report': (el) => ltOpenReport(el.dataset.id),
  'lt-progress': () => ltOpenProgress(),
  // Live tests: the tutor reads one student
  'lt-student': (el) => ltOpenProgress(el.dataset.user),
  'lt-insights': () => ltOpenInsights(),
  'lt-student-report': (el) => ltOpenStudentReport(el.dataset.id),
  'lt-choose': (el) => { const run = state.lt.run; ltEdit(run, run.pos, (a) => { a.c = Number(el.dataset.index); }); vibrate(8); render({ keepScroll: true }); },
  'lt-clear': () => { const run = state.lt.run; ltEdit(run, run.pos, (a) => { a.c = null; }); render({ keepScroll: true }); },
  'lt-mark': () => { const run = state.lt.run; ltEdit(run, run.pos, (a) => { a.r = a.r ? 0 : 1; }); render({ keepScroll: true }); },
  'lt-flag': () => { const run = state.lt.run; ltEdit(run, run.pos, (a) => { a.f = a.f ? 0 : 1; }); toast(run.answers[run.pos].f ? 'Flagged for your tutor' : 'Flag removed'); render({ keepScroll: true }); },
  'lt-go': (el) => ltGo(Number(el.dataset.index)),
  'lt-prev': () => ltGo(state.lt.run.pos - 1),
  'lt-next': () => {
    const run = state.lt.run;
    if (run.pos === run.questions.length - 1) { ltLeaveQuestion(); state.sheet = 'lt-submit'; render({ keepScroll: true }); return; }
    ltGo(run.pos + 1);
  },
  'lt-submit-ask': () => { ltLeaveQuestion(); state.sheet = 'lt-submit'; render({ keepScroll: true }); },
  'lt-submit': () => ltSubmit(),
  // Live friend duels
  'live-new': () => startLive(),
  'live-squad': (el) => startLive({ squadId: el.dataset.squad, invitee: el.dataset.uid }),
  'live-join-code': () => joinLive(app.querySelector('#live-code')?.value || ''),
  'live-ready': () => liveSend({ t: 'ready' }),
  'live-unready': () => liveSend({ t: 'unready' }),
  'live-share': () => shareText(qlang() === 'hi'
    ? { title: 'Takkar लाइव मुकाबला', text: `Takkar पर लाइव मुकाबले में मुझसे टक्कर लो। कोड ${state.live.code}:`, url: state.live.link }
    : { title: 'Takkar live duel', text: `Take me on in a live Takkar duel. Code ${state.live.code}:`, url: state.live.link }),
  'live-copy': async () => { await copyText(state.live.link); toast('Link copied'); },
  'live-retry': () => { const code = state.live?.code; closeLiveSocket(); state.live = null; if (code) joinLive(code); else startLive(); },
  'live-fallback': () => { closeLiveSocket(); state.live = null; startSoloDuel(); },
  'live-close': () => {
    if (state.live && state.live.status !== 'live') { liveSend({ t: 'leave' }); closeLiveSocket(); state.live = null; }
    state.pendingDuel = null;
    go('home', { reset: true });
  },
  'use-uid': (el) => {
    const input = app.querySelector('#uid') || app.querySelector('#new-uid');
    if (!input) return;
    input.value = el.dataset.value;
    if (input.id === 'uid') { state.setup.uidEdited = true; checkUid(); checkSetupForm(); }
    else { state.uidEdit = { ...state.uidEdit, value: el.dataset.value, error: '', suggestion: null }; app.querySelector('#new-uid-error').textContent = ''; }
  },
  'edit-username': () => { state.uidEdit = { value: data().account?.username || '', error: '', suggestion: null, busy: false }; go('username'); },
  'username-save': async () => {
    const value = (app.querySelector('#new-uid')?.value || '').trim().toLowerCase();
    const show = (error, suggestion = null) => { state.uidEdit = { value, error, suggestion, busy: false }; render({ keepScroll: true }); };
    if (value === data().account?.username) { back(); return; }
    const error = usernameError(value);
    if (error) { show(error); return; }
    state.uidEdit = { value, error: '', suggestion: null, busy: true };
    render({ keepScroll: true });
    const res = await api('POST', '/me/username', { auth: true, body: { username: value } });
    if (!res.ok) { show(res.offline ? 'You are offline. Try again when you are back online.' : problem(res, 'Could not change your user ID. Please try again.'), res.data?.suggestion || null); return; }
    store.update((s) => { s.account.username = res.data.player.username; });
    toast(`User ID changed to ${res.data.player.username}`);
    go('profile', { reset: true });
  },
  'edit-nickname': () => { state.nick = { value: data().profile.nickname, error: '', busy: false }; go('nickname'); },
  'nickname-save': async () => {
    const value = (app.querySelector('#new-nick')?.value || '').trim();
    const show = (error) => { state.nick = { value, error, busy: false }; render({ keepScroll: true }); };
    if (value === data().profile.nickname) { back(); return; }
    const error = nicknameError(value);
    if (error) { show(error); return; }
    if (signedIn()) {
      state.nick = { value, error: '', busy: true };
      render({ keepScroll: true });
      const res = await api('POST', '/me/nickname', { auth: true, body: { nickname: value } });
      if (!res.ok) { show(res.offline ? 'You are offline. Try again when you are back online.' : problem(res, 'Could not change your nickname. Please try again.')); return; }
    }
    store.update((s) => { s.profile.nickname = value; });
    toast(`Nickname changed to ${value}`);
    go('profile', { reset: true });
  },
  'dismiss-guest-note': () => { store.update((s) => { s.guestNoteSeen = true; }); render({ keepScroll: true }); },
  'confirm-delete': async () => {
    if (signedIn()) {
      const res = await api('POST', '/account/delete', { auth: true });
      if (!res.ok && res.status !== 401) { toast(problem(res, 'Could not delete your account. Please try again.')); return; }
      await firebaseSignOut();
    }
    store.wipe();
    applyPlan('daily', []);
    applyPlan('tests', []);
    clearSavedMock();
    clearInterval(mockClock);
    Object.assign(state, {
      sheet: null, duel: null, mock: null, blocked: null, challengeDraft: emptyChallenge(), pendingChallenge: null,
      lg: emptyLeagues(), lt: emptyLiveTests(), welcomeTried: false, auth: { busy: null, error: '' },
      examDraft: { exam: null, month: null, change: false }, goalDraft: null, goalReturn: null, afterResult: null, rulesThen: null,
      sq: emptySquads(), pendingSquad: null, pendingLeague: null, pendingDuel: null, live: null, edu: emptyEducator(),
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
  // Keyboard and screen-reader clicks have no tap count (detail 0): never treated as a double tap.
  if (event.detail !== 0 && double && now < inputLockUntil) return;
  lastActionSig = signature(target);
  fn(target, event);
});

app.addEventListener('input', (event) => {
  const el = event.target;
  const kind = el.dataset.input;
  if (kind === 'nick' && state.setup.mode === 'account' && !state.setup.uidEdited) {
    const uid = app.querySelector('#uid');
    if (uid) { uid.value = usernameFrom(el.value); checkUid(); }
  }
  if (kind === 'uid' || kind === 'uid-edit') {
    const clean = el.value.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean !== el.value) el.value = clean;
  }
  if (kind === 'uid') { state.setup.uidEdited = true; checkUid(); }
  if (kind === 'nick' || kind === 'age' || kind === 'uid') checkSetupForm();
  if (kind === 'league-name') state.lg.draft.name = el.value;
  if (kind === 'league-approval') state.lg.draft.approval = el.checked;
  if (kind === 'league-real-name') state.lg.realName = el.value;
  if (kind === 'league-consent') { state.lg.consent = el.checked; if (el.checked && state.lg.consentError) { state.lg.consentError = ''; render({ keepScroll: true }); } }
  if (kind === 'code') state.challengeDraft.codeText = el.value;
  if (kind?.startsWith('lt-') && state.lt.form) {
    const field = { 'lt-title': 'title', 'lt-date': 'date', 'lt-time': 'time', 'lt-minutes': 'minutes', 'lt-count': 'count' }[kind];
    if (field) state.lt.form[field] = el.value;
    if (state.lt.formError) { state.lt.formError = ''; }
    // The summary line follows the date, time and duration in place: a re-render on blur would swallow the next tap.
    const line = app.querySelector('#lt-window');
    if (line && ['date', 'time', 'minutes'].includes(field)) { const text = scheduleWindowText(state.lt.form); line.textContent = text; line.hidden = !text; }
  }
  if (kind === 'live-code') {
    const clean = el.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
    if (clean !== el.value) el.value = clean;
    state.liveForm.code = clean;
    if (state.liveForm.error) { state.liveForm.error = ''; el.closest('.field').querySelector('.field__error').textContent = ''; }
  }
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
  if (kind === 'edu') {
    const field = el.dataset.field;
    state.edu.form[field] = el.type === 'checkbox' ? el.checked : el.value;
    if (state.edu.fieldErrors[field]) {
      delete state.edu.fieldErrors[field];
      const shown = el.closest('.field')?.querySelector('.field__error') || el.closest('.check-row')?.nextElementSibling;
      if (shown) shown.textContent = '';
    }
  }
});

app.addEventListener('change', (event) => {
  const kind = event.target.dataset.input;
  if (kind === 'reminders') setDailyReminder(event.target);
  if (kind === 'reminder-time') {
    const time = REMINDER_TIMES.includes(event.target.value) ? event.target.value : DEFAULT_REMINDER_TIME;
    store.update((s) => { s.settings.reminderTime = time; });
    planDailyReminders();
    toast(`Daily reminder at ${timeLabel(time)}`);
  }
  if (kind === 'test-reminders') setTestReminders(event.target.checked, event.target);
  if (kind === 'goal-remind') state.goalRemind = event.target.checked;
});

// The keyboard's Go / Enter key does the form's main action.
const FORM_ACTIONS = { welcome: 'profile-save', phone: 'phone-send', otp: 'phone-verify', 'edu-apply': 'edu-apply', 'league-code': 'league-find', 'league-create': 'league-create', 'league-join': 'league-join', nickname: 'nickname-save', username: 'username-save', 'squad-code': 'squad-find', 'squad-create': 'squad-create', 'live-code': 'live-join-code', 'lt-schedule': 'lt-schedule' };
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

window.addEventListener('online', () => wakeLive());
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) {
    planDailyReminders(); // today's reminder follows what was played before leaving
    // Leaving the app or tab during a live test is counted for the tutor, and unsaved answers go now.
    const run = state.lt.run;
    if (run && state.screen === 'lt-test') { ltLeaveQuestion(); run.leaves += 1; ltPersist(run); ltFlush(); }
    return;
  }
  if (state.lt.run && state.screen === 'lt-test') ltFlush();
  // Back from Android's "install unknown apps" setting: carry on with the update.
  if (state.sheet === 'update' && state.upd?.phase === 'permission' && await installAllowed()) {
    state.upd = { ...state.upd, phase: 'ready' };
    render({ keepScroll: true });
    installNow();
  }
  // Time keeps running while the app is in the background, as it would on the server.
  if (state.screen === 'duel' && state.phase === 'question') tick();
  wakeLive();
  syncWithServer();
  planDailyReminders();
  planTestReminders();
});

// ---------- Reminders on this phone (Android 0.7.0+, reminders.js) ----------

const reminderTime = () => (REMINDER_TIMES.includes(data().settings.reminderTime) ? data().settings.reminderTime : DEFAULT_REMINDER_TIME);
// Test reminders are on unless the player turned them off; Android still asks before any arrive.
const testRemindersOn = () => data().settings.testReminders !== false;

function planDailyReminders() {
  if (!remindersAvailable()) return;
  refreshNotifyState();
  const d = data();
  const done = goalDoneToday();
  applyPlan('daily', planDaily({ on: !!d.settings.reminders, time: reminderTime(), lang: qlang(), examShort: getExam(d.exam)?.short,
    streak: liveStreak(), playedToday: done > 0, goal: d.goal, doneToday: done, now: Date.now() }));
}

/** Whether Android lets Takkar notify; the You and league screens show it, so they redraw when it changes. */
async function refreshNotifyState() {
  const granted = (await notificationPermission()) === 'granted';
  if (granted === state.notifyGranted) return granted;
  state.notifyGranted = granted;
  if ((state.screen === 'profile' || state.screen === 'league-page') && !state.sheet) render({ keepScroll: true });
  return granted;
}

let testRemindersAt = 0;
/**
 * The live tests of the leagues this player is in. Re-planned at most every 15 minutes on start and resume,
 * every minute after a league page loads (soon), or now (force).
 */
async function planTestReminders({ force = false, soon = false } = {}) {
  if (!remindersAvailable()) return;
  if (!(await refreshNotifyState()) || !signedIn() || !testRemindersOn()) return;
  if (!force && Date.now() - testRemindersAt < (soon ? 60000 : 15 * 60000)) return;
  testRemindersAt = Date.now();
  const res = await api('GET', '/leagues', { auth: true });
  if (!res.ok) return;
  const tests = [];
  for (const l of (res.data.joined || []).filter((x) => x.role === 'member')) {
    const r = await api('GET', `/leagues/${l.id}/tests`, { auth: true });
    if (r.ok) for (const t of r.data.tests || []) tests.push({ ...t, leagueId: l.id, leagueName: l.name });
  }
  applyPlan('tests', planTests(tests, { lang: qlang(), now: Date.now() }));
}

const deniedText = 'Notifications are off for Takkar. Turn them on in Android Settings → Apps → Takkar → Notifications.';

async function setDailyReminder(input) {
  if (!input.checked) {
    store.update((s) => { s.settings.reminders = false; });
    applyPlan('daily', []);
    toast('Daily reminder off');
    render({ keepScroll: true });
    return;
  }
  if (await notificationPermission(true) !== 'granted') { input.checked = false; toast(deniedText); return; }
  state.notifyGranted = true;
  store.update((s) => { s.settings.reminders = true; if (!REMINDER_TIMES.includes(s.settings.reminderTime)) s.settings.reminderTime = DEFAULT_REMINDER_TIME; });
  planDailyReminders();
  toast(`Daily reminder on, at ${timeLabel(reminderTime())}`);
  render({ keepScroll: true });
}

async function setTestReminders(on, input = null) {
  if (on && await notificationPermission(true) !== 'granted') { if (input) input.checked = false; toast(deniedText); return; }
  if (on) state.notifyGranted = true;
  store.update((s) => { s.settings.testReminders = on; });
  if (on) { await planTestReminders({ force: true }); toast('We’ll remind you 10 minutes before each live test, and when it opens.'); }
  else { applyPlan('tests', []); toast('Live test reminders off'); }
  render({ keepScroll: true });
}

// ---------- Tutor leagues ----------

async function loadLeagues() {
  const lg = state.lg;
  if (lg.loading || !signedIn()) return;
  lg.loading = true;
  const res = await api('GET', '/leagues', { auth: true });
  lg.loading = false;
  if (res.ok) { lg.list = res.data; lg.error = ''; }
  // A 404 here means the server doesn't offer leagues yet (an older server): say so plainly.
  else lg.error = res.status === 404 ? 'Leagues aren’t available right now. Please try again later.' : problem(res, 'Could not load your leagues.');
  if (state.screen === 'league' && !state.sheet) render({ keepScroll: true });
}

function openLeague(id) {
  const lg = state.lg;
  if (lg.id !== id) { lg.page = null; lg.id = id; }
  lg.pageError = '';
  state.stack = ['league'];
  state.screen = 'league-page';
  state.sheet = null;
  render();
  window.scrollTo(0, 0);
  loadLeaguePage();
}

async function loadLeaguePage({ quiet = false } = {}) {
  const lg = state.lg;
  const id = lg.id;
  if (!id) return;
  lg.pageLoading = true;
  if (!quiet && state.screen === 'league-page') render({ keepScroll: true });
  const res = await api('GET', `/leagues/${id}`, { auth: true });
  if (lg.id !== id) return;
  lg.pageLoading = false;
  if (res.status === 404) {
    // Removed by the tutor, or never a member: back to the list.
    lg.id = null;
    lg.page = null;
    lg.list = null;
    if (state.screen === 'league-page') { toast('You are no longer in that league.'); go('league', { reset: true }); }
    return;
  }
  if (res.ok) { lg.page = res.data; lg.pageError = ''; }
  else lg.pageError = problem(res, 'Could not load the league.');
  if (state.screen === 'league-page' && !state.sheet) render({ keepScroll: true });
  if (res.ok && res.data.role !== 'pending' && res.data.league.status !== 'closed') loadLiveTests();
}

// ---------- Live tests in tutor leagues (Live tests (beta) tab, LIVE-01 to LIVE-19) ----------
// The server keeps the paper, the answer key and the clock. The phone shows one question at a time,
// saves answers every few seconds (and keeps unsaved ones on the phone), and counts leaving the app.

const LT_SAVE_MS = 4000;
let ltTimer = null; // the test's clock and saver
let ltPageTimer = null; // countdowns on the league page

function ltSection() {
  const page = state.lg.page;
  if (!page || page.role === 'pending' || page.league.status === 'closed') return '';
  const lt = state.lt;
  return testsSection({
    lt: lt.leagueId === page.league.id ? lt : { list: null }, role: page.role === 'owner' ? 'owner' : 'member',
    nowMs: Date.now() + lt.offset, canSchedule: page.role === 'owner' && page.league.status === 'live', liveOn: switchOn('liveTests'),
    remind: remindersAvailable() ? (testRemindersOn() && state.notifyGranted ? 'on' : 'off') : null,
  });
}

async function loadLiveTests() {
  const lt = state.lt;
  const id = state.lg.id;
  if (!id || !signedIn()) return;
  if (lt.leagueId !== id) { lt.leagueId = id; lt.list = null; lt.listError = ''; }
  const res = await api('GET', `/leagues/${id}/tests`, { auth: true });
  if (state.lg.id !== id) return;
  if (res.ok) {
    lt.list = res.data.tests;
    lt.paused = res.data.paused;
    lt.listError = '';
    lt.offset = Date.parse(res.data.serverNow) - Date.now();
    if (res.data.role === 'member') planTestReminders({ soon: true });
  } else if (res.status !== 404) lt.listError = res.offline ? 'You are offline. The tests show when you are back online.' : problem(res, 'Could not load the tests.');
  if (state.screen === 'league-page' && !state.sheet) render({ keepScroll: true });
  ltWatchPage();
}

/** While a league page is open: countdowns tick, and the list reloads when a test opens or its entry closes. */
function ltWatchPage() {
  clearInterval(ltPageTimer);
  ltPageTimer = setInterval(() => {
    if (state.screen !== 'league-page' || !state.lt.list) { clearInterval(ltPageTimer); ltPageTimer = null; return; }
    const now = Date.now() + state.lt.offset;
    for (const el of document.querySelectorAll('[data-countdown]')) el.textContent = untilText(Date.parse(el.dataset.countdown) - now);
    const turn = state.lt.list.some((t) => (t.state === 'scheduled' && now >= Date.parse(t.startsAt))
      || (t.state === 'open' && now >= Date.parse(t.startsAt) + t.lateMinutes * 60000) || (t.state !== 'ended' && t.state !== 'released' && t.state !== 'cancelled' && now >= Date.parse(t.closesAt)));
    const owner = state.lg.page?.role === 'owner' && state.lt.list.some((t) => t.state === 'open' || t.state === 'running');
    if (turn || (owner && Math.floor(now / 1000) % 20 === 0)) loadLiveTests();
  }, 1000);
}

function ltBackToLeague() {
  const id = state.lt.leagueId || state.lg.id;
  state.lt.done = null;
  state.lt.report = null;
  if (id) openLeague(id); else go('league', { reset: true });
}

function ltDefaultForm() {
  const d = new Date(Date.now() + 60 * 60000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return { title: '', date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}`, minutes: 30, count: 25, late: 10, difficulty: 'exam', pick: false, topics: [] };
}

async function ltSchedule() {
  const lt = state.lt;
  const f = lt.form;
  if (!f || lt.busy) return;
  const startsAtMs = Date.parse(`${f.date}T${f.time}`);
  const body = { title: f.title.trim(), startsAt: Number.isFinite(startsAtMs) ? new Date(startsAtMs).toISOString() : '', durationMinutes: Number(f.minutes), lateMinutes: f.late, questionCount: Number(f.count), difficulty: f.difficulty, topics: f.pick ? f.topics : [] };
  const problemText = scheduleError({ title: body.title, startsAtMs, minutes: body.durationMinutes, late: body.lateMinutes, count: body.questionCount, difficulty: body.difficulty }, Date.now() + lt.offset)
    || (f.pick && !f.topics.length ? 'Pick at least one topic, or choose All topics.' : '');
  if (problemText) { lt.formError = problemText; render({ keepScroll: true }); return; }
  lt.busy = true;
  lt.formError = '';
  render({ keepScroll: true });
  const res = await api('POST', `/leagues/${state.lg.id}/tests`, { auth: true, body });
  lt.busy = false;
  if (!res.ok) { lt.formError = res.offline ? 'You are offline. Try again when you are back online.' : problem(res, 'Could not schedule the test.'); render({ keepScroll: true }); return; }
  lt.form = null;
  toast(`Scheduled for ${new Date(res.data.test.startsAt).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`);
  openLeague(state.lg.id);
}

async function ltOpenClass(id) {
  const lt = state.lt;
  lt.cls = null;
  lt.clsError = '';
  lt.clsId = id;
  go('lt-class');
  const res = await api('GET', `/tests/${id}/class`, { auth: true });
  if (lt.clsId !== id) return;
  if (res.ok) lt.cls = res.data; else lt.clsError = res.offline ? 'You are offline. The report shows when you are back online.' : problem(res, 'Could not load the class report.');
  if (state.screen === 'lt-class') render({ keepScroll: true });
}

async function ltOpenReport(id) {
  const stacked = state.screen === 'lt-progress';
  const res = await api('GET', `/tests/${id}`, { auth: true });
  if (!res.ok) { toast(res.offline ? 'You are offline.' : problem(res, 'Could not open the report.')); return; }
  if (!res.data.you?.report) { toast('Your tutor hasn’t released results yet.'); loadLiveTests(); return; }
  state.lt.report = { test: res.data.test, report: res.data.you.report, stacked };
  go('lt-report');
}

/** A student across the league's tests: their own (My progress), or one the tutor picked by user ID. */
async function ltOpenProgress(student = null) {
  const lt = state.lt;
  const id = state.lg.id;
  if (!id) return;
  const prog = { data: null, error: '', student };
  lt.prog = prog;
  // From a test's report, progress takes its place: Back then goes to the league, not round in a circle.
  go('lt-progress', { replace: state.screen === 'lt-report' });
  const res = await api('GET', `/leagues/${id}/progress${student ? `?student=${encodeURIComponent(student)}` : ''}`, { auth: true });
  if (lt.prog !== prog) return;
  if (res.ok) prog.data = res.data;
  else prog.error = res.offline ? 'You are offline. Progress shows when you are back online.' : res.status === 404 ? 'Progress isn’t available here yet. Please try again later.' : problem(res, 'Could not load the progress.');
  if (state.screen === 'lt-progress') render({ keepScroll: true });
}

/** The tutor's class across the league's tests. */
async function ltOpenInsights() {
  const lt = state.lt;
  const id = state.lg.id;
  if (!id) return;
  const ins = { data: null, error: '' };
  lt.ins = ins;
  go('lt-insights');
  const res = await api('GET', `/leagues/${id}/insights`, { auth: true });
  if (lt.ins !== ins) return;
  if (res.ok) ins.data = res.data;
  else ins.error = res.offline ? 'You are offline. Insights show when you are back online.' : res.status === 404 ? 'Class insights aren’t available here yet. Please try again later.' : problem(res, 'Could not load the class insights.');
  if (state.screen === 'lt-insights') render({ keepScroll: true });
}

/** The tutor opens one test's report for the student whose progress is on screen. */
async function ltOpenStudentReport(id) {
  const student = state.lt.prog?.student;
  if (!student) return;
  const res = await api('GET', `/tests/${id}/report?student=${encodeURIComponent(student)}`, { auth: true });
  if (!res.ok) { toast(res.offline ? 'You are offline.' : problem(res, 'Could not open the report.')); return; }
  state.lt.report = { test: res.data.test, report: res.data.report, student: res.data.student, stacked: true };
  go('lt-report');
}

/** A Google Calendar event for the test: a reminder without notifications (LIVE-03). */
function ltCalendarUrl(t) {
  const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = Date.parse(t.startsAt);
  const details = `Live test on Takkar: ${t.count} questions, ${t.durationMinutes} minutes. Entry is open for ${t.lateMinutes} minutes from the start. Open the League tab in Takkar: ${WEB_APP_URL}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${t.title} (Takkar live test)`)}&dates=${stamp(start)}/${stamp(start + (t.lateMinutes + t.durationMinutes) * 60000)}&details=${encodeURIComponent(details)}`;
}

// ---------- sitting a test ----------

const ltKey = (id) => `takkar.lt.${id}`;
const ltRead = (id) => { try { return JSON.parse(localStorage.getItem(ltKey(id)) || 'null'); } catch { return null; } };
function ltPersist(run) {
  try {
    const answers = Object.fromEntries([...run.dirty].map((p) => [p, run.answers[p]]));
    localStorage.setItem(ltKey(run.testId), JSON.stringify({ answers, leaves: run.leaves, endsAt: run.endsAtServer }));
  } catch { /* storage full or blocked: the server copy still counts */ }
}
const ltForget = (id) => { try { localStorage.removeItem(ltKey(id)); } catch { /* fine */ } };

/** The server's time now: its time at the last sync, plus how long has passed since on a clock the phone can't change (LIVE-05). */
const ltServerNow = (run) => run.sync.server + (performance.now() - run.sync.perf);
function ltTimeLeft() { const run = state.lt.run; return run ? Math.max(0, run.endsAtServer - ltServerNow(run)) : 0; }

async function ltStart(id) {
  const lt = state.lt;
  if (lt.busy) return;
  lt.busy = true;
  state.sheet = null;
  const sentAt = performance.now();
  const res = await api('POST', `/tests/${id}/start`, { auth: true, body: { web: !IS_NATIVE } });
  lt.busy = false;
  if (!res.ok) { toast(res.offline ? 'You are offline. Connect to start the test.' : problem(res, 'Could not start the test.')); render({ keepScroll: true }); loadLiveTests(); return; }
  const d = res.data;
  const rtt = performance.now() - sentAt;
  const run = {
    testId: d.test.id, leagueId: d.test.leagueId, title: d.test.title, questions: d.questions, sections: d.sections,
    answers: d.answers.map((a) => (a ? { c: a.c ?? null, f: a.f ? 1 : 0, r: a.r ? 1 : 0, s: a.s || 0 } : null)),
    seen: d.answers.map((a) => !!a), pos: 0, endsAtServer: Date.parse(d.attempt.endsAt),
    sync: { server: Date.parse(d.serverNow) + rtt / 2, perf: performance.now() },
    dirty: new Set(), ver: {}, leaves: d.attempt.leaves || 0, saveState: 'saved', shownAt: performance.now(), saving: false, ending: false,
  };
  // Answers this phone hadn't saved yet (the app closed, or no signal) come back too (LT-05, LT-06).
  const local = ltRead(run.testId);
  if (local?.answers) {
    for (const [p, a] of Object.entries(local.answers)) {
      const i = Number(p);
      if (Number.isInteger(i) && i >= 0 && i < run.answers.length && a) { run.answers[i] = a; run.seen[i] = true; run.dirty.add(i); }
    }
  }
  if (local?.leaves > run.leaves) run.leaves = local.leaves;
  run.seen[0] = true;
  // Where the student was: the first question they haven't answered.
  const next = run.answers.findIndex((a) => !a || a.c === null || a.c === undefined);
  run.pos = next >= 0 && d.answers.some(Boolean) ? next : 0;
  run.seen[run.pos] = true;
  lt.leagueId = run.leagueId;
  lt.run = run;
  state.stack = [];
  go('lt-test');
  ltStartTimer(run);
  if (run.dirty.size) ltFlush();
}

function ltSaveState(run, st) {
  run.saveState = st;
  const el = document.getElementById('lt-save');
  if (el) el.textContent = { saved: 'Saved', saving: 'Saving…', offline: 'Offline: answers will save when you’re back', waiting: 'Not saved yet' }[st];
}

/** Time on the question shown so far goes to its answer (seconds per question, for the reports). */
function ltLeaveQuestion() {
  const run = state.lt.run;
  if (!run) return;
  const secs = Math.round((performance.now() - run.shownAt) / 1000);
  run.shownAt = performance.now();
  if (secs <= 0) return;
  ltEdit(run, run.pos, (a) => { a.s = (a.s || 0) + secs; });
}

function ltEdit(run, pos, change) {
  const a = run.answers[pos] || { c: null, f: 0, r: 0, s: 0 };
  change(a);
  run.answers[pos] = a;
  run.dirty.add(pos);
  run.ver[pos] = (run.ver[pos] || 0) + 1;
  ltPersist(run);
  if (run.saveState === 'saved') ltSaveState(run, 'waiting');
}

/** Sends what changed since the last save; keeps it on the phone until the server has it (LIVE-08). */
async function ltFlush() {
  const run = state.lt.run;
  if (!run || run.saving || run.ending) return;
  const positions = [...run.dirty];
  const sent = Object.fromEntries(positions.map((p) => [p, run.ver[p] || 0]));
  run.saving = true;
  ltSaveState(run, 'saving');
  const sentAt = performance.now();
  const res = await api('POST', `/tests/${run.testId}/answers`, { auth: true, body: { answers: Object.fromEntries(positions.map((p) => [p, run.answers[p]])), leaves: run.leaves } });
  run.saving = false;
  if (state.lt.run !== run) return;
  if (res.ok) {
    for (const p of positions) if ((run.ver[p] || 0) === sent[p]) run.dirty.delete(p);
    run.sync = { server: Date.parse(res.data.serverNow) + (performance.now() - sentAt) / 2, perf: performance.now() };
    ltPersist(run);
    ltSaveState(run, run.dirty.size ? 'waiting' : 'saved');
  } else if (res.status === 409) {
    ltSubmit({ auto: true, over: true }); // submitted elsewhere, or the time is up on the server
  } else ltSaveState(run, res.offline ? 'offline' : 'waiting');
}

async function ltSubmit({ auto = false, over = false } = {}) {
  const run = state.lt.run;
  if (!run || run.ending) return;
  ltLeaveQuestion();
  run.ending = true;
  clearInterval(ltTimer);
  state.sheet = null;
  let res = { ok: false, status: 409 };
  if (!over) {
    res = await api('POST', `/tests/${run.testId}/submit`, { auth: true, body: { answers: Object.fromEntries([...run.dirty].map((p) => [p, run.answers[p]])), leaves: run.leaves } });
    if (!res.ok && res.offline && !auto && ltTimeLeft() > 0) {
      // Offline before the end: keep the test going; the answers wait on the phone.
      run.ending = false;
      toast('You are offline. Submit again when you’re back online; your answers are kept.');
      ltStartTimer(run);
      render({ keepScroll: true });
      return;
    }
  }
  if (res.ok || res.status === 409 || auto) ltForget(run.testId);
  state.lt.done = { title: run.title, counts: res.ok ? res.data.counts : runCounts(run), timedOut: auto, offline: !res.ok && !!res.offline };
  state.lt.run = null;
  state.stack = [];
  go('lt-done');
  loadLiveTests();
}

function ltStartTimer(run) {
  clearInterval(ltTimer);
  let lastSave = performance.now();
  ltTimer = setInterval(() => {
    if (state.lt.run !== run) { clearInterval(ltTimer); return; }
    const left = ltTimeLeft();
    const el = document.getElementById('lt-timer');
    if (el) { el.textContent = clock(left); el.classList.toggle('timer--low', left <= 60000); }
    if (left <= 0) { ltSubmit({ auto: true }); return; }
    if (run.dirty.size && performance.now() - lastSave > LT_SAVE_MS) { lastSave = performance.now(); ltFlush(); }
  }, 250);
}

function ltGo(pos) {
  const run = state.lt.run;
  if (!run || pos < 0 || pos >= run.questions.length || pos === run.pos) return;
  ltLeaveQuestion();
  run.pos = pos;
  run.seen[pos] = true;
  render();
  window.scrollTo(0, 0);
}

function openLeagueInvite(code, { draw = true } = {}) {
  const lg = state.lg;
  lg.invite = code;
  lg.preview = null;
  lg.previewError = '';
  lg.joinError = '';
  lg.consentError = '';
  state.stack = ['league'];
  state.screen = 'league-join';
  state.sheet = null;
  if (draw) { render(); window.scrollTo(0, 0); }
  (async () => {
    const res = await api('GET', `/leagues/invite/${code}`, { auth: signedIn() });
    if (lg.invite !== code) return;
    if (res.ok) lg.preview = res.data;
    else lg.previewError = problem(res, 'Could not find that league.');
    if (state.screen === 'league-join') render({ keepScroll: true });
  })();
}

function askLeague(kind) {
  state.lg.confirm = { kind };
  state.sheet = 'league-confirm';
  render({ keepScroll: true });
}

async function leagueMember(uid, action, done) {
  const lg = state.lg;
  if (lg.busy) return;
  lg.busy = true;
  render({ keepScroll: true });
  const res = await api('POST', `/leagues/${lg.id}/members/${uid}/${action}`, { auth: true, body: {} });
  lg.busy = false;
  if (res.ok) { toast(done); lg.list = null; }
  else toast(problem(res, 'That did not work. Please try again.'));
  await loadLeaguePage({ quiet: true });
}

// ---------- For tutors: educator application ----------

const isGoogle = () => data().account?.mode === 'google';

async function loadEducator() {
  if (!isGoogle() || state.edu.loading) return;
  state.edu.loading = true;
  const res = await api('GET', '/educator', { auth: true });
  state.edu.loading = false;
  if (res.ok) { state.edu.data = res.data; state.edu.error = ''; }
  else state.edu.error = res.status === 404 ? 'Educator applications aren’t available right now. Please try again later.' : problem(res, 'Could not load your application. Please try again.');
  if (state.screen === 'educator' || state.screen === 'profile') render({ keepScroll: true });
}

// ---------- In-app update (Android 0.5.1 and newer) ----------

async function startUpdate() {
  if (!canSelfUpdate()) { openExternal(updateUrl()); return; }
  state.sheet = 'update';
  if (state.upd?.phase === 'download' || state.upd?.phase === 'ready') { render({ keepScroll: true }); return; }
  state.upd = { phase: 'download', percent: 0 };
  render({ keepScroll: true });
  try {
    const got = await downloadUpdate(apkUrl(), (percent) => {
      state.upd.percent = percent;
      // Move the bar in place: redrawing the whole screen for every percent would flicker.
      const bar = document.getElementById('upd-bar');
      if (!bar) return;
      bar.style.width = `${percent}%`;
      bar.parentElement.setAttribute('aria-valuenow', percent);
      document.getElementById('upd-pct').textContent = `${percent}%`;
    });
    state.upd = { phase: 'ready', version: got.versionName };
  } catch (e) {
    if (e?.code === 'NOT_NEWER') {
      // The admin's build number is ahead of the published APK: nothing to install yet, so rest the banner.
      store.update((s) => { s.updateSnooze = { build: latestBuild(), until: Date.now() + 12 * 3600e3 }; });
      state.upd = { phase: 'current' };
    } else {
      state.upd = { phase: 'error', error: e?.message };
    }
  }
  if (state.sheet === 'update') render({ keepScroll: true });
  else if (state.upd.phase === 'ready') toast('The update is ready. Tap the banner to install it.');
}

async function installNow() {
  if (!(await installAllowed())) {
    state.upd = { ...state.upd, phase: 'permission' };
    render({ keepScroll: true });
    return;
  }
  try {
    await installUpdate();
  } catch (e) {
    state.upd = { phase: 'error', error: e?.message };
    render({ keepScroll: true });
  }
}

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
  const squadParam = cleanCode(params.get('squad'));
  // From the website's Hindi pages: questions in Hindi, unless the player has already chosen a language.
  if (params.get('lang') === 'hi' && !data().settings.qlangAsked) store.update((s) => { s.settings.qlang = 'hi'; s.settings.qlangAsked = true; });
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
  const duelParam = String(params.get('duel') || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (duelParam.length === 6) {
    // ?duel=CODE: a friend's live duel. New players set up first; the duel waits for sign-in.
    history.replaceState(history.state, '', location.pathname);
    if (!data().profile || !data().exam) { state.pendingDuel = duelParam; return; }
    setTimeout(() => joinLive(duelParam), 0);
    return;
  }
  const leagueParam = cleanLeagueCode(params.get('league'));
  if (isLeagueCode(leagueParam)) {
    // ?league=CODE: a tutor's league invite. New players set up first; the invite waits for sign-in.
    history.replaceState(history.state, '', location.pathname);
    if (!data().profile || !data().exam) { state.pendingLeague = leagueParam; return; }
    state.screen = 'league';
    openLeagueInvite(leagueParam, { draw: false });
    return;
  }
  if (squadParam.length === CODE_LENGTH) {
    // ?squad=CODE: a squad invite. New players set up first; the invite waits for sign-in.
    history.replaceState(history.state, '', location.pathname);
    if (!data().profile || !data().exam) { state.pendingSquad = squadParam; return; }
    state.screen = 'squad';
    openInvite(squadParam, { draw: false });
    return;
  }
  // From a website practice page: ?practice=percentages starts that topic's practice.
  const practiceParam = topicSlug(params.get('practice') || '');
  if (practiceParam) {
    history.replaceState(history.state, '', location.pathname);
    const sections = topicsBySection();
    const found = ['quant', 'reasoning'].flatMap((topic) => sections[topic].map((t) => ({ label: t.label, topic }))).find((t) => topicSlug(t.label) === practiceParam);
    if (found && data().profile && data().exam) { state.stack = ['practice']; state.screen = 'practice'; state.pendingPractice = found; }
    return;
  }
  if (!code && !open) { if (examParam || params.has('lang')) history.replaceState(history.state, '', location.pathname); return; }
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
  // From the website: the League tab, the tutors page (and its QR code), and the report form (contact page).
  if (hasProfile && data().exam && open === 'league') state.screen = 'league';
  if (open === 'educator') {
    if (hasProfile && data().exam) { state.stack = ['home']; state.screen = 'educator'; queueMicrotask(loadEducator); }
    else state.pendingEducator = true;
  }
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

/**
 * The web app moved from takkar.vercel.app to playtakkar.in. Guest games are saved per address,
 * so players with games here stay (Home tells them how to move them); everyone else, old
 * challenge and invite links included, goes to the same page at the new address.
 */
const onOldAddress = !IS_NATIVE && location.hostname === OLD_WEB_HOST;
if (onOldAddress && !data().profile) location.replace(SITE_URL + location.pathname + location.search + location.hash);
else start();

function start() {
  initSystemBars();
  // Exam first: new players, and players from before exams, choose one before anything else.
  state.screen = !data().exam ? 'exam-pick' : data().profile ? 'home' : 'welcome';
  openLinkTarget();
  // A mini mock that was running when the page closed comes back where it was.
  const resumedMock = state.screen === 'home' && restoreMock();
  render();
  if (state.pendingPractice && !resumedMock) { const p = state.pendingPractice; state.pendingPractice = null; startPractice(p.label, p.topic); }
  if (resumedMock) { startMockClock(); toast('Your mini mock is back where you left it.'); }
  if (state.linkError) { toast(state.linkError); state.linkError = ''; }
  introPlaying = true;
  const intro = playIntro({ once: !IS_NATIVE });
  syncSystemBars();
  intro.then(() => { introPlaying = false; syncSystemBars(); });
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
  onReminderTap((x) => {
    if (x.go === 'league' && x.leagueId && signedIn()) openLeague(x.leagueId);
    else if (data().profile && data().exam) go('home', { reset: true });
  });
  planDailyReminders();
  planTestReminders();
  intro.then(() => setTimeout(measureGlass, 300));
}
