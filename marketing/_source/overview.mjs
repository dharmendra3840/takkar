// Rebuilds marketing/OVERVIEW.png: every design on one sheet, in rows of equal height.
import puppeteer from 'puppeteer-core';
const ROOT = 'C:/Users/Asus/Desktop/Projects/Takkar/marketing';
const rows = [
  { h: 360, files: ['store/01-roz-ek-takkar.png', 'store/02-steps-for-every-answer.png', 'store/03-exam-marking.png', 'store/04-challenge-friends.png', 'store/05-educator-leagues.png', 'store/06-squads.png', 'store/07-ranks.png', 'store/08-your-progress.png'] },
  { h: 360, files: ['store/feature-graphic-1024x500.png', 'social/post-01-roz-ek-takkar.png', 'social/post-02-exam-marking.png', 'social/post-03-no-betting.png', 'social/post-04-challenge.png'] },
  { h: 360, files: ['social/post-05-steps.png', 'social/story-01-daily-duel.png', 'social/story-02-for-educators.png', 'social/why-takkar-is-different-1080x1350.png', 'educators/educator-pitch-1080x1350.png', 'educators/educator-one-pager-preview.png', 'display/educator-banner-1920x1080.png'] },
  { h: 360, files: ['display/hero-1920x1080.png', 'display/how-it-works-1920x1080.png', 'display/why-takkar-is-different-1920x1080.png'] },
];
const html = `<html><body style="margin:0;background:#ECEFF8;padding:16px;font-size:0;width:max-content">${rows.map((r) => `<div style="display:flex;width:max-content;gap:16px;margin-bottom:16px">${r.files.map((f) => `<img src="file:///${ROOT}/${f}" style="height:${r.h}px;border-radius:6px">`).join('')}</div>`).join('')}</body></html>`;
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--allow-file-access-from-files'] });
const p = await b.newPage();
await p.setViewport({ width: 3000, height: 1600, deviceScaleFactor: 1 });
await p.goto(`file:///${ROOT}/`);
await p.setContent(html, { waitUntil: 'load' });
const size = await p.evaluate(() => { const rs = [...document.querySelectorAll('body > div')].map((d) => d.getBoundingClientRect()); return { w: Math.ceil(Math.max(...rs.map((r) => r.right)) + 16), h: Math.ceil(Math.max(...rs.map((r) => r.bottom))) }; });
await p.screenshot({ path: `${ROOT}/OVERVIEW.png`, clip: { x: 0, y: 0, width: size.w, height: size.h } });
console.log('OVERVIEW', size);
await b.close();
