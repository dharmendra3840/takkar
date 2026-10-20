// Audit log (ADMIN-08), admin accounts (owner only) and your own account.
import { get, post, api, esc, dateTime, ago, ask, toast, onActions, state } from '../core.js';

export async function renderAudit(root, { query }) {
  const params = new URLSearchParams();
  for (const k of ['action', 'admin', 'q', 'from', 'to', 'before']) if (query.get(k)) params.set(k, query.get(k));
  const data = await get(`/audit?${params}`);
  const val = (k) => esc(query.get(k) || '');

  root.innerHTML = `
    <div class="topbar"><div><h1>Audit log</h1><p>Every admin action, with who, when, what and why. Nobody can edit or delete it, including the owner.</p></div>
      <a class="btn" href="/admin/api/audit.csv?${esc(params.toString())}" download>Download CSV</a></div>
    <section class="panel">
      <form class="toolbar" id="af">
        <select class="input" name="action" aria-label="Action"><option value="">All actions</option>${data.actions.map((a) => `<option value="${esc(a)}" ${a === query.get('action') ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>
        <input class="input" name="admin" type="email" placeholder="Admin email" value="${val('admin')}" aria-label="Admin email">
        <input class="input search" name="q" type="search" placeholder="Search reasons, ids and details" value="${val('q')}" aria-label="Search">
        <input class="input" name="from" type="date" value="${val('from')}" aria-label="From">
        <input class="input" name="to" type="date" value="${val('to')}" aria-label="To">
        <button class="btn btn--primary" type="submit">Filter</button>
      </form>
      <div class="table-wrap"><table><thead><tr><th>When (IST)</th><th>Admin</th><th>Action</th><th>Target</th><th>Reason</th><th>Details</th></tr></thead>
      <tbody>${data.entries.map((e) => `<tr>
        <td class="nowrap">${esc(dateTime(e.at))}</td><td class="small">${esc(e.admin_email || 'system')}</td>
        <td><span class="badge">${esc(e.action)}</span></td>
        <td class="small">${e.target_type === 'player' ? `<a href="#/players/${esc(e.target_id)}">player</a>` : esc(e.target_type || '')} <span class="mono muted">${esc(e.target_id || '')}</span></td>
        <td>${esc(e.reason || '')}</td><td class="mono small muted" style="max-width:280px;word-break:break-word">${esc(e.details || '')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No entries match.</td></tr>'}</tbody></table></div>
      ${data.next ? '<div class="row mt-12"><button class="btn btn--sm" data-more>Older entries</button></div>' : ''}
    </section>`;

  root.querySelector('#af').addEventListener('submit', (e) => {
    e.preventDefault();
    const p = new URLSearchParams([...new FormData(e.target).entries()].filter(([, v]) => v));
    location.hash = `#/audit?${p}`;
  });
  root.querySelector('[data-more]')?.addEventListener('click', () => {
    const p = new URLSearchParams(query);
    p.set('before', data.next);
    location.hash = `#/audit?${p}`;
  });
}

function showInviteLink(path, email) {
  const url = `${location.origin}${path}`;
  return ask({
    title: 'Send this setup link', reason: false, confirm: 'Done',
    lead: `Send it to <strong>${esc(email)}</strong> privately (not in a group). It works once and expires in 48 hours. They set a password and scan a QR code with an authenticator app.`,
    fields: [{ name: 'link', label: 'Setup link', value: url }],
  });
}

export async function renderAdmins(root) {
  const { admins, you } = await get('/admins');
  const reload = () => renderAdmins(root);
  root.innerHTML = `
    <div class="topbar"><div><h1>Admins</h1><p>Give helpers a moderator account. Never share the owner login. Two-step sign-in is always on.</p></div>
      <button class="btn btn--primary" data-act="invite">Add an admin</button></div>
    <section class="panel">
      <div class="notice notice--info">Moderators handle players, reports and questions. They cannot see payments, data exports, switches, settings, the audit log or other admins.</div>
      <div class="table-wrap mt-12"><table><thead><tr><th>Admin</th><th>Role</th><th>Status</th><th>Last sign-in</th><th class="num">Open sessions</th><th></th></tr></thead>
      <tbody>${admins.map((a) => `<tr data-id="${esc(a.id)}" data-email="${esc(a.email)}" data-role="${esc(a.role)}">
        <td><strong>${esc(a.name)}</strong>${a.id === you ? ' <span class="badge badge--info">you</span>' : ''}<div class="muted small">${esc(a.email)}</div></td>
        <td><span class="badge ${a.role === 'owner' ? 'badge--saffron' : ''}">${esc(a.role)}</span></td>
        <td><span class="badge ${a.status === 'active' ? 'badge--good' : a.status === 'invited' ? 'badge--warn' : 'badge--bad'}">${esc(a.status === 'invited' ? 'setup pending' : a.status)}</span></td>
        <td class="nowrap">${esc(ago(a.last_login_at))}</td><td class="num">${a.sessions}</td>
        <td class="nowrap">${a.id === you ? '' : `
          ${a.status === 'invited' ? '<button class="btn btn--sm" data-act="reinvite">New setup link</button>' : ''}
          <button class="btn btn--sm" data-act="manage" data-action="change_role">${a.role === 'owner' ? 'Make moderator' : 'Make owner'}</button>
          ${a.status === 'active' ? '<button class="btn btn--sm" data-act="manage" data-action="sign_out">Sign out</button> <button class="btn btn--sm" data-act="manage" data-action="reset_2fa">Reset 2-step</button> <button class="btn btn--sm btn--danger" data-act="manage" data-action="disable">Disable</button>' : ''}
          ${a.status === 'disabled' ? '<button class="btn btn--sm" data-act="manage" data-action="enable">Enable</button>' : ''}`}</td></tr>`).join('')}</tbody></table></div>
    </section>`;

  onActions(root, {
    invite: () => ask({
      title: 'Add an admin', reason: false, confirm: 'Create setup link',
      fields: [
        { name: 'name', label: 'Name', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'role', label: 'Role', type: 'select', options: [['moderator', 'Moderator'], ['owner', 'Owner (full control)']], value: 'moderator' },
      ],
      run: (v) => post('/admins', { name: v.name.trim(), email: v.email.trim(), role: v.role }).then((r) => ({ ...r, email: v.email.trim() })),
    }).then((r) => { if (r) showInviteLink(r.invitePath, r.email).then(reload); }),
    reinvite: (el) => {
      const row = el.closest('[data-id]');
      post(`/admins/${encodeURIComponent(row.dataset.id)}/reinvite`).then((r) => showInviteLink(r.invitePath, row.dataset.email)).catch((e) => toast(e.message, 'error'));
    },
    manage: (el) => {
      const row = el.closest('[data-id]');
      const action = el.dataset.action;
      const newRole = row.dataset.role === 'owner' ? 'moderator' : 'owner';
      const titles = { change_role: `Make ${row.dataset.email} ${newRole === 'owner' ? 'an owner' : 'a moderator'}`, sign_out: `Sign ${row.dataset.email} out everywhere`, reset_2fa: `Reset 2-step sign-in for ${row.dataset.email}`, disable: `Disable ${row.dataset.email}`, enable: `Enable ${row.dataset.email}` };
      const leads = { reset_2fa: 'For a lost phone. Their password and authenticator are cleared; you get a new setup link to send them.', disable: 'They are signed out at once and cannot sign in until enabled.', change_role: newRole === 'owner' ? 'Owners can do everything, including payments, exports and adding admins.' : '' };
      ask({
        title: titles[action], lead: esc(leads[action] || ''), confirm: 'Confirm', danger: ['disable', 'reset_2fa'].includes(action),
        run: (v) => post(`/admins/${encodeURIComponent(row.dataset.id)}/manage`, { action, role: newRole, reason: v.reason }),
      }).then((r) => {
        if (!r) return;
        toast('Saved');
        if (r.invitePath) showInviteLink(r.invitePath, row.dataset.email).then(reload);
        else reload();
      });
    },
  });
}

export function renderAccount(root) {
  const a = state.admin;
  root.innerHTML = `
    <div class="topbar"><div><h1>Your account</h1><p>${esc(a.name)} · ${esc(a.email)} · ${esc(a.role)}</p></div></div>
    <section class="panel stack">
      <p>You are signed out after 30 minutes without activity, or 12 hours after signing in.</p>
      <p class="muted">Lost your phone or think someone else knows your password? Sign out everywhere now, then ask ${a.role === 'owner' ? 'another owner' : 'the owner'} to reset your 2-step sign-in.</p>
      <div class="row"><button class="btn btn--danger" data-act="all">Sign out on every device</button></div>
    </section>
    <section class="panel stack">
      <h2>Your security habits</h2>
      <ul class="muted" style="margin:0;padding-left:20px">
        <li>Use a password manager and a different password for every account.</li>
        <li>Keep your authenticator’s backup or recovery codes somewhere safe and offline.</li>
        <li>Never download player data to a personal laptop or phone.</li>
        <li>Never ask a player for a password or a payment detail.</li>
      </ul>
    </section>`;
  onActions(root, {
    all: () => api('POST', '/auth/logout-all', {}).then(() => { location.hash = '#/login'; location.reload(); }).catch((e) => toast(e.message, 'error')),
  });
}
