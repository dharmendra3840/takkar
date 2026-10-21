import { esc, blobs, tabbar, icon } from '../ui.js';

const initials = (name) => esc(name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase());

function hoursLeft(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** The educator's league as students would see it, updated live as the name is typed (main.js). */
export function leaguePreview(name, code) {
  const shown = (name || '').trim() || 'Your channel';
  const sample = [['Priya', 92], ['Arjun', 88], ['Sana', 81]];
  return `
    <aside class="league-preview ga-b" aria-label="Preview of your league">
      <div class="eyebrow">Preview: what your students see</div>
      <section class="feature mt-8">
        <div class="feature__glow feature__glow--a"></div><div class="feature__glow feature__glow--b"></div>
        <div class="row">
          <span class="avatar avatar--lg" style="border-radius:16px" id="lp-initials">${initials(shown)}</span>
          <div class="grow"><h2 style="font-size:22px;line-height:1.1"><span id="lp-name">${esc(shown)}</span> League</h2><div class="small" style="color:#D7DBF5">Exam level · invite only</div></div>
        </div>
        <div class="small mt-16" style="color:#D7DBF5;font-weight:600">Invite code</div>
        <div class="lp-code" id="lp-code">${esc(code)}</div>
        <div class="lp-table mt-12">
          ${sample.map(([n, sc], i) => `<div class="lp-row"><span class="lp-rank">${i + 1}</span><span class="avatar avatar--ink" style="width:28px;height:28px;font-size:12px">${n[0]}</span><span class="grow">${n}</span><strong>${sc}</strong></div>`).join('')}
        </div>
      </section>
      <section class="card--lg tint mt-12">
        <div class="row row--between"><h3 class="card__title" style="font-size:18px">Your Monday report</h3><span class="tag">Every week</span></div>
        <div class="stats mt-12">
          <div class="stat" style="background:rgba(255,255,255,0.75)"><div class="stat__label">Members</div><div class="stat__value">24</div></div>
          <div class="stat" style="background:rgba(255,255,255,0.75)"><div class="stat__label">Played</div><div class="stat__value">68%</div></div>
          <div class="stat" style="background:rgba(255,255,255,0.75)"><div class="stat__label">Avg score</div><div class="stat__value">21.5</div></div>
        </div>
        <p class="small muted mt-12">Weakest topics this week: <strong>Time and work</strong>, <strong>Syllogisms</strong>. Plan your next class around them.</p>
      </section>
    </aside>`;
}

export function leagueIntro({ name, error, code }) {
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body">
      <div class="dgrid dgrid--league-intro">
      <div class="ga-a">
      <span class="tag tag--saffron">For educators and channels</span>
      <h1 class="title mt-12">Run a private league for your students.</h1>
      <p class="muted mt-12">Type your channel’s name to see what your students would get: a branded league, one shared daily duel, a weekly table and a Monday report.</p>

      <form class="glass mt-20" style="border-radius:28px;overflow:hidden" data-form="league" novalidate>
        <div class="field">
          <label for="channel">Channel or batch name</label>
          <input id="channel" name="channel" type="text" maxlength="30" autocomplete="off" placeholder="For example: SSC Maths with Rahul" value="${esc(name || '')}" data-input="channel">
          <p class="field__error" role="alert">${esc(error || '')}</p>
        </div>
      </form>
      <button class="btn btn--saffron mt-16" type="button" data-action="create-league">Create the demo league</button>

      <ul class="league-points mt-20">
        <li><span class="league-points__icon">${icon('code')}</span><span><strong>One daily duel for everyone.</strong> The same ten questions for every student, new at midnight.</span></li>
        <li><span class="league-points__icon">${icon('check')}</span><span><strong>No work for you.</strong> Exam marking and full solutions, worked out automatically.</span></li>
        <li><span class="league-points__icon">${icon('squad')}</span><span><strong>Private and safe.</strong> You approve who joins and see nicknames and scores only.</span></li>
        <li><span class="league-points__icon">${icon('league')}</span><span><strong>Free during the pilot.</strong> No card, no contract.</span></li>
      </ul>
      </div>
      ${leaguePreview(name, code)}
      </div>
    </div>
    ${tabbar('league')}
  </div>`;
}

export function leagueScreen({ league, played, table, report, msLeft, you }) {
  const top = table.slice(0, 8);
  const youRow = table.find((r) => r.you);
  const rows = (youRow && youRow.rank > 8 ? [...top, youRow] : top).map((r) => `
    <div class="rank-row ${r.you ? 'rank-row--you' : ''}">
      <span class="rank-row__n">${r.rank}</span>
      <span class="avatar ${r.you ? '' : 'avatar--ink'}" style="width:32px;height:32px;font-size:13px">${esc(r.name[0])}</span>
      <span class="grow" style="font-weight:600">${esc(r.name)}${r.you ? ' (you)' : ''}<span class="small muted" style="display:block;font-weight:400">${r.played} of 7 daily duels</span></span>
      <span class="rank-row__score">${r.total}</span>
    </div>`).join('');

  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body">
      <div class="dgrid dgrid--league">
      <section class="feature ga-a" aria-label="League">
        <div class="feature__glow feature__glow--a"></div><div class="feature__glow feature__glow--b"></div>
        <div class="row">
          <span class="avatar avatar--lg" style="border-radius:16px">${initials(league.channel)}</span>
          <div class="grow"><h1 style="font-size:24px;line-height:1.1">${esc(league.channel)} League</h1><div class="small" style="color:#D7DBF5">Exam level · you approve who joins</div></div>
        </div>
        <div class="small mt-16" style="color:#D7DBF5;font-weight:600">Invite code for your students</div>
        <div class="row row--wrap mt-8">
          <span class="grow league-code" style="font-family:var(--display);font-weight:800;font-size:clamp(24px, 7vw, 30px);letter-spacing:0.06em">${esc(league.code)}</span>
          <button class="btn btn--sm btn--ghost-dark" type="button" data-action="copy-league" aria-label="Copy invite code">${icon('copy')}</button>
          <button class="btn btn--sm btn--white" type="button" data-action="share-league">${icon('share')} Share</button>
        </div>
      </section>

      <section class="card--lg glass mt-12 ga-b" aria-labelledby="daily-title">
        <div class="row row--between"><h2 class="card__title" id="daily-title" style="font-size:20px">Today’s daily duel</h2><span class="tag">New in ${hoursLeft(msLeft)}</span></div>
        ${played
          ? `<p class="mt-8">You scored <strong>${played.score}</strong> out of 40. Only your first attempt counts for the table.</p>
             <button class="btn btn--glass mt-12" type="button" data-action="play-league">Practise again (won’t count)</button>`
          : `<p class="muted mt-8">The same ten questions for every member today. Your first attempt counts.</p>
             <button class="btn btn--cobalt mt-12" type="button" data-action="play-league">Play today’s duel</button>`}
      </section>

      <section class="mt-16 ga-c" aria-labelledby="table-title">
        <div class="row row--between"><h2 id="table-title" style="font-size:22px">This week’s table</h2><span class="small muted">Monday to Sunday</span></div>
        <div class="list tint mt-8">${rows}</div>
        <p class="small muted mt-8">Sample students for the demo. A real league shows only members who joined with your code.</p>
      </section>

      <section class="card--lg tint mt-16 ga-d" aria-labelledby="report-title">
        <h2 class="card__title" id="report-title" style="font-size:20px">Monday report preview</h2>
        <div class="stats mt-12">
          <div class="stat" style="background:rgba(255,255,255,0.7)"><div class="stat__label">Members</div><div class="stat__value">${report.members}</div></div>
          <div class="stat" style="background:rgba(255,255,255,0.7)"><div class="stat__label">Played today</div><div class="stat__value">${report.participation}%</div></div>
          <div class="stat" style="background:rgba(255,255,255,0.7)"><div class="stat__label">Avg score</div><div class="stat__value">${report.average}</div></div>
        </div>
        <h3 class="mt-16" style="font-size:16px;font-family:var(--body);font-weight:600;color:#3F4670;letter-spacing:0">Weakest topics this week</h3>
        ${report.weakest.map((w) => `
          <div class="bar-row mt-8"><span class="bar-row__label" style="width:150px">${esc(w.label)}</span>
            <div class="progress grow"><div class="progress__bar" style="width:${w.accuracy}%;background:#FF6A00"></div></div>
            <span class="bar-row__val">${w.accuracy}%</span></div>`).join('')}
        <p class="small muted mt-12">You see nicknames and scores only. Never emails or phone numbers.</p>
      </section>

      <div class="list glass mt-16 ga-e">
        <button class="list__item" type="button" data-action="toast" data-text="In the full app you approve each student before they join.">${icon('squad')}<span class="grow">Approve members</span><span class="tag">On</span></button>
        <button class="list__item" type="button" data-action="toast" data-text="In the full app, resetting makes the old code stop working.">${icon('code')}<span class="grow">Reset invite code</span>${icon('chevron')}</button>
        <button class="list__item list__item--danger" type="button" data-action="close-league">${icon('close')}<span class="grow">Close this demo league</span></button>
      </div>
      <p class="small muted mt-12 center ga-f">Invite pages repeat the 18 and over rule, and every student confirms their age.</p>
      </div>
    </div>
    ${tabbar('league')}
  </div>`;
}
