import React from 'react';
import { Home, Wrench, Image, Activity, Calendar, FileText } from 'lucide-react';

interface MobileBottomNavProps {
  onOpenBooking: () => void;
  onNavigate: (sectionId: string) => void;
  onOpenTracker?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onOpenBooking,
  onNavigate,
  onOpenTracker,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-800/80 md:hidden pb-safe">
      <div className="grid grid-cols-5 h-16 max-w-md mx-auto items-center px-1">
        {/* Home */}
        <button
          onClick={() => onNavigate('hero')}
          className="flex flex-col items-center justify-center py-1 text-zinc-400 hover:text-orange-500 active:text-orange-500 transition-colors focus:outline-none cursor-pointer"
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
        </button>

        {/* Services */}
        <button
          onClick={() => onNavigate('services')}
          className="flex flex-col items-center justify-center py-1 text-zinc-400 hover:text-orange-500 active:text-orange-500 transition-colors focus:outline-none cursor-pointer"
        >
          <Wrench className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Services</span>
        </button>

        {/* Book (Center Highlight Button) */}
        <button
          onClick={onOpenBooking}
          className="flex flex-col items-center justify-center py-1 text-white focus:outline-none cursor-pointer"
        >
          <div className="bg-orange-600 hover:bg-orange-500 text-white p-2.5 rounded-full shadow-lg shadow-orange-950/50 -mt-5 border-2 border-zinc-950 transition-transform active:scale-95">
            <Calendar className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-orange-500 mt-0.5">Book</span>
        </button>

        {/* Portfolio / Our Work */}
        <button
          onClick={() => onNavigate('our-work')}
          className="flex flex-col items-center justify-center py-1 text-zinc-400 hover:text-orange-500 active:text-orange-500 transition-colors focus:outline-none cursor-pointer"
        >
          <Image className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Work</span>
        </button>

        {/* Track Order / Ticket */}
        <button
          onClick={() => {
            if (onOpenTracker) onOpenTracker();
            else onNavigate('contact');
          }}
          className="flex flex-col items-center justify-center py-1 text-zinc-400 hover:text-orange-500 active:text-orange-500 transition-colors focus:outline-none cursor-pointer"
        >
          <FileText className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Tracker</span>
        </button>
      </div>
    </nav>
  );
};
