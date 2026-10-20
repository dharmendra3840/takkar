// Question review: templates (keep, pause, retire), fresh samples, flags, hand-written drafts (ADMIN-05, QGEN-06, QGEN-07).
import { get, post, esc, num, ago, ask, toast, onActions, can } from '../core.js';

const STATUS_BADGE = { active: 'badge--good', paused: 'badge--warn', retired: 'badge--bad' };

export async function renderQuestions(root, { query }) {
  const tab = query.get('tab') || 'templates';
  root.innerHTML = `
    <div class="topbar"><div><h1>Questions</h1><p>3 flags in a day bring a template to the top; 10 pause it automatically. Hand-written items wait for approval.</p></div>
      <div class="seg" role="group" aria-label="View">${[['templates', 'Templates'], ['drafts', 'Hand-written drafts']].map(([t, l]) => `<button data-tab="${t}" aria-pressed="${t === tab}">${l}</button>`).join('')}</div></div>
    <div id="q-body"><p class="loading">Loading…</p></div>`;
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/questions?tab=${b.dataset.tab}`; }));
  const body = root.querySelector('#q-body');
  if (tab === 'drafts') return renderDrafts(body, query);
  return renderTemplates(body);
}

async function renderTemplates(root) {
  const { templates } = await get('/questions/templates');
  root.innerHTML = `
    <section class="panel"><div class="table-wrap"><table>
      <thead><tr><th>Template</th><th>Topic</th><th>Tiers</th><th>Status</th><th class="num">Open flags</th><th class="num">Flags 24 h</th><th class="num">Served</th><th class="num">Accuracy</th><th class="num">Avg time</th><th></th></tr></thead>
      <tbody>${templates.map((t) => `
        <tr>
          <td><strong>${esc(t.label)}</strong><div class="muted small mono">${esc(t.id)}</div></td>
          <td>${esc(t.topic)}</td>
          <td>${t.tiers.join(', ')}</td>
          <td><span class="badge ${STATUS_BADGE[t.status]}">${esc(t.status)}</span>${t.reason ? `<div class="muted small">${esc(t.reason)}</div>` : ''}</td>
          <td class="num">${t.flags_open ? `<span class="badge badge--saffron">${num(t.flags_open)}</span>` : '0'}</td>
          <td class="num">${num(t.flags_24h)}</td>
          <td class="num">${num(t.served)}</td>
          <td class="num">${t.accuracy === null ? '–' : Math.round(t.accuracy * 100) + '%'}</td>
          <td class="num">${t.avg_ms ? (t.avg_ms / 1000).toFixed(1) + ' s' : '–'}</td>
          <td><button class="btn btn--sm" data-act="review" data-id="${esc(t.id)}">Review</button></td>
        </tr>`).join('')}</tbody></table></div></section>
    <dialog id="review-dialog" style="max-width:min(820px, calc(100vw - 32px))"></dialog>`;

  onActions(root, { review: (el) => openReview(root, el.dataset.id, templates.find((t) => t.id === el.dataset.id)) });
}

async function openReview(root, id, t) {
  const dialog = root.querySelector('#review-dialog');
  const load = async () => {
    const s = await get(`/questions/templates/${encodeURIComponent(id)}/sample?n=4`);
    dialog.innerHTML = `
      <div class="dialog">
        <div class="row row--between"><h2>${esc(t.label)}</h2><span class="badge ${STATUS_BADGE[t.status]}">${esc(t.status)}</span></div>
        <p class="lead">Recalculate these fresh samples by hand. If the engine is wrong, retire the template and ask for a fix with a test.</p>
        ${s.samples.map((q) => `<div class="qsample"><strong>${esc(q.text)}</strong>
          <div class="options">${q.options.map((o, i) => `<div class="opt ${i === q.answerIndex ? 'opt--right' : ''}">${String.fromCharCode(65 + i)}. ${esc(o)}${i === q.answerIndex ? ' ✓' : ''}</div>`).join('')}</div>
          <ol>${q.steps.map((st) => `<li class="small">${esc(st)}</li>`).join('')}</ol></div>`).join('')}
        <h3 class="mt-16">Flags from players (${s.flags.length})</h3>
        ${s.flags.length ? s.flags.slice(0, 8).map((f) => `<p class="small mt-8"><span class="badge ${f.status === 'open' ? 'badge--saffron' : ''}">${esc(f.reason)}</span> ${esc(f.question_text)} <span class="muted">${esc(f.nickname || 'deleted player')} · ${esc(ago(f.created_at))}</span></p>`).join('') : '<p class="muted small mt-8">No flags.</p>'}
        <div class="actions">
          <button class="btn" data-close>Close</button>
          <button class="btn" data-more>New samples</button>
          ${can('questions.manage') ? `
            ${t.status !== 'active' || s.flags.some((f) => f.status === 'open') ? '<button class="btn btn--primary" data-set="active">Keep (answers are right)</button>' : ''}
            ${t.status !== 'paused' ? '<button class="btn" data-set="paused">Pause</button>' : ''}
            ${t.status !== 'retired' ? '<button class="btn btn--danger" data-set="retired">Retire</button>' : ''}` : ''}
        </div>
      </div>`;
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.querySelector('[data-more]').onclick = load;
    dialog.querySelectorAll('[data-set]').forEach((b) => { b.onclick = () => {
      const status = b.dataset.set;
      dialog.close();
      ask({
        title: `${{ active: 'Keep', paused: 'Pause', retired: 'Retire' }[status]} “${t.label}”`,
        lead: status === 'retired' ? 'A retired template is never served again (ADMIN-05).' : status === 'paused' ? 'Paused templates are not served until you keep them.' : 'Keeping closes its open flags.',
        confirm: { active: 'Keep', paused: 'Pause', retired: 'Retire' }[status],
        danger: status === 'retired',
        run: (v) => post(`/questions/templates/${encodeURIComponent(id)}/status`, { status, reason: v.reason }),
      }).then((done) => { if (done) { toast('Template updated'); renderTemplates(root); } });
    }; });
  };
  dialog.innerHTML = '<div class="dialog"><p class="loading">Generating samples…</p></div>';
  dialog.showModal();
  await load();
}

async function renderDrafts(root, query) {
  const status = query.get('status') || 'draft';
  const { drafts } = await get(`/questions/drafts?status=${status}`);
  root.innerHTML = `
    <section class="panel">
      <div class="panel-head"><div class="seg" role="group" aria-label="Draft status">${['draft', 'approved', 'rejected', 'retired'].map((s) => `<button data-st="${s}" aria-pressed="${s === status}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>
        ${can('questions.manage') ? '<button class="btn btn--primary" data-act="new">Write a question</button>' : ''}</div>
      <p class="notice notice--info">Hand-written questions (for General Awareness and English later) need a named source and an approval before they go live. Another admin approves a moderator’s draft.</p>
      ${drafts.length ? drafts.map((d) => `
        <div class="qsample mt-12" data-id="${esc(d.id)}">
          <div class="row row--between"><span class="badge">${esc(d.topic)}${d.label ? ' · ' + esc(d.label) : ''}</span><span class="muted small">${esc(d.created_by_email || '')} · ${esc(ago(d.created_at))}</span></div>
          <p class="mt-8"><strong>${esc(d.text)}</strong></p>
          <div class="options">${d.options.map((o, i) => `<div class="opt ${i === d.answer_index ? 'opt--right' : ''}">${String.fromCharCode(65 + i)}. ${esc(o)}${i === d.answer_index ? ' ✓' : ''}</div>`).join('')}</div>
          <p class="small mt-8">${esc(d.solution)}</p>
          <p class="small mt-8">${d.source ? `Source: ${esc(d.source)}` : '<span class="badge badge--warn">No source yet</span>'}</p>
          ${status === 'draft' && can('questions.manage') ? `<div class="row mt-12">
            ${!d.source ? '<button class="btn btn--sm" data-act="source">Add source</button>' : ''}
            <button class="btn btn--sm btn--primary" data-act="decide" data-decision="approve">Approve</button>
            <button class="btn btn--sm btn--danger" data-act="decide" data-decision="reject">Reject</button></div>` : ''}
          ${status === 'approved' && can('questions.manage') ? '<div class="row mt-12"><button class="btn btn--sm btn--danger" data-act="decide" data-decision="retire">Retire</button></div>' : ''}
        </div>`).join('') : '<p class="empty">No drafts here.</p>'}
    </section>`;
  root.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/questions?tab=drafts&status=${b.dataset.st}`; }));
  const reload = () => renderDrafts(root, query);
  onActions(root, {
    new: () => ask({
      title: 'Write a question', reason: false, confirm: 'Save draft',
      fields: [
        { name: 'topic', label: 'Topic', type: 'select', options: [['quant', 'Quant'], ['reasoning', 'Reasoning'], ['english', 'English'], ['general_awareness', 'General Awareness']], value: 'general_awareness' },
        { name: 'label', label: 'Sub-topic (optional)' },
        { name: 'text', label: 'Question', type: 'textarea', required: true },
        { name: 'o0', label: 'Option A', required: true }, { name: 'o1', label: 'Option B', required: true },
        { name: 'o2', label: 'Option C', required: true }, { name: 'o3', label: 'Option D', required: true },
        { name: 'answer', label: 'Correct option', type: 'select', options: [['0', 'A'], ['1', 'B'], ['2', 'C'], ['3', 'D']], value: '0' },
        { name: 'solution', label: 'Solution steps', type: 'textarea', required: true },
        { name: 'source', label: 'Source (book, official notice or link)', help: 'Required before approval. Never copy previous-year papers.' },
      ],
      run: (v) => post('/questions/drafts', { topic: v.topic, label: v.label, text: v.text, options: [v.o0, v.o1, v.o2, v.o3], answer_index: Number(v.answer), solution: v.solution, source: v.source }),
    }).then((d) => { if (d) { toast('Draft saved'); reload(); } }),
    source: (el) => ask({
      title: 'Add a source', reason: false, confirm: 'Save source',
      fields: [{ name: 'source', label: 'Source', required: true, help: 'Where the fact or answer was checked.' }],
      run: (v) => post(`/questions/drafts/${encodeURIComponent(el.closest('[data-id]').dataset.id)}/source`, { source: v.source }),
    }).then((d) => { if (d) reload(); }),
    decide: (el) => ask({
      title: `${el.dataset.decision[0].toUpperCase() + el.dataset.decision.slice(1)} this question`,
      lead: el.dataset.decision === 'approve' ? 'Only approve what you have checked yourself against the source.' : '',
      confirm: el.dataset.decision[0].toUpperCase() + el.dataset.decision.slice(1),
      danger: el.dataset.decision !== 'approve',
      run: (v) => post(`/questions/drafts/${encodeURIComponent(el.closest('[data-id]').dataset.id)}/decide`, { decision: el.dataset.decision, reason: v.reason }),
    }).then((d) => { if (d) { toast('Saved'); reload(); } }),
  });
}
