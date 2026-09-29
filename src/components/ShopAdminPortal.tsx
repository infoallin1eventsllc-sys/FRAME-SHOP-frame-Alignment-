import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Calendar,
  Clock,
  CheckCircle2,
  Phone,
  Mail,
  Wrench,
  X,
  AlertCircle,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Trash2,
  FileText,
  DollarSign,
  Lock,
  Unlock,
  Printer,
  Plus,
  Minus,
  Save,
  FileCheck,
  CreditCard,
  Calculator,
  Tag,
  Sparkles,
  FileSpreadsheet,
  Download,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  Wifi,
  Receipt,
  RotateCcw,
  ShoppingBag,
  Coins,
  Camera,
  Upload,
  Link as LinkIcon,
  Video as VideoIcon,
  ChevronUp,
  ChevronDown,
  HelpCircle,
} from "lucide-react";
import { SHOP_INFO, WORK_PROJECTS } from "../data/shopData";
import { Booking, InternalInvoice, InvoiceLineItem, ShopRates } from "../types";
import { RatesPanel, fetchRates } from "./RatesPanel";
import { recalcInvoice, newInvoiceForBooking, balanceDue, normalizeInvoice, PAYMENT_METHOD_LABEL } from "../utils/invoiceMath";
import { safeFetch, getApiUrl } from "../utils/api";
import { DEFAULT_HERO_IMAGE } from "./Hero";
import { fetchVideos, ShopVideo } from "./ShopVideos";
import { parseVideoUrl, describeVideoUrl, isPlayable } from "../utils/videoEmbed";
import { inspectVideoFile, titleFromFilename } from "../utils/videoFile";
import { OWNER_GUIDE } from "../data/ownerGuide";
import { fetchSiteMedia, saveSiteMedia, SiteMedia } from "../utils/siteMedia";
import { MessagesPanel, fetchMessages } from "./MessagesPanel";
import { MarketingPanel } from "./MarketingPanel";
import {
  processImage,
  formatBytes,
  HERO_PRESET,
  PORTRAIT_PRESET,
  GALLERY_PRESET,
} from "../utils/imageProcessor";
import {
  connectBluetoothPrinter,
  sendPayloadToBluetoothPrinter,
  buildEscPosWorkOrderPayload,
  isWebBluetoothSupported,
  getActiveBluetoothDeviceName,
} from "../utils/bluetoothPrinter";

interface ShopAdminPortalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function exportSingleInvoiceToExcel(booking: Booking, invoice: InternalInvoice) {
  const wb = XLSX.utils.book_new();

  const invoiceData: any[][] = [
    ["THE FRAME SHOP - 3D LASER FRAME & CHASSIS ALIGNMENT"],
    ["INTERNAL OWNER WORK ORDER & INVOICE"],
    [""],
    ["Invoice #:", invoice.invoiceNumber, "", "Invoice Date:", invoice.createdDate],
    ["Ticket #:", booking.ticketNumber, "", "Due Date:", invoice.dueDate],
    ["Technician:", invoice.mechanicName, "", "Payment Status:", invoice.paymentStatus.toUpperCase()],
    [""],
    ["CUSTOMER & MOTORCYCLE DETAILS"],
    ["Customer Name:", booking.name, "", "Phone:", booking.phone],
    ["Email:", booking.email, "", "Requested Service:", booking.serviceTitle],
    ["Motorcycle:", `${booking.bikeYear} ${booking.bikeMake} ${booking.bikeModel}`],
    ["Customer Issue Notes:", booking.issueNotes || "N/A"],
    [""],
    ["ITEMIZED CHARGES"],
    ["Item #", "Category", "Description", "Qty / Hours", "Rate ($)", "Line Total ($)"]
  ];

  invoice.items.forEach((item, index) => {
    invoiceData.push([
      index + 1,
      item.category.toUpperCase(),
      item.description,
      item.quantity,
      item.rate,
      item.amount
    ]);
  });

  invoiceData.push([""]);
  invoiceData.push(["", "", "", "", "Subtotal ($):", invoice.subtotal]);
  invoiceData.push(["", "", "", "", `Shop Supplies (${invoice.shopSuppliesRatePct}%):`, invoice.shopSuppliesAmount]);
  invoiceData.push(["", "", "", "", `Sales Tax (${invoice.taxRatePct}%):`, invoice.taxAmount]);
  invoiceData.push(["", "", "", "", "TOTAL ($):", invoice.totalAmount]);
  for (const p of invoice.payments ?? []) {
    invoiceData.push(["", "", `Payment ${p.paidAt.slice(0, 10)} — ${PAYMENT_METHOD_LABEL[p.method ?? "shopify"]} ${p.orderName}`, "", "Paid ($):", -p.amount]);
  }
  invoiceData.push(["", "", "", "", "BALANCE DUE ($):", balanceDue(invoice)]);
  invoiceData.push([""]);
  if (invoice.internalOwnerNotes) {
    invoiceData.push(["Internal Accounting Notes:", invoice.internalOwnerNotes]);
  }

  const ws = XLSX.utils.aoa_to_sheet(invoiceData);
  ws['!cols'] = [
    { wch: 8 },
    { wch: 16 },
    { wch: 45 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Work Order Invoice");
  XLSX.writeFile(wb, `${invoice.invoiceNumber}_${booking.ticketNumber}_TheFrameShop.xlsx`);
}

export function exportAllInvoicesToExcel(bookings: Booking[]) {
  const wb = XLSX.utils.book_new();

  const summaryRows: any[][] = [
    ["THE FRAME SHOP - ALL INTERNAL WORK ORDERS & INVOICES SUMMARY"],
    ["Export Date:", new Date().toLocaleString()],
    [""],
    ["Invoice #", "Ticket #", "Date", "Customer Name", "Phone", "Motorcycle", "Service", "Subtotal ($)", "Supplies ($)", "Tax ($)", "Total Amount ($)", "Paid ($)", "Balance Due ($)", "Status"]
  ];

  const detailRows: any[][] = [
    ["Invoice #", "Ticket #", "Customer", "Item Category", "Item Description", "Qty/Hrs", "Rate ($)", "Amount ($)"]
  ];

  let grandTotal = 0;

  bookings.forEach((b) => {
    if (b.invoice) {
      const inv = b.invoice;
      grandTotal += inv.totalAmount;
      summaryRows.push([
        inv.invoiceNumber,
        b.ticketNumber,
        inv.createdDate,
        b.name,
        b.phone,
        `${b.bikeYear} ${b.bikeMake} ${b.bikeModel}`,
        b.serviceTitle,
        inv.subtotal,
        inv.shopSuppliesAmount,
        inv.taxAmount,
        inv.totalAmount,
        inv.amountPaid ?? 0,
        balanceDue(inv),
        inv.paymentStatus.toUpperCase()
      ]);

      inv.items.forEach((item) => {
        detailRows.push([
          inv.invoiceNumber,
          b.ticketNumber,
          b.name,
          item.category.toUpperCase(),
          item.description,
          item.quantity,
          item.rate,
          item.amount
        ]);
      });
    }
  });

  summaryRows.push([""]);
  summaryRows.push(["TOTAL INVOICED ($):", "", "", "", "", "", "", "", "", "", grandTotal]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 28 }, { wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Invoices Summary");

  const wsDetails = XLSX.utils.aoa_to_sheet(detailRows);
  wsDetails['!cols'] = [
    { wch: 16 }, { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 45 }, { wch: 10 }, { wch: 12 }, { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, wsDetails, "Itemized Charges");

  XLSX.writeFile(wb, `TheFrameShop_MasterInvoices_${new Date().toISOString().split("T")[0]}.xlsx`);
}


export const ShopAdminPortal: React.FC<ShopAdminPortalProps> = ({ isOpen, onClose }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");

  // Navigation Tab State
  const [activeMainTab, setActiveMainTab] = useState<"bookings" | "messages" | "marketing" | "pricematrix" | "media" | "help">("bookings");
  const [unhandledMessages, setUnhandledMessages] = useState(0);

  /**
   * Opens the guide as its own plain page so Paul can print it or save it as a
   * PDF for his phone. Printing the portal itself would drag the whole dashboard
   * along with it.
   */
  const printOwnerGuide = () => {
    const html = OWNER_GUIDE.map(section => `
      <section>
        <h2>${section.heading}</h2>
        ${section.blurb ? `<p class="blurb">${section.blurb}</p>` : ""}
        ${section.items.map(item => `
          <div class="task">
            <h3>${item.task}</h3>
            <ol>${item.steps.map(s => `<li>${s}</li>`).join("")}</ol>
            ${item.note ? `<p class="note">${item.note}</p>` : ""}
          </div>`).join("")}
      </section>`).join("");

    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) {
      alert("Your browser blocked the print window. Allow pop-ups for this site and try again.");
      return;
    }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8">
      <title>The Frame Shop — Running Your Website</title>
      <style>
        body{font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
             color:#18181b;max-width:44rem;margin:2.5rem auto;padding:0 1.5rem}
        h1{font-size:1.9rem;margin:0 0 .25rem;font-style:italic;text-transform:uppercase;letter-spacing:-.02em}
        .sub{color:#71717a;margin:0 0 2rem;font-size:.9rem}
        h2{font-size:.78rem;text-transform:uppercase;letter-spacing:.18em;color:#ea580c;
           border-bottom:1px solid #e4e4e7;padding-bottom:.4rem;margin:2.2rem 0 .8rem}
        .blurb{color:#52525b;font-size:.88rem;margin:0 0 1rem}
        .task{margin:0 0 1.3rem;break-inside:avoid}
        h3{font-size:1rem;margin:0 0 .35rem}
        ol{margin:.2rem 0;padding-left:1.3rem}
        li{margin:.2rem 0}
        .note{background:#fafafa;border-left:3px solid #ea580c;padding:.5rem .75rem;
              margin:.5rem 0 0;font-size:.85rem;color:#3f3f46}
        @media print{body{margin:0;max-width:none}}
      </style></head><body>
      <h1>Running Your Website</h1>
      <p class="sub">The Frame Shop &middot; Spring, Texas &middot; prepared by Meridian Interface</p>
      ${html}
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

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
    if (!isAuthenticated) return;
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
  }, [isAuthenticated]);

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

  // Paul's own rates — the starting point for every new invoice.
  const [rates, setRates] = useState<ShopRates | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [portalError, setPortalError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingTechNoteId, setEditingTechNoteId] = useState<string | null>(null);
  const [techNoteText, setTechNoteText] = useState<string>("");

  // Invoice Builder State
  const [activeInvoiceBooking, setActiveInvoiceBooking] = useState<Booking | null>(null);
  const [invoiceFormState, setInvoiceFormState] = useState<InternalInvoice | null>(null);
  const [invoiceNotice, setInvoiceNotice] = useState<string>("");
  const [pdfBusy, setPdfBusy] = useState<"" | "email" | "download">("");
  const [emailConfig, setEmailConfig] = useState<{ enabled: boolean; replyTo: string } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "check" | "card_in_person" | "other">("cash");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [invoiceSendStatus, setInvoiceSendStatus] = useState<{ loading: boolean; url: string | null; error: string | null }>({ loading: false, url: null, error: null });

  // POS Modal State

  // Bluetooth Printer Capabilities State
  const [btDeviceName, setBtDeviceName] = useState<string>(getActiveBluetoothDeviceName());
  const [btStatus, setBtStatus] = useState<"idle" | "connecting" | "connected" | "printing" | "success" | "error">("idle");
  const [btMessage, setBtMessage] = useState<string>("");

  const handleConnectBluetooth = async () => {
    setBtStatus("connecting");
    setBtMessage("Scanning for Bluetooth thermal work order printers...");
    const res = await connectBluetoothPrinter();
    if (res.success) {
      setBtDeviceName(res.deviceName);
      setBtStatus("connected");
      setBtMessage(`Connected to ${res.deviceName}! Ready for direct wireless thermal work order printing.`);
    } else {
      setBtStatus("error");
      setBtMessage(res.error || "Could not pair with Bluetooth printer.");
    }
  };

  const handlePrintBluetoothWorkOrder = async () => {
    if (!activeInvoiceBooking || !invoiceFormState) return;

    let deviceToUse = btDeviceName;
    if (!deviceToUse) {
      setBtStatus("connecting");
      setBtMessage("Pairing Bluetooth printer...");
      const conn = await connectBluetoothPrinter();
      if (!conn.success) {
        setBtStatus("error");
        setBtMessage(conn.error || "Bluetooth printer pairing required.");
        return;
      }
      deviceToUse = conn.deviceName;
      setBtDeviceName(conn.deviceName);
    }

    setBtStatus("printing");
    setBtMessage(`Transmitting ESC/POS work order bytes to ${deviceToUse}...`);

    const payload = buildEscPosWorkOrderPayload(
      SHOP_INFO.name,
      activeInvoiceBooking.ticketNumber,
      invoiceFormState.invoiceNumber,
      invoiceFormState.createdDate,
      activeInvoiceBooking.name,
      activeInvoiceBooking.phone,
      `${activeInvoiceBooking.bikeYear} ${activeInvoiceBooking.bikeMake} ${activeInvoiceBooking.bikeModel}`,
      activeInvoiceBooking.serviceTitle,
      invoiceFormState.items,
      invoiceFormState.subtotal,
      invoiceFormState.shopSuppliesAmount,
      invoiceFormState.taxAmount,
      invoiceFormState.totalAmount,
      invoiceFormState.amountPaid ?? 0,
      balanceDue(invoiceFormState)
    );

    const res = await sendPayloadToBluetoothPrinter(payload);
    if (res.success) {
      setBtStatus("success");
      setBtMessage(`Work order successfully printed to ${deviceToUse}!`);
      setTimeout(() => {
        setBtStatus("idle");
        setBtMessage("");
      }, 5000);
    } else {
      setBtStatus("error");
      setBtMessage(res.error || "Failed to transmit payload to Bluetooth printer.");
    }
  };

  /** Reads the error a failed request carries, for showing to Paul. */
  const failure = async (res: Response, fallback: string) => {
    const data = await res.json().catch(() => ({}));
    return data?.error || `${fallback} (error ${res.status})`;
  };

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const res = await safeFetch("/api/bookings");
      if (!res.ok) {
        // An empty list here used to look exactly like "no bookings".
        setPortalError(await failure(res, "Could not load bookings"));
        return;
      }
      const data = await res.json();
      const list: Booking[] = Array.isArray(data) ? data : data.bookings || [];
      setBookings(list.map((b) => (b.invoice ? { ...b, invoice: normalizeInvoice(b.invoice) } : b)));
      setPortalError("");
      // The messages tab carries a count, so Paul sees new ones without opening it.
      const msgs = await fetchMessages();
      if (msgs) setUnhandledMessages(msgs.unhandled);
    } catch {
      setPortalError("Could not reach the website to load bookings. Check your connection and press Refresh.");
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;
    fetchBookings();
    fetchRates().then((r) => r && setRates(r));
    safeFetch("/api/email/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => c && setEmailConfig(c))
      .catch(() => {});
    // New requests show up without pressing Refresh.
    const timer = window.setInterval(fetchBookings, 60_000);
    return () => window.clearInterval(timer);
  }, [isOpen, isAuthenticated]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput) {
      setPinError("Please enter your PIN.");
      return;
    }
    try {
      const res = await safeFetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      if (!res.ok) {
        setPinError("Invalid PIN. Access denied.");
        return;
      }
      const data = await res.json();
      sessionStorage.setItem("shop_admin_token", data.token);
      setIsAuthenticated(true);
      setPinError("");
      fetchBookings();
    } catch {
      setPinError("Connection error. Check your network and try again.");
    }
  };

  /** Every change to a booking goes through here, so a failure is always shown. */
  const patchBooking = async (id: string, body: object, what: string): Promise<Booking | null> => {
    try {
      const res = await safeFetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setPortalError(await failure(res, `Could not ${what}`));
        return null;
      }
      setPortalError("");
      const data = await res.json();
      fetchBookings();
      return data.booking ?? null;
    } catch {
      setPortalError(`Could not ${what}: the website could not be reached.`);
      return null;
    }
  };

  const handleStatusUpdate = (id: string, newStatus: Booking["status"]) =>
    patchBooking(id, { status: newStatus }, "update the status");

  const handleSaveTechNotes = async (id: string) => {
    if (await patchBooking(id, { techNotes: techNoteText }, "save the notes")) setEditingTechNoteId(null);
  };

  const openInvoiceModal = (booking: Booking) => {
    setActiveInvoiceBooking(booking);
    setInvoiceSendStatus({ loading: false, url: null, error: null });
    setInvoiceNotice("");
    setInvoiceFormState(booking.invoice ? recalcInvoice(booking.invoice) : newInvoiceForBooking(booking, rates));
  };

  const updateInvoiceStateAndRecalculate = (updated: InternalInvoice) => {
    setInvoiceFormState(recalcInvoice(updated));
    setInvoiceNotice("");
  };

  const handleInvoiceItemChange = (index: number, field: keyof InvoiceLineItem, value: any) => {
    if (!invoiceFormState) return;
    const newItems = [...invoiceFormState.items];
    newItems[index] = { ...newItems[index], [field]: value };
    updateInvoiceStateAndRecalculate({ ...invoiceFormState, items: newItems });
  };

  const handleAddInvoiceItem = () => {
    if (!invoiceFormState) return;
    const rate = invoiceFormState.laborHourlyRate || 0;
    updateInvoiceStateAndRecalculate({
      ...invoiceFormState,
      items: [
        ...invoiceFormState.items,
        { id: `li-${Date.now()}`, description: "Labor", category: "labor", quantity: 1, rate, amount: rate },
      ],
    });
  };

  /** Adds one of Paul's own services, at his price. */
  const handleAddFromRates = (rateId: string) => {
    if (!invoiceFormState || !rates) return;
    const line = rates.lines.find((l) => l.id === rateId);
    if (!line) return;
    const hourly = line.unit === "per hour";
    updateInvoiceStateAndRecalculate({
      ...invoiceFormState,
      items: [
        ...invoiceFormState.items,
        {
          id: `li-${Date.now()}`,
          description: line.name,
          category: hourly ? "labor" : "service",
          quantity: 1,
          rate: line.price ?? 0,
          amount: line.price ?? 0,
        },
      ],
    });
  };

  const handleRemoveInvoiceItem = (index: number) => {
    if (!invoiceFormState) return;
    updateInvoiceStateAndRecalculate({
      ...invoiceFormState,
      items: invoiceFormState.items.filter((_, i) => i !== index),
    });
  };

  /** Saves the invoice. Returns the booking as the server now holds it, or null. */
  const saveInvoice = async (): Promise<Booking | null> => {
    if (!activeInvoiceBooking || !invoiceFormState) return null;
    const saved = await patchBooking(activeInvoiceBooking.id, { invoice: invoiceFormState }, "save the invoice");
    if (saved?.invoice) {
      setActiveInvoiceBooking(saved);
      setInvoiceFormState(recalcInvoice(saved.invoice));
    }
    return saved;
  };

  const handleSaveInvoice = async () => {
    if (await saveInvoice()) setInvoiceNotice("Invoice saved.");
  };

  const handleSendInvoice = async () => {
    if (!activeInvoiceBooking || !invoiceFormState) return;
    if (!activeInvoiceBooking.email) {
      setInvoiceSendStatus({ loading: false, url: null, error: "This booking has no email address on file. Add the customer's email before sending." });
      return;
    }
    setInvoiceSendStatus({ loading: true, url: null, error: null });
    // Save first, and stop if that fails: the customer is billed from the saved copy.
    const saved = await saveInvoice();
    if (!saved) {
      setInvoiceSendStatus({ loading: false, url: null, error: "The invoice could not be saved, so it was not sent." });
      return;
    }
    try {
      const res = await safeFetch("/api/shopify/invoice/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: saved.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInvoiceSendStatus({ loading: false, url: null, error: data.error || "Failed to send the invoice." });
        return;
      }
      setInvoiceSendStatus({ loading: false, url: data.invoiceUrl, error: null });
      setInvoiceNotice(`Emailed to ${saved.email} for $${Number(data.amountCharged ?? 0).toFixed(2)}.`);
      fetchBookings();
    } catch {
      setInvoiceSendStatus({ loading: false, url: null, error: "Network error. Check your connection and try again." });
    }
  };

  /**
   * The customer's PDF. Saved first, because the PDF is made from the saved
   * invoice — unsaved edits would otherwise be missing from it.
   */
  const handleDownloadPdf = async () => {
    if (!activeInvoiceBooking || pdfBusy) return;
    setPdfBusy("download");
    try {
      const saved = await saveInvoice();
      if (!saved) return;
      const res = await safeFetch(`/api/bookings/${saved.id}/invoice.pdf`);
      if (!res.ok) {
        setInvoiceNotice(await failure(res, "The PDF could not be made"));
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${saved.invoice!.invoiceNumber}-TheFrameShop.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setInvoiceNotice("PDF downloaded.");
    } catch {
      setInvoiceNotice("The PDF could not be downloaded: the website could not be reached.");
    } finally {
      setPdfBusy("");
    }
  };

  const handleEmailPdf = async () => {
    if (!activeInvoiceBooking || pdfBusy) return;
    if (!activeInvoiceBooking.email) {
      setInvoiceNotice("This booking has no email address on file.");
      return;
    }
    if (!window.confirm(`Email this invoice as a PDF to ${activeInvoiceBooking.email}?`)) return;
    setPdfBusy("email");
    try {
      const saved = await saveInvoice();
      if (!saved) return;
      const res = await safeFetch(`/api/bookings/${saved.id}/invoice/email`, { method: "POST" });
      if (!res.ok) {
        setInvoiceNotice(await failure(res, "The invoice email did not send"));
        return;
      }
      const data = await res.json();
      setActiveInvoiceBooking(data.booking);
      setInvoiceNotice(
        `PDF invoice emailed to ${data.to}${data.balanceDue > 0 ? ` — balance due $${Number(data.balanceDue).toFixed(2)}` : " — marked paid in full"}. Replies go to ${emailConfig?.replyTo || SHOP_INFO.email}.`
      );
      fetchBookings();
    } catch {
      setInvoiceNotice("The invoice email did not send: the website could not be reached.");
    } finally {
      setPdfBusy("");
    }
  };

  /** Money taken in person — cash, check, the shop's own card reader. */
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvoiceBooking) return;
    const amount = parseFloat(paymentAmount);
    if (!(amount > 0)) {
      setInvoiceNotice("Enter the amount received.");
      return;
    }
    // Unsaved line changes would be lost when the saved invoice comes back.
    if (invoiceFormState && activeInvoiceBooking.invoice && JSON.stringify(recalcInvoice(activeInvoiceBooking.invoice).items) !== JSON.stringify(invoiceFormState.items)) {
      setInvoiceNotice("Save the invoice first, then record the payment.");
      return;
    }
    try {
      const res = await safeFetch(`/api/bookings/${activeInvoiceBooking.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, method: paymentMethod, note: paymentNote }),
      });
      if (!res.ok) {
        setInvoiceNotice(await failure(res, "The payment was not recorded"));
        return;
      }
      const { booking } = await res.json();
      setActiveInvoiceBooking(booking);
      setInvoiceFormState(booking.invoice ? recalcInvoice(booking.invoice) : newInvoiceForBooking(booking, rates));
      setPaymentAmount("");
      setPaymentNote("");
      setInvoiceNotice(`Recorded $${amount.toFixed(2)} (${PAYMENT_METHOD_LABEL[paymentMethod]}).`);
      fetchBookings();
    } catch {
      setInvoiceNotice("The payment was not recorded: the website could not be reached.");
    }
  };

  const handleRemovePayment = async (paymentId: string) => {
    if (!activeInvoiceBooking || !window.confirm("Remove this payment? Only do this to correct a mistake.")) return;
    try {
      const res = await safeFetch(`/api/bookings/${activeInvoiceBooking.id}/payments/${encodeURIComponent(paymentId)}`, { method: "DELETE" });
      if (!res.ok) {
        setInvoiceNotice(await failure(res, "The payment was not removed"));
        return;
      }
      const { booking } = await res.json();
      setActiveInvoiceBooking(booking);
      setInvoiceFormState(booking.invoice ? recalcInvoice(booking.invoice) : newInvoiceForBooking(booking, rates));
      setInvoiceNotice("Payment removed.");
      fetchBookings();
    } catch {
      setInvoiceNotice("The payment was not removed: the website could not be reached.");
    }
  };

  const handleDeleteBooking = async (id: string) => {
    const b = bookings.find((x) => x.id === id);
    const paid = (b?.invoice?.amountPaid ?? 0) > 0 || (b?.prepayments?.length ?? 0) > 0;
    const question = paid
      ? `Ticket ${b?.ticketNumber} has payments recorded against it. Delete it anyway? Its invoice and payment history go with it.`
      : "Are you sure you want to delete this appointment ticket?";
    if (!window.confirm(question)) return;
    try {
      const res = await safeFetch(`/api/bookings/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setPortalError(await failure(res, "Could not delete the ticket"));
        return;
      }
      setPortalError("");
      fetchBookings();
    } catch {
      setPortalError("Could not delete the ticket: the website could not be reached.");
    }
  };

  // Filter & Search Logic
  const filteredBookings = bookings.filter((b) => {
    const matchesFilter = activeFilter === "all" || b.status === activeFilter;
    const matchesSearch =
      b.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.bikeMake.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.bikeModel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.phone.includes(searchQuery) ||
      (b.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const confirmedCount = bookings.filter((b) => b.status === "confirmed").length;
  const inShopCount = bookings.filter((b) => b.status === "in_shop").length;
  const completedCount = bookings.filter((b) => b.status === "completed").length;
  const cancelledCount = bookings.filter((b) => b.status === "cancelled").length;


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-zinc-950/95 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="bg-zinc-900 border border-zinc-800 rounded-none max-w-5xl w-full p-4 sm:p-8 shadow-2xl relative max-h-[94vh] flex flex-col">
        
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 flex-wrap gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-600 flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5" />
              <span>SHOP MANAGEMENT PORTAL</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-100 uppercase italic tracking-tighter">
              PAUL'S SHOP <span className="text-orange-600">COMMAND CENTER</span>
            </h2>

            {isAuthenticated && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveMainTab("bookings")}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeMainTab === "bookings"
                      ? "bg-orange-600 text-white shadow"
                      : "bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800"
                  }`}
                >
                  📋 Work Orders &amp; Appointments ({bookings.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMainTab("messages")}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeMainTab === "messages"
                      ? "bg-orange-600 text-white shadow"
                      : unhandledMessages > 0
                        ? "bg-zinc-950 text-orange-300 hover:text-white border border-orange-600"
                        : "bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800"
                  }`}
                >
                  ✉️ Customer Messages ({unhandledMessages} new)
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMainTab("marketing")}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeMainTab === "marketing"
                      ? "bg-orange-600 text-white shadow"
                      : "bg-zinc-950 text-orange-300 hover:text-white border border-orange-600/50"
                  }`}
                >
                  ✨ Marketing
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMainTab("pricematrix")}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeMainTab === "pricematrix"
                      ? "bg-amber-500 text-zinc-950 font-black shadow"
                      : "bg-zinc-950 text-amber-400 hover:text-amber-300 border border-amber-600/40"
                  }`}
                  title="Your prices — the starting point for every invoice"
                >
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>🔒 My Rates</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMainTab("media")}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeMainTab === "media"
                      ? "bg-orange-600 text-white shadow"
                      : "bg-zinc-950 text-orange-400 hover:text-white border border-orange-600/40"
                  }`}
                  title="Owner Website Photo & Media Control Portal (Owner Only)"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>📸 Owner Photo Control</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMainTab("help")}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeMainTab === "help"
                      ? "bg-orange-600 text-white shadow"
                      : "bg-zinc-950 text-zinc-300 hover:text-white border border-zinc-700"
                  }`}
                  title="How to run your website"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>How Do I…?</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isAuthenticated && (
              <>

                {activeMainTab === "bookings" && (
                  <button
                    onClick={() => exportAllInvoicesToExcel(bookings)}
                    className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 px-3 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    title="Export All Invoices to Microsoft Excel Workbook"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Invoices Excel</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    fetchBookings();
                                }}
                  className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-3 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Refresh Data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Close Portal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!isAuthenticated ? (
          /* Login PIN Prompt */
          <div className="py-16 px-4 max-w-md mx-auto text-center space-y-6 my-auto">
            <div className="w-16 h-16 bg-zinc-950 text-orange-600 border border-zinc-800 rounded-none flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-zinc-100 uppercase italic">
                SHOP OWNER AUTHENTICATION
              </h3>
              <p className="text-zinc-400 text-xs font-normal">
                Enter your 4-digit mechanic PIN to access live customer appointment tickets and alignment schedule.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">
                  Shop Owner PIN
                </label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter PIN"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-600 text-zinc-100 p-3 text-center text-lg font-mono tracking-widest focus:outline-none"
                  autoFocus
                />
              </div>

              {pinError && (
                <div className="text-xs text-red-500 font-bold flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{pinError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-3 rounded-none uppercase tracking-widest text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Unlock className="w-4 h-4" />
                <span>Unlock Shop Portal</span>
              </button>
            </form>

            <div className="pt-2 text-[11px] text-zinc-500">
              Contact the shop owner for PIN access.
            </div>
          </div>
        ) : (
          /* Logged-In Admin Content */
          <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
            {portalError && (
              <div role="alert" className="p-3 bg-red-950/80 border border-red-600/60 text-red-200 text-sm font-bold flex items-start justify-between gap-3">
                <span className="flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{portalError}</span>
                <button type="button" onClick={() => setPortalError("")} aria-label="Dismiss" className="text-red-300 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {activeMainTab === "messages" ? (
              <MessagesPanel onCountChange={setUnhandledMessages} />
            ) : activeMainTab === "marketing" ? (
              <MarketingPanel onDataChanged={fetchBookings} />
            ) : activeMainTab === "pricematrix" ? (
              <RatesPanel onSaved={setRates} />
            ) : activeMainTab === "media" ? (
              /* Internal Owner Photo & Gallery Media Manager */
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
                        2. PAUL HEARY BIOPIC PHOTO ("ABOUT PAUL" SECTION)
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
            ) : activeMainTab === "help" ? (
              /* Plain-language owner's guide */
              <div className="space-y-6 font-sans">
                <div className="bg-zinc-950 border border-zinc-800 p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                      <div className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-500 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4" />
                        <span>Owner's Guide</span>
                      </div>
                      <h3 className="text-2xl font-black text-zinc-100 uppercase italic">
                        RUNNING YOUR WEBSITE
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={printOwnerGuide}
                      className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 font-black px-4 py-2.5 text-[11px] uppercase tracking-widest transition-colors cursor-pointer flex items-center gap-2 flex-shrink-0"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print / Save PDF</span>
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Everything you can change on your own, in the order you're likely to need it.
                    Print it for the shop wall, or save it as a PDF and keep it on your phone.
                  </p>
                </div>

                {OWNER_GUIDE.map((section) => (
                  <div key={section.heading} className="bg-zinc-950 border border-zinc-800 p-5 space-y-4">
                    <div className="border-b border-zinc-800 pb-2.5">
                      <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-500">
                        {section.heading}
                      </h4>
                      {section.blurb && (
                        <p className="text-[11px] text-zinc-500 mt-1">{section.blurb}</p>
                      )}
                    </div>

                    <div className="space-y-5">
                      {section.items.map((item) => (
                        <div key={item.task} className="space-y-1.5">
                          <div className="text-sm font-black uppercase italic text-zinc-100">
                            {item.task}
                          </div>
                          <ol className="space-y-1 list-decimal list-inside">
                            {item.steps.map((step, i) => (
                              <li key={i} className="text-xs text-zinc-300 leading-relaxed">
                                {step}
                              </li>
                            ))}
                          </ol>
                          {item.note && (
                            <p className="text-[11px] text-zinc-400 italic border-l-2 border-orange-600 pl-2.5 leading-relaxed">
                              {item.note}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Work Orders & Appointments View */
              <div className="space-y-6">
                {/* Stats Overview Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-zinc-950 p-4 border border-zinc-800">
                <div className="text-[10px] font-black uppercase text-orange-500 tracking-widest">
                  Pending Review
                </div>
                <div className="text-3xl font-black text-zinc-100 italic mt-1">
                  {pendingCount}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">Needs confirmation</div>
              </div>

              <div className="bg-zinc-950 p-4 border border-zinc-800">
                <div className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">
                  Confirmed Lifts
                </div>
                <div className="text-3xl font-black text-zinc-100 italic mt-1">
                  {confirmedCount}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">Scheduled &amp; locked</div>
              </div>

              <div className="bg-zinc-950 p-4 border border-zinc-800">
                <div className="text-[10px] font-black uppercase text-blue-500 tracking-widest">
                  Bikes In Shop
                </div>
                <div className="text-3xl font-black text-zinc-100 italic mt-1">
                  {inShopCount}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">Under inspection/work</div>
              </div>

              <div className="bg-zinc-950 p-4 border border-zinc-800">
                <div className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">
                  Completed Builds
                </div>
                <div className="text-3xl font-black text-zinc-100 italic mt-1">
                  {completedCount}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">Zero-tolerance certified</div>
              </div>
            </div>

            {/* Controls Bar: Filters & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-950 p-3 border border-zinc-800">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs font-bold uppercase tracking-wider">
                {[
                  { id: "all", label: `All (${bookings.length})` },
                  { id: "pending", label: `Pending (${pendingCount})` },
                  { id: "confirmed", label: `Confirmed (${confirmedCount})` },
                  { id: "in_shop", label: `In Shop (${inShopCount})` },
                  { id: "completed", label: `Completed (${completedCount})` },
                  { id: "cancelled", label: `Cancelled (${cancelledCount})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-none whitespace-nowrap cursor-pointer transition-all ${
                      activeFilter === tab.id
                        ? "bg-orange-600 text-white font-black"
                        : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, ticket #, model..."
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-orange-600 text-zinc-100 text-xs pl-8 pr-3 py-2 focus:outline-none rounded-none"
                />
              </div>
            </div>

            {/* Bookings List Cards */}
            {filteredBookings.length === 0 ? (
              <div className="text-center py-12 bg-zinc-950 border border-zinc-800 space-y-3">
                <Wrench className="w-8 h-8 text-zinc-600 mx-auto" />
                <div className="text-sm font-bold text-zinc-300 uppercase tracking-widest">
                  No appointment tickets found
                </div>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  No bookings match your current filter or search. New requests from the website appear here within a minute, or press Refresh.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBookings.map((b) => {
                  let statusBadgeClass = "bg-zinc-800 text-zinc-300 border-zinc-700";
                  if (b.status === "pending") statusBadgeClass = "bg-orange-950/80 text-orange-400 border-orange-600/60";
                  if (b.status === "confirmed") statusBadgeClass = "bg-emerald-950/80 text-emerald-400 border-emerald-600/60";
                  if (b.status === "in_shop") statusBadgeClass = "bg-blue-950/80 text-blue-400 border-blue-600/60";
                  if (b.status === "completed") statusBadgeClass = "bg-zinc-900 text-zinc-400 border-zinc-800";
                  if (b.status === "cancelled") statusBadgeClass = "bg-red-950/80 text-red-400 border-red-600/60";

                  return (
                    <div
                      key={b.id}
                      className="bg-zinc-950 border border-zinc-800 p-5 space-y-4 hover:border-zinc-700 transition-all"
                    >
                      {/* Ticket Header Line */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-900">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black uppercase tracking-widest text-zinc-100 bg-zinc-900 px-2.5 py-1 border border-zinc-800">
                            Ticket #{b.ticketNumber}
                          </span>
                          <span
                            className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 border ${statusBadgeClass}`}
                          >
                            {b.status.replace("_", " ")}
                          </span>
                        </div>

                        <div className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-orange-600" />
                          <span>Submitted: {new Date(b.createdAt).toLocaleDateString()} at {new Date(b.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>

                      {/* Info Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        {/* Rider & Contact */}
                        <div className="space-y-1.5 bg-zinc-900/60 p-3 border border-zinc-900">
                          <div className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                            Rider Info
                          </div>
                          <div className="text-sm font-bold text-zinc-100">{b.name}</div>
                          <div className="flex items-center gap-1.5 text-zinc-300">
                            <Phone className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                            <a href={`tel:${b.phone}`} className="hover:text-orange-400 font-mono font-bold">
                              {b.phone}
                            </a>
                          </div>
                          <div className="flex items-center gap-1.5 text-zinc-400 truncate">
                            <Mail className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                            <a href={`mailto:${b.email}`} className="hover:text-zinc-200 truncate">
                              {b.email}
                            </a>
                          </div>
                          {/* Only customers who ticked the box may be sent offers. */}
                          <div
                            className={`text-[10px] font-bold uppercase tracking-wider ${b.marketingConsent ? "text-emerald-400" : "text-zinc-500"}`}
                            title={b.marketingConsent ? `Agreed ${new Date(b.marketingConsent.at).toLocaleString()}: "${b.marketingConsent.wording}"` : undefined}
                          >
                            {b.marketingConsent ? "✓ OK to send offers" : "No marketing — booking only"}
                          </div>
                          {b.source && (
                            <div className="text-[10px] text-zinc-500">Heard about us: {b.source}</div>
                          )}
                        </div>

                        {/* Bike & Requested Service */}
                        <div className="space-y-1.5 bg-zinc-900/60 p-3 border border-zinc-900">
                          <div className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                            Motorcycle &amp; Service
                          </div>
                          <div className="text-sm font-bold text-zinc-100 italic">
                            {b.bikeYear} {b.bikeMake} {b.bikeModel}
                          </div>
                          <div className="text-orange-500 font-bold uppercase tracking-wide">
                            {b.serviceTitle}
                          </div>
                          <div className="text-zinc-400 flex items-center gap-1 font-bold">
                            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Requested: {b.preferredDate} ({b.preferredTimeSlot})</span>
                          </div>
                        </div>

                        {/* Reported Symptoms */}
                        <div className="space-y-1.5 bg-zinc-900/60 p-3 border border-zinc-900">
                          <div className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                            Customer Notes / Handling Symptoms
                          </div>
                          <p className="text-zinc-300 italic leading-relaxed text-[11px]">
                            "{b.issueNotes || "No specific symptom notes provided."}"
                          </p>
                        </div>
                      </div>

                      {/* Technician Alignment Notes Section */}
                      <div className="bg-zinc-900/40 p-3 border border-zinc-900 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-orange-600" />
                            <span>Paul's Technician Alignment &amp; Scan Measurements</span>
                          </span>

                          {editingTechNoteId !== b.id && (
                            <button
                              onClick={() => {
                                setEditingTechNoteId(b.id);
                                setTechNoteText(b.techNotes || "");
                              }}
                              className="text-[10px] text-orange-500 hover:text-orange-400 uppercase font-black tracking-widest cursor-pointer"
                            >
                              {b.techNotes ? "Edit Tech Notes" : "+ Add Tech Notes"}
                            </button>
                          )}
                        </div>

                        {editingTechNoteId === b.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={techNoteText}
                              onChange={(e) => setTechNoteText(e.target.value)}
                              placeholder="e.g., Laser scan measurement: Rear wheel offset 8mm left. Swingarm torque verified..."
                              rows={2}
                              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs p-2 focus:outline-none focus:border-orange-600"
                            />
                            <div className="flex justify-end gap-2 text-xs">
                              <button
                                onClick={() => setEditingTechNoteId(null)}
                                className="px-3 py-1 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white uppercase font-bold"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveTechNotes(b.id)}
                                className="px-3 py-1 bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-wider"
                              >
                                Save Measurements
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-300 font-mono">
                            {b.techNotes ? (
                              <span className="text-zinc-200">{b.techNotes}</span>
                            ) : (
                              <span className="text-zinc-600 italic">No technician notes saved yet.</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Internal Owner Invoice & Work Order Bar */}
                      <div className="bg-zinc-900/80 p-3 border border-zinc-800 space-y-2">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Calculator className="w-4 h-4 text-orange-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
                              Internal Work Order &amp; Invoice (Owner View Only)
                            </span>
                          </div>

                          {b.invoice ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono font-bold text-orange-400 bg-zinc-950 px-2 py-0.5 border border-zinc-800">
                                Total: ${b.invoice.totalAmount.toFixed(2)}
                              </span>
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 border ${
                                  b.invoice.paymentStatus === "paid_in_full"
                                    ? "bg-emerald-950 text-emerald-400 border-emerald-600/40"
                                    : b.invoice.paymentStatus === "deposit_paid"
                                    ? "bg-amber-950 text-amber-400 border-amber-600/40"
                                    : "bg-red-950 text-red-400 border-red-600/40"
                                }`}
                              >
                                {b.invoice.paymentStatus === "paid_in_full"
                                  ? "Paid in full"
                                  : b.invoice.paymentStatus === "deposit_paid"
                                  ? `Part paid — $${balanceDue(b.invoice).toFixed(2)} due`
                                  : "Unpaid"}
                              </span>
                              <button
                                onClick={() => openInvoiceModal(b)}
                                className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-1 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                              >
                                Edit Invoice
                              </button>
                              <button
                                onClick={() => exportSingleInvoiceToExcel(b, b.invoice!)}
                                className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
                                title="Export single invoice to Excel (.xlsx)"
                              >
                                <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
                                <span>Excel</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openInvoiceModal(b)}
                                className="bg-zinc-950 hover:bg-orange-600/20 text-orange-400 hover:text-orange-300 border border-orange-600/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Create Owner Invoice</span>
                              </button>
                              {(b.prepayments?.length ?? 0) > 0 && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 border bg-amber-950 text-amber-400 border-amber-600/40">
                                  ${b.prepayments!.reduce((s, p) => s + p.amount, 0).toFixed(2)} paid in advance
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Controls Toolbar */}
                      <div className="pt-2 border-t border-zinc-900 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black uppercase text-zinc-500 mr-1">Update Status:</span>

                          <button
                            onClick={() => handleStatusUpdate(b.id, "confirmed")}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                              b.status === "confirmed"
                                ? "bg-emerald-600 text-white"
                                : "bg-zinc-900 hover:bg-emerald-950/80 text-emerald-400 border border-zinc-800"
                            }`}
                          >
                            ✓ Confirm Lift
                          </button>

                          <button
                            onClick={() => handleStatusUpdate(b.id, "in_shop")}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                              b.status === "in_shop"
                                ? "bg-blue-600 text-white"
                                : "bg-zinc-900 hover:bg-blue-950/80 text-blue-400 border border-zinc-800"
                            }`}
                          >
                            🔧 In Shop
                          </button>

                          <button
                            onClick={() => handleStatusUpdate(b.id, "completed")}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                              b.status === "completed"
                                ? "bg-zinc-700 text-white"
                                : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
                            }`}
                          >
                            🏁 Mark Completed
                          </button>

                          <button
                            onClick={() => handleStatusUpdate(b.id, "cancelled")}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                              b.status === "cancelled"
                                ? "bg-red-800 text-white"
                                : "bg-zinc-900 hover:bg-red-950/80 text-red-400 border border-zinc-800"
                            }`}
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${b.phone}`}
                            className="px-3 py-1.5 bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white border border-orange-600/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
                          >
                            <Phone className="w-3 h-3" />
                            <span>Call Rider</span>
                          </a>

                          <button
                            onClick={() => handleDeleteBooking(b.id)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 border border-zinc-800 transition-colors cursor-pointer"
                            title="Delete Ticket"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    )}
  </div>

      {/* Internal Invoice & Work Order Editor Overlay Modal */}
      {activeInvoiceBooking && invoiceFormState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-zinc-950 border-2 border-orange-600 rounded-none max-w-4xl w-full p-4 sm:p-6 shadow-2xl relative max-h-[95vh] flex flex-col space-y-4 text-zinc-100 overflow-y-auto font-sans">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-zinc-800 pb-3 flex-wrap gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-400 bg-amber-950/80 px-2.5 py-0.5 border border-amber-600/40 tracking-widest">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>INTERNAL OWNER INVOICE &amp; WORK ORDER (CONFIDENTIAL)</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-zinc-100 uppercase italic mt-1">
                  WORK ORDER <span className="text-orange-500">#{invoiceFormState.invoiceNumber}</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  This financial invoice is strictly internal for Paul's accounting and physical lift work orders. No pricing is exposed on the public website.
                </p>
              </div>

              <button
                onClick={() => {
                  setActiveInvoiceBooking(null);
                  setInvoiceFormState(null);
                }}
                className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer & Bike Info Box */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-900/80 p-3 border border-zinc-800 text-xs">
              <div>
                <span className="text-[10px] font-black uppercase text-orange-500">Rider Info</span>
                <div className="font-bold text-zinc-100">{activeInvoiceBooking.name}</div>
                <div className="text-zinc-400">{activeInvoiceBooking.phone} • {activeInvoiceBooking.email}</div>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-orange-500">Motorcycle</span>
                <div className="font-bold text-zinc-100 italic">
                  {activeInvoiceBooking.bikeYear} {activeInvoiceBooking.bikeMake} {activeInvoiceBooking.bikeModel}
                </div>
                <div className="text-zinc-400">Ticket #{activeInvoiceBooking.ticketNumber}</div>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-orange-500">Service Requested</span>
                <div className="font-bold text-orange-400">{activeInvoiceBooking.serviceTitle}</div>
                <div className="text-zinc-400">{activeInvoiceBooking.preferredDate} ({activeInvoiceBooking.preferredTimeSlot})</div>
              </div>
            </div>

            {/* Add one of Paul's own services, at his price */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <label htmlFor="invoice-add-rate" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Add from my rates:
              </label>
              {rates && rates.lines.length > 0 ? (
                <select
                  id="invoice-add-rate"
                  value=""
                  onChange={(e) => handleAddFromRates(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs p-1.5 focus:outline-none focus:border-orange-500 rounded-none"
                >
                  <option value="">Choose a service…</option>
                  {rates.lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}{l.price != null ? ` — $${l.price.toFixed(2)}${l.unit === "per hour" ? "/hr" : ""}` : " — no price set"}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-zinc-500">Set up your services in the My Rates tab.</span>
              )}
              {rates && !rates.confirmedAt && (
                <span className="text-amber-400">Your rates are not saved yet — check them in My Rates.</span>
              )}
            </div>

            {/* Itemized Line Items Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                  Itemized Work Order Charges
                </span>
                <button
                  onClick={handleAddInvoiceItem}
                  className="text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-orange-400 px-2.5 py-1 uppercase font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Item</span>
                </button>
              </div>

              <div className="border border-zinc-800 overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-zinc-900 text-[10px] font-black uppercase text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="p-2">Category</th>
                      <th className="p-2">Description</th>
                      <th className="p-2 w-20 text-center">Qty / Hrs</th>
                      <th className="p-2 w-24 text-right">Rate ($)</th>
                      <th className="p-2 w-24 text-right">Amount ($)</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 bg-zinc-950">
                    {invoiceFormState.items.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="p-2">
                          <select
                            value={item.category}
                            onChange={(e) => handleInvoiceItemChange(idx, "category", e.target.value)}
                            className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs p-1 focus:outline-none focus:border-orange-500 rounded-none"
                          >
                            <option value="service">Service (flat price)</option>
                            <option value="labor">Labor ($/hr)</option>
                            <option value="laser_scan">Laser Scan Fee</option>
                            <option value="parts">Parts &amp; Hardware</option>
                            <option value="supplies">Shop Consumables</option>
                            <option value="sublet">Sublet / Welding</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleInvoiceItemChange(idx, "description", e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs p-1 focus:outline-none focus:border-orange-500 rounded-none"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={item.quantity}
                            onChange={(e) => handleInvoiceItemChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs p-1 text-center font-mono focus:outline-none focus:border-orange-500 rounded-none"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.rate}
                            onChange={(e) => handleInvoiceItemChange(idx, "rate", parseFloat(e.target.value) || 0)}
                            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs p-1 text-right font-mono focus:outline-none focus:border-orange-500 rounded-none"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-orange-400">
                          ${item.amount.toFixed(2)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleRemoveInvoiceItem(idx)}
                            className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer"
                            title="Remove Line Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculations & Surcharges Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-3 bg-zinc-900/60 p-3 border border-zinc-800 text-xs">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                  Rates &amp; payments
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="invoice-labor-rate" className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                      Labor rate ($/hr)
                    </label>
                    <input
                      id="invoice-labor-rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={invoiceFormState.laborHourlyRate}
                      onChange={(e) => {
                        const val = Math.max(parseFloat(e.target.value) || 0, 0);
                        // Applies to the labor lines on this invoice. It used to change nothing.
                        updateInvoiceStateAndRecalculate({
                          ...invoiceFormState,
                          laborHourlyRate: val,
                          items: invoiceFormState.items.map((it) => (it.category === "labor" ? { ...it, rate: val } : it)),
                        });
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 font-mono"
                    />
                  </div>

                  <div>
                    <label htmlFor="invoice-supplies" className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                      Shop supplies (%)
                    </label>
                    <input
                      id="invoice-supplies"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={invoiceFormState.shopSuppliesRatePct}
                      onChange={(e) =>
                        updateInvoiceStateAndRecalculate({ ...invoiceFormState, shopSuppliesRatePct: Math.max(parseFloat(e.target.value) || 0, 0) })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 font-mono"
                    />
                  </div>

                  <div>
                    <label htmlFor="invoice-tax" className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                      Sales tax (%)
                    </label>
                    <input
                      id="invoice-tax"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={invoiceFormState.taxRatePct}
                      onChange={(e) =>
                        updateInvoiceStateAndRecalculate({ ...invoiceFormState, taxRatePct: Math.max(parseFloat(e.target.value) || 0, 0) })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 font-mono"
                    />
                  </div>
                </div>

                {/* Payments on record. Status follows from these — it is not set by hand. */}
                <div className="space-y-2" data-testid="invoice-payments">
                  <div className="text-[10px] uppercase font-bold text-zinc-400">Payments received</div>
                  {(invoiceFormState.payments ?? []).length === 0 ? (
                    <div className="text-zinc-500">None yet.</div>
                  ) : (
                    <ul className="space-y-1">
                      {(invoiceFormState.payments ?? []).map((p) => (
                        <li key={p.orderId} className="flex items-center justify-between gap-2 font-mono">
                          <span className="text-zinc-300">
                            {p.paidAt.slice(0, 10)} · {PAYMENT_METHOD_LABEL[p.method ?? "shopify"]}
                            {p.method === "shopify" || !p.method ? ` ${p.orderName}` : ""}
                            {p.note ? ` · ${p.note}` : ""}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-emerald-400 font-bold">${p.amount.toFixed(2)}</span>
                            {p.orderId.startsWith("manual-") && (
                              <button
                                type="button"
                                onClick={() => handleRemovePayment(p.orderId)}
                                aria-label={`Remove ${PAYMENT_METHOD_LABEL[p.method ?? "other"]} payment of $${p.amount.toFixed(2)}`}
                                className="p-0.5 text-zinc-500 hover:text-red-400 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <form onSubmit={handleRecordPayment} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end pt-1">
                    <div>
                      <label htmlFor="payment-amount" className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Amount ($)</label>
                      <input
                        id="payment-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 font-mono"
                      />
                    </div>
                    <div>
                      <label htmlFor="payment-method" className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Paid by</label>
                      <select
                        id="payment-method"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                        className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 text-xs rounded-none"
                      >
                        <option value="cash">Cash</option>
                        <option value="check">Check</option>
                        <option value="card_in_person">Card in shop</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <button type="submit" className="bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-2 text-[10px] font-black uppercase tracking-wider cursor-pointer">
                      Record payment
                    </button>
                    <div className="col-span-3">
                      <label htmlFor="payment-note" className="sr-only">Payment note</label>
                      <input
                        id="payment-note"
                        type="text"
                        value={paymentNote}
                        onChange={(e) => setPaymentNote(e.target.value)}
                        placeholder="Note, e.g. check number (optional)"
                        className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 text-xs"
                      />
                    </div>
                  </form>
                </div>
              </div>

              {/* Total Calculation Display */}
              <div className="bg-zinc-900/90 p-4 border border-zinc-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-zinc-400">
                  <span>Subtotal (Labor &amp; Parts):</span>
                  <span>${invoiceFormState.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Shop Supplies ({invoiceFormState.shopSuppliesRatePct}%):</span>
                  <span>${invoiceFormState.shopSuppliesAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Sales Tax ({invoiceFormState.taxRatePct}%):</span>
                  <span>${invoiceFormState.taxAmount.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-zinc-800 flex justify-between font-bold text-zinc-100">
                  <span className="uppercase font-black font-sans">Invoice total:</span>
                  <span>${invoiceFormState.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Paid:</span>
                  <span>−${(invoiceFormState.amountPaid ?? 0).toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-zinc-800 flex justify-between text-base font-bold text-zinc-100" data-testid="invoice-balance">
                  <span className="text-orange-500 uppercase font-black font-sans">Balance due:</span>
                  <span className="text-orange-400">${balanceDue(invoiceFormState).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Internal Mechanic Notes */}
            <div>
              <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1 tracking-wider">
                Private notes (Paul only — never printed or sent to the customer)
              </label>
              <textarea
                value={invoiceFormState.internalOwnerNotes || ""}
                onChange={(e) =>
                  setInvoiceFormState({
                    ...invoiceFormState,
                    internalOwnerNotes: e.target.value,
                  })
                }
                rows={2}
                placeholder="e.g. Parts ordered from Drag Specialties, arriving Tuesday."
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs p-2 focus:outline-none focus:border-orange-500 rounded-none"
              />
            </div>

            {/* Bluetooth Thermal Printer Hardware Control Box */}
            <div className="bg-zinc-900/90 border border-blue-900/50 p-3 space-y-2 text-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Bluetooth className="w-4 h-4 text-blue-400" />
                  <span className="font-bold text-zinc-200 uppercase tracking-wide">
                    Bluetooth Work Order Printer:
                  </span>
                  {btDeviceName ? (
                    <span className="inline-flex items-center gap-1 font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 border border-emerald-600/40 text-[11px]">
                      <BluetoothConnected className="w-3 h-3" />
                      {btDeviceName}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 border border-zinc-800 text-[11px]">
                      <BluetoothOff className="w-3 h-3 text-zinc-500" />
                      No Direct Bluetooth Paired
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleConnectBluetooth}
                  className="bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-600/50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Bluetooth className="w-3.5 h-3.5 text-blue-400" />
                  <span>{btDeviceName ? "Re-Pair / Change Printer" : "Pair Bluetooth Printer"}</span>
                </button>
              </div>

              {btMessage && (
                <div
                  className={`p-2 border text-[11px] font-mono flex items-center gap-1.5 ${
                    btStatus === "error"
                      ? "bg-red-950/80 border-red-800 text-red-300"
                      : btStatus === "success"
                      ? "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                      : "bg-blue-950/80 border-blue-800 text-blue-300"
                  }`}
                >
                  <Wifi className="w-3.5 h-3.5 animate-pulse" />
                  <span>{btMessage}</span>
                </div>
              )}
            </div>

            {/* Action Toolbar */}
            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handlePrintBluetoothWorkOrder}
                  disabled={btStatus === "printing"}
                  className="bg-blue-900 hover:bg-blue-800 text-blue-100 border border-blue-600/60 px-4 py-2 text-xs uppercase font-black flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                  title="Send direct ESC/POS Bluetooth raw stream to thermal printer"
                >
                  <Bluetooth className={`w-4 h-4 text-blue-400 ${btStatus === "printing" ? "animate-spin" : ""}`} />
                  <span>{btStatus === "printing" ? "Transmitting..." : "Bluetooth Print"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportSingleInvoiceToExcel(activeInvoiceBooking, invoiceFormState)}
                  className="bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50 px-4 py-2 text-xs uppercase font-black flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Export to Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 px-4 py-2 text-xs uppercase font-black flex items-center gap-1.5 cursor-pointer"
                  title="Print using System Print Spooler / AirPrint / Windows / Android Bluetooth printer driver"
                >
                  <Printer className="w-4 h-4 text-orange-500" />
                  <span>System Print</span>
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setActiveInvoiceBooking(null);
                    setInvoiceFormState(null);
                    setInvoiceSendStatus({ loading: false, url: null, error: null });
                  }}
                  className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 px-4 py-2 text-xs uppercase font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={!!pdfBusy}
                  className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 text-zinc-200 border border-zinc-700 px-4 py-2 text-xs uppercase font-black flex items-center gap-1.5 cursor-pointer"
                  title="Save, then download the customer's PDF copy"
                >
                  <Download className="w-4 h-4 text-orange-500" />
                  <span>{pdfBusy === "download" ? "Making PDF…" : "Download PDF"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleEmailPdf}
                  disabled={!!pdfBusy}
                  className="bg-sky-800 hover:bg-sky-700 disabled:opacity-60 text-white font-black px-4 py-2 text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                  title={`Save, then email the customer a PDF of this invoice. Replies go to ${emailConfig?.replyTo || SHOP_INFO.email}.`}
                >
                  <Mail className="w-4 h-4" />
                  <span>{pdfBusy === "email" ? "Sending…" : "Email PDF"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveInvoice}
                  className="bg-orange-600 hover:bg-orange-500 text-white font-black px-6 py-2 text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendInvoice}
                  disabled={invoiceSendStatus.loading}
                  className="bg-violet-700 hover:bg-violet-600 disabled:bg-zinc-800 text-white font-black px-6 py-2 text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg transition-colors"
                  title="Save, then have Shopify email the customer a link to pay online"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{invoiceSendStatus.loading ? "Sending..." : "Email Pay Link"}</span>
                </button>
              </div>

              <div className="w-full text-[11px] text-zinc-400 space-y-0.5" data-testid="invoice-email-status">
                {emailConfig && !emailConfig.enabled && (
                  <div>Email PDF is not switched on yet — use Download PDF and send it yourself.</div>
                )}
                {(activeInvoiceBooking.invoiceEmails ?? []).slice(-1).map((e) => (
                  <div key={e.at}>
                    Last emailed {new Date(e.at).toLocaleString()} to {e.to} (balance then ${e.balanceDue.toFixed(2)}).
                  </div>
                ))}
              </div>

              {invoiceNotice && (
                <div role="status" className="w-full mt-3 p-2 bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs">
                  {invoiceNotice}
                </div>
              )}

              {/* Invoice send status */}
              {invoiceSendStatus.error && (
                <div className="w-full mt-3 p-3 bg-red-950/80 border border-red-600/60 text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>{invoiceSendStatus.error}</span>
                </div>
              )}
              {invoiceSendStatus.url && (
                <div className="w-full mt-3 p-3 bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-emerald-200">Invoice sent.</strong> Shopify emailed the customer a payment link for the balance due.{" "}
                    <a href={invoiceSendStatus.url} target="_blank" rel="noopener noreferrer" className="underline text-emerald-400 hover:text-emerald-300 ml-1">
                      View invoice →
                    </a>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Hidden Printable Work Order Container for window.print() / System Bluetooth Spoolers */}
      {activeInvoiceBooking && invoiceFormState && (
        <div id="printable-work-order" className="hidden print:block">
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: 0 }}>THE FRAME SHOP</h1>
            <h3 style={{ fontSize: "14px", margin: "4px 0", letterSpacing: "1px" }}>3D LASER FRAME & CHASSIS ALIGNMENT</h3>
            <p style={{ fontSize: "12px", margin: 0 }}>{SHOP_INFO.address} • Phone: {SHOP_INFO.phone} • {SHOP_INFO.email}</p>
            <hr style={{ border: "none", borderTop: "2px solid #000", margin: "10px 0" }} />
          </div>

          <table style={{ width: "100%", fontSize: "12px", marginBottom: "15px", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ padding: "4px" }}><strong>WORK ORDER #:</strong> {invoiceFormState.invoiceNumber}</td>
                <td style={{ padding: "4px" }}><strong>DATE:</strong> {invoiceFormState.createdDate}</td>
              </tr>
              <tr>
                <td style={{ padding: "4px" }}><strong>TICKET #:</strong> {activeInvoiceBooking.ticketNumber}</td>
                <td style={{ padding: "4px" }}><strong>TECHNICIAN:</strong> {invoiceFormState.mechanicName}</td>
              </tr>
              <tr>
                <td style={{ padding: "4px" }}><strong>RIDER:</strong> {activeInvoiceBooking.name} ({activeInvoiceBooking.phone})</td>
                <td style={{ padding: "4px" }}><strong>MOTORCYCLE:</strong> {activeInvoiceBooking.bikeYear} {activeInvoiceBooking.bikeMake} {activeInvoiceBooking.bikeModel}</td>
              </tr>
            </tbody>
          </table>

          <h4 style={{ fontSize: "12px", borderBottom: "1px solid #000", paddingBottom: "4px", margin: "10px 0 5px 0" }}>ITEMIZED SERVICE & PARTS CHARGES</h4>
          <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse", marginBottom: "15px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #000", textAlign: "left" }}>
                <th style={{ padding: "4px" }}>Item Description</th>
                <th style={{ padding: "4px", textAlign: "center" }}>Qty/Hrs</th>
                <th style={{ padding: "4px", textAlign: "right" }}>Rate ($)</th>
                <th style={{ padding: "4px", textAlign: "right" }}>Amount ($)</th>
              </tr>
            </thead>
            <tbody>
              {invoiceFormState.items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "4px" }}>{item.description}</td>
                  <td style={{ padding: "4px", textAlign: "center" }}>{item.quantity}</td>
                  <td style={{ padding: "4px", textAlign: "right" }}>${item.rate.toFixed(2)}</td>
                  <td style={{ padding: "4px", textAlign: "right" }}>${item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ width: "260px", marginLeft: "auto", fontSize: "12px", textAlign: "right" }}>
            <p style={{ margin: "2px 0" }}>Subtotal: ${invoiceFormState.subtotal.toFixed(2)}</p>
            <p style={{ margin: "2px 0" }}>Shop Supplies ({invoiceFormState.shopSuppliesRatePct}%): ${invoiceFormState.shopSuppliesAmount.toFixed(2)}</p>
            <p style={{ margin: "2px 0" }}>Sales Tax ({invoiceFormState.taxRatePct}%): ${invoiceFormState.taxAmount.toFixed(2)}</p>
            <p style={{ margin: "6px 0 0 0", borderTop: "2px solid #000", paddingTop: "4px" }}>
              Total: ${invoiceFormState.totalAmount.toFixed(2)}
            </p>
            {(invoiceFormState.amountPaid ?? 0) > 0 && (
              <p style={{ margin: "2px 0" }}>Paid: −${(invoiceFormState.amountPaid ?? 0).toFixed(2)}</p>
            )}
            <h3 style={{ margin: "4px 0 0 0" }}>BALANCE DUE: ${balanceDue(invoiceFormState).toFixed(2)}</h3>
          </div>

          {/* Paul's private notes are deliberately not printed: this is the customer's copy. */}

          <div style={{ marginTop: "40px", paddingTop: "20px", borderTop: "1px dashed #000", display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
            <div>Customer Signature: ___________________________</div>
            <div>Date: _______________</div>
          </div>
        </div>
      )}

    </div>
  );
};
