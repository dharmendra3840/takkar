// Tells IndexNow search engines about pages once they're live (run after Vercel has deployed them).
// Run: node website/scripts/indexnow.mjs                 every URL in the sitemap
//      node website/scripts/indexnow.mjs /hi/ssc-cgl ...  just these pages
import { readFileSync } from 'node:fs';
import { HOST, submitUrls } from '../lib/indexnow.mjs';

const args = process.argv.slice(2);
const urls = args.length
  ? args.map((a) => (a.startsWith('http') ? a : `https://${HOST}${a.startsWith('/') ? '' : '/'}${a}`))
  : [...readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const status = await submitUrls(urls);
const meaning = { 200: 'accepted', 202: 'accepted; the key is still being checked', 400: 'bad request', 403: 'key not valid (is the key file live?)', 422: 'a URL is not on this site', 429: 'too many requests, try later' };
console.log(`${urls.length} URL${urls.length === 1 ? '' : 's'}: ${status} ${meaning[status] || ''}`);
if (status !== 200 && status !== 202) process.exit(1);
