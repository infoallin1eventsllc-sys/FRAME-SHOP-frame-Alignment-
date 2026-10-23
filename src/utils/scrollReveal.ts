// Fades each block of the page up into place the first time it scrolls into
// view. Works on the markup the sections already share —
// <section> → container → blocks — so no component has to opt in; a grid's
// cards come in one after another instead of as one slab.
//
// Content is only hidden once this script has run (the `reveal-ready` class),
// so if it never runs nothing stays invisible. Visitors who ask their device
// for reduced motion get the page as it was.

const STAGGER_MS = 80;
const MAX_STAGGER_STEPS = 5;

// Sections that must show instantly: the hero is the first screen.
const SKIP = '#hero, [data-no-reveal]';

function targetsIn(root: ParentNode): HTMLElement[] {
  const found: HTMLElement[] = [];
  // Only the page's own sections, never anything inside a pop-up.
  root.querySelectorAll<HTMLElement>(':scope > section, :scope > footer').forEach((section) => {
    if (section.matches(SKIP)) return;
    const container = section.firstElementChild;
    if (!container) return;
    for (const block of Array.from(container.children) as HTMLElement[]) {
      if (block.classList.contains('grid')) {
        (Array.from(block.children) as HTMLElement[]).forEach((card, i) => {
          card.style.setProperty('--reveal-delay', `${Math.min(i, MAX_STAGGER_STEPS) * STAGGER_MS}ms`);
          found.push(card);
        });
      } else {
        found.push(block);
      }
    }
  });
  return found;
}

export function installScrollReveal(root: HTMLElement): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => {};

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-revealed');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0 },
  );

  // Tracked per install, not by the data-reveal attribute: React sets this up
  // twice in development, and the second install must still watch everything.
  const watched = new WeakSet<Element>();
  const scan = () => {
    for (const el of targetsIn(root)) {
      if (watched.has(el) || el.classList.contains('is-revealed')) continue;
      watched.add(el);
      el.setAttribute('data-reveal', '');
      io.observe(el);
    }
  };

  document.documentElement.classList.add('reveal-ready');
  scan();

  // Sections that fill in later (videos once they load, cards after a filter
  // tap) get picked up as they appear.
  let queued = false;
  const mo = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      scan();
    });
  });
  mo.observe(root, { childList: true, subtree: true });

  return () => {
    mo.disconnect();
    io.disconnect();
    document.documentElement.classList.remove('reveal-ready');
  };
}
