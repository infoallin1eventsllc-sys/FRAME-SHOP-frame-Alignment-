import React, { useState } from 'react';

/**
 * Meridian Interface credit — the studio that built this site.
 *
 * The mark is the studio's own artwork, used as supplied and not redrawn. Drop
 * the file in at public/meridian-logo.png (or .svg and change the path) and it
 * appears here. Until then the credit still reads correctly as text, so the
 * footer is never showing a broken image.
 */

export const MERIDIAN_LOGO_SRC = '/meridian-logo.png';

interface MeridianLogoProps {
  /** Height of the mark in px. */
  size?: number;
  /** Show the "Meridian Interface" wordmark as text beside the mark. */
  showWordmark?: boolean;
  className?: string;
}

export const MeridianLogo: React.FC<MeridianLogoProps> = ({
  size = 26,
  showWordmark = true,
  className = '',
}) => {
  const [logoMissing, setLogoMissing] = useState(false);

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {!logoMissing && (
        <img
          src={MERIDIAN_LOGO_SRC}
          alt="Meridian Interface"
          height={size}
          style={{ height: size, width: 'auto', display: 'block', flexShrink: 0 }}
          onError={() => setLogoMissing(true)}
        />
      )}
      {(showWordmark || logoMissing) && (
        <span
          className="font-semibold uppercase leading-none whitespace-nowrap"
          style={{ fontSize: size * 0.34, letterSpacing: '0.1em' }}
        >
          Meridian Interface
        </span>
      )}
    </span>
  );
};
