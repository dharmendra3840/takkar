// Challenge code test (CHAL-01, TC-14): every single-character edit must be rejected.
import { encodeChallenge, decodeChallenge } from '../www/js/code.js';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let failures = 0;
const cases = [
  { seed: 1, topic: 'mixed', level: 'exam', marking: 'exam', score: 31, nickname: 'Riya22' },
  { seed: 4294967295, topic: 'quant', level: 'hard', marking: 'speed', score: 150, nickname: 'abc' },
  { seed: 123456789, topic: 'reasoning', level: 'easy', marking: 'exam', score: -10, nickname: 'Kabir123456X' },
];
let edits = 0;
for (const c of cases) {
  const code = encodeChallenge(c);
  const back = decodeChallenge(code);
  if (!back.ok) { failures++; console.error('valid code rejected', code, back.reason); continue; }
  for (const k of ['seed', 'topic', 'level', 'marking', 'score', 'nickname']) {
    if (back.challenge[k] !== c[k]) { failures++; console.error('round trip', k, back.challenge[k], c[k]); }
  }
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
if (failures) { console.error(`${failures} failures`); process.exit(1); }
console.log(`Challenge codes: ${cases.length} round trips, ${pasted} pasted messages read, ${edits} single-character edits all rejected.`);
