// Challenge code test (CHAL-01, TC-14): every single-character edit must be rejected.
import { encodeChallenge, decodeChallenge, encodeChallengeV1, encodeChallengeV2 } from '../www/js/code.js';
import { CURRENT_SET } from '../www/js/engine/index.js';

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
  if (back.challenge.set !== CURRENT_SET) { failures++; console.error('round trip set', back.challenge.set); }
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
// Codes from app 0.3 (version 2) open with question set 1, so they replay the same questions.
{
  const v2 = decodeChallenge(encodeChallengeV2({ seed: 777, topic: 'mixed', level: 'exam', marking: 'exam', score: 10.5, nickname: 'Asha', exam: 'ssc-cgl' }));
  if (!v2.ok || v2.challenge.set !== 1 || v2.challenge.score !== 10.5 || v2.challenge.exam !== 'ssc-cgl' || v2.challenge.nickname !== 'Asha') { failures++; console.error('v2 code', v2); }
  const v1 = decodeChallenge(encodeChallengeV1({ seed: 555, topic: 'mixed', level: 'exam', marking: 'exam', score: 12, nickname: 'Old' }));
  if (!v1.ok || v1.challenge.set !== 1) { failures++; console.error('v1 set', v1); }
  // A code from a newer app (a question set this app does not have) asks for an update.
  const future = decodeChallenge(encodeChallenge({ seed: 1, topic: 'mixed', level: 'exam', marking: 'exam', score: 4, nickname: 'New', exam: 'ibps-po', set: CURRENT_SET + 1 }));
  if (future.ok || !/Update Takkar/.test(future.reason)) { failures++; console.error('future set accepted', future); }
}
if (failures) { console.error(`${failures} failures`); process.exit(1); }
console.log(`Challenge codes: ${cases.length} round trips, ${pasted} pasted messages read, ${edits} single-character edits all rejected.`);
