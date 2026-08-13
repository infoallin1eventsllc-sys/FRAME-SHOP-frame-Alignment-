import React, { useState } from 'react';
import { Compass, Info, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

export const RakeTrailCalculator: React.FC = () => {
  const [rakeDegrees, setRakeDegrees] = useState<number>(30);
  const [tripleTreeOffset, setTripleTreeOffset] = useState<number>(2.0);
  const [tireDiameter, setTireDiameter] = useState<number>(26.5);
  const [tripleTreeRake, setTripleTreeTreeRake] = useState<number>(0); // Additional rake in trees

  // Trail Calculation Formula:
  // Total Rake = Frame Rake + Triple Tree Rake
  // Radius = Tire Diameter / 2
  // Trail (inches) = ( Radius * sin(Rake) - Offset ) / cos(Rake)
  const totalRakeRad = ((rakeDegrees + tripleTreeRake) * Math.PI) / 180;
  const tireRadius = tireDiameter / 2;
  
  const trailInches = (tireRadius * Math.sin(totalRakeRad) - tripleTreeOffset) / Math.cos(totalRakeRad);
  const trailMM = trailInches * 25.4;

  const getStabilityRating = (trailIn: number) => {
    if (trailIn < 3.0) {
      return {
        status: 'danger',
        label: 'Unstable / High Wobble Risk',
        color: 'text-red-400 bg-red-950/50 border-red-600',
        desc: 'Trail is under 3 inches. High risk of high-speed handlebar oscillation, tank-slappers, and twitchy steering.'
      };
    } else if (trailIn >= 3.0 && trailIn < 4.0) {
      return {
        status: 'agile',
        label: 'Responsive / Light Steering',
        color: 'text-orange-400 bg-zinc-950 border-orange-600',
        desc: 'Quick steering response, ideal for sportbikes and light cruisers. May feel slightly nervous with high-torque engines.'
      };
    } else if (trailIn >= 4.0 && trailIn <= 6.2) {
      return {
        status: 'optimal',
        label: 'Optimal High-Speed Highway Stability',
        color: 'text-emerald-400 bg-emerald-950/40 border-emerald-600',
        desc: 'Sweet spot for Harley Baggers, Cruisers, and High-HP builds. Excellent high-speed straight-line tracking without heavy steering.'
      };
    } else {
      return {
        status: 'heavy',
        label: 'Heavy Low-Speed Steering',
        color: 'text-orange-500 bg-zinc-950 border-orange-600',
        desc: 'Trail above 6.2 inches provides strong straight-line stability but causes heavy or floppy steering at low parking lot speeds.'
      };
    }
  };

  const rating = getStabilityRating(trailInches);

  return (
    <section id="calculator" className="py-24 bg-zinc-950 border-t border-zinc-800 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-orange-600 flex items-center justify-center gap-2">
            <Compass className="w-3.5 h-3.5 text-orange-600" />
            <span>Interactive Geometry Engine</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-black text-zinc-100 uppercase italic tracking-tighter">
            RAKE &amp; TRAIL <span className="text-orange-600">CALCULATOR</span>
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base font-normal">
            Calculate your motorcycle's exact trail measurement to predict handling stability before raking, stretching, or changing front wheel size.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Controls Panel */}
          <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-none p-6 sm:p-8 space-y-6 shadow-xl">
            <h3 className="text-lg font-black text-zinc-100 uppercase italic pb-3 border-b border-zinc-800 flex items-center justify-between">
              <span>Chassis Parameters</span>
              <span className="text-xs text-orange-500 font-mono font-bold uppercase tracking-wider">Live Calculation</span>
            </h3>

            {/* Rake Angle */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <label className="font-bold text-zinc-200 uppercase text-xs tracking-wider">Frame Rake Angle (Degrees)</label>
                <span className="font-mono text-orange-500 font-black">{rakeDegrees}°</span>
              </div>
              <input
                type="range"
                min="20"
                max="45"
                step="0.5"
                value={rakeDegrees}
                onChange={(e) => setRakeDegrees(parseFloat(e.target.value))}
                className="w-full accent-orange-600 bg-zinc-950 h-2 rounded-none cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-zinc-500 font-bold uppercase">
                <span>20° (Sport)</span>
                <span>30° (Stock Harley)</span>
                <span>45° (Chopper)</span>
              </div>
            </div>

            {/* Triple Tree Offset */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <label className="font-bold text-zinc-200 uppercase text-xs tracking-wider">Triple Tree Fork Offset (Inches)</label>
                <span className="font-mono text-orange-500 font-black">{tripleTreeOffset.toFixed(2)}"</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="4.0"
                step="0.1"
                value={tripleTreeOffset}
                onChange={(e) => setTripleTreeOffset(parseFloat(e.target.value))}
                className="w-full accent-orange-600 bg-zinc-950 h-2 rounded-none cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-zinc-500 font-bold uppercase">
                <span>0.5"</span>
                <span>2.0" (Standard Stock Offset)</span>
                <span>4.0"</span>
              </div>
            </div>

            {/* Tire Outer Diameter */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <label className="font-bold text-zinc-200 uppercase text-xs tracking-wider">Front Tire Overall Diameter (Inches)</label>
                <span className="font-mono text-orange-500 font-black">{tireDiameter.toFixed(1)}"</span>
              </div>
              <input
                type="range"
                min="20"
                max="32"
                step="0.5"
                value={tireDiameter}
                onChange={(e) => setTireDiameter(parseFloat(e.target.value))}
                className="w-full accent-orange-600 bg-zinc-950 h-2 rounded-none cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-zinc-500 font-bold uppercase">
                <span>25.0" (17"-18" Wheel)</span>
                <span>26.5" (19" Stock Wheel)</span>
                <span>31.0" (26" Big Wheel)</span>
              </div>
            </div>

            {/* Additional Rake in Trees */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <label className="font-bold text-zinc-200 uppercase text-xs tracking-wider">Raked Triple Trees (Added Degrees)</label>
                <span className="font-mono text-orange-500 font-black">+{tripleTreeRake}°</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[0, 3, 5, 7].map(deg => (
                  <button
                    key={deg}
                    onClick={() => setTripleTreeTreeRake(deg)}
                    className={`py-2 rounded-none text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
                      tripleTreeRake === deg
                        ? 'bg-orange-600 text-white shadow-md'
                        : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white'
                    }`}
                  >
                    +{deg}° Rake
                  </button>
                ))}
              </div>
            </div>

            {/* Preset Geometry Profiles */}
            <div className="pt-4 border-t border-zinc-800">
              <span className="text-xs text-zinc-400 font-black uppercase tracking-wider block mb-2">
                Load Typical Profiles:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setRakeDegrees(26);
                    setTripleTreeOffset(1.8);
                    setTireDiameter(25.5);
                    setTripleTreeTreeRake(0);
                  }}
                  className="text-xs bg-zinc-950 hover:bg-zinc-800 text-zinc-300 font-bold uppercase px-3 py-1.5 rounded-none border border-zinc-800"
                >
                  Stock FXR / Dyna
                </button>
                <button
                  onClick={() => {
                    setRakeDegrees(30);
                    setTripleTreeOffset(2.0);
                    setTireDiameter(26.5);
                    setTripleTreeTreeRake(0);
                  }}
                  className="text-xs bg-zinc-950 hover:bg-zinc-800 text-zinc-300 font-bold uppercase px-3 py-1.5 rounded-none border border-zinc-800"
                >
                  Stock FLH Road Glide
                </button>
                <button
                  onClick={() => {
                    setRakeDegrees(38);
                    setTripleTreeOffset(1.5);
                    setTireDiameter(28.0);
                    setTripleTreeTreeRake(5);
                  }}
                  className="text-xs bg-zinc-950 hover:bg-zinc-800 text-zinc-300 font-bold uppercase px-3 py-1.5 rounded-none border border-zinc-800"
                >
                  23" Big Wheel Bagger
                </button>
              </div>
            </div>

          </div>

          {/* Results Display */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-none p-6 sm:p-8 shadow-xl space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-orange-600 border-b border-zinc-800 pb-3">
                Calculated Trail Output
              </h3>

              {/* Main Gauge Numbers */}
              <div className="bg-zinc-950 p-6 rounded-none border border-zinc-800 text-center space-y-1">
                <div className="text-xs text-zinc-500 uppercase font-bold tracking-widest">Calculated Trail</div>
                <div className="text-5xl font-black text-zinc-100 font-mono tracking-tight my-1 italic">
                  {trailInches > 0 ? trailInches.toFixed(2) : '0.00'} <span className="text-2xl text-orange-600">in</span>
                </div>
                <div className="text-sm font-mono text-zinc-400">
                  ({trailMM > 0 ? trailMM.toFixed(1) : '0.0'} mm)
                </div>
              </div>

              {/* Classification Banner */}
              <div className={`p-4 rounded-none border ${rating.color} space-y-2`}>
                <div className="flex items-center gap-2 font-black uppercase text-sm tracking-wider italic">
                  {rating.status === 'optimal' && <ShieldCheck className="w-5 h-5" />}
                  {rating.status === 'danger' && <AlertTriangle className="w-5 h-5" />}
                  {rating.status !== 'optimal' && rating.status !== 'danger' && <Info className="w-5 h-5" />}
                  <span>{rating.label}</span>
                </div>
                <p className="text-xs leading-relaxed opacity-90 font-normal">
                  {rating.desc}
                </p>
              </div>

              {/* Technical Breakdown */}
              <div className="space-y-2 text-xs text-zinc-400 bg-zinc-950 p-4 rounded-none border border-zinc-800">
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="uppercase font-bold">Total Rake Angle:</span>
                  <span className="font-mono font-bold text-zinc-100">{rakeDegrees + tripleTreeRake}°</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="uppercase font-bold">Tire Radius:</span>
                  <span className="font-mono font-bold text-zinc-100">{tireRadius.toFixed(2)}"</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="uppercase font-bold">Triple Tree Offset:</span>
                  <span className="font-mono font-bold text-zinc-100">{tripleTreeOffset.toFixed(2)}"</span>
                </div>
              </div>

              {/* Paul's Guidance */}
              <div className="text-xs text-zinc-400 space-y-2 pt-2">
                <div className="flex items-center gap-1.5 text-orange-500 font-bold uppercase tracking-wider">
                  <Info className="w-4 h-4 text-orange-600" />
                  <span>Paul's Geometry Advice</span>
                </div>
                <p className="leading-relaxed font-normal italic">
                  "Changing front wheel sizes or installing raked triple trees without re-verifying trail can make a bike dangerous. If your custom build feels twitchy or heavy, we can measure and correct it on our laser alignment rig."
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
