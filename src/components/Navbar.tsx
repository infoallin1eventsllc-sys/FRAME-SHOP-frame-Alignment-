import React, { useState, useEffect } from 'react';
import { SHOP_INFO } from '../data/shopData';
import { Phone, MapPin, Clock, Calendar, Menu, X, ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';

interface NavbarProps {
  onOpenBooking: () => void;
  onNavigate: (sectionId: string) => void;
  onOpenAdmin?: () => void;
  onOpenTracker?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenBooking, onNavigate, onOpenAdmin, onOpenTracker }) => {
  const [isScrolled, setIsStyleScrolled] = useState(false);
  const [mobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOpenNow, setIsOpenNow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setIsStyleScrolled(true);
      } else {
        setIsStyleScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);

    // Calculate shop status (Tue-Sat, 9AM-6PM approximate for UI indicator)
    const now = new Date();
    const day = now.getDay(); // 0 is Sun, 2 is Tue, 6 is Sat
    const hour = now.getHours();
    if (day >= 2 && day <= 6 && hour >= 9 && hour < 18) {
      setIsOpenNow(true);
    } else {
      setIsOpenNow(false);
    }

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLinkClick = (id: string) => {
    onNavigate(id);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 transition-all duration-300">
      {/* Top Banner Info Bar */}
      <div className="bg-zinc-950 border-b border-zinc-800 text-xs text-zinc-400 py-2 px-6 hidden md:block font-sans">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <a 
              href={`tel:${SHOP_INFO.phoneRaw}`} 
              className="flex items-center gap-1.5 text-zinc-300 hover:text-orange-500 transition-colors font-bold uppercase tracking-wider text-[11px]"
            >
              <Phone className="w-3.5 h-3.5 text-orange-600" />
              <span>{SHOP_INFO.phone}</span>
            </a>
            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <MapPin className="w-3.5 h-3.5 text-orange-600" />
              <span>{SHOP_INFO.address}</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-orange-600" />
              <span>TUE - SAT // BY APPOINTMENT ONLY</span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-[11px] font-bold uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-none ${isOpenNow ? 'bg-emerald-500 animate-pulse' : 'bg-orange-600'}`}></span>
              <span className="text-zinc-300">{isOpenNow ? 'Shop Open Today' : 'By Appointment Only'}</span>
            </div>
            <a 
              href={SHOP_INFO.instagramUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="text-zinc-400 hover:text-orange-500 transition-colors"
            >
              IG {SHOP_INFO.instagramHandle}
            </a>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className={`transition-all duration-300 border-b ${
        isScrolled 
          ? 'bg-zinc-950/95 backdrop-blur-md border-zinc-800 shadow-2xl py-3' 
          : 'bg-zinc-950/90 backdrop-blur-sm py-4 border-zinc-800/80'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          {/* Logo */}
          <button 
            onClick={() => handleLinkClick('hero')}
            className="flex items-center gap-3 text-left group focus:outline-none py-1 hover:opacity-95 transition-opacity"
            id="brand-logo-btn"
          >
            <Logo size="md" variant="orange" showSubtext={false} />
            <div className="hidden sm:block border-l border-zinc-800 pl-3">
              <div className="text-sm font-black tracking-tighter uppercase leading-none text-zinc-50 italic">
                THE FRAME SHOP <span className="text-orange-600">ALIGNMENT</span>
              </div>
              <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">
                SPRING, TX // EST. 1998
              </div>
            </div>
          </button>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-8 text-xs font-bold uppercase tracking-widest text-zinc-300">
            <button 
              onClick={() => handleLinkClick('services')}
              className="hover:text-orange-500 transition-colors py-1 cursor-pointer"
            >
              Services
            </button>
            <button 
              onClick={() => handleLinkClick('why-us')}
              className="hover:text-orange-500 transition-colors py-1 cursor-pointer"
            >
              Why Us
            </button>
            <button 
              onClick={() => handleLinkClick('our-work')}
              className="hover:text-orange-500 transition-colors py-1 cursor-pointer"
            >
              Case Studies
            </button>
            <button 
              onClick={() => handleLinkClick('calculator')}
              className="hover:text-orange-500 transition-colors py-1 cursor-pointer text-orange-500 font-extrabold"
            >
              Rake &amp; Trail
            </button>
            <button 
              onClick={() => handleLinkClick('diagnostic')}
              className="hover:text-orange-500 transition-colors py-1 cursor-pointer"
            >
              Diagnostic
            </button>
            <button 
              onClick={() => handleLinkClick('about-paul')}
              className="hover:text-orange-500 transition-colors py-1 cursor-pointer"
            >
              About Paul
            </button>
            <button 
              onClick={() => handleLinkClick('faqs')}
              className="hover:text-orange-500 transition-colors py-1 cursor-pointer"
            >
              FAQs
            </button>
            <button 
              onClick={() => handleLinkClick('contact')}
              className="hover:text-orange-500 transition-colors py-1 cursor-pointer"
            >
              Contact
            </button>
          </nav>

          {/* Right Action */}
          <div className="hidden sm:flex items-center gap-3">
            {onOpenTracker && (
              <button
                onClick={onOpenTracker}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white font-bold px-3.5 py-2.5 rounded-none text-xs uppercase tracking-widest cursor-pointer transition-colors"
                id="header-track-ticket-btn"
              >
                Track Ticket
              </button>
            )}
            <button
              onClick={onOpenBooking}
              className="bg-orange-600 hover:bg-orange-500 text-white font-black px-5 py-2.5 rounded-none shadow-lg transition-all flex items-center gap-2 text-xs uppercase tracking-widest cursor-pointer"
              id="header-book-appointment-btn"
            >
              <Calendar className="w-4 h-4" />
              <span>Book Inspection</span>
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              onClick={onOpenBooking}
              className="bg-orange-600 text-white text-xs font-black px-3 py-1.5 rounded-none uppercase tracking-widest"
            >
              Book
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-zinc-300 hover:text-white focus:outline-none"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-zinc-950 border-b border-zinc-800 px-6 pt-4 pb-6 space-y-4 shadow-2xl">
          <div className="text-xs text-zinc-400 pb-3 border-b border-zinc-800 space-y-2 font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2 text-orange-500">
              <Phone className="w-3.5 h-3.5" />
              <a href={`tel:${SHOP_INFO.phoneRaw}`}>{SHOP_INFO.phone}</a>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <MapPin className="w-3.5 h-3.5 text-zinc-600" />
              <span>{SHOP_INFO.address}</span>
            </div>
          </div>

          <div className="flex flex-col space-y-3 text-xs uppercase tracking-widest text-zinc-200 font-bold">
            <button
              onClick={() => handleLinkClick('services')}
              className="text-left py-2 hover:text-orange-500 border-b border-zinc-900"
            >
              Services Catalog
            </button>
            <button
              onClick={() => handleLinkClick('why-us')}
              className="text-left py-2 hover:text-orange-500 border-b border-zinc-900"
            >
              Why Choose The Frame Shop
            </button>
            <button
              onClick={() => handleLinkClick('our-work')}
              className="text-left py-2 hover:text-orange-500 border-b border-zinc-900"
            >
              Case Studies &amp; Specs
            </button>
            <button
              onClick={() => handleLinkClick('calculator')}
              className="text-left py-2 text-orange-500 font-black border-b border-zinc-900 flex items-center justify-between"
            >
              <span>Rake &amp; Trail Calculator</span>
              <span className="text-[9px] bg-orange-600 text-white px-1.5 py-0.5 rounded-none">Tool</span>
            </button>
            <button
              onClick={() => handleLinkClick('diagnostic')}
              className="text-left py-2 hover:text-orange-500 border-b border-zinc-900"
            >
              Diagnostic Tool
            </button>
            <button
              onClick={() => handleLinkClick('about-paul')}
              className="text-left py-2 hover:text-orange-500 border-b border-zinc-900"
            >
              About Paul Hurey
            </button>
            <button
              onClick={() => handleLinkClick('faqs')}
              className="text-left py-2 hover:text-orange-500 border-b border-zinc-900"
            >
              Frequently Asked Questions (FAQs)
            </button>
            <button
              onClick={() => handleLinkClick('contact')}
              className="text-left py-2 hover:text-orange-500 border-b border-zinc-900"
            >
              Contact &amp; Location
            </button>
          </div>

          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              onOpenBooking();
            }}
            className="w-full bg-orange-600 text-white font-black py-3 rounded-none text-center uppercase tracking-widest flex items-center justify-center gap-2 mt-4 text-xs"
          >
            <Calendar className="w-4 h-4" />
            <span>Book Inspection Online</span>
          </button>
        </div>
      )}
    </header>
  );
};
