import { esc, blobs, tabbar, leagueSwitch, num } from '../ui.js?v=2690a021b3';

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
