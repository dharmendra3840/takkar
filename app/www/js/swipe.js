// Swipe left or right to move between the tabs (Home, League, Squad, Ranks, You).
// The page follows the finger, resists at the first and last tab, and changes tab on a
// long enough drag or a quick flick. Vertical scrolling is left to the browser
// (touch-action: pan-y), and touches near the screen edges are left to Android's back gesture.

const EDGE = 24; // px kept free for the system back gesture
const LOCK = 10; // px of movement before deciding: horizontal swipe or vertical scroll

function scrollsSideways(el, stop) {
  for (let n = el; n && n !== stop; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 2) {
      const o = getComputedStyle(n).overflowX;
      if (o === 'auto' || o === 'scroll') return true;
    }
  }
  return false;
}

/**
 * order: tab ids in order; current(): the tab on screen (or null); allowed(): false while a
 * sheet is open; change(tab): switch tab (the caller animates it in).
 */
export function enableTabSwipe(app, { order, current, allowed, change }) {
  let s = null;
  let frame = 0;
  let swallowClickUntil = 0;

  const reset = (body, animate) => {
    if (!body) return;
    if (animate) {
      body.classList.add('is-settling');
      body.style.transform = '';
      body.style.opacity = '';
      setTimeout(() => body.classList.remove('is-settling', 'is-dragging'), 240);
    } else {
      body.classList.remove('is-settling', 'is-dragging');
      body.style.transform = '';
      body.style.opacity = '';
    }
  };

  app.addEventListener('touchstart', (e) => {
    s = null;
    if (e.touches.length !== 1 || !allowed()) return;
    const tab = current();
    if (!tab) return;
    const t = e.touches[0];
    if (t.clientX < EDGE || t.clientX > innerWidth - EDGE) return;
    if (e.target.closest('input, textarea, select, .tabbar, [data-noswipe]')) return;
    const body = app.querySelector('.screen--tab .screen__body');
    if (!body || scrollsSideways(e.target, app)) return;
    s = { x: t.clientX, y: t.clientY, body, tab, index: order.indexOf(tab), dx: 0, lock: null, samples: [[t.clientX, e.timeStamp]] };
  }, { passive: true });

  app.addEventListener('touchmove', (e) => {
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (!s.lock) {
      if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
      s.lock = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y';
      if (s.lock === 'y') { s = null; return; }
      s.body.classList.add('is-dragging');
    }
    s.dx = dx;
    s.samples.push([t.clientX, e.timeStamp]);
    if (s.samples.length > 5) s.samples.shift();
    const atEnd = (dx > 0 && s.index === 0) || (dx < 0 && s.index === order.length - 1);
    const shown = atEnd ? dx * 0.22 : dx; // rubber band past the first and last tab
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!s) return;
      s.body.style.transform = `translate3d(${shown}px, 0, 0)`;
      s.body.style.opacity = String(1 - Math.min(0.3, (Math.abs(shown) / innerWidth) * 0.6));
    });
  }, { passive: true });

  const end = () => {
    if (!s) return;
    const { body, dx, index, lock, samples } = s;
    s = null;
    cancelAnimationFrame(frame);
    if (lock !== 'x') return;
    swallowClickUntil = Date.now() + 350; // the finger lifting must not also tap a button
    const [x0, t0] = samples[0];
    const [x1, t1] = samples[samples.length - 1];
    const velocity = t1 > t0 ? (x1 - x0) / (t1 - t0) : 0; // px per ms
    const next = index + (dx < 0 ? 1 : -1);
    const far = Math.abs(dx) > innerWidth * 0.25;
    const flick = Math.abs(velocity) > 0.35 && Math.abs(dx) > 36 && Math.sign(velocity) === Math.sign(dx);
    if (next < 0 || next >= order.length || !(far || flick)) { reset(body, true); return; }
    // Finish the slide out, then show the next tab sliding in.
    body.classList.add('is-settling');
    body.style.transform = `translate3d(${dx < 0 ? -innerWidth * 0.3 : innerWidth * 0.3}px, 0, 0)`;
    body.style.opacity = '0';
    setTimeout(() => change(order[next]), 110);
  };
  app.addEventListener('touchend', end);
  app.addEventListener('touchcancel', () => { if (s) { const b = s.body; s = null; reset(b, true); } });

  // Capture phase: runs before the app's own click handler.
  app.addEventListener('click', (e) => {
    if (Date.now() < swallowClickUntil) { e.stopPropagation(); e.preventDefault(); }
  }, true);
}
