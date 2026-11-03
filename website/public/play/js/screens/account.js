import { esc, blobs, tabbar, icon, initial } from '../ui.js?v=8d95476540';
import { APP_VERSION, HERE, IS_NATIVE, SITE_URL, INSTAGRAM_URL, FACEBOOK_URL, TELEGRAM_URL } from '../config.js?v=8d95476540';

// Honest paywall: price, renewal and cancel shown before paying; Not now as big as Buy.
export function plusScreen({ plus, plusUntil, trialOpen, reason, freePerDay }) {
  const benefits = [`Unlimited duels every day (free: ${freePerDay} a day)`, 'Unlimited mini mocks (free: 1 a day)', 'Topic practice and challenges stay unlimited on the free plan'];
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full">
      <div class="row"><button class="icon-btn glass" type="button" data-action="back" aria-label="Back">${icon('back')}</button></div>
      ${reason ? `<p class="notice mt-16">${esc(reason)}</p>` : ''}
      <div class="mt-20"><span style="font-family:var(--display);font-weight:800;font-size:22px">takkar</span> <span class="tag tag--saffron">plus</span></div>
      <h1 class="title mt-8">More practice, when you want it.</h1>
      <p class="muted mt-8">Plus never changes your score or your rank.</p>

      <div class="list glass mt-20">
        ${benefits.map((b) => `<div class="list__item list__item--static"><span class="avatar" style="width:30px;height:30px">${icon('check')}</span><span>${b}</span></div>`).join('')}
      </div>

      <div class="mt-auto" style="padding-top:24px">
        ${plusUntil ? `
          <p class="notice" style="background:rgba(42,59,232,0.1);color:#2A3BE8">Plus is on, from the Takkar team, until ${esc(new Date(plusUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }))}.</p>
          <button class="btn btn--glass mt-12" type="button" data-action="back">Back</button>
        ` : plus ? `
          <p class="notice" style="background:rgba(42,59,232,0.1);color:#2A3BE8">Plus is on in demo mode. No payment was taken.</p>
          <button class="btn btn--line mt-12" type="button" data-action="plus-off">Turn off demo Plus</button>
          <button class="btn btn--glass mt-12" type="button" data-action="back">Back</button>
        ` : `
          <div style="font-family:var(--display);font-weight:800;font-size:34px;line-height:1">Coming soon</div>
          <p class="small muted mt-8">The price will be shared before Plus opens. Payments are not switched on in this beta, and nobody is charged.</p>
          ${trialOpen ? `<button class="btn btn--cobalt mt-16" type="button" data-action="plus-on">Try Plus free in the beta</button>
          <button class="btn btn--glass mt-12" type="button" data-action="back">Not now</button>` : `<button class="btn btn--glass mt-16" type="button" data-action="back">Back</button>`}
        `}
      </div>
    </div>
  </div>`;
}

function accountCard(account, signInReady) {
  if (!account || account.mode === 'guest') {
    return signInReady ? `
      <section class="card--lg tint mt-12 ga-b">
        <div class="card__title">Playing as a guest</div>
        <p class="small muted mt-8">Your games are kept on ${HERE} only. Sign in to keep them safe and play on any phone or computer.</p>
        <button class="btn btn--cobalt mt-12" type="button" data-action="go" data-to="welcome">Sign in to save progress</button>
      </section>` : `
      <section class="card--lg tint mt-12 ga-b">
        <div class="card__title">Playing as a guest</div>
        <p class="small muted mt-8">Your games are kept on ${HERE} only, so clearing ${IS_NATIVE ? 'the app’s data' : 'this site’s data'} removes them. Sign-in, to keep them on any device, isn’t available right now.</p>
      </section>`;
  }
  const how = account.mode === 'google' ? `Google · ${esc(account.email || '')}` : `Phone ending ${esc(account.phoneLast4 || '')}`;
  return `
    <section class="card--lg tint mt-12 row ga-b">
      <span class="grow"><span class="card__title" style="display:block">Signed in</span><span class="small muted">${how}. Your games are saved to your account.</span></span>
      <button class="btn btn--sm btn--line" type="button" data-action="ask-sign-out">Sign out</button>
    </section>`;
}

function examCard(exam, examMonth, goal) {
  if (!exam) return '';
  const when = examMonth ? new Date(`${examMonth}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'Date not set';
  return `
      <section class="card--lg tint mt-12 ga-b2">
        <div class="row">
          <span class="exam-card__badge" style="background:${exam.color}">${esc(exam.badge)}</span>
          <span class="grow"><span class="card__title" style="display:block">${esc(exam.name)}</span><span class="small muted">${esc(when)} · goal ${goal ? `${goal} a day` : 'not set'}</span></span>
        </div>
        <div class="btn-row mt-12">
          <button class="btn btn--sm btn--line" type="button" data-action="change-exam">Change exam</button>
          <button class="btn btn--sm btn--line" type="button" data-action="show-rules">Marking rules</button>
          <button class="btn btn--sm btn--line" type="button" data-action="change-goal">Goal</button>
        </div>
      </section>`;
}

export function profileScreen({ data, streak, stats, badges, plus, exam, examMonth, goal, signInReady, educator = '', isEducator = false }) {
  const p = data.profile;
  const row = (label, s) => {
    const acc = s && s.answered ? Math.round((s.right / s.answered) * 100) : null;
    const avg = s && s.answered ? (s.timeMs / s.answered / 1000).toFixed(1) : null;
    return `<div class="bar-row"><span class="bar-row__label">${label}</span>
      <div class="progress grow"><div class="progress__bar" style="width:${acc ?? 0}%"></div></div>
      <span class="bar-row__val">${acc === null ? '–' : acc + '%'}</span></div>
      ${avg ? `<p class="small muted" style="margin:2px 0 0 106px">${avg}s a question</p>` : ''}`;
  };
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body">
      <span class="eyebrow">Profile and privacy</span>
      <h1 class="title mt-8">You</h1>

      <div class="dgrid dgrid--profile">
      <section class="card--lg glass mt-16 row row--wrap profile-card ga-a">
        <span class="avatar avatar--lg">${initial(p.nickname)}</span>
        <div class="grow"><div class="nick-line" style="font-family:var(--display);font-weight:800;font-size:22px">${esc(p.nickname)} <button class="link-btn small" type="button" data-action="edit-nickname" aria-label="Change nickname" style="padding:0 0 0 6px;min-height:0;font-family:var(--body);font-weight:600;font-size:14px;vertical-align:middle">Change</button></div>
          ${data.account?.username ? `<div class="small muted">@${esc(data.account.username)} <button class="link-btn small" type="button" data-action="edit-username" aria-label="Change user ID" style="padding:0 0 0 4px;min-height:0;font-weight:600">Change</button></div>` : ''}
          <div class="small muted">${data.plus ? 'Plus (demo)' : plus ? 'Plus' : 'Free plan'}, ${streak} day streak · best ${data.streak.best}</div>
          ${isEducator ? '<span class="tag tag--cobalt mt-8">Verified educator</span>' : ''}</div>
        <button class="btn btn--sm btn--saffron" type="button" data-action="go" data-to="plus">${plus ? 'Plus' : 'Try Plus'}</button>
      </section>
      ${examCard(exam, examMonth, goal)}
      ${accountCard(data.account, signInReady)}

      <section class="card--lg tint mt-12 ga-c" aria-labelledby="acc-title">
        <h2 class="card__title" id="acc-title">Accuracy by topic</h2>
        <div class="mt-12">${row('Quant', stats.quant)}${row('Reasoning', stats.reasoning)}</div>
      </section>

      <div class="badges mt-12 ga-d">
        ${badges.map((b) => `<div class="badge tint ${b.earned ? '' : 'badge--locked'}"><div class="badge__icon">${esc(b.icon)}</div>${esc(b.label)}</div>`).join('')}
      </div>

      <div class="list glass mt-16 ga-e">
        ${educator}
        <label class="list__item" for="reminders">
          <span class="grow">Daily reminder<span class="small muted" style="display:block">Off by default. Never between 10 pm and 7 am.</span></span>
          <span class="switch"><input id="reminders" type="checkbox" ${data.settings.reminders ? 'checked' : ''} data-input="reminders"><span></span></span>
        </label>
        <button class="list__item" type="button" data-action="export-data">${icon('share')}<span class="grow">Download my data<span class="small muted" style="display:block">Everything Takkar keeps about you</span></span></button>
        <button class="list__item" type="button" data-action="open-url" data-url="${INSTAGRAM_URL}"><span class="social social--ig social--chip"><span class="social__icon">${icon('instagram')}</span></span><span class="grow">Follow on Instagram<span class="small muted" style="display:block">@playtakkar · news and updates</span></span>${icon('chevron')}</button>
        <button class="list__item" type="button" data-action="open-url" data-url="${FACEBOOK_URL}"><span class="social social--fb social--chip"><span class="social__icon">${icon('facebook')}</span></span><span class="grow">Follow on Facebook<span class="small muted" style="display:block">News and updates</span></span>${icon('chevron')}</button>
        <button class="list__item" type="button" data-action="open-url" data-url="${TELEGRAM_URL}"><span class="social social--tg social--chip"><span class="social__icon">${icon('telegram')}</span></span><span class="grow">Join on Telegram<span class="small muted" style="display:block">@playtakkar · daily updates and tips</span></span>${icon('chevron')}</button>
        <button class="list__item" type="button" data-action="open-report">${icon('flag')}<span class="grow">Report a problem or a player</span>${icon('chevron')}</button>
        <button class="list__item" type="button" data-action="open-url" data-url="${SITE_URL}/privacy">${icon('chevron')}<span class="grow">Terms and Privacy notice</span></button>
        <button class="list__item list__item--danger" type="button" data-action="ask-delete">${icon('close')}<span class="grow">Delete my account and data</span></button>
      </div>
      <p class="small muted mt-12 ga-f">${data.account && data.account.mode !== 'guest'
        ? `Takkar keeps your nickname, sign-in, scores and streak on your account, and a copy on ${HERE}. Deleting removes them everywhere and cancels Plus.`
        : `As a guest, Takkar keeps your nickname, scores and streak on ${HERE} only, and nothing else.`}</p>
      <p class="small muted mt-8 center ga-g">Takkar beta ${APP_VERSION} · Not affiliated with any exam body</p>
      </div>
    </div>
    ${tabbar('profile')}
  </div>`;
}

/** You → Change: a new nickname (signed-in players: checked by the server, once every 7 days). */
export function nicknameScreen({ value, error, busy, signedIn }) {
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full">
      <div class="row"><button class="icon-btn glass" type="button" data-action="back" aria-label="Back">${icon('back')}</button></div>
      <h1 class="title mt-16">Your nickname</h1>
      <p class="muted mt-8">Rivals, friends and leagues see this name. Letters and numbers, and it needn’t be unique${signedIn ? ': your user ID is. You can change it once every 7 days.' : '.'}</p>
      <form class="glass mt-20" style="border-radius:28px;overflow:hidden" data-form="nickname" novalidate>
        <div class="field">
          <label for="new-nick">Nickname</label>
          <input id="new-nick" name="nick" type="text" maxlength="12" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(value)}">
          <p class="field__error" id="new-nick-error" role="alert">${esc(error || '')}</p>
        </div>
      </form>
      <div class="mt-auto" style="padding-top:24px">
        <button class="btn btn--cobalt" type="button" data-action="nickname-save" ${busy ? 'disabled' : ''}>${busy ? 'Saving…' : 'Save nickname'}</button>
      </div>
    </div>
  </div>`;
}

export function signOutSheet() {
  return `
  <div class="scrim" data-action="close-sheet">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="out-title" data-stop>
      <div class="sheet__handle"></div>
      <h2 class="sheet__title" id="out-title">Sign out on ${HERE}?</h2>
      <p class="muted mt-8">Your games stay saved in your account. A copy stays on ${HERE} and you can go on as a guest.</p>
      <div class="btn-row mt-20">
        <button class="btn btn--line" type="button" data-action="close-sheet">Stay signed in</button>
        <button class="btn btn--cobalt" type="button" data-action="sign-out">Sign out</button>
      </div>
    </div>
  </div>`;
}

export function deleteSheet({ signedIn }) {
  return `
  <div class="scrim" data-action="close-sheet">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="delete-title" data-stop>
      <div class="sheet__handle"></div>
      <h2 class="sheet__title" id="delete-title">Delete your account and data?</h2>
      <p class="muted mt-8">${signedIn ? `Your account, nickname, scores and streak are deleted from Takkar’s server and from ${HERE} at once.` : `Your nickname, scores, streak, squad and league go from ${HERE} at once.`} This cannot be undone.</p>
      <div class="btn-row mt-20">
        <button class="btn btn--line" type="button" data-action="close-sheet">Keep account</button>
        <button class="btn btn--danger" type="button" data-action="confirm-delete">Delete</button>
      </div>
    </div>
  </div>`;
}

/** You → Change user ID: unique, checked by the server, once every 30 days (design/06-data-and-api.md §6.7). */
export function usernameScreen({ value, error, suggestion, busy }) {
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full">
      <div class="row"><button class="icon-btn glass" type="button" data-action="back" aria-label="Back">${icon('back')}</button></div>
      <h1 class="title mt-16">Your user ID</h1>
      <p class="muted mt-8">Only yours, so players can tell you apart from anyone with the same nickname. Small letters and numbers, like rohit12. You can change it once every 30 days.</p>
      <form class="glass mt-20" style="border-radius:28px;overflow:hidden" data-form="username" novalidate>
        <div class="field">
          <label for="new-uid">User ID</label>
          <input id="new-uid" name="uid" type="text" maxlength="15" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(value)}" data-input="uid-edit">
          <p class="field__error" id="new-uid-error" role="alert">${esc(error || '')}${suggestion ? ` <button class="link-btn" type="button" data-action="use-uid" data-value="${esc(suggestion)}">Use ${esc(suggestion)}</button>` : ''}</p>
        </div>
      </form>
      <div class="mt-auto" style="padding-top:24px">
        <button class="btn btn--cobalt" type="button" data-action="username-save" ${busy ? 'disabled' : ''}>${busy ? 'Saving…' : 'Save user ID'}</button>
      </div>
    </div>
  </div>`;
}
