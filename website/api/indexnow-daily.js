// GET /api/indexnow-daily, run by the Vercel cron in vercel.json just after midnight in India:
// tells IndexNow that the question of the day has changed (in English and Hindi) and yesterday's has its own page.
// If CRON_SECRET is set in Vercel, only Vercel's cron (which sends it) can call this.
import { HOST, submitUrls } from '../lib/indexnow.mjs';

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  const today = new Date(Date.now() + 5.5 * 3600 * 1000);
  const yesterday = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
  const status = await submitUrls(['', '/hi'].flatMap((lang) => [`https://${HOST}${lang}/question-of-the-day`, `https://${HOST}${lang}/question-of-the-day/${yesterday}`]));
  return Response.json({ status }, { status: status === 200 || status === 202 ? 200 : 502, headers: { 'Cache-Control': 'no-store' } });
}
