// Challenge code test (CHAL-01, TC-14): every single-character edit must be rejected.
import { encodeChallenge, decodeChallenge, encodeChallengeV1 } from '../www/js/code.js';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let failures = 0;
const cases = [
  { seed: 1, topic: 'mixed', level: 'exam', marking: 'exam', score: 31, nickname: 'Riya22', exam: null },
  { seed: 99, topic: 'mixed', level: 'exam', marking: 'exam', score: 10.5, nickname: 'Asha', exam: 'ssc-cgl' },
  { seed: 7, topic: 'mixed', level: 'hard', marking: 'exam', score: -0.75, nickname: 'Dev', exam: 'ibps-po' },
  { seed: 8, topic: 'mixed', level: 'easy', marking: 'exam', score: 14 / 3, nickname: 'Sana', exam: 'rrb-ntpc' },
  { seed: 4294967295, topic: 'quant', level: 'hard', marking: 'speed', score: 150, nickname: 'abc' },
  { seed: 123456789, topic: 'reasoning', level: 'easy', marking: 'exam', score: -10, nickname: 'Kabir123456X' },
];
let edits = 0;
for (const c of cases) {
  const code = encodeChallenge(c);
  const back = decodeChallenge(code);
  if (!back.ok) { failures++; console.error('valid code rejected', code, back.reason); continue; }
  for (const k of ['seed', 'topic', 'level', 'marking', 'nickname', 'exam']) {
    if (back.challenge[k] !== (c[k] ?? null)) { failures++; console.error('round trip', k, back.challenge[k], c[k]); }
  }
  if (Math.abs(back.challenge.score - c.score) > 1e-9) { failures++; console.error('round trip score', back.challenge.score, c.score); }
  // Lower case and missing dashes still work.
  if (!decodeChallenge(code.toLowerCase().replace(/-/g, ' ')).ok) { failures++; console.error('lenient input rejected'); }
  const chars = code.slice(3).replace(/-/g, '');
  for (let i = 0; i < chars.length; i++) {
    for (const ch of ALPHABET) {
      if (ch === chars[i]) continue;
      const edited = chars.slice(0, i) + ch + chars.slice(i + 1);
      edits++;
      if (decodeChallenge('TK-' + edited).ok) { failures++; if (failures < 10) console.error('edit accepted at', i, ch); }
    }
  }
}
// Codes pasted inside a whole WhatsApp message, or with a link after them, and codes whose
// own characters contain "TK" (a greedy prefix strip used to reject about 1 in 200).
let pasted = 0;
for (let i = 0; i < 5000; i++) {
  const seed = (i * 2654435761) >>> 0;
  const code = encodeChallenge({ seed, topic: 'mixed', level: 'exam', marking: 'exam', score: (i % 51) - 10, nickname: 'Asha' });
  for (const text of [code, `I scored 23 in a Takkar duel.
Open Takkar, tap "Have a challenge code?" and paste:
${code}`, `${code} https://takkar.info`]) {
    pasted++;
    const r = decodeChallenge(text);
    if (!r.ok || r.challenge.seed !== seed) { failures++; if (failures < 10) console.error('pasted code rejected', JSON.stringify(text), r.reason); }
  }
}
// Codes made before exams (version 1) still open, with their old +4 / −1 scores.
for (const score of [-10, 0, 21, 40]) {
  const old = decodeChallenge(encodeChallengeV1({ seed: 555, topic: 'mixed', level: 'exam', marking: 'exam', score, nickname: 'Old' }));
  if (!old.ok || old.challenge.score !== score || old.challenge.exam !== null) { failures++; console.error('v1 code', score, old); }
}
if (failures) { console.error(`${failures} failures`); process.exit(1); }
console.log(`Challenge codes: ${cases.length} round trips, ${pasted} pasted messages read, ${edits} single-character edits all rejected.`);
