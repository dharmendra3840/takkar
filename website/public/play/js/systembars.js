// Android edge to edge (0.5.2 and newer): the app draws behind see-through status and navigation bars.
// The bar heights come from the app, because Android's WebView doesn't report them reliably to CSS.
// Older APKs and the web app have no plugin; CSS env() covers iPhones.
const plugin = () => window.Capacitor?.Plugins?.SystemBars;
let dark = null;

function setInsets({ top, bottom }) {
  const root = document.documentElement.style;
  root.setProperty('--safe-top', `${top}px`);
  root.setProperty('--safe-bottom', `${bottom}px`);
}

export function initSystemBars() {
  const p = plugin();
  if (!p) return;
  const root = document.documentElement;
  root.classList.add('edge');
  // The frosted strip behind the clock shows only once the page scrolls under it.
  const onScroll = () => root.classList.toggle('edge--scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  p.addListener('insets', setInsets);
  p.getInsets().then(setInsets).catch(() => { /* keep the CSS fallback */ });
}

/** White bar icons over dark screens, dark icons over light ones. */
export function matchSystemBars(isDark) {
  const p = plugin();
  if (!p || isDark === dark) return;
  dark = isDark;
  document.documentElement.classList.toggle('edge--dark', isDark);
  p.setStyle({ dark: isDark }).catch(() => { /* the icons keep their colour */ });
}
