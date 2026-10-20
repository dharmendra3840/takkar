// Money (owner only): summary, payments and refunds (PLUS-05), coupons (ADMIN-07).
import { get, post, esc, num, rupees, dateTime, dateOnly, ask, toast, onActions, isFuture } from '../core.js';

const PAY_BADGE = { captured: 'badge--good', failed: 'badge--bad', refunded: 'badge--warn', partially_refunded: 'badge--warn' };

export async function renderMoney(root, { query }) {
  const q = query.get('q') || '';
  const status = query.get('status') || '';
  const [sum, pays, coupons] = await Promise.all([get('/money'), get(`/money/payments?q=${encodeURIComponent(q)}&status=${status}`), get('/money/coupons')]);
  const reload = () => renderMoney(root, { query });

  root.innerHTML = `
    <div class="topbar"><div><h1>Plans and coupons</h1><p>Refunds go through Razorpay and are logged. Price changes apply to new buyers only (Settings).</p></div></div>
    ${sum.razorpayConnected ? '' : '<p class="notice">Razorpay is not connected yet, so refunds are recorded as manual: refund the payment in the Razorpay dashboard too. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET as secrets to refund from here.</p>'}
    <section class="panel"><div class="kpis">
      <div class="kpi"><div class="kpi__label">Paying Plus members</div><div class="kpi__value">${num(sum.plusPaid)}</div><div class="kpi__note">${num(sum.plusGranted)} more on granted Plus</div></div>
      <div class="kpi"><div class="kpi__label">Revenue this month</div><div class="kpi__value">${rupees(sum.revenueThisMonthPaise)}</div><div class="kpi__note">${num(sum.paymentsThisMonth)} payments</div></div>
      <div class="kpi"><div class="kpi__label">Refunded this month</div><div class="kpi__value">${rupees(sum.refundsThisMonthPaise)}</div><div class="kpi__note">${num(sum.refundsThisMonth)} refunds</div></div>
      <div class="kpi ${sum.failedLast7Days ? 'kpi--alert' : ''}"><div class="kpi__label">Failed payments, 7 days</div><div class="kpi__value">${num(sum.failedLast7Days)}</div><div class="kpi__note">Check for failed renewals daily</div></div>
    </div></section>

    <section class="panel">
      <div class="panel-head"><h2>Payments</h2></div>
      <form class="toolbar" id="pf">
        <input class="input search" name="q" type="search" placeholder="Payment id or nickname" value="${esc(q)}" aria-label="Find a payment">
        <select class="input" name="status" aria-label="Status">${[['', 'All'], ['captured', 'Paid'], ['failed', 'Failed'], ['partially_refunded', 'Part refunded'], ['refunded', 'Refunded']].map(([v, l]) => `<option value="${v}" ${v === status ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <button class="btn btn--primary" type="submit">Find</button>
      </form>
      <div class="table-wrap"><table><thead><tr><th>Date</th><th>Player</th><th>Payment</th><th class="num">Amount</th><th class="num">Refunded</th><th>Status</th><th></th></tr></thead>
      <tbody>${pays.payments.map((p) => `<tr data-id="${esc(p.id)}" data-left="${p.amount_paise - p.refunded_paise}" data-nick="${esc(p.nickname)}">
        <td class="nowrap">${esc(dateTime(p.created_at))}</td><td><a href="#/players/${esc(p.user_id)}">${esc(p.nickname)}</a></td><td class="mono small">${esc(p.provider_id || p.id)}</td>
        <td class="num">${rupees(p.amount_paise)}</td><td class="num">${p.refunded_paise ? rupees(p.refunded_paise) : '–'}</td>
        <td><span class="badge ${PAY_BADGE[p.status] || ''}">${esc(p.status.replace('_', ' '))}</span></td>
        <td>${p.amount_paise > p.refunded_paise && p.status !== 'failed' ? '<button class="btn btn--sm" data-act="refund">Refund</button>' : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">No payments match.</td></tr>'}</tbody></table></div>
      ${pays.refunds.length ? `<h3 class="mt-16">Recent refunds</h3><div class="table-wrap mt-8"><table><thead><tr><th>Date</th><th>Payment</th><th class="num">Amount</th><th>Status</th><th>Reason</th><th>By</th></tr></thead><tbody>
        ${pays.refunds.map((r) => `<tr><td class="nowrap">${esc(dateTime(r.created_at))}</td><td class="mono small">${esc(r.payment_id)}</td><td class="num">${rupees(r.amount_paise)}</td><td><span class="badge ${r.status === 'processed' ? 'badge--good' : 'badge--warn'}">${esc(r.status)}</span></td><td>${esc(r.reason)}</td><td class="small muted">${esc(r.admin_email || '')}</td></tr>`).join('')}
      </tbody></table></div>` : ''}
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Coupons</h2><button class="btn btn--primary" data-act="coupon">New coupon</button></div>
      <div class="table-wrap"><table><thead><tr><th>Code</th><th class="num">Off</th><th>Ends</th><th class="num">Used</th><th>Status</th><th></th></tr></thead>
      <tbody>${coupons.coupons.map((c) => {
        const live = c.status === 'active' && isFuture(c.ends_at);
        return `<tr data-code="${esc(c.code)}"><td class="mono"><strong>${esc(c.code)}</strong></td><td class="num">${num(c.percent_off)}%</td><td class="nowrap">${esc(dateOnly(c.ends_at))}</td>
          <td class="num">${num(c.used_count)}${c.max_uses ? ` / ${num(c.max_uses)}` : ''}</td>
          <td><span class="badge ${live ? 'badge--good' : 'badge--bad'}">${live ? 'active' : c.status === 'disabled' ? 'disabled' : 'ended'}</span></td>
          <td>${live ? '<button class="btn btn--sm btn--danger" data-act="disable">Disable</button>' : ''}</td></tr>`;
      }).join('') || '<tr><td colspan="6" class="empty">No coupons yet.</td></tr>'}</tbody></table></div>
    </section>`;

  root.querySelector('#pf').addEventListener('submit', (e) => { e.preventDefault(); const f = new FormData(e.target); location.hash = `#/money?q=${encodeURIComponent(f.get('q').trim())}&status=${f.get('status')}`; });
  onActions(root, {
    refund: (el) => {
      const row = el.closest('[data-id]');
      const left = Number(row.dataset.left);
      ask({
        title: `Refund ${row.dataset.nick}`,
        lead: `Up to ${rupees(left)} can be refunded. Leave the amount as it is for a full refund.`,
        fields: [{ name: 'amount', label: 'Amount in rupees', type: 'number', value: (left / 100).toFixed(2), min: 0.01, max: left / 100 }],
        confirm: 'Refund', danger: true,
        run: (v) => post(`/money/payments/${encodeURIComponent(row.dataset.id)}/refund`, { amount_paise: Math.round(Number(v.amount) * 100), reason: v.reason }),
      }).then((d) => { if (d) { toast(d.status === 'processed' ? 'Refunded through Razorpay' : 'Refund recorded. Also refund it in Razorpay.'); reload(); } });
    },
    coupon: () => {
      const inMonth = new Date(Date.now() + 30 * 86400000);
      ask({
        title: 'New coupon', reason: false, confirm: 'Create coupon',
        lead: 'Coupons apply to new purchases only.',
        fields: [
          { name: 'code', label: 'Code', required: true, help: 'Capital letters and numbers, 4 to 20.' },
          { name: 'percent', label: 'Percent off', type: 'number', value: 20, min: 1, max: 100, required: true },
          { name: 'ends', label: 'Ends on', type: 'date', value: inMonth.toISOString().slice(0, 10), required: true },
          { name: 'max', label: 'Most uses (optional)', type: 'number', min: 1 },
        ],
        run: (v) => post('/money/coupons', { code: v.code.trim().toUpperCase(), percent_off: Number(v.percent), ends_at: new Date(`${v.ends}T23:59:00+05:30`).toISOString(), max_uses: v.max ? Number(v.max) : null }),
      }).then((d) => { if (d) { toast('Coupon created'); reload(); } });
    },
    disable: (el) => {
      const code = el.closest('[data-code]').dataset.code;
      ask({ title: `Disable ${code}`, confirm: 'Disable', danger: true, run: (v) => post(`/money/coupons/${encodeURIComponent(code)}/disable`, { reason: v.reason }) })
        .then((d) => { if (d) { toast('Coupon disabled'); reload(); } });
    },
  });
}
