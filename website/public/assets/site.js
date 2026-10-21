// Takkar website script. Kept tiny: the page works without it (NFR-01).

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function wireWaitlist() {
  const form = document.querySelector('.join__form');
  if (!form) return;
  const status = form.querySelector('.join__status');
  const button = form.querySelector('button[type="submit"]');

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
      if (!response.ok) throw new Error(String(response.status));
      form.reset();
      show('You are on the list. We will email you once, when Takkar opens.', 'ok');
    } catch {
      show('We could not save that right now. Please try again in a minute.', 'error');
    } finally {
      button.disabled = false;
    }
  });
}

wireWaitlist();
wireNavHighlight();
wireCarousels();
wireStickyPlay();

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
    buttons.forEach((b, i) => b.addEventListener('click', () => row.scrollTo({ left: cards[i].offsetLeft - cards[0].offsetLeft, behavior: 'smooth' })));
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
