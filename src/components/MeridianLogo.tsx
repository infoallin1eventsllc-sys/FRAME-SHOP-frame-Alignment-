import React from 'react';

/**
 * Meridian Interface mark — the studio that built this site.
 *
 * Drawn rather than loaded: a footer credit sits on a dark ground and needs to
 * stay crisp at any size, and an inline SVG costs no request and no hosting.
 * The meridian line through the M is the whole idea of the mark, so it runs
 * past the letter on both sides rather than being clipped to it.
 */

interface MeridianLogoProps {
  /** Height of the mark in px. The wordmark scales with it. */
  size?: number;
  /** Show "Meridian Interface" beside the mark. */
  showWordmark?: boolean;
  className?: string;
}

export const MeridianLogo: React.FC<MeridianLogoProps> = ({
  size = 22,
  showWordmark = true,
  className = '',
}) => (
  <span className={`inline-flex items-center gap-2 ${className}`} aria-hidden="true">
    <svg
      viewBox="0 0 156 100"
      height={size}
      width={size * 1.56}
      fill="none"
      role="presentation"
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* The M: two uprights meeting in a centre V, square-cut like the original */}
      <g transform="translate(18,0)">
        <path
          d="M14 88 V20 a8 8 0 0 1 8-8 h10 a8 8 0 0 1 7.2 4.5 L60 62 L80.8 16.5 A8 8 0 0 1 88 12 h10 a8 8 0 0 1 8 8 V88 a4 4 0 0 1-4 4 h-12 a4 4 0 0 1-4-4 V47 L67 84 a5 5 0 0 1-4.6 3 h-4.8 A5 5 0 0 1 53 84 L34 47 V88 a4 4 0 0 1-4 4 H18 a4 4 0 0 1-4-4 Z"
          fill="currentColor"
        />
      </g>
      {/* The meridian, running well past the letter on both sides */}
      <rect x="0" y="46" width="156" height="5" rx="2.5" fill="currentColor" opacity="0.8" />
    </svg>

    {showWordmark && (
      <span
        className="font-bold uppercase leading-none whitespace-nowrap"
        style={{ fontSize: size * 0.42, letterSpacing: '0.06em' }}
      >
        <span style={{ opacity: 0.75 }}>Meridian</span>{' '}
        <span>Interface</span>
      </span>
    )}
  </span>
);
