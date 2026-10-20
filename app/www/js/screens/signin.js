// Phone sign-in, nickname setup, and the screens the admin can put in front of players
// (paused, update needed, account on hold), plus the in-app report form.
import { esc, blobs, icon, LOGO } from '../ui.js';

const back = `<div class="row"><button class="icon-btn glass" type="button" data-action="back" aria-label="Back">${icon('back')}</button></div>`;

/** step: 'number' | 'code'. resendIn: seconds until "Send a new code" works. */
export function phoneScreen({ step, number, error, busy, resendIn }) {
  if (step === 'code') {
    return `
    <div class="screen screen--lobby">${blobs()}
      <div class="screen__body screen__body--full">
        ${back}
        <h1 class="title mt-20">Enter the code</h1>
        <p class="muted mt-8">We sent a 6-digit code by SMS to <strong>+91 ${esc(number)}</strong>.</p>
        <form class="glass mt-24" style="border-radius:28px;overflow:hidden" data-form="otp" novalidate>
          <div class="field">
            <label for="otp">Code from the SMS</label>
            <input id="otp" name="otp" class="otp-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" placeholder="••••••" data-input="otp">
            <p class="field__error" role="alert">${esc(error || '')}</p>
          </div>
        </form>
        <div class="row row--between mt-12">
          <button class="link-btn" type="button" data-action="phone-change">Change number</button>
          <button class="link-btn" type="button" data-action="phone-resend" ${resendIn > 0 || busy ? 'disabled' : ''} id="resend">${resendIn > 0 ? `New code in ${resendIn}s` : 'Send a new code'}</button>
        </div>
        <div class="mt-auto" style="padding-top:24px">
          <button class="btn btn--cobalt" type="button" data-action="phone-verify" ${busy ? 'disabled' : ''}>${busy ? 'Checking…' : 'Verify and continue'}</button>
        </div>
      </div>
    </div>`;
  }
  return `
  <div class="screen screen--lobby">${blobs()}
    <div class="screen__body screen__body--full">
      ${back}
      <h1 class="title mt-20">Your phone number</h1>
      <p class="muted mt-8">We send a one-time code by SMS. Your number is used only to sign you in; other players never see it.</p>
      <form class="glass mt-24" style="border-radius:28px;overflow:hidden" data-form="phone" novalidate>
        <div class="field">
          <label for="phone">Mobile number (India)</label>
          <div class="phone-row"><span class="phone-row__cc">+91</span>
            <input id="phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="10" placeholder="98765 43210" value="${esc(number || '')}" data-input="phone"></div>
          <p class="field__error" role="alert">${esc(error || '')}</p>
        </div>
      </form>
      <div class="mt-auto" style="padding-top:24px">
        <button class="btn btn--cobalt" type="button" data-action="phone-send" ${busy ? 'disabled' : ''}>${busy ? 'Sending code…' : 'Send code'}</button>
        <p class="small muted center mt-8">Standard SMS rates may apply.</p>
      </div>
    </div>
  </div>`;
}

/**
 * Nickname and 18+ for a new account (mode 'account') or a guest (mode 'guest').
 * nickname: prefilled value; error: message from the app or the server.
 */
export function profileSetup({ mode, provider, nickname, error, busy, pendingChallenge }) {
  const account = mode === 'account';
  return `
  <div class="screen screen--lobby">${blobs()}
    <div class="screen__body screen__body--full">
      ${back}
      <h1 class="title mt-20">${pendingChallenge ? 'Pick a nickname, then take the challenge.' : 'Pick a nickname. Meet your first rival.'}</h1>
      <p class="muted mt-12" style="font-size:17px">${account ? `Signed in with ${provider === 'phone' ? 'your phone number' : 'Google'}. Your nickname is the only thing other players see.` : 'A name your rival will see. No phone number, no contacts.'}</p>

      <form class="glass mt-24" style="border-radius:28px;overflow:hidden" data-form="welcome" novalidate>
        <div class="field">
          <label for="nick">Nickname</label>
          <input id="nick" name="nick" type="text" maxlength="12" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Letters and numbers only" value="${esc(nickname || '')}" data-input="nick">
          <p class="field__error" id="nick-error" role="alert">${esc(error || '')}</p>
        </div>
        <div class="divider"></div>
        <label class="check" for="age">I am 18 or older <input id="age" name="age" type="checkbox" data-input="age"></label>
      </form>
      ${account ? '' : '<p class="notice mt-16">Playing as a guest: your games are kept on this phone only. Uninstalling the app or clearing its data removes them. Sign in any time from the You tab to keep them.</p>'}

      <div class="mt-auto" style="padding-top:28px">
        <button class="btn btn--cobalt" type="button" data-action="profile-save" id="welcome-start" disabled>${busy ? 'Saving…' : pendingChallenge ? 'Continue to the challenge' : 'Start my first duel'}</button>
      </div>
    </div>
  </div>`;
}

// ---------- Screens the admin controls ----------

function wall({ title, body, actions }) {
  return `
  <div class="screen screen--arena">${blobs('arena')}
    <div class="screen__body screen__body--full" style="justify-content:center">
      <div class="brand">${LOGO(true)}<span class="brand__word">takkar</span></div>
      <h1 class="title mt-24">${title}</h1>
      <div class="mt-12 muted" style="font-size:18px">${body}</div>
      <div class="mt-auto" style="padding-top:32px">${actions}</div>
    </div>
  </div>`;
}

export const pausedScreen = () => wall({
  title: 'Takkar is taking a short break.',
  body: '<p>We are fixing something and will be back soon. Everything you have played so far is kept.</p>',
  actions: '<button class="btn btn--white" type="button" data-action="retry-config">Try again</button>',
});

export const updateScreen = ({ url }) => wall({
  title: 'Time to update Takkar.',
  body: '<p>This version is too old to play. The new one takes a minute to install, and your games stay on your phone.</p>',
  actions: `<button class="btn btn--white" type="button" data-action="open-url" data-url="${esc(url)}">Get the new version</button>`,
});

export function blockedScreen({ code, message, until }) {
  const end = until ? new Date(until).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const banned = code === 'banned';
  return wall({
    title: banned ? 'This account is closed.' : 'Your account is on hold.',
    body: `<p>${esc(message || '')}${end ? ` It opens again on ${esc(end)}.` : ''}</p>
      <p class="mt-12">If you think this is a mistake, tap Contact support and tell us.</p>`,
    actions: `
      <button class="btn btn--white" type="button" data-action="open-report">Contact support</button>
      <button class="btn btn--ghost-dark mt-12" type="button" data-action="sign-out">Sign out and play as a guest</button>`,
  });
}

// ---------- Report a problem / a player ----------

export const REPORT_KINDS = [
  ['app_problem', 'Something in the app is broken'],
  ['nickname', 'A player’s nickname is offensive'],
  ['cheating', 'A player is cheating'],
  ['harassment', 'Someone is harassing me'],
  ['under_18', 'A player is under 18'],
  ['other', 'Something else'],
];

export function reportSheet({ kind, details, nickname, error, busy }) {
  const aboutPlayer = ['nickname', 'cheating', 'harassment', 'under_18'].includes(kind);
  return `
  <div class="scrim" data-action="close-sheet">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="report-title" data-stop>
      <div class="sheet__handle"></div>
      <h2 class="sheet__title" id="report-title">Report a problem</h2>
      <p class="small muted mt-8">It goes to the Takkar team, who read every report within 24 hours.</p>
      <h3>What is it about?</h3>
      <div class="choice-list">${REPORT_KINDS.map(([k, label]) => `<button type="button" data-action="report-kind" data-value="${k}" aria-pressed="${kind === k}">${label}</button>`).join('')}</div>
      ${aboutPlayer ? `<h3><label for="report-nick">Their nickname</label></h3><input class="text-input" id="report-nick" maxlength="12" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(nickname || '')}" data-input="report-nick">` : ''}
      <h3><label for="report-details">What happened?</label></h3>
      <textarea class="text-input" id="report-details" rows="4" maxlength="1000" placeholder="A few words help us act faster" data-input="report-details">${esc(details || '')}</textarea>
      <p class="field__error" role="alert">${esc(error || '')}</p>
      <button class="btn btn--cobalt mt-12" type="button" data-action="send-report" ${busy ? 'disabled' : ''}>${busy ? 'Sending…' : 'Send report'}</button>
    </div>
  </div>`;
}
