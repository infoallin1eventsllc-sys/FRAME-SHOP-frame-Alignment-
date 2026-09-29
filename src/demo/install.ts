/**
 * Switches demo mode on: /api requests on this page are answered by
 * demoServer.ts instead of the network, and a small label says so.
 * Only imported by a `--mode demo` build (see main.tsx).
 */
import { handleDemoRequest, resetDemo } from './demoServer';
import { saveVideo } from './videoStore';

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

  installUploadShim();
  installDialogFallback();

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

/**
 * The portal uploads video with XMLHttpRequest (for the progress bar), which
 * the fetch hook above does not see. This answers that one upload, in the
 * browser, with the same progress events and reply the server gives.
 */
function installUploadShim() {
  const Real = window.XMLHttpRequest;
  class DemoXHR extends Real {
    private demo = false;
    private headers: Record<string, string> = {};
    open(method: string, url: string | URL, ...rest: any[]) {
      const u = new URL(String(url), window.location.href);
      this.demo = u.origin === window.location.origin && u.pathname === '/api/videos/upload';
      if (!this.demo) return (super.open as any)(method, url, ...rest);
    }
    setRequestHeader(name: string, value: string) {
      if (this.demo) this.headers[name.toLowerCase()] = value;
      else super.setRequestHeader(name, value);
    }
    send(body?: Document | XMLHttpRequestBodyInit | null) {
      if (!this.demo) return super.send(body as any);
      const file = body as Blob;
      const total = file?.size || 1;
      const reply = (status: number, payload: object) => {
        Object.defineProperty(this, 'status', { value: status, configurable: true });
        Object.defineProperty(this, 'readyState', { value: 4, configurable: true });
        Object.defineProperty(this, 'responseText', { value: JSON.stringify(payload), configurable: true });
        this.onload?.(new ProgressEvent('load') as any);
      };
      if (this.headers['x-shop-secret'] !== 'demo-owner') return void setTimeout(() => reply(401, { error: 'Unauthorized.' }), 50);
      // A short run of progress events, so the bar moves as it does on the live site.
      let step = 0;
      const tick = setInterval(async () => {
        step += 1;
        (this.upload.onprogress as ((e: ProgressEvent) => void) | null)?.(new ProgressEvent('progress', { lengthComputable: true, loaded: Math.min(total, (total * step) / 5), total }));
        if (step < 5) return;
        clearInterval(tick);
        const key = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const url = await saveVideo(key, file);
        reply(200, { url, objectName: key });
      }, 120);
    }
  }
  window.XMLHttpRequest = DemoXHR as unknown as typeof XMLHttpRequest;
}

/**
 * The preview viewer may block pop-up dialogs. A blocked alert() shows nothing,
 * and a blocked confirm() returns false at once — so a warning vanished and a
 * "Delete?" could never be answered yes. Detected by timing (no person answers
 * a dialog in under 50 ms): the message is shown on the page instead, and a
 * blocked confirm counts as yes. Demo data only.
 */
function installDialogFallback() {
  const note = (text: string) => {
    const el = document.createElement('div');
    el.setAttribute('role', 'alert');
    el.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:80;max-width:min(560px,calc(100vw - 24px));padding:12px 14px;background:#18181b;color:#fafafa;border:2px solid #ea580c;font:500 13px/1.45 system-ui,sans-serif;white-space:pre-line;box-shadow:0 8px 24px rgba(0,0,0,.45);cursor:pointer';
    el.textContent = text;
    el.title = 'Tap to close';
    el.addEventListener('click', () => el.remove());
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 9000);
  };
  const realAlert = window.alert.bind(window);
  const realConfirm = window.confirm.bind(window);
  window.alert = (msg?: any) => {
    const t = performance.now();
    realAlert(msg);
    if (performance.now() - t < 50) note(String(msg ?? ''));
  };
  window.confirm = (msg?: string) => {
    const t = performance.now();
    const answer = realConfirm(msg);
    if (!answer && performance.now() - t < 50) {
      note(`${msg ?? ''}\n\n(This preview can't show pop-ups, so this was confirmed.)`);
      return true;
    }
    return answer;
  };
}
