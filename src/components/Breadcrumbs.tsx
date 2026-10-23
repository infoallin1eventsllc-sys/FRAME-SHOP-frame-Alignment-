import React from 'react';
import { ChevronRight } from 'lucide-react';

/** "Home › This page" on the pages that sit off the main site. */
export const Breadcrumbs: React.FC<{ current: string }> = ({ current }) => (
  <nav aria-label="Breadcrumb" className="mb-6">
    <ol className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
      <li>
        <a href="/" className="hover:text-orange-700">Home</a>
      </li>
      <li aria-hidden="true">
        <ChevronRight className="w-3.5 h-3.5" />
      </li>
      <li aria-current="page" className="text-zinc-800">{current}</li>
    </ol>
  </nav>
);
