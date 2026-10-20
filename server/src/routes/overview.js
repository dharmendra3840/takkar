// ADMIN-09 overview and NFR-13 free-tier usage.
import { json, istDay, nowIso } from '../lib/http.js';
import { requirePermission, can } from '../lib/auth.js';

const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : null);

export async function overview({ env, admin }) {
  requirePermission(admin, 'overview.view');
  const today = istDay();
  const now = nowIso();
  const one = (sql, ...args) => env.DB.prepare(sql).bind(...args).first();

  const [duelsToday, activeToday, plus, openReports, flags24, pendingEdu, pendingDrafts, players, d1c, d1r, d7c, d7r, shares, finished7] = await Promise.all([
    one('SELECT COUNT(*) AS n FROM duels WHERE day = ?1', today),
    one('SELECT COUNT(DISTINCT user_id) AS n FROM duels WHERE day = ?1', today),
    one('SELECT COUNT(*) AS n FROM users WHERE plus_until > ?1 AND status != ?2', now, 'deleted'),
    one("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'"),
    one('SELECT COUNT(*) AS n FROM question_flags WHERE created_at > ?1', new Date(Date.now() - 86400000).toISOString()),
    one("SELECT COUNT(*) AS n FROM educator_requests WHERE status = 'pending'"),
    one("SELECT COUNT(*) AS n FROM question_drafts WHERE status = 'draft'"),
    one("SELECT COUNT(*) AS n FROM users WHERE status != 'deleted'"),
    // Day-1 return: players who joined 2 days ago and played the next day.
    one('SELECT COUNT(*) AS n FROM users WHERE created_day = ?1', today - 2),
    one('SELECT COUNT(DISTINCT u.id) AS n FROM users u JOIN duels d ON d.user_id = u.id AND d.day = u.created_day + 1 WHERE u.created_day = ?1', today - 2),
    // Day-7 return: players who joined 8 to 14 days ago and played within 7 days of joining.
    one('SELECT COUNT(*) AS n FROM users WHERE created_day BETWEEN ?1 AND ?2', today - 14, today - 8),
    one('SELECT COUNT(DISTINCT u.id) AS n FROM users u JOIN duels d ON d.user_id = u.id AND d.day BETWEEN u.created_day + 1 AND u.created_day + 7 WHERE u.created_day BETWEEN ?1 AND ?2', today - 14, today - 8),
    one("SELECT COUNT(*) AS n FROM events WHERE name = 'share_clicked' AND day > ?1", today - 7),
    one("SELECT COUNT(*) AS n FROM duels WHERE status = 'finished' AND day > ?1", today - 7),
  ]);

  const { results: series } = await env.DB.prepare(
    `SELECT day, COUNT(*) AS duels, COUNT(DISTINCT user_id) AS players
       FROM duels WHERE day > ?1 GROUP BY day ORDER BY day`
  ).bind(today - 14).all();
  const byDay = new Map(series.map((r) => [r.day, r]));
  const trend = Array.from({ length: 14 }, (_, i) => {
    const day = today - 13 + i;
    const r = byDay.get(day);
    return { day, duels: r ? r.duels : 0, players: r ? r.players : 0 };
  });

  return json({
    today,
    kpis: {
      duelsToday: duelsToday.n,
      activeToday: activeToday.n,
      dayOneReturn: pct(d1r.n, d1c.n),
      dayOneCohort: d1c.n,
      daySevenReturn: pct(d7r.n, d7c.n),
      daySevenCohort: d7c.n,
      shareRate: pct(shares.n, finished7.n),
      plusSubscribers: plus.n,
      players: players.n,
    },
    queues: {
      openReports: openReports.n,
      flagsLast24h: flags24.n,
      pendingEducators: can(admin, 'educators.decide') ? pendingEdu.n : null,
      pendingDrafts: pendingDrafts.n,
    },
    trend,
  });
}

// Free-tier limits that matter (Cloudflare Workers Free and D1 Free).
const LIMITS = { workerRequests: 100000, d1RowsRead: 5000000, d1RowsWritten: 100000, d1StorageBytes: 5 * 1024 ** 3 };

export async function usage({ env, admin }) {
  requirePermission(admin, 'usage.view');
  const out = { limits: LIMITS, storageBytes: null, live: null, note: null };
  // D1 reports the database size with every query.
  const probe = await env.DB.prepare('SELECT 1').run();
  out.storageBytes = probe.meta?.size_after ?? null;
  const { results: tables } = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations' ORDER BY name"
  ).all();
  const counts = await Promise.all(tables.map((t) => env.DB.prepare(`SELECT COUNT(*) AS n FROM "${t.name}"`).first()));
  out.rows = Object.fromEntries(tables.map((t, i) => [t.name, counts[i].n]));

  // Live numbers need a read-only Cloudflare API token (optional, free).
  if (env.CF_ACCOUNT_ID && env.CF_API_TOKEN) {
    try {
      out.live = await cloudflareUsage(env);
    } catch (e) {
      out.note = `Could not read live usage from Cloudflare: ${e.message}`;
    }
  } else {
    out.note = 'Add CF_ACCOUNT_ID and a read-only CF_API_TOKEN secret to see today’s live requests and database reads against the free limits.';
  }
  return json(out);
}

async function cloudflareUsage(env) {
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const query = `query($a: String!, $s: Time!, $e: Time!, $sd: Date!, $ed: Date!) { viewer { accounts(filter: {accountTag: $a}) {
    workersInvocationsAdaptive(limit: 1000, filter: {datetime_geq: $s, datetime_leq: $e}) { sum { requests } }
    d1AnalyticsAdaptiveGroups(limit: 1000, filter: {date_geq: $sd, date_leq: $ed}) { sum { rowsRead rowsWritten } }
  } } }`;
  const day = start.toISOString().slice(0, 10);
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { a: env.CF_ACCOUNT_ID, s: start.toISOString(), e: new Date().toISOString(), sd: day, ed: day } }),
  });
  const data = await res.json();
  if (data.errors?.length) throw new Error(data.errors[0].message);
  const acc = data.data.viewer.accounts[0];
  const sum = (arr, k) => arr.reduce((s, g) => s + (g.sum[k] || 0), 0);
  return {
    workerRequests: sum(acc.workersInvocationsAdaptive, 'requests'),
    d1RowsRead: sum(acc.d1AnalyticsAdaptiveGroups, 'rowsRead'),
    d1RowsWritten: sum(acc.d1AnalyticsAdaptiveGroups, 'rowsWritten'),
  };
}
