import React, { useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';

interface ClickToLoadMapProps {
  embedUrl: string;
  address: string;
  title: string;
}

/**
 * A Google Map that only loads when the visitor asks for it.
 *
 * An embedded map is the one thing on this site that sets third-party cookies:
 * loading it contacts Google, who set their own. The site sets none of its own
 * and runs no analytics, so this is the whole of its cookie footprint — and
 * holding the map back until it is wanted removes it entirely for everyone who
 * never clicks. That is a better answer than a consent banner, which Texas law
 * does not require and which every visitor would have to dismiss.
 *
 * "Get directions" is a plain link to Google Maps, so it sets nothing here.
 */
export const ClickToLoadMap: React.FC<ClickToLoadMapProps> = ({ embedUrl, address, title }) => {
  const [show, setShow] = useState(false);
  const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  if (show) {
    return (
      <iframe
        title={title}
        src={embedUrl}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allowFullScreen={false}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }

  return (
    <div data-testid="map-placeholder" className="w-full h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
      <MapPin className="w-8 h-8 text-orange-600" aria-hidden="true" />
      <p className="text-sm font-bold text-zinc-800">{address}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setShow(true)}
          className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-black uppercase tracking-widest px-4 py-2.5 cursor-pointer"
        >
          Show map
        </button>
        <a
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 border border-zinc-300 hover:border-orange-600 text-zinc-800 text-xs font-black uppercase tracking-widest px-4 py-2.5"
        >
          <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
          Get directions
        </a>
      </div>
      <p className="text-[11px] text-zinc-500 max-w-xs">
        Showing the map loads it from Google, which may set its own cookies.
      </p>
    </div>
  );
};
