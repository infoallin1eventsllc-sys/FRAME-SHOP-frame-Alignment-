import React, { useState, useEffect } from 'react';
import { PlayCircle, Video, Play } from 'lucide-react';
import { parseVideoUrl } from '../utils/videoEmbed';

export const VIDEOS_KEY = 'theframeshop_videos';

export interface ShopVideo {
  id: string;
  url: string;
  title: string;
  description?: string;
}

export function readStoredVideos(): ShopVideo[] {
  try {
    const saved = localStorage.getItem(VIDEOS_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const ShopVideos: React.FC = () => {
  const [videos, setVideos] = useState<ShopVideo[]>(() => readStoredVideos());
  // Which card the viewer pressed play on. Iframes only mount after a click, so
  // a page with several videos doesn't pull in a player for each one on load.
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setVideos(readStoredVideos());
    window.addEventListener('storage', sync);
    window.addEventListener('shop_videos_updated', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('shop_videos_updated', sync);
    };
  }, []);

  // Nothing to show until Paul adds a link — render no empty section.
  if (videos.length === 0) return null;

  return (
    <section id="shop-videos" className="py-24 bg-zinc-950 border-t border-zinc-800 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-orange-600 flex items-center justify-center gap-2">
            <Video className="w-4 h-4 text-orange-600" />
            <span>From Paul's Bench</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-black text-zinc-100 uppercase italic tracking-tighter">
            SHOP <span className="text-orange-600">VIDEO</span>
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base font-normal">
            Builds, teardowns and laser alignment work filmed in the shop in Spring, Texas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {videos.map(video => {
            const parsed = parseVideoUrl(video.url);
            const isPlaying = playingId === video.id;

            return (
              <article
                key={video.id}
                className="bg-zinc-900 border border-zinc-800 hover:border-orange-600/50 transition-colors group"
              >
                <div className="relative aspect-video bg-zinc-950 overflow-hidden">
                  {isPlaying && parsed.kind === 'file' ? (
                    <video
                      src={parsed.embedUrl}
                      controls
                      autoPlay
                      className="w-full h-full object-contain bg-black"
                    />
                  ) : isPlaying && parsed.embedUrl ? (
                    <iframe
                      src={parsed.embedUrl}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  ) : (
                    <button
                      onClick={() => setPlayingId(video.id)}
                      aria-label={`Play ${video.title}`}
                      className="w-full h-full relative cursor-pointer"
                    >
                      {/* Always behind the poster, so a missing or dead
                          thumbnail leaves a styled panel rather than a gap. */}
                      <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950" />
                      {parsed.thumbnailUrl && (
                        <img
                          src={parsed.thumbnailUrl}
                          alt=""
                          aria-hidden="true"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.hidden = true;
                          }}
                          className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <PlayCircle className="w-16 h-16 text-orange-600 drop-shadow-lg group-hover:scale-110 transition-transform" />
                      </div>
                    </button>
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
                  {!isPlaying && (
                    <button
                      onClick={() => setPlayingId(video.id)}
                      className="text-[11px] font-black uppercase tracking-widest text-orange-500 hover:text-orange-400 flex items-center gap-1.5 pt-1 cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>Watch</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
