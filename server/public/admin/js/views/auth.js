// Sign-in (password, then authenticator code) and invite setup (password + QR code).
import { api, post, get, state, esc, LOGO } from '../core.js';

const card = (inner) => `
  <div class="glow glow--a"></div><div class="glow glow--b"></div>
  <div class="auth"><div class="auth__card">
    <div class="brand">${LOGO}<span>takkar</span></div>
    ${inner}
  </div></div>`;

export function renderLogin(root, { message, onSignedIn }) {
  let challenge = null;
  const showPassword = (msg = message || '') => {
    root.innerHTML = card(`
      <h1>Admin sign-in</h1>
      <p class="lead">Owner and moderators only. You will need your authenticator app.</p>
      <form id="pw-form" novalidate>
        <label class="field"><span>Email</span><input class="input" name="email" type="email" autocomplete="username" required autofocus></label>
        <label class="field"><span>Password</span><input class="input" name="password" type="password" autocomplete="current-password" required></label>
        <button class="btn btn--primary btn--lg btn--block" type="submit">Continue</button>
        <p class="auth__error" role="alert">${esc(msg)}</p>
      </form>`);
    const form = root.querySelector('#pw-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.auth__error');
      const btn = form.querySelector('button');
      btn.disabled = true; err.textContent = '';
      try {
        const res = await post('/auth/login', { email: form.email.value.trim(), password: form.password.value });
        challenge = res.challenge;
        showCode();
      } catch (ex) {
        err.textContent = ex.message;
        btn.disabled = false;
      }
    });
  };

  const showCode = () => {
    root.innerHTML = card(`
      <h1>Enter your code</h1>
      <p class="lead">Open your authenticator app and type the 6-digit code for Takkar admin.</p>
      <form id="code-form" novalidate>
        <label class="field"><span class="sr-only">6-digit code</span>
          <input class="input code-input" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus></label>
        <button class="btn btn--primary btn--lg btn--block" type="submit">Sign in</button>
        <p class="auth__error" role="alert"></p>
        <p class="muted small mt-12">Lost your phone? Ask the owner to reset your 2-step sign-in.</p>
      </form>`);
    const form = root.querySelector('#code-form');
    const input = form.code;
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 6);
      if (input.value.length === 6) form.requestSubmit();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.auth__error');
      const btn = form.querySelector('button');
      if (btn.disabled) return;
      btn.disabled = true; err.textContent = '';
      try {
        const res = await post('/auth/totp', { challenge, code: input.value });
        state.admin = res.admin;
        state.csrf = res.csrf;
        onSignedIn();
      } catch (ex) {
        if (ex.status === 401 && /expired/.test(ex.message)) { showPassword(ex.message); return; }
        err.textContent = ex.message;
        input.value = '';
        input.focus();
        btn.disabled = false;
      }
    });
  };

  showPassword();
}

export async function renderInvite(root, token) {
  root.innerHTML = card('<p class="loading">Checking your invite…</p>');
  let info;
  try {
    info = await get(`/auth/invite?token=${encodeURIComponent(token)}`);
  } catch (ex) {
    root.innerHTML = card(`<h1>Invite not valid</h1><p class="lead">${esc(ex.message)}</p><a class="btn btn--block mt-16" href="#/login">Go to sign-in</a>`);
    return;
  }
  let secret;
  try {
    secret = await post('/auth/invite/secret', { token });
  } catch (ex) {
    root.innerHTML = card(`<h1>Something went wrong</h1><p class="lead">${esc(ex.message)}</p>`);
    return;
  }

  root.innerHTML = card(`
    <h1>${info.purpose === 'reset' ? 'Reset your sign-in' : 'Set up your admin account'}</h1>
    <p class="lead">${esc(info.name)} · ${esc(info.email)} · <span class="badge badge--info">${esc(info.role)}</span></p>
    <form id="invite-form" novalidate>
      <label class="field"><span>Choose a password</span><input class="input" name="password" type="password" autocomplete="new-password" minlength="12" required>
        <small>At least 12 characters. A short sentence works well. Use a password manager.</small></label>
      <div class="field mt-16"><span>Scan with your authenticator app</span>
        <ol class="steps"><li>Open Google Authenticator, Microsoft Authenticator or Authy.</li><li>Add an account and scan this code.</li></ol>
        <div class="qr" id="qr" role="img" aria-label="QR code for your authenticator app"></div>
        <p class="secret">Can’t scan? Enter this key: <br>${esc(secret.secret.match(/.{1,4}/g).join(' '))}</p>
      </div>
      <label class="field mt-16"><span>Then type the 6-digit code it shows</span>
        <input class="input code-input" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label>
      <button class="btn btn--primary btn--lg btn--block" type="submit">Finish setup</button>
      <p class="auth__error" role="alert"></p>
    </form>`);

  // Draw the QR code with the bundled generator (no network).
  const qr = window.qrcode(0, 'M');
  qr.addData(secret.otpauth);
  qr.make();
  root.querySelector('#qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });

  const form = root.querySelector('#invite-form');
  form.code.addEventListener('input', () => { form.code.value = form.code.value.replace(/\D/g, '').slice(0, 6); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = form.querySelector('.auth__error');
    const btn = form.querySelector('button');
    btn.disabled = true; err.textContent = '';
    try {
      await api('POST', '/auth/invite/complete', { token, password: form.password.value, code: form.code.value });
      root.innerHTML = card(`<h1>You’re all set</h1><p class="lead">Your account is ready. Sign in with your email, password and a fresh code.</p><a class="btn btn--primary btn--lg btn--block" href="#/login">Go to sign-in</a>`);
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
    }
  });
}
