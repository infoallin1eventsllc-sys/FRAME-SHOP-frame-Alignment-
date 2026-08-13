import React from 'react';
import { CORE_VALUES } from '../data/shopData';
import { ShieldCheck, Award, CheckCircle2, XCircle, ArrowRight, Wrench, Flame } from 'lucide-react';

interface WhyChooseUsProps {
  onOpenBooking: () => void;
}

export const WhyChooseUs: React.FC<WhyChooseUsProps> = ({ onOpenBooking }) => {
  return (
    <section id="why-us" className="py-24 bg-zinc-950 border-t border-zinc-800 relative font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-orange-600 flex items-center justify-center gap-2">
            <Award className="w-3.5 h-3.5 text-orange-600" />
            <span>Why The Frame Shop Stands Alone</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-black text-zinc-100 uppercase italic tracking-tighter">
            WHY CHOOSE <span className="text-orange-600">THE FRAME SHOP</span>
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base font-normal">
            If you ride, you know your motorcycle is more than a machine. It is something you trust. When the frame is off or the bike does not track straight, that trust disappears.
          </p>
        </div>

        {/* Narrative / Context Block */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16 items-stretch">
          
          <div className="bg-zinc-900 p-8 rounded-none border border-zinc-800 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center gap-2 text-orange-600 font-bold text-xs uppercase tracking-widest mb-3">
                <Flame className="w-4 h-4 text-orange-600" />
                <span>The Industry Reality</span>
              </div>
              <h3 className="text-2xl font-black text-zinc-100 mb-4 uppercase italic">
                High Horsepower Demands Precision Chassis Alignment
              </h3>
              <p className="text-zinc-300 text-sm leading-relaxed font-normal mb-4">
                The motorcycle industry is building powertrains that push way beyond what factory chasses and stock suspension were originally designed to handle. 
              </p>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed font-normal">
                More horsepower without the right chassis foundation leads to poor cornering handling, high-speed rear wobble, and unsafe riding conditions. Many general repair shops rely on quick fixes, guesswork, or visual checks, which leads to repeat problems and wasted money.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-800 text-xs text-orange-500 font-bold uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-orange-600" />
              <span>Zero-Tolerance 3D Laser Alignment Fixes The Root Cause</span>
            </div>
          </div>

          <div className="bg-zinc-900 p-8 rounded-none border border-zinc-800 flex flex-col justify-between shadow-xl relative">
            <div>
              <div className="flex items-center gap-2 text-orange-600 font-bold text-xs uppercase tracking-widest mb-3">
                <Wrench className="w-4 h-4 text-orange-600" />
                <span>The Paul Hurey Difference</span>
              </div>
              <h3 className="text-2xl font-black text-zinc-100 mb-4 uppercase italic">
                Paul Hurey’s Master Craft
              </h3>
              <p className="text-zinc-300 text-sm leading-relaxed font-normal mb-4">
                At The Frame Shop, Head Mechanic Paul Hurey combines 30+ years of hands-on custom building experience with zero-tolerance laser measurement equipment.
              </p>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed font-normal">
                Every bike is carefully inspected, straightened, and aligned so you can ride with absolute confidence. The result is a motorcycle that feels solid, safe, and built the way it should be.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between">
              <div className="text-xs text-zinc-300 italic font-bold">
                "If I won't ride it, neither will you."
              </div>
              <button
                onClick={onOpenBooking}
                className="bg-orange-600 hover:bg-orange-500 text-white font-black px-4 py-2 rounded-none text-xs uppercase tracking-widest transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Book Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

        {/* Factory vs Frame Shop Comparison Matrix */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-none p-6 sm:p-8 mb-16 shadow-2xl">
          <div className="text-center max-w-xl mx-auto mb-8">
            <h3 className="text-2xl font-black text-zinc-100 uppercase italic">
              Factory Stock vs. The Frame Shop Aligned
            </h3>
            <p className="text-xs text-zinc-400 font-normal mt-1 uppercase tracking-wider">
              Why precision 3D alignment transforms your riding experience
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Factory Stock */}
            <div className="bg-zinc-950 p-6 rounded-none border border-zinc-800 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-800 text-red-500 font-black text-sm uppercase italic">
                <XCircle className="w-5 h-5" />
                <span>Standard Dealer / Factory Tolerances</span>
              </div>
              <ul className="space-y-3 text-xs text-zinc-400">
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>Up to 15mm factory tolerance deviation between wheels and powertrain</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>High-speed rear-end wobble above 65mph under heavy bagger acceleration</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>Uneven rear tire wear and drive belt edge fraying</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>General shops use visual checks and guesswork that miss twisted mounts</span>
                </li>
              </ul>
            </div>

            {/* The Frame Shop Standard */}
            <div className="bg-zinc-950 p-6 rounded-none border border-orange-600 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-800 text-orange-500 font-black text-sm uppercase italic">
                <CheckCircle2 className="w-5 h-5 text-orange-600" />
                <span>The Frame Shop Aligned Standard</span>
              </div>
              <ul className="space-y-3 text-xs text-zinc-200">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-orange-500 font-bold uppercase">Zero-tolerance 3D laser alignment</strong> (0.0mm parallel tracking)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <span>Rock-solid highway stability at 90+ mph with zero rear sway</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <span>Even tire tread wear and extended belt &amp; pulley lifespan</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <span>Decades of experience with hydraulic jigs and custom TIG frame repair</span>
                </li>
              </ul>
            </div>

          </div>
        </div>

        {/* 4 Core Values Grid */}
        <div>
          <div className="text-center mb-8">
            <h3 className="text-2xl font-black text-zinc-100 uppercase italic">
              Our Core Pillars
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {CORE_VALUES.map((val) => (
              <div
                key={val.id}
                className="bg-zinc-900 p-6 rounded-none border border-zinc-800 hover:border-orange-600 transition-all flex flex-col justify-between space-y-3 group"
              >
                <div>
                  <div className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">
                    {val.subtitle}
                  </div>
                  <h4 className="text-base font-black text-zinc-100 uppercase italic group-hover:text-orange-500 transition-colors">
                    {val.title}
                  </h4>
                  <p className="text-xs text-zinc-400 font-normal mt-2 leading-relaxed">
                    {val.desc}
                  </p>
                </div>
                <div className="pt-3 border-t border-zinc-800 flex justify-end">
                  <ShieldCheck className="w-4 h-4 text-zinc-600 group-hover:text-orange-600 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};
