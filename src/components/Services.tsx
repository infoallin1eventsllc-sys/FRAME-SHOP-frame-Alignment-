import React, { useState } from 'react';
import { SERVICES } from '../data/shopData';
import { ServiceItem } from '../types';
import { 
  Wrench, 
  Compass, 
  Sliders, 
  Disc, 
  ShieldAlert, 
  Droplet, 
  Cog, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  ArrowRight,
  Info,
  X
} from 'lucide-react';

interface ServicesProps {
  onSelectServiceForBooking: (serviceId: string) => void;
}

export const Services: React.FC<ServicesProps> = ({ onSelectServiceForBooking }) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'core' | 'maintenance' | 'custom'>('all');
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  const filteredServices = activeCategory === 'all' 
    ? SERVICES 
    : SERVICES.filter(s => s.category === activeCategory);

  const getServiceIcon = (iconName: string) => {
    switch (iconName) {
      case 'Frame': return <Wrench className="w-6 h-6 text-orange-600" />;
      case 'Compass': return <Compass className="w-6 h-6 text-orange-600" />;
      case 'Sliders': return <Sliders className="w-6 h-6 text-orange-600" />;
      case 'Disc': return <Disc className="w-6 h-6 text-orange-600" />;
      case 'ShieldAlert': return <ShieldAlert className="w-6 h-6 text-orange-600" />;
      case 'Droplet': return <Droplet className="w-6 h-6 text-orange-600" />;
      case 'Cog': return <Cog className="w-6 h-6 text-orange-600" />;
      default: return <Wrench className="w-6 h-6 text-orange-600" />;
    }
  };

  return (
    <section id="services" className="py-24 bg-white relative border-t border-zinc-200 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-orange-600">
            Expert Motorcycle Engineering
          </div>
          <h2 className="text-4xl sm:text-6xl font-black text-zinc-900 uppercase italic tracking-tighter">
            PRECISION <span className="text-orange-600">SERVICES</span> &amp; CRAFT
          </h2>
          <p className="text-zinc-600 text-sm sm:text-base font-normal">
            Whether your frame requires hydraulic straightening or your powertrain is causing high-speed wobble, we deliver zero-tolerance alignment and road-ready reliability.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          {[
            { id: 'all', label: 'All Services' },
            { id: 'core', label: 'Frame & Alignment' },
            { id: 'maintenance', label: 'Maintenance & Brakes' },
            { id: 'custom', label: 'Custom & Fabrication' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as any)}
              className={`px-5 py-2.5 rounded-none text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
                activeCategory === tab.id
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'bg-zinc-100 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-200 border border-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map(service => (
            <div
              key={service.id}
              className="bg-zinc-50 hover:bg-white border border-zinc-200 hover:border-orange-600 rounded-none p-6 transition-all group flex flex-col justify-between shadow-md hover:shadow-xl relative"
            >
              {/* Highlight badge for core services */}
              {service.category === 'core' && (
                <div className="absolute top-0 right-0 bg-orange-600 text-white font-black text-[9px] uppercase tracking-widest px-3 py-1 rounded-none shadow-sm">
                  Shop Specialty
                </div>
              )}

              <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-none bg-white border border-zinc-200 group-hover:border-orange-600 flex items-center justify-center transition-colors shadow-sm">
                    {getServiceIcon(service.iconName)}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-zinc-900 uppercase italic group-hover:text-orange-600 transition-colors">
                      {service.title}
                    </h3>
                  </div>
                </div>

                <p className="text-zinc-600 text-xs sm:text-sm leading-relaxed mb-6 font-normal">
                  {service.shortDesc}
                </p>

                <div className="space-y-2 mb-6">
                  {service.features.slice(0, 3).map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-zinc-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                  {service.features.length > 3 && (
                    <div className="text-[11px] text-orange-600 uppercase tracking-wider font-bold pt-1">
                      + {service.features.length - 3} MORE SPECS &amp; CHECKS
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-zinc-200 flex items-center justify-between gap-3">
                <button
                  onClick={() => setSelectedService(service)}
                  className="text-xs font-bold uppercase tracking-wider text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5 transition-colors cursor-pointer py-1"
                >
                  <Info className="w-3.5 h-3.5 text-orange-600" />
                  <span>Full Details</span>
                </button>

                <button
                  onClick={() => onSelectServiceForBooking(service.id)}
                  className="bg-orange-600 hover:bg-orange-500 text-white font-black px-4 py-2 rounded-none text-xs uppercase tracking-widest transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>Book</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Detailed Service Modal */}
        {selectedService && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md">
            <div className="bg-white border border-zinc-200 rounded-none max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setSelectedService(null)}
                className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-900 rounded-none hover:bg-zinc-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-zinc-50 border border-orange-600 flex items-center justify-center shadow-sm">
                  {getServiceIcon(selectedService.iconName)}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-zinc-900 uppercase italic">
                    {selectedService.title}
                  </h3>
                </div>
              </div>

              <div className="space-y-6 pt-2">
                <div>
                  <h4 className="text-xs font-bold uppercase text-orange-600 tracking-widest mb-2">Service Overview</h4>
                  <p className="text-zinc-700 text-sm leading-relaxed font-normal">
                    {selectedService.fullDesc}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase text-orange-600 tracking-widest mb-3">Key Specs &amp; Included Work</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedService.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-zinc-50 p-3 rounded-none border border-zinc-200 text-xs text-zinc-800">
                        <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 text-xs text-zinc-800">
                  <p className="font-bold mb-1 uppercase tracking-wider text-orange-600">Shop Note by Paul Hurey:</p>
                  <p className="italic">
                    "Every bike that comes in for {selectedService.title.toLowerCase()} undergoes a complete safety check before it leaves the lift. By appointment only."
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
                  <button
                    onClick={() => setSelectedService(null)}
                    className="px-5 py-2.5 text-xs font-bold text-zinc-600 hover:text-zinc-900 uppercase tracking-widest cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      const id = selectedService.id;
                      setSelectedService(null);
                      onSelectServiceForBooking(id);
                    }}
                    className="bg-orange-600 hover:bg-orange-500 text-white font-black px-6 py-2.5 rounded-none text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Book Service Now</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
