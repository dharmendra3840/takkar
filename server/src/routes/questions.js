// Question review: templates (keep, pause, retire), flags, samples, hand-written drafts
// (ADMIN-05, QGEN-06, QGEN-07). The server uses the app's own engine.
import { json, bad, notFound, readJson, nowIso, requireString, clampInt } from '../lib/http.js';
import { requirePermission, auditStatement } from '../lib/auth.js';
import { randomId } from '../lib/crypto.js';
import { TEMPLATES, generateQuestion } from '../../../app/www/js/engine/index.js';
import { createRng } from '../../../app/www/js/engine/rng.js';

export async function listTemplates({ env, admin }) {
  requirePermission(admin, 'questions.view');
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT t.*,
       (SELECT COUNT(*) FROM question_flags f WHERE f.template = t.id AND f.created_at > ?1) AS flags_24h,
       (SELECT COUNT(*) FROM question_flags f WHERE f.template = t.id AND f.status = 'open') AS flags_open,
       (SELECT COUNT(*) FROM duel_answers a WHERE a.template = t.id) AS served,
       (SELECT AVG(a.correct) FROM duel_answers a WHERE a.template = t.id AND a.choice IS NOT NULL) AS accuracy,
       (SELECT AVG(a.time_ms) FROM duel_answers a WHERE a.template = t.id AND a.choice IS NOT NULL) AS avg_ms
     FROM templates t ORDER BY flags_open DESC, t.status != 'active' DESC, t.topic, t.label`
  ).bind(dayAgo).all();
  const engineIds = new Set(TEMPLATES.map((t) => t.id));
  const tiers = Object.fromEntries(TEMPLATES.map((t) => [t.id, t.tiers]));
  return json({ templates: results.map((t) => ({ ...t, inEngine: engineIds.has(t.id), tiers: tiers[t.id] || [] })) });
}

/** Fresh sample questions from a template, to recalculate by hand before keeping or retiring it. */
export async function sampleTemplate({ env, admin, params, query }) {
  requirePermission(admin, 'questions.view');
  const template = TEMPLATES.find((t) => t.id === params.id);
  if (!template) throw notFound('That template is not in the engine.');
  const count = clampInt(query.get('n'), 1, 10, 4);
  const rng = createRng(Number(query.get('seed')) || Date.now() % 2 ** 31);
  const samples = Array.from({ length: count }, (_, i) => generateQuestion(template, rng, template.tiers[i % template.tiers.length]));
  const { results: flags } = await env.DB.prepare(
    "SELECT f.id, f.question_text, f.reason, f.status, f.created_at, u.nickname FROM question_flags f LEFT JOIN users u ON u.id = f.user_id WHERE f.template = ?1 ORDER BY f.created_at DESC LIMIT 30"
  ).bind(params.id).all();
  return json({ template: { id: template.id, label: template.label, tiers: template.tiers }, samples, flags });
}

export async function setTemplateStatus({ request, env, admin, params }) {
  requirePermission(admin, 'questions.manage');
  const body = await readJson(request);
  const status = String(body.status || '');
  if (!['active', 'paused', 'retired'].includes(status)) throw bad('Status must be active, paused or retired.');
  const reason = requireString(body.reason, 'Reason', { min: 3, max: 500 });
  const t = await env.DB.prepare('SELECT * FROM templates WHERE id = ?1').bind(params.id).first();
  if (!t) throw notFound('Template not found.');
  const now = nowIso();
  const stmts = [
    env.DB.prepare('UPDATE templates SET status = ?1, reason = ?2, updated_at = ?3, updated_by = ?4 WHERE id = ?5').bind(status, reason, now, admin.id, t.id),
    auditStatement(env, admin, `template.${status === 'active' ? 'keep' : status === 'paused' ? 'pause' : 'retire'}`, { targetType: 'template', targetId: t.id, reason, details: { from: t.status, to: status } }),
  ];
  // Keeping or retiring a template closes its open flags.
  if (status !== 'paused') stmts.push(env.DB.prepare("UPDATE question_flags SET status = 'reviewed' WHERE template = ?1 AND status = 'open'").bind(t.id));
  await env.DB.batch(stmts);
  return json({ ok: true });
}

// ---------- Hand-written drafts (QGEN-07): need a named source and admin approval ----------

export async function listDrafts({ env, admin, query }) {
  requirePermission(admin, 'questions.view');
  const status = ['draft', 'approved', 'rejected', 'retired'].includes(query.get('status')) ? query.get('status') : 'draft';
  const { results } = await env.DB.prepare(
    'SELECT d.*, a.email AS created_by_email FROM question_drafts d LEFT JOIN admins a ON a.id = d.created_by WHERE d.status = ?1 ORDER BY d.created_at DESC LIMIT 100'
  ).bind(status).all();
  return json({ drafts: results.map((d) => ({ ...d, options: JSON.parse(d.options) })) });
}

function checkDraft(body) {
  const topic = ['quant', 'reasoning', 'english', 'general_awareness'].includes(body.topic) ? body.topic : null;
  if (!topic) throw bad('Pick a topic.');
  const text = requireString(body.text, 'Question', { min: 10, max: 600 });
  const options = Array.isArray(body.options) ? body.options.map((o) => String(o || '').trim()) : [];
  if (options.length !== 4 || options.some((o) => !o || o.length > 120)) throw bad('Give exactly four options, each up to 120 characters.');
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4) throw bad('The four options must all be different (QGEN-02).');
  const answerIndex = Number(body.answer_index);
  if (![0, 1, 2, 3].includes(answerIndex)) throw bad('Mark which option is correct.');
  const solution = requireString(body.solution, 'Solution', { min: 10, max: 1500 });
  const source = typeof body.source === 'string' ? body.source.trim().slice(0, 300) : '';
  return { topic, label: String(body.label || '').trim().slice(0, 60) || null, text, options, answerIndex, solution, source };
}

export async function createDraft({ request, env, admin }) {
  requirePermission(admin, 'questions.manage');
  const d = checkDraft(await readJson(request));
  const id = randomId('qd_');
  await env.DB.batch([
    env.DB.prepare('INSERT INTO question_drafts (id, topic, label, text, options, answer_index, solution, source, status, created_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)')
      .bind(id, d.topic, d.label, d.text, JSON.stringify(d.options), d.answerIndex, d.solution, d.source || null, 'draft', admin.id, nowIso()),
    auditStatement(env, admin, 'draft.create', { targetType: 'draft', targetId: id, details: { topic: d.topic } }),
  ]);
  return json({ ok: true, id });
}

export async function decideDraft({ request, env, admin, params }) {
  requirePermission(admin, 'questions.manage');
  const body = await readJson(request);
  const decision = String(body.decision || '');
  if (!['approve', 'reject', 'retire'].includes(decision)) throw bad('Decision must be approve, reject or retire.');
  const reason = requireString(body.reason, 'Reason', { min: 3, max: 500 });
  const draft = await env.DB.prepare('SELECT * FROM question_drafts WHERE id = ?1').bind(params.id).first();
  if (!draft) throw notFound('Draft not found.');
  if (decision === 'approve') {
    if (!draft.source) throw bad('Add a named source before approving. Never approve anything you have not checked yourself (QGEN-07).');
    if (draft.created_by === admin.id && admin.role !== 'owner') throw bad('Another admin must approve your own draft.');
  }
  const status = { approve: 'approved', reject: 'rejected', retire: 'retired' }[decision];
  await env.DB.batch([
    env.DB.prepare('UPDATE question_drafts SET status = ?1, decided_by = ?2, decided_at = ?3 WHERE id = ?4').bind(status, admin.id, nowIso(), draft.id),
    auditStatement(env, admin, `draft.${decision}`, { targetType: 'draft', targetId: draft.id, reason }),
  ]);
  return json({ ok: true });
}

export async function updateDraftSource({ request, env, admin, params }) {
  requirePermission(admin, 'questions.manage');
  const body = await readJson(request);
  const source = requireString(body.source, 'Source', { min: 3, max: 300 });
  const res = await env.DB.prepare("UPDATE question_drafts SET source = ?1 WHERE id = ?2 AND status = 'draft'").bind(source, params.id).run();
  if (!res.meta.changes) throw notFound('Draft not found or already decided.');
  await env.DB.batch([auditStatement(env, admin, 'draft.source', { targetType: 'draft', targetId: params.id, details: { source } })]);
  return json({ ok: true });
}
