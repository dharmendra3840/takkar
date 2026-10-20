// Switches (ADMIN-06), limits and price (ADMIN-07, PLUS-08), word filter (MOD-02), announcements (ADMIN-11).
import { get, post, esc, num, dateTime, ago, ask, toast, onActions, can, rupees } from '../core.js';

const SWITCH_HELP = {
  'switch.signups': 'Turn off when a bot wave is creating accounts.',
  'switch.duels': 'Turn off when scoring is wrong or the engine misbehaves.',
  'switch.squads': 'Turn off when abuse is spreading through squads.',
  'switch.leagues': 'Turn off when a league problem affects many players.',
  'switch.plus_purchases': 'Turn off when payments fail or charge wrongly.',
  'switch.ads': 'Rewarded ads, only if approved at Gate 2.',
};

const fmtValue = (key, value) => (key === 'price.plus_paise' ? rupees(value) : typeof value === 'boolean' ? (value ? 'On' : 'Off') : num(value));

export async function renderSettings(root) {
  const [s, words, ann] = await Promise.all([
    can('settings.view') ? get('/settings') : null,
    get('/words'),
    can('announcements.manage') ? get('/announcements') : null,
  ]);
  const reload = () => renderSettings(root);
  const set = s ? s.settings : {};
  const paused = set['switch.pause_all']?.value;

  root.innerHTML = `
    <div class="topbar"><div><h1>${s ? 'Switches and settings' : 'Word filter'}</h1><p>Changes reach players within 60 seconds and go to the audit log. Turn a switch back on only when the cause is fixed.</p></div></div>

    ${s ? `
    <section class="panel" style="${paused ? 'border-color:rgba(255,143,134,0.7)' : ''}">
      <div class="panel-head"><div><h2>Pause everything</h2><p>For a suspected security incident or data leak. Players see a status message.</p></div>
        <label class="row"><span class="${paused ? 'badge badge--bad' : 'muted'}">${paused ? 'Takkar is paused' : 'Running'}</span>
          <span class="switch switch--danger"><input type="checkbox" data-key="switch.pause_all" ${paused ? 'checked' : ''} aria-label="Pause everything"><span></span></span></label></div>
    </section>
    <section class="panel"><div class="panel-head"><h2>Feature switches</h2></div>
      <div class="table-wrap"><table><tbody>
        ${Object.keys(SWITCH_HELP).map((k) => `<tr><td><strong>${esc(set[k].label)}</strong><div class="muted small">${esc(SWITCH_HELP[k])}</div></td>
          <td class="small muted nowrap hide-sm">changed ${esc(ago(set[k].updatedAt))}</td>
          <td style="width:70px"><span class="switch"><input type="checkbox" data-key="${k}" ${set[k].value ? 'checked' : ''} aria-label="${esc(set[k].label)}"><span></span></span></td></tr>`).join('')}
      </tbody></table></div>
    </section>
    <section class="panel"><div class="panel-head"><h2>Limits and price</h2><p>The Plus price applies to new buyers only; existing subscribers keep theirs.</p></div>
      <div class="table-wrap"><table><tbody>
        ${['limit.free_duels_per_day', 'price.plus_paise', 'limit.league_max_members', 'limit.squad_max_members', 'flags.alert_after', 'flags.pause_after'].map((k) => `<tr data-key="${k}">
          <td><strong>${esc(set[k].label.replace(' (paise)', ''))}</strong></td><td class="num" style="font-size:18px;font-weight:600">${esc(fmtValue(k, set[k].value))}</td>
          <td class="small muted nowrap hide-sm">changed ${esc(ago(set[k].updatedAt))}</td><td style="width:90px"><button class="btn btn--sm" data-act="edit">Change</button></td></tr>`).join('')}
      </tbody></table></div>
    </section>` : ''}

    <div class="grid grid-2">
      <section class="panel"><div class="panel-head"><div><h2>Word filter</h2><p>English, Hindi and Hinglish. Blocks nicknames, squad and league names within 60 seconds.</p></div>
        ${can('words.add') ? '<button class="btn btn--primary" data-act="word">Add a word</button>' : ''}</div>
        <div class="row">${words.words.map((w) => `<span class="badge" title="added ${esc(dateTime(w.added_at))}">${esc(w.word)}${can('words.remove') ? ` <button class="btn btn--sm" style="min-height:20px;padding:0 6px;border:0" data-act="unword" data-word="${esc(w.word)}" aria-label="Remove ${esc(w.word)}">×</button>` : ''}</span>`).join('')}</div>
        <p class="muted small mt-12">${num(words.words.length)} words.</p>
      </section>
      ${ann ? `<section class="panel"><div class="panel-head"><div><h2>Announcement banner</h2><p>Shown to all players or one league (ADMIN-11).</p></div><button class="btn btn--primary" data-act="announce">New banner</button></div>
        ${ann.announcements.length ? ann.announcements.map((a) => `<div class="qsample" data-id="${esc(a.id)}"><div class="row row--between"><span class="badge ${a.active ? 'badge--good' : ''}">${a.active ? 'Showing' : 'Removed'} · ${a.scope === 'all' ? 'everyone' : esc(a.league_name || 'one league')}</span>
          ${a.active ? '<button class="btn btn--sm btn--danger" data-act="unannounce">Remove</button>' : ''}</div><p class="mt-8">${esc(a.text)}</p><p class="muted small mt-8">${esc(a.created_by_email || '')} · ${esc(dateTime(a.created_at))}</p></div>`).join('') : '<p class="muted">No banners yet.</p>'}
      </section>` : ''}
    </div>

    ${s ? `<section class="panel"><div class="panel-head"><h2>Change history</h2></div>
      <div class="table-wrap"><table><thead><tr><th>When</th><th>Setting</th><th>Value</th><th>By</th></tr></thead><tbody>
        ${s.history.map((h) => `<tr><td class="nowrap">${esc(dateTime(h.at))}</td><td>${esc(set[h.key]?.label?.replace(' (paise)', '') || h.key)}</td><td>${esc(fmtValue(h.key, h.value))}</td><td class="small muted">${esc(h.email || 'system')}</td></tr>`).join('')}
      </tbody></table></div></section>` : ''}`;

  root.querySelectorAll('input[data-key]').forEach((input) => input.addEventListener('change', () => {
    const key = input.dataset.key;
    const value = input.checked;
    input.checked = !value; // only flip after the change is saved
    const pause = key === 'switch.pause_all';
    ask({
      title: pause ? (value ? 'Pause everything' : 'Resume Takkar') : `${set[key].label}: turn ${value ? 'on' : 'off'}`,
      lead: pause && value ? 'Players will see a status message and nothing else works until you resume.' : '',
      confirm: pause ? (value ? 'Pause everything' : 'Resume') : `Turn ${value ? 'on' : 'off'}`,
      danger: !value || pause,
      run: (v) => post(`/settings/${encodeURIComponent(key)}`, { value, reason: v.reason }),
    }).then((d) => { if (d) { toast('Saved. Players see it within 60 seconds.'); reload(); } });
  }));

  onActions(root, {
    edit: (el) => {
      const key = el.closest('[data-key]').dataset.key;
      const rule = set[key];
      const isPrice = key === 'price.plus_paise';
      ask({
        title: `Change: ${rule.label.replace(' (paise)', '')}`,
        lead: isPrice ? 'New buyers pay this. Existing subscribers keep their price unless you announce a change in advance.' : '',
        fields: [{ name: 'value', label: isPrice ? 'Price in rupees a month' : 'New value', type: 'number', value: isPrice ? rule.value / 100 : rule.value, min: isPrice ? 1 : rule.min, max: isPrice ? rule.max / 100 : rule.max, required: true }],
        confirm: 'Save',
        run: (v) => post(`/settings/${encodeURIComponent(key)}`, { value: isPrice ? Math.round(Number(v.value) * 100) : Number(v.value), reason: v.reason }),
      }).then((d) => { if (d) { toast('Saved'); reload(); } });
    },
    word: () => ask({ title: 'Add a word to the filter', reason: false, confirm: 'Add word', fields: [{ name: 'word', label: 'Word', required: true, help: 'One word. Spellings with numbers (0 for o, 1 for i) are caught too.' }], run: (v) => post('/words', { word: v.word.trim() }) })
      .then((d) => { if (d) { toast('Word added'); reload(); } }),
    unword: (el) => ask({ title: `Remove “${el.dataset.word}”`, confirm: 'Remove', danger: true, run: (v) => post(`/words/${encodeURIComponent(el.dataset.word)}/remove`, { reason: v.reason }) })
      .then((d) => { if (d) { toast('Word removed'); reload(); } }),
    announce: () => ask({
      title: 'New announcement banner', reason: false, confirm: 'Show banner',
      fields: [
        { name: 'text', label: 'Text', type: 'textarea', required: true, help: 'Up to 200 characters. No promises of results.' },
        { name: 'scope', label: 'Who sees it', type: 'select', options: [['all', 'Everyone'], ['league', 'One league']], value: 'all' },
        { name: 'league', label: 'League invite code (only for one league)' },
      ],
      run: (v) => post('/announcements', { text: v.text.trim(), scope: v.scope, league: v.league.trim() }),
    }).then((d) => { if (d) { toast('Banner is showing'); reload(); } }),
    unannounce: (el) => post(`/announcements/${encodeURIComponent(el.closest('[data-id]').dataset.id)}/end`).then(() => { toast('Banner removed'); reload(); }).catch((e) => toast(e.message, 'error')),
  });
}
