// Opening animation: "tak" and "kar" rush in from both sides, collide, and the
// collision becomes the Takkar logo, with the name below it.
// The full version plays on the first open; after that a short one (about 1.3 s).
// A tap skips it, and "reduce motion" shows the logo still for a moment instead.
const SEEN_KEY = 'takkar.introSeen';

/** once: play only on the first visit (the web app), not the short version every time. */
export function playIntro({ once = false } = {}) {
  let seen = false;
  try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch { /* storage blocked */ }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (once && seen) {
    document.documentElement.classList.remove('booting');
    return Promise.resolve();
  }
  const mode = reduce ? 'still' : seen ? 'short' : 'full';
  const duration = { full: 2900, short: 1450, still: 900 }[mode];

  const el = document.createElement('div');
  el.className = `intro intro--${mode}`;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'Takkar');
  el.innerHTML = `
    <div class="intro__stage" aria-hidden="true">
      <span class="intro__word intro__word--tak">tak</span>
      <span class="intro__word intro__word--kar">kar</span>
      <span class="intro__ring"></span>
      <span class="intro__ball intro__ball--you"></span>
      <span class="intro__ball intro__ball--rival"></span>
      <svg class="intro__logo" viewBox="0 0 40 32"><circle cx="14" cy="16" r="11" fill="#4B5DFF"/><circle cx="26" cy="16" r="11" fill="#FF6A00"/><path class="intro__lens" d="M20 6.78 A11 11 0 0 0 20 25.22 A11 11 0 0 0 20 6.78 Z" fill="#FFFFFF"/></svg>
    </div>
    <div class="intro__name" aria-hidden="true">takkar<span lang="hi">टक्कर</span></div>`;
  document.body.appendChild(el);
  document.documentElement.classList.remove('booting');

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage blocked */ }
      el.classList.add('intro--out');
      setTimeout(() => { el.remove(); resolve(); }, 260);
    };
    el.addEventListener('click', finish);
    setTimeout(finish, duration);
  });
}
