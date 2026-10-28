import { esc, blobs, icon, num } from '../ui.js?v=7bfcefb663';
import { TOPIC_LABELS, LEVEL_LABELS, MARKING_LABELS, maxScore } from '../game.js?v=7bfcefb663';
import { getExam } from '../exams.js?v=7bfcefb663';

// CHAL-02: opening a challenge shows the challenger, the score to beat and the settings.
export function challengeEntry({ codeText, error, challenge }) {
  return `
  <div class="screen screen--lobby">
    <div class="blob blob--cobalt blob--a"></div><div class="blob blob--saffron blob--b"></div>
    <div class="screen__body screen__body--full">
      <div class="row"><button class="icon-btn glass" type="button" data-action="back" aria-label="Back">${icon('back')}</button></div>

      ${challenge ? `
        <h1 class="title mt-20">${esc(challenge.nickname)} challenged you.</h1>
        <p class="muted mt-8" style="font-size:18px">Same ten questions. Beat their score.</p>
        <section class="card--lg glass mt-20" aria-label="Challenge details">
          <div class="row row--between"><span class="eyebrow">${getExam(challenge.exam) ? `${esc(getExam(challenge.exam).short)} · ` : ''}${TOPIC_LABELS[challenge.topic]}, ${LEVEL_LABELS[challenge.level].toLowerCase()}</span><span class="tag tag--saffron">${MARKING_LABELS[challenge.marking]}</span></div>
          <div class="mt-12 eyebrow">Score to beat</div>
          <div style="font-family:var(--display);font-weight:800;font-size:56px;line-height:1">${num(challenge.score)} <span style="font-size:22px;color:#3F4670">of ${maxScore(challenge.marking, challenge.exam)}</span></div>
          <div class="collision mt-16" aria-hidden="true"><div class="collision__you" style="width:50%"></div><div class="collision__dot" style="left:50%;border-color:#ECEFF8"></div></div>
          <div class="row row--between mt-8 small"><span style="color:#2A3BE8;font-weight:600">You, your turn</span><span style="color:#B84700;font-weight:600">${esc(challenge.nickname)}</span></div>
        </section>
        <div class="mt-auto" style="padding-top:24px">
          <button class="btn btn--cobalt" type="button" data-action="play-challenge">Play ${esc(challenge.nickname)}’s questions</button>
          <button class="btn btn--glass mt-12" type="button" data-action="clear-challenge">Use a different code</button>
          <p class="small muted center mt-12">Nothing is posted anywhere.</p>
        </div>
      ` : `
        <h1 class="title mt-20">Enter a challenge code</h1>
        <p class="muted mt-8">Paste the code a friend sent you on WhatsApp or Telegram.</p>
        <label class="eyebrow mt-20" for="code" style="display:block">Challenge code</label>
        <input class="code-input mt-8" id="code" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="TK-XXXXX-XXXXX-..." value="${esc(codeText || '')}" data-input="code">
        <p class="field__error mt-8" role="alert">${esc(error || '')}</p>
        <div class="mt-auto" style="padding-top:24px">
          <button class="btn btn--glass" type="button" data-action="paste-code">Paste from clipboard</button>
          <button class="btn btn--cobalt mt-12" type="button" data-action="check-code">Open challenge</button>
        </div>
      `}
    </div>
  </div>`;
}
