// Creates the first owner and prints a one-time setup link.
//   node scripts/bootstrap-owner.mjs --local  you@example.com "Your name"
//   node scripts/bootstrap-owner.mjs --remote you@example.com "Your name"
// The owner opens the link, sets a password and scans the QR code with an authenticator app.
import { wrangler } from './wrangler.mjs';
import { webcrypto as crypto } from 'node:crypto';
import { writeFileSync, rmSync } from 'node:fs';

const args = process.argv.slice(2);
const where = args.includes('--remote') ? '--remote' : '--local';
const [email, name] = args.filter((a) => !a.startsWith('--'));
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
  console.error('Usage: node scripts/bootstrap-owner.mjs --local|--remote owner@example.com "Owner name"');
  process.exit(1);
}

const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
const tokenHash = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))));
const id = 'adm_' + b64url(crypto.getRandomValues(new Uint8Array(12)));
const now = new Date().toISOString();
const expires = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const existing = wrangler(['d1', 'execute', 'takkar', where, '--json', '--command', "SELECT COUNT(*) AS n FROM admins WHERE role = 'owner'"]);
// --allow-existing exists only for local test runs.
if (JSON.parse(existing)[0].results[0].n > 0 && !(where === '--local' && args.includes('--allow-existing'))) {
  console.error('An owner already exists. Add more admins from the console (Admins page).');
  process.exit(1);
}

const sql = [
  `INSERT INTO admins (id, email, name, role, status, created_at) VALUES (${q(id)}, ${q(email.toLowerCase())}, ${q(name || 'Owner')}, 'owner', 'invited', ${q(now)});`,
  `INSERT INTO admin_invites (token_hash, admin_id, purpose, expires_at, created_by, created_at) VALUES (${q(tokenHash)}, ${q(id)}, 'setup', ${q(expires)}, 'bootstrap', ${q(now)});`,
  `INSERT INTO audit_log (at, admin_id, admin_email, action, target_type, target_id, reason) VALUES (${q(now)}, NULL, 'bootstrap', 'admin.invite', 'admin', ${q(id)}, 'First owner created from the command line');`,
].join('\n');
const file = `.bootstrap-${Date.now()}.sql`;
writeFileSync(file, sql);
try {
  wrangler(['d1', 'execute', 'takkar', where, '--file', file]);
} finally {
  rmSync(file, { force: true });
}

const base = where === '--local' ? 'http://localhost:8788' : 'https://<your-worker-domain>';
console.log('\nOwner created. Open this link within 48 hours to finish setup:\n');
console.log(`  ${base}/admin/#/invite/${token}\n`);
