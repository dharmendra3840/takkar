// Google and phone sign-in through Firebase. Two ways in, the same result:
// - Android app: the @capacitor-firebase/authentication plugin (native Google and SMS)
// - Web app: Firebase's browser SDK, loaded from Google only when someone taps sign-in
// Firebase only proves who the player is; the app swaps its ID token for a Takkar session
// at POST /api/auth/firebase and then signs out of Firebase again.
import { IS_NATIVE } from './config.js?v=91402d5159';

const plugin = () => window.Capacitor?.Plugins?.FirebaseAuthentication;
const SDK = 'https://www.gstatic.com/firebasejs/12.19.0'; // pinned (SEC-23); allowed by the web CSP

/** Sign-in needs the plugin (Android) or the web settings from the server (web). */
export function signInAvailable(config) {
  if (!config?.auth?.firebase) return false;
  return IS_NATIVE || plugin() ? !!plugin() : !!config.auth.web;
}
const useNative = () => !!plugin();

const cancelled = (e) => /cancel|closed|aborted|12501|popup-closed-by-user|cancelled-popup-request/i.test(String(e && (e.code || e.message)));

// ---------- Web: Firebase browser SDK ----------

let web = null; // { auth, mod } once loaded
async function webAuth(config) {
  if (web) return web;
  const [{ initializeApp }, mod] = await Promise.all([import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`)]);
  const app = initializeApp(config.auth.web, 'takkar');
  const auth = mod.getAuth(app);
  auth.languageCode = 'en';
  web = { auth, mod };
  return web;
}

function webError(e, fallback) {
  const code = String(e && e.code);
  if (code.includes('popup-blocked')) return 'Your browser blocked the Google window. Allow pop-ups for this site and try again.';
  if (code.includes('operation-not-supported') || code.includes('web-storage-unsupported') || code.includes('disallowed')) return 'Google sign-in does not work inside this app’s browser. Open this page in Chrome or Safari.';
  if (code.includes('unauthorized-domain')) return 'Sign-in is not set up for this web address yet. Play as a guest for now.';
  if (code.includes('network')) return 'No internet connection. Check your signal and try again.';
  if (code.includes('too-many-requests') || code.includes('quota')) return 'Too many tries. Please wait a while, or play as a guest.';
  if (code.includes('invalid-verification-code')) return 'That code is not right. Check the SMS and try again.';
  if (code.includes('code-expired')) return 'That code has expired. Ask for a new one.';
  if (code.includes('invalid-phone-number')) return 'That phone number does not look right.';
  if (code.includes('captcha')) return 'The robot check did not finish. Please try again.';
  return fallback;
}

// ---------- Google ----------

/** Returns { idToken } or { cancelled: true }. Throws with a friendly message on failure. */
export async function googleSignIn(config) {
  if (useNative()) {
    try {
      await plugin().signInWithGoogle();
      const { token } = await plugin().getIdToken({ forceRefresh: true });
      return { idToken: token };
    } catch (e) {
      if (cancelled(e)) return { cancelled: true };
      throw new Error('Google sign-in did not work. Check your connection and try again.');
    }
  }
  try {
    const { auth, mod } = await webAuth(config);
    const provider = new mod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await mod.signInWithPopup(auth, provider);
    return { idToken: await result.user.getIdToken() };
  } catch (e) {
    if (cancelled(e)) return { cancelled: true };
    throw new Error(webError(e, 'Google sign-in did not work. Please try again.'));
  }
}

// ---------- Phone: send a code, then confirm it ----------

let listeners = [];
async function clearListeners() {
  await Promise.all(listeners.map((l) => l.remove().catch(() => {})));
  listeners = [];
}

let webConfirmation = null;
let verifier = null;

/** The invisible "I'm not a robot" check lives outside the app's screens, so redraws never remove it. */
function recaptchaHost() {
  let el = document.getElementById('takkar-recaptcha');
  if (!el) {
    el = document.createElement('div');
    el.id = 'takkar-recaptcha';
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Sends the SMS. Resolves with { verificationId } when the code is sent, or with
 * { idToken } when Android reads the SMS by itself and signs in straight away.
 */
export async function sendPhoneCode(phoneNumber, { resend = false, config } = {}) {
  if (!useNative()) {
    try {
      const { auth, mod } = await webAuth(config);
      verifier?.clear?.();
      verifier = new mod.RecaptchaVerifier(auth, recaptchaHost(), { size: 'invisible' });
      webConfirmation = await mod.signInWithPhoneNumber(auth, phoneNumber, verifier);
      return { verificationId: 'web' };
    } catch (e) {
      verifier?.clear?.();
      verifier = null;
      throw new Error(webError(e, 'We could not send the code. Please try again.'));
    }
  }
  await clearListeners();
  return new Promise((resolve, reject) => {
    const done = (fn) => (value) => { clearListeners(); fn(value); };
    Promise.all([
      plugin().addListener('phoneCodeSent', done(({ verificationId }) => resolve({ verificationId }))),
      plugin().addListener('phoneVerificationCompleted', done(async () => {
        try { resolve({ idToken: (await plugin().getIdToken({ forceRefresh: true })).token }); } catch (e) { reject(e); }
      })),
      plugin().addListener('phoneVerificationFailed', done(({ message }) => reject(new Error(phoneError(message))))),
    ]).then((handles) => {
      listeners = handles;
      return plugin().signInWithPhoneNumber({ phoneNumber, resendCode: resend, timeout: 60 });
    }).catch((e) => { clearListeners(); reject(new Error(phoneError(e && e.message))); });
  });
}

export async function confirmPhoneCode(verificationId, code) {
  if (!useNative()) {
    try {
      const result = await webConfirmation.confirm(code);
      return { idToken: await result.user.getIdToken() };
    } catch (e) {
      throw new Error(webError(e, 'We could not verify your number. Please try again.'));
    }
  }
  try {
    await plugin().confirmVerificationCode({ verificationId, verificationCode: code });
    const { token } = await plugin().getIdToken({ forceRefresh: true });
    return { idToken: token };
  } catch (e) {
    throw new Error(phoneError(e && e.message));
  }
}

function phoneError(message = '') {
  const m = String(message).toLowerCase();
  if (m.includes('invalid') && m.includes('code')) return 'That code is not right. Check the SMS and try again.';
  if (m.includes('expired')) return 'That code has expired. Ask for a new one.';
  if (m.includes('too many') || m.includes('quota') || m.includes('blocked')) return 'Too many tries from this phone. Please wait a while, or play as a guest.';
  if (m.includes('invalid') && m.includes('phone')) return 'That phone number does not look right.';
  if (m.includes('network')) return 'No internet connection. Check your signal and try again.';
  return 'We could not verify your number. Please try again.';
}

/** Leaves Firebase once the Takkar session exists (and on sign-out). */
export async function firebaseSignOut() {
  try {
    if (useNative()) await plugin().signOut();
    else if (web) await web.mod.signOut(web.auth);
  } catch { /* already signed out */ }
}
