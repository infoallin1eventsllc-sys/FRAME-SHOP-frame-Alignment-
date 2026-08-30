import React, { useState, useEffect } from 'react';
import { WORK_PROJECTS } from '../data/shopData';
import { WorkProject } from '../types';
import { CheckCircle2, ArrowRight, Gauge, Info, X, Camera } from 'lucide-react';
import { fetchSiteMedia, onMediaUpdated } from '../utils/siteMedia';

interface OurWorkGalleryProps {
  onOpenBooking: () => void;
}

export const OurWorkGallery: React.FC<OurWorkGalleryProps> = ({ onOpenBooking }) => {
  const [activeTab, setActiveCategory] = useState<'all' | 'frame' | 'powertrain' | 'suspension' | 'custom'>('all');
  const [selectedProject, setSelectedProject] = useState<WorkProject | null>(null);

  // Owner's photo overrides, from the server so customers see them too.
  const [projectPhotos, setProjectPhotos] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const loadGalleryPhotos = () => {
      fetchSiteMedia().then(media => {
        if (!cancelled) setProjectPhotos(media.galleryPhotos || {});
      });
    };

    loadGalleryPhotos();
    const off = onMediaUpdated(loadGalleryPhotos);
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const projectsWithPhotos = WORK_PROJECTS.map(p => ({
    ...p,
    imageUrl: projectPhotos[p.id] || p.imageUrl
  }));

  const filteredProjects = activeTab === 'all'
    ? projectsWithPhotos
    : projectsWithPhotos.filter(p => p.category === activeTab);

  return (
    <section id="our-work" className="py-24 bg-zinc-950 border-t border-zinc-800 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-orange-600 flex items-center justify-center gap-2">
            <Camera className="w-4 h-4 text-orange-600" />
            <span>Shop Portfolio &amp; Spec Specs</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-black text-zinc-100 uppercase italic tracking-tighter">
            OUR WORK &amp; <span className="text-orange-600">ALIGNMENT SPECS</span>
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base font-normal">
            Real motorcycles, real laser measurements, and zero-tolerance results. Explore how Paul Hurey restores chassis stability to performance baggers, custom choppers, and crashed frames.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          {[
            { id: 'all', label: 'All Builds' },
            { id: 'powertrain', label: 'Powertrain Alignment' },
            { id: 'frame', label: 'Frame Straightening' },
            { id: 'suspension', label: 'Suspension Setup' },
            { id: 'custom', label: 'Custom Stretches' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as any)}
              className={`px-5 py-2.5 rounded-none text-xs font-black uppercase tracking-widest transition-all cursor-pointer border ${
                activeTab === tab.id
                  ? 'bg-orange-600 text-white border-orange-500 shadow-lg'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-100 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Work Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filteredProjects.map((proj) => (
            <div
              key={proj.id}
              className="bg-zinc-900 border border-zinc-800 hover:border-orange-600/60 rounded-none overflow-hidden transition-all group shadow-xl flex flex-col justify-between"
            >
              {/* Image & Badge Overlay */}
              <div className="relative h-64 sm:h-72 overflow-hidden bg-zinc-950">
                <img
                  src={proj.imageUrl}
                  alt={proj.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 filter contrast-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-80" />
                
                <div className="absolute top-4 left-4 bg-zinc-950/90 backdrop-blur-sm px-3 py-1.5 border border-zinc-800 text-[10px] font-black text-orange-500 uppercase tracking-widest">
                  {proj.bikeModel} ({proj.year})
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 space-y-4">
                <h3 className="text-2xl font-black text-zinc-100 uppercase italic tracking-tight group-hover:text-orange-500 transition-colors">
                  {proj.title}
                </h3>

                <p className="text-xs sm:text-sm text-zinc-300 font-normal leading-relaxed">
                  {proj.description}
                </p>

                {/* Laser Specs Comparison Box */}
                <div className="bg-zinc-950 p-4 rounded-none border border-zinc-800 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-orange-500">
                    <Gauge className="w-3.5 h-3.5 text-orange-600" />
                    <span>Laser Alignment Data</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-zinc-800">
                    <div>
                      <span className="text-[10px] text-red-400 uppercase font-black block tracking-wider">Before Service</span>
                      <span className="text-zinc-300 font-mono font-bold text-xs">{proj.beforeAfterSpec.laserDeviationBefore}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-400 uppercase font-black block tracking-wider">After Frame Shop</span>
                      <span className="text-emerald-400 font-mono font-bold text-xs">{proj.beforeAfterSpec.laserDeviationAfter}</span>
                    </div>
                  </div>
                </div>

                {/* Fix Summary */}
                <div className="flex items-start gap-2 text-xs text-zinc-400">
                  <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <span className="font-normal">{proj.beforeAfterSpec.keyFix}</span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-6 pb-6 pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <button
                  onClick={() => setSelectedProject(proj)}
                  className="text-xs text-orange-500 hover:text-orange-400 font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Inspect Case Study</span>
                </button>

                <button
                  onClick={onOpenBooking}
                  className="bg-orange-600 hover:bg-orange-500 text-white font-black px-4 py-2.5 rounded-none text-xs uppercase tracking-widest transition-colors cursor-pointer text-center"
                >
                  Get Similar Work
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Project Case Study Modal */}
        {selectedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-zinc-950 border-2 border-zinc-800 rounded-none max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setSelectedProject(null)}
                className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-4">
                <span className="text-xs font-black text-orange-500 uppercase tracking-widest bg-zinc-900 border border-zinc-800 px-3 py-1">
                  {selectedProject.bikeModel}
                </span>
                <h3 className="text-3xl font-black text-zinc-100 uppercase italic mt-3">
                  {selectedProject.title}
                </h3>
              </div>

              <div className="rounded-none overflow-hidden mb-6 h-64 bg-zinc-900 border border-zinc-800">
                <img
                  src={selectedProject.imageUrl}
                  alt={selectedProject.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-black uppercase text-orange-500 tracking-wider mb-1">Rider Problem &amp; Diagnosis</h4>
                  <p className="text-zinc-300 text-sm font-normal leading-relaxed">
                    {selectedProject.description}
                  </p>
                </div>

                <div className="bg-zinc-900 p-4 rounded-none border border-zinc-800 space-y-3">
                  <h4 className="text-xs font-black uppercase text-orange-500 tracking-wider flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-orange-600" />
                    <span>Laser Alignment Measurements</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-zinc-950 rounded-none border border-red-900/40">
                      <div className="text-[10px] font-black uppercase text-red-400 mb-1">Initial Deviation</div>
                      <div className="font-mono text-zinc-100 font-bold">{selectedProject.beforeAfterSpec.laserDeviationBefore}</div>
                    </div>
                    <div className="p-3 bg-zinc-950 rounded-none border border-emerald-900/40">
                      <div className="text-[10px] font-black uppercase text-emerald-400 mb-1">Final Aligned Spec</div>
                      <div className="font-mono text-emerald-400 font-bold">{selectedProject.beforeAfterSpec.laserDeviationAfter}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-black uppercase text-orange-500 tracking-wider mb-1">Mechanical Resolution</h4>
                  <p className="text-zinc-300 text-xs sm:text-sm font-normal leading-relaxed bg-zinc-900 p-3 rounded-none border border-zinc-800">
                    {selectedProject.beforeAfterSpec.keyFix}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                  <button
                    onClick={() => setSelectedProject(null)}
                    className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white uppercase cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProject(null);
                      onOpenBooking();
                    }}
                    className="bg-orange-600 hover:bg-orange-500 text-white font-black px-5 py-3 rounded-none text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg cursor-pointer"
                  >
                    <span>Book Your Alignment</span>
                    <ArrowRight className="w-4 h-4" />
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
