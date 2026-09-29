import React from 'react';
import { Heart, MessageCircle, Send, Bookmark, ThumbsUp, Share2, Music2, Phone, ImagePlus, X } from 'lucide-react';
import { SHOP_INFO } from '../data/shopData';

export type PreviewChannel = 'instagram' | 'facebook' | 'tiktok' | 'google';
export const PREVIEW_CHANNELS: readonly string[] = ['instagram', 'facebook', 'tiktok', 'google'];

/** A photo or clip Paul picked on this device. Never uploaded — he posts it himself. */
export type PickedMedia = { url: string; kind: 'image' | 'video'; name: string };

// Limits the apps enforce, so a problem shows here rather than at posting time.
const LIMITS: Partial<Record<PreviewChannel, { chars: number; hashtags?: number }>> = {
  instagram: { chars: 2200, hashtags: 30 },
  google: { chars: 1500 },
};

/** Roughly how much of a caption shows before the app cuts it off with "more". */
const FOLD: Partial<Record<PreviewChannel, number>> = { instagram: 125, tiktok: 100, facebook: 480 };

function folded(text: string, channel: PreviewChannel) {
  const at = FOLD[channel];
  if (!at || text.length <= at) return { shown: text, cut: false };
  return { shown: text.slice(0, at).replace(/\s+\S*$/, ''), cut: true };
}

const Media: React.FC<{ media: PickedMedia | null; className: string; fallback: string }> = ({ media, className, fallback }) =>
  media ? (
    media.kind === 'video' ? (
      <video src={media.url} className={`${className} object-cover`} autoPlay muted loop playsInline aria-label={media.name} />
    ) : (
      <img src={media.url} className={`${className} object-cover`} alt={media.name} />
    )
  ) : (
    <div className={`${className} flex items-center justify-center bg-zinc-800 text-zinc-400 text-xs text-center p-6`}>{fallback}</div>
  );

const Avatar: React.FC<{ size?: string }> = ({ size = 'w-8 h-8' }) => (
  <div className={`${size} rounded-full bg-zinc-950 border border-orange-600 flex items-center justify-center text-[9px] font-black text-orange-500 flex-shrink-0`} aria-hidden="true">
    FS
  </div>
);

/**
 * What a draft will look like in the app it's meant for, on a phone-sized
 * screen, with the photo or video Paul attaches. The layouts are simplified —
 * enough to judge the picture, the first lines people see, and the length.
 */
export const PostPreview: React.FC<{
  channel: PreviewChannel;
  text: string;
  hashtags: string[];
  media: PickedMedia | null;
  onPick: (m: PickedMedia | null) => void;
  mediaHint?: string;
}> = ({ channel, text, hashtags, media, onPick, mediaHint }) => {
  const tags = hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`));
  const caption = [text.trim(), tags.join(' ')].filter(Boolean).join('\n\n');
  const { shown, cut } = folded(caption, channel);
  const fallback = mediaHint ? `Add the photo or clip: ${mediaHint}` : 'Add a photo or video to see it here';

  const limit = LIMITS[channel];
  const warnings: string[] = [];
  if (limit && caption.length > limit.chars) warnings.push(`${caption.length.toLocaleString()} characters — ${channel === 'google' ? 'Google' : 'Instagram'} allows ${limit.chars.toLocaleString()}.`);
  if (limit?.hashtags && tags.length > limit.hashtags) warnings.push(`${tags.length} hashtags — Instagram allows ${limit.hashtags}.`);
  if (channel === 'tiktok' && media?.kind === 'image') warnings.push('TikTok posts here are planned as videos. A photo works only as a photo post.');

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    onPick({ url: URL.createObjectURL(file), kind: file.type.startsWith('video/') ? 'video' : 'image', name: file.name });
  };

  const Caption = ({ className = '' }: { className?: string }) => (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {shown}
      {cut && <span className="opacity-60">… more</span>}
    </p>
  );

  return (
    <div className="space-y-3" data-testid="post-preview">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-zinc-100">
          <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
          {media ? 'Change photo / video' : 'Add photo / video'}
          <input type="file" accept="image/*,video/*" onChange={pick} className="sr-only" aria-label="Choose a photo or video for this post" />
        </label>
        {media && (
          <button type="button" onClick={() => onPick(null)} className="inline-flex items-center gap-1 text-[11px] font-bold uppercase text-zinc-500 hover:text-red-400">
            <X className="w-3.5 h-3.5" aria-hidden="true" /> Remove
          </button>
        )}
        <span className="text-[11px] text-zinc-500">Stays on this device — nothing is uploaded or posted.</span>
      </div>

      {/* The phone */}
      <div className="mx-auto w-[300px] max-w-full rounded-[2rem] border-[6px] border-zinc-700 bg-black overflow-hidden shadow-sm" role="img" aria-label={`${channel} preview`}>
        {channel === 'instagram' && (
          <div className="bg-white text-zinc-900 text-[12px]">
            <div className="flex items-center gap-2 px-3 py-2">
              <Avatar />
              <span className="font-semibold">{SHOP_INFO.instagramHandle.replace(/^@/, '')}</span>
            </div>
            <Media media={media} className="w-full aspect-square" fallback={fallback} />
            <div className="flex items-center gap-3 px-3 pt-2" aria-hidden="true">
              <Heart className="w-5 h-5" /><MessageCircle className="w-5 h-5" /><Send className="w-5 h-5" />
              <Bookmark className="w-5 h-5 ml-auto" />
            </div>
            <p className="px-3 pt-1 pb-3 whitespace-pre-wrap break-words">
              <span className="font-semibold">{SHOP_INFO.instagramHandle.replace(/^@/, '')}</span> {shown}
              {cut && <span className="opacity-60">… more</span>}
            </p>
          </div>
        )}

        {channel === 'facebook' && (
          <div className="bg-white text-zinc-900 text-[12px]">
            <div className="flex items-center gap-2 px-3 py-2">
              <Avatar />
              <div>
                <div className="font-semibold">{SHOP_INFO.name}</div>
                <div className="text-[10px] text-zinc-500">Just now</div>
              </div>
            </div>
            <div className="px-3 pb-2"><Caption /></div>
            <Media media={media} className="w-full aspect-[4/5]" fallback={fallback} />
            <div className="flex justify-around py-2 text-zinc-600 border-t border-zinc-200" aria-hidden="true">
              <ThumbsUp className="w-4 h-4" /><MessageCircle className="w-4 h-4" /><Share2 className="w-4 h-4" />
            </div>
          </div>
        )}

        {channel === 'tiktok' && (
          <div className="relative aspect-[9/16] bg-zinc-900 text-white text-[12px]">
            <Media media={media} className="absolute inset-0 w-full h-full" fallback={fallback} />
            <div className="absolute inset-x-0 bottom-0 p-3 pr-12 bg-gradient-to-t from-black/80 to-transparent">
              <div className="font-semibold mb-1">{SHOP_INFO.name}</div>
              <Caption />
              <div className="flex items-center gap-1 mt-1 text-[10px] opacity-80" aria-hidden="true"><Music2 className="w-3 h-3" /> original sound</div>
            </div>
            <div className="absolute right-2 bottom-16 flex flex-col items-center gap-3" aria-hidden="true">
              <Avatar size="w-9 h-9" /><Heart className="w-6 h-6" /><MessageCircle className="w-6 h-6" /><Share2 className="w-6 h-6" />
            </div>
          </div>
        )}

        {channel === 'google' && (
          <div className="bg-white text-zinc-900 text-[12px]">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200">
              <Avatar />
              <div>
                <div className="font-semibold">{SHOP_INFO.name}</div>
                <div className="text-[10px] text-zinc-500">Update on Google</div>
              </div>
            </div>
            <Media media={media} className="w-full aspect-[4/3]" fallback={fallback} />
            <div className="px-3 py-2"><Caption /></div>
            <div className="px-3 pb-3">
              <span className="inline-flex items-center gap-1 text-sky-700 font-semibold" aria-hidden="true"><Phone className="w-3.5 h-3.5" /> Call now</span>
            </div>
          </div>
        )}
      </div>

      {warnings.map((w) => (
        <p key={w} className="text-[11px] text-amber-300 text-center" data-testid="preview-warning">{w}</p>
      ))}
    </div>
  );
};
