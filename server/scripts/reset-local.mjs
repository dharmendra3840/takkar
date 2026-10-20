// Empties the LOCAL database, restores the defaults and reseeds sample data.
// Local only: the live audit log can never be emptied.
//   node scripts/reset-local.mjs
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { wrangler, d1 } from './wrangler.mjs';

if (process.argv.includes('--remote')) {
  console.error('reset-local works on the local database only.');
  process.exit(1);
}

const tables = d1("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations'").map((r) => r.name);
const sql = [
  'PRAGMA defer_foreign_keys = true;',
  'DROP TRIGGER IF EXISTS audit_log_no_update;',
  'DROP TRIGGER IF EXISTS audit_log_no_delete;',
  ...tables.map((t) => `DELETE FROM "${t}";`),
  "DELETE FROM sqlite_sequence;",
  "CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;",
  "CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;",
  readFileSync(new URL('../migrations/0002_defaults.sql', import.meta.url), 'utf8'),
].join('\n');
const file = `.reset-${Date.now()}.sql`;
writeFileSync(file, sql);
try {
  wrangler(['d1', 'execute', 'takkar', '--local', '--file', file]);
} catch (e) {
  const lines = String(e.stderr || e.stdout || e.message).split(/\r?\n/);
  console.error(lines.filter((l) => /error/i.test(l)).join('\n') || lines.slice(-5).join('\n'));
  process.exitCode = 1;
} finally {
  rmSync(file, { force: true });
}
if (process.exitCode) process.exit(1);
console.log(`Emptied ${tables.length} tables and restored defaults.`);
execFileSync(process.execPath, ['scripts/seed-demo.mjs'], { stdio: 'inherit' });
