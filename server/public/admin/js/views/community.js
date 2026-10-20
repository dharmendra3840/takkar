// Leagues, educator approval (ADMIN-10, LEAG-08) and squads.
import { get, post, esc, num, ago, dateOnly, ask, toast, onActions, can } from '../core.js';

const LEAGUE_BADGE = { live: 'badge--good', pending: 'badge--warn', closed: 'badge--bad' };

export async function renderLeagues(root, { query }) {
  const status = query.get('status') || '';
  const q = query.get('q') || '';
  const [leagues, edu] = await Promise.all([
    get(`/leagues?status=${status}&q=${encodeURIComponent(q)}`),
    can('educators.decide') ? get('/educators') : Promise.resolve(null),
  ]);
  const reload = () => renderLeagues(root, { query });

  root.innerHTML = `
    <div class="topbar"><div><h1>Leagues and educators</h1><p>Check a channel is real and active before approving. Share the pilot agreement before a league goes live.</p></div></div>
    ${edu ? `<section class="panel"><div class="panel-head"><h2>Educators waiting (${edu.requests.length})</h2><p>Approving makes them an educator and puts their leagues live.</p></div>
      ${edu.requests.length ? `<div class="table-wrap"><table><thead><tr><th>Channel</th><th>Player</th><th class="num">Followers</th><th>Note</th><th>Asked</th><th></th></tr></thead><tbody>
        ${edu.requests.map((r) => `<tr data-id="${esc(r.id)}"><td><strong>${esc(r.channel_name)}</strong>${r.channel_url ? `<div class="small"><a href="${esc(r.channel_url)}" target="_blank" rel="noopener noreferrer">${esc(r.channel_url)}</a></div>` : ''}</td>
          <td><a href="#/players/${esc(r.user_id)}">${esc(r.nickname)}</a><div class="muted small">joined ${esc(dateOnly(r.joined_at))}</div></td>
          <td class="num">${num(r.followers)}</td><td class="small">${esc(r.note || '')}</td><td class="nowrap">${esc(ago(r.created_at))}</td>
          <td class="nowrap"><button class="btn btn--sm btn--primary" data-act="edu" data-decision="approve">Approve</button> <button class="btn btn--sm btn--danger" data-act="edu" data-decision="reject">Reject</button></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">No educators waiting.</p>'}</section>` : ''}
    <section class="panel">
      <form class="toolbar" id="lf">
        <input class="input search" name="q" type="search" placeholder="League name or invite code" value="${esc(q)}" aria-label="Search leagues">
        <select class="input" name="status" aria-label="Status">${[['', 'All leagues'], ['live', 'Live'], ['pending', 'Waiting'], ['closed', 'Closed']].map(([v, l]) => `<option value="${v}" ${v === status ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <button class="btn btn--primary" type="submit">Filter</button>
      </form>
      <div class="table-wrap"><table><thead><tr><th>League</th><th>Educator</th><th>Status</th><th class="num">Members</th><th class="num" title="Waiting to join">Waiting</th><th class="num" title="Played in the last 7 days">Active (7 d)</th><th class="num" title="Open reports">Reports</th><th>Created</th><th></th></tr></thead>
      <tbody>${leagues.leagues.map((l) => `<tr data-id="${esc(l.id)}" data-name="${esc(l.name)}">
        <td><strong>${esc(l.name)}</strong><div class="muted small mono">${esc(l.invite_code)}</div></td>
        <td><a href="#/players/${esc(l.owner_id)}">${esc(l.owner_nickname)}</a></td>
        <td><span class="badge ${LEAGUE_BADGE[l.status]}">${esc(l.status)}</span>${l.closed_reason ? `<div class="muted small">${esc(l.closed_reason)}</div>` : ''}</td>
        <td class="num">${num(l.members)}</td><td class="num">${num(l.waiting)}</td><td class="num">${num(l.active_week)}</td>
        <td class="num">${l.open_reports ? `<span class="badge badge--saffron">${l.open_reports}</span>` : '0'}</td>
        <td class="nowrap">${esc(dateOnly(l.created_at))}</td>
        <td class="nowrap">${l.status !== 'closed' && can('leagues.close') ? '<button class="btn btn--sm btn--danger" data-act="league" data-status="closed">Close</button>' : ''}
          ${l.status !== 'live' && can('educators.decide') ? `<button class="btn btn--sm" data-act="league" data-status="live">${l.status === 'pending' ? 'Approve' : 'Reopen'}</button>` : ''}</td>
      </tr>`).join('') || '<tr><td colspan="9" class="empty">No leagues.</td></tr>'}</tbody></table></div>
    </section>`;

  root.querySelector('#lf').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    location.hash = `#/leagues?status=${f.get('status')}&q=${encodeURIComponent(f.get('q').trim())}`;
  });
  onActions(root, {
    edu: (el) => {
      const r = edu.requests.find((x) => x.id === el.closest('[data-id]').dataset.id);
      const ok = el.dataset.decision === 'approve';
      ask({
        title: `${ok ? 'Approve' : 'Reject'} ${r.channel_name}`,
        lead: ok ? 'Their waiting leagues go live. Send them the pilot agreement.' : '',
        confirm: ok ? 'Approve' : 'Reject', danger: !ok,
        run: (v) => post(`/educators/${encodeURIComponent(r.id)}/decide`, { decision: el.dataset.decision, reason: v.reason }),
      }).then((d) => { if (d) { toast(ok ? 'Educator approved' : 'Request rejected'); reload(); } });
    },
    league: (el) => {
      const row = el.closest('[data-id]');
      const closing = el.dataset.status === 'closed';
      ask({
        title: `${closing ? 'Close' : 'Open'} ${row.dataset.name}`,
        lead: closing ? 'Members see a notice instead of the daily duel. Tell the educator why.' : '',
        confirm: closing ? 'Close league' : 'Make it live', danger: closing,
        run: (v) => post(`/leagues/${encodeURIComponent(row.dataset.id)}/status`, { status: el.dataset.status, reason: v.reason }),
      }).then((d) => { if (d) { toast('League updated'); reload(); } });
    },
  });
}

export async function renderSquads(root, { query }) {
  const q = query.get('q') || '';
  const { squads } = await get(`/squads?q=${encodeURIComponent(q)}`);
  root.innerHTML = `
    <div class="topbar"><div><h1>Squads</h1><p>Invite-only groups of up to 8. Members talk only through preset reactions.</p></div></div>
    <section class="panel">
      <form class="toolbar" id="sf"><input class="input search" name="q" type="search" placeholder="Squad name" value="${esc(q)}" aria-label="Search squads"><button class="btn btn--primary" type="submit">Search</button></form>
      <div class="table-wrap"><table><thead><tr><th>Squad</th><th>Owner</th><th>Status</th><th class="num">Members</th><th class="num">Reactions sent</th><th class="num">Open reports</th><th>Created</th><th></th></tr></thead>
      <tbody>${squads.map((s) => `<tr data-id="${esc(s.id)}" data-name="${esc(s.name)}"><td><strong>${esc(s.name)}</strong></td><td><a href="#/players/${esc(s.owner_id)}">${esc(s.owner_nickname)}</a></td>
        <td><span class="badge ${s.status === 'active' ? 'badge--good' : 'badge--bad'}">${esc(s.status)}</span></td><td class="num">${num(s.members)}</td><td class="num">${num(s.reactions)}</td>
        <td class="num">${s.open_reports ? `<span class="badge badge--saffron">${s.open_reports}</span>` : '0'}</td><td class="nowrap">${esc(dateOnly(s.created_at))}</td>
        <td>${s.status === 'active' && can('squads.close') ? '<button class="btn btn--sm btn--danger" data-act="close">Close</button>' : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">No squads.</td></tr>'}</tbody></table></div>
    </section>`;
  root.querySelector('#sf').addEventListener('submit', (e) => { e.preventDefault(); location.hash = `#/squads?q=${encodeURIComponent(new FormData(e.target).get('q').trim())}`; });
  onActions(root, {
    close: (el) => {
      const row = el.closest('[data-id]');
      ask({ title: `Close ${row.dataset.name}`, confirm: 'Close squad', danger: true, run: (v) => post(`/squads/${encodeURIComponent(row.dataset.id)}/close`, { reason: v.reason }) })
        .then((d) => { if (d) { toast('Squad closed'); renderSquads(root, { query }); } });
    },
  });
}
