// Takkar API on Cloudflare Workers. Serves the admin console (static files), its API,
// and the player API the app uses (/api/*).
import { json, errorResponse, notFound, HttpError } from './lib/http.js';
import { requireAdmin } from './lib/auth.js';
import * as auth from './routes/auth.js';
import { overview, usage } from './routes/overview.js';
import { listPlayers, getPlayer, playerAction, exportPlayer } from './routes/players.js';
import { listReports, resolveReport } from './routes/reports.js';
import { listTemplates, sampleTemplate, setTemplateStatus, listDrafts, createDraft, decideDraft, updateDraftSource } from './routes/questions.js';
import { listLeagues, setLeagueStatus, listEducatorRequests, decideEducator, listSquads, closeSquad } from './routes/community.js';
import { readSettings, writeSetting, listWords, addWord, removeWord, listAnnouncements, createAnnouncement, endAnnouncement } from './routes/config.js';
import { moneySummary, listPayments, refundPayment, listCoupons, createCoupon, disableCoupon } from './routes/money.js';
import { listAudit, exportAudit, listAdmins, inviteAdmin, manageAdmin, reinviteAdmin } from './routes/admins.js';
import * as player from './routes/player.js';

// [method, path pattern, handler, needs a signed-in admin]
const ROUTES = [
  ['POST', '/auth/login', auth.login, false],
  ['POST', '/auth/totp', auth.verifyCode, false],
  ['GET', '/auth/me', auth.me, false],
  ['POST', '/auth/logout', auth.logout, false],
  ['POST', '/auth/logout-all', auth.logoutAll, false],
  ['GET', '/auth/invite', auth.inviteInfo, false],
  ['POST', '/auth/invite/secret', auth.inviteSecret, false],
  ['POST', '/auth/invite/complete', auth.inviteComplete, false],

  ['GET', '/overview', overview, true],
  ['GET', '/usage', usage, true],

  ['GET', '/players', listPlayers, true],
  ['GET', '/players/:id', getPlayer, true],
  ['POST', '/players/:id/actions', playerAction, true],
  ['GET', '/players/:id/export', exportPlayer, true],

  ['GET', '/reports', listReports, true],
  ['POST', '/reports/:id/resolve', resolveReport, true],

  ['GET', '/questions/templates', listTemplates, true],
  ['GET', '/questions/templates/:id/sample', sampleTemplate, true],
  ['POST', '/questions/templates/:id/status', setTemplateStatus, true],
  ['GET', '/questions/drafts', listDrafts, true],
  ['POST', '/questions/drafts', createDraft, true],
  ['POST', '/questions/drafts/:id/decide', decideDraft, true],
  ['POST', '/questions/drafts/:id/source', updateDraftSource, true],

  ['GET', '/leagues', listLeagues, true],
  ['POST', '/leagues/:id/status', setLeagueStatus, true],
  ['GET', '/educators', listEducatorRequests, true],
  ['POST', '/educators/:id/decide', decideEducator, true],
  ['GET', '/squads', listSquads, true],
  ['POST', '/squads/:id/close', closeSquad, true],

  ['GET', '/settings', readSettings, true],
  ['POST', '/settings/:key', writeSetting, true],
  ['GET', '/words', listWords, true],
  ['POST', '/words', addWord, true],
  ['POST', '/words/:word/remove', removeWord, true],
  ['GET', '/announcements', listAnnouncements, true],
  ['POST', '/announcements', createAnnouncement, true],
  ['POST', '/announcements/:id/end', endAnnouncement, true],

  ['GET', '/money', moneySummary, true],
  ['GET', '/money/payments', listPayments, true],
  ['POST', '/money/payments/:id/refund', refundPayment, true],
  ['GET', '/money/coupons', listCoupons, true],
  ['POST', '/money/coupons', createCoupon, true],
  ['POST', '/money/coupons/:code/disable', disableCoupon, true],

  ['GET', '/audit', listAudit, true],
  ['GET', '/audit.csv', exportAudit, true],
  ['GET', '/admins', listAdmins, true],
  ['POST', '/admins', inviteAdmin, true],
  ['POST', '/admins/:id/manage', manageAdmin, true],
  ['POST', '/admins/:id/reinvite', reinviteAdmin, true],
].map(compile);

// The player API. Each handler checks its own sign-in, since guests may call some routes.
const PLAYER_ROUTES = [
  ['GET', '/config', player.config],
  ['POST', '/auth/firebase', player.signIn],
  ['POST', '/auth/logout', player.signOut],
  ['GET', '/me', player.me],
  ['POST', '/me/profile', player.saveProfile],
  ['POST', '/me/nickname', player.saveNickname],
  ['POST', '/duels', player.saveDuels],
  ['POST', '/reports', player.report],
  ['POST', '/flags', player.flagQuestion],
  ['POST', '/account/delete', player.deleteAccount],
].map(compile);

function compile([method, pattern, handler, authed]) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  return { method, regex, keys, handler, authed };
}

async function handleAdminApi(request, env, path) {
  for (const route of ROUTES) {
    const m = path.match(route.regex);
    if (!m) continue;
    if (route.method !== request.method) continue;
    const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const ctx = { request, env, params, query: new URL(request.url).searchParams };
    if (route.authed) ctx.admin = await requireAdmin(request, env);
    return route.handler(ctx);
  }
  if (ROUTES.some((r) => r.regex.test(path))) throw new HttpError(405, 'Method not allowed.', 'method');
  throw notFound('No such admin endpoint.');
}

async function handlePlayerApi(request, env, path) {
  const cors = player.corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  let res;
  try {
    const route = PLAYER_ROUTES.find((r) => r.method === request.method && r.regex.test(path));
    if (!route) {
      throw PLAYER_ROUTES.some((r) => r.regex.test(path)) ? new HttpError(405, 'Method not allowed.', 'method') : notFound('No such endpoint.');
    }
    res = await route.handler({ request, env, params: {}, query: new URL(request.url).searchParams });
  } catch (err) {
    res = errorResponse(err);
    if (err && err.until) {
      const body = await res.json();
      res = json({ ...body, until: err.until }, res.status);
    }
  }
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/admin/api/')) {
        if (!env.TOTP_KEY) return json({ error: 'Server is missing the TOTP_KEY secret.', code: 'misconfigured' }, 500);
        return await handleAdminApi(request, env, url.pathname.slice('/admin/api'.length));
      }
      if (url.pathname.startsWith('/api/')) {
        return await handlePlayerApi(request, env, url.pathname.slice('/api'.length));
      }
      if (url.pathname === '/' || url.pathname === '/admin') {
        return Response.redirect(new URL('/admin/', url).toString(), 302);
      }
      return env.ASSETS.fetch(request);
    } catch (err) {
      return errorResponse(err);
    }
  },
};
