// Small UI helpers and the bridge to Android (via Capacitor, when present).
import { INSTAGRAM_URL, FACEBOOK_URL } from './config.js?v=0f36455e6e';

/** SEC-14: player text is always escaped; it is never inserted as HTML. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Scores use a real minus sign: −1, not -1. */
/** Scores use a real minus sign and at most two decimals: −1, 5.25, 4.67. */
export const num = (n) => {
  const r = Math.round(n * 100) / 100;
  const text = String(Math.abs(r));
  return r < 0 ? `−${text}` : text;
};

export const initial = (name) => esc((name || '?').trim().charAt(0).toUpperCase());

const ICONS = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
  league: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
  squad: '<circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.8"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M15.5 14.4c3.4-.4 6 1.6 6 5.1"/>',
  ranks: '<path d="M5 20V11M12 20V4M19 20v-6"/>',
  you: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  close: '<path d="M5 5l14 14M19 5L5 19"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cross: '<path d="M6 6l12 12M18 6L6 18"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  code: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  practice: '<path d="M3 5.5C5.5 4 8.5 4 12 6c3.5-2 6.5-2 9-.5V19c-2.5-1.5-5.5-1.5-9 .5-3.5-2-6.5-2-9-.5zM12 6v13.5"/>',
  facebook: '<path fill="currentColor" stroke="none" d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/>',
};

export function icon(name, extra = '') {
  return `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

export const LOGO = (dark = false) => `<svg width="40" height="32" viewBox="0 0 40 32" aria-hidden="true"><circle cx="14" cy="16" r="11" fill="${dark ? '#4B5DFF' : '#2A3BE8'}"/><circle cx="26" cy="16" r="11" fill="#FF6A00"/><path d="M20 6.78 A11 11 0 0 0 20 25.22 A11 11 0 0 0 20 6.78 Z" fill="${dark ? '#FFFFFF' : '#0D1130'}"/></svg>`;

export const blobs = (kind = 'lobby') => kind === 'arena'
  ? '<div class="blob blob--cobalt blob--a"></div><div class="blob blob--saffron blob--b"></div>'
  : '<div class="blob blob--cobalt blob--a"></div><div class="blob blob--saffron blob--b"></div><div class="blob blob--cobalt blob--c"></div>';

export function tabbar(current) {
  const tabs = [['home', 'Home'], ['practice', 'Practice'], ['league', 'League'], ['squad', 'Squad'], ['profile', 'You']];
  return `<nav class="tabbar" aria-label="Main"><div class="tabbar__brand" aria-hidden="true">${LOGO()}<span>takkar</span></div>${tabs.map(([id, label]) => `
    <button type="button" data-action="go" data-to="${id}" ${current === id || (current === 'ranks' && id === 'league') ? 'aria-current="page"' : ''}>${icon(id === 'profile' ? 'you' : id)}${label}</button>`).join('')}
    <div class="tabbar__follow"><span>Follow for updates</span>
      <button class="social social--ig" type="button" data-action="open-url" data-url="${INSTAGRAM_URL}"><span class="social__icon">${icon('instagram')}</span>Instagram</button>
      <button class="social social--fb" type="button" data-action="open-url" data-url="${FACEBOOK_URL}"><span class="social__icon">${icon('facebook')}</span>Facebook</button>
    </div>
  </nav>`;
}

// ---------- Toast ----------

// One live region that stays on the page: screen readers announce what is put in it
// (a region added together with its text is often not read out).
let live = null;
export function announce(message) {
  if (!message) return;
  if (!live) {
    live = document.createElement('div');
    live.className = 'sr-only';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    document.body.appendChild(live);
  }
  live.textContent = '';
  setTimeout(() => { live.textContent = message; }, 50);
}

let toastTimer = null;
export function toast(message) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  // Above the tab bar when there is one; otherwise at the top, clear of the main button.
  el.className = document.querySelector('.tabbar') ? 'toast' : 'toast toast--top';
  el.setAttribute('aria-hidden', 'true'); // read out through the live region instead
  announce(message);
  el.textContent = message;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2600);
}

// ---------- Native bridge ----------

const plugins = () => (window.Capacitor && window.Capacitor.Plugins) || {};
export const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

/** CHAL-04: the phone's share sheet (WhatsApp, Telegram, ...). Never reads contacts. */
export async function shareText({ title, text, url }) {
  try {
    if (plugins().Share) {
      await plugins().Share.share({ title, text, url, dialogTitle: title });
      return true;
    }
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return true;
    }
  } catch (e) {
    if (String(e && e.message).toLowerCase().includes('cancel')) return false;
  }
  await copyText([text, url].filter(Boolean).join(' '));
  return true;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  toast('Copied');
}

/** Saves text as a file (used on computers, where there is no share sheet). */
export function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Saved to your downloads');
}

export function openExternal(url) {
  if (plugins().Browser) plugins().Browser.open({ url });
  else window.open(url, '_blank', 'noopener');
}

export function onBackButton(handler) {
  if (plugins().App) plugins().App.addListener('backButton', handler);
}

export function exitApp() {
  if (plugins().App) plugins().App.exitApp();
}

export function vibrate(ms = 20) {
  try {
    if (plugins().Haptics) plugins().Haptics.impact({ style: 'LIGHT' });
    else if (navigator.vibrate) navigator.vibrate(ms);
  } catch { /* optional */ }
}

/** League and Ranks share the League tab; this switch sits at the top of both. */
export function leagueSwitch(current) {
  return `<div class="segmented segmented--light mb-12" role="tablist" aria-label="League or ranks">
    <button type="button" role="tab" data-action="go" data-to="league" aria-pressed="${current === 'league'}">League</button>
    <button type="button" role="tab" data-action="go" data-to="ranks" aria-pressed="${current === 'ranks'}">Ranks</button>
  </div>`;
}
