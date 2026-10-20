// npm test: runs the API checks on a separate throwaway database and server (port 8789),
// so your own local admin account and data are never touched.
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openSync } from 'node:fs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BIN = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const PERSIST = '.wrangler/test-db';
const env = { ...process.env, TAKKAR_PERSIST: PERSIST, BASE: 'http://127.0.0.1:8789' };
const run = (args) => execFileSync(process.execPath, args, { cwd: ROOT, env, stdio: 'inherit' });

run([BIN, 'd1', 'migrations', 'apply', 'takkar', '--local', '--persist-to', PERSIST]);
run(['scripts/reset-local.mjs']);

// Server logs go to a file: a pipe nobody reads would fill up and stall the server.
const log = openSync('test-server.log', 'w');
// Its own debugger port, so it can run next to your normal dev server (which uses 9229).
const server = spawn(process.execPath, [BIN, 'dev', '--local', '--port', '8789', '--inspector-port', '9239', '--persist-to', PERSIST], { cwd: ROOT, env, stdio: ['pipe', log, log] });
async function waitReady() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch('http://127.0.0.1:8789/admin/api/auth/me')).status === 401) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Test server did not start in 60 seconds (see test-server.log)');
}

let code = 0;
try {
  await waitReady();
  run(['tests/api.test.mjs']);
} catch (e) {
  console.error(e.message);
  code = 1;
} finally {
  server.kill();
}
process.exit(code);
