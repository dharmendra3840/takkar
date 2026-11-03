// GET /question-of-the-day and /question-of-the-day/YYYY-MM-DD (rewrites in vercel.json point here).
// The questions are made ahead by scripts/build-guides.mjs; this only picks the day and builds the page.
import { qotdResponse } from '../lib/qotd-page.mjs';

export function GET(request) {
  return qotdResponse(new URL(request.url).searchParams.get('day') || '');
}
