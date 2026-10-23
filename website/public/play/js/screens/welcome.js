import { LOGO, blobs, esc } from '../ui.js?v=ffd6767078';
import { HERE, IS_NATIVE } from '../config.js?v=ffd6767078';

const GOOGLE_G = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const PHONE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18h3"/></svg>';

// ONB-01 to ONB-05: sign in with Google or a phone number, or play as a guest.
export function welcome({ pendingChallenge, signInReady, busy, error, exam }) {
  const off = !signInReady || busy ? 'disabled' : '';
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full welcome">
      <div class="welcome__intro">
      <div class="brand">${LOGO()}<span class="brand__word">takkar</span><span class="brand__hi" lang="hi">टक्कर</span></div>

      <h1 class="title" style="margin-top:56px">${pendingChallenge ? 'Sign in, then take the challenge.' : 'Roz ek takkar.'}</h1>
      ${exam ? `<span class="exam-chip mt-16"><b style="background:${exam.color}">${esc(exam.badge)}</b>Preparing for ${esc(exam.short)}</span>` : ''}
      <p class="muted mt-12" style="font-size:18px">${exam ? `Ten questions a day in the ${esc(exam.short)} pattern, against a rival.` : 'Ten Quant and Reasoning questions a day, against a rival, for SSC, banking and railway aspirants.'}</p>
      ${signInReady ? '<p class="small muted mt-8">Sign in to keep your progress on every device.</p>' : ''}
      </div>

      <div class="mt-auto welcome__panel" style="padding-top:28px">
        ${error ? `<p class="notice mb-12" role="alert">${esc(error)}</p>` : ''}
        <button class="btn btn--white btn--icon" type="button" data-action="signin-google" ${off}>${GOOGLE_G}<span>${busy === 'google' ? 'Opening Google…' : 'Continue with Google'}</span></button>
        <button class="btn btn--glass btn--icon mt-12" type="button" data-action="signin-phone" ${off}>${PHONE}<span>Continue with phone</span></button>
        ${signInReady ? '' : '<p class="small muted center mt-8">Sign-in is being set up for the beta. You can play as a guest now.</p>'}
        <div class="or mt-16"><span>or</span></div>
        <button class="btn btn--line mt-16" type="button" data-action="guest-start" ${busy ? 'disabled' : ''}>Play as a guest</button>
        <p class="small muted center mt-8">Guest games stay on ${HERE} only and are not saved to an account.</p>
        <p class="small muted center mt-12">By continuing you accept the <button class="link-btn small" type="button" data-action="open-url" data-url="https://takkar.vercel.app/terms" style="padding:0;min-height:0">Terms</button> and <button class="link-btn small" type="button" data-action="open-url" data-url="https://takkar.vercel.app/privacy" style="padding:0;min-height:0">Privacy notice</button>. Takkar is for adults (18+) only.</p>
      </div>
    </div>
  </div>`;
}
