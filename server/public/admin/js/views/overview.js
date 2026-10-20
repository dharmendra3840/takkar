// Overview: KPIs (ADMIN-09), queues, 14-day trend and free-tier usage (NFR-13).
import { get, esc, num, pct, istDayToDate, can } from '../core.js';

/** Single-series bar chart with a per-bar hover tooltip and direct labels on the latest and highest bars. */
function barChart({ data, valueKey, label, unit }) {
  const W = 560, H = 190, padL = 34, padB = 26, padT = 18;
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  const nice = Math.ceil(max / 5) * 5 || 5;
  const bw = (W - padL) / data.length;
  const y = (v) => padT + (H - padT - padB) * (1 - v / nice);
  const ticks = [0, nice / 2, nice];
  const peak = data.reduce((m, d, i) => (d[valueKey] > data[m][valueKey] ? i : m), 0);
  const bars = data.map((d, i) => {
    const v = d[valueKey];
    const x = padL + i * bw + bw * 0.18;
    const w = bw * 0.64;
    const top = y(v);
    const h = Math.max(0, H - padB - top);
    // Rounded top only: path with 4px radius at the data end, flat on the baseline.
    const r = Math.min(4, w / 2, h);
    const path = h > 0 ? `M${x},${H - padB} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${H - padB} Z` : '';
    const showLabel = i === data.length - 1 || i === peak;
    return `<g data-tip="${esc(istDayToDate(d.day))}: ${num(v)} ${esc(unit)}">
      <rect class="bar-hit" x="${padL + i * bw}" y="${padT}" width="${bw}" height="${H - padT - padB}"></rect>
      ${path ? `<path class="bar" d="${path}"></path>` : ''}
      ${showLabel && v > 0 ? `<text class="value-label" x="${x + w / 2}" y="${top - 5}" text-anchor="middle">${num(v)}</text>` : ''}
      ${i % 2 === (data.length - 1) % 2 ? `<text class="axis" x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${esc(istDayToDate(d.day))}</text>` : ''}
    </g>`;
  }).join('');
  return `
    <figure class="chart" style="margin:0">
      <figcaption class="row row--between"><h3>${esc(label)}</h3><span class="muted small">Last 14 days, IST</span></figcaption>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} for the last 14 days: ${data.map((d) => `${istDayToDate(d.day)} ${d[valueKey]}`).join(', ')}">
        ${ticks.map((t) => `<line class="grid-line" x1="${padL}" x2="${W}" y1="${y(t)}" y2="${y(t)}"></line><text class="axis" x="${padL - 6}" y="${y(t) + 4}" text-anchor="end">${num(t)}</text>`).join('')}
        <line class="baseline" x1="${padL}" x2="${W}" y1="${H - padB}" y2="${H - padB}"></line>
        ${bars}
      </svg>
    </figure>`;
}

function wireTooltips(root) {
  for (const chart of root.querySelectorAll('.chart')) {
    const tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.hidden = true;
    chart.appendChild(tip);
    chart.addEventListener('pointermove', (e) => {
      const g = e.target.closest('[data-tip]');
      if (!g) { tip.hidden = true; return; }
      const box = chart.getBoundingClientRect();
      tip.textContent = g.dataset.tip;
      tip.style.left = `${e.clientX - box.left}px`;
      tip.style.top = `${e.clientY - box.top}px`;
      tip.hidden = false;
    });
    chart.addEventListener('pointerleave', () => { tip.hidden = true; });
  }
}

function meter(label, used, limit, unit = '') {
  const share = limit ? Math.min(100, (used / limit) * 100) : 0;
  const cls = share >= 80 ? 'meter--bad' : share >= 60 ? 'meter--warn' : '';
  return `<div><div class="row row--between small"><span>${esc(label)}</span><span class="muted">${num(Math.round(used))}${unit} of ${num(limit)}${unit} (${share.toFixed(share < 1 ? 2 : 0)}%)</span></div>
    <div class="meter ${cls} mt-8"><span style="width:${share}%"></span></div></div>`;
}

export async function renderOverview(root) {
  const data = await get('/overview');
  const k = data.kpis;
  const qs = data.queues;
  const tiles = [
    ['Duels today', num(k.duelsToday), 'IST day'],
    ['Players active today', num(k.activeToday), `${num(k.players)} players in total`],
    ['Back the next day', pct(k.dayOneReturn), `of ${num(k.dayOneCohort)} who joined 2 days ago · target 25%`],
    ['Back within 7 days', pct(k.daySevenReturn), `of ${num(k.daySevenCohort)} who joined 8–14 days ago · target 10%`],
    ['Share rate', pct(k.shareRate), 'shares ÷ finished duels, 7 days · target 15%'],
    ['Plus subscribers', num(k.plusSubscribers), 'paid and granted'],
  ];
  const queue = [
    ['#/reports', 'Open reports', qs.openReports],
    ['#/questions', 'Question flags in 24 h', qs.flagsLast24h],
    ['#/questions', 'Drafts waiting', qs.pendingDrafts],
    ...(qs.pendingEducators !== null ? [['#/leagues', 'Educators waiting', qs.pendingEducators]] : []),
  ];

  root.innerHTML = `
    <div class="topbar"><div><h1>Overview</h1><p>Live numbers from the database. Gate targets are from the master plan.</p></div>
      <button class="btn" data-refresh>Refresh</button></div>
    <section class="panel"><div class="kpis">${tiles.map(([l, v, n]) => `<div class="kpi"><div class="kpi__label">${esc(l)}</div><div class="kpi__value">${esc(v)}</div><div class="kpi__note">${esc(n)}</div></div>`).join('')}</div></section>
    <section class="panel"><div class="panel-head"><h2>Needs your attention</h2><p>Clear reports older than 24 hours every day (admin manual).</p></div>
      <div class="kpis">${queue.map(([href, l, v]) => `<a class="kpi ${v > 0 ? 'kpi--alert' : ''}" href="${href}"><div class="kpi__label">${esc(l)}</div><div class="kpi__value">${num(v)}</div></a>`).join('')}</div></section>
    <section class="panel grid grid-2">
      <div>${barChart({ data: data.trend, valueKey: 'duels', label: 'Duels a day', unit: 'duels' })}</div>
      <div>${barChart({ data: data.trend, valueKey: 'players', label: 'Active players a day', unit: 'players' })}</div>
    </section>
    <details class="panel"><summary class="muted small" style="cursor:pointer">Show the numbers as a table</summary>
      <div class="table-wrap mt-12"><table><thead><tr><th>Day</th><th class="num">Duels</th><th class="num">Active players</th></tr></thead>
      <tbody>${data.trend.slice().reverse().map((d) => `<tr><td>${esc(istDayToDate(d.day))}</td><td class="num">${num(d.duels)}</td><td class="num">${num(d.players)}</td></tr>`).join('')}</tbody></table></div></details>
    ${can('usage.view') ? '<section class="panel" id="usage"><div class="panel-head"><h2>Free-tier usage</h2><p>Hosting stays free until about 5,000 daily players (NFR-13).</p></div><p class="loading">Loading…</p></section>' : ''}`;

  root.querySelector('[data-refresh]').addEventListener('click', () => renderOverview(root));
  wireTooltips(root);

  if (can('usage.view')) {
    const u = await get('/usage');
    const box = root.querySelector('#usage');
    const biggest = Object.entries(u.rows).sort((a, b) => b[1] - a[1]).slice(0, 6);
    box.innerHTML = `<div class="panel-head"><h2>Free-tier usage</h2><p>Hosting stays free until about 5,000 daily players (NFR-13). Alert at 80%.</p></div>
      <div class="stack">
        ${u.storageBytes !== null ? meter('Database storage (D1)', u.storageBytes / 1048576, u.limits.d1StorageBytes / 1048576, ' MB') : ''}
        ${u.live ? meter('Worker requests today', u.live.workerRequests, u.limits.workerRequests) + meter('Database rows read today', u.live.d1RowsRead, u.limits.d1RowsRead) + meter('Database rows written today', u.live.d1RowsWritten, u.limits.d1RowsWritten) : ''}
      </div>
      ${u.note ? `<p class="notice notice--info mt-12">${esc(u.note)}</p>` : ''}
      <p class="muted small mt-12">Largest tables: ${biggest.map(([t, n]) => `${esc(t)} ${num(n)}`).join(' · ')}</p>`;
  }
}
