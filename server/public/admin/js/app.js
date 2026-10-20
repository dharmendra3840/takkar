// Takkar admin console: boot, sign-in state, sidebar and hash router.
import { api, get, state, esc, setSignedOutHandler, toast, can, LOGO } from './core.js';
import { renderLogin, renderInvite } from './views/auth.js';
import { renderOverview } from './views/overview.js';
import { renderPlayers, renderPlayer } from './views/players.js';
import { renderReports } from './views/reports.js';
import { renderQuestions } from './views/questions.js';
import { renderLeagues, renderSquads } from './views/community.js';
import { renderMoney } from './views/money.js';
import { renderSettings } from './views/settings.js';
import { renderAudit, renderAdmins, renderAccount } from './views/admins.js';

const app = document.getElementById('app');

// [route, label, perm, render, group]
const PAGES = [
  ['overview', 'Overview', 'overview.view', renderOverview, 'Run'],
  ['players', 'Players', 'players.view', renderPlayers, 'Run'],
  ['reports', 'Reports', 'reports.view', renderReports, 'Run'],
  ['questions', 'Questions', 'questions.view', renderQuestions, 'Run'],
  ['leagues', 'Leagues and educators', 'leagues.view', renderLeagues, 'Community'],
  ['squads', 'Squads', 'squads.view', renderSquads, 'Community'],
  ['money', 'Plans and coupons', 'money.view', renderMoney, 'Owner'],
  ['settings', 'Switches and settings', 'words.view', renderSettings, 'Owner'],
  ['audit', 'Audit log', 'audit.view', renderAudit, 'Owner'],
  ['admins', 'Admins', 'admins.manage', renderAdmins, 'Owner'],
];

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { parts, query: new URLSearchParams(qs || '') };
}

function shell(current) {
  const groups = [];
  for (const [route, label, perm, , group] of PAGES) {
    if (!can(perm)) continue;
    if (!groups.find((g) => g.name === group)) groups.push({ name: group, items: [] });
    // Moderators only get the word filter on the settings page.
    const shown = route === 'settings' && !can('settings.view') ? 'Word filter' : label;
    groups.find((g) => g.name === group).items.push([route, shown]);
  }
  app.innerHTML = `
    <div class="glow glow--a"></div><div class="glow glow--b"></div>
    <div class="shell">
      <aside class="sidebar" aria-label="Admin">
        <div class="brand">${LOGO}<span>takkar</span></div><small class="brand">Admin console</small>
        <nav class="nav">
          ${groups.map((g) => `<div class="nav-group">${esc(g.name)}</div>${g.items.map(([route, label]) => `<a href="#/${route}" ${current === route ? 'aria-current="page"' : ''}>${esc(label)}${route === 'reports' && state.counts.reports ? `<span class="count" aria-label="${state.counts.reports} open">${state.counts.reports}</span>` : ''}</a>`).join('')}`).join('')}
        </nav>
        <div class="whoami"><strong>${esc(state.admin.name)}</strong><span class="muted">${esc(state.admin.role === 'owner' ? 'Owner' : 'Moderator')} · 2-step sign-in on</span>
          <div class="row"><a class="btn btn--sm" href="#/account">Account</a><button class="btn btn--sm" id="sign-out">Sign out</button></div></div>
      </aside>
      <main id="main" tabindex="-1"><p class="loading">Loading…</p></main>
    </div>`;
  app.querySelector('#sign-out').addEventListener('click', async () => {
    try { await api('POST', '/auth/logout', {}); } catch { /* already signed out */ }
    state.admin = null;
    location.hash = '#/login';
    route();
  });
  return app.querySelector('#main');
}

async function refreshCounts() {
  if (!can('overview.view')) return;
  try {
    const o = await get('/overview');
    state.counts.reports = o.queues.openReports;
  } catch { /* keep the old count */ }
}

let routing = 0;
async function route() {
  const ticket = ++routing;
  const { parts, query } = parseHash();
  const [first, second] = parts;

  if (first === 'invite' && second) return renderInvite(app, second);
  if (!state.admin) {
    try {
      const me = await api('GET', '/auth/me');
      state.admin = me.admin;
      state.csrf = me.csrf;
    } catch {
      return renderLogin(app, { onSignedIn: () => { location.hash = '#/overview'; route(); } });
    }
  }
  if (first === 'login' || !first) { location.hash = '#/overview'; return; }

  await refreshCounts();
  if (ticket !== routing) return;
  const page = PAGES.find(([r]) => r === first);
  const main = shell(first === 'account' ? '' : first);
  try {
    if (first === 'account') renderAccount(main);
    else if (!page || !can(page[2])) main.innerHTML = '<div class="panel"><h1>Not available</h1><p class="muted mt-8">This page does not exist, or your role cannot open it.</p></div>';
    else if (first === 'players' && second) await renderPlayer(main, { id: second });
    else await page[3](main, { query });
  } catch (err) {
    if (err.status === 401) return;
    main.innerHTML = `<div class="panel"><h1>Something went wrong</h1><p class="notice notice--bad mt-12">${esc(err.message)}</p><button class="btn mt-12" data-reload>Reload</button></div>`;
    main.querySelector('[data-reload]').addEventListener('click', () => location.reload());
  }
  if (ticket === routing) main.focus({ preventScroll: true });
}

setSignedOutHandler((message) => {
  state.admin = null;
  state.csrf = '';
  toast(message, 'error');
  renderLogin(app, { message, onSignedIn: () => route() });
});

window.addEventListener('hashchange', () => {
  // A dialog belongs to the page it was opened on.
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  route();
});
route();
