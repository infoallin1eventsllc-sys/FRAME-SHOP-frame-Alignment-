import React, { useState } from 'react';

/**
 * Meridian Interface credit — the studio that built this site.
 *
 * The artwork is the studio's own file, used exactly as supplied: not redrawn,
 * recoloured or cropped. It carries its own wordmark, so no text is set beside
 * it, and it has a light ground of its own, so on the dark footer it is given a
 * panel in the same off-white rather than being knocked out or made transparent.
 */

export const MERIDIAN_LOGO_SRC = '/meridian-logo.png';

interface MeridianLogoProps {
  /** Height of the logo panel in px. */
  size?: number;
  className?: string;
}

export const MeridianLogo: React.FC<MeridianLogoProps> = ({ size = 76, className = '' }) => {
  const [logoMissing, setLogoMissing] = useState(false);

  // If the file is ever absent the credit still reads, rather than showing a
  // broken image on a client's live site.
  if (logoMissing) {
    return (
      <span className={`font-semibold uppercase tracking-[0.1em] ${className}`}>
        Meridian Interface
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-sm overflow-hidden ${className}`}
      style={{ background: '#F5F4F0', padding: size * 0.02 }}
    >
      <img
        src={MERIDIAN_LOGO_SRC}
        alt="Meridian Interface"
        onError={() => setLogoMissing(true)}
        style={{ height: size, width: size, display: 'block' }}
      />
    </span>
  );
};
