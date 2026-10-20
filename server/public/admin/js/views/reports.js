// Reports queue with one-tap actions (ADMIN-04). The decision table follows the admin manual.
import { get, post, esc, ago, dateTime, ask, toast, onActions, can, isFuture } from '../core.js';

const KINDS = {
  under_18: 'Says they are under 18',
  cheating: 'Suspected cheating',
  nickname: 'Offensive nickname',
  harassment: 'Harassment through reactions',
  squad_name: 'Squad name',
  league_name: 'League name',
  other: 'Other',
};

// Suggested actions per report kind, in the order the admin manual recommends.
const SUGGEST = {
  under_18: [['suspend', 'Suspend until reviewed', {}], ['delete_data', 'Delete account and data', { danger: true }]],
  cheating: [['reset_scores', 'Reset scores and warn', {}], ['suspend', 'Suspend', { days: true }], ['ban', 'Ban (automated play)', { danger: true }]],
  nickname: [['rename', 'Rename and warn', {}], ['suspend', 'Suspend 7 days (second offence)', { days: 7 }]],
  harassment: [['mute', 'Mute reactions 7 days', { days: 7 }], ['warn', 'Warn', {}]],
  squad_name: [['close_squad', 'Close the squad', {}], ['warn', 'Warn the owner', {}]],
  league_name: [['close_league', 'Close the league', {}], ['warn', 'Warn the educator', {}]],
  other: [['warn', 'Warn', {}], ['suspend', 'Suspend', { days: true }]],
};
const PERM = { suspend: 'players.moderate', reset_scores: 'players.moderate', rename: 'players.moderate', mute: 'players.moderate', warn: 'players.moderate', ban: 'players.ban', delete_data: 'players.delete', close_squad: 'squads.close', close_league: 'leagues.close' };

export async function renderReports(root, { query }) {
  const status = query.get('status') || 'open';
  const kind = query.get('kind') || '';
  const data = await get(`/reports?status=${status}&kind=${kind}`);
  const reload = () => renderReports(root, { query });

  root.innerHTML = `
    <div class="topbar"><div><h1>Reports</h1><p>Most severe first. Under-18 and cheating reports come before names.</p></div>
      <div class="seg" role="group" aria-label="Status">${['open', 'resolved', 'dismissed'].map((s) => `<button data-status="${s}" aria-pressed="${s === status}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div></div>
    ${status === 'open' ? `<div class="row">${Object.entries(KINDS).map(([k, l]) => `<button class="btn btn--sm" data-kind="${k === kind ? '' : k}" aria-pressed="${k === kind}" ${k === kind ? 'style="background:#fff;color:#0D1130"' : ''}>${esc(l)} · ${data.openByKind[k] || 0}</button>`).join('')}</div>` : ''}
    <section class="panel">
      ${data.reports.length ? data.reports.map((r) => `
        <article class="report" data-id="${esc(r.id)}">
          <div class="report__head">
            <span class="sev sev-${r.severity}" title="Severity ${r.severity}">${r.severity}</span>
            <strong>${esc(KINDS[r.kind] || r.kind)}</strong>
            ${r.target_nickname ? `<a href="#/players/${esc(r.target_user_id)}">${esc(r.target_nickname)}</a>` : ''}
            ${r.target_status && r.target_status !== 'active' ? `<span class="badge badge--bad">${esc(r.target_status)}</span>` : ''}
            ${isFuture(r.target_muted_until) ? '<span class="badge badge--warn">muted</span>' : ''}
            ${r.target_open_reports > 1 ? `<span class="badge badge--saffron">${r.target_open_reports} open reports</span>` : ''}
            ${r.target_sanctions ? `<span class="badge">${r.target_sanctions} past sanctions</span>` : ''}
            <span class="muted small report__meta">${r.reporter_nickname ? `by ${esc(r.reporter_nickname)}` : 'flagged by the system'} · ${esc(ago(r.created_at))}</span>
          </div>
          <p class="report__body">${esc(r.details || 'No details.')}</p>
          ${status === 'open' ? `<div class="report__actions">
            ${(SUGGEST[r.kind] || SUGGEST.other).filter(([a]) => can(PERM[a])).map(([a, label, o]) => `<button class="btn btn--sm ${o.danger ? 'btn--danger' : 'btn--primary'}" data-act="resolve" data-action="${a}" data-label="${esc(label)}" data-days="${o.days === true ? 'ask' : o.days || ''}">${esc(label)}</button>`).join('')}
            <button class="btn btn--sm" data-act="resolve" data-action="dismiss" data-label="Dismiss">Dismiss</button>
          </div>` : `<p class="report__body small">${esc(r.resolution || '')} · ${esc(r.resolved_by_email || '')} · ${esc(dateTime(r.resolved_at))}</p>`}
        </article>`).join('') : `<p class="empty">${status === 'open' ? 'No open reports. Nice.' : 'Nothing here yet.'}</p>`}
    </section>`;

  root.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/reports?status=${b.dataset.status}`; }));
  root.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/reports?status=open&kind=${b.dataset.kind}`; }));

  onActions(root, {
    resolve: (el) => {
      const report = data.reports.find((r) => r.id === el.closest('[data-id]').dataset.id);
      const action = el.dataset.action;
      const fields = [];
      if (el.dataset.days === 'ask') fields.push({ name: 'days', label: 'Days (leave empty to suspend until reviewed)', type: 'number', min: 1, max: 3650 });
      if (action === 'rename') fields.push({ name: 'nickname', label: 'New nickname (leave empty for a neutral default)' });
      if (action === 'reset_scores') fields.push({ name: 'scope', label: 'Which scores', type: 'select', options: [['week', 'This week only'], ['all', 'All time']], value: 'week' });
      const danger = ['delete_data', 'ban'].includes(action);
      ask({
        title: el.dataset.label,
        lead: `${esc(KINDS[report.kind])}${report.target_nickname ? ` · <strong>${esc(report.target_nickname)}</strong>` : ''}`,
        fields,
        confirm: el.dataset.label,
        danger,
        run: async (v) => {
          const body = { action, reason: v.reason };
          if (el.dataset.days && el.dataset.days !== 'ask') body.days = Number(el.dataset.days);
          if (v.days !== undefined) body.days = v.days === '' ? null : Number(v.days);
          if (v.nickname) body.nickname = v.nickname.trim();
          if (v.scope) body.scope = v.scope;
          await post(`/reports/${encodeURIComponent(report.id)}/resolve`, body);
        },
      }).then((done) => { if (done) { toast(action === 'dismiss' ? 'Report dismissed' : 'Done. The report is closed.'); reload(); } });
    },
  });
}
