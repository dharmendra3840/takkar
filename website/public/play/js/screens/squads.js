// Squads (Phase 2): study groups of up to 20 signed-in players. Replaces the squad demo.
import { esc, blobs, tabbar, icon, num } from '../ui.js?v=81531dd943';
import { EXAMS, EXAM_IDS } from '../exams.js?v=81531dd943';

const ago = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};
const examTag = (id) => (EXAMS[id] ? `<span class="tag">${esc(EXAMS[id].short)}</span>` : '');

/** Squad tab for a guest: squads need a signed-in account. */
export function squadGate({ signInReady }) {
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body">
      <span class="eyebrow">Study together</span>
      <h1 class="title mt-8">Squad</h1>
      <section class="feature mt-16">
        <div class="feature__glow feature__glow--a"></div>
        <h2 class="feature__title">Practise with your study group.</h2>
        <p class="small mt-8" style="color:#D7DBF5">Up to 20 friends. The same ten questions for everyone each day, a daily table, a weekly mission and quick reactions. No chat, no strangers.</p>
        ${signInReady
          ? `<button class="btn btn--white mt-16" type="button" data-action="squad-sign-in">Sign in to start or join a squad</button>
             <p class="small mt-8" style="color:#D7DBF5">Squads need an account, so your squad mates know it is really you.</p>`
          : '<p class="notice notice--dark mt-16">Squads need sign-in, which is coming soon.</p>'}
      </section>
    </div>
    ${tabbar('squad')}
  </div>`;
}

/** Squad tab when signed in: your squads as tiles, then start one or join with a code. */
export function squadHome({ list, loading, error, code, codeError, max }) {
  const tiles = (list || []).map((s) => {
    const exam = EXAMS[s.exam];
    const pct = Math.round((s.members / s.max) * 100);
    return `
    <button class="squad-tile glass" type="button" data-action="squad-open" data-id="${esc(s.id)}">
      <span class="squad-tile__top">
        <span class="squad-tile__badge" style="background:${exam ? exam.color : '#2A3BE8'}">${esc((s.name.trim()[0] || '?').toUpperCase())}</span>
        <span class="grow" style="min-width:0"><span class="squad-tile__name">${esc(s.name)}</span>
          <span class="small muted">${exam ? esc(exam.short) : 'Squad'}${s.role === 'owner' ? ' · you run it' : ''}</span></span>
      </span>
      <span class="squad-tile__members"><span class="progress"><span class="progress__bar" style="display:block;width:${pct}%"></span></span>
        <span class="small muted">${s.members} of ${s.max} members</span></span>
      <span class="squad-tile__foot"><span>Today’s squad duel</span><span class="squad-tile__go">Open ${icon('chevron')}</span></span>
    </button>`;
  }).join('');
  const empty = list && !list.length;
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body">
      <span class="eyebrow">Study together</span>
      <h1 class="title mt-8">Squad</h1>
      <p class="muted mt-8">The same ten questions for your whole group, every day.</p>
      ${loading && !list ? '<p class="muted mt-16">Loading your squads…</p>' : ''}
      ${error ? `<p class="notice mt-16" role="alert">${esc(error)} <button class="link-btn" type="button" data-action="squad-retry">Try again</button></p>` : ''}

      <div class="dgrid dgrid--squads">
      <section class="ga-a mt-16">
        ${empty ? `
        <div class="feature">
          <div class="feature__glow feature__glow--a"></div><div class="feature__glow feature__glow--b"></div>
          <h2 class="feature__title">Start your study group.</h2>
          <ol class="squad-steps mt-16">
            <li><b>1</b><span>Start a squad for your exam</span></li>
            <li><b>2</b><span>Invite up to ${max - 1} friends with a link or code</span></li>
            <li><b>3</b><span>Play the same ten questions every day and compare</span></li>
          </ol>
          <button class="btn btn--white mt-20" type="button" data-action="go" data-to="squad-create">Start a squad</button>
          <p class="small mt-12" style="color:#D7DBF5">No chat, no strangers. Only nicknames and scores are shared.</p>
        </div>` : list ? `
        <div class="row row--between"><h2 style="font-size:20px">Your squads</h2><span class="small muted">${list.length} of 5</span></div>
        <div class="squad-tiles mt-12">
          ${tiles}
          ${list.length < 5 ? `<button class="squad-tile squad-tile--new" type="button" data-action="go" data-to="squad-create"><span class="squad-tile__plus" aria-hidden="true">+</span><span>Start another squad</span></button>` : ''}
        </div>` : ''}
      </section>

      <aside class="ga-b mt-16">
        <form class="squad-join glass" data-form="squad-code" novalidate>
          <h2 style="font-size:18px">Join a friend’s squad</h2>
          <p class="small muted mt-4">Type the 6-letter code they sent, or open their link.</p>
          <div class="squad-join__row mt-12">
            <input id="squad-code" type="text" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="K7MQ2P" aria-label="Squad code" value="${esc(code || '')}">
            <button class="btn btn--cobalt" type="button" data-action="squad-find">Find</button>
          </div>
          <p class="field__error" role="alert">${esc(codeError || '')}</p>
        </form>
        ${list && list.length ? `
        <div class="card--lg tint mt-16">
          <h2 class="card__title" style="font-size:16px">How squads work</h2>
          <ul class="squad-how mt-8 small muted">
            <li>Your first try each day goes on the squad’s table</li>
            <li>Everyone’s correct answers add up to the weekly mission</li>
            <li>Preset reactions only: no chat, no strangers</li>
          </ul>
        </div>` : ''}
      </aside>
      </div>
    </div>
    ${tabbar('squad')}
  </div>`;
}

/** Start a squad: a name and the exam it prepares for. */
export function squadCreate({ name, exam, error, busy }) {
  const pick = (id) => `<button type="button" role="radio" aria-checked="${exam === id}" class="exam-card ${exam === id ? 'is-on' : ''}" data-action="squad-exam" data-value="${id}">
      <span class="exam-card__badge" style="background:${EXAMS[id].color}">${esc(EXAMS[id].badge)}</span>
      <span class="grow"><span class="exam-card__name">${esc(EXAMS[id].short)}</span></span>
      <span class="exam-card__tick" aria-hidden="true">${icon('check')}</span></button>`;
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full">
      <div class="row"><button class="icon-btn glass" type="button" data-action="back" aria-label="Back">${icon('back')}</button></div>
      <h1 class="title mt-16">Start a squad</h1>
      <p class="muted mt-8">Give it a name your friends will recognise. Everyone in the squad gets questions in this exam's pattern.</p>
      <form class="glass mt-20" style="border-radius:28px;overflow:hidden" data-form="squad-create" novalidate>
        <div class="field">
          <label for="squad-name">Squad name</label>
          <input id="squad-name" type="text" maxlength="30" autocomplete="off" placeholder="For example: Night Owls" value="${esc(name || '')}">
          <p class="field__error" role="alert">${esc(error || '')}</p>
        </div>
      </form>
      <h2 class="mt-20" style="font-size:18px">Exam</h2>
      <div class="exam-list mt-8" role="radiogroup" aria-label="Exam">${EXAM_IDS.map(pick).join('')}</div>
      <div class="mt-auto" style="padding-top:24px">
        <button class="btn btn--cobalt" type="button" data-action="squad-create" ${busy ? 'disabled' : ''}>${busy ? 'Starting…' : 'Start the squad'}</button>
      </div>
    </div>
  </div>`;
}

/** What an invite opens: the squad's name, exam and size, and Join. */
export function squadJoin({ preview, error, busy, signedIn, signInReady }) {
  const s = preview?.squad;
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full">
      <div class="row"><button class="icon-btn glass" type="button" data-action="back" aria-label="Back">${icon('back')}</button></div>
      ${!s && !error ? '<p class="muted mt-20">Finding the squad…</p>' : ''}
      ${error ? `<h1 class="title mt-16">Squad not found</h1><p class="notice mt-16" role="alert">${esc(error)}</p>` : ''}
      ${s ? `
        <span class="eyebrow mt-16">You are invited to a squad</span>
        <h1 class="title mt-8">${esc(s.name)}</h1>
        <div class="row mt-12" style="gap:8px">${examTag(s.exam)}<span class="small muted">${s.members} of ${s.max} members</span></div>
        <p class="muted mt-16">Every day the squad gets the same ten questions. Your first try goes on the squad's table, and your correct answers count towards the weekly mission. Squad mates see your nickname and scores, never your email or phone number.</p>
        <div class="mt-auto" style="padding-top:24px">
          ${preview.you === 'member' ? '<button class="btn btn--cobalt" type="button" data-action="squad-open" data-id="' + esc(s.id) + '">Open the squad</button>'
            : s.full ? '<p class="notice">This squad is full.</p>'
            : signedIn ? `<button class="btn btn--cobalt" type="button" data-action="squad-join" ${busy ? 'disabled' : ''}>${busy ? 'Joining…' : 'Join the squad'}</button>`
            : signInReady ? '<button class="btn btn--cobalt" type="button" data-action="squad-sign-in">Sign in to join</button><p class="small muted center mt-8">Squads need an account, so your squad mates know it is really you.</p>'
            : '<p class="notice">Squads need sign-in, which is coming soon.</p>'}
        </div>` : ''}
    </div>
  </div>`;
}

/** The squad page. */
export function squadPage({ page, loading, error, nickname, canPlay }) {
  if (!page) {
    return `
    <div class="screen screen--lobby">${blobs()}<div class="screen__body">
      <div class="row"><button class="icon-btn glass" type="button" data-action="go" data-to="squad" aria-label="Back to squads">${icon('back')}</button></div>
      ${error ? `<p class="notice mt-16" role="alert">${esc(error)} <button class="link-btn" type="button" data-action="squad-retry">Try again</button></p>` : '<p class="muted mt-16">Loading the squad…</p>'}
    </div></div>`;
  }
  const { squad, you, members, today, mission, reactions, reactionChoices } = page;
  const owner = you.role === 'owner';
  const exam = EXAMS[squad.exam];
  const pct = Math.min(100, Math.round((mission.done / mission.target) * 100));
  const mine = today.table.find((r) => r.you);
  const rows = today.table.length
    ? today.table.map((r) => `<div class="rank-row ${r.you ? 'rank-row--you' : ''}"><span class="rank-row__n">${r.rank}</span><span class="grow" style="font-weight:600">${esc(r.nickname)}${r.you ? ' (you)' : ''}<span class="small muted" style="display:block;font-weight:400">${r.right} right · ${Math.round(r.timeMs / 1000)} s</span></span><span class="rank-row__score">${num(r.score)}</span></div>`).join('')
    : '<p class="small muted" style="padding:14px 18px">Nobody has played today\'s squad duel yet. Be the first.</p>';
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body">
      <div class="row row--between">
        <button class="icon-btn glass" type="button" data-action="go" data-to="squad" aria-label="Back to squads">${icon('back')}</button>
        ${examTag(squad.exam)}
      </div>
      <h1 class="title mt-12">${esc(squad.name)}</h1>
      <p class="small muted mt-4">${squad.members} of ${squad.max} members${owner ? ' · you run this squad' : ''}${loading ? ' · updating…' : ''}</p>
      ${error ? `<p class="notice mt-12" role="alert">${esc(error)}</p>` : ''}

      <div class="dgrid dgrid--squad">
      <section class="feature mt-16 ga-a" aria-labelledby="sq-today">
        <div class="feature__glow feature__glow--a"></div><div class="feature__glow feature__glow--b"></div>
        <div class="small" style="color:#D7DBF5;font-weight:600">Today's squad duel</div>
        <h2 class="feature__title mt-8" id="sq-today">${you.playedToday ? (mine ? `You scored ${num(mine.score)}.` : 'You have played today.') : 'Same ten questions for everyone.'}</h2>
        <p class="small mt-8" style="color:#D7DBF5">${exam ? `${esc(exam.short)} pattern. ` : ''}Your first try today goes on the squad's table. New questions at midnight.</p>
        ${canPlay
          ? `<button class="btn ${you.playedToday ? 'btn--glass' : 'btn--saffron'} mt-16" type="button" data-action="squad-play">${you.playedToday ? 'Practise again (won\'t count)' : 'Play today\'s squad duel'}</button>`
          : '<p class="notice notice--dark mt-16">Update Takkar to play today\'s squad duel.</p>'}
      </section>

      <section class="ga-b">
        <div class="row row--between mt-20"><h2 style="font-size:20px">Today's table</h2><span class="small muted">${today.table.length} of ${squad.members} played</span></div>
        <div class="list tint mt-8">${rows}</div>
      </section>

      <section class="card--lg tint mt-16 ga-c" aria-labelledby="sq-mission">
        <div class="row row--between"><h2 class="card__title" id="sq-mission" style="font-size:18px">Weekly mission</h2><span class="tag">${mission.daysLeft === 0 ? 'Last day' : `${mission.daysLeft} days left`}</span></div>
        <p class="small muted mt-8">${mission.target} correct answers together this week, from everyone's duels.</p>
        <div class="progress mt-12"><div class="progress__bar" style="width:${pct}%"></div></div>
        <p class="small mt-8"><strong>${Math.min(mission.done, mission.target)} of ${mission.target}</strong>${mission.done >= mission.target ? ' · mission complete' : ''}</p>
      </section>

      <section class="mt-16 ga-d" aria-labelledby="sq-react">
        <h2 id="sq-react" style="font-size:18px">Send a reaction</h2>
        <div class="chips mt-8">${reactionChoices.map((r) => `<button class="btn btn--sm btn--glass" type="button" data-action="squad-react" data-value="${esc(r)}">${esc(r)}</button>`).join('')}</div>
        ${reactions.length ? `<ul class="squad-feed mt-12">${reactions.slice(0, 8).map((r) => `<li><strong>${esc(r.nickname)}</strong> ${esc(r.reaction)} <span class="muted">· ${ago(r.at)}</span></li>`).join('')}</ul>` : ''}
      </section>

      <section class="card--lg glass mt-16 ga-e" aria-labelledby="sq-invite">
        <h2 class="card__title" id="sq-invite" style="font-size:18px">Invite friends</h2>
        <p class="small muted mt-4">Share the link, or the code to type in the Squad tab.</p>
        <div class="code-box"><span class="code-box__code" style="font-size:22px;letter-spacing:0.12em">${esc(squad.inviteCode || '')}</span>
          <button class="btn btn--sm btn--glass" type="button" data-action="squad-copy" aria-label="Copy squad code">${icon('copy')}</button></div>
        <button class="btn btn--cobalt mt-12" type="button" data-action="squad-share">${icon('share')} Share the invite</button>
      </section>

      <section class="ga-f">
        <h2 class="mt-20" style="font-size:18px">Members</h2>
        <div class="list glass mt-8">
          ${members.map((m) => `
            <${owner && !m.you ? `button type="button" data-action="squad-member" data-id="${esc(m.id)}" data-name="${esc(m.nickname)}"` : 'div'} class="list__item ${owner && !m.you ? '' : 'list__item--static'}">
              <span class="avatar ${m.you ? '' : 'avatar--ink'}">${esc(m.nickname[0])}</span>
              <span class="grow" style="font-weight:600">${esc(m.nickname)}${m.you ? ' (you)' : ''}${m.role === 'owner' ? ' <span class="tag">Owner</span>' : ''}</span>
              <span class="small muted">${m.rightThisWeek} right this week</span>
              ${owner && !m.you ? icon('chevron') : ''}
            </${owner && !m.you ? 'button' : 'div'}>`).join('')}
        </div>
        <div class="list glass mt-16">
          <button class="list__item" type="button" data-action="squad-report">${icon('flag')}<span class="grow">Report a member</span>${icon('chevron')}</button>
          ${owner ? `<button class="list__item" type="button" data-action="squad-reset">${icon('code')}<span class="grow">Reset the invite code<span class="small muted" style="display:block">The old code and links stop working</span></span></button>` : ''}
          <button class="list__item list__item--danger" type="button" data-action="squad-leave-ask">${icon('close')}<span class="grow">Leave the squad</span></button>
          ${owner ? `<button class="list__item list__item--danger" type="button" data-action="squad-close-ask">${icon('close')}<span class="grow">Close the squad for everyone</span></button>` : ''}
        </div>
      </section>
      </div>
    </div>
  </div>`;
}

/** Owner: one member's actions. */
export function squadMemberSheet({ name }) {
  return `
  <div class="scrim" data-action="close-sheet">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sm-title" data-stop>
      <div class="sheet__handle"></div>
      <h2 class="sheet__title" id="sm-title">${esc(name)}</h2>
      <div class="btn-row mt-20" style="flex-direction:column">
        <button class="btn btn--line" type="button" data-action="squad-make-owner">Make ${esc(name)} the owner</button>
        <button class="btn btn--danger" type="button" data-action="squad-remove">Remove from the squad</button>
      </div>
      <p class="small muted mt-12">Someone you remove cannot join again with the code.</p>
    </div>
  </div>`;
}

/** Leave or close: ask first. */
export function squadConfirmSheet({ kind, name, owner, members }) {
  const close = kind === 'close';
  const text = close ? `${esc(name)} closes for all ${members} members. Its table and mission end. This cannot be undone.`
    : owner && members > 1 ? 'You run this squad. The member who joined first after you becomes the owner.'
    : members === 1 ? 'You are the last member, so the squad closes.' : 'You can join again later with the invite code.';
  return `
  <div class="scrim" data-action="close-sheet">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sc-title" data-stop>
      <div class="sheet__handle"></div>
      <h2 class="sheet__title" id="sc-title">${close ? 'Close the squad?' : `Leave ${esc(name)}?`}</h2>
      <p class="muted mt-8">${text}</p>
      <div class="btn-row mt-20">
        <button class="btn btn--line" type="button" data-action="close-sheet">Keep it</button>
        <button class="btn btn--danger" type="button" data-action="${close ? 'squad-close' : 'squad-leave'}">${close ? 'Close it' : 'Leave'}</button>
      </div>
    </div>
  </div>`;
}
