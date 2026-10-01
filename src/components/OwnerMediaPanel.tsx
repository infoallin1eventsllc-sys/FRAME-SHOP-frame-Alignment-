import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  Upload,
  Link as LinkIcon,
  Video as VideoIcon,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Plus,
  Trash2,
} from "lucide-react";
import { SHOP_INFO, WORK_PROJECTS } from "../data/shopData";
import { safeFetch, getApiUrl } from "../utils/api";
import { DEFAULT_HERO_IMAGE } from "./Hero";
import { fetchVideos, ShopVideo } from "./ShopVideos";
import { parseVideoUrl, describeVideoUrl, isPlayable } from "../utils/videoEmbed";
import { inspectVideoFile, titleFromFilename } from "../utils/videoFile";
import { fetchSiteMedia, saveSiteMedia, SiteMedia } from "../utils/siteMedia";
import {
  processImage,
  formatBytes,
  HERO_PRESET,
  PORTRAIT_PRESET,
  GALLERY_PRESET,
} from "../utils/imageProcessor";

/**
 * The Command Center's Photos & Videos tab: the homepage hero, Paul's photo,
 * the case-study gallery and the shop videos. The portal mounts it only after
 * login and keeps it mounted while other tabs are open, so an upload in
 * progress carries on if Paul looks at something else.
 */
export const OwnerMediaPanel: React.FC = () => {
  // Media Control State (Owner Only)
  const DEFAULT_PAUL_IMG = 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?q=80&w=1200&auto=format&fit=crop';
  const [paulPhoto, setPaulPhoto] = useState<string>(DEFAULT_PAUL_IMG);
  const [paulUrlInput, setPaulUrlInput] = useState<string>('');
  const [paulMsg, setPaulMsg] = useState<string>('');
  const [paulBusy, setPaulBusy] = useState<boolean>(false);

  const [heroImage, setHeroImage] = useState<string>(DEFAULT_HERO_IMAGE);
  const [heroUrlInput, setHeroUrlInput] = useState<string>('');
  const [heroMsg, setHeroMsg] = useState<string>('');
  const [heroBusy, setHeroBusy] = useState<boolean>(false);

  const saveHeroImage = async (newUrl: string, note?: string) => {
    const previous = heroImage;
    setHeroImage(newUrl);
    try {
      await saveSiteMedia({ ...mediaRef.current, heroImage: newUrl });
      mediaRef.current = { ...mediaRef.current, heroImage: newUrl };
    } catch (e) {
      console.error(e);
      setHeroImage(previous);
      alert(e instanceof Error ? e.message : 'The photo could not be saved to the website.');
      return;
    }
    setHeroMsg(note || 'Landing page hero background updated!');
    setTimeout(() => setHeroMsg(''), 6000);
  };

  const handleHeroFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setHeroBusy(true);
    try {
      const shot = await processImage(file, HERO_PRESET);
      saveHeroImage(
        shot.dataUrl,
        `Hero updated — ${
          shot.fittedWhole
            ? `kept whole at ${shot.width}×${shot.height} (too tall to crop to a banner)`
            : `auto-cropped to ${shot.width}×${shot.height}`
        }, sharpened, ${formatBytes(shot.originalBytes)} → ${formatBytes(shot.bytes)}`
      );
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'That image could not be processed.');
    } finally {
      setHeroBusy(false);
    }
  };

  const handleHeroReset = async () => {
    try {
      await saveSiteMedia({ ...mediaRef.current, heroImage: '' });
      mediaRef.current = { ...mediaRef.current, heroImage: '' };
    } catch (e) {
      // It used to report the reset as done whether or not it saved.
      alert(e instanceof Error ? e.message : 'The change could not be saved to the website.');
      return;
    }
    setHeroImage(DEFAULT_HERO_IMAGE);
    setHeroMsg('Hero photo removed — headline now shows on the plain dark background.');
    setTimeout(() => setHeroMsg(''), 3000);
  };

  const [galleryPhotos, setGalleryPhotos] = useState<Record<string, string>>({});

  /**
   * The saved media as the server last confirmed it. Each save sends the whole
   * object, so this keeps the other two photos from being wiped when one of
   * them is changed.
   */
  const mediaRef = useRef<SiteMedia>({});
  const [galleryUrlInputs, setGalleryUrlInputs] = useState<Record<string, string>>({});
  const [galleryMsg, setGalleryMsg] = useState<string>('');
  const [galleryBusyId, setGalleryBusyId] = useState<string | null>(null);

  // Shop video links (YouTube / Vimeo / direct file)
  const [videos, setVideos] = useState<ShopVideo[]>([]);
  const [videoUrlInput, setVideoUrlInput] = useState<string>('');
  const [videoTitleInput, setVideoTitleInput] = useState<string>('');
  const [videoMsg, setVideoMsg] = useState<string>('');
  const [videoUploading, setVideoUploading] = useState<boolean>(false);
  const [videoUploadPct, setVideoUploadPct] = useState<number>(0);
  const [videoDragActive, setVideoDragActive] = useState<boolean>(false);
  const [videoLinkOpen, setVideoLinkOpen] = useState<boolean>(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [videoConfig, setVideoConfig] = useState<{ enabled: boolean; maxBytes: number } | null>(null);

  // Ask the server whether it can host files, so the upload control only shows
  // when it would actually work.
  useEffect(() => {
    let cancelled = false;

    safeFetch('/api/videos/config')
      .then(r => (r.ok ? r.json() : null))
      .then(cfg => {
        if (!cancelled && cfg) setVideoConfig(cfg);
      })
      .catch(() => {
        /* hosting simply stays unavailable; the paste-a-link path still works */
      });

    fetchVideos().then(list => {
      if (!cancelled) setVideos(list);
    });

    // Load the photos currently live on the site, so the previews match what
    // customers see and a save doesn't wipe the ones we didn't touch.
    fetchSiteMedia().then(media => {
      if (cancelled) return;
      mediaRef.current = media;
      setHeroImage(media.heroImage || DEFAULT_HERO_IMAGE);
      setPaulPhoto(media.paulPhoto || DEFAULT_PAUL_IMG);
      setGalleryPhotos(media.galleryPhotos || {});
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Saves the published list to the server. It cannot live in this browser —
   * customers are the audience, and browser storage is private to one device.
   */
  const persistVideos = async (next: ShopVideo[], note: string): Promise<boolean> => {
    const previous = videos;
    setVideos(next);
    try {
      const res = await safeFetch('/api/videos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status}).`);
      window.dispatchEvent(new CustomEvent('shop_videos_updated'));
    } catch (e) {
      console.error(e);
      setVideos(previous); // don't leave the screen claiming a save that failed
      alert(
        'The video list could not be saved to the server, so nothing was published. Check the site is running and try again.'
      );
      return false;
    }
    setVideoMsg(note);
    setTimeout(() => setVideoMsg(''), 6000);
    return true;
  };

  const handleAddVideo = (e: React.FormEvent) => {
    e.preventDefault();
    const url = videoUrlInput.trim();
    const title = videoTitleInput.trim();

    if (!url || !title) {
      alert('A video needs both a link and a title.');
      return;
    }
    if (!isPlayable(url)) {
      alert(
        "That link isn't a video we can play. Paste a YouTube or Vimeo link — for example https://youtu.be/xxxxxxxxxxx"
      );
      return;
    }
    if (videos.some(v => v.url === url)) {
      alert('That video is already on the site.');
      return;
    }

    persistVideos(
      [
        ...videos,
        {
          id: `vid-${Date.now()}`,
          url,
          title,
        },
      ],
      `"${title}" added to the website.`
    );
    setVideoUrlInput('');
    setVideoTitleInput('');
  };

  const handleRemoveVideo = async (id: string) => {
    const target = videos.find(v => v.id === id);
    if (!target) return;

    const hosted = Boolean(target.storageObject);
    const question = hosted
      ? `Remove "${target.title}" from the website and permanently delete the video file?`
      : `Remove "${target.title}" from the website?`;
    if (!confirm(question)) return;

    // The file is deleted only once the list no longer points at it. The old
    // order deleted it even when the list failed to save, leaving a broken
    // video on the site.
    if (!(await persistVideos(videos.filter(v => v.id !== id), `"${target.title}" removed.`))) return;

    if (hosted) {
      try {
        const res = await safeFetch(`/api/videos/object/${encodeURIComponent(target.storageObject!)}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch (err) {
        console.error("Could not delete the stored file", err);
        setVideoMsg(`"${target.title}" is off the website, but its file could not be deleted from storage. It is harmless; Otis can clear it.`);
      }
    }
  };

  /**
   * XHR rather than fetch: a shop clip can be a couple of hundred megabytes over
   * shop wifi, and fetch gives no upload progress to show against that.
   */
  const uploadVideoFile = (file: File): Promise<{ url: string; objectName: string }> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", getApiUrl("/api/videos/upload"));
      xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
      xhr.setRequestHeader("x-video-filename", file.name.replace(/[^\w.\- ]+/g, ""));
      try {
        const token = sessionStorage.getItem("shop_admin_token");
        if (token) xhr.setRequestHeader("x-shop-secret", token);
      } catch {
        /* sessionStorage unavailable — the server will reject if it needs auth */
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setVideoUploadPct(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        let payload: any = {};
        try {
          payload = JSON.parse(xhr.responseText || "{}");
        } catch {
          /* fall through to the status check below */
        }
        if (xhr.status >= 200 && xhr.status < 300 && payload.url) resolve(payload);
        else reject(new Error(payload.error || `Upload failed (${xhr.status}).`));
      };
      xhr.onerror = () => reject(new Error("Network error during upload."));
      xhr.onabort = () => reject(new Error("Upload cancelled."));
      xhr.send(file);
    });

  /**
   * The whole of adding a video: hand it a file and it ends up on the website.
   * No form to fill in first — the name comes from the file and can be corrected
   * afterwards by clicking it in the list.
   */
  const publishVideoFile = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      alert("That is not a video file. Drop a video from your camera roll or computer.");
      return;
    }

    // Say so up front rather than after the wait, if this site has no storage set up.
    if (videoConfig && !videoConfig.enabled) {
      alert(
        "This website isn't set up to hold video files yet.\n\n" +
        "For now, put the video on YouTube, set it to Unlisted, and use " +
        "\"Already on YouTube? Add it by link instead\" underneath.\n\n" +
        "Ask Otis to switch on video storage if you'd rather upload files directly."
      );
      setVideoLinkOpen(true);
      return;
    }

    const title = videoTitleInput.trim() || titleFromFilename(file.name);

    // Catch the problems before the upload, not after minutes of waiting.
    const report = await inspectVideoFile(file, videoConfig?.maxBytes ?? 200 * 1024 * 1024);
    if (report.error) {
      alert(report.error);
      return;
    }
    if (report.warning) setVideoMsg(report.warning);

    setVideoUploadPct(0);
    setVideoUploading(true);
    try {
      const { url, objectName } = await uploadVideoFile(file);
      persistVideos(
        [
          ...videos,
          {
            id: `vid-${Date.now()}`,
            url,
            title,
              storageObject: objectName,
          },
        ],
        `"${title}" uploaded (${formatBytes(file.size)}) and published.`
      );
      setVideoTitleInput("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "The upload failed.");
    } finally {
      setVideoUploading(false);
      setVideoUploadPct(0);
    }
  };

  const handleMoveVideo = (id: string, direction: -1 | 1) => {
    const index = videos.findIndex(v => v.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= videos.length) return;
    const next = [...videos];
    [next[index], next[target]] = [next[target], next[index]];
    persistVideos(next, 'Video order updated.');
  };

  const savePaulPhoto = async (newUrl: string, note?: string) => {
    const previous = paulPhoto;
    setPaulPhoto(newUrl);
    try {
      await saveSiteMedia({ ...mediaRef.current, paulPhoto: newUrl });
      mediaRef.current = { ...mediaRef.current, paulPhoto: newUrl };
    } catch (e) {
      console.error(e);
      setPaulPhoto(previous);
      alert(e instanceof Error ? e.message : 'The photo could not be saved to the website.');
      return;
    }
    setPaulMsg(note || "Paul's website biopic photo updated!");
    setTimeout(() => setPaulMsg(''), 6000);
  };

  const handlePaulFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setPaulBusy(true);
    try {
      const shot = await processImage(file, PORTRAIT_PRESET);
      savePaulPhoto(
        shot.dataUrl,
        `Photo updated — auto-cropped to ${shot.width}×${shot.height}, sharpened, ${formatBytes(
          shot.originalBytes
        )} → ${formatBytes(shot.bytes)}`
      );
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'That image could not be processed.');
    } finally {
      setPaulBusy(false);
    }
  };

  const handlePaulReset = async () => {
    try {
      await saveSiteMedia({ ...mediaRef.current, paulPhoto: '' });
      mediaRef.current = { ...mediaRef.current, paulPhoto: '' };
    } catch (e) {
      alert(e instanceof Error ? e.message : 'The change could not be saved to the website.');
      return;
    }
    setPaulPhoto(DEFAULT_PAUL_IMG);
    setPaulMsg("Your photo was removed. The site shows the standard shop picture until you upload one.");
    setTimeout(() => setPaulMsg(''), 3000);
  };

  const saveGalleryPhoto = async (projId: string, newUrl: string, note?: string) => {
    const previous = galleryPhotos;
    const updated = { ...galleryPhotos, [projId]: newUrl };
    setGalleryPhotos(updated);
    try {
      await saveSiteMedia({ ...mediaRef.current, galleryPhotos: updated });
      mediaRef.current = { ...mediaRef.current, galleryPhotos: updated };
    } catch (e) {
      console.error(e);
      setGalleryPhotos(previous);
      alert(e instanceof Error ? e.message : 'The photo could not be saved to the website.');
      return;
    }
    setGalleryMsg(note || 'Case Study gallery photo updated!');
    setTimeout(() => setGalleryMsg(''), 6000);
  };

  const handleGalleryFileUpload = async (
    projId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setGalleryBusyId(projId);
    try {
      const shot = await processImage(file, GALLERY_PRESET);
      saveGalleryPhoto(
        projId,
        shot.dataUrl,
        `Case study photo updated — auto-cropped to ${shot.width}×${shot.height}, sharpened, ${formatBytes(
          shot.originalBytes
        )} → ${formatBytes(shot.bytes)}`
      );
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'That image could not be processed.');
    } finally {
      setGalleryBusyId(null);
    }
  };

  const handleGalleryReset = async (projId: string) => {
    const updated = { ...galleryPhotos };
    delete updated[projId];
    try {
      await saveSiteMedia({ ...mediaRef.current, galleryPhotos: updated });
      mediaRef.current = { ...mediaRef.current, galleryPhotos: updated };
    } catch (e) {
      alert(e instanceof Error ? e.message : 'The change could not be saved to the website.');
      return;
    }
    setGalleryPhotos(updated);
    setGalleryMsg('Gallery project photo reset to default.');
    setTimeout(() => setGalleryMsg(''), 3000);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-zinc-950 border border-zinc-800 p-5 space-y-2">
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-500 flex items-center gap-2">
          <Camera className="w-4 h-4 text-orange-500" />
          <span>INTERNAL OWNER MEDIA &amp; WEBSITE PHOTO CONTROL PORTAL</span>
        </div>
        <h3 className="text-2xl font-black text-zinc-100 uppercase italic">
          WEBSITE PHOTO &amp; CASE STUDY GALLERY MANAGER
        </h3>
        <p className="text-xs text-zinc-400 leading-relaxed">
          As the shop owner, you have sole administrative control over all customer-facing images. Any photo uploaded or changed here updates the website immediately without exposing public upload buttons to customers.
        </p>
      </div>

      {/* Section 1: Landing Page Hero Background */}
      <div className="bg-zinc-950 border border-orange-600/40 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 flex-wrap gap-2">
          <div>
            <div className="text-[10px] font-black uppercase text-orange-500 tracking-widest">
              Landing Page Headline Image
            </div>
            <h4 className="text-lg font-black text-zinc-100 uppercase italic">
              1. HERO BACKGROUND IMAGE (TOP OF HOMEPAGE)
            </h4>
          </div>
          {heroMsg && (
            <span className="text-xs font-bold text-orange-400 bg-orange-950/80 px-3 py-1 border border-orange-500/50 uppercase tracking-wider">
              ✓ {heroMsg}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <div className="space-y-2">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Current Live Hero Background:
            </div>
            <div className="relative h-56 bg-zinc-900 border border-zinc-800 overflow-hidden">
              {heroImage ? (
                <img
                  src={heroImage}
                  alt="Hero background"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain bg-zinc-950"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-4 bg-zinc-950">
                  <Camera className="w-6 h-6 text-zinc-700" />
                  <div className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                    No hero photo set
                  </div>
                  <div className="text-[10px] text-zinc-600 leading-relaxed">
                    The homepage headline is showing on the plain dark background
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-zinc-950/90 text-orange-500 text-[10px] font-black px-2 py-1 uppercase tracking-widest border border-zinc-800">
                Live On Website
              </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-zinc-200 tracking-wider flex items-center gap-2">
                <Upload className="w-3.5 h-3.5 text-orange-500" />
                <span>Option A: Upload Hero Image from Device</span>
              </label>
              <label
                className={`border-2 border-dashed p-4 flex items-center justify-center gap-3 transition-colors text-center group ${
                  heroBusy
                    ? "border-orange-600 bg-orange-950/30 cursor-wait"
                    : "border-zinc-800 hover:border-orange-600 bg-zinc-900/60 cursor-pointer"
                }`}
              >
                <Upload
                  className={`w-5 h-5 transition-colors ${
                    heroBusy
                      ? "text-orange-500 animate-pulse"
                      : "text-zinc-400 group-hover:text-orange-500"
                  }`}
                />
                <div>
                  <div className="text-xs font-bold text-zinc-200 group-hover:text-white uppercase tracking-wider">
                    {heroBusy
                      ? "Optimizing image…"
                      : "Click to select image file from computer / device"}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    {heroBusy
                      ? "Fitting, sharpening and compressing for the web"
                      : "Auto-fitted, sharpened and compressed — JPG, PNG, WEBP"}
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleHeroFileUpload}
                  disabled={heroBusy}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-zinc-200 tracking-wider flex items-center gap-2">
                <LinkIcon className="w-3.5 h-3.5 text-orange-500" />
                <span>Option B: Paste Web Image URL</span>
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (heroUrlInput.trim()) {
                    saveHeroImage(heroUrlInput.trim());
                    setHeroUrlInput("");
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="url"
                  placeholder="https://example.com/motorcycle.jpg"
                  value={heroUrlInput}
                  onChange={(e) => setHeroUrlInput(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-orange-600"
                />
                <button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-500 text-white font-black px-5 text-[11px] uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </form>
            </div>

            <button
              onClick={handleHeroReset}
              className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 hover:text-orange-500 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Remove photo (plain dark background)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 2: Paul's Website Photo */}
      <div className="bg-zinc-950 border border-zinc-800 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 flex-wrap gap-2">
          <div>
            <div className="text-[10px] font-black uppercase text-orange-500 tracking-widest">
              Owner Identity Photo
            </div>
            <h4 className="text-lg font-black text-zinc-100 uppercase italic">
              2. YOUR PHOTO ("ABOUT PAUL" SECTION)
            </h4>
          </div>
          {paulMsg && (
            <span className="text-xs font-bold text-orange-400 bg-orange-950/80 px-3 py-1 border border-orange-500/50 uppercase tracking-wider">
              ✓ {paulMsg}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Image Preview Card */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Current Live Website Image:
            </div>
            <div className="relative h-56 bg-zinc-900 border border-zinc-800 overflow-hidden">
              <img
                src={paulPhoto}
                alt={SHOP_INFO.owner}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-zinc-950/90 text-orange-500 text-[10px] font-black px-2 py-1 uppercase tracking-widest border border-zinc-800">
                Live On Website
              </div>
            </div>
          </div>

          {/* Upload Controls */}
          <div className="md:col-span-2 space-y-4">
            {/* File Upload Option */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-zinc-200 tracking-wider flex items-center gap-2">
                <Upload className="w-3.5 h-3.5 text-orange-500" />
                <span>Option A: Upload New Photo from Device</span>
              </label>
              <label
                className={`border-2 border-dashed p-4 flex items-center justify-center gap-3 transition-colors text-center group ${
                  paulBusy
                    ? "border-orange-600 bg-orange-950/30 cursor-wait"
                    : "border-zinc-800 hover:border-orange-600 bg-zinc-900/60 cursor-pointer"
                }`}
              >
                <Upload
                  className={`w-5 h-5 transition-colors ${
                    paulBusy
                      ? "text-orange-500 animate-pulse"
                      : "text-zinc-400 group-hover:text-orange-500"
                  }`}
                />
                <div>
                  <div className="text-xs font-bold text-zinc-200 group-hover:text-white uppercase tracking-wider">
                    {paulBusy
                      ? "Optimizing image…"
                      : "Click to select image file from computer / device"}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    {paulBusy
                      ? "Cropping, sharpening and compressing for the web"
                      : "Auto-cropped to portrait and sharpened — JPG, PNG, WEBP"}
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePaulFileUpload}
                  disabled={paulBusy}
                  className="hidden"
                />
              </label>
            </div>

            {/* URL Option */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-zinc-200 tracking-wider flex items-center gap-2">
                <LinkIcon className="w-3.5 h-3.5 text-orange-500" />
                <span>Option B: Paste Web Image URL</span>
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (paulUrlInput.trim()) {
                    savePaulPhoto(paulUrlInput.trim());
                    setPaulUrlInput("");
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="url"
                  placeholder="https://example.com/paul-photo.jpg"
                  value={paulUrlInput}
                  onChange={(e) => setPaulUrlInput(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-orange-600 text-zinc-100 px-3 py-2 text-xs font-mono outline-none"
                />
                <button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-500 text-white font-black px-4 py-2 text-xs uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Apply URL
                </button>
              </form>
            </div>

            {/* Reset Option */}
            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500 italic">
                Want to restore the original shop biopic photo?
              </span>
              <button
                type="button"
                onClick={handlePaulReset}
                className="text-xs text-zinc-400 hover:text-orange-400 font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer bg-zinc-900 px-3 py-1.5 border border-zinc-800"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Paul's Photo to Default</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Case Study Gallery Photos */}
      <div className="bg-zinc-950 border border-zinc-800 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 flex-wrap gap-2">
          <div>
            <div className="text-[10px] font-black uppercase text-orange-500 tracking-widest">
              Portfolio Build Gallery
            </div>
            <h4 className="text-lg font-black text-zinc-100 uppercase italic">
              3. CASE STUDY &amp; WORK GALLERY PHOTOS ("OUR WORK" SECTION)
            </h4>
          </div>
          {galleryMsg && (
            <span className="text-xs font-bold text-orange-400 bg-orange-950/80 px-3 py-1 border border-orange-500/50 uppercase tracking-wider">
              ✓ {galleryMsg}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {WORK_PROJECTS.map((proj) => {
            const activeImg = galleryPhotos[proj.id] || proj.imageUrl;
            const hasCustom = Boolean(galleryPhotos[proj.id]);
            const inputVal = galleryUrlInputs[proj.id] || "";

            return (
              <div key={proj.id} className="bg-zinc-900/80 border border-zinc-800 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <div>
                    <div className="text-[10px] font-black uppercase text-orange-500 tracking-wider">
                      {proj.bikeModel} ({proj.year})
                    </div>
                    <div className="text-sm font-black text-zinc-100 uppercase italic">
                      {proj.title}
                    </div>
                  </div>
                  {hasCustom && (
                    <span className="text-[9px] font-black uppercase bg-orange-950 text-orange-400 border border-orange-600/40 px-2 py-0.5">
                      Custom Photo Active
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 items-center">
                  <div className="relative h-28 bg-zinc-950 border border-zinc-800 overflow-hidden">
                    <img
                      src={activeImg}
                      alt={proj.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    {/* File Input */}
                    <label
                      className={`border border-dashed p-2 flex items-center justify-center gap-2 transition-colors ${
                        galleryBusyId === proj.id
                          ? "border-orange-500 bg-orange-950/30 cursor-wait"
                          : "border-zinc-700 hover:border-orange-500 bg-zinc-950 cursor-pointer"
                      }`}
                    >
                      <Upload
                        className={`w-3.5 h-3.5 ${
                          galleryBusyId === proj.id
                            ? "text-orange-500 animate-pulse"
                            : "text-zinc-400"
                        }`}
                      />
                      <span className="text-[10px] font-bold text-zinc-200 uppercase tracking-wider">
                        {galleryBusyId === proj.id ? "Optimizing…" : "Upload File"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleGalleryFileUpload(proj.id, e)}
                        disabled={galleryBusyId === proj.id}
                        className="hidden"
                      />
                    </label>

                    {/* URL Form */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (inputVal.trim()) {
                          saveGalleryPhoto(proj.id, inputVal.trim());
                          setGalleryUrlInputs((prev) => ({ ...prev, [proj.id]: "" }));
                        }
                      }}
                      className="flex gap-1"
                    >
                      <input
                        type="url"
                        placeholder="Paste image URL..."
                        value={inputVal}
                        onChange={(e) =>
                          setGalleryUrlInputs((prev) => ({ ...prev, [proj.id]: e.target.value }))
                        }
                        className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-orange-600 text-zinc-100 px-2 py-1 text-[11px] font-mono outline-none"
                      />
                      <button
                        type="submit"
                        className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-2 py-1 text-[10px] uppercase tracking-wider cursor-pointer"
                      >
                        Save
                      </button>
                    </form>

                    {hasCustom && (
                      <button
                        type="button"
                        onClick={() => handleGalleryReset(proj.id)}
                        className="text-[10px] text-zinc-400 hover:text-orange-400 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset to Default</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 4: Shop Video Links */}
      <div className="bg-zinc-950 border border-zinc-800 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 flex-wrap gap-2">
          <div>
            <div className="text-[10px] font-black uppercase text-orange-500 tracking-widest">
              Your Own Shop Footage
            </div>
            <h4 className="text-lg font-black text-zinc-100 uppercase italic">
              4. SHOP VIDEOS ("SHOP VIDEO" SECTION)
            </h4>
          </div>
          {videoMsg && (
            <span className="text-xs font-bold text-orange-400 bg-orange-950/80 px-3 py-1 border border-orange-500/50 uppercase tracking-wider">
              ✓ {videoMsg}
            </span>
          )}
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Drop a video below and it goes straight onto your website. There is nothing
          else to fill in.
        </p>

        {/* One action. Drag a video in, or tap to pick one. */}
        {videoUploading ? (
          <div className="border-2 border-orange-600/60 bg-orange-950/20 p-8 space-y-3">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-orange-400">
              <span>Putting your video on the website…</span>
              <span className="tabular-nums">{videoUploadPct}%</span>
            </div>
            <div className="h-2 w-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-orange-600 transition-all duration-200"
                style={{ width: `${videoUploadPct}%` }}
              />
            </div>
            <div className="text-[11px] text-zinc-400">
              Keep this window open until it reaches 100%.
            </div>
          </div>
        ) : (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setVideoDragActive(true);
            }}
            onDragLeave={() => setVideoDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setVideoDragActive(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) publishVideoFile(dropped);
            }}
            className={`border-2 border-dashed p-10 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-colors ${
              videoDragActive
                ? "border-orange-500 bg-orange-950/30"
                : "border-zinc-700 hover:border-orange-600 bg-zinc-900/60"
            }`}
          >
            <VideoIcon
              className={`w-10 h-10 ${videoDragActive ? "text-orange-500" : "text-zinc-600"}`}
            />
            <div className="text-sm font-black uppercase italic text-zinc-100">
              Drop a video here
            </div>
            <div className="text-xs text-zinc-400">
              {videoConfig && !videoConfig.enabled
                ? "File storage isn't switched on — use the YouTube option below"
                : "or click to choose one from your computer"}
            </div>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                e.target.value = "";
                if (chosen) publishVideoFile(chosen);
              }}
              className="hidden"
            />
          </label>
        )}

        {/* Secondary path, folded away so it isn't a decision up front. */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setVideoLinkOpen((open) => !open)}
            className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 hover:text-orange-400 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {videoLinkOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span>Already on YouTube? Add it by link instead</span>
          </button>

          {videoLinkOpen && (
            <form onSubmit={handleAddVideo} className="bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
              <input
                type="text"
                placeholder="Paste the YouTube link"
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-600 px-3 py-2.5 text-xs text-zinc-100 font-mono outline-none"
              />
              {videoUrlInput.trim() && (
                <div
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isPlayable(videoUrlInput) ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {describeVideoUrl(videoUrlInput)}
                </div>
              )}
              <input
                type="text"
                placeholder="Give it a name, e.g. Road Glide frame straightening"
                value={videoTitleInput}
                onChange={(e) => setVideoTitleInput(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-600 px-3 py-2.5 text-xs text-zinc-100 outline-none"
              />
              <button
                type="submit"
                className="bg-orange-600 hover:bg-orange-500 text-white font-black px-6 py-2.5 text-[11px] uppercase tracking-widest transition-colors cursor-pointer flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Put It On The Website</span>
              </button>
            </form>
          )}
        </div>

        {/* Current list */}
        {videos.length === 0 ? (
          <div className="border border-dashed border-zinc-800 p-6 text-center space-y-1">
            <VideoIcon className="w-6 h-6 text-zinc-700 mx-auto" />
            <div className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
              No videos yet
            </div>
            <div className="text-[10px] text-zinc-600">
              The Shop Video section stays hidden on the website until you add one.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
              Live on the website ({videos.length}) — top to bottom order
            </div>
            {videos.map((vid, idx) => {
              const parsed = parseVideoUrl(vid.url);
              return (
                <div
                  key={vid.id}
                  className="bg-zinc-900 border border-zinc-800 p-3 flex items-center gap-3 flex-wrap sm:flex-nowrap"
                >
                  <div className="w-24 h-14 bg-zinc-950 border border-zinc-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {parsed.thumbnailUrl ? (
                      <img
                        src={parsed.thumbnailUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.hidden = true;
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <VideoIcon className="w-5 h-5 text-zinc-700" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    {renamingId === vid.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => {
                          const name = renameValue.trim();
                          if (name && name !== vid.title) {
                            persistVideos(
                              videos.map(v => (v.id === vid.id ? { ...v, title: name } : v)),
                              'Name updated.'
                            );
                          }
                          setRenamingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className="w-full bg-zinc-950 border border-orange-600 px-2 py-1 text-xs text-zinc-100 outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(vid.id);
                          setRenameValue(vid.title);
                        }}
                        title="Click to rename"
                        className="text-xs font-black uppercase italic text-zinc-100 truncate hover:text-orange-400 transition-colors cursor-pointer text-left w-full"
                      >
                        {vid.title}
                      </button>
                    )}
                    {vid.description && (
                      <div className="text-[10px] text-zinc-400 truncate">{vid.description}</div>
                    )}
                    <a
                      href={vid.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-zinc-500 hover:text-orange-500 font-mono truncate block"
                    >
                      {vid.url}
                    </a>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveVideo(vid.id, -1)}
                      disabled={idx === 0}
                      aria-label="Move up"
                      className="p-1.5 border border-zinc-800 text-zinc-400 hover:text-orange-500 hover:border-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveVideo(vid.id, 1)}
                      disabled={idx === videos.length - 1}
                      aria-label="Move down"
                      className="p-1.5 border border-zinc-800 text-zinc-400 hover:text-orange-500 hover:border-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveVideo(vid.id)}
                      aria-label={`Remove ${vid.title}`}
                      className="p-1.5 border border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-500 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
