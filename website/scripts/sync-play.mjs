// Copies the app (../app/www) into public/play, so the website serves the web app at /play/.
// The copy gets a <base href="/play/"> and the web security policy (Firebase sign-in in the
// browser). Run after every app change:
//   node scripts/sync-play.mjs          copy
//   node scripts/sync-play.mjs --check  fail if public/play is out of date (run before a push)
import { readFileSync, writeFileSync, rmSync, cpSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, '..', 'app', 'www');
const OUT = join(ROOT, 'public', 'play');

// Keep in step with the /play/ headers in vercel.json.
export const WEB_CSP = [
  "default-src 'self'",
  "script-src 'self' https://www.gstatic.com https://apis.google.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: https://www.gstatic.com",
  "connect-src 'self' https://takkar-admin.takkar-server.workers.dev https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://apis.google.com",
  "frame-src https://*.firebaseapp.com https://www.google.com https://recaptcha.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function webIndex(html) {
  const out = html
    .replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/, `<meta http-equiv="Content-Security-Policy" content="${WEB_CSP}">`)
    .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="/play/">\n<!-- Generated from app/www by website/scripts/sync-play.mjs. Edit the app, not this copy. -->');
  if (!out.includes('<base href="/play/">') || !out.includes('identitytoolkit')) throw new Error('index.html did not take the web changes');
  return out;
}

const files = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  return statSync(p).isDirectory() ? files(p) : [p];
});

if (process.argv.includes('--check')) {
  const stale = [];
  for (const f of files(SRC)) {
    const rel = relative(SRC, f);
    const copy = join(OUT, rel);
    const want = rel === 'index.html' ? Buffer.from(webIndex(readFileSync(f, 'utf8'))) : readFileSync(f);
    if (!existsSync(copy) || !readFileSync(copy).equals(want)) stale.push(rel);
  }
  const extra = existsSync(OUT) ? files(OUT).map((f) => relative(OUT, f)).filter((rel) => !existsSync(join(SRC, rel))) : [];
  if (stale.length || extra.length) {
    console.error(`public/play is out of date (${[...stale, ...extra].slice(0, 5).join(', ')}). Run: node scripts/sync-play.mjs`);
    process.exit(1);
  }
  console.log('public/play matches the app.');
} else {
  rmSync(OUT, { recursive: true, force: true });
  cpSync(SRC, OUT, { recursive: true });
  writeFileSync(join(OUT, 'index.html'), webIndex(readFileSync(join(SRC, 'index.html'), 'utf8')));
  console.log(`Copied the app to public/play (${files(OUT).length} files).`);
}
