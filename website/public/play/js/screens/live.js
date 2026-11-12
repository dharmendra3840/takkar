// Live friend duel: start or join, the lobby, the countdown (design/03-duels-squads-leagues-rooms.md §3.1).
// The duel itself uses the duel screen; the server keeps the clock and the score.
import { esc, blobs, icon } from '../ui.js?v=1c5e1e9cf5';
import { getExam, markingLabel } from '../exams.js?v=1c5e1e9cf5';

const back = `<div class="row"><button class="icon-btn glass" type="button" data-action="live-close" aria-label="Back">${icon('back')}</button></div>`;
const examLine = (id) => { const e = getExam(id); return e ? `${esc(e.short)} pattern: ${markingLabel(e)}, ${e.seconds} s a question` : ''; };
export const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** Start a duel or type a friend's code. */
export function liveStart({ code, error, busy, signedIn, signInReady }) {
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full">
      ${back}
      <h1 class="title mt-16">Duel a friend, live</h1>
      <p class="muted mt-8">The same ten questions for both of you at the same moment, in your exam’s pattern. You see their score as you play. Friend duels are free and don’t use your daily duels.</p>
      ${signedIn ? `
      <button class="btn btn--saffron mt-20" type="button" data-action="live-new" ${busy ? 'disabled' : ''}>${busy === 'new' ? 'Opening…' : 'Start a duel and invite'}</button>
      <form class="glass mt-20" style="border-radius:28px;overflow:hidden" data-form="live-code" novalidate>
        <div class="field">
          <label for="live-code">Got a code from a friend?</label>
          <input id="live-code" name="code" type="text" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="6 letters" value="${esc(code || '')}" data-input="live-code">
          <p class="field__error" role="alert">${esc(error || '')}</p>
        </div>
      </form>
      <button class="btn btn--cobalt mt-12" type="button" data-action="live-join-code" ${busy ? 'disabled' : ''}>${busy === 'join' ? 'Joining…' : 'Join the duel'}</button>`
    : `<p class="notice mt-20">Live duels need sign-in, so your friend knows it’s you.</p>
      ${signInReady ? '<button class="btn btn--cobalt mt-12" type="button" data-action="go" data-to="welcome">Sign in to play</button>' : '<p class="small muted mt-8">Sign-in isn’t available right now.</p>'}`}
    </div>
  </div>`;
}

/** Someone's link, before signing in: who invited you, and in which exam. */
export function liveInvite({ preview, error, signInReady }) {
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full">
      ${back}
      ${preview ? `
      <span class="eyebrow mt-16">Live duel · ${esc(preview.code)}</span>
      <h1 class="title mt-8">${esc(preview.host.nickname)} wants a duel.</h1>
      <p class="muted mt-8">${examLine(preview.exam)}. Ten questions, the same moment for both of you.</p>
      ${preview.open ? `<p class="notice mt-20">Sign in to take the duel, so ${esc(preview.host.nickname)} knows it’s you.</p>
      ${signInReady ? '<button class="btn btn--cobalt mt-12" type="button" data-action="go" data-to="welcome">Sign in and play</button>' : '<p class="small muted mt-8">Sign-in isn’t available right now.</p>'}`
      : '<p class="notice mt-20">This duel has started or closed. Ask your friend for a new link.</p>'}`
      : `<h1 class="title mt-16">Live duel</h1><p class="notice mt-20">${esc(error || 'Loading…')}</p>`}
    </div>
  </div>`;
}

/** The lobby, the countdown, and a lobby that closed. */
export function liveLobby({ lobby, status, error, now, link, canShare, reconnecting }) {
  if (status === 'expired') {
    const host = lobby?.you === 'host';
    return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full">
      ${back}
      <h1 class="title mt-16">${host ? 'Your friend didn’t come in time.' : 'This duel has closed.'}</h1>
      <p class="muted mt-8">${host ? 'The lobby closes after 10 minutes. Play the ten questions now and send them a challenge: they get 24 hours to beat your score.' : 'Ask your friend for a new link.'}</p>
      ${host ? '<button class="btn btn--saffron mt-20" type="button" data-action="live-fallback">Play now and send a challenge</button>' : ''}
      <button class="btn btn--glass mt-12" type="button" data-action="live-new">Start a new live duel</button>
    </div>
  </div>`;
  }
  if (!lobby) {
    return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full">
      ${back}
      <h1 class="title mt-16">Live duel</h1>
      <p class="${error ? 'notice' : 'muted'} mt-20">${esc(error || 'Connecting…')}</p>
      ${error ? '<button class="btn btn--cobalt mt-12" type="button" data-action="live-retry">Try again</button>' : ''}
    </div>
  </div>`;
  }
  const me = lobby.players[lobby.you];
  const them = lobby.players[lobby.you === 'host' ? 'guest' : 'host'];
  const counting = lobby.status === 'countdown';
  const left = counting ? Math.max(0, Math.ceil((lobby.startAt - now) / 1000)) : 0;
  const person = (p, label) => `
        <div class="list__item list__item--static">
          <span class="avatar ${p ? '' : 'avatar--ink'}">${esc(p ? p.nickname[0] : '?')}</span>
          <span class="grow" style="font-weight:600">${p ? esc(p.nickname) : 'Waiting for your friend…'}${label}${p?.username ? `<span class="small muted" style="display:block;font-weight:400">@${esc(p.username)}</span>` : ''}</span>
          ${p ? `<span class="tag ${p.ready ? 'tag--cobalt' : ''}">${p.ready ? 'Ready' : p.here ? 'Here' : 'Away'}</span>` : ''}
        </div>`;
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full">
      ${back}
      <span class="eyebrow mt-16">Live duel · ${esc(lobby.code)}</span>
      <h1 class="title mt-8" id="live-title">${counting ? `Starting in ${left}…` : them ? 'Both here? Tap Ready.' : 'Invite your friend.'}</h1>
      <p class="muted mt-8">${examLine(lobby.exam.id)}.</p>
      ${reconnecting ? '<p class="notice mt-12">Reconnecting…</p>' : ''}
      ${!them && lobby.you === 'host' ? `
      <div class="glass mt-20 live-code" style="border-radius:28px;padding:20px">
        <span class="small muted">Their code</span>
        <div class="live-code__value" aria-label="Code ${esc(lobby.code.split('').join(' '))}">${esc(lobby.code)}</div>
        <div class="row mt-12" style="gap:10px;flex-wrap:wrap">
          ${canShare ? '<button class="btn btn--sm btn--cobalt" type="button" data-action="live-share">Share the link</button>' : ''}
          <button class="btn btn--sm btn--line" type="button" data-action="live-copy">Copy the link</button>
        </div>
        <p class="small muted mt-12">Or they type the code under Home → Duel a friend. The lobby closes in <span id="live-left">${mmss(lobby.expiresAt - now)}</span>.</p>
      </div>` : ''}
      <div class="list glass mt-20">${person(me, ' (you)')}${person(them, '')}</div>
      ${error ? `<p class="notice mt-12">${esc(error)}</p>` : ''}
      <div class="mt-auto" style="padding-top:24px">
        ${counting ? '' : me?.ready
          ? `<button class="btn btn--line" type="button" data-action="live-unready">Not ready</button><p class="small muted center mt-8">${them?.ready ? 'Starting…' : `Waiting for ${them ? esc(them.nickname) : 'your friend'} to tap Ready.`}</p>`
          : `<button class="btn btn--saffron" type="button" data-action="live-ready" ${them?.here ? '' : 'disabled'}>Ready</button><p class="small muted center mt-8">${them?.here ? 'The duel starts when you’re both ready.' : 'Ready unlocks when your friend is here.'}</p>`}
      </div>
    </div>
  </div>`;
}

/** On the result: each question, and who got it right. */
export function liveReview(review, opponent, lang = 'en') {
  const mark = (ok) => (ok ? `<span style="color:#0B6B50" role="img" aria-label="Right">${icon('check')}</span>` : '<span class="muted" role="img" aria-label="Not right">–</span>');
  return `
      <section class="card--lg glass mt-16" aria-labelledby="live-review">
        <h2 class="card__title" id="live-review" style="font-size:18px">Question by question</h2>
        <div class="live-review mt-8" role="table" aria-label="Who got each question right">
          <div class="live-review__row live-review__head" role="row"><span role="columnheader">Question</span><span role="columnheader">You</span><span role="columnheader">${esc(opponent.nickname)}</span></div>
          ${review.map((r, i) => `<div class="live-review__row" role="row"><span role="cell"${lang === 'hi' && r.hi ? ' lang="hi"' : ''}>Q${i + 1} · ${esc(lang === 'hi' && r.hi ? r.hi.label : r.label)}</span><span role="cell">${mark(r.you?.correct)}</span><span role="cell">${mark(r.themCorrect)}</span></div>`).join('')}
        </div>
      </section>`;
}
