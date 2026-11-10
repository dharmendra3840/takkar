// Reminders on the phone (reminders.js): what gets scheduled, and when.
import { planDaily, planTests, atIst, testIds, timeLabel, REMINDER_TIMES, DAILY_DAYS, TEST_LEAD_MIN } from '../www/js/reminders.js';
import { istDay } from '../www/js/time.js';

let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const MIN = 60000;
const ist = (iso) => Date.parse(`${iso}+05:30`);
const istClock = (ms) => new Date(ms + 5.5 * 3600000).toISOString().slice(11, 16);

// ---------- times ----------
check('Times run 7 am to 9 pm, never in the quiet hours', REMINDER_TIMES[0] === '07:00' && REMINDER_TIMES.at(-1) === '21:00' && REMINDER_TIMES.every((t) => +t.slice(0, 2) >= 7 && +t.slice(0, 2) <= 21));
check('Labels read like people say them', timeLabel('07:00') === '7 am' && timeLabel('12:00') === '12 pm' && timeLabel('19:00') === '7 pm' && timeLabel('21:30') === '9:30 pm');
check('atIst gives the moment in India, whatever the phone’s zone', istClock(atIst(istDay(ist('2026-11-10T03:00:00')), '19:00')) === '19:00');

// ---------- the daily reminder ----------
const base = { on: true, time: '19:00', lang: 'en', examShort: 'SSC CGL', streak: 0, playedToday: false, goal: null, doneToday: 0 };
const morning = ist('2026-11-10T09:00:00');
let plan = planDaily({ ...base, now: morning });
check('Off: nothing is scheduled', planDaily({ ...base, on: false, now: morning }).length === 0);
check('On: one a day for the next week, at the chosen time', plan.length === DAILY_DAYS && plan.every((n) => istClock(n.at) === '19:00') && new Set(plan.map((n) => istDay(n.at))).size === DAILY_DAYS);
check('Each day has its own id, so a new plan replaces the old one', new Set(plan.map((n) => n.id)).size === DAILY_DAYS && plan.every((n) => n.id >= 1000 && n.id < 2000));
check('Tapping it opens Home', plan.every((n) => n.extra.go === 'home' && n.channelId === 'daily'));
plan = planDaily({ ...base, now: ist('2026-11-10T20:00:00') });
check('After today’s time: today is skipped, the next days stay', plan.length === DAILY_DAYS - 1 && istDay(plan[0].at) === istDay(ist('2026-11-10T20:00:00')) + 1);
plan = planDaily({ ...base, playedToday: true, doneToday: 1, now: morning });
check('Played today (no goal): today is skipped', plan.length === DAILY_DAYS - 1 && istDay(plan[0].at) === istDay(morning) + 1);
plan = planDaily({ ...base, goal: 3, playedToday: true, doneToday: 1, now: morning });
check('Goal of 3, one done: today says how many are left', plan.length === DAILY_DAYS && plan[0].title === '2 duels left for today’s goal', plan[0].title);
check('Goal met: today is skipped', planDaily({ ...base, goal: 3, playedToday: true, doneToday: 3, now: morning }).length === DAILY_DAYS - 1);
plan = planDaily({ ...base, streak: 5, now: morning });
check('A streak at stake: today’s reminder says so', plan[0].title === 'Your 5-day streak ends at midnight', plan[0].title);
check('…and later days use the usual lines', plan.slice(1).every((n) => !/streak/.test(n.title)));
check('The exam shows up in the lines', plan.some((n) => n.title.includes('SSC CGL')));
plan = planDaily({ ...base, lang: 'hi', streak: 4, now: morning });
check('Hindi questions: Hindi reminders', /[ऀ-ॿ]/.test(plan[0].title) && plan.every((n) => /[ऀ-ॿ]/.test(n.title + n.body)), plan[0].title);
check('An unknown time falls back to 7 pm', planDaily({ ...base, time: undefined, now: morning }).every((n) => istClock(n.at) === '19:00'));

// ---------- live tests ----------
const now = ist('2026-11-10T09:00:00');
const test = (over) => ({ id: 'lt_a1', title: 'Mock Test 1', startsAt: new Date(now + 60 * MIN).toISOString(), lateMinutes: 5, durationMinutes: 30, state: 'scheduled', you: 'none', leagueId: 'lg_1', leagueName: 'SSC Batch A', ...over });
let tp = planTests([test()], { lang: 'en', now });
check('A scheduled test: one reminder before, one at the start', tp.length === 2 && tp[0].at === now + (60 - TEST_LEAD_MIN) * MIN && tp[1].at === now + 60 * MIN);
check('…saying when entry closes and how long they get', /starts in 10 minutes/.test(tp[0].title) && /SSC Batch A/.test(tp[0].body) && /10:05/.test(tp[0].body) && /30 minutes/.test(tp[1].body), tp[0].body + ' | ' + tp[1].body);
check('Tapping it opens the league', tp.every((n) => n.extra.go === 'league' && n.extra.leagueId === 'lg_1' && n.channelId === 'tests'));
check('Ids come from the test, two each, apart from the daily ones', testIds('lt_a1')[1] === testIds('lt_a1')[0] + 1 && tp.map((n) => n.id).join() === testIds('lt_a1').join() && testIds('lt_a1')[0] >= 2000);
check('Different tests get different ids', testIds('lt_a1')[0] !== testIds('lt_b2')[0]);
tp = planTests([test({ startsAt: new Date(now + 5 * MIN).toISOString() })], { lang: 'en', now });
check('Starting in 5 minutes: only the "open now" one is left', tp.length === 1 && /starts now/.test(tp[0].title));
check('Already started, sat, cancelled or closed: nothing', planTests([test({ state: 'open', startsAt: new Date(now - MIN).toISOString() }), test({ id: 'x2', you: 'done' }), test({ id: 'x3', you: 'sitting' }), test({ id: 'x4', state: 'cancelled' }), test({ id: 'x5', state: 'ended' })], { lang: 'en', now }).length === 0);
tp = planTests([test()], { lang: 'hi', now });
check('Hindi: test reminders in Hindi, with the tutor’s own title', /[ऀ-ॿ]/.test(tp[0].title) && tp[0].title.includes('Mock Test 1'), tp[0].title);

console.log(failed ? `\n${failed} failed` : '\nReminders: all checks passed.');
process.exit(failed ? 1 : 0);
