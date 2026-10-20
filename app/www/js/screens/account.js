import { esc, blobs, tabbar, icon, initial } from '../ui.js';

// Honest paywall: price, renewal and cancel shown before paying; Not now as big as Buy.
export function plusScreen({ plus, reason }) {
  const benefits = ['Unlimited duels every day', 'Accuracy and speed by topic', '2 rest days a month for your streak', 'Squad themes and badges'];
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body screen__body--full">
      <div class="row"><button class="icon-btn glass" type="button" data-action="back" aria-label="Back">${icon('back')}</button></div>
      ${reason ? `<p class="notice mt-16">${esc(reason)}</p>` : ''}
      <div class="mt-20"><span style="font-family:var(--display);font-weight:800;font-size:22px">takkar</span> <span class="tag tag--saffron">plus</span></div>
      <h1 class="title mt-8">See where you lose time.</h1>
      <p class="muted mt-8">Plus never changes your score or your rank.</p>

      <div class="list glass mt-20">
        ${benefits.map((b) => `<div class="list__item list__item--static"><span class="avatar" style="width:30px;height:30px">${icon('check')}</span><span>${b}</span></div>`).join('')}
      </div>

      <div class="mt-auto" style="padding-top:24px">
        ${plus ? `
          <p class="notice" style="background:rgba(42,59,232,0.1);color:#2A3BE8">Plus is on in demo mode. No payment was taken.</p>
          <button class="btn btn--line mt-12" type="button" data-action="plus-off">Turn off demo Plus</button>
          <button class="btn btn--glass mt-12" type="button" data-action="back">Back</button>
        ` : `
          <div style="font-family:var(--display);font-weight:800;font-size:40px;line-height:1">₹99 <span style="font-size:18px;color:#3F4670;font-family:var(--body);font-weight:400">a month</span></div>
          <p class="small muted mt-8">Renews every month. Cancel any time in Profile. We email you 3 days before each renewal. Pay by UPI Autopay or card through Razorpay.</p>
          <button class="btn btn--cobalt mt-16" type="button" data-action="plus-on">Try Plus (demo, no payment)</button>
          <button class="btn btn--glass mt-12" type="button" data-action="back">Not now</button>
          <p class="small muted center mt-8">Payments are not switched on in this prototype.</p>
        `}
      </div>
    </div>
  </div>`;
}

export function profileScreen({ data, streak, stats, badges }) {
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

      <section class="card--lg glass mt-16 row">
        <span class="avatar avatar--lg">${initial(p.nickname)}</span>
        <div class="grow"><div style="font-family:var(--display);font-weight:800;font-size:22px">${esc(p.nickname)}</div>
          <div class="small muted">${data.plus ? 'Plus (demo)' : 'Free plan'}, ${streak} day streak · best ${data.streak.best}</div></div>
        <button class="btn btn--sm btn--saffron" type="button" data-action="go" data-to="plus">${data.plus ? 'Plus' : 'Try Plus'}</button>
      </section>

      <section class="card--lg tint mt-12" aria-labelledby="acc-title">
        <h2 class="card__title" id="acc-title">Accuracy by topic</h2>
        <div class="mt-12">${row('Quant', stats.quant)}${row('Reasoning', stats.reasoning)}</div>
      </section>

      <div class="badges mt-12">
        ${badges.map((b) => `<div class="badge tint ${b.earned ? '' : 'badge--locked'}"><div class="badge__icon">${esc(b.icon)}</div>${esc(b.label)}</div>`).join('')}
      </div>

      <div class="list glass mt-16">
        <label class="list__item" for="reminders">
          <span class="grow">Daily reminder<span class="small muted" style="display:block">Off by default. Never between 10 pm and 7 am.</span></span>
          <span class="switch"><input id="reminders" type="checkbox" ${data.settings.reminders ? 'checked' : ''} data-input="reminders"><span></span></span>
        </label>
        <button class="list__item" type="button" data-action="export-data">${icon('share')}<span class="grow">Download my data<span class="small muted" style="display:block">Everything Takkar keeps about you</span></span></button>
        <button class="list__item" type="button" data-action="report-problem">${icon('flag')}<span class="grow">Report a problem</span>${icon('chevron')}</button>
        <button class="list__item" type="button" data-action="open-url" data-url="https://takkar.info/privacy">${icon('chevron')}<span class="grow">Terms and Privacy notice</span></button>
        <button class="list__item list__item--danger" type="button" data-action="ask-delete">${icon('close')}<span class="grow">Delete my account and data</span></button>
      </div>
      <p class="small muted mt-12">Takkar keeps your nickname, scores, streak and squad on this phone, and nothing else. Deleting also cancels Plus.</p>
      <p class="small muted mt-8 center">Takkar prototype 0.1 · Not affiliated with any exam body</p>
    </div>
    ${tabbar('profile')}
  </div>`;
}

export function deleteSheet() {
  return `
  <div class="scrim" data-action="close-sheet">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="delete-title" data-stop>
      <div class="sheet__handle"></div>
      <h2 class="sheet__title" id="delete-title">Delete your account and data?</h2>
      <p class="muted mt-8">Your nickname, scores, streak, squad and league go from this phone at once. This cannot be undone.</p>
      <div class="btn-row mt-20">
        <button class="btn btn--line" type="button" data-action="close-sheet">Keep my account</button>
        <button class="btn btn--danger" type="button" data-action="confirm-delete">Delete</button>
      </div>
    </div>
  </div>`;
}
