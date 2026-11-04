// Offline cache for the web app (/play/). Not used inside the Android app.
// website/scripts/sync-play.mjs stamps a build id into CACHE and every file's URL (?v=…), and
// lists the whole app in PRECACHE, so one visit is enough to play offline and an old copy can
// never mix files with a new one. Network first, so players get the newest version when online;
// the saved copy is used with no signal or a very slow network. The Takkar server (another
// origin) is never cached.
const CACHE = 'takkar-play-d6f6ee5ef0';
const PRECACHE = ["./","css/app.css?v=d6f6ee5ef0","fonts/bricolage-grotesque-latin-opsz-normal.woff2","fonts/hind-devanagari-400-normal.woff2","fonts/hind-devanagari-600-normal.woff2","fonts/hind-latin-400-normal.woff2","fonts/hind-latin-500-normal.woff2","fonts/hind-latin-600-normal.woff2","icons/apple-touch-icon.png","icons/favicon-32.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","js/api.js?v=d6f6ee5ef0","js/auth.js?v=d6f6ee5ef0","js/code.js?v=d6f6ee5ef0","js/config.js?v=d6f6ee5ef0","js/demo.js?v=d6f6ee5ef0","js/educator-rules.js?v=d6f6ee5ef0","js/engine/build.js?v=d6f6ee5ef0","js/engine/index.js?v=d6f6ee5ef0","js/engine/quant-more.js?v=d6f6ee5ef0","js/engine/quant.js?v=d6f6ee5ef0","js/engine/reasoning-more.js?v=d6f6ee5ef0","js/engine/reasoning.js?v=d6f6ee5ef0","js/engine/rng.js?v=d6f6ee5ef0","js/exams.js?v=d6f6ee5ef0","js/game.js?v=d6f6ee5ef0","js/intro.js?v=d6f6ee5ef0","js/lang.js?v=d6f6ee5ef0","js/league-rules.js?v=d6f6ee5ef0","js/main.js?v=d6f6ee5ef0","js/mock.js?v=d6f6ee5ef0","js/screens/account.js?v=d6f6ee5ef0","js/screens/challenge.js?v=d6f6ee5ef0","js/screens/duel.js?v=d6f6ee5ef0","js/screens/educator.js?v=d6f6ee5ef0","js/screens/exam.js?v=d6f6ee5ef0","js/screens/home.js?v=d6f6ee5ef0","js/screens/league.js?v=d6f6ee5ef0","js/screens/live.js?v=d6f6ee5ef0","js/screens/practice.js?v=d6f6ee5ef0","js/screens/result.js?v=d6f6ee5ef0","js/screens/signin.js?v=d6f6ee5ef0","js/screens/social.js?v=d6f6ee5ef0","js/screens/squads.js?v=d6f6ee5ef0","js/screens/welcome.js?v=d6f6ee5ef0","js/squad-rules.js?v=d6f6ee5ef0","js/store.js?v=d6f6ee5ef0","js/swipe.js?v=d6f6ee5ef0","js/sync.js?v=d6f6ee5ef0","js/systembars.js?v=d6f6ee5ef0","js/time.js?v=d6f6ee5ef0","js/topics.js?v=d6f6ee5ef0","js/ui.js?v=d6f6ee5ef0","js/updater.js?v=d6f6ee5ef0","js/validate.js?v=d6f6ee5ef0","manifest.webmanifest"];
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
