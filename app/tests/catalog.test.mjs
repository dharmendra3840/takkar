// Old challenge codes must open with exactly the questions they were made with. This recomputes
// 108,000 question-set-1 duels and compares them with the fingerprint saved from app 0.3.2
// (tests/fixtures/catalog1.json, made by tests/snapshot-catalog1.mjs before set 2 existed).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { generateDuel } from '../www/js/engine/index.js';
import { EXAMS } from '../www/js/exams.js';
const want = JSON.parse(readFileSync(new URL('./fixtures/catalog1.json', import.meta.url), 'utf8'));
const h = createHash('sha256');
let n = 0;
for (let seed = 0; seed < 3000; seed++) {
  for (const topic of ['quant', 'reasoning', 'mixed']) for (const level of ['easy', 'exam', 'hard']) {
    for (const w of [null, ...Object.values(EXAMS).map((e) => e.weights)]) {
      const qs = generateDuel(seed * 7919 + 13, topic, level, [], w, 1);
      h.update(JSON.stringify(qs.map((q) => [q.type, q.text, q.options, q.answerIndex])));
      n++;
    }
  }
}
const got = h.digest('hex');
if (n !== want.duels || got !== want.sha256) {
  console.error(`Question set 1 changed: ${n} duels, ${got} (want ${want.duels}, ${want.sha256})`);
  process.exit(1);
}
console.log(`Question set 1 unchanged: ${n.toLocaleString('en-IN')} duels match app 0.3.2.`);
