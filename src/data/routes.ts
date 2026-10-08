/**
 * Every page this site has. The server uses it to answer unknown addresses
 * with a real 404 and to list the pages in sitemap.xml; the browser uses it to
 * choose which page to draw. One list, so the two can never disagree.
 */
export const LEGAL_PATHS = ['/privacy', '/terms', '/refunds', '/cookies'] as const;
export type LegalPath = (typeof LEGAL_PATHS)[number];

export const SITE_PAGES: readonly string[] = ['/', ...LEGAL_PATHS];

export const cleanPath = (pathname: string) => pathname.replace(/\/+$/, '') || '/';

export const isKnownPage = (pathname: string) => SITE_PAGES.includes(cleanPath(pathname));
