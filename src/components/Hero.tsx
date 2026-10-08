import React, { useEffect, useRef, useState } from 'react';
import { SHOP_INFO } from '../data/shopData';
import { Calendar, Compass, Wrench, ArrowRight, Award, MapPin, Phone, Volume2, VolumeX } from 'lucide-react';

import { fetchSiteMedia, onMediaUpdated } from '../utils/siteMedia';

/**
 * The still shown before the hero clip plays, and in place of it on a browser
 * that cannot play it. Paul's own upload from Owner Photo Control takes over;
 * removing his photo there returns the hero to this frame of the clip.
 */
export const DEFAULT_HERO_IMAGE = '/video/hero-poster.jpg';

/** The hero clip: the bike comes apart, comes back together and starts up. */
export const HERO_VIDEO = '/video/hero-1080.mp4';
const HERO_CAPTIONS = '/video/hero-captions.vtt';

/** How long the idling bike holds at the end before the clip goes again. */
const HOLD_MS = 2500;

interface HeroProps {
  onOpenBooking: () => void;
  onNavigate: (sectionId: string) => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenBooking, onNavigate }) => {
  const [heroImage, setHeroImage] = useState<string>(DEFAULT_HERO_IMAGE);
  const [clipShowing, setClipShowing] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const holdTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      fetchSiteMedia().then(media => {
        if (!cancelled) setHeroImage(media.heroImage || DEFAULT_HERO_IMAGE);
      });
    };
    sync();
    const off = onMediaUpdated(sync);
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const play = () => {
    const v = video.current;
    if (!v) return;
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    v.currentTime = 0;
    const p = v.play();
    // Autoplay can be refused; the still simply stays up and the button works on a tap.
    if (p && p.catch) p.catch(() => {});
  };

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const onPlaying = () => setClipShowing(true);
    const onEnded = () => {
      // Hold on the idling bike, fade through the still, then go again.
      holdTimer.current = window.setTimeout(() => {
        setClipShowing(false);
        holdTimer.current = window.setTimeout(play, 650);
      }, HOLD_MS);
    };
    v.addEventListener('playing', onPlaying);
    v.addEventListener('ended', onEnded);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) play();
    return () => {
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('ended', onEnded);
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
    };
  }, []);

  /**
   * Browsers only allow sound that starts from a tap, so the tap itself restarts
   * the clip with sound on. Tapping again mutes it.
   */
  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    if (soundOn) {
      v.muted = true;
      setSoundOn(false);
      return;
    }
    v.muted = false;
    v.volume = 1;
    setSoundOn(true);
    play();
  };

  return (
    <section
      id="hero"
      /* Top padding clears the fixed header, whose height Navbar publishes as
         --header-h. The 7rem fallback covers the first paint before the
         measurement lands; 2rem is breathing room below the header. */
      style={{ paddingTop: 'calc(var(--header-h, 7rem) + 2rem)' }}
      className="relative min-h-[92vh] flex items-center pb-16 bg-black overflow-hidden font-sans"
    >
      {/* The hero is pure black to match the clip's studio, so the clip has no
          visible edges. This fade carries the black into the zinc page below. */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-zinc-950 pointer-events-none" />

      <div className="relative z-10 max-w-[88rem] mx-auto px-4 sm:px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

          {/* The clip, in its own black panel with nothing drawn over it. First on
              a phone, beside the words from laptop width up. */}
          <div className="relative order-first lg:order-last lg:col-span-7">
            <div className="relative aspect-video w-full bg-black overflow-hidden" aria-label="The Frame Shop hero video">
              {/* The video is always visible, showing the still as its poster until it
                  plays. The image above it is only for the fade between loops, so
                  with motion reduced nothing on the page is ever hidden. */}
              <video
                ref={video}
                src={HERO_VIDEO}
                poster={heroImage}
                muted
                playsInline
                preload="auto"
                aria-label="A custom Harley-Davidson comes apart into its components, reassembles and starts up"
                className="absolute inset-0 w-full h-full object-contain bg-black"
              >
                <track kind="captions" src={HERO_CAPTIONS} srcLang="en" label="English" />
              </video>
              <img
                src={heroImage}
                alt="Custom Harley Davidson motorcycle"
                referrerPolicy="no-referrer"
                className={`absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-700 ${clipShowing ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              />
            </div>

            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={soundOn}
              className={`mt-2.5 w-full lg:w-auto lg:mt-0 lg:absolute lg:right-3 lg:bottom-3 inline-flex items-center justify-center gap-2.5 px-4 py-3 text-[11px] font-black uppercase tracking-widest border transition-colors cursor-pointer backdrop-blur-sm ${
                soundOn
                  ? 'bg-orange-600 border-orange-600 text-white'
                  : 'bg-zinc-950/85 border-zinc-800 text-zinc-100 hover:border-orange-500'
              }`}
            >
              {soundOn ? <Volume2 className="w-4 h-4" aria-hidden="true" /> : <VolumeX className="w-4 h-4" aria-hidden="true" />}
              <span>{soundOn ? 'Sound on' : 'Hear it'}</span>
              <span className={`text-[11px] font-bold normal-case tracking-normal ${soundOn ? 'text-white' : 'text-zinc-400'}`}>
                {soundOn ? 'tap to mute' : 'tap to replay with sound'}
              </span>
            </button>
          </div>

          {/* Hero copy */}
          <div className="lg:col-span-5 space-y-8">

            {/* Top Logo Badge. data-testid is what the header-overlap test
                measures: the first thing in the hero, so the first thing a
                too-short top pad would slide under the fixed header. */}
            <div data-testid="hero-badges" className="flex items-center gap-4 flex-wrap">
              <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2.5 rounded-none text-orange-500 text-xs font-black uppercase tracking-widest">
                <Award className="w-3.5 h-3.5 text-orange-600" />
                <span>30+ Years Precision Alignment</span>
              </div>
            </div>

            {/* Main Headline: a step smaller than before, so it lives in its column
                instead of over the picture. */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-[84px] leading-[0.85] font-black text-zinc-100 uppercase italic tracking-tighter">
              ZERO <span className="text-orange-600">TOLERANCE.</span> <br />
              PURE <span className="text-zinc-50">ALIGNMENT.</span>
            </h1>

            {/* Sub-headline */}
            <p className="max-w-xl text-zinc-400 text-sm sm:text-base leading-relaxed font-normal">
              Laser-guided frame straightening and powertrain chassis alignment for performance motorcycles. At <strong className="text-zinc-100 font-bold">The Frame Shop</strong> in Spring, TX, Head Mechanic <strong className="text-orange-500 font-bold">Paul Hurey</strong> restores chassis geometry to factory specs or better.
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap gap-x-10 gap-y-6 sm:gap-x-12 items-center pt-2">
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
                className="bg-orange-600 hover:bg-orange-500 text-white font-black px-8 py-4 rounded-none shadow-sm transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest group cursor-pointer"
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
        </div>
      </div>
    </section>
  );
};
