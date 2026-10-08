import React, { useState, useEffect } from 'react';
import { Video } from 'lucide-react';
import { VideoCard } from './VideoCard';

import { safeFetch } from '../utils/api';

export interface ShopVideo {
  id: string;
  url: string;
  title: string;
  description?: string;
  /**
   * Set when the file lives in the shop's own storage rather than on YouTube or
   * Vimeo. Removing such a video also deletes the file, so it stops counting
   * against the storage quota.
   */
  storageObject?: string;
}

/** The published list, as every visitor sees it. */
export async function fetchVideos(): Promise<ShopVideo[]> {
  try {
    const res = await safeFetch('/api/videos');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export const ShopVideos: React.FC = () => {
  const [videos, setVideos] = useState<ShopVideo[]>([]);
  // Clips start muted because that is the only way a browser will start them
  // unasked. At most one may have sound, so unmuting a second silences the
  // first instead of stacking two soundtracks over each other.
  const [soundOnId, setSoundOnId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      fetchVideos().then(list => {
        if (!cancelled) setVideos(list);
      });
    };
    sync();
    // Fires when Paul saves from the admin portal in this same tab.
    window.addEventListener('shop_videos_updated', sync);
    return () => {
      cancelled = true;
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
          <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-bold pt-1">
            Playing automatically — press the speaker for sound
          </p>
        </div>

        {/* Sized to the number of videos. A fixed three-column grid left a
            single clip stranded at a third of the width. */}
        <div
          className={`grid grid-cols-1 gap-8 ${
            videos.length === 1
              ? 'max-w-4xl mx-auto'
              : videos.length === 2
                ? 'md:grid-cols-2 max-w-5xl mx-auto'
                : 'md:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {videos.map(video => (
            <VideoCard
              key={video.id}
              video={video}
              soundOn={soundOnId === video.id}
              onRequestSound={setSoundOnId}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
