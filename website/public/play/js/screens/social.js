import { esc, blobs, tabbar, icon, leagueSwitch, num } from '../ui.js?v=ffd6767078';
import { SQUAD } from '../demo.js?v=ffd6767078';

// SQUAD-01 to SQUAD-04: invite-only, up to 8, weekly mission, 6 preset reactions, no free text.
export function squadScreen({ members, done, daysLeft }) {
  const pct = Math.min(100, Math.round((done / SQUAD.target) * 100));
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body">
      <span class="eyebrow">Squad demo · real squads are coming soon</span>
      <h1 class="title mt-8">${SQUAD.name}</h1>
      <div class="row mt-12">
        <div class="row" style="gap:0">${members.map((m, i) => `<span class="avatar ${m.you ? '' : i % 2 ? 'avatar--saffron' : 'avatar--ink'}" style="${i ? 'margin-left:-8px;' : ''}border:3px solid #ECEFF8">${esc(m.name[0])}</span>`).join('')}</div>
        <span class="small muted">${members.length} of ${SQUAD.size} members</span>
      </div>

      <div class="dgrid dgrid--squad">
      <section class="feature mt-16 ga-a" aria-labelledby="mission-title">
        <div class="feature__glow feature__glow--a"></div>
        <div class="row row--between"><span class="small" style="color:#D7DBF5;font-weight:600">Weekly mission</span><span class="tag tag--dark">${daysLeft === 0 ? 'Last day' : `${daysLeft} days left`}</span></div>
        <h2 class="mt-8" id="mission-title" style="font-size:24px">${SQUAD.target} correct answers together</h2>
        <div class="progress progress--dark mt-12" style="height:12px"><div class="progress__bar" style="width:${pct}%;background:#4B5DFF"></div></div>
        <div class="row row--between mt-8 small" style="color:#D7DBF5"><span>${Math.min(done, SQUAD.target)} of ${SQUAD.target} done</span><span>${done >= SQUAD.target ? 'Badge earned' : 'Reward: squad badge'}</span></div>
      </section>

      <div class="ga-b">
      <h2 class="mt-20" style="font-size:20px">Send a reaction</h2>
      <div class="chips mt-8">${SQUAD.reactions.map((r) => `<button class="btn btn--sm btn--glass" type="button" data-action="react" data-value="${esc(r)}">${esc(r)}</button>`).join('')}</div>
      </div>

      <div class="list glass mt-16 ga-c">
        ${members.map((m) => `
          <div class="list__item list__item--static">
            <span class="avatar ${m.you ? '' : 'avatar--ink'}">${esc(m.name[0])}</span>
            <span class="grow" style="font-weight:600">${esc(m.name)}${m.you ? ' (you)' : ''}</span>
            <span class="small muted">${m.right} right</span>
          </div>`).join('')}
      </div>
      <p class="small muted mt-8 ga-d">Sample squad mates for the demo. Your correct answers this week are real.</p>

      <button class="btn btn--cobalt mt-16 ga-e" type="button" data-action="invite-squad">${icon('share')} Invite friends to Takkar</button>
      <div class="row row--between mt-8 ga-f">
        <button class="link-btn" type="button" data-action="toast" data-text="This is a demo squad. In real squads, a report goes to the Takkar team for review.">Report a member</button>
        <button class="link-btn" type="button" data-action="toast" data-text="This is a demo squad. In real squads you can leave at any time.">Leave squad</button>
      </div>
      </div>
    </div>
    ${tabbar('squad')}
  </div>`;
}

// RANK-01 and RANK-02: weekly ranks, reset Monday 00:00 IST, best 3 per day, never for sale.
export function ranksScreen({ board, rankedToday, exam }) {
  const [first, second, third] = board;
  const you = board.find((r) => r.you);
  const podium = (r, place, h) => r ? `
    <div class="podium__col">
      <span class="avatar ${r.you ? '' : 'avatar--ink'}" style="margin:0 auto">${esc(r.name[0])}</span>
      <div class="podium__name mt-8">${esc(r.name)}${r.you ? ' (you)' : ''}</div>
      <div class="podium__block ${place === 1 ? '' : 'tint'}" style="height:${h}px;${place === 1 ? 'background:#2A3BE8;color:#fff' : ''}">
        <div class="small" style="font-weight:600">${['1st', '2nd', '3rd'][place - 1]}</div>
        <div class="podium__score">${num(r.total)}</div>
      </div>
    </div>` : '';
  const rest = board.slice(3, 10);
  const showYou = you.rank > 10;
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body">
      ${leagueSwitch('ranks')}
      <span class="eyebrow">${exam ? `${esc(exam.short)} · ` : ''}Resets Monday at midnight</span>
      <h1 class="title mt-8">Ranks</h1>
      <p class="small muted mt-8">${exam ? `Players preparing for ${esc(exam.short)}. ` : ''}Exam level, exam marking. Your best 3 duels each day count. Ranks cannot be bought.</p>

      <div class="dgrid dgrid--ranks">
      <div class="podium mt-20 ga-a">${podium(second, 2, 96)}${podium(first, 1, 124)}${podium(third, 3, 80)}</div>

      <div class="list tint mt-16 ga-b">
        ${rest.map((r) => `<div class="rank-row ${r.you ? 'rank-row--you' : ''}"><span class="rank-row__n">${r.rank}</span><span class="grow" style="font-weight:600">${esc(r.name)}${r.you ? ' (you)' : ''}</span><span class="rank-row__score">${num(r.total)}</span></div>`).join('')}
        ${showYou ? `${you.rank > 11 ? `<div class="rank-row" style="justify-content:center;color:#3F4670;font-size:14px">${you.rank - 11} more player${you.rank === 12 ? '' : 's'} above you</div>` : ''}
        <div class="rank-row rank-row--you"><span class="rank-row__n">${you.rank}</span><span class="grow" style="font-weight:600">${esc(you.name)} (you)<span class="small muted" style="display:block;font-weight:400">${Math.max(0, 3 - rankedToday)} duels left to count today</span></span><span class="rank-row__score">${num(you.total)}</span></div>` : ''}
      </div>
      <p class="small muted mt-8 ga-c">Other players are samples for the demo. Your total is real.</p>
      <button class="btn btn--cobalt mt-16 ga-d" type="button" data-action="quick-ranked">Play to climb</button>
      </div>
    </div>
    ${tabbar('ranks')}
  </div>`;
}

/** Shown in place of the league or squad tab when the admin switches that feature off. */
export function featureOff(tab, title) {
  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body">
      ${tab === 'league' ? leagueSwitch('league') : ''}
      <h1 class="title mt-8">${title}</h1>
      <p class="notice mt-16">This part of Takkar is paused for a short while. Daily duels still work. Please check back soon.</p>
    </div>
    ${tabbar(tab)}
  </div>`;
}
