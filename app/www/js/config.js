// App version and where the Takkar server lives.
export const APP_VERSION = '0.2.0';
export const APP_BUILD = 2; // Android versionCode; the admin's "app builds" settings compare against this
export const TERMS_VERSION = '2026-10-beta';

const LIVE_API = 'https://takkar-admin.takkar-server.workers.dev/api';

/**
 * In a desktop browser during development (npm run serve), the app can point at a local
 * server with localStorage "takkar.api" = "http://127.0.0.1:8788/api". The Android app
 * always uses the live server.
 */
export function apiBase() {
  const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (!native && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    try {
      const local = localStorage.getItem('takkar.api');
      if (local && /^http:\/\/(localhost|127\.0\.0\.1):\d+\/api$/.test(local)) return local;
    } catch { /* storage blocked */ }
  }
  return LIVE_API;
}
