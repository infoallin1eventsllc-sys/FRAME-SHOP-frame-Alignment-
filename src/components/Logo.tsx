import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'auto';
  variant?: 'light' | 'dark' | 'orange';
  showSubtext?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  variant = 'orange',
  showSubtext = true
}) => {
  // Size mappings
  const heightClasses = {
    sm: 'h-9 sm:h-10',
    md: 'h-12 sm:h-14',
    lg: 'h-20 sm:h-24',
    xl: 'h-32 sm:h-40',
    auto: 'w-full h-auto'
  }[size];

  // Colors based on variant
  // orange variant: high contrast white/zinc with vibrant orange brand accents
  const borderPrimary = variant === 'orange' ? '#ea580c' : variant === 'dark' ? '#18181b' : '#f4f4f5';
  const borderSecondary = variant === 'orange' ? '#f97316' : variant === 'dark' ? '#27272a' : '#e4e4e7';
  const textPrimary = variant === 'orange' ? '#ffffff' : variant === 'dark' ? '#09090b' : '#ffffff';
  const textAccent = variant === 'orange' ? '#ea580c' : variant === 'dark' ? '#ea580c' : '#f97316';
  const motoColor = variant === 'orange' ? '#f4f4f5' : variant === 'dark' ? '#18181b' : '#ffffff';

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <svg
        viewBox="0 0 600 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${heightClasses} object-contain transition-transform filter drop-shadow-sm`}
        aria-label="The Frame Shop - Frame & Alignment Logo"
        shapeRendering="geometricPrecision"
        textRendering="geometricPrecision"
      >
        <defs>
          <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
        </defs>

        {/* Outer Heavy Diamond Border */}
        <polygon
          points="300,12 584,180 300,348 16,180"
          stroke={borderPrimary}
          strokeWidth="7"
          strokeLinejoin="miter"
          fill="none"
        />

        {/* Inner Thin Diamond Border Line */}
        <polygon
          points="300,24 568,180 300,336 32,180"
          stroke={borderSecondary}
          strokeWidth="2"
          strokeLinejoin="miter"
          fill="none"
        />

        {/* --- STYLIZED MOTORCYCLE SILHOUETTE --- */}
        <g stroke={motoColor} fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* Main Tank & Frame Flowing Top Line */}
          <path
            d="M 145 145 C 175 130 205 155 235 145 C 265 135 295 105 340 92 C 360 86 375 95 385 118"
            strokeWidth="4"
          />
          
          {/* Windshield & Fairing Contours */}
          <path
            d="M 335 55 C 348 48 375 62 385 92 L 372 120 C 358 110 340 82 335 55 Z"
            strokeWidth="3"
            fill="none"
          />
          <path
            d="M 345 68 C 355 62 370 72 376 92"
            strokeWidth="2"
            opacity="0.8"
          />

          {/* Front Fork & Steering Stem */}
          <path
            d="M 352 98 L 412 178"
            strokeWidth="5.5"
          />

          {/* Front Wheel Circles */}
          <circle cx="418" cy="182" r="38" strokeWidth="4.5" />
          <circle cx="418" cy="182" r="34" strokeWidth="1.5" opacity="0.6" />
        </g>

        {/* Left Sweeping Crescent Arc surrounding "SHOP" */}
        <path
          d="M 140 152 C 112 180 110 218 136 238 C 158 254 188 254 218 244"
          stroke={textAccent}
          strokeWidth="4.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* --- LOGO TEXT ELEMENTS --- */}
        
        {/* "THE" */}
        <text
          x="300"
          y="136"
          fill={textPrimary}
          fontSize="24"
          fontWeight="900"
          fontFamily="'Arial Black', 'Impact', sans-serif"
          letterSpacing="10"
          textAnchor="middle"
        >
          THE
        </text>

        {/* "FRAME" */}
        <text
          x="288"
          y="174"
          fill={textPrimary}
          fontSize="44"
          fontWeight="900"
          fontFamily="'Arial Black', 'Impact', 'Trebuchet MS', sans-serif"
          letterSpacing="8"
          textAnchor="middle"
          transform="scale(1, 0.92) translate(0, 15)"
        >
          FRAME
        </text>

        {/* "SHOP" */}
        <text
          x="292"
          y="218"
          fill={textAccent}
          fontSize="56"
          fontWeight="900"
          fontFamily="'Arial Black', 'Impact', sans-serif"
          letterSpacing="6"
          textAnchor="middle"
          fontStyle="italic"
          transform="scale(1.05, 0.88) translate(-12, 30)"
        >
          SHOP
        </text>

        {/* "Frame & Alignment" */}
        {showSubtext && (
          <text
            x="295"
            y="238"
            fill={textPrimary}
            fontSize="25"
            fontWeight="800"
            fontFamily="'Arial Black', 'Trebuchet MS', sans-serif"
            letterSpacing="3.5"
            textAnchor="middle"
          >
            Frame &amp; Alignment
          </text>
        )}
      </svg>
    </div>
  );
};

