// Shared pieces: API client, escaping, formatting, toasts and the reason dialog.

export const state = { admin: null, csrf: '', counts: {} };

// ---------- API ----------

export class ApiError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

let onSignedOut = () => {};
export const setSignedOutHandler = (fn) => { onSignedOut = fn; };

export async function api(method, path, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && state.csrf) headers['X-CSRF-Token'] = state.csrf;
  const res = await fetch(`/admin/api${path}`, {
    method, headers, credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const type = res.headers.get('Content-Type') || '';
  const data = type.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const err = new ApiError(res.status, data?.error || `Request failed (${res.status})`, data?.code);
    if (res.status === 401 && state.admin && !path.startsWith('/auth/')) onSignedOut(err.message);
    throw err;
  }
  return data;
}
export const get = (path) => api('GET', path);
export const post = (path, body = {}) => api('POST', path, body);

// ---------- Escaping and formatting (SEC-14: every value is escaped) ----------

export function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const IST = { timeZone: 'Asia/Kolkata' };
export function dateTime(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('en-IN', { ...IST, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export function dateOnly(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('en-IN', { ...IST, day: 'numeric', month: 'short', year: 'numeric' });
}
export function ago(iso) {
  if (!iso) return 'never';
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 0) return `in ${until(iso)}`;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
export function until(iso) {
  const s = Math.round((Date.parse(iso) - Date.now()) / 1000);
  if (s <= 0) return 'ended';
  if (s < 3600) return `${Math.ceil(s / 60)} min`;
  if (s < 86400) return `${Math.ceil(s / 3600)} h`;
  return `${Math.ceil(s / 86400)} days`;
}
export const rupees = (paise) => '₹' + (Number(paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const num = (n) => (n === null || n === undefined ? '–' : Number(n).toLocaleString('en-IN'));
export const pct = (n) => (n === null || n === undefined ? '–' : `${n}%`);
export const isFuture = (iso) => !!iso && Date.parse(iso) > Date.now();
export const istDayToDate = (day) => new Date(day * 86400000).toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' });

export function playerStatusBadge(p) {
  const out = [];
  if (p.status === 'suspended') out.push(`<span class="badge badge--bad">Suspended${p.suspended_until ? ' · ' + esc(until(p.suspended_until)) : ' until review'}</span>`);
  else if (p.status === 'banned') out.push('<span class="badge badge--bad">Banned</span>');
  else out.push('<span class="badge badge--good">Active</span>');
  if (isFuture(p.muted_until)) out.push(`<span class="badge badge--warn">Muted · ${esc(until(p.muted_until))}</span>`);
  if (isFuture(p.plus_until)) out.push('<span class="badge badge--info">Plus</span>');
  if (p.role === 'educator') out.push('<span class="badge badge--saffron">Educator</span>');
  return out.join(' ');
}

export const can = (permission) => {
  const a = state.admin;
  if (!a) return false;
  if (a.role === 'owner') return true;
  return ['overview.view', 'players.view', 'players.moderate', 'reports.view', 'reports.resolve', 'questions.view', 'questions.manage',
    'leagues.view', 'leagues.close', 'squads.view', 'squads.close', 'words.view', 'words.add'].includes(permission);
};

// ---------- Toasts ----------

export function toast(message, kind = 'ok') {
  let box = document.querySelector('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = `toast ${kind === 'error' ? 'toast--error' : ''}`;
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), kind === 'error' ? 6000 : 3500);
}

/**
 * Asks for the details of an action (always a reason, sometimes more), then runs it.
 * fields: [{ name, label, type: 'text'|'number'|'textarea'|'select'|'datetime-local', options, value, help, required }]
 * run(values) returns a promise; errors show inside the dialog.
 */
export function ask({ title, lead = '', fields = [], confirm = 'Confirm', danger = false, reason = true, run }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    const allFields = reason ? [...fields, { name: 'reason', label: 'Reason (kept in the audit log)', type: 'textarea', required: true, help: 'Write why. Players can appeal, and every action is reviewed.' }] : fields;
    dialog.innerHTML = `
      <form class="dialog" method="dialog" novalidate>
        <h2>${esc(title)}</h2>
        ${lead ? `<p class="lead">${lead}</p>` : ''}
        ${allFields.map((f, i) => `
          <label class="field"><span>${esc(f.label)}</span>
            ${f.type === 'textarea' ? `<textarea class="input" name="${f.name}" ${f.required ? 'required' : ''}>${esc(f.value || '')}</textarea>`
              : f.type === 'select' ? `<select class="input" name="${f.name}">${f.options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(f.value ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`
              : `<input class="input" name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" ${f.required ? 'required' : ''} ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''} ${i === 0 ? 'autofocus' : ''} autocomplete="off">`}
            ${f.help ? `<small>${esc(f.help)}</small>` : ''}
          </label>`).join('')}
        <p class="error" role="alert"></p>
        <div class="actions">
          <button class="btn" type="button" data-cancel>Cancel</button>
          <button class="btn ${danger ? 'btn--danger-solid' : 'btn--primary'}" type="submit">${esc(confirm)}</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    const form = dialog.querySelector('form');
    const error = dialog.querySelector('.error');
    const close = (value) => { dialog.close(); dialog.remove(); resolve(value); };
    dialog.querySelector('[data-cancel]').addEventListener('click', () => close(null));
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(null); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const values = Object.fromEntries(new FormData(form).entries());
      for (const f of allFields) {
        if (f.required && !String(values[f.name] || '').trim()) { error.textContent = `${f.label.replace(/ \(.*/, '')} is required.`; return; }
      }
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      error.textContent = '';
      try {
        const result = run ? await run(values) : values;
        close(result ?? true);
      } catch (err) {
        error.textContent = err.message;
        submit.disabled = false;
      }
    });
    dialog.showModal();
  });
}

/** Wires a click handler map onto a root element: data-act="name" buttons call handlers[name](el). */
export function onActions(root, handlers) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    const fn = handlers[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
}

export const LOGO = '<svg viewBox="0 0 40 32" aria-hidden="true"><circle cx="14" cy="16" r="11" fill="#4B5DFF"/><circle cx="26" cy="16" r="11" fill="#FF6A00"/><path d="M20 6.78 A11 11 0 0 0 20 25.22 A11 11 0 0 0 20 6.78 Z" fill="#FFFFFF"/></svg>';
