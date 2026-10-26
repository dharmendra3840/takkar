// Records what question set 1 (the 30 types up to app 0.3.2) produces, so later engine changes
// can prove old challenge codes still open with exactly the same questions.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { generateDuel } from '../www/js/engine/index.js';
import { EXAMS } from '../www/js/exams.js';
const h = createHash('sha256');
let n = 0;
for (let seed = 0; seed < 3000; seed++) {
  for (const topic of ['quant', 'reasoning', 'mixed']) for (const level of ['easy', 'exam', 'hard']) {
    for (const w of [null, ...Object.values(EXAMS).map((e) => e.weights)]) {
      const qs = generateDuel(seed * 7919 + 13, topic, level, [], w);
      h.update(JSON.stringify(qs.map((q) => [q.type, q.text, q.options, q.answerIndex])));
      n++;
    }
  }
}
const out = { duels: n, sha256: h.digest('hex') };
writeFileSync(new URL('./fixtures/catalog1.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(out);
