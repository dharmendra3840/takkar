// Google and phone sign-in through Firebase (the @capacitor-firebase/authentication plugin).
// Firebase only proves who the player is; the app swaps its ID token for a Takkar session
// at POST /api/auth/firebase and then signs out of Firebase again.

const plugin = () => window.Capacitor?.Plugins?.FirebaseAuthentication;
/** Sign-in needs the sign-in plugin (Android app) and a server that has Firebase set up. */
export const signInAvailable = (config) => !!plugin() && !!config?.auth?.firebase;

const cancelled = (e) => /cancel|closed|aborted|12501/i.test(String(e && (e.message || e.code)));

async function currentIdToken() {
  const { token } = await plugin().getIdToken({ forceRefresh: true });
  return token;
}

/** Returns { idToken } or { cancelled: true }. Throws with a friendly message on failure. */
export async function googleSignIn() {
  try {
    await plugin().signInWithGoogle();
    return { idToken: await currentIdToken() };
  } catch (e) {
    if (cancelled(e)) return { cancelled: true };
    throw new Error('Google sign-in did not work. Check your connection and try again.');
  }
}

// ---------- Phone: send a code, then confirm it ----------

let listeners = [];
async function clearListeners() {
  await Promise.all(listeners.map((l) => l.remove().catch(() => {})));
  listeners = [];
}

/**
 * Sends the SMS. Resolves with { verificationId } when the code is sent, or with
 * { idToken } when Android reads the SMS by itself and signs in straight away.
 */
export async function sendPhoneCode(phoneNumber, { resend = false } = {}) {
  await clearListeners();
  return new Promise((resolve, reject) => {
    const done = (fn) => (value) => { clearListeners(); fn(value); };
    Promise.all([
      plugin().addListener('phoneCodeSent', done(({ verificationId }) => resolve({ verificationId }))),
      plugin().addListener('phoneVerificationCompleted', done(async () => {
        try { resolve({ idToken: await currentIdToken() }); } catch (e) { reject(e); }
      })),
      plugin().addListener('phoneVerificationFailed', done(({ message }) => reject(new Error(phoneError(message))))),
    ]).then((handles) => {
      listeners = handles;
      return plugin().signInWithPhoneNumber({ phoneNumber, resendCode: resend, timeout: 60 });
    }).catch((e) => { clearListeners(); reject(new Error(phoneError(e && e.message))); });
  });
}

export async function confirmPhoneCode(verificationId, code) {
  try {
    await plugin().confirmVerificationCode({ verificationId, verificationCode: code });
    return { idToken: await currentIdToken() };
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
  try { await plugin()?.signOut(); } catch { /* already signed out */ }
}
