// Copies the app (../app/www) into public/play, so the website serves the web app at /play/.
// The copy gets a <base href="/play/">, the web security policy (Firebase sign-in in the
// browser) and a build id on every script and stylesheet URL. Run after every app change:
//   node scripts/sync-play.mjs          copy
//   node scripts/sync-play.mjs --check  fail if public/play is out of date (run before a push)
import { readFileSync, writeFileSync, rmSync, cpSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

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

const files = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  return statSync(p).isDirectory() ? files(p) : [p];
});
const posix = (rel) => rel.split(sep).join('/');

// One id per version of the app: a hash of every file. It goes into the service worker's cache
// name and into the URL of every script and stylesheet, so a browser holding an older copy never
// runs old and new modules together (a slow network used to be able to cause that).
const SOURCES = files(SRC).map((f) => posix(relative(SRC, f))).sort();
const hash = createHash('sha256');
for (const rel of SOURCES) hash.update(rel).update(readFileSync(join(SRC, rel)));
const BUILD = hash.digest('hex').slice(0, 10);
const versioned = (path) => (/\.(js|css)$/.test(path) ? `${path}?v=${BUILD}` : path);

function webIndex(html) {
  const out = html
    .replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/, `<meta http-equiv="Content-Security-Policy" content="${WEB_CSP}">`)
    .replace('<meta charset="utf-8">', [
      '<meta charset="utf-8">',
      '<base href="/play/">',
      '<!-- Generated from app/www by website/scripts/sync-play.mjs. Edit the app, not this copy. -->',
    ].join('\n'))
    .replace('href="css/app.css"', `href="${versioned('css/app.css')}"`)
    .replace('src="js/main.js"', `src="${versioned('js/main.js')}"`);
  if (!out.includes('<base href="/play/">') || !out.includes('identitytoolkit') || !out.includes(`main.js?v=${BUILD}`)) {
    throw new Error('index.html did not take the web changes');
  }
  return out;
}

/** Relative imports get the build id: import … from './x.js' becomes './x.js?v=BUILD'. */
const IMPORT = /(\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.{1,2}\/[^'"]+?\.js)\2/g;
const webModule = (code) => code.replace(IMPORT, (m, lead, q, path) => `${lead}${q}${path}?v=${BUILD}${q}`);

function webSw(code) {
  const precache = ['./', ...SOURCES.filter((rel) => rel !== 'sw.js' && rel !== 'index.html').map(versioned)];
  const out = code
    .replace("const CACHE = 'takkar-play-dev';", `const CACHE = 'takkar-play-${BUILD}';`)
    .replace("const PRECACHE = ['./'];", `const PRECACHE = ${JSON.stringify(precache)};`);
  if (!out.includes(`takkar-play-${BUILD}`) || !out.includes('fonts/')) throw new Error('sw.js did not take the build id');
  return out;
}

/** What the web copy of each app file looks like. */
function webFile(rel, buf) {
  if (rel === 'index.html') return Buffer.from(webIndex(buf.toString('utf8')));
  if (rel === 'sw.js') return Buffer.from(webSw(buf.toString('utf8')));
  if (rel.startsWith('js/') && rel.endsWith('.js')) return Buffer.from(webModule(buf.toString('utf8')));
  return buf;
}

if (process.argv.includes('--check')) {
  const stale = [];
  for (const rel of SOURCES) {
    const copy = join(OUT, rel);
    if (!existsSync(copy) || !readFileSync(copy).equals(webFile(rel, readFileSync(join(SRC, rel))))) stale.push(rel);
  }
  const extra = existsSync(OUT) ? files(OUT).map((f) => posix(relative(OUT, f))).filter((rel) => !SOURCES.includes(rel)) : [];
  if (stale.length || extra.length) {
    console.error(`public/play is out of date (${[...stale, ...extra].slice(0, 5).join(', ')}). Run: node scripts/sync-play.mjs`);
    process.exit(1);
  }
  console.log(`public/play matches the app (build ${BUILD}).`);
} else {
  rmSync(OUT, { recursive: true, force: true });
  cpSync(SRC, OUT, { recursive: true });
  for (const rel of SOURCES) {
    const src = readFileSync(join(SRC, rel));
    const out = webFile(rel, src);
    if (!out.equals(src)) writeFileSync(join(OUT, rel), out);
  }
  console.log(`Copied the app to public/play (${files(OUT).length} files, build ${BUILD}).`);
}
