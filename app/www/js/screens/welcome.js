import { LOGO, blobs } from '../ui.js';

// ONB-01, ONB-02, ONB-04, ONB-05. No phone number, no contacts (ONB-03).
export function welcome({ pendingChallenge }) {
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full">
      <div class="brand">${LOGO()}<span class="brand__word">takkar</span><span class="brand__hi" lang="hi">टक्कर</span></div>

      <h1 class="title mt-24" style="margin-top:56px">${pendingChallenge ? 'Pick a nickname, then take the challenge.' : 'Pick a nickname. Meet your first rival.'}</h1>
      <p class="muted mt-12" style="font-size:17px">No phone number and no contacts. Just a name your rival will see.</p>

      <form class="glass mt-24" style="border-radius:28px;overflow:hidden" data-form="welcome" novalidate>
        <div class="field">
          <label for="nick">Nickname</label>
          <input id="nick" name="nick" type="text" maxlength="12" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Letters and numbers only" data-input="nick">
          <p class="field__error" id="nick-error" role="alert"></p>
        </div>
        <div class="divider"></div>
        <label class="check" for="age">I am 18 or older <input id="age" name="age" type="checkbox" data-input="age"></label>
      </form>

      <div class="mt-auto" style="padding-top:28px">
        <button class="btn btn--cobalt" type="button" data-action="welcome-start" id="welcome-start" disabled>${pendingChallenge ? 'Continue to the challenge' : 'Start my first duel'}</button>
        <p class="small muted center mt-12">By continuing you accept the <button class="link-btn small" type="button" data-action="open-url" data-url="https://takkar.info/terms" style="padding:0;min-height:0">Terms</button> and <button class="link-btn small" type="button" data-action="open-url" data-url="https://takkar.info/privacy" style="padding:0;min-height:0">Privacy notice</button>. Takkar is for adults only.</p>
        <p class="small muted center mt-8">Prototype. Everything stays on this phone.</p>
      </div>
    </div>
  </div>`;
}
