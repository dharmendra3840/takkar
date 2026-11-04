// Offline cache for the web app (/play/). Not used inside the Android app.
// website/scripts/sync-play.mjs stamps a build id into CACHE and every file's URL (?v=…), and
// lists the whole app in PRECACHE, so one visit is enough to play offline and an old copy can
// never mix files with a new one. Network first, so players get the newest version when online;
// the saved copy is used with no signal or a very slow network. The Takkar server (another
// origin) is never cached.
const CACHE = 'takkar-play-55de1a644f';
const PRECACHE = ["./","css/app.css?v=55de1a644f","fonts/bricolage-grotesque-latin-opsz-normal.woff2","fonts/hind-devanagari-400-normal.woff2","fonts/hind-devanagari-600-normal.woff2","fonts/hind-latin-400-normal.woff2","fonts/hind-latin-500-normal.woff2","fonts/hind-latin-600-normal.woff2","icons/apple-touch-icon.png","icons/favicon-32.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","js/api.js?v=55de1a644f","js/auth.js?v=55de1a644f","js/code.js?v=55de1a644f","js/config.js?v=55de1a644f","js/demo.js?v=55de1a644f","js/educator-rules.js?v=55de1a644f","js/engine/build.js?v=55de1a644f","js/engine/index.js?v=55de1a644f","js/engine/quant-more.js?v=55de1a644f","js/engine/quant.js?v=55de1a644f","js/engine/reasoning-more.js?v=55de1a644f","js/engine/reasoning.js?v=55de1a644f","js/engine/rng.js?v=55de1a644f","js/exams.js?v=55de1a644f","js/game.js?v=55de1a644f","js/intro.js?v=55de1a644f","js/lang.js?v=55de1a644f","js/league-rules.js?v=55de1a644f","js/livetest-rules.js?v=55de1a644f","js/main.js?v=55de1a644f","js/mock.js?v=55de1a644f","js/screens/account.js?v=55de1a644f","js/screens/challenge.js?v=55de1a644f","js/screens/duel.js?v=55de1a644f","js/screens/educator.js?v=55de1a644f","js/screens/exam.js?v=55de1a644f","js/screens/home.js?v=55de1a644f","js/screens/league.js?v=55de1a644f","js/screens/live.js?v=55de1a644f","js/screens/livetest.js?v=55de1a644f","js/screens/practice.js?v=55de1a644f","js/screens/result.js?v=55de1a644f","js/screens/signin.js?v=55de1a644f","js/screens/social.js?v=55de1a644f","js/screens/squads.js?v=55de1a644f","js/screens/welcome.js?v=55de1a644f","js/squad-rules.js?v=55de1a644f","js/store.js?v=55de1a644f","js/swipe.js?v=55de1a644f","js/sync.js?v=55de1a644f","js/systembars.js?v=55de1a644f","js/time.js?v=55de1a644f","js/topics.js?v=55de1a644f","js/ui.js?v=55de1a644f","js/updater.js?v=55de1a644f","js/validate.js?v=55de1a644f","manifest.webmanifest"];
const SLOW_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('takkar-play-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = req.mode === 'navigate' ? './' : req;
    const network = fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') cache.put(key, res.clone());
      return res;
    });
    const cached = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
    if (!cached) return network;
    // Prefer the network, but do not keep a player waiting on a bad connection.
    const slow = new Promise((resolve) => setTimeout(() => resolve(cached), SLOW_MS));
    return Promise.race([network.catch(() => cached), slow]);
  })());
});
