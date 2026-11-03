// GET /question-of-the-day, /question-of-the-day/YYYY-MM-DD, /question-of-the-day/archive and /sitemap-qotd.xml
// (rewrites in vercel.json point here).
// The questions are made ahead by scripts/build-guides.mjs; this only picks the day and builds the page.
import { qotdResponse, qotdSitemap } from '../lib/qotd-page.mjs';

export function GET(request) {
  const params = new URL(request.url).searchParams;
  if (params.get('view') === 'sitemap') return qotdSitemap();
  return qotdResponse(params.get('day') || '');
}
