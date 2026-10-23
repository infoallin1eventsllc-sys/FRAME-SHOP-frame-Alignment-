import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, ExternalLink, PlayCircle } from 'lucide-react';
import { parseVideoUrl } from '../utils/videoEmbed';
import type { ShopVideo } from './ShopVideos';

interface VideoCardProps {
  video: ShopVideo;
  /** Whether this card is the one currently allowed to have sound. */
  soundOn: boolean;
  /** Ask to be the one with sound (or to go quiet again). */
  onRequestSound: (id: string | null) => void;
}

/**
 * One clip that starts playing by itself.
 *
 * Two things govern how this works, and neither is a preference:
 *
 * 1. Browsers refuse to autoplay a video with sound until the viewer has
 *    interacted with the page. A player that autostarts must therefore be
 *    muted, or it is blocked outright and shows a frozen frame. The unmute
 *    button is the way back to sound — pressing it IS the interaction, so it
 *    works immediately.
 * 2. Playing every clip at once on a phone burns data and battery for footage
 *    nobody is looking at. So a card only starts once it scrolls into view, and
 *    pauses again when it leaves.
 */
export const VideoCard: React.FC<VideoCardProps> = ({ video, soundOn, onRequestSound }) => {
  const parsed = parseVideoUrl(video.url, { autostart: true });
  const cardRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Embeds are only mounted once the card is on screen; unmounting them again
  // would restart the clip every time it scrolled past, so this stays true.
  const [hasBeenSeen, setHasBeenSeen] = useState(false);
  // Phone footage is usually filmed upright. In a widescreen frame it shrank to
  // a sliver between black bars, so an upright clip gets a tall frame instead.
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setHasBeenSeen(true);

        const el = videoRef.current;
        if (!el) return;
        if (entry.isIntersecting) {
          // play() rejects if the browser still declines — a muted video should
          // not, but a rejected promise here must not surface as an error.
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  // Sound belongs to one card at a time; the rest stay muted.
  useEffect(() => {
    const el = videoRef.current;
    if (el) el.muted = !soundOn;
  }, [soundOn]);

  const isFile = parsed.kind === 'file';

  return (
    <article
      ref={cardRef}
      className="bg-zinc-900 border border-zinc-800 hover:border-orange-600/50 transition-colors group"
    >
      <div
        data-testid="video-frame"
        className={`relative bg-zinc-950 overflow-hidden ${portrait ? 'h-[75vh] max-h-[720px]' : 'aspect-video'}`}
      >
        {isFile && parsed.embedUrl ? (
          <>
            <video
              ref={videoRef}
              src={parsed.embedUrl}
              // muted + playsInline are what make autoPlay actually permitted.
              autoPlay
              muted
              loop
              playsInline
              controls
              preload="metadata"
              onLoadedMetadata={(e) => setPortrait(e.currentTarget.videoHeight > e.currentTarget.videoWidth)}
              className="w-full h-full object-contain bg-black"
            />
            <button
              type="button"
              onClick={() => onRequestSound(soundOn ? null : video.id)}
              aria-label={soundOn ? `Mute ${video.title}` : `Unmute ${video.title}`}
              className="absolute top-3 right-3 z-10 bg-zinc-950/80 hover:bg-orange-600 text-zinc-100 p-2 backdrop-blur-sm transition-colors cursor-pointer"
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </>
        ) : hasBeenSeen && parsed.embedUrl ? (
          <iframe
            src={parsed.embedUrl}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            /* Set here as well as on the server. YouTube refuses to play with
               error 153 if it cannot see which site is embedding it, and an
               iframe's own policy overrides the page's. */
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-full border-0"
          />
        ) : (
          // Shown before the card scrolls into view, and for links this site
          // cannot play at all.
          <div className="w-full h-full relative">
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950" />
            {parsed.thumbnailUrl && (
              <img
                src={parsed.thumbnailUrl}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.hidden = true; }}
                className="absolute inset-0 w-full h-full object-cover opacity-70"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <PlayCircle className="w-16 h-16 text-orange-600 drop-shadow-lg" />
            </div>
          </div>
        )}
      </div>

      <div className="p-5 space-y-2">
        <h3 className="text-lg font-black uppercase italic text-zinc-100 leading-snug">
          {video.title}
        </h3>
        {video.description && (
          <p className="text-xs text-zinc-400 leading-relaxed font-normal">
            {video.description}
          </p>
        )}
        {/* Some uploaders switch embedding off, and the player then refuses to
            play here however it is requested. Always give the viewer a way
            through to the source. */}
        {!isFile && (
          <div className="flex items-center gap-4 pt-1">
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 hover:text-orange-400 flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open original</span>
            </a>
          </div>
        )}
      </div>
    </article>
  );
};
