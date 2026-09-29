import React from 'react';
import { ArrowLeft, Phone } from 'lucide-react';
import { SHOP_INFO } from '../data/shopData';
import { LEGAL_PATHS } from '../data/routes';
import { Breadcrumbs } from './Breadcrumbs';

const LINKS: { href: string; label: string }[] = [
  { href: '/#services', label: 'Services' },
  { href: '/#our-work', label: 'Case studies' },
  { href: '/#faqs', label: 'Questions' },
  { href: '/#contact', label: 'Contact & directions' },
];

/**
 * An address the site doesn't have. The server sends it with a 404 status, so
 * search engines drop the address instead of indexing a second homepage.
 */
export const NotFoundPage: React.FC = () => {
  React.useEffect(() => {
    document.title = `Page not found — ${SHOP_INFO.name}`;
  }, []);

  return (
    <div className="min-h-screen bg-white text-zinc-800 font-sans">
      <header className="bg-zinc-950 border-b-4 border-orange-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-4">
          <a href="/" className="font-black text-zinc-100 uppercase italic tracking-tighter text-lg">
            THE FRAME <span className="text-orange-600">SHOP</span>
          </a>
          <a href="/" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-orange-500">
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to site
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Breadcrumbs current="Page not found" />

        <h1 className="text-3xl sm:text-4xl font-black uppercase italic tracking-tighter text-zinc-900" style={{ textWrap: 'balance' }}>
          This page isn't here
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed max-w-[60ch]">
          The link may be old or mistyped. Everything about the shop is on the main page:
        </p>

        <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="block border border-zinc-200 px-4 py-3 text-sm font-bold uppercase tracking-wider text-zinc-800 hover:border-orange-600 hover:text-orange-700">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-zinc-600">
          Looking for something specific?{' '}
          <a href={`tel:${SHOP_INFO.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1 font-bold text-orange-700">
            <Phone className="w-3.5 h-3.5" aria-hidden="true" />
            Call or text {SHOP_INFO.phone}
          </a>
        </p>

        <nav aria-label="Policies" className="mt-12 pt-6 border-t border-zinc-200 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold uppercase tracking-wider text-zinc-600">
          {LEGAL_PATHS.map((p) => (
            <a key={p} href={p} className="hover:text-orange-700">{p.slice(1)}</a>
          ))}
        </nav>
      </main>
    </div>
  );
};
