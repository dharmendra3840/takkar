// Offline cache for the web app (/play/). Not used inside the Android app.
// website/scripts/sync-play.mjs stamps a build id into CACHE and every file's URL (?v=…), and
// lists the whole app in PRECACHE, so one visit is enough to play offline and an old copy can
// never mix files with a new one. Network first, so players get the newest version when online;
// the saved copy is used with no signal or a very slow network. The Takkar server (another
// origin) is never cached.
const CACHE = 'takkar-play-a9e7f3de4a';
const PRECACHE = ["./","css/app.css?v=a9e7f3de4a","fonts/bricolage-grotesque-latin-opsz-normal.woff2","fonts/hind-devanagari-400-normal.woff2","fonts/hind-devanagari-600-normal.woff2","fonts/hind-latin-400-normal.woff2","fonts/hind-latin-500-normal.woff2","fonts/hind-latin-600-normal.woff2","icons/apple-touch-icon.png","icons/favicon-32.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","js/api.js?v=a9e7f3de4a","js/auth.js?v=a9e7f3de4a","js/code.js?v=a9e7f3de4a","js/config.js?v=a9e7f3de4a","js/demo.js?v=a9e7f3de4a","js/educator-rules.js?v=a9e7f3de4a","js/engine/bank.js?v=a9e7f3de4a","js/engine/build.js?v=a9e7f3de4a","js/engine/index.js?v=a9e7f3de4a","js/engine/quant-more.js?v=a9e7f3de4a","js/engine/quant.js?v=a9e7f3de4a","js/engine/reasoning-more.js?v=a9e7f3de4a","js/engine/reasoning.js?v=a9e7f3de4a","js/engine/rng.js?v=a9e7f3de4a","js/exams.js?v=a9e7f3de4a","js/game.js?v=a9e7f3de4a","js/intro.js?v=a9e7f3de4a","js/lang.js?v=a9e7f3de4a","js/league-rules.js?v=a9e7f3de4a","js/livetest-insights.js?v=a9e7f3de4a","js/livetest-rules.js?v=a9e7f3de4a","js/main.js?v=a9e7f3de4a","js/mock.js?v=a9e7f3de4a","js/qview.js?v=a9e7f3de4a","js/reminders.js?v=a9e7f3de4a","js/screens/account.js?v=a9e7f3de4a","js/screens/challenge.js?v=a9e7f3de4a","js/screens/duel.js?v=a9e7f3de4a","js/screens/educator.js?v=a9e7f3de4a","js/screens/exam.js?v=a9e7f3de4a","js/screens/home.js?v=a9e7f3de4a","js/screens/league.js?v=a9e7f3de4a","js/screens/live.js?v=a9e7f3de4a","js/screens/livetest.js?v=a9e7f3de4a","js/screens/practice.js?v=a9e7f3de4a","js/screens/result.js?v=a9e7f3de4a","js/screens/signin.js?v=a9e7f3de4a","js/screens/social.js?v=a9e7f3de4a","js/screens/squads.js?v=a9e7f3de4a","js/screens/welcome.js?v=a9e7f3de4a","js/squad-rules.js?v=a9e7f3de4a","js/store.js?v=a9e7f3de4a","js/swipe.js?v=a9e7f3de4a","js/sync.js?v=a9e7f3de4a","js/systembars.js?v=a9e7f3de4a","js/time.js?v=a9e7f3de4a","js/topics.js?v=a9e7f3de4a","js/ui.js?v=a9e7f3de4a","js/updater.js?v=a9e7f3de4a","js/validate.js?v=a9e7f3de4a","manifest.webmanifest"];
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
