// Renders Takkar promotional images from the app screenshots.
// Rules from the docs: no result promises, no invented numbers, no exam-body
// logos, competitors only by category, 18+ and "no cash prizes" stated.
import puppeteer from 'puppeteer-core';

const ROOT = 'C:/Users/Asus/Desktop/Projects/Takkar/marketing';
const BASE = 'http://localhost:8800/';
const SS = (name) => `marketing/screenshots/${name}.png`;

const CSS = `
@font-face{font-family:'Bricolage';font-weight:200 800;src:url(app/www/fonts/bricolage-grotesque-latin-opsz-normal.woff2) format('woff2-variations')}
@font-face{font-family:'Hind';font-weight:400;src:url(app/www/fonts/hind-latin-400-normal.woff2) format('woff2')}
@font-face{font-family:'Hind';font-weight:500;src:url(app/www/fonts/hind-latin-500-normal.woff2) format('woff2')}
@font-face{font-family:'Hind';font-weight:600;src:url(app/www/fonts/hind-latin-600-normal.woff2) format('woff2')}
@font-face{font-family:'Hind';font-weight:400 800;src:url(app/www/fonts/hind-devanagari-600-normal.woff2) format('woff2');unicode-range:U+0900-097F,U+20B9}
*{box-sizing:border-box;margin:0;padding:0}
html,body{overflow:hidden}
body{font-family:'Hind',sans-serif;-webkit-font-smoothing:antialiased}
.d{font-family:'Bricolage','Hind',sans-serif;font-weight:800;letter-spacing:-0.04em;line-height:0.95}
.canvas{position:relative;overflow:hidden}
.ink{background:#070A1F;color:#fff}
.mist{background:#ECEFF8;color:#0D1130}
.glow{position:absolute;border-radius:50%;pointer-events:none}
.gc{background:radial-gradient(circle closest-side,rgba(42,59,232,.75),rgba(42,59,232,0))}
.gs{background:radial-gradient(circle closest-side,rgba(255,106,0,.5),rgba(255,106,0,0))}
.mist .gc{background:radial-gradient(circle closest-side,rgba(42,59,232,.35),rgba(42,59,232,0))}
.mist .gs{background:radial-gradient(circle closest-side,rgba(255,106,0,.32),rgba(255,106,0,0))}
.phone{position:absolute;border-radius:9% / 4.2%;background:#0D1130;padding:2.2%;box-shadow:0 60px 120px rgba(0,0,0,.45),0 0 0 2px rgba(255,255,255,.12) inset}
.phone img{display:block;width:100%;border-radius:7.6% / 3.5%}
.brand{display:flex;align-items:center;gap:.28em;font-family:'Bricolage';font-weight:800;letter-spacing:-0.03em}
.brand svg{height:.9em;width:auto}
.pill{display:inline-block;padding:.35em .9em;border-radius:999px;font-weight:600}
.tag{color:#FFB27D;border:2px solid #FF8A3D}
.foot{position:absolute;font-size:22px;opacity:.75}
.c-cobalt{color:#A9B4FF}.c-saffron{color:#FF8A3D}
.mist .c-cobalt{color:#2A3BE8}.mist .c-saffron{color:#B84700}
`;

const MARK = (dark = true) => `<svg viewBox="0 0 40 32"><circle cx="14" cy="16" r="11" fill="${dark ? '#4B5DFF' : '#2A3BE8'}"/><circle cx="26" cy="16" r="11" fill="#FF6A00"/><path d="M20 6.78 A11 11 0 0 0 20 25.22 A11 11 0 0 0 20 6.78 Z" fill="${dark ? '#FFFFFF' : '#0D1130'}"/></svg>`;
const BRAND = (size, dark = true) => `<div class="brand" style="font-size:${size}px">${MARK(dark)}<span>takkar</span></div>`;
const phone = (img, { left, top, width, rotate = 0, z = 1 }) => `<div class="phone" style="left:${left}px;top:${top}px;width:${width}px;transform:rotate(${rotate}deg);z-index:${z}"><img src="${SS(img)}"></div>`;
const LEGAL = 'For aspirants aged 18 and over · No cash prizes or betting · Not affiliated with any exam body';

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();

async function render(path, w, h, body, { transparent = false, pdf = false } = {}) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(BASE + 'marketing/', { waitUntil: 'load' }).catch(() => {});
  await page.setContent(`<!doctype html><html><head><base href="${BASE}"><style>${CSS}</style></head><body style="width:${w}px;height:${h}px;${transparent ? 'background:transparent' : ''}">${body}</body></html>`, { waitUntil: 'load' });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
  if (pdf) {
    await page.pdf({ path: `${ROOT}/${path}`, width: `${w}px`, height: `${h}px`, printBackground: true, pageRanges: '1' });
  } else {
    await page.screenshot({ path: `${ROOT}/${path}`, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  }
  console.log('rendered', path);
}

// ---------- Play Store screenshots, 1080 x 1920 ----------
const STORE = [
  ['store/01-roz-ek-takkar.png', '03-duel', 'ink', 'Roz ek takkar.', 'Ten Quant and Reasoning questions against a rival, every day. About four minutes.'],
  ['store/02-steps-for-every-answer.png', '04-answer-reveal', 'ink', 'Every answer, solved step by step.', 'See the method the moment you answer, so tomorrow’s question feels familiar.'],
  ['store/03-exam-marking.png', '05-result', 'mist', 'Marked like the real paper.', '+4 right, −1 wrong, 0 skipped: the same penalty ratio as most SSC and banking papers.'],
  ['store/04-challenge-friends.png', '07-challenge-received', 'mist', 'Same ten questions. Beat your friend.', 'Send a challenge code on WhatsApp or Telegram. No contacts, no phone number.'],
  ['store/05-educator-leagues.png', '08-league', 'ink', 'Your teacher’s league, every day.', 'One shared daily duel for the whole channel and a weekly table.'],
  ['store/06-squads.png', '10-squad', 'mist', 'Squads of eight. A mission each week.', 'Invite-only. Quick reactions, no chat and no strangers.'],
  ['store/07-ranks.png', '11-ranks', 'ink', 'Ranks you earn, never buy.', 'Weekly ranks reset every Monday. Plus never changes your score.'],
  ['store/08-your-progress.png', '12-profile', 'mist', 'See where you lose time.', 'Accuracy and speed by topic. Your data stays yours: download or delete it any time.'],
];
for (const [path, img, theme, title, sub] of STORE) {
  await render(path, 1080, 1920, `
  <div class="canvas ${theme}" style="width:1080px;height:1920px">
    <div class="glow gc" style="left:-300px;top:-260px;width:1100px;height:1100px"></div>
    <div class="glow gs" style="right:-380px;top:900px;width:1100px;height:1100px"></div>
    <div style="position:absolute;left:84px;top:96px;right:84px">
      ${BRAND(44, theme === 'ink')}
      <h1 class="d" style="margin-top:56px;font-size:${title.length > 30 ? 92 : 108}px">${title}</h1>
      <p style="margin-top:28px;font-size:36px;line-height:1.35;opacity:.85;max-width:860px">${sub}</p>
    </div>
    ${phone(img, { left: 175, top: 600, width: 730 })}
  </div>`);
}

// ---------- Play Store feature graphic, 1024 x 500 ----------
await render('store/feature-graphic-1024x500.png', 1024, 500, `
<div class="canvas ink" style="width:1024px;height:500px">
  <div class="glow gc" style="left:-200px;top:-260px;width:760px;height:760px"></div>
  <div class="glow gs" style="right:-220px;top:40px;width:700px;height:700px"></div>
  <div style="position:absolute;left:64px;top:70px">
    ${BRAND(34)}
    <h1 class="d" style="margin-top:34px;font-size:96px">Roz ek<br>takkar.</h1>
    <p style="margin-top:22px;font-size:24px;opacity:.85">A daily quiz duel for SSC, banking and railway aspirants.</p>
  </div>
  ${phone('03-duel', { left: 640, top: 60, width: 250, rotate: -6 })}
  ${phone('04-answer-reveal', { left: 790, top: 120, width: 220, rotate: 6, z: 0 })}
</div>`);

// ---------- Social posts, 1080 x 1080 ----------
await render('social/post-01-roz-ek-takkar.png', 1080, 1080, `
<div class="canvas ink" style="width:1080px;height:1080px">
  <div class="glow gc" style="left:-280px;top:-300px;width:1000px;height:1000px"></div>
  <div class="glow gs" style="right:-340px;top:380px;width:980px;height:980px"></div>
  <div style="position:absolute;left:80px;top:80px;width:520px">
    ${BRAND(40)}
    <h1 class="d" style="margin-top:70px;font-size:150px">Roz ek<br>takkar.</h1>
    <p style="margin-top:36px;font-size:34px;line-height:1.35;opacity:.88">Ten questions. One rival. Four minutes a day.</p>
    <p class="pill tag" style="margin-top:40px;font-size:24px">Free · 18+ · takkar.info</p>
  </div>
  ${phone('03-duel', { left: 620, top: 150, width: 400, rotate: -4 })}
</div>`);

await render('social/post-02-exam-marking.png', 1080, 1080, `
<div class="canvas mist" style="width:1080px;height:1080px">
  <div class="glow gc" style="left:-260px;top:-260px;width:900px;height:900px"></div>
  <div class="glow gs" style="right:-300px;bottom:-300px;width:900px;height:900px"></div>
  <div style="position:absolute;left:80px;top:80px;right:80px">
    ${BRAND(40, false)}
    <h1 class="d" style="margin-top:60px;font-size:84px">Practise the way the paper marks you.</h1>
  </div>
  <div style="position:absolute;left:80px;right:80px;top:470px;display:flex;gap:28px">
    ${[['+4', 'Right', '#2A3BE8', '#fff'], ['−1', 'Wrong', '#FF6A00', '#0D1130'], ['0', 'Skipped', '#fff', '#0D1130']].map(([n, l, bg, fg]) => `
      <div style="flex:1;border-radius:40px;background:${bg};color:${fg};padding:40px 34px;box-shadow:0 30px 60px rgba(13,17,48,.15)">
        <div class="d" style="font-size:150px">${n}</div><div style="font-size:36px;font-weight:600;margin-top:10px">${l}</div></div>`).join('')}
  </div>
  <p style="position:absolute;left:80px;right:80px;top:850px;font-size:34px;line-height:1.35">The same penalty ratio as most SSC and banking papers. Guessing has a cost, so you learn when to skip.</p>
</div>`);

await render('social/post-03-no-betting.png', 1080, 1080, `
<div class="canvas ink" style="width:1080px;height:1080px">
  <div class="glow gc" style="left:-200px;top:-200px;width:900px;height:900px"></div>
  <div class="glow gs" style="right:-300px;bottom:-320px;width:900px;height:900px"></div>
  <div style="position:absolute;left:80px;top:80px;right:80px">
    ${BRAND(40)}
    <h1 class="d" style="margin-top:110px;font-size:118px">No cash prizes.<br>No betting.<br><span class="c-saffron">Ever.</span></h1>
    <p style="margin-top:60px;font-size:36px;line-height:1.4;opacity:.9;max-width:860px">You play for practice, streaks and rank. Ranks can’t be bought, and Plus never changes your score.</p>
  </div>
  <p class="foot" style="left:80px;bottom:60px">For aspirants aged 18 and over · takkar.info</p>
</div>`);

await render('social/post-04-challenge.png', 1080, 1080, `
<div class="canvas mist" style="width:1080px;height:1080px">
  <div class="glow gc" style="left:-260px;top:-240px;width:900px;height:900px"></div>
  <div class="glow gs" style="right:-260px;top:300px;width:900px;height:900px"></div>
  ${phone('05-result', { left: 50, top: 200, width: 330, rotate: -5 })}
  ${phone('07-challenge-received', { left: 250, top: 290, width: 330, rotate: 5, z: 2 })}
  <div style="position:absolute;left:630px;top:120px;right:60px">
    ${BRAND(36, false)}
    <h1 class="d" style="margin-top:60px;font-size:70px">Same ten questions.</h1>
    <h1 class="d c-cobalt" style="margin-top:16px;font-size:70px">Beat your friend.</h1>
    <p style="margin-top:40px;font-size:30px;line-height:1.4">Finish a duel, send the code on WhatsApp or Telegram. Your friend plays your exact questions.</p>
  </div>
</div>`);

await render('social/post-05-steps.png', 1080, 1080, `
<div class="canvas ink" style="width:1080px;height:1080px">
  <div class="glow gc" style="left:-300px;top:-280px;width:1000px;height:1000px"></div>
  <div class="glow gs" style="right:-300px;bottom:-260px;width:900px;height:900px"></div>
  <div style="position:absolute;left:80px;top:80px;width:520px">
    ${BRAND(40)}
    <h1 class="d" style="margin-top:80px;font-size:96px">Mistakes that teach.</h1>
    <p style="margin-top:36px;font-size:34px;line-height:1.4;opacity:.88">Every question comes with the method, step by step, right after you answer.</p>
    <p style="margin-top:28px;font-size:28px;line-height:1.4" class="c-cobalt">Every answer is calculated by our engine, never copied from papers or books.</p>
  </div>
  ${phone('04-answer-reveal', { left: 620, top: 130, width: 400, rotate: 4 })}
</div>`);

// ---------- Why Takkar is different (competition by category, from the PRD) ----------
const COMPARE = [
  ['Paid test-series apps', 'Full mock tests, live classes, big question banks', 'A four-minute daily habit between your full mocks'],
  ['Free mock-test sites', 'Free, exam-pattern practice', 'A rival, friends, squads and a streak that brings you back'],
  ['Telegram quiz polls', 'Free and already in your channel', 'Timing, exam marking, full solutions, league tables and a weekly report'],
  ['General quiz apps', 'Fun and social', 'Exam-specific questions with exam-style marking'],
];
const compareCards = (dark, k = 1) => COMPARE.map(([who, good, adds]) => `
  <div style="border-radius:30px;padding:${26 * k}px ${32 * k}px;background:${dark ? 'rgba(255,255,255,.07)' : '#fff'};border:1px solid ${dark ? 'rgba(255,255,255,.14)' : 'rgba(13,17,48,.08)'}">
    <div class="d" style="font-size:${34 * k}px;letter-spacing:-0.02em">${who}</div>
    <div style="margin-top:${10 * k}px;display:grid;grid-template-columns:${170 * k}px 1fr;gap:${6 * k}px 16px;font-size:${24 * k}px;line-height:1.32">
      <span style="opacity:.7;font-weight:600">Great for</span><span>${good}</span>
      <span class="c-cobalt" style="font-weight:600">Takkar adds</span><span style="font-weight:600">${adds}</span>
    </div>
  </div>`).join('');

await render('social/why-takkar-is-different-1080x1350.png', 1080, 1350, `
<div class="canvas ink" style="width:1080px;height:1350px">
  <div class="glow gc" style="left:-300px;top:-300px;width:1000px;height:1000px"></div>
  <div class="glow gs" style="right:-360px;bottom:-300px;width:1000px;height:1000px"></div>
  <div style="position:absolute;left:70px;top:70px;right:70px">
    ${BRAND(38)}
    <h1 class="d" style="margin-top:40px;font-size:76px">Why Takkar is different</h1>
    <p style="margin-top:18px;font-size:29px;opacity:.85">Keep your course and your mocks. Takkar is the daily practice you actually come back to.</p>
    <div style="margin-top:36px;display:flex;flex-direction:column;gap:18px">${compareCards(true, 1.02)}</div>
  </div>
  <p class="foot" style="left:70px;bottom:44px;font-size:21px">${LEGAL}</p>
</div>`);

await render('display/why-takkar-is-different-1920x1080.png', 1920, 1080, `
<div class="canvas ink" style="width:1920px;height:1080px">
  <div class="glow gc" style="left:-300px;top:-400px;width:1300px;height:1300px"></div>
  <div class="glow gs" style="right:-400px;bottom:-500px;width:1300px;height:1300px"></div>
  <div style="position:absolute;left:100px;top:90px;width:620px">
    ${BRAND(44)}
    <h1 class="d" style="margin-top:70px;font-size:104px">Why Takkar is different</h1>
    <p style="margin-top:34px;font-size:36px;line-height:1.4;opacity:.85">Keep your course and your mocks. Takkar is the daily practice you actually come back to.</p>
  </div>
  <div style="position:absolute;left:800px;top:80px;right:100px;display:flex;flex-direction:column;gap:18px">${compareCards(true, 0.98)}</div>
  <p class="foot" style="left:100px;bottom:60px">${LEGAL} · takkar.info</p>
</div>`);

// ---------- Stories / WhatsApp status / vertical displays, 1080 x 1920 ----------
await render('social/story-01-daily-duel.png', 1080, 1920, `
<div class="canvas ink" style="width:1080px;height:1920px">
  <div class="glow gc" style="left:-300px;top:-300px;width:1200px;height:1200px"></div>
  <div class="glow gs" style="right:-400px;top:1000px;width:1200px;height:1200px"></div>
  <div style="position:absolute;left:90px;top:120px;right:90px">
    ${BRAND(48)}
    <h1 class="d" style="margin-top:80px;font-size:170px">Roz ek<br>takkar.</h1>
    <p style="margin-top:40px;font-size:42px;line-height:1.35;opacity:.88">Ten questions. One rival. Four minutes.</p>
  </div>
  ${phone('03-duel', { left: 230, top: 880, width: 620 })}
  <div style="position:absolute;left:0;right:0;bottom:0;height:300px;background:linear-gradient(transparent,#070A1F 70%)"></div>
  <p style="position:absolute;left:0;right:0;bottom:110px;text-align:center;font-size:40px;font-weight:600">takkar.info</p>
  <p style="position:absolute;left:0;right:0;bottom:60px;text-align:center;font-size:24px;opacity:.7">Free · 18+ · No cash prizes or betting</p>
</div>`);

await render('social/story-02-for-educators.png', 1080, 1920, `
<div class="canvas ink" style="width:1080px;height:1920px">
  <div class="glow gc" style="left:-300px;top:-300px;width:1200px;height:1200px"></div>
  <div class="glow gs" style="right:-400px;top:900px;width:1200px;height:1200px"></div>
  <div style="position:absolute;left:90px;top:120px;right:90px">
    ${BRAND(48)}
    <p class="pill tag" style="margin-top:70px;font-size:30px">For educators and channels</p>
    <h1 class="d" style="margin-top:34px;font-size:118px">Your channel’s own league.</h1>
    <p style="margin-top:36px;font-size:40px;line-height:1.35;opacity:.88">One shared daily duel for every student, a weekly table and a Monday report.</p>
  </div>
  ${phone('08-league', { left: 120, top: 980, width: 470, rotate: -4 })}
  ${phone('09-league-report', { left: 500, top: 1080, width: 470, rotate: 4, z: 2 })}
</div>`);

// ---------- Educators ----------
const EDU_POINTS = [
  ['A league with your channel’s name', 'Students join with your invite code. You approve who joins.'],
  ['One daily duel, the same for everyone', 'Ten fresh Quant and Reasoning questions every day, new at midnight.'],
  ['A Monday report', 'Who practised, the average score and the weakest topics of the week.'],
  ['No work for you', 'Questions, timing, exam marking and full solutions are built in.'],
  ['Privacy first', 'You see nicknames and scores only, never emails or phone numbers.'],
];
await render('educators/educator-pitch-1080x1350.png', 1080, 1350, `
<div class="canvas ink" style="width:1080px;height:1350px">
  <div class="glow gc" style="left:-300px;top:-300px;width:1000px;height:1000px"></div>
  <div class="glow gs" style="right:-360px;top:500px;width:1000px;height:1000px"></div>
  <div style="position:absolute;left:70px;top:70px;width:560px">
    ${BRAND(38)}
    <p class="pill tag" style="margin-top:46px;font-size:24px">Free 8-week pilot for educators</p>
    <h1 class="d" style="margin-top:28px;font-size:78px">Run a private league for your students.</h1>
    <div style="margin-top:40px;display:flex;flex-direction:column;gap:22px">
      ${EDU_POINTS.map(([h, p]) => `<div><div style="font-size:30px;font-weight:600">${h}</div><div style="font-size:25px;line-height:1.35;opacity:.8;margin-top:4px">${p}</div></div>`).join('')}
    </div>
  </div>
  ${phone('08-league', { left: 660, top: 170, width: 370, rotate: 3 })}
  <p class="foot" style="left:70px;bottom:50px;font-size:22px">educators@takkar.info · takkar.info · Students must be 18 or older</p>
</div>`);

await render('display/educator-banner-1920x1080.png', 1920, 1080, `
<div class="canvas ink" style="width:1920px;height:1080px">
  <div class="glow gc" style="left:-300px;top:-400px;width:1300px;height:1300px"></div>
  <div class="glow gs" style="right:-300px;bottom:-500px;width:1200px;height:1200px"></div>
  <div style="position:absolute;left:110px;top:100px;width:900px">
    ${BRAND(46)}
    <p class="pill tag" style="margin-top:60px;font-size:30px">Free 8-week pilot for educators</p>
    <h1 class="d" style="margin-top:34px;font-size:108px">Run a private league for your students.</h1>
    <p style="margin-top:36px;font-size:38px;line-height:1.4;opacity:.88">A daily duel for your whole channel, a weekly table and a Monday report. No extra work for you.</p>
    <p style="margin-top:44px;font-size:34px;font-weight:600" class="c-cobalt">educators@takkar.info</p>
  </div>
  ${phone('08-league', { left: 1150, top: 120, width: 380, rotate: -4 })}
  ${phone('09-league-report', { left: 1440, top: 200, width: 380, rotate: 4, z: 2 })}
</div>`);

// One-page PDF for WhatsApp or email outreach (A4 portrait at 96 dpi: 794 x 1123)
await render('educators/educator-one-pager.pdf', 794, 1123, `
<div class="canvas mist" style="width:794px;height:1123px">
  <div class="glow gc" style="left:-200px;top:-220px;width:700px;height:700px"></div>
  <div class="glow gs" style="right:-260px;top:520px;width:700px;height:700px"></div>
  <div style="position:absolute;left:56px;top:52px;right:56px">
    <div style="display:flex;justify-content:space-between;align-items:center">${BRAND(30, false)}<span style="font-size:15px;opacity:.7">takkar.info</span></div>
    <p class="pill" style="margin-top:34px;font-size:15px;background:rgba(255,106,0,.12);color:#B84700">Free 8-week pilot</p>
    <h1 class="d" style="margin-top:18px;font-size:50px;max-width:470px">Run a private league for your students.</h1>
    <p style="margin-top:16px;font-size:17px;line-height:1.45;max-width:440px">Takkar is a daily quiz duel for SSC, banking and railway aspirants. Your channel gets its own league, and your students get a reason to practise every day.</p>
    <div style="margin-top:28px;display:flex;flex-direction:column;gap:14px;max-width:430px">
      ${EDU_POINTS.map(([h, p]) => `<div style="padding-left:18px;border-left:4px solid #2A3BE8"><div style="font-size:17px;font-weight:600">${h}</div><div style="font-size:15px;line-height:1.4;opacity:.8">${p}</div></div>`).join('')}
    </div>
    <div style="margin-top:28px;max-width:430px;padding:18px 20px;border-radius:18px;background:#fff">
      <div style="font-size:17px;font-weight:600">The pilot</div>
      <div style="font-size:15px;line-height:1.45;margin-top:6px">Free for 8 weeks. We ask you to post the league code once a day in the first week and give us 15 minutes of feedback in week 2. Either side can stop at any time.</div>
    </div>
  </div>
  ${phone('08-league', { left: 540, top: 180, width: 205, rotate: 3 })}
  ${phone('09-league-report', { left: 520, top: 560, width: 205, rotate: -3, z: 2 })}
  <div style="position:absolute;left:56px;bottom:46px;right:56px;font-size:13px;line-height:1.5;opacity:.7">Write to educators@takkar.info. Takkar is for aspirants aged 18 and over, has no cash prizes or betting, makes no promise of results and is not affiliated with any exam-conducting body. Screens are from the current prototype; names shown are samples.</div>
</div>`, { pdf: true });
await render('educators/educator-one-pager-preview.png', 794, 1123, await page.evaluate(() => document.body.innerHTML));

// ---------- Display banners, 1920 x 1080 ----------
await render('display/hero-1920x1080.png', 1920, 1080, `
<div class="canvas ink" style="width:1920px;height:1080px">
  <div class="glow gc" style="left:-300px;top:-400px;width:1400px;height:1400px"></div>
  <div class="glow gs" style="right:-300px;top:200px;width:1300px;height:1300px"></div>
  <div style="position:absolute;left:120px;top:110px;width:860px">
    ${BRAND(50)}
    <p class="pill" style="margin-top:60px;font-size:28px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18)">For SSC, banking and railway aspirants, 18 and over</p>
    <h1 class="d" style="margin-top:36px;font-size:210px">Roz ek<br>takkar.</h1>
    <p style="margin-top:40px;font-size:42px;line-height:1.35;opacity:.88">Ten questions. One rival. Four minutes a day.</p>
    <p style="margin-top:36px;font-size:40px;font-weight:600" class="c-cobalt">takkar.info</p>
  </div>
  ${phone('03-duel', { left: 1130, top: 90, width: 420, rotate: -5 })}
  ${phone('04-answer-reveal', { left: 1420, top: 190, width: 400, rotate: 5, z: 0 })}
  <p class="foot" style="left:120px;bottom:50px">Free to play · No cash prizes or betting · Not affiliated with any exam body</p>
</div>`);

await render('display/how-it-works-1920x1080.png', 1920, 1080, `
<div class="canvas mist" style="width:1920px;height:1080px">
  <div class="glow gc" style="left:-300px;top:-400px;width:1300px;height:1300px"></div>
  <div class="glow gs" style="right:-300px;bottom:-500px;width:1300px;height:1300px"></div>
  <div style="position:absolute;left:110px;top:90px;right:110px;display:flex;justify-content:space-between;align-items:center">${BRAND(46, false)}<span style="font-size:32px;font-weight:600">takkar.info</span></div>
  <h1 class="d" style="position:absolute;left:110px;top:200px;font-size:100px">One takkar takes about four minutes.</h1>
  <div style="position:absolute;left:110px;right:110px;top:400px;display:flex;gap:40px">
    ${[['1', 'Pick a topic', 'Quant, Reasoning or a mix. Every set is made fresh and every answer is calculated.', '02-home'], ['2', 'Beat the clock', 'Exam marking: +4 right, −1 wrong, 0 skipped. Steps after every answer.', '04-answer-reveal'], ['3', 'Send the code', 'Your friend plays the same ten questions and tries to beat you.', '07-challenge-received']].map(([n, h, p, img]) => `
      <div style="flex:1;position:relative;height:600px;border-radius:44px;background:#fff;overflow:hidden;box-shadow:0 30px 60px rgba(13,17,48,.1)">
        <div style="padding:40px 44px 0;position:relative;z-index:2">
          <div class="d c-cobalt" style="font-size:90px">${n}</div>
          <div class="d" style="font-size:52px;margin-top:6px">${h}</div>
          <p style="font-size:27px;line-height:1.35;margin-top:12px;opacity:.85;max-width:470px">${p}</p>
        </div>
        <div class="phone" style="left:250px;top:330px;width:230px;transform:rotate(-6deg)"><img src="${SS(img)}"></div>
      </div>`).join('')}
  </div>
</div>`);

// ---------- Brand files ----------
await render('brand/logo-mark-1024.png', 1024, 1024, `<div style="width:1024px;height:1024px;display:flex;align-items:center;justify-content:center"><div style="width:880px">${MARK(false).replace('<svg', '<svg style="width:100%;height:auto;display:block"')}</div></div>`, { transparent: true });
await render('brand/logo-horizontal-on-light.png', 1600, 500, `<div style="width:1600px;height:500px;display:flex;align-items:center;justify-content:center;color:#0D1130">${BRAND(240, false)}</div>`, { transparent: true });
await render('brand/logo-horizontal-on-dark.png', 1600, 500, `<div style="width:1600px;height:500px;display:flex;align-items:center;justify-content:center;color:#fff">${BRAND(240, true)}</div>`, { transparent: true });
await render('brand/profile-picture-1080.png', 1080, 1080, `
<div class="canvas" style="width:1080px;height:1080px;background:#0A0D28;display:flex;align-items:center;justify-content:center">
  <div class="glow gc" style="left:-200px;top:-200px;width:900px;height:900px"></div>
  <div style="position:relative;width:640px">${MARK(true).replace('<svg', '<svg style="width:100%;height:auto;display:block"')}</div>
</div>`);
await render('brand/channel-banner-2560x1440.png', 2560, 1440, `
<div class="canvas ink" style="width:2560px;height:1440px">
  <div class="glow gc" style="left:-400px;top:-500px;width:1800px;height:1800px"></div>
  <div class="glow gs" style="right:-400px;top:300px;width:1700px;height:1700px"></div>
  <div style="position:absolute;left:0;right:0;top:500px;text-align:center">
    <div style="display:inline-block">${BRAND(150)}</div>
    <p class="d" style="margin-top:40px;font-size:96px">Roz ek takkar.</p>
    <p style="margin-top:24px;font-size:44px;opacity:.85">A daily quiz duel for SSC, banking and railway aspirants · takkar.info</p>
  </div>
</div>`);

await browser.close();
