import React, { useState, useEffect } from 'react';
import { SHOP_INFO } from '../data/shopData';
import { Wrench, ShieldCheck, MapPin, Award, ArrowRight, Target, Check } from 'lucide-react';
import { fetchSiteMedia, onMediaUpdated } from '../utils/siteMedia';

interface AboutPaulProps {
  onOpenBooking: () => void;
}

// Default permanent photo of Paul Heary in shop
export const DEFAULT_PAUL_IMAGE = 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?q=80&w=1200&auto=format&fit=crop';

export const AboutPaul: React.FC<AboutPaulProps> = ({ onOpenBooking }) => {
  const [currentPhoto, setCurrentPhoto] = useState<string>(DEFAULT_PAUL_IMAGE);
  const [imgError, setImgError] = useState(false);

  // Comes from the server, so every visitor sees the photo Paul chose.
  useEffect(() => {
    let cancelled = false;
    const loadPhoto = () => {
      fetchSiteMedia().then(media => {
        if (cancelled) return;
        setCurrentPhoto(media.paulPhoto || DEFAULT_PAUL_IMAGE);
        setImgError(false);
      });
    };

    loadPhoto();
    const off = onMediaUpdated(loadPhoto);
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return (
    <section id="about-paul" className="py-24 bg-white border-t border-zinc-200 relative font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 sm:gap-12 items-center">
          
          {/* Photo / Visual Frame (Left Column) */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-none overflow-hidden border-2 border-zinc-200 shadow-2xl bg-zinc-900 group">
              
              {currentPhoto && !imgError ? (
                <div className="relative w-full h-[520px] bg-zinc-900">
                  <img
                    src={currentPhoto}
                    alt="Paul Heary - Owner & Head Mechanic"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover object-center filter contrast-110 transition-all duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                </div>
              ) : (
                /* High-Detail Photograph Artwork: Head Mechanic Paul Heary with Gold 3D Frame Shooter Tool */
                <div className="relative w-full h-[520px] bg-zinc-950 flex items-center justify-center overflow-hidden">
                  <svg
                    viewBox="0 0 600 650"
                    className="w-full h-full object-cover"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="30%" stopColor="#d97706" />
                        <stop offset="70%" stopColor="#fef08a" />
                        <stop offset="100%" stopColor="#b45309" />
                      </linearGradient>
                      <linearGradient id="goldVertical" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#fef08a" />
                        <stop offset="20%" stopColor="#d97706" />
                        <stop offset="80%" stopColor="#b45309" />
                        <stop offset="100%" stopColor="#78350f" />
                      </linearGradient>
                      <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f1c7ab" />
                        <stop offset="50%" stopColor="#dc9c78" />
                        <stop offset="100%" stopColor="#b87856" />
                      </linearGradient>
                      <linearGradient id="shirtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#1e293b" />
                        <stop offset="100%" stopColor="#0f172a" />
                      </linearGradient>
                      <filter id="laserGlow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* Workshop Background */}
                    <rect width="600" height="650" fill="#121215" />
                    {/* Corrugated Garage Door Horizontal Panels */}
                    <g opacity="0.18" stroke="#3f3f46" strokeWidth="2">
                      {Array.from({ length: 22 }).map((_, i) => (
                        <line key={i} x1="0" y1={i * 30} x2="600" y2={i * 30} />
                      ))}
                    </g>

                    {/* Background Shop Shelves & Tools (Right Side) */}
                    <rect x="470" y="30" width="120" height="300" fill="#27272a" opacity="0.3" />
                    <line x1="470" y1="100" x2="590" y2="100" stroke="#f97316" strokeWidth="2.5" opacity="0.5" />
                    <line x1="470" y1="180" x2="590" y2="180" stroke="#f97316" strokeWidth="2.5" opacity="0.5" />
                    <line x1="470" y1="250" x2="590" y2="250" stroke="#ef4444" strokeWidth="3" opacity="0.6" />

                    {/* Motorcycle Chassis & Primed Grey Tank (Center-Right) */}
                    <path
                      d="M 210 470 Q 350 370 530 450"
                      stroke="#52525b"
                      strokeWidth="52"
                      strokeLinecap="round"
                      fill="none"
                    />
                    {/* Primer Grey Fuel Tank */}
                    <path
                      d="M 250 430 Q 360 375 450 435"
                      fill="#64748b"
                      stroke="#334155"
                      strokeWidth="3"
                    />
                    <path
                      d="M 320 400 C 310 370, 390 360, 420 395 Z"
                      fill="#334155"
                    />
                    {/* Engine Mounts & Wiring Details */}
                    <circle cx="390" cy="480" r="18" fill="#18181b" stroke="#52525b" strokeWidth="3" />
                    <line x1="330" y1="460" x2="440" y2="520" stroke="#09090b" strokeWidth="6" />

                    {/* Paul Heary Portrait (Left Foreground Closeup) */}
                    {/* Torso - Navy Blue Work Shirt */}
                    <path
                      d="M 0 650 L 0 310 Q 90 270 200 320 L 240 650 Z"
                      fill="url(#shirtGrad)"
                    />
                    {/* Red Round Patch on Chest */}
                    <circle cx="45" cy="500" r="16" fill="#020617" stroke="#dc2626" strokeWidth="2" />
                    <text x="35" y="504" fill="#f87171" fontSize="9" fontWeight="900" fontFamily="sans-serif">3D</text>

                    {/* Neck */}
                    <path d="M 80 290 L 150 290 L 160 210 L 70 210 Z" fill="url(#skinGrad)" />

                    {/* Head / Face */}
                    <path d="M 35 120 C 25 220, 165 255, 185 160 C 195 95, 135 45, 80 55 C 48 60, 38 88, 35 120 Z" fill="url(#skinGrad)" />

                    {/* Hair & Beard */}
                    {/* Brown Textured Short Hair */}
                    <path d="M 35 110 C 30 55, 85 25, 160 45 C 188 55, 188 98, 178 115 C 150 65, 75 55, 35 110 Z" fill="#381d11" />
                    {/* Beard & Mustache */}
                    <path d="M 40 160 Q 35 255 125 258 Q 185 255 175 168 Q 155 205 125 210 Q 75 210 40 160 Z" fill="#65351a" />
                    <path d="M 65 240 Q 125 258 150 235" stroke="#d4d4d8" strokeWidth="2" fill="none" opacity="0.6" />
                    {/* Mustache */}
                    <path d="M 75 165 Q 115 182 150 165 C 135 152 95 152 75 165 Z" fill="#4d2713" />

                    {/* Eyes (Bright Blue) & Eyebrows */}
                    <path d="M 68 112 Q 90 102 108 112" stroke="#1c1917" strokeWidth="3.5" fill="none" />
                    <path d="M 132 112 Q 152 102 170 112" stroke="#1c1917" strokeWidth="3.5" fill="none" />
                    <circle cx="88" cy="120" r="5" fill="#0284c7" />
                    <circle cx="152" cy="120" r="5" fill="#0284c7" />
                    <circle cx="89" cy="119" r="1.5" fill="#ffffff" />
                    <circle cx="153" cy="119" r="1.5" fill="#ffffff" />

                    {/* Tattooed Arm Sleeve (Reaching Over Tool) */}
                    <path d="M 190 350 Q 330 300 500 300 Q 535 305 540 325 Q 490 365 330 375 Z" fill="url(#skinGrad)" />
                    {/* Dark Tattoo Sleeve Ink Patterns */}
                    <path
                      d="M 230 345 Q 350 320 490 320"
                      stroke="#0f172a"
                      strokeWidth="32"
                      strokeDasharray="10 6 14 5"
                      opacity="0.75"
                    />

                    {/* Hand gripping the top bar */}
                    <path d="M 510 290 Q 540 280 545 315 Q 520 330 500 315 Z" fill="url(#skinGrad)" stroke="#78350f" strokeWidth="1" />

                    {/* GOLD-ANODIZED 3D FRAME SHOOTER TOOL */}
                    {/* Top Horizontal Bar */}
                    <rect x="190" y="105" width="390" height="36" rx="4" fill="url(#goldGradient)" stroke="#78350f" strokeWidth="2" />
                    {/* Black Rubber Center Handle Grip */}
                    <rect x="290" y="107" width="130" height="32" rx="2" fill="#18181b" />

                    {/* Vertical Posts */}
                    <rect x="170" y="140" width="32" height="265" rx="3" fill="url(#goldVertical)" stroke="#78350f" strokeWidth="2" />
                    <rect x="540" y="140" width="32" height="265" rx="3" fill="url(#goldVertical)" stroke="#78350f" strokeWidth="2" />

                    {/* Lower Horizontal Bar */}
                    <rect x="190" y="375" width="390" height="38" rx="4" fill="url(#goldGradient)" stroke="#78350f" strokeWidth="2" />

                    {/* Black Adjustment Knobs & Clamps */}
                    <circle cx="225" cy="394" r="13" fill="#09090b" stroke="#3f3f46" strokeWidth="2" />
                    <circle cx="370" cy="394" r="13" fill="#09090b" stroke="#3f3f46" strokeWidth="2" />
                    <circle cx="556" cy="123" r="11" fill="#09090b" stroke="#3f3f46" strokeWidth="2" />

                    {/* Central Laser Housing Module */}
                    <rect x="335" y="175" width="75" height="50" rx="5" fill="#09090b" stroke="#f97316" strokeWidth="1.5" />
                    <circle cx="372" cy="200" r="9" fill="#dc2626" filter="url(#laserGlow)" />
                    <circle cx="372" cy="200" r="4.5" fill="#fef08a" />

                    {/* Red Laser Beam Shot to Chassis */}
                    <line x1="372" y1="200" x2="415" y2="395" stroke="#ef4444" strokeWidth="3.5" filter="url(#laserGlow)" />
                    <circle cx="415" cy="395" r="6" fill="#fef08a" filter="url(#laserGlow)" />

                    {/* Frame Shooter Badge Label */}
                    <rect x="310" y="113" width="90" height="15" fill="#000000" rx="2" />
                    <text x="315" y="124" fill="#fef08a" fontSize="8" fontWeight="900" fontFamily="sans-serif">3D FRAME SHOOTER</text>
                  </svg>
                </div>
              )}

              {/* Laser Alignment Tool Tag */}
              <div className="absolute top-4 left-4 bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 shadow-md flex items-center gap-1.5 max-w-[calc(100%-80px)] truncate z-20">
                <Target className="w-3.5 h-3.5 text-white flex-shrink-0" />
                <span className="truncate">3D Laser Frame Alignment</span>
              </div>

              {/* Name & Role Overlay Badge */}
              <div className="absolute bottom-6 left-6 right-6 bg-zinc-950/95 p-5 rounded-none border border-zinc-800 backdrop-blur-sm shadow-xl">
                <div>
                  <div className="text-2xl font-black text-zinc-100 uppercase italic tracking-tight">{SHOP_INFO.owner}</div>
                  <div className="text-xs text-orange-500 font-bold uppercase tracking-widest mt-0.5">{SHOP_INFO.role}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-2 uppercase font-bold tracking-wider">
                    <MapPin className="w-3.5 h-3.5 text-orange-600" />
                    <span>The Frame Shop • Spring, TX</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Bio Story (Right Column) */}
          <div className="lg:col-span-7 space-y-6">
            
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-orange-600 flex items-center gap-2">
                <Award className="w-4 h-4 text-orange-600" />
                <span>The Mechanic Behind The Shop</span>
              </div>
              <h2 className="text-4xl sm:text-6xl font-black text-zinc-900 uppercase italic tracking-tighter">
                PAUL <span className="text-orange-600">HUREY</span>
              </h2>
              <div className="text-sm font-black text-orange-600 uppercase tracking-widest">
                OWNER &amp; HEAD MECHANIC // 30+ YEARS CRAFTSMANSHIP
              </div>
            </div>

            <div className="space-y-4 text-zinc-700 text-sm sm:text-base font-normal leading-relaxed">
              <p>
                Paul Hurey grew up in upstate New York, where his fascination with machines started early. While he was drawn to anything with a motor, motorcycles quickly became his true passion.
              </p>
              <p>
                He spent years riding, taking bikes apart, and rebuilding them, developing a deep, hands-on understanding of how they work. For Paul, motorcycles have never been just machines, but something to respect and master. His passion also connected him to the riding community, shaping both his mechanical skills and his appreciation for the culture.
              </p>
              <p>
                As he built a life centered on family and hard work, Paul turned his lifelong passion into a profession. Today, he brings decades of experience to <strong className="text-zinc-900 font-bold">The Frame Shop, Frame and Alignment</strong> in Spring, Texas, where he specializes in motorcycle framework and 3D laser alignment.
              </p>
              <p>
                Paul takes pride in doing the job right the first time, treating every bike with the same care as his own. His goal is simple: <strong className="text-orange-600 font-bold">honest work, done well, so riders can get back on the road with total confidence.</strong>
              </p>
            </div>

            {/* Owner Quote Block */}
            <div className="p-5 rounded-none bg-zinc-50 border border-zinc-200 text-sm text-zinc-800 italic font-bold space-y-1">
              <div className="text-[10px] text-orange-600 font-bold uppercase tracking-widest not-italic mb-1">
                Owner Philosophy
              </div>
              <p>
                "For Paul, motorcycles are not just a career. They are a lifelong craft and way of life."
              </p>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button
                onClick={onOpenBooking}
                className="bg-orange-600 hover:bg-orange-500 text-white font-black px-7 py-3.5 rounded-none text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg"
              >
                <Wrench className="w-4 h-4" />
                <span>Schedule With Paul</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-2 text-xs text-zinc-600 justify-center font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-orange-600" />
                <span>Zero-Tolerance Precision Guarantee</span>
              </div>
            </div>

          </div>

        </div>

      </div>

    </section>
  );
};

