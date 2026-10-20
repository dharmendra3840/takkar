// Fills the LOCAL database with realistic sample data so the admin console has
// something to show. Never run against the live database.
//   node scripts/seed-demo.mjs
import { wrangler } from './wrangler.mjs';
import { writeFileSync, rmSync } from 'node:fs';
import { createRng } from '../../app/www/js/engine/rng.js';
import { TEMPLATES } from '../../app/www/js/engine/index.js';

if (process.argv.includes('--remote')) {
  console.error('Sample data is for local development only.');
  process.exit(1);
}

const rng = createRng(20261020);
const DAY = 86400000;
const istDay = (ms) => Math.floor((ms + 5.5 * 3600000) / DAY);
const today = istDay(Date.now());
// Never in the future: a time later than now becomes a few minutes to hours ago.
const isoForDay = (day, hour = 12) => {
  const t = day * DAY - 5.5 * 3600000 + hour * 3600000 + rng.int(0, 3599) * 1000;
  return new Date(t < Date.now() ? t : Date.now() - rng.int(5, 240) * 60000).toISOString();
};
const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const id = (p) => p + Math.floor(rng.next() * 2 ** 48).toString(36).padStart(9, '0');
const rows = [];
const insert = (table, obj) => rows.push(`INSERT INTO ${table} (${Object.keys(obj).join(', ')}) VALUES (${Object.values(obj).map(q).join(', ')});`);

const FIRST = ['Riya', 'Arjun', 'Meera', 'Kabir', 'Zoya', 'Imran', 'Priya', 'Rahul', 'Ananya', 'Dev', 'Fatima', 'Harpreet', 'Sana', 'Vikram', 'Neha', 'Joseph', 'Tanvi', 'Yusuf', 'Kavya', 'Nikhil', 'Pooja', 'Siddharth', 'Ayesha', 'Manoj', 'Divya', 'Farhan', 'Lakshmi', 'Gurpreet', 'Isha', 'Rohit'];
const SUFFIX = ['', '22', 'ssc', '07', 'bank', '99', 'rly', '24', 'x', '1'];

// ---------- Players ----------
const users = [];
const used = new Set();
for (let i = 0; i < 150; i++) {
  let nick;
  do { nick = rng.pick(FIRST) + rng.pick(SUFFIX) + (rng.chance(0.3) ? rng.int(1, 99) : ''); } while (used.has(nick.toLowerCase()) || nick.length > 12);
  used.add(nick.toLowerCase());
  const createdDay = today - rng.int(0, 20);
  const signedIn = rng.chance(0.45);
  const u = {
    id: id('usr_'), nickname: nick, email: signedIn ? `${nick.toLowerCase()}@example.com` : null,
    sign_in_method: signedIn ? rng.pick(['google', 'email']) : 'guest',
    age_confirmed_at: isoForDay(createdDay, 9), terms_version: '2026-10', role: 'player', status: 'active',
    plus_until: rng.chance(0.06) ? new Date(Date.now() + rng.int(3, 28) * DAY).toISOString() : null,
    created_at: isoForDay(createdDay, 9), created_day: createdDay, last_seen_at: new Date(Math.min(Date.now() - rng.int(5, 600) * 60000, Date.parse(isoForDay(today - rng.int(0, 3), 20)))).toISOString(),
    skill: rng.next(), keen: rng.next(),
  };
  users.push(u);
}
// A few already sanctioned, for realism.
users[3].status = 'suspended';
users[7].muted_until = new Date(Date.now() + 4 * DAY).toISOString();
users[11].status = 'banned';
for (const u of users) {
  const { skill, keen, ...row } = u;
  insert('users', row);
}

// ---------- Duels and answers ----------
const tmplIds = TEMPLATES.map((t) => t.id);
let duelCount = 0;
const playedDays = new Map();
for (const u of users) {
  for (let day = u.created_day; day <= today; day++) {
    const p = day === u.created_day ? 0.95 : 0.15 + u.keen * 0.55;
    if (!rng.chance(p)) continue;
    const n = rng.int(1, u.keen > 0.7 ? 4 : 2);
    for (let k = 0; k < n; k++) {
      const right = Math.max(0, Math.min(10, Math.round(3 + u.skill * 6 + (rng.next() - 0.5) * 3)));
      const skipped = rng.int(0, 2);
      const wrong = Math.max(0, 10 - right - skipped);
      const abandoned = rng.chance(0.06);
      const d = {
        id: id('dl_'), user_id: u.id, seed: rng.int(1, 2 ** 31), topic: rng.pick(['mixed', 'mixed', 'quant', 'reasoning']), level: 'exam', marking: 'exam',
        kind: k === 0 && rng.chance(0.15) ? 'league' : rng.chance(0.1) ? 'challenge' : 'solo', rival: 'steady', day,
        started_at: isoForDay(day, rng.int(7, 22)), status: abandoned ? 'abandoned' : 'finished',
        score: abandoned ? 0 : right * 4 - wrong, rival_score: rng.int(14, 32), right_count: abandoned ? 0 : right, wrong_count: abandoned ? 0 : wrong,
        skipped_count: abandoned ? 10 : skipped, time_ms: rng.int(90, 260) * 1000, counted: abandoned ? 0 : 1,
      };
      d.finished_at = abandoned ? null : d.started_at;
      insert('duels', d);
      duelCount++;
      playedDays.set(u.id, (playedDays.get(u.id) || 0) + 1);
      // Answers for the last two weeks (question stats and speed checks).
      if (!abandoned && day > today - 14) {
        for (let i = 0; i < 10; i++) {
          const correct = i < right ? 1 : 0;
          const fast = u === users[5] && rng.chance(0.8);
          insert('duel_answers', {
            duel_id: d.id, q_index: i, template: rng.pick(tmplIds), served_at: d.started_at, answered_at: d.started_at,
            choice: i >= right + wrong ? null : rng.int(0, 3), correct, points: correct ? 4 : (i < right + wrong ? -1 : 0),
            time_ms: fast ? rng.int(600, 1400) : rng.int(4000, 28000),
          });
        }
      }
      // Analytics events (ANLY-02).
      insert('events', { anon_id: u.id.slice(-8), name: 'duel_finished', day, at: d.started_at, props: null });
      if (rng.chance(0.17)) insert('events', { anon_id: u.id.slice(-8), name: 'share_clicked', day, at: d.started_at, props: null });
    }
  }
  insert('streaks', { user_id: u.id, current: rng.int(0, 9), best: rng.int(3, 15), rest_days_left: 0, last_day: today - rng.int(0, 2) });
}

// ---------- Educators, leagues, squads ----------
const educators = users.slice(20, 26);
educators.slice(0, 3).forEach((u) => rows.push(`UPDATE users SET role = 'educator' WHERE id = ${q(u.id)};`));
const leagueNames = ['SSC Maths with Rahul', 'Bank PO Daily', 'Railway Reasoning Club', 'CGL Quant Sprint', 'Sarkari Prep Hub', 'Night Study League'];
const leagues = educators.map((u, i) => {
  const l = {
    id: id('lg_'), name: leagueNames[i], owner_id: u.id, level: 'exam', approval: 1,
    invite_code: Math.floor(rng.next() * 36 ** 6).toString(36).toUpperCase().padStart(6, 'X'),
    status: i < 3 ? 'live' : 'pending', created_at: isoForDay(today - rng.int(2, 15), 11),
  };
  insert('leagues', l);
  return l;
});
leagues.slice(0, 3).forEach((l) => {
  for (const u of users.slice(30 + rng.int(0, 40), 30 + rng.int(41, 110))) insert('league_members', { league_id: l.id, user_id: u.id, joined_at: isoForDay(today - rng.int(0, 10)), state: rng.chance(0.08) ? 'pending' : 'member' });
});
// League duels belong to the live league the player is a member of.
leagues.slice(0, 3).forEach((l) => rows.push(`UPDATE duels SET league_id = ${q(l.id)} WHERE kind = 'league' AND league_id IS NULL AND user_id IN (SELECT user_id FROM league_members WHERE league_id = ${q(l.id)} AND state = 'member');`));
educators.slice(3).forEach((u, i) => insert('educator_requests', {
  id: id('edu_'), user_id: u.id, channel_name: leagueNames[3 + i], channel_url: `https://t.me/${leagueNames[3 + i].replace(/\W/g, '').toLowerCase()}`,
  followers: rng.int(1200, 42000), note: 'I teach SSC Quant on Telegram and want a daily duel for my students.', status: 'pending', created_at: isoForDay(today - rng.int(0, 3), 15),
}));
const squads = ['Night Owls', 'CGL Warriors', 'Topper Gang', 'Quant Queens', 'Railway Rockets'].map((name, i) => {
  const s = { id: id('sq_'), name, owner_id: users[40 + i].id, status: 'active', created_at: isoForDay(today - rng.int(1, 12)) };
  insert('squads', s);
  users.slice(40 + i * 6, 40 + i * 6 + rng.int(3, 7)).forEach((u) => insert('squad_members', { squad_id: s.id, user_id: u.id, joined_at: s.created_at, state: 'member' }));
  return s;
});

// ---------- Reports (MOD-01, MOD-03, MOD-05) ----------
const report = (kind, target, details, severity, extra = {}) => insert('reports', {
  id: id('rp_'), kind, target_user_id: target?.id || null, reporter_id: extra.system ? null : rng.pick(users).id,
  target_ref: extra.ref || null, details, severity, status: 'open', created_at: isoForDay(today - rng.int(0, 2), rng.int(8, 22)),
});
report('under_18', users[12], 'Says in the squad they are in class 11.', 1);
report('cheating', users[5], 'Flagged by the system: 34 answers under 1.5 seconds on tier 2 questions this week.', 1, { system: true });
report('cheating', users[17], 'Perfect scores at very high speed three days in a row.', 2, { system: true });
report('nickname', users[8], 'Offensive nickname.', 2);
report('nickname', users[9], 'Nickname copies a coaching brand.', 3);
report('harassment', users[14], 'Keeps sending "Rematch?" reactions to one member at night.', 2);
report('squad_name', users[40], 'Squad name mocks another member.', 3, { ref: squads[2].id });
report('league_name', educators[4], 'League name promises guaranteed selection.', 2, { ref: leagues[4].id });
report('other', users[22], 'Shares a paid answer channel link in the league name.', 3);
// Some history already handled.
rows.push(`INSERT INTO reports (id, kind, target_user_id, reporter_id, details, severity, status, resolution, resolved_at, created_at) VALUES (${q(id('rp_'))}, 'nickname', ${q(users[3].id)}, ${q(users[50].id)}, 'Abusive nickname.', 2, 'resolved', 'suspend: second offence', ${q(isoForDay(today - 4))}, ${q(isoForDay(today - 5))});`);

// ---------- Question flags (QGEN-06) ----------
for (let i = 0; i < 4; i++) insert('question_flags', { id: id('qf_'), template: 'clock-angle', question_text: 'What is the smaller angle between the hour and minute hands at 7:20?', user_id: rng.pick(users).id, reason: 'wrong', status: 'open', created_at: new Date(Date.now() - rng.int(1, 20) * 3600000).toISOString() });
for (let i = 0; i < 2; i++) insert('question_flags', { id: id('qf_'), template: 'mixture', question_text: 'In what ratio must rice at ₹40/kg be mixed with rice at ₹60/kg so that the mixture costs ₹45/kg?', user_id: rng.pick(users).id, reason: 'unclear', status: 'open', created_at: new Date(Date.now() - rng.int(1, 40) * 3600000).toISOString() });
insert('question_flags', { id: id('qf_'), template: 'row-position', question_text: 'In a row, Imran is 8th from the left end and 17th from the right end. How many people are in the row?', user_id: rng.pick(users).id, reason: 'wrong', status: 'open', created_at: new Date(Date.now() - 5 * 3600000).toISOString() });

// ---------- Money ----------
for (const u of users.filter((x) => x.plus_until)) {
  const sub = { id: id('sub_'), user_id: u.id, source: 'razorpay', provider_id: 'sub_' + id(''), status: 'active', amount_paise: 9900, current_period_end: u.plus_until, created_at: isoForDay(today - rng.int(2, 20)) };
  insert('subscriptions', sub);
  insert('payments', { id: id('pay_'), user_id: u.id, subscription_id: sub.id, provider_id: 'pay_' + id(''), amount_paise: 9900, status: 'captured', created_at: sub.created_at });
}
insert('payments', { id: id('pay_'), user_id: users[60].id, provider_id: 'pay_' + id(''), amount_paise: 9900, status: 'failed', created_at: isoForDay(today - 1) });
insert('coupons', { code: 'EXAMSEASON20', percent_off: 20, ends_at: new Date(Date.now() + 20 * DAY).toISOString(), max_uses: 500, used_count: 12, status: 'active', created_by: 'system', created_at: isoForDay(today - 6) });

// ---------- Write and apply ----------
const file = `.seed-${Date.now()}.sql`;
writeFileSync(file, rows.join('\n'));
try {
  wrangler(['d1', 'execute', 'takkar', '--local', '--file', file], { quiet: true });
} finally {
  rmSync(file, { force: true });
}
console.log(`Seeded locally: ${users.length} players, ${duelCount} duels, ${leagues.length} leagues, ${squads.length} squads, 10 reports, 7 flags (${rows.length} rows).`);
