// Tutor leagues (Live tests tab, LIVE-14, LIVE-16, LIVE-17). Verified educators run them; students join
// with a code and give their real name, which only the educator sees.
import { esc, blobs, tabbar, icon, leagueSwitch } from '../ui.js?v=5f284911c5';
import { EXAMS } from '../exams.js?v=5f284911c5';

const EXAM_IDS = Object.keys(EXAMS);
const examOf = (id) => EXAMS[id] || null;

function tile(l) {
  const exam = examOf(l.exam);
  const pct = l.max ? Math.min(100, Math.round((l.members / l.max) * 100)) : 0;
  const sub = l.role === 'owner' ? `${l.members} of ${l.max} students${l.waiting ? ` · ${l.waiting} waiting` : ''}`
    : l.status === 'closed' ? 'This league is closed'
      : l.role === 'pending' ? 'Waiting for your tutor to let you in' : `${l.members} students`;
  return `
    <button class="squad-tile glass" type="button" data-action="league-open" data-id="${esc(l.id)}">
      <span class="squad-tile__top">
        <span class="squad-tile__badge" style="background:${exam ? exam.color : '#2A3BE8'}">${esc((l.name.trim()[0] || '?').toUpperCase())}</span>
        <span class="grow" style="min-width:0"><span class="squad-tile__name">${esc(l.name)}</span>
          <span class="small muted">${exam ? esc(exam.short) : 'League'}${l.role === 'owner' ? ' · you run it' : l.educator ? ` · ${esc(l.educator)}` : ''}</span></span>
      </span>
      ${l.role === 'owner' ? `<span class="squad-tile__members"><span class="progress"><span class="progress__bar" style="display:block;width:${pct}%"></span></span>` : '<span class="squad-tile__members">'}
        <span class="small muted">${esc(sub)}</span></span>
      <span class="squad-tile__foot"><span>${l.role === 'owner' ? 'Students and invite' : 'Live tests'}</span><span class="squad-tile__go">Open ${icon('chevron')}</span></span>
    </button>`;
}

/** What a league is, for students with none yet (and guests, with Sign in). */
function intro(signIn) {
  return `
        <div class="feature">
          <div class="feature__glow feature__glow--a"></div><div class="feature__glow feature__glow--b"></div>
          <h2 class="feature__title">Join your tutor’s league.</h2>
          <ol class="squad-steps mt-16">
            <li><b>1</b><span>Your tutor shares a league code or link</span></li>
            <li><b>2</b><span>Join with your real name, so they know it’s you</span></li>
            <li><b>3</b><span>Sit their live tests here and get your report</span></li>
          </ol>
          ${signIn ? '<button class="btn btn--white mt-20" type="button" data-action="go" data-to="welcome">Sign in to join</button>' : ''}
          <p class="small mt-12" style="color:#D7DBF5">Only your tutor sees your real name and results. Other students never do.</p>
        </div>`;
}

/** League tab: my leagues, join with a code, and (for educators) create. */
export function leagueHome({ lg, signedIn, signInReady }) {
  const s = lg.list;
  const owned = s?.owned || [];
  const joined = s?.joined || [];
  const educator = !!s?.educator;
  const canCreate = educator && owned.length < (s?.limits?.leagues || 0);
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body">
      ${leagueSwitch('league')}
      <span class="eyebrow">Tutor leagues</span>
      <h1 class="title mt-8">League</h1>
      <p class="muted mt-8">${educator ? 'Your batches and their live tests.' : 'Your tutor’s batch on Takkar: live tests with a strict timer, results when your tutor releases them.'}</p>
      <div class="dgrid dgrid--squads">
      <section class="ga-a mt-16">
        ${!signedIn ? intro(signInReady)
          : !s && lg.error ? `
        <div class="card--lg tint" role="alert">
          <h2 class="card__title">Your leagues didn’t load</h2>
          <p class="small muted mt-8">${esc(lg.error)}</p>
          <button class="btn btn--line mt-12" type="button" data-action="league-retry">Try again</button>
        </div>`
          : !s ? '<div class="card--lg tint"><p class="muted">Loading your leagues…</p></div>'
          : `${educator ? `
        <div class="row row--between"><h2 style="font-size:20px">Leagues you run</h2><span class="small muted">${owned.length} of ${s.limits.leagues}</span></div>
        <div class="squad-tiles mt-12">
          ${owned.map(tile).join('')}
          ${canCreate ? '<button class="squad-tile squad-tile--new" type="button" data-action="league-new"><span class="squad-tile__plus" aria-hidden="true">+</span><span>Create a league</span></button>' : ''}
        </div>
        ${!canCreate ? `<p class="small muted mt-8">Your beta plan allows ${s.limits.leagues} leagues. Close one to start another. Paid plans: coming soon.</p>` : ''}` : ''}
        ${joined.length ? `
        <h2 class="${educator ? 'mt-24' : ''}" style="font-size:20px">Your leagues</h2>
        <div class="squad-tiles mt-12">${joined.map(tile).join('')}</div>` : ''}
        ${!educator && !joined.length ? intro(false) : ''}`}
        ${lg.error && s ? `<p class="notice mt-16" role="alert">${esc(lg.error)} <button class="link-btn" type="button" data-action="league-retry">Try again</button></p>` : ''}
      </section>

      <aside class="ga-b mt-16">
        <form class="squad-join glass" data-form="league-code" novalidate>
          <h2 style="font-size:18px">Have a league code?</h2>
          <p class="small muted mt-4">Type the 7-letter code from your tutor, or open their link.</p>
          <div class="squad-join__row mt-12">
            <input id="league-code" type="text" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="K7MQ2PX" aria-label="League code" value="${esc(lg.code || '')}">
            <button class="btn btn--cobalt" type="button" data-action="league-find">Find</button>
          </div>
          <p class="field__error" role="alert">${esc(lg.codeError || '')}</p>
        </form>
        ${!educator ? `<button class="card tint card-link mt-16" type="button" data-action="edu-open"><span class="card__title" style="font-size:16px">Are you a tutor?</span><span class="small muted" style="display:block">Get verified to run leagues and live tests for your students.</span></button>` : ''}
      </aside>
      </div>
    </div>
    ${tabbar('league')}
  </div>`;
}

/** An educator creates a league: name, exam (fixed), approval. */
export function leagueCreate({ draft, error, busy }) {
  const pick = (id) => `<button type="button" role="radio" aria-checked="${draft.exam === id}" class="exam-card ${draft.exam === id ? 'is-on' : ''}" data-action="league-exam" data-value="${id}">
      <span class="exam-card__badge" style="background:${EXAMS[id].color}">${esc(EXAMS[id].badge)}</span>
      <span class="grow"><span class="exam-card__name">${esc(EXAMS[id].short)}</span><span class="small muted" style="display:block">${esc(EXAMS[id].name)}</span></span>
      <span class="exam-card__tick" aria-hidden="true">${icon('check')}</span></button>`;
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full">
      <div class="row"><button class="icon-btn glass" type="button" data-action="back" aria-label="Back">${icon('back')}</button></div>
      <h1 class="title mt-16">Create a league</h1>
      <p class="muted mt-8">One league is one batch preparing for one exam. Students join with its code.</p>
      <form class="glass mt-20" style="border-radius:28px;overflow:hidden" data-form="league-create" novalidate>
        <div class="field">
          <label for="league-name">League name</label>
          <input id="league-name" type="text" maxlength="30" autocomplete="off" placeholder="For example: SSC Batch A" value="${esc(draft.name || '')}" data-input="league-name">
          <p class="field__error" role="alert">${esc(error || '')}</p>
        </div>
      </form>
      <h2 class="mt-20" style="font-size:18px">Exam pattern</h2>
      <p class="small muted mt-4">Tests in this league use this exam’s marking and timing. It can’t be changed later.</p>
      <div class="exam-list mt-8" role="radiogroup" aria-label="Exam pattern">${EXAM_IDS.map(pick).join('')}</div>
      <label class="check-row mt-20" for="league-approval">
        <input id="league-approval" type="checkbox" ${draft.approval ? 'checked' : ''} data-input="league-approval">
        <span>I approve each student before they join <span class="small muted" style="display:block">Recommended, so only your students get in.</span></span>
      </label>
      <div class="mt-auto" style="padding-top:24px">
        <button class="btn btn--cobalt" type="button" data-action="league-create" ${busy ? 'disabled' : ''}>${busy ? 'Creating…' : 'Create the league'}</button>
      </div>
    </div>
  </div>`;
}

/** What a league code opens: the league, the educator, real name and consent, Join. */
export function leagueJoin({ lg, signedIn, signInReady }) {
  const p = lg.preview;
  const l = p?.league;
  const exam = l && examOf(l.exam);
  const back = '<div class="row"><button class="icon-btn glass" type="button" data-action="back" aria-label="Back">' + icon('back') + '</button></div>';
  if (!l) {
    return `<div class="screen screen--lobby">${blobs()}<div class="screen__body screen__body--full">${back}
      ${lg.previewError ? `<h1 class="title mt-16">League not found</h1><p class="notice mt-16" role="alert">${esc(lg.previewError)}</p>` : '<p class="muted mt-20">Finding the league…</p>'}
    </div></div>`;
  }
  const already = p.you === 'member' || p.you === 'pending' || p.you === 'owner';
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full">
      ${back}
      <span class="eyebrow mt-16">League invite from ${esc(l.educator)}</span>
      <h1 class="title mt-8">${esc(l.name)}</h1>
      <p class="muted mt-8">${exam ? esc(exam.name) : 'League'} · ${l.members} of ${l.max} students${l.approval ? ' · your tutor lets students in' : ''}</p>
      ${p.you === 'owner' ? '<p class="notice mt-16">This is your league. Share its code with your students.</p>'
        : p.you === 'member' ? '<p class="notice mt-16">You are already in this league.</p>'
          : p.you === 'pending' ? '<p class="notice mt-16">You asked to join. Your tutor will let you in.</p>'
            : p.you === 'removed' ? '<p class="notice mt-16" role="alert">Your tutor removed you from this league, so you cannot join it again.</p>'
              : l.full ? '<p class="notice mt-16" role="alert">This league is full. Ask your tutor.</p>' : ''}
      ${!signedIn ? `
        <div class="card--lg tint mt-20"><p>Sign in to join, so your tutor gets your results on any device.</p>
        ${signInReady ? '<button class="btn btn--cobalt mt-12" type="button" data-action="league-sign-in">Sign in</button>' : ''}</div>`
        : !already && p.you !== 'removed' && !l.full ? `
      <form class="glass mt-20" style="border-radius:28px;overflow:hidden" data-form="league-join" novalidate>
        <div class="field">
          <label for="league-real-name">Your real name</label>
          <input id="league-real-name" type="text" maxlength="60" autocomplete="name" placeholder="As your tutor knows you" value="${esc(lg.realName || '')}" data-input="league-real-name">
          <p class="field__error" role="alert">${esc(lg.joinError || '')}</p>
        </div>
      </form>
      <label class="check-row mt-16" for="league-consent">
        <input id="league-consent" type="checkbox" ${lg.consent ? 'checked' : ''} data-input="league-consent">
        <span>${esc(l.educator)} will see my real name, nickname, scores and test reports for this league. Other students won’t.</span>
      </label>
      <p class="field__error" role="alert">${esc(lg.consentError || '')}</p>
      <div class="mt-auto" style="padding-top:24px">
        <button class="btn btn--cobalt" type="button" data-action="league-join" ${lg.busy ? 'disabled' : ''}>${lg.busy ? 'Joining…' : l.approval ? 'Ask to join' : 'Join the league'}</button>
      </div>` : already && p.you !== 'owner' ? `<div class="mt-auto" style="padding-top:24px"><button class="btn btn--line" type="button" data-action="league-open" data-id="${esc(l.id)}">Open the league</button></div>` : ''}
    </div>
  </div>`;
}

/** The league page: for the educator, students and invite; for a student, the league and what's next. */
export function leaguePage({ page, loading, error, busy, tests = '' }) {
  const back = '<div class="row"><button class="icon-btn glass" type="button" data-action="back" aria-label="Back">' + icon('back') + '</button></div>';
  if (!page) {
    return `<div class="screen screen--lobby">${blobs()}<div class="screen__body screen__body--full">${back}
      ${error ? `<p class="notice mt-20" role="alert">${esc(error)}</p>` : loading ? '<p class="muted mt-20">Loading the league…</p>' : ''}</div></div>`;
  }
  const l = page.league;
  const exam = examOf(l.exam);
  const closed = l.status === 'closed';
  const head = `
      <span class="eyebrow mt-16">${exam ? esc(exam.name) : 'League'}${page.role === 'owner' ? '' : l.educator ? ` · ${esc(l.educator)}` : ''}</span>
      <h1 class="title mt-8">${esc(l.name)}</h1>
      ${closed ? `<p class="notice mt-16">${esc(l.closedReason || 'This league is closed.')}</p>` : ''}`;
  if (page.role !== 'owner') {
    return `
    <div class="screen screen--lobby">${blobs()}
      <div class="screen__body screen__body--full">${back}${head}
        ${!closed ? `
        <p class="muted mt-8">${l.members} students · you joined as <strong>${esc(page.you?.realName || '')}</strong></p>
        ${page.role === 'pending' ? '<p class="notice mt-16">Your tutor hasn’t let you in yet. You’ll see their tests here once they do.</p>' : tests}` : ''}
        <div class="mt-auto" style="padding-top:24px">
          <button class="btn btn--line" type="button" data-action="league-leave-ask">${page.role === 'pending' ? 'Cancel my request' : closed ? 'Remove from my leagues' : 'Leave the league'}</button>
        </div>
      </div>
    </div>`;
  }
  const person = (m, waiting) => `
    <div class="list__item list__item--static">
      <span class="grow" style="min-width:0"><span style="font-weight:600;overflow-wrap:anywhere">${esc(m.realName || '')}</span><span class="small muted" style="display:block">${esc(m.nickname)}${m.username ? ` · @${esc(m.username)}` : ''}</span></span>
      ${closed ? '' : waiting
        ? `<button class="btn btn--sm btn--cobalt" type="button" data-action="league-approve" data-uid="${esc(m.id)}" ${busy ? 'disabled' : ''}>Let in</button>
           <button class="btn btn--sm btn--line" type="button" data-action="league-decline" data-uid="${esc(m.id)}" ${busy ? 'disabled' : ''} aria-label="Decline ${esc(m.realName || '')}">Decline</button>`
        : `<button class="link-btn small" type="button" data-action="league-remove-ask" data-uid="${esc(m.id)}">Remove</button>`}
    </div>`;
  return `
  <div class="screen screen--lobby">${blobs()}
    <div class="screen__body screen__body--full">${back}${head}
      <p class="muted mt-8">${l.members} of ${l.max} students${l.approval ? ' · you let students in' : ' · students join straight away'}</p>
      ${!closed ? `
      <section class="card--lg glass mt-20" aria-labelledby="lg-invite">
        <h2 class="card__title" id="lg-invite" style="font-size:18px">Invite your students</h2>
        <p class="small muted mt-4">Share the link, or the code to type in the League tab.</p>
        <div class="code-box"><span class="code-box__code" id="league-invite" style="font-size:22px;letter-spacing:0.12em">${esc(l.inviteCode)}</span>
          <button class="btn btn--sm btn--glass" type="button" data-action="league-copy" aria-label="Copy league code">${icon('copy')}</button></div>
        <button class="btn btn--cobalt mt-12" type="button" data-action="league-share">${icon('share')} Share the invite</button>
        <button class="link-btn small mt-8" type="button" data-action="league-reset-ask">Get a new code (the old one stops working)</button>
      </section>` : ''}
      ${page.waiting.length ? `
      <h2 class="mt-24" style="font-size:18px">Waiting to join (${page.waiting.length})</h2>
      <div class="list glass mt-8">${page.waiting.map((m) => person(m, true)).join('')}</div>` : ''}
      <h2 class="mt-24" style="font-size:18px">Students (${page.members.length})</h2>
      ${page.members.length ? `<div class="list glass mt-8">${page.members.map((m) => person(m, false)).join('')}</div>`
        : `<p class="small muted mt-8">${closed ? 'No students.' : 'No students yet. Share the code with your batch.'}</p>`}
      ${!closed ? `
      ${tests}
      <div class="mt-auto" style="padding-top:24px">
        <button class="btn btn--line" type="button" data-action="league-close-ask">Close this league</button>
      </div>` : ''}
    </div>
  </div>`;
}

/** Confirmations: remove a student, reset the code, close the league, leave. */
export function leagueConfirmSheet({ kind, name }) {
  const copy = {
    remove: [`Remove ${name}?`, 'They leave the league and cannot join again with the code.', 'Remove'],
    reset: ['Get a new code?', 'The old code and link stop working. Students already in stay in.', 'New code'],
    close: ['Close this league?', 'Students see a notice, the code stops working, and it frees a place in your plan. This can’t be undone.', 'Close it'],
    leave: ['Leave this league?', 'Your tutor stops seeing your real name and new results. You can ask to join again with the code.', 'Leave'],
  }[kind];
  return `
  <div class="scrim" data-action="close-sheet">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="lg-confirm-title" data-stop>
      <div class="sheet__handle"></div>
      <h2 class="sheet__title" id="lg-confirm-title">${esc(copy[0])}</h2>
      <p class="muted mt-8">${esc(copy[1])}</p>
      <div class="btn-row mt-20">
        <button class="btn btn--line" type="button" data-action="close-sheet">Cancel</button>
        <button class="btn ${kind === 'reset' ? 'btn--cobalt' : 'btn--danger'}" type="button" data-action="league-confirm">${esc(copy[2])}</button>
      </div>
    </div>
  </div>`;
}
