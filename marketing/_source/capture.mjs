// Captures clean, populated app screenshots for marketing.
import puppeteer from 'puppeteer-core';

const OUT = 'C:/Users/Asus/Desktop/Projects/Takkar/marketing/screenshots';
const BASE = 'http://localhost:8800/app/www/';
const DAY = 86400000;
const istDay = Math.floor((Date.now() + 5.5 * 3600000) / DAY);
const weekStart = istDay - ((istDay + 3) % 7);

// A believable player: past weeks of practice, an 8-day streak, two ranked duels this week.
function answers(right, seed) {
  const labels = [['quant', 'Percentages'], ['reasoning', 'Number series'], ['quant', 'Time and work'], ['reasoning', 'Coding and decoding'], ['quant', 'Profit and loss'], ['reasoning', 'Direction sense'], ['quant', 'Simple interest'], ['reasoning', 'Ranking'], ['quant', 'Trains'], ['reasoning', 'Calendar']];
  return labels.map(([topic, label], i) => ({ topic, label, choice: (i + seed) % 10 === 9 ? null : 1, correct: ((i * 7 + seed) % 10) < right, timeMs: 9000 + ((i * 1337 + seed * 97) % 12000) }));
}
const history = [];
let id = 0;
for (let d = weekStart - 14; d < weekStart; d++) {
  for (let k = 0; k < 2; k++) {
    const right = 6 + ((d + k) % 3);
    history.push({ id: `h${id++}`, at: d * DAY, day: d, kind: 'solo', seed: d * 10 + k, topic: 'mixed', level: 'exam', marking: 'exam', rival: 'steady', status: 'finished', score: right * 4 - (9 - right), rivalScore: 24, verdict: right >= 7 ? 'won' : 'lost', counted: true, right, wrong: 9 - right, skipped: 1, timeMs: 140000, answers: answers(right, d + k) });
  }
}
history.push({ id: `h${id++}`, at: weekStart * DAY, day: weekStart, kind: 'solo', seed: 11, topic: 'mixed', level: 'exam', marking: 'exam', rival: 'steady', status: 'finished', score: 31, rivalScore: 24, verdict: 'won', counted: true, right: 8, wrong: 1, skipped: 1, timeMs: 138000, answers: answers(8, 3) });
const STATE = {
  profile: { nickname: 'Riya', ageConfirmedAt: new Date().toISOString(), termsVersion: '2026-10-prototype', createdAt: new Date().toISOString() },
  settings: { topic: 'mixed', level: 'exam', marking: 'exam', rival: 'steady', reminders: true },
  history,
  streak: { current: 7, best: 12, lastDay: istDay - 1 },
  plus: null,
  flags: [],
  league: { channel: 'SSC Maths with Rahul', code: 'YANJTH', createdAt: new Date().toISOString() },
  reactions: [],
};

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await page.evaluateOnNewDocument((state) => {
  if (!sessionStorage.getItem('seeded')) {
    localStorage.setItem('takkar.v1', JSON.stringify(state));
    localStorage.setItem('takkar.glass', 'on');
    sessionStorage.setItem('seeded', '1');
  }
  // Fixed duel seed so the screenshots show a chosen set of questions.
  const real = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = (arr) => (arr instanceof Uint32Array && arr.length === 1 && window.__seed ? (arr[0] = window.__seed, arr) : real(arr));
}, STATE);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = () => page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
const shot = async (name) => { await clean(); await sleep(350); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('saved', name); };
const tap = async (sel) => { const el = await page.waitForSelector(sel, { timeout: 8000 }); await el.evaluate((e) => e.scrollIntoView({ block: 'center' })); await el.click(); await sleep(400); };
const top = () => page.evaluate(() => window.scrollTo(0, 0));

await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await sleep(800);

// Home
await shot('02-home');

// Duel with a fixed seed: answer the first four correctly, capture question 5 mid-clock.
await page.evaluate(() => { window.__seed = 200; });
const correct = await page.evaluate(async () => {
  const { generateDuel, orderForPlayer } = await import('./js/engine/index.js');
  return generateDuel(200, 'mixed', 'exam').map((q, i) => orderForPlayer(q, 'riya', i).answerIndex);
});
await tap('[data-action="start-duel"]');
const pickWrong = (i) => (correct[i] + 1) % 4;
for (let i = 0; i < 4; i++) {
  await tap(`[data-action="answer"][data-index="${i === 1 ? pickWrong(i) : correct[i]}"]`);
  await tap('#next-btn');
}
await sleep(11500); // let the clock run down to about 18s
await shot('03-duel');
await tap(`[data-action="answer"][data-index="${correct[4]}"]`);
await shot('04-answer-reveal');
await tap('#next-btn');
for (let i = 5; i < 10; i++) {
  await tap(`[data-action="answer"][data-index="${i === 7 ? 'skip' : correct[i]}"]`);
  await tap('#next-btn');
}
await page.waitForSelector('.verdict');
await top();
await shot('05-result');
await page.evaluate(() => { const d = document.querySelector('details'); if (d) d.open = true; });
await page.evaluate(() => document.querySelector('details')?.scrollIntoView({ block: 'start' }));
await page.evaluate(() => window.scrollBy(0, -140));
await shot('06-mistakes-with-steps');

// A challenge from a friend
const code = await page.evaluate(async () => {
  const { encodeChallenge } = await import('./js/code.js');
  return encodeChallenge({ seed: 4321, topic: 'mixed', level: 'exam', marking: 'exam', score: 31, nickname: 'Rohit' });
});
await tap('[data-action="go"][data-to="home"]');
await tap('[data-to="challenge-entry"]');
await page.type('#code', code);
await tap('[data-action="check-code"]');
await top();
await shot('07-challenge-received');
await tap('[data-action="back"]');

// League (educator demo)
await tap('.tabbar [data-to="league"]');
await top();
await shot('08-league');
await page.evaluate(() => document.getElementById('report-title').scrollIntoView({ block: 'start' }));
await page.evaluate(() => window.scrollBy(0, -24));
await shot('09-league-report');

// Squad, ranks, profile
await tap('.tabbar [data-to="squad"]');
await top();
await shot('10-squad');
await tap('.tabbar [data-to="ranks"]');
await top();
await shot('11-ranks');
await tap('.tabbar [data-to="profile"]');
await top();
await shot('12-profile');
await tap('[data-action="go"][data-to="plus"]');
await top();
await shot('13-plus');

// Settings sheet
await tap('[data-action="back"]');
await tap('.tabbar [data-to="home"]');
await tap('[data-action="open-settings"]');
await shot('14-duel-settings');

// Welcome (fresh install)
await page.evaluate(() => { localStorage.removeItem('takkar.v1'); });
await page.reload({ waitUntil: 'networkidle0' });
await sleep(600);
await shot('01-welcome');

await browser.close();
