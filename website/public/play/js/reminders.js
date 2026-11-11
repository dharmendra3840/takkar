// Reminders on this phone (Android app 0.7.0 and newer): the daily duel at the player's chosen time, and the
// live tests of their tutors' leagues. Android's alarms deliver them, so they need no server and work offline.
// The web app and older APKs have no notifications plugin, and the switches say so.
import { istDay } from './time.js?v=5f284911c5';
import { hashString } from './engine/rng.js?v=5f284911c5';

const plugin = () => window.Capacitor?.Plugins?.LocalNotifications;
export const remindersAvailable = () => typeof window !== 'undefined' && !!plugin();

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

/** The times a player can pick: every hour from 7 am to 9 pm, never in the quiet hours (10 pm to 7 am). */
export const REMINDER_TIMES = Array.from({ length: 15 }, (_, i) => `${String(7 + i).padStart(2, '0')}:00`);
export const DEFAULT_REMINDER_TIME = '19:00';
export const DAILY_DAYS = 7; // the next week is planned; every open of the app plans it again
const DAILY_IDS = Array.from({ length: DAILY_DAYS }, (_, i) => 1000 + i);
const isTestId = (id) => id >= 2000;
export const TEST_LEAD_MIN = 10;

/** "7 pm", "9:30 am". */
export function timeLabel(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}
const clockOf = (ms) => new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

/** The moment hh:mm happens on an IST day. */
export function atIst(day, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return day * DAY_MS - IST_OFFSET_MS + (h * 60 + m) * MIN;
}

const TEXT = {
  en: {
    streak: (n) => [`Your ${n}-day streak ends at midnight`, 'One duel keeps it going.'],
    goal: (k) => [`${k} ${k === 1 ? 'duel' : 'duels'} left for today’s goal`, 'Ten questions, one rival.'],
    daily: (exam) => [
      ['Today’s takkar is ready', 'Ten questions, one rival. Can you beat it?'],
      [`${exam} practice: 10 questions`, 'Your exam’s marking, a rival, and the steps after each answer.'],
      ['A few minutes for practice?', 'One duel a day adds up by exam day.'],
    ],
    soon: (t, league, until) => [`${t} starts in ${TEST_LEAD_MIN} minutes`, `${league}. You can start until ${until}.`],
    open: (t, until, minutes) => [`${t} starts now`, `Open Takkar to start before ${until}. You get the full ${minutes} minutes.`],
  },
  hi: {
    streak: (n) => [`आपकी ${n} दिन की स्ट्रीक आज रात खत्म हो जाएगी`, 'एक टक्कर खेलें और स्ट्रीक बचाएँ।'],
    goal: (k) => [`आज के लक्ष्य के लिए ${k} टक्कर बाकी`, 'दस सवाल, एक प्रतिद्वंद्वी।'],
    daily: (exam) => [
      ['आज की टक्कर तैयार है', 'दस सवाल, एक प्रतिद्वंद्वी। क्या आप जीतेंगे?'],
      [`${exam} की प्रैक्टिस: 10 सवाल`, 'असली परीक्षा जैसी मार्किंग, और हर जवाब के बाद स्टेप्स।'],
      ['प्रैक्टिस के लिए कुछ मिनट?', 'रोज़ एक टक्कर, परीक्षा तक बड़ा फ़र्क।'],
    ],
    soon: (t, league, until) => [`${t} ${TEST_LEAD_MIN} मिनट में शुरू होगा`, `${league}। आप ${until} तक शुरू कर सकते हैं।`],
    open: (t, until, minutes) => [`${t} अब शुरू हो रहा है`, `${until} से पहले Takkar खोलकर शुरू करें। आपको पूरे ${minutes} मिनट मिलेंगे।`],
  },
};

/**
 * The daily reminders for the next week. Today's is skipped once today's goal is met (one duel without a goal)
 * or its time has passed; today's text names the streak at stake or the duels left. Later days rotate a few lines,
 * because what the player does in between is not known yet: opening the app plans them again.
 * p: { on, time, lang, examShort, streak (alive today), playedToday, goal, doneToday, now }
 */
export function planDaily(p) {
  if (!p.on) return [];
  const t = TEXT[p.lang] || TEXT.en;
  const today = istDay(p.now);
  const out = [];
  for (let i = 0; i < DAILY_DAYS; i++) {
    const day = today + i;
    const at = atIst(day, p.time || DEFAULT_REMINDER_TIME);
    if (at <= p.now + MIN) continue;
    let text;
    if (i === 0) {
      const target = p.goal || 1;
      if (p.doneToday >= target) continue;
      if (p.streak >= 2 && !p.playedToday) text = t.streak(p.streak);
      else if (p.goal && p.doneToday > 0) text = t.goal(target - p.doneToday);
    }
    if (!text) { const lines = t.daily(p.examShort || 'SSC'); text = lines[day % lines.length]; }
    out.push({ id: DAILY_IDS[i], at, title: text[0], body: text[1], extra: { go: 'home' }, channelId: 'daily' });
  }
  return out;
}

/** Two ids per test, from the test's own id, so a test planned twice replaces itself. */
export function testIds(testId) {
  const h = hashString(String(testId)) % 400000;
  return [2000 + h * 2, 2001 + h * 2];
}

/**
 * Reminders for live tests the player can still start: TEST_LEAD_MIN minutes before the start, and when it opens.
 * tests: [{ id, title, startsAt, lateMinutes, durationMinutes, state, you, leagueId, leagueName }]
 */
export function planTests(tests, { lang, now }) {
  const t = TEXT[lang] || TEXT.en;
  const out = [];
  for (const x of tests) {
    if (!['scheduled', 'open'].includes(x.state) || (x.you && x.you !== 'none')) continue;
    const start = Date.parse(x.startsAt);
    const until = clockOf(start + x.lateMinutes * MIN);
    const [soonId, openId] = testIds(x.id);
    const extra = { go: 'league', leagueId: x.leagueId };
    const soon = start - TEST_LEAD_MIN * MIN;
    if (soon > now + MIN) { const [title, body] = t.soon(x.title, x.leagueName, until); out.push({ id: soonId, at: soon, title, body, extra, channelId: 'tests' }); }
    if (start > now + MIN) { const [title, body] = t.open(x.title, until, x.durationMinutes); out.push({ id: openId, at: start, title, body, extra, channelId: 'tests' }); }
  }
  return out;
}

// ---------- talking to Android ----------

let channelsMade = false;
async function channels(p) {
  if (channelsMade || !p.createChannel) return;
  channelsMade = true;
  await p.createChannel({ id: 'daily', name: 'Daily reminder', description: 'Your daily duel, at the time you choose', importance: 3 }).catch(() => {});
  await p.createChannel({ id: 'tests', name: 'Live tests', description: 'Your tutors’ live tests, 10 minutes before and at the start', importance: 4 }).catch(() => {});
}

/** 'granted', 'denied', 'prompt' or 'unavailable'. With ask, Android shows its "Allow notifications?" question. */
export async function notificationPermission(ask = false) {
  const p = plugin();
  if (!p) return 'unavailable';
  try {
    let s = (await p.checkPermissions()).display;
    if (s !== 'granted' && ask) s = (await p.requestPermissions()).display;
    return s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'prompt';
  } catch { return 'unavailable'; }
}

/** Replaces the reminders of one kind ('daily' or 'tests') with this plan. Updates of a kind take turns. */
const queues = { daily: Promise.resolve(), tests: Promise.resolve() };
export function applyPlan(kind, plan) {
  const run = queues[kind].then(() => replace(kind, plan));
  queues[kind] = run.catch(() => {});
  return run;
}

async function replace(kind, plan) {
  const p = plugin();
  if (!p) return false;
  try {
    if ((await p.checkPermissions()).display !== 'granted') return false;
    await channels(p);
    const pending = (await p.getPending()).notifications || [];
    const ours = pending.filter((n) => (kind === 'tests' ? isTestId(n.id) : DAILY_IDS.includes(n.id)));
    if (ours.length) await p.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
    if (!plan.length) return true;
    await p.schedule({
      notifications: plan.map((n) => ({
        id: n.id, title: n.title, body: n.body, extra: n.extra, channelId: n.channelId,
        schedule: { at: new Date(n.at), allowWhileIdle: true },
        smallIcon: 'ic_stat_takkar', iconColor: '#2A3BE8', autoCancel: true,
      })),
    });
    return true;
  } catch { return false; }
}

/** What to open when a reminder is tapped: fn({ go, leagueId }). */
export function onReminderTap(fn) {
  const p = plugin();
  if (!p?.addListener) return;
  p.addListener('localNotificationActionPerformed', (e) => { try { fn(e?.notification?.extra || {}); } catch { /* the app opens as usual */ } });
}
