// Takkar website script. Kept tiny: the page works without it (NFR-01).

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function wireWaitlist() {
  const form = document.querySelector('.join__form');
  if (!form) return;
  const status = form.querySelector('.join__status');
  const button = form.querySelector('button[type="submit"]');
  // The form stays hidden until the email list is connected (the server says so), so nobody
  // fills it in for nothing.
  try {
    const res = await fetch(form.action, { headers: { Accept: 'application/json' } });
    const info = res.ok ? await res.json() : null;
    if (!info || !info.open) return;
  } catch {
    return;
  }
  form.hidden = false;
  form.noValidate = true; // this script checks the fields and explains what is wrong

  const show = (message, kind) => {
    status.textContent = message;
    status.className = 'join__status join__status--' + kind;
  };

  // Shown after a no-JavaScript form post redirects back here.
  const result = new URLSearchParams(location.search).get('waitlist');
  if (result === 'ok') show('You are on the list. We will email you once, when Takkar opens.', 'ok');
  if (result === 'error') show('That did not go through. Check your email and the age box, then try again.', 'error');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = form.email.value.trim();
    if (!EMAIL_PATTERN.test(email)) {
      show('Please enter a valid email address.', 'error');
      form.email.focus();
      return;
    }
    if (!form.adult.checked) {
      show('Takkar is for people aged 18 and over. Please confirm your age.', 'error');
      form.adult.focus();
      return;
    }

    button.disabled = true;
    show('Saving…', 'ok');
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, adult: true, website: form.website.value }),
      });
      if (response.status === 429) { show('Too many tries from this connection. Please try again later.', 'error'); return; }
      if (!response.ok) throw new Error(String(response.status));
      form.reset();
      show('You are on the list. We will email you once, when Takkar opens.', 'ok');
    } catch {
      show('We could not save that right now. Please try again later.', 'error');
    } finally {
      button.disabled = false;
    }
  });
}

wireWaitlist();
wireNavHighlight();
wireCarousels();
wireStickyPlay();
wireDemoDuel();
wireWarmup();
wireReveal();

/** Highlights the menu link for the section on screen ("you are here"). */
function wireNavHighlight() {
  const links = [...document.querySelectorAll('.nav__links a[href^="#"]')];
  const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if (!sections.length) return;
  let frame = 0;
  const update = () => {
    frame = 0;
    const line = innerHeight * 0.4;
    const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
    let current = null;
    for (const s of sections) {
      const top = s.getBoundingClientRect().top;
      if (top <= line || (atBottom && top < innerHeight)) current = s;
    }
    // Above the first section (the hero), nothing is highlighted.
    if (current && current.getBoundingClientRect().bottom < 0 && !atBottom) current = null;
    for (const a of links) {
      if (current && a.getAttribute('href') === `#${current.id}`) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
  };
  addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
  addEventListener('resize', update);
  update();
}

/** Phones: dots under each swipeable row (tap a dot to jump to that card). */
function wireCarousels() {
  for (const row of document.querySelectorAll('[data-carousel]')) {
    const cards = [...row.children];
    const dots = document.createElement('div');
    dots.className = 'carousel-dots';
    dots.innerHTML = cards.map((_, i) => `<button type="button" aria-label="Show card ${i + 1} of ${cards.length}"></button>`).join('');
    row.after(dots);
    const buttons = [...dots.children];
    buttons.forEach((b, i) => b.addEventListener('click', () => row.scrollTo({ left: cards[i].offsetLeft - cards[0].offsetLeft, behavior: reduceMotion() ? 'auto' : 'smooth' })));
    let frame = 0;
    const update = () => {
      frame = 0;
      const left = row.scrollLeft;
      let current = 0;
      cards.forEach((c, i) => { if (c.offsetLeft - cards[0].offsetLeft <= left + c.offsetWidth / 2) current = i; });
      if (left >= row.scrollWidth - row.clientWidth - 2) current = cards.length - 1; // scrolled to the end
      buttons.forEach((b, i) => (i === current ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
    };
    row.addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
    update();
  }
}

/** Phones: the "Play today's duel" bar shows once the hero button has scrolled away, and hides at the sign-up box. */
function wireStickyPlay() {
  const bar = document.getElementById('mcta');
  const hero = document.querySelector('.hero__actions');
  const join = document.getElementById('join');
  if (!bar || !hero || !('IntersectionObserver' in window)) return;
  let heroVisible = true;
  let joinVisible = false;
  const apply = () => bar.classList.toggle('mcta--show', !heroVisible && !joinVisible);
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting || e.boundingClientRect.top > 0; apply(); }).observe(hero);
  if (join) new IntersectionObserver(([e]) => { joinVisible = e.isIntersecting; apply(); }, { threshold: 0.15 }).observe(join);
}

function reduceMotion() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }

/** The hero phone plays a short duel on a loop: timer, answer, scores, next question. */
function wireDemoDuel() {
  const el = (id) => document.getElementById(id);
  const stage = document.querySelector('.stage');
  if (!stage || !el('demo-q') || reduceMotion()) return;
  const ROUNDS = [
    { n: 4, q: 'A can finish a job in 12 days and B in 24 days. Working together, how many days?', o: ['6 days', '8 days', '9 days', '10 days'], right: 1, pick: 1, you: 8, rival: 5.5 },
    { n: 5, q: 'What comes next? 3, 6, 11, 18, 27, ?', o: ['36', '38', '40', '35'], right: 1, pick: 1, you: 10, rival: 5 },
    { n: 6, q: 'A price rises by 20% and then falls by 20%. What is the overall change?', o: ['No change', '4% fall', '4% rise', '2% fall'], right: 1, pick: 0, you: 9.5, rival: 7 },
    { n: 7, q: 'In a code, CAT is written as DBU. How is DOG written?', o: ['EPH', 'EOH', 'FPH', 'EPG'], right: 0, pick: 0, you: 11.5, rival: 9 },
  ];
  const timer = el('demo-timer');
  const options = el('demo-options');
  const phone = stage.querySelector('.phone');
  let i = 0;
  let running = false;
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const share = (you, rival) => Math.round(((you + 2) / (you + rival + 4)) * 100);
  const setBar = (you, rival) => { const s = share(you, rival); el('demo-bar').style.width = `${s}%`; el('demo-dot').style.left = `${s}%`; };
  const pop = (node, text) => { node.textContent = text; node.classList.remove('score-pop'); void node.offsetWidth; node.classList.add('score-pop'); };

  function play() {
    const r = ROUNDS[i % ROUNDS.length];
    phone.classList.add('demo-swap');
    later(300, () => {
      el('demo-n').textContent = `Question ${r.n} of 10`;
      el('demo-q').textContent = r.q;
      options.innerHTML = r.o.map((t, k) => `<li class="option"><span class="option__key">${'ABCD'[k]}</span>${t}</li>`).join('');
      phone.classList.remove('demo-swap');
    });
    let left = 36;
    timer.textContent = `${left}s`;
    timer.classList.remove('is-low');
    const tick = () => { left -= 1; timer.textContent = `${left}s`; if (left > 23) later(110, tick); };
    later(500, tick);
    const items = () => [...options.children];
    later(2200, () => items()[r.pick]?.classList.add('option--picked'));
    later(3000, () => {
      timer.textContent = 'Locked';
      items().forEach((li, k) => {
        li.classList.remove('option--picked');
        if (k === r.right) li.classList.add('option--right');
        else if (k === r.pick) li.classList.add('option--wrongpick');
        else li.classList.add('option--dim');
      });
      pop(el('demo-you'), String(r.you));
      pop(el('demo-rival'), String(r.rival));
      setBar(r.you, r.rival);
    });
    later(5200, () => { i += 1; if (running) play(); });
  }
  let inView = false;
  const start = () => { if (running) return; running = true; play(); };
  const stop = () => { running = false; timers.forEach(clearTimeout); timers = []; phone.classList.remove('demo-swap'); };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView && !document.hidden) start(); else stop(); }, { threshold: 0.3 }).observe(stage);
  } else { inView = true; start(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (inView) start(); });
}

/** Phones: today's warm-up, one real question from the game's own engine (new every IST day). */
async function wireWarmup() {
  const section = document.getElementById('warmup');
  if (!section || !matchMedia('(max-width: 700px)').matches) return;
  let q;
  try {
    const [{ generateDuel }, { hashString }] = await Promise.all([import('/play/js/engine/index.js'), import('/play/js/engine/rng.js')]);
    const day = Math.floor((Date.now() + 5.5 * 3600000) / 86400000);
    q = generateDuel(hashString(`warmup:${day}`), 'mixed', 'easy')[0];
  } catch {
    return; // the page works without it
  }
  const make = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  document.getElementById('wu-q').textContent = q.text;
  document.getElementById('wu-meta').textContent = `${q.topic === 'quant' ? 'Quant' : 'Reasoning'} · ${q.label}`;
  const box = document.getElementById('wu-options');
  const buttons = q.options.map((text, k) => {
    const b = make('button', 'warmup__opt');
    b.type = 'button';
    b.append(make('span', 'warmup__key', 'ABCD'[k]), make('span', '', text));
    b.addEventListener('click', () => answer(k));
    box.append(b);
    return b;
  });
  function answer(k) {
    const right = k === q.answerIndex;
    try { navigator.vibrate?.(right ? 15 : [20, 40, 20]); } catch { /* optional */ }
    buttons.forEach((b, j) => {
      b.disabled = true;
      if (j === q.answerIndex) b.classList.add('is-right');
      else if (j === k) b.classList.add('is-wrong');
      else b.classList.add('is-dim');
    });
    const result = document.getElementById('wu-result');
    result.hidden = false;
    result.append(make('div', `warmup__verdict warmup__verdict--${right ? 'right' : 'wrong'}`, right ? 'Correct. +2 marks in SSC CGL.' : `Not quite. The answer is ${q.answerText}.`));
    const steps = make('ol', 'warmup__steps');
    q.steps.forEach((s) => steps.append(make('li', '', s)));
    result.append(steps);
    const cta = make('a', 'btn btn--cobalt warmup__cta', right ? 'Play the full duel →' : 'Try ten more →');
    cta.href = '/play/';
    result.append(cta, make('p', 'warmup__sub', 'That was 1 question. A duel is 10, against a rival, in a few minutes.'));
    // The tapped button is now disabled, so move focus to the result (screen readers read it).
    result.tabIndex = -1;
    result.focus({ preventScroll: true });
  }
  section.hidden = false;
}

/** Phones: sections ease in as they scroll into view. */
function wireReveal() {
  if (!matchMedia('(max-width: 700px)').matches || reduceMotion() || !('IntersectionObserver' in window)) return;
  const targets = document.querySelectorAll('.section__title, .section__lead, [data-carousel], .educators__stage, .faq, .join__card, .warmup__card');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  targets.forEach((t) => { if (t.getBoundingClientRect().top > innerHeight) { t.classList.add('reveal'); io.observe(t); } });
}
