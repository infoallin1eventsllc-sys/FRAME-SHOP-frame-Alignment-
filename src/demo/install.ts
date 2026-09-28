/**
 * Switches demo mode on: /api requests on this page are answered by
 * demoServer.ts instead of the network, and a small label says so.
 * Only imported by a `--mode demo` build (see main.tsx).
 */
import { handleDemoRequest, resetDemo } from './demoServer';

export function installDemo() {
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : null;
    const url = new URL(req ? req.url : String(input), window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
      return realFetch(input, init);
    }
    const headers = new Headers(init?.headers ?? req?.headers);
    let body: unknown = undefined;
    const raw = init?.body ?? (req ? await req.text() : undefined);
    if (typeof raw === 'string' && raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
    }
    // A moment's delay, so loading states show as they would on the live site.
    await new Promise((r) => setTimeout(r, 120));
    return handleDemoRequest(init?.method ?? req?.method ?? 'GET', url, headers, body);
  };

  const mount = () => {
    const tag = document.createElement('div');
    tag.setAttribute('role', 'note');
    tag.setAttribute('data-testid', 'demo-label');
    tag.style.cssText = [
      'position:fixed', 'right:12px', 'bottom:calc(76px + env(safe-area-inset-bottom))', 'z-index:70',
      'display:flex', 'align-items:center', 'gap:8px', 'padding:4px 4px 4px 10px',
      'background:#fef3c7', 'color:#78350f', 'border:2px solid #d97706',
      'font:700 11px/1.2 system-ui,-apple-system,sans-serif', 'letter-spacing:.04em',
      'box-shadow:0 4px 14px rgba(0,0,0,.35)', 'max-width:calc(100vw - 24px)',
    ].join(';');
    tag.innerHTML =
      '<span title="Test data, saved in this browser only. Nothing is sent to the shop.">DEMO · test data only</span>' +
      '<button type="button" style="font:inherit;background:#78350f;color:#fef3c7;border:0;padding:4px 8px;cursor:pointer">Reset</button>';
    tag.querySelector('button')!.addEventListener('click', () => {
      if (window.confirm('Clear all demo bookings, messages, rates and photos?')) {
        resetDemo();
        try {
          sessionStorage.removeItem('shop_admin_token');
        } catch {
          /* not stored */
        }
        window.location.reload();
      }
    });
    document.body.appendChild(tag);
    // Clear of the mobile bottom bar on phones; close to the corner on wider screens.
    const place = () => (tag.style.bottom = window.innerWidth >= 768 ? '12px' : 'calc(76px + env(safe-area-inset-bottom))');
    place();
    window.addEventListener('resize', place);
  };
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
}
