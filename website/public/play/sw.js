// Offline cache for the web app (/play/). Not used inside the Android app.
// website/scripts/sync-play.mjs stamps a build id into CACHE and every file's URL (?v=…), and
// lists the whole app in PRECACHE, so one visit is enough to play offline and an old copy can
// never mix files with a new one. Network first, so players get the newest version when online;
// the saved copy is used with no signal or a very slow network. The Takkar server (another
// origin) is never cached.
const CACHE = 'takkar-play-5a018ff99f';
const PRECACHE = ["./","css/app.css?v=5a018ff99f","fonts/bricolage-grotesque-latin-opsz-normal.woff2","fonts/hind-devanagari-600-normal.woff2","fonts/hind-latin-400-normal.woff2","fonts/hind-latin-500-normal.woff2","fonts/hind-latin-600-normal.woff2","icons/apple-touch-icon.png","icons/favicon-32.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","js/api.js?v=5a018ff99f","js/auth.js?v=5a018ff99f","js/code.js?v=5a018ff99f","js/config.js?v=5a018ff99f","js/demo.js?v=5a018ff99f","js/engine/build.js?v=5a018ff99f","js/engine/index.js?v=5a018ff99f","js/engine/quant.js?v=5a018ff99f","js/engine/reasoning.js?v=5a018ff99f","js/engine/rng.js?v=5a018ff99f","js/exams.js?v=5a018ff99f","js/game.js?v=5a018ff99f","js/intro.js?v=5a018ff99f","js/main.js?v=5a018ff99f","js/mock.js?v=5a018ff99f","js/screens/account.js?v=5a018ff99f","js/screens/challenge.js?v=5a018ff99f","js/screens/duel.js?v=5a018ff99f","js/screens/exam.js?v=5a018ff99f","js/screens/home.js?v=5a018ff99f","js/screens/league.js?v=5a018ff99f","js/screens/practice.js?v=5a018ff99f","js/screens/result.js?v=5a018ff99f","js/screens/signin.js?v=5a018ff99f","js/screens/social.js?v=5a018ff99f","js/screens/welcome.js?v=5a018ff99f","js/store.js?v=5a018ff99f","js/swipe.js?v=5a018ff99f","js/sync.js?v=5a018ff99f","js/time.js?v=5a018ff99f","js/ui.js?v=5a018ff99f","js/validate.js?v=5a018ff99f","manifest.webmanifest"];
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
