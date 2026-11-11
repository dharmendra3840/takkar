// For tutors and coaching centres: apply to become a verified educator (Live tests tab, EDU-01 to EDU-07).
import { esc, blobs, icon } from '../ui.js?v=46345c3e1f';
import { SITE_URL } from '../config.js?v=46345c3e1f';
import { EXAMS } from '../exams.js?v=46345c3e1f';
import { PLATFORMS, VERIFIED_BY, MAX_EXAMS, needsLink } from '../educator-rules.js?v=46345c3e1f';

const day = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });

/** The line on the You tab; its words follow the application's state. */
export function educatorItem(edu) {
  const s = edu?.data;
  const sub = !s ? 'Run timed tests for your students on Takkar'
    : s.educator ? 'You are a verified educator'
      : s.application?.status === 'pending' ? 'Application waiting for review'
        : s.application?.status === 'rejected' && !s.canApply ? `Not approved · apply again from ${day(s.reapplyAt)}`
          : 'Run timed tests for your students on Takkar';
  return `<button class="list__item" type="button" data-action="edu-open">${icon(s?.educator ? 'check' : 'league')}<span class="grow">For tutors and coaching centres<span class="small muted" style="display:block">${esc(sub)}</span></span>${icon('chevron')}</button>`;
}

function frame(body) {
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full">
      <div class="row"><button class="icon-btn glass" type="button" data-action="back" aria-label="Back">${icon('back')}</button></div>
      <span class="eyebrow mt-16">For tutors and coaching centres</span>
      ${body}
    </div>
  </div>`;
}

const intro = `
  <p class="muted mt-8">Verified educators run live tests for their own students: everyone starts within a few minutes of the start time, with a strict timer, and you release the results with a full class report.</p>
  <p class="small muted mt-8">We check that you run the channel or centre you name. We never ask for Aadhaar, PAN or ID documents.</p>`;

export function educatorScreen({ edu, signedIn, google, signInReady }) {
  if (!signedIn || !google) {
    return frame(`
      <h1 class="title mt-8">Become a verified educator</h1>
      ${intro}
      <div class="notice mt-20">${signedIn ? 'Educator applications need a Google account. Sign out, then sign in with Google.' : 'Sign in with Google to apply.'}</div>
      ${!signedIn && signInReady ? '<div class="mt-auto" style="padding-top:24px"><button class="btn btn--cobalt" type="button" data-action="edu-sign-in">Sign in with Google</button></div>' : ''}`);
  }
  if (!edu.data) {
    return frame(`<h1 class="title mt-8">Become a verified educator</h1>
      ${edu.error ? `<p class="notice mt-20" role="alert">${esc(edu.error)}</p><div class="mt-16"><button class="btn btn--line" type="button" data-action="edu-open">Try again</button></div>` : '<p class="muted mt-20">Loading…</p>'}`);
  }
  const s = edu.data;
  const a = s.application;
  if (s.educator) return approved(a);
  if (a?.status === 'pending') return pending(a, edu);
  if (a?.status === 'rejected' && !s.canApply) {
    return frame(`
      <h1 class="title mt-8">Not approved this time</h1>
      ${a.note ? `<p class="notice mt-20">${esc(a.note)}</p>` : ''}
      <p class="muted mt-16">You can apply again from <strong>${esc(day(s.reapplyAt))}</strong>. Questions? Message us on Instagram at @playtakkar.</p>`);
  }
  return form(edu, a?.status === 'rejected' ? a.note : '');
}

function approved(a) {
  return frame(`
    <h1 class="title mt-8">You are a verified educator</h1>
    <div class="card--lg tint mt-20 row"><span class="avatar" style="width:40px;height:40px">${icon('check')}</span>
      <span class="grow"><strong>${esc(a?.name || 'Verified educator')}</strong><span class="small muted" style="display:block">${esc(VERIFIED_BY[a?.verifiedBy] || 'Verified by the Takkar team')}</span></span></div>
    <p class="muted mt-16">Create a league for each batch in the League tab, share its code with your students, then schedule live tests from the league’s page.</p>
    <div class="mt-auto" style="padding-top:24px"><button class="btn btn--cobalt" type="button" data-action="go" data-to="league">Go to my leagues</button></div>`);
}

function pending(a, edu) {
  if (!a.code) {
    return frame(`
      <h1 class="title mt-8">Application sent</h1>
      <p class="muted mt-8">${esc(a.name)} · ${esc(PLATFORMS[a.platform]?.label || '')}</p>
      <p class="mt-16">Tell the Takkar team member you met that you've applied. They'll approve it once they've confirmed it's you, usually within 2 working days.</p>`);
  }
  const expired = Date.parse(a.codeExpiresAt) < Date.now();
  const p = PLATFORMS[a.platform];
  return frame(`
    <h1 class="title mt-8">Prove the ${a.platform === 'website' ? 'website' : 'channel'} is yours</h1>
    <p class="muted mt-8">${esc(a.name)}${a.link ? ` · <span style="overflow-wrap:anywhere">${esc(a.link)}</span>` : ''}</p>
    <ol class="steps-list mt-20">
      <li><strong>Copy your code</strong>
        <div class="row mt-8"><code class="proof-code" id="edu-code">${esc(a.code)}</code>${expired ? '' : '<button class="btn btn--sm btn--line" type="button" data-action="edu-copy">Copy</button>'}</div>
        <span class="small muted">${expired ? 'This code has expired.' : `Works until ${esc(day(a.codeExpiresAt))}.`}</span></li>
      <li class="mt-16"><strong>Add it to ${esc(p?.where || 'your channel')}</strong>
        <span class="small muted" style="display:block">Leave it there until you're approved, then you can remove it.</span></li>
      <li class="mt-16"><strong>We check it by hand</strong>
        <span class="small muted" style="display:block">Usually within 2 working days. This page shows the result.</span></li>
    </ol>
    ${edu.error ? `<p class="notice mt-16" role="alert">${esc(edu.error)}</p>` : ''}
    ${expired ? `<div class="mt-auto" style="padding-top:24px"><button class="btn btn--cobalt" type="button" data-action="edu-renew" ${edu.busy ? 'disabled' : ''}>${edu.busy ? 'Getting a code…' : 'Get a new code'}</button></div>` : ''}`);
}

function form(edu, lastNote) {
  const f = edu.form;
  const err = edu.fieldErrors || {};
  const fe = (k) => `<p class="field__error" role="alert">${esc(err[k] || '')}</p>`;
  const platformPick = (id) => `<button type="button" role="radio" aria-checked="${f.platform === id}" class="chip-opt ${f.platform === id ? 'is-on' : ''}" data-action="edu-platform" data-value="${id}">${esc(PLATFORMS[id].label)}</button>`;
  const examPick = (id) => `<button type="button" role="checkbox" aria-checked="${f.exams.includes(id)}" class="chip-opt ${f.exams.includes(id) ? 'is-on' : ''}" data-action="edu-exam" data-value="${id}">${esc(EXAMS[id].short)}</button>`;
  return frame(`
    <h1 class="title mt-8">Become a verified educator</h1>
    ${intro}
    ${lastNote ? `<p class="notice mt-16">Last time: ${esc(lastNote)}</p>` : ''}
    <form class="glass mt-20" style="border-radius:28px;overflow:hidden" data-form="edu-apply" novalidate>
      <div class="field">
        <label for="edu-name">Channel or centre name</label>
        <input id="edu-name" type="text" maxlength="60" autocomplete="organization" placeholder="For example: Sharma Maths Classes" value="${esc(f.name)}" data-input="edu" data-field="name">
        ${fe('name')}
      </div>
    </form>
    <h2 class="mt-20" style="font-size:18px">How can we check it's yours?</h2>
    <div class="chip-row mt-8" role="radiogroup" aria-label="How we check">${Object.keys(PLATFORMS).map(platformPick).join('')}</div>
    ${fe('platform')}
    <form class="glass mt-16" style="border-radius:28px;overflow:hidden" data-form="edu-apply" novalidate>
      ${f.platform && needsLink(f.platform) ? `
      <div class="field">
        <label for="edu-link">${f.platform === 'website' ? 'Website link' : 'Link to your channel or account'}</label>
        <input id="edu-link" type="url" inputmode="url" autocomplete="url" placeholder="https://" value="${esc(f.link)}" data-input="edu" data-field="link">
        ${fe('link')}
      </div>` : ''}
      <div class="field">
        <label for="edu-audience">${f.platform === 'in_person' || f.platform === 'website' ? 'Students at your centre' : 'Followers or subscribers'}</label>
        <input id="edu-audience" type="text" inputmode="numeric" maxlength="9" placeholder="For example: 120" value="${esc(f.audience)}" data-input="edu" data-field="audience">
        ${fe('audience')}
      </div>
    </form>
    <h2 class="mt-20" style="font-size:18px">Exams you teach <span class="small muted" style="font-weight:400">(up to ${MAX_EXAMS})</span></h2>
    <div class="chip-row mt-8" role="group" aria-label="Exams you teach">${Object.keys(EXAMS).map(examPick).join('')}</div>
    ${fe('exams')}
    <label class="check-row mt-20" for="edu-terms">
      <input id="edu-terms" type="checkbox" ${f.terms ? 'checked' : ''} data-input="edu" data-field="terms">
      <span>I accept the <a href="${SITE_URL}/educator-terms" data-action="open-url" data-url="${SITE_URL}/educator-terms">educator terms</a>: I'll use students' results only to teach them, and never run paid contests or cash prizes.</span>
    </label>
    ${fe('terms')}
    ${edu.error ? `<p class="notice mt-16" role="alert">${esc(edu.error)}</p>` : ''}
    <div class="mt-auto" style="padding-top:24px">
      <button class="btn btn--cobalt" type="button" data-action="edu-apply" ${edu.busy ? 'disabled' : ''}>${edu.busy ? 'Sending…' : 'Send application'}</button>
    </div>`);
}
