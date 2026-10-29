// App version and where the Takkar server lives.
export const APP_VERSION = '0.5.1';
export const APP_BUILD = 8; // Android versionCode; the admin's "app builds" settings compare against this
export const TERMS_VERSION = '2026-10-beta';

const LIVE_API = 'https://takkar-admin.takkar-server.workers.dev/api';

/**
 * In a desktop browser during development (npm run serve), the app can point at a local
 * server with localStorage "takkar.api" = "http://127.0.0.1:8788/api". The Android app
 * always uses the live server.
 */
export function apiBase() {
  // Only on a plain-http development server; the Android app runs at https://localhost.
  if (location.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    try {
      const local = localStorage.getItem('takkar.api');
      if (local && /^http:\/\/(localhost|127\.0\.0\.1):\d+\/api$/.test(local)) return local;
    } catch { /* storage blocked */ }
  }
  return LIVE_API;
}

/** True inside the Android app; false in a web browser. */
export const IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

/** Where guest data lives, in words: "this phone" in the app, "this browser" on the web. */
export const HERE = IS_NATIVE ? 'this phone' : 'this browser';

/** The website. Until 28 October 2026 it lived at takkar.vercel.app, which still works. */
export const SITE_URL = 'https://www.playtakkar.in';
export const OLD_WEB_HOST = 'takkar.vercel.app';

/** The web app, for links that open a challenge straight away. */
export const WEB_APP_URL = `${SITE_URL}/play/`;

// The newest Android APK; the in-app updater downloads it (the server can point elsewhere).
export const APK_URL = 'https://github.com/dharmendra3840/takkar-app/releases/latest/download/Takkar-beta.apk';

/** News and updates. */
export const INSTAGRAM_URL = 'https://www.instagram.com/playtakkar/';
export const FACEBOOK_URL = 'https://www.facebook.com/people/Takkar/61595485296457/';
export const TELEGRAM_URL = 'https://t.me/playtakkar';
