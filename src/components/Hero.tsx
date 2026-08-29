import React, { useState, useEffect } from 'react';
import { SHOP_INFO } from '../data/shopData';
import { Calendar, Compass, ShieldCheck, Wrench, ArrowRight, Award, MapPin, Phone } from 'lucide-react';
import { Logo } from './Logo';

export const HERO_IMAGE_KEY = 'theframeshop_hero_image';
export const DEFAULT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&q=85&w=2000';

interface HeroProps {
  onOpenBooking: () => void;
  onNavigate: (sectionId: string) => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenBooking, onNavigate }) => {
  const [heroImage, setHeroImage] = useState<string>(() => {
    try {
      return localStorage.getItem(HERO_IMAGE_KEY) || DEFAULT_HERO_IMAGE;
    } catch {
      return DEFAULT_HERO_IMAGE;
    }
  });

  useEffect(() => {
    const sync = () => {
      try {
        setHeroImage(localStorage.getItem(HERO_IMAGE_KEY) || DEFAULT_HERO_IMAGE);
      } catch {
        setHeroImage(DEFAULT_HERO_IMAGE);
      }
    };
    window.addEventListener('storage', sync);
    window.addEventListener('hero_image_updated', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('hero_image_updated', sync);
    };
  }, []);

  return (
    <section id="hero" className="relative min-h-[92vh] flex items-center pt-28 pb-16 bg-zinc-950 overflow-hidden font-sans">
      {/* Background Image with Dark Zinc Overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* A blown-up, blurred copy fills the wide frame so a squarer photo has
            no bare edges. Purely decorative — the sharp copy carries the alt. */}
        <img
          src={heroImage}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center scale-110 blur-2xl opacity-45"
        />
        {/* The photo itself, whole and unzoomed, sitting right of the headline. */}
        <img
          src={heroImage}
          alt="Custom Harley Davidson motorcycle"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-contain object-center lg:object-right opacity-95 filter contrast-110 saturate-110 brightness-105 transition-all duration-700"
        />
        {/* Multi-directional gradient overlay tuned for high motorcycle visibility & text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/45 to-zinc-950/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/85 via-zinc-950/40 to-transparent" />
        {/* Subtle laser alignment warm glow accent */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-600/20 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Decorative Oversized Background Text */}
      <div className="absolute bottom-[-10px] left-[-20px] opacity-[0.03] select-none pointer-events-none hidden md:block">
        <div className="text-[260px] font-black uppercase leading-none italic tracking-tighter text-zinc-100">ALIGN</div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          
          {/* Left Hero Copy */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Top Logo Badge */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="bg-zinc-900/90 border border-zinc-800 p-2 shadow-xl inline-flex items-center gap-3">
                <Logo size="sm" variant="orange" showSubtext={false} />
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-300 border-l border-zinc-800 pl-3 py-1">
                  OFFICIAL SHOP EMBLEM
                </div>
              </div>

              <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2.5 rounded-none text-orange-500 text-xs font-black uppercase tracking-widest">
                <Award className="w-3.5 h-3.5 text-orange-600" />
                <span>30+ Years Precision Alignment</span>
              </div>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[105px] leading-[0.85] font-black text-zinc-100 uppercase italic tracking-tighter">
              ZERO <span className="text-orange-600">TOLERANCE.</span> <br />
              PURE <span className="text-zinc-50">ALIGNMENT.</span>
            </h1>

            {/* Sub-headline */}
            <p className="max-w-xl text-zinc-400 text-sm sm:text-base leading-relaxed font-normal">
              Laser-guided frame straightening and powertrain chassis alignment for performance motorcycles. At <strong className="text-zinc-100 font-bold">The Frame Shop</strong> in Spring, TX, Head Mechanic <strong className="text-orange-500 font-bold">Paul Hurey</strong> restores chassis geometry to factory specs or better.
            </p>

            {/* Stats row */}
            <div className="flex gap-12 items-center pt-2">
              <div>
                <div className="text-3xl sm:text-4xl font-black italic text-zinc-50">0.01mm</div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mt-1">Precision Target Baseline</div>
              </div>
              <div className="h-10 w-px bg-zinc-800" />
              <div>
                <div className="text-3xl sm:text-4xl font-black italic text-orange-600">1,200+</div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mt-1">Frames &amp; Chasses Aligned</div>
              </div>
            </div>

            {/* CTA Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
              <button
                onClick={onOpenBooking}
                className="bg-orange-600 hover:bg-orange-500 text-white font-black px-8 py-4 rounded-none shadow-xl transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest group cursor-pointer"
                id="hero-book-now-btn"
              >
                <Calendar className="w-4 h-4" />
                <span>Book Inspection</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => onNavigate('diagnostic')}
                className="bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold px-6 py-4 rounded-none border border-zinc-800 hover:border-orange-600/50 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest cursor-pointer"
              >
                <Compass className="w-4 h-4 text-orange-600" />
                <span>Run Diagnostic Tool</span>
              </button>
            </div>

            {/* Quick Contact Bar */}
            <div className="pt-6 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-zinc-400">
              <a 
                href={`tel:${SHOP_INFO.phoneRaw}`} 
                className="flex items-center gap-3 bg-zinc-900/80 p-3.5 rounded-none border border-zinc-800 hover:border-orange-600 transition-colors"
              >
                <Phone className="w-4 h-4 text-orange-600 flex-shrink-0" />
                <div>
                  <div className="font-bold text-zinc-200 uppercase text-[11px]">{SHOP_INFO.phone}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Call or Text Paul</div>
                </div>
              </a>

              <div className="flex items-center gap-3 bg-zinc-900/80 p-3.5 rounded-none border border-zinc-800">
                <MapPin className="w-4 h-4 text-orange-600 flex-shrink-0" />
                <div>
                  <div className="font-bold text-zinc-200 uppercase text-[11px]">Spring, Texas</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">7531 Unit C Root Rd</div>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-zinc-900/80 p-3.5 rounded-none border border-zinc-800">
                <Wrench className="w-4 h-4 text-orange-600 flex-shrink-0" />
                <div>
                  <div className="font-bold text-zinc-200 uppercase text-[11px]">Harley &amp; Custom V-Twin</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">3D Laser Alignment</div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Specialties — kept low and translucent so the bike stays visible */}
          <div className="lg:col-span-4">
            <div className="bg-zinc-900/75 backdrop-blur-sm border border-zinc-800 rounded-none p-5 shadow-2xl space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-orange-600 border-b border-zinc-800 pb-2.5 flex items-center justify-between">
                <span>Our Specialties</span>
                <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
              </div>

              <ul className="space-y-1.5">
                <li className="text-sm font-black uppercase italic text-zinc-100 hover:text-orange-500 transition-colors cursor-default leading-snug">
                  3D Powertrain Alignment
                </li>
                <li className="text-sm font-black uppercase italic text-zinc-100 hover:text-orange-500 transition-colors cursor-default leading-snug">
                  Frame &amp; Neck Straightening
                </li>
                <li className="text-sm font-black uppercase italic text-zinc-100 hover:text-orange-500 transition-colors cursor-default leading-snug">
                  Swingarm &amp; Fork Geometry
                </li>
              </ul>

              <p className="text-[11px] text-zinc-400 italic font-normal border-l-2 border-orange-600 pl-2.5 leading-relaxed">
                "If I won't ride it at 90mph, it doesn't leave my shop."
              </p>

              <button
                onClick={() => onNavigate('services')}
                className="w-full bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 font-extrabold py-2.5 text-[11px] uppercase tracking-widest transition-colors cursor-pointer rounded-none border border-zinc-700"
              >
                Explore All Services
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
