import React from 'react';
import { SHOP_INFO } from '../data/shopData';
import { Phone, MapPin, Instagram, Wrench, ShieldCheck, Lock } from 'lucide-react';
import { Logo } from './Logo';
import { MeridianLogo } from './MeridianLogo';

interface FooterProps {
  onOpenBooking: () => void;
  onNavigate: (sectionId: string) => void;
  onOpenAdmin?: () => void;
  onOpenTracker?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenBooking, onNavigate, onOpenAdmin, onOpenTracker }) => {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-800 text-zinc-400 py-16 text-xs font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Col 1: Shop Brand & Address */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-3">
              <Logo size="md" variant="orange" showSubtext={false} />
              <span className="font-black text-zinc-100 uppercase text-lg italic tracking-tighter">
                THE FRAME <span className="text-orange-600">SHOP</span>
              </span>
            </div>
            <p className="text-zinc-400 text-xs font-normal leading-relaxed">
              Specializing in motorcycle frame repair, 3D laser powertrain alignment, and suspension tuning in Spring, Texas.
            </p>
            <div className="text-xs text-orange-500 font-bold uppercase tracking-wider">
              Owner / Head Mechanic: {SHOP_INFO.owner}
            </div>
          </div>

          {/* Col 2: Quick Navigation */}
          <div className="space-y-2">
            <div className="text-zinc-100 font-black uppercase italic text-sm mb-3">Navigation</div>
            <ul className="space-y-2 uppercase font-bold text-[11px] tracking-wider">
              <li>
                <button onClick={() => onNavigate('services')} className="hover:text-orange-500 transition-colors">
                  Services Catalog
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('why-us')} className="hover:text-orange-500 transition-colors">
                  Why Choose Us
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('our-work')} className="hover:text-orange-500 transition-colors">
                  Our Work &amp; Specs
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('calculator')} className="hover:text-orange-500 transition-colors text-orange-500">
                  Rake &amp; Trail Calculator
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('diagnostic')} className="hover:text-orange-500 transition-colors">
                  Tracking Diagnostic Quiz
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('about-paul')} className="hover:text-orange-500 transition-colors">
                  About Paul Hurey
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Contact & Hours */}
          <div className="space-y-2">
            <div className="text-zinc-100 font-black uppercase italic text-sm mb-3">Shop Contact</div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                <a href={`tel:${SHOP_INFO.phoneRaw}`} className="text-zinc-100 hover:text-orange-500 font-black italic">
                  {SHOP_INFO.phone}
                </a>
              </div>
              <div className="flex items-start gap-2 text-zinc-300">
                <MapPin className="w-3.5 h-3.5 text-orange-600 flex-shrink-0 mt-0.5" />
                <span>{SHOP_INFO.address}</span>
              </div>
              <div className="text-zinc-500 pt-1 font-bold uppercase text-[11px]">
                Hours: {SHOP_INFO.hours}
              </div>
            </div>
          </div>

          {/* Col 4: Action & Guarantee */}
          <div className="space-y-3">
            <div className="text-zinc-100 font-black uppercase italic text-sm mb-1">Book Appointments</div>
            <p className="text-zinc-400 text-xs font-normal">
              Appointments scheduled in advance ensure undivided focus on your bike.
            </p>
            <button
              onClick={onOpenBooking}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-2.5 rounded-none text-xs uppercase tracking-widest transition-colors cursor-pointer"
            >
              Book Service Online
            </button>
            <a
              href={SHOP_INFO.instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 text-zinc-400 hover:text-white pt-1 text-xs uppercase font-bold tracking-wider"
            >
              <Instagram className="w-4 h-4 text-orange-500" />
              <span>Instagram {SHOP_INFO.instagramHandle}</span>
            </a>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-zinc-500 text-[11px] font-bold uppercase tracking-wider">
          <div className="flex items-center gap-4 flex-wrap">
            <span>© {new Date().getFullYear()} The Frame Shop. All Rights Reserved.</span>
            {onOpenTracker && (
              <button
                onClick={onOpenTracker}
                className="text-zinc-300 hover:text-orange-500 font-extrabold uppercase transition-colors cursor-pointer border-l border-zinc-800 pl-4"
              >
                Track Repair Ticket
              </button>
            )}
            {onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="text-zinc-500 hover:text-zinc-300 font-bold uppercase transition-colors cursor-pointer flex items-center gap-1 border-l border-zinc-800 pl-4 text-[10px]"
                title="Internal Owner Access (PIN Protected)"
              >
                <Lock className="w-3 h-3 text-zinc-500 hover:text-orange-500 transition-colors" />
                <span>Owner Login</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
            <span>Zero-Tolerance Motorcycle Frame &amp; Alignment Craftsmanship</span>
          </div>
        </div>

        {/* Studio credit */}
        <div className="pt-8 mt-6 border-t border-zinc-900 flex flex-col items-center gap-3 text-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">
            This website was built by
          </span>

          <a
            href="https://meridianinterface.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Meridian Interface"
            className="opacity-85 hover:opacity-100 transition-opacity"
          >
            <MeridianLogo size={150} />
          </a>

          <p className="max-w-md text-[11px] text-zinc-500 font-normal normal-case tracking-normal leading-relaxed">
            Websites, applications, and always-on marketing systems for growing businesses.
          </p>

          <div className="flex items-center gap-3 flex-wrap justify-center text-[11px] font-bold">
            <a
              href="https://meridianinterface.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-300 hover:text-orange-500 transition-colors normal-case tracking-normal"
            >
              meridianinterface.com
            </a>
            <span className="text-zinc-700" aria-hidden="true">•</span>
            <a
              href="mailto:otis@meridianinterface.com"
              className="text-zinc-400 hover:text-orange-500 transition-colors normal-case tracking-normal"
            >
              otis@meridianinterface.com
            </a>
            <span className="text-zinc-700" aria-hidden="true">•</span>
            <a
              href="tel:+12818829198"
              className="text-zinc-400 hover:text-orange-500 transition-colors normal-case tracking-normal"
            >
              (281) 882-9198
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
};
