// Runs the project's own Wrangler with Node directly (no shell), so SQL with
// spaces and quotes reaches it intact on Windows, macOS and Linux.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const CWD = fileURLToPath(new URL('..', import.meta.url));

// TAKKAR_PERSIST=<dir> points local commands at a separate throwaway database (used by UI tests).
const withPersist = (args) => (process.env.TAKKAR_PERSIST && args.includes('--local') ? [...args, '--persist-to', process.env.TAKKAR_PERSIST] : args);

export function wrangler(args, { quiet = false } = {}) {
  return execFileSync(process.execPath, [BIN, ...withPersist(args)], { encoding: 'utf8', cwd: CWD, maxBuffer: 256 * 1024 * 1024, stdio: quiet ? ['ignore', 'pipe', 'ignore'] : ['ignore', 'pipe', 'pipe'] });
}

/** Runs one SQL statement on the D1 database and returns the result rows. */
export function d1(command, where = '--local') {
  const out = wrangler(['d1', 'execute', 'takkar', where, '--json', '--command', command]);
  return JSON.parse(out)[0].results;
}
