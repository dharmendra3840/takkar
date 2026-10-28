// Sample people for the prototype's squad, ranks and league screens.
// Every screen that shows them says they are sample players. Numbers are
// seeded by week (and league code), so they stay the same on every visit
// and always add up.
import { createRng, hashString } from './engine/rng.js?v=36d989a188';
import { generateDuel } from './engine/index.js?v=36d989a188';
import { istDay, weekStart } from './time.js?v=36d989a188';

const PLAYERS = [
  'Zoya', 'Kabir', 'Isha', 'Aarav', 'Dev', 'Meera', 'Imran', 'Sana', 'Rohit', 'Ananya',
  'Harpreet', 'Joseph', 'Fatima', 'Vikram', 'Neha', 'Arjun', 'Priya', 'Rahul', 'Tanvi', 'Yusuf',
  'Kavya', 'Nikhil', 'Pooja', 'Siddharth', 'Ayesha', 'Manoj', 'Divya', 'Farhan', 'Lakshmi', 'Gurpreet',
];

const daysIntoWeek = () => istDay() - weekStart() + 1; // 1 (Monday) to 7 (Sunday)

// ---------- Squad (SQUAD-01 to SQUAD-03) ----------

export const SQUAD = {
  name: 'Night Owls',
  size: 8,
  target: 30,
  reactions: ['Well played', 'Rematch?', 'Let’s go', 'Study time', 'On it', 'Nice one'],
};

export function squadMembers(yourName, yourCorrect) {
  const rng = createRng(hashString(`squad:${weekStart()}`));
  const days = daysIntoWeek();
  const others = ['Aarav', 'Kabir', 'Meera', 'Dev'].map((name) => ({
    name,
    right: Math.round(days * (0.4 + rng.next() * 1.4)),
    you: false,
  }));
  return [...others, { name: yourName, right: yourCorrect, you: true }].sort((a, b) => b.right - a.right);
}

// ---------- Weekly ranks (RANK-01) ----------

export function weeklyBoard(yourName, yourTotal, scale = 1) {
  const rng = createRng(hashString(`ranks:${weekStart()}`));
  const days = daysIntoWeek();
  const board = PLAYERS.slice(0, 24).map((name) => ({
    name,
    total: Math.round(days * (40 + rng.next() * 72) * scale * 4) / 4,
    you: false,
  }));
  board.push({ name: yourName, total: yourTotal, you: true });
  board.sort((a, b) => b.total - a.total || (a.you ? 1 : -1));
  return board.map((row, i) => ({ ...row, rank: i + 1 }));
}

// ---------- Educator league demo (LEAG-01 to LEAG-05) ----------

export function leagueCode(channel) {
  const h = hashString(`league:${channel.trim().toLowerCase()}`);
  const A = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
  let code = '';
  let n = h;
  for (let i = 0; i < 6; i++) { code += A[n % A.length]; n = Math.floor(n / A.length); }
  return code;
}

/** LEAG-03: one daily duel per league, the same questions for every member, new at midnight IST. */
export function leagueDailySeed(code, day = istDay()) {
  return hashString(`daily:${code}:${day}`);
}

function memberCount(code) {
  return 18 + (hashString(`size:${code}`) % 15);
}

/** Sample members' daily scores (exam marking, -10 to 40). */
function sampleScores(code, scale = 1) {
  const today = istDay();
  const first = weekStart();
  return PLAYERS.slice(0, memberCount(code)).map((name) => {
    // Each member has their own sequence, so earlier days never change as the week goes on.
    const rng = createRng(hashString(`members:${code}:${first}:${name}`));
    const skill = rng.next();
    const days = [];
    for (let d = first; d <= today; d++) {
      const playedToday = rng.chance(0.55 + skill * 0.35);
      const score = Math.round(6 + skill * 26 + (rng.next() - 0.5) * 14);
      days.push({ day: d, played: playedToday, score: (Math.round(Math.max(-10, Math.min(40, score)) * scale * 4) / 4) });
    }
    return { name, skill, days };
  });
}

/**
 * LEAG-04: weekly table (Monday to Sunday), first attempt at each daily duel only.
 * yourDays: [{ day, score }] from your first attempts this week.
 */
export function leagueTable(code, yourName, yourDays, scale = 1) {
  const rows = sampleScores(code, scale).map((m) => {
    const played = m.days.filter((d) => d.played);
    return { name: m.name, total: played.reduce((s, d) => s + d.score, 0), played: played.length, you: false };
  });
  rows.push({
    name: yourName,
    total: yourDays.reduce((s, d) => s + d.score, 0),
    played: yourDays.length,
    you: true,
  });
  rows.sort((a, b) => b.total - a.total || (a.you ? 1 : -1));
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** LEAG-05: the weekly report an educator gets (participation, average score, weakest topics). */
export function leagueReport(code, yourDays, scale = 1) {
  const members = sampleScores(code, scale);
  const today = istDay();
  const total = members.length + 1;
  const playedToday = members.filter((m) => m.days.find((d) => d.day === today)?.played).length
    + (yourDays.some((d) => d.day === today) ? 1 : 0);

  const allScores = members.flatMap((m) => m.days.filter((d) => d.played).map((d) => d.score))
    .concat(yourDays.map((d) => d.score));
  const average = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

  // Weakest topics: accuracy by question type across this week's daily duels.
  const rng = createRng(hashString(`report:${code}:${weekStart()}`));
  const byLabel = {};
  for (let d = weekStart(); d <= today; d++) {
    for (const q of generateDuel(leagueDailySeed(code, d), 'mixed', 'exam')) {
      const hardness = q.tier === 2 ? 0.18 : 0;
      byLabel[q.label] = byLabel[q.label] || { right: 0, seen: 0 };
      for (const m of members) {
        if (!m.days.find((x) => x.day === d)?.played) continue;
        byLabel[q.label].seen += 1;
        if (rng.chance(0.35 + m.skill * 0.55 - hardness)) byLabel[q.label].right += 1;
      }
    }
  }
  const weakest = Object.entries(byLabel)
    .filter(([, v]) => v.seen >= 5)
    .map(([label, v]) => ({ label, accuracy: Math.round((v.right / v.seen) * 100) }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  return {
    members: total,
    playedToday,
    participation: Math.round((playedToday / total) * 100),
    average: Math.round(average * 10) / 10,
    weakest,
  };
}
