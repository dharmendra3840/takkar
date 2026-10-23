// App version and where the Takkar server lives.
export const APP_VERSION = '0.3.1';
export const APP_BUILD = 4; // Android versionCode; the admin's "app builds" settings compare against this
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

/** The web app, for links that open a challenge straight away. */
export const WEB_APP_URL = 'https://takkar.vercel.app/play/';

/** News and updates. */
export const INSTAGRAM_URL = 'https://www.instagram.com/takkar.infoo/';
export const FACEBOOK_URL = 'https://www.facebook.com/people/Takkar/61595485296457/';
