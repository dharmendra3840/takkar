// Players: search and filters, profile, every moderation action (ADMIN-03, MOD-04).
import { get, post, esc, num, dateTime, dateOnly, ago, rupees, playerStatusBadge, ask, toast, onActions, can, isFuture } from '../core.js';

export async function renderPlayers(root, { query }) {
  const q = query.get('q') || '';
  const status = query.get('status') || '';
  const sort = query.get('sort') || 'joined';
  const offset = Number(query.get('offset') || 0);
  const data = await get(`/players?q=${encodeURIComponent(q)}&status=${status}&sort=${sort}&offset=${offset}&limit=50`);

  const go = (params) => {
    const p = new URLSearchParams({ q, status, sort, offset: 0, ...params });
    location.hash = `#/players?${p}`;
  };

  root.innerHTML = `
    <div class="topbar"><div><h1>Players</h1><p>${num(data.total)} players match. Search by nickname, or paste an exact email or player id.</p></div></div>
    <section class="panel">
      <form class="toolbar" id="filters">
        <input class="input search" name="q" type="search" placeholder="Search nickname, email or id" value="${esc(q)}" aria-label="Search players">
        <select class="input" name="status" aria-label="Filter">
          ${[['', 'Everyone'], ['active', 'Active'], ['suspended', 'Suspended'], ['banned', 'Banned'], ['muted', 'Muted'], ['plus', 'Plus'], ['educator', 'Educators']].map(([v, l]) => `<option value="${v}" ${v === status ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <select class="input" name="sort" aria-label="Sort">
          ${[['joined', 'Newest first'], ['seen', 'Last seen'], ['nickname', 'Nickname A–Z']].map(([v, l]) => `<option value="${v}" ${v === sort ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <button class="btn btn--primary" type="submit">Search</button>
      </form>
      <div class="table-wrap"><table>
        <thead><tr><th>Player</th><th>Status</th><th class="num">Duels</th><th class="num">Open reports</th><th>Joined</th><th>Last seen</th></tr></thead>
        <tbody>${data.players.length ? data.players.map((p) => `
          <tr class="clickable" data-href="#/players/${esc(p.id)}">
            <td><a href="#/players/${esc(p.id)}"><strong>${esc(p.nickname)}</strong></a></td>
            <td>${playerStatusBadge(p)}</td>
            <td class="num">${num(p.duels)}</td>
            <td class="num">${p.open_reports ? `<span class="badge badge--saffron">${num(p.open_reports)}</span>` : '0'}</td>
            <td class="nowrap">${esc(dateOnly(p.created_at))}</td>
            <td class="nowrap">${esc(ago(p.last_seen_at))}</td>
          </tr>`).join('') : '<tr><td colspan="6" class="empty">No players match.</td></tr>'}</tbody>
      </table></div>
      <div class="row row--between mt-12">
        <span class="muted small">Showing ${num(data.total ? offset + 1 : 0)}–${num(Math.min(offset + data.players.length, data.total))} of ${num(data.total)}</span>
        <div class="row">
          <button class="btn btn--sm" data-page="${Math.max(0, offset - 50)}" ${offset === 0 ? 'disabled' : ''}>Previous</button>
          <button class="btn btn--sm" data-page="${offset + 50}" ${offset + 50 >= data.total ? 'disabled' : ''}>Next</button>
        </div>
      </div>
    </section>`;

  root.querySelector('#filters').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    go({ q: f.get('q').trim(), status: f.get('status'), sort: f.get('sort') });
  });
  root.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => go({ offset: b.dataset.page })));
  root.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('a')) location.hash = tr.dataset.href; }));
}

// Each action: label, fields to ask for, whether it is destructive, and who may do it.
export const PLAYER_ACTIONS = {
  warn: { label: 'Warn', perm: 'players.moderate', fields: [] },
  mute: { label: 'Mute reactions', perm: 'players.moderate', fields: [{ name: 'days', label: 'For how many days', type: 'number', value: 7, min: 1, max: 365 }] },
  unmute: { label: 'Unmute', perm: 'players.moderate', fields: [] },
  rename: { label: 'Rename', perm: 'players.moderate', fields: [{ name: 'nickname', label: 'New nickname (leave empty for a neutral default)', help: '3 to 12 letters or numbers. The word filter applies.' }] },
  reset_scores: { label: 'Reset scores', perm: 'players.moderate', danger: true, fields: [{ name: 'scope', label: 'Which scores', type: 'select', options: [['week', 'This week only'], ['all', 'All time']], value: 'week' }] },
  suspend: { label: 'Suspend', perm: 'players.moderate', danger: true, fields: [{ name: 'days', label: 'Days (leave empty to suspend until reviewed)', type: 'number', min: 1, max: 3650 }] },
  restore: { label: 'Restore', perm: 'players.moderate', fields: [] },
  ban: { label: 'Ban', perm: 'players.ban', danger: true, fields: [] },
  grant_plus: { label: 'Grant Plus', perm: 'money.grant', fields: [{ name: 'days', label: 'Days of Plus', type: 'number', value: 30, min: 1, max: 3650 }] },
  revoke_plus: { label: 'Remove granted Plus', perm: 'money.grant', fields: [] },
  delete_data: { label: 'Delete account and data', perm: 'players.delete', danger: true, fields: [], lead: 'This removes the nickname, email, duels, streak, squads and leagues at once and cannot be undone. Payment records stay as tax records. Any Plus subscription is cancelled first.' },
};

export function runPlayerAction(playerId, action, nickname, after) {
  const def = PLAYER_ACTIONS[action];
  return ask({
    title: `${def.label}: ${nickname}`,
    lead: def.lead ? esc(def.lead) : '',
    fields: def.fields,
    confirm: def.label,
    danger: !!def.danger,
    run: async (values) => {
      const body = { action, reason: values.reason };
      if (values.days !== undefined) body.days = values.days === '' ? null : Number(values.days);
      if (values.nickname) body.nickname = values.nickname.trim();
      if (values.scope) body.scope = values.scope;
      await post(`/players/${encodeURIComponent(playerId)}/actions`, body);
    },
  }).then((done) => { if (done) { toast(`${def.label}: done`); after && after(); } });
}

const KIND_LABEL = { solo: 'Solo', challenge: 'Challenge', league: 'League', rematch: 'Rematch' };

export async function renderPlayer(root, { id }) {
  const d = await get(`/players/${encodeURIComponent(id)}`);
  const p = d.player;
  const s = d.stats;
  const reload = () => renderPlayer(root, { id });
  const visible = (a) => can(PLAYER_ACTIONS[a].perm)
    && !(a === 'unmute' && !isFuture(p.muted_until))
    && !(a === 'mute' && isFuture(p.muted_until))
    && !(a === 'restore' && p.status === 'active')
    && !(a === 'suspend' && p.status !== 'active')
    && !(a === 'ban' && p.status === 'banned')
    && !(a === 'revoke_plus' && !isFuture(p.plus_until));
  const fast = d.speed.reduce((n, t) => n + t.under_1_5s, 0);
  const answered = d.speed.reduce((n, t) => n + t.n, 0);

  root.innerHTML = `
    <div class="topbar"><div>
      <a href="#/players" class="small">← All players</a>
      <h1 class="mt-8">${esc(p.nickname)}</h1>
      <p class="row mt-8">${playerStatusBadge(p)} <span class="muted small mono">${esc(p.id)}</span></p></div>
      ${can('players.export') ? '<a class="btn" data-act="export">Download data (JSON)</a>' : ''}
    </div>

    <section class="panel">
      <div class="panel-head"><h2>Actions</h2><p>Every action needs a reason and is kept in the audit log.</p></div>
      <div class="row">${Object.keys(PLAYER_ACTIONS).filter(visible).map((a) => `<button class="btn ${PLAYER_ACTIONS[a].danger ? 'btn--danger' : ''}" data-act="action" data-action="${a}">${esc(PLAYER_ACTIONS[a].label)}</button>`).join('')}</div>
    </section>

    <section class="panel">
      <dl class="facts">
        <div class="fact"><dt>Joined</dt><dd>${esc(dateOnly(p.created_at))}</dd></div>
        <div class="fact"><dt>Last seen</dt><dd>${esc(ago(p.last_seen_at))}</dd></div>
        <div class="fact"><dt>Sign-in</dt><dd>${esc(p.sign_in_method)}${p.email ? ` · ${esc(p.email)}` : ''}</dd></div>
        <div class="fact"><dt>Age confirmed</dt><dd>${esc(dateTime(p.age_confirmed_at))}</dd></div>
        <div class="fact"><dt>Duels</dt><dd>${num(s.total)} <span class="muted small">(${num(s.week)} this week, ${num(s.abandoned)} left)</span></dd></div>
        <div class="fact"><dt>Accuracy</dt><dd>${s.accuracy === null ? '–' : s.accuracy + '%'}</dd></div>
        <div class="fact"><dt>Average exam score</dt><dd>${s.avg_score === null ? '–' : Math.round(s.avg_score * 10) / 10}</dd></div>
        <div class="fact"><dt>Streak</dt><dd>${d.streak ? `${num(d.streak.current)} <span class="muted small">best ${num(d.streak.best)}</span>` : '–'}</dd></div>
        <div class="fact"><dt>Plus</dt><dd>${isFuture(p.plus_until) ? 'until ' + esc(dateOnly(p.plus_until)) : 'No'}</dd></div>
        <div class="fact"><dt>Reports filed</dt><dd>${num(s.reportsFiled)}</dd></div>
      </dl>
    </section>

    <div class="grid grid-2">
      <section class="panel">
        <div class="panel-head"><h2>Speed check</h2><p>MOD-03 flags answers under 1.5 s on harder questions.</p></div>
        ${answered ? `<p class="${fast / answered > 0.2 ? 'notice notice--bad' : 'muted'}">${num(fast)} of ${num(answered)} recent answers took under 1.5 seconds (${Math.round((fast / answered) * 100)}%).</p>` : '<p class="muted">No recent answers.</p>'}
        <div class="table-wrap mt-12"><table><thead><tr><th>Question type</th><th class="num">Answers</th><th class="num">Accuracy</th><th class="num">Avg time</th><th class="num">&lt;1.5 s</th></tr></thead>
        <tbody>${d.speed.map((t) => `<tr><td>${esc(t.template)}</td><td class="num">${num(t.n)}</td><td class="num">${t.accuracy === null ? '–' : Math.round(t.accuracy * 100) + '%'}</td><td class="num">${t.avg_ms ? (t.avg_ms / 1000).toFixed(1) + ' s' : '–'}</td><td class="num">${t.under_1_5s ? `<span class="badge badge--bad">${num(t.under_1_5s)}</span>` : '0'}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No answers yet.</td></tr>'}</tbody></table></div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Sanctions and reports</h2></div>
        ${d.sanctions.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Action</th><th>Reason</th><th>By</th></tr></thead><tbody>
          ${d.sanctions.map((x) => `<tr><td class="nowrap">${esc(dateTime(x.created_at))}</td><td><span class="badge">${esc(x.kind.replace('_', ' '))}</span></td><td>${esc(x.reason)}</td><td class="small muted">${esc(x.admin_email || '')}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="muted">No sanctions.</p>'}
        <h3 class="mt-16">Reports about this player</h3>
        ${d.reports.length ? d.reports.map((r) => `<p class="small mt-8"><span class="badge ${r.status === 'open' ? 'badge--saffron' : ''}">${esc(r.kind.replace('_', ' '))} · ${esc(r.status)}</span> ${esc(r.details || '')} <span class="muted">${esc(ago(r.created_at))}</span></p>`).join('') : '<p class="muted small mt-8">None.</p>'}
      </section>
    </div>

    <section class="panel">
      <div class="panel-head"><h2>Recent duels</h2><p>Reset duels no longer count for ranks or leagues.</p></div>
      <div class="table-wrap"><table><thead><tr><th>Started</th><th>Kind</th><th>Topic</th><th>Status</th><th class="num">Score</th><th class="num">Rival</th><th class="num">Right / wrong / skip</th><th class="num">Time</th><th>Counts</th></tr></thead>
      <tbody>${d.duels.map((x) => `<tr><td class="nowrap">${esc(dateTime(x.started_at))}</td><td>${esc(KIND_LABEL[x.kind] || x.kind)}</td><td>${esc(x.topic)}</td>
        <td>${x.status === 'finished' ? '<span class="badge badge--good">Finished</span>' : x.status === 'abandoned' ? '<span class="badge">Left</span>' : '<span class="badge badge--info">Playing</span>'}</td>
        <td class="num">${num(x.score)}</td><td class="num">${num(x.rival_score)}</td><td class="num">${x.right_count} / ${x.wrong_count} / ${x.skipped_count}</td>
        <td class="num">${Math.round(x.time_ms / 1000)} s</td><td>${x.scores_reset ? '<span class="badge badge--bad">Reset</span>' : x.counted ? 'Yes' : 'No'}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">No duels.</td></tr>'}</tbody></table></div>
    </section>

    <div class="grid grid-2">
      <section class="panel"><h2>Leagues</h2>${d.leagues.length ? d.leagues.map((l) => `<p class="mt-8">${esc(l.name)} <span class="badge">${esc(l.is_owner ? 'owner' : l.state)}</span> <span class="badge ${l.status === 'live' ? 'badge--good' : ''}">${esc(l.status)}</span></p>`).join('') : '<p class="muted mt-8">None.</p>'}</section>
      <section class="panel"><h2>Squads</h2>${d.squads.length ? d.squads.map((sq) => `<p class="mt-8">${esc(sq.name)} <span class="badge">${esc(sq.status)}</span></p>`).join('') : '<p class="muted mt-8">None.</p>'}</section>
    </div>

    ${d.payments ? `<section class="panel"><div class="panel-head"><h2>Payments</h2></div>
      ${d.payments.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Payment</th><th class="num">Amount</th><th class="num">Refunded</th><th>Status</th></tr></thead><tbody>
      ${d.payments.map((x) => `<tr><td>${esc(dateTime(x.created_at))}</td><td class="mono">${esc(x.provider_id || x.id)}</td><td class="num">${rupees(x.amount_paise)}</td><td class="num">${rupees(x.refunded_paise)}</td><td><span class="badge">${esc(x.status)}</span></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">No payments.</p>'}</section>` : ''}`;

  onActions(root, {
    action: (el) => runPlayerAction(p.id, el.dataset.action, p.nickname, () => {
      if (el.dataset.action === 'delete_data') location.hash = '#/players';
      else reload();
    }),
    export: async () => {
      try {
        const data = await get(`/players/${encodeURIComponent(p.id)}/export`);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `takkar-player-${p.id}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast('Data downloaded. The export is in the audit log.');
      } catch (e) { toast(e.message, 'error'); }
    },
  });
}
