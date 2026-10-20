// Payments, refunds and coupons. Owner only (ADMIN-01, ADMIN-07, PLUS-05).
import { json, bad, notFound, readJson, nowIso, clampInt, requireString, istDay } from '../lib/http.js';
import { requirePermission, auditStatement } from '../lib/auth.js';
import { randomId } from '../lib/crypto.js';

export async function moneySummary({ env, admin }) {
  requirePermission(admin, 'money.view');
  const now = nowIso();
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const q = (sql, ...a) => env.DB.prepare(sql).bind(...a).first();
  const [plusPaid, plusGranted, revenue, refunds, failed, coupons] = await Promise.all([
    q("SELECT COUNT(DISTINCT user_id) AS n FROM subscriptions WHERE source = 'razorpay' AND status = 'active' AND current_period_end > ?1", now),
    q("SELECT COUNT(DISTINCT user_id) AS n FROM subscriptions WHERE source = 'grant' AND status = 'active' AND current_period_end > ?1", now),
    q("SELECT COALESCE(SUM(amount_paise), 0) AS paise, COUNT(*) AS n FROM payments WHERE status IN ('captured','partially_refunded','refunded') AND created_at >= ?1", monthStart.toISOString()),
    q('SELECT COALESCE(SUM(amount_paise), 0) AS paise, COUNT(*) AS n FROM refunds WHERE created_at >= ?1', monthStart.toISOString()),
    q("SELECT COUNT(*) AS n FROM payments WHERE status = 'failed' AND created_at >= ?1", new Date(Date.now() - 7 * 86400000).toISOString()),
    q("SELECT COUNT(*) AS n FROM coupons WHERE status = 'active' AND ends_at > ?1", now),
  ]);
  return json({
    plusPaid: plusPaid.n, plusGranted: plusGranted.n,
    revenueThisMonthPaise: revenue.paise, paymentsThisMonth: revenue.n,
    refundsThisMonthPaise: refunds.paise, refundsThisMonth: refunds.n,
    failedLast7Days: failed.n, activeCoupons: coupons.n,
    razorpayConnected: !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
    day: istDay(),
  });
}

export async function listPayments({ env, admin, query }) {
  requirePermission(admin, 'money.view');
  const q = (query.get('q') || '').trim();
  const status = query.get('status') || '';
  const limit = clampInt(query.get('limit'), 1, 200, 50);
  const where = [];
  const args = [];
  if (q) { args.push(q, `%${q.replace(/[%_]/g, '')}%`); where.push(`(p.id = ?${args.length - 1} OR p.provider_id = ?${args.length - 1} OR u.nickname LIKE ?${args.length})`); }
  if (status) { args.push(status); where.push(`p.status = ?${args.length}`); }
  const { results } = await env.DB.prepare(
    `SELECT p.*, u.nickname FROM payments p JOIN users u ON u.id = p.user_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.created_at DESC LIMIT ${limit}`
  ).bind(...args).all();
  const { results: refunds } = await env.DB.prepare(
    'SELECT r.*, a.email AS admin_email FROM refunds r LEFT JOIN admins a ON a.id = r.admin_id ORDER BY r.created_at DESC LIMIT 30'
  ).all();
  return json({ payments: results, refunds });
}

/** PLUS-05: full or partial refund. Uses Razorpay when keys are set; otherwise records a manual refund. */
export async function refundPayment({ request, env, admin, params }) {
  requirePermission(admin, 'money.refund');
  const body = await readJson(request);
  const reason = requireString(body.reason, 'Reason', { min: 3, max: 500 });
  const payment = await env.DB.prepare('SELECT * FROM payments WHERE id = ?1').bind(params.id).first();
  if (!payment) throw notFound('Payment not found.');
  const left = payment.amount_paise - payment.refunded_paise;
  if (left <= 0) throw bad('This payment is already fully refunded.');
  const amount = body.amount_paise === undefined || body.amount_paise === null ? left : clampInt(body.amount_paise, 1, left, -1);
  if (amount < 1) throw bad(`Refund between ₹0.01 and ₹${(left / 100).toFixed(2)}.`);

  let status = 'manual';
  let providerRefundId = null;
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && payment.provider_id) {
    const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(payment.provider_id)}/refund`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, notes: { reason: reason.slice(0, 250) } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw bad(`Razorpay refused the refund: ${data?.error?.description || res.status}`);
    status = 'processed';
    providerRefundId = data.id || null;
  }

  const refunded = payment.refunded_paise + amount;
  const id = randomId('rf_');
  await env.DB.batch([
    env.DB.prepare('INSERT INTO refunds (id, payment_id, amount_paise, reason, status, admin_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
      .bind(id, payment.id, amount, reason, status, admin.id, nowIso()),
    env.DB.prepare('UPDATE payments SET refunded_paise = ?1, status = ?2 WHERE id = ?3')
      .bind(refunded, refunded >= payment.amount_paise ? 'refunded' : 'partially_refunded', payment.id),
    auditStatement(env, admin, 'payment.refund', { targetType: 'payment', targetId: payment.id, reason, details: { amount_paise: amount, status, providerRefundId } }),
  ]);
  return json({ ok: true, status, refundId: id });
}

export async function listCoupons({ env, admin }) {
  requirePermission(admin, 'money.view');
  const { results } = await env.DB.prepare('SELECT c.*, a.email AS created_by_email FROM coupons c LEFT JOIN admins a ON a.id = c.created_by ORDER BY c.created_at DESC LIMIT 100').all();
  return json({ coupons: results, now: nowIso() });
}

/** ADMIN-07: percentage coupons with an end date, for new purchases only. */
export async function createCoupon({ request, env, admin }) {
  requirePermission(admin, 'money.coupons');
  const body = await readJson(request);
  const code = requireString(body.code, 'Code', { min: 4, max: 20 }).toUpperCase();
  if (!/^[A-Z0-9]+$/.test(code)) throw bad('Codes use capital letters and numbers only.');
  const percent = clampInt(body.percent_off, 1, 100, 0);
  if (!percent) throw bad('Percent off must be 1 to 100.');
  const ends = Date.parse(body.ends_at);
  if (!ends || ends < Date.now() + 3600000) throw bad('Pick an end date at least an hour from now.');
  if (ends > Date.now() + 366 * 86400000) throw bad('Coupons can run for a year at most.');
  const maxUses = body.max_uses ? clampInt(body.max_uses, 1, 1000000, null) : null;
  const exists = await env.DB.prepare('SELECT code FROM coupons WHERE code = ?1').bind(code).first();
  if (exists) throw bad('That code already exists.');
  await env.DB.batch([
    env.DB.prepare('INSERT INTO coupons (code, percent_off, ends_at, max_uses, status, created_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
      .bind(code, percent, new Date(ends).toISOString(), maxUses, 'active', admin.id, nowIso()),
    auditStatement(env, admin, 'coupon.create', { targetType: 'coupon', targetId: code, details: { percent, ends_at: new Date(ends).toISOString(), maxUses } }),
  ]);
  return json({ ok: true, code });
}

export async function disableCoupon({ request, env, admin, params }) {
  requirePermission(admin, 'money.coupons');
  const body = await readJson(request);
  const reason = requireString(body.reason, 'Reason', { min: 3, max: 300 });
  const res = await env.DB.prepare("UPDATE coupons SET status = 'disabled' WHERE code = ?1 AND status = 'active'").bind(params.code).run();
  if (!res.meta.changes) throw notFound('Coupon not found or already disabled.');
  await env.DB.batch([auditStatement(env, admin, 'coupon.disable', { targetType: 'coupon', targetId: params.code, reason })]);
  return json({ ok: true });
}
