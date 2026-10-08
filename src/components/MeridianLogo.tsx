import React, { useState } from 'react';

/**
 * Meridian Interface credit — the studio that built this site.
 *
 * The artwork is the studio's own file. The mark is used exactly as drawn —
 * never redrawn, recoloured or reshaped. Two things about the file matter:
 *
 *  - The original 1024x1024 export is mostly empty canvas: the artwork fills
 *    77% of its width but only 45% of its height. Sizing that file makes the
 *    mark look tiny, because most of what you sized was margin. This uses a
 *    trimmed export instead, 885x550.
 *  - The original carries its own off-white ground, which read as a pale box on
 *    the dark footer. The ground is knocked out here.
 *
 * In this footer variant the M keeps its original blue-greys pixel for pixel;
 * only the "MERIDIAN INTERFACE" lettering beneath it is set to the brand
 * off-white (#F7F8F3) so it reads on near-black. The two sit in separate
 * horizontal bands of the file — the mark ends at row 380, the lettering starts
 * at row 443 — so the recolour never touches the mark.
 *
 * `size` is a WIDTH. Height follows from the artwork's proportions.
 */

export const MERIDIAN_LOGO_SRC = '/meridian-logo-wordmark.png';

interface MeridianLogoProps {
  /** Width in px. Below ~120 the lettering stops being legible. */
  size?: number;
  className?: string;
}

export const MeridianLogo: React.FC<MeridianLogoProps> = ({ size = 168, className = '' }) => {
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
    <img
      src={MERIDIAN_LOGO_SRC}
      alt="Meridian Interface"
      onError={() => setLogoMissing(true)}
      className={className}
      style={{ width: size, height: 'auto', display: 'block' }}
    />
  );
};
