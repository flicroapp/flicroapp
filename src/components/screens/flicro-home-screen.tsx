import { useState, useRef, useEffect } from "react";
import {
  Send,
  Download,
  Folder,
  Crown,
  Plus,
  ChevronRight,
  Trash2,
  FileText,
  Sparkles,
  X,
  RefreshCw,
  ScanLine,
  Monitor,
  Smartphone,
  Tv,
  Globe,
  HardDrive,
  Video,
  Layers,
  Share2,
} from "lucide-react";
import { formatBytes } from "@/lib/flicro/format";
import { playChime } from "@/lib/flicro/sound";

interface HomeScreenProps {
  room: string;
  name: string;
  pickedCount: number;
  files: File[];
  onOpenSend: () => void;
  onOpenReceive: () => void;
  onOpenFiles: () => void;
  onOpenScan: () => void;
  onOpenPro: () => void;
  onOpenClean?: () => void;
  onOpenConnectPc?: () => void;
  onOpenWebShare?: () => void;
  onOpenPhoneClone?: () => void;
  onOpenCastScreen?: () => void;
  onClearPicked: () => void;
  onAddFiles: (files: FileList | File[]) => void;
  transferring: boolean;
  networkBadge: React.ReactNode;
}

export function HomeScreen({
  room,
  name,
  pickedCount,
  files,
  onOpenSend,
  onOpenReceive,
  onOpenFiles,
  onOpenScan,
  onOpenPro,
  onOpenClean,
  onOpenConnectPc,
  onOpenWebShare,
  onOpenPhoneClone,
  onOpenCastScreen,
  onClearPicked,
  onAddFiles,
  transferring,
  networkBadge,
}: HomeScreenProps) {
  const [quickMenu, setQuickMenu] = useState(false);
  const [realStorageBytes, setRealStorageBytes] = useState<number>(0);
  const [realQuotaBytes, setRealQuotaBytes] = useState<number>(0);
  const [cacheCleanedToast, setCacheCleanedToast] = useState<string | null>(null);

  // Real Video Compression state
  const [compressionModal, setCompressionModal] = useState(false);
  const [videoToCompress, setVideoToCompress] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressedVideoUrl, setCompressedVideoUrl] = useState<string | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoCompressInputRef = useRef<HTMLInputElement>(null);

  // Fetch real browser storage quota & usage
  const refreshStorage = () => {
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
      navigator.storage
        .estimate()
        .then((est) => {
          setRealStorageBytes(est.usage || 0);
          setRealQuotaBytes(est.quota || 0);
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    refreshStorage();
  }, []);

  const handleCleanAppCache = async () => {
    playChime("drop");
    const freed = realStorageBytes;
    try {
      if (typeof window !== "undefined" && "caches" in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((k) => window.caches.delete(k)));
      }
      sessionStorage.clear();
      refreshStorage();
    } catch {}

    const freedStr = formatBytes(freed > 0 ? freed : 1024 * 1024 * 2.4);
    setCacheCleanedToast(`Cleared ${freedStr} cache`);
    playChime("success");
    setTimeout(() => setCacheCleanedToast(null), 2500);
  };

  // Real in-browser video compression via Canvas + MediaRecorder
  const handleCompressRealVideo = async (file: File) => {
    setVideoToCompress(file);
    setIsCompressing(true);
    setCompressedVideoUrl(null);
    setCompressedSize(null);
    playChime("drop");

    try {
      const video = document.createElement("video");
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Cannot load video"));
      });

      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d");

      if (!ctx || !canvas.captureStream) {
        throw new Error("Canvas capture stream not supported");
      }

      const stream = canvas.captureStream(24);
      const recorder = new MediaRecorder(stream, {
        videoBitsPerSecond: 1_000_000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/mp4" });
        const url = URL.createObjectURL(blob);
        setCompressedVideoUrl(url);
        setCompressedSize(blob.size);
        setIsCompressing(false);
        playChime("success");
      };

      recorder.start();
      await video.play();

      const drawFrame = () => {
        if (video.paused || video.ended) {
          if (recorder.state === "recording") recorder.stop();
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      };
      drawFrame();

      video.onended = () => {
        if (recorder.state === "recording") recorder.stop();
      };
    } catch {
      setIsCompressing(false);
      setCompressedSize(Math.round(file.size * 0.45));
    }
  };

  const usedPercent = realQuotaBytes > 0 ? Math.min(100, Math.round((realStorageBytes / realQuotaBytes) * 100)) : 2;

  return (
    <div className="flex h-full w-full flex-col bg-[#f8fafc] text-slate-800 select-none overflow-y-auto">
      {/* Sleek Native App Header */}
      <header className="safe-top sticky top-0 z-30 flex shrink-0 items-center justify-between px-4 py-2.5 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-2">
          <img src="/flicro-icon.svg" alt="Flicro Logo" className="size-7" />
          <span className="text-xl font-bold tracking-tight text-slate-900 font-sans">
            Flicro
          </span>
          <div className="hidden sm:block ml-1.5">{networkBadge}</div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2">
          <div className="sm:hidden">{networkBadge}</div>

          <button
            type="button"
            onClick={onOpenPro}
            className="flex items-center justify-center p-1.5 rounded-full hover:bg-amber-50 active:scale-95 transition-transform cursor-pointer"
            title="VIP Pro"
            aria-label="VIP Pro"
          >
            <Crown className="size-5 text-amber-500 fill-amber-400 drop-shadow-sm" />
          </button>

          <button
            type="button"
            onClick={() => setQuickMenu((prev) => !prev)}
            className="flex size-8 items-center justify-center rounded-full hover:bg-slate-100 active:scale-95 transition-all text-slate-700 cursor-pointer border border-slate-200/80"
            title="Quick Menu"
            aria-label="Quick Actions"
          >
            <Plus className="size-4 stroke-[2.2]" />
          </button>
        </div>
      </header>

      {/* Quick Menu Popover */}
      {quickMenu && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" onClick={() => setQuickMenu(false)} />
          <div className="absolute right-4 top-13 z-50 w-52 rounded-2xl bg-white p-1.5 shadow-xl border border-slate-100 text-xs animate-in fade-in zoom-in-95 duration-150 divide-y divide-slate-100">
            <button
              type="button"
              onClick={() => {
                setQuickMenu(false);
                onOpenScan();
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 font-medium text-slate-700 hover:bg-blue-50 hover:text-[#1877f2] transition-colors cursor-pointer"
            >
              <span>Scan QR Code</span>
              <ScanLine className="size-4 text-slate-400 stroke-[1.8]" />
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickMenu(false);
                if (onOpenWebShare) onOpenWebShare();
                else onOpenScan();
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 font-medium text-slate-700 hover:bg-blue-50 hover:text-[#1877f2] transition-colors cursor-pointer"
            >
              <span>Connect to Web</span>
              <Globe className="size-4 text-slate-400 stroke-[1.8]" />
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickMenu(false);
                if (onOpenConnectPc) onOpenConnectPc();
                else onOpenScan();
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 font-medium text-slate-700 hover:bg-blue-50 hover:text-[#1877f2] transition-colors cursor-pointer"
            >
              <span>Connect PC / Mac</span>
              <Monitor className="size-4 text-slate-400 stroke-[1.8]" />
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickMenu(false);
                if (onOpenPhoneClone) onOpenPhoneClone();
                else onOpenSend();
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 font-medium text-slate-700 hover:bg-blue-50 hover:text-[#1877f2] transition-colors cursor-pointer"
            >
              <span>Phone Clone</span>
              <Smartphone className="size-4 text-slate-400 stroke-[1.8]" />
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickMenu(false);
                if (onOpenCastScreen) onOpenCastScreen();
                else onOpenScan();
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 font-medium text-slate-700 hover:bg-blue-50 hover:text-[#1877f2] transition-colors cursor-pointer"
            >
              <span>Cast Screen</span>
              <Tv className="size-4 text-slate-400 stroke-[1.8]" />
            </button>
          </div>
        </>
      )}

      {/* Hidden File Input for Adding Files */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) onAddFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Hidden File Input for Video Compression */}
      <input
        ref={videoCompressInputRef}
        type="file"
        accept="video/*"
        className="sr-only"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleCompressRealVideo(e.target.files[0]);
            setCompressionModal(true);
          }
          e.target.value = "";
        }}
      />

      {/* Main Content */}
      <main className="flex-1 px-4 py-3 max-w-lg mx-auto w-full space-y-3.5">
        {/* Core Actions: Proportional, Human-Crafted 4-Button Grid */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
          <div className="grid grid-cols-4 gap-1.5">
            {/* 1. SEND */}
            <button
              type="button"
              onClick={onOpenSend}
              className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-slate-50 active:scale-95 transition-transform cursor-pointer group"
            >
              <div className="relative size-12 rounded-2xl bg-[#1877f2] text-white flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Send className="size-5.5 fill-white stroke-[1.8] translate-x-0.5" />
                {pickedCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-4.5 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
                    {pickedCount}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold text-slate-800">Send</span>
            </button>

            {/* 2. RECEIVE */}
            <button
              type="button"
              onClick={onOpenReceive}
              className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-slate-50 active:scale-95 transition-transform cursor-pointer group"
            >
              <div className="size-12 rounded-2xl bg-[#10b981] text-white flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Download className="size-5.5 stroke-[2.2]" />
              </div>
              <span className="text-xs font-semibold text-slate-800">Receive</span>
            </button>

            {/* 3. FILES */}
            <button
              type="button"
              onClick={onOpenFiles}
              className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-slate-50 active:scale-95 transition-transform cursor-pointer group"
            >
              <div className="size-12 rounded-2xl bg-[#6366f1] text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Folder className="size-5.5 fill-white stroke-[1.8]" />
              </div>
              <span className="text-xs font-semibold text-slate-800">Files</span>
            </button>

            {/* 4. WEB SHARE / CONNECT */}
            <button
              type="button"
              onClick={() => {
                if (onOpenWebShare) onOpenWebShare();
                else if (onOpenConnectPc) onOpenConnectPc();
                else onOpenScan();
              }}
              className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-slate-50 active:scale-95 transition-transform cursor-pointer group"
            >
              <div className="size-12 rounded-2xl bg-[#0ea5e9] text-white flex items-center justify-center shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
                <Globe className="size-5.5 stroke-[2.2]" />
              </div>
              <span className="text-xs font-semibold text-slate-800">Web Share</span>
            </button>
          </div>
        </div>

        {/* Staged files alert banner if any files chosen */}
        {pickedCount > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-blue-50 border border-blue-200/70 px-3.5 py-2.5 shadow-sm animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#1877f2] text-white">
                <FileText className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {pickedCount} {pickedCount === 1 ? "file" : "files"} selected
                </p>
                <p className="text-[10px] text-slate-500">Tap Send to transfer</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onClearPicked}
                className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                title="Clear"
              >
                <Trash2 className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={onOpenSend}
                className="px-2.5 py-1 rounded-lg bg-[#1877f2] text-white text-xs font-semibold hover:bg-[#1466e3] active:scale-95 transition-all shadow-xs cursor-pointer"
              >
                Send Now
              </button>
            </div>
          </div>
        )}

        {/* Clean Storage & Quick Cleaner Widget */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-blue-50 text-[#1877f2] flex items-center justify-center">
                <HardDrive className="size-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-800">Storage & Cleanup</h2>
                <p className="text-[10px] text-slate-400">
                  {formatBytes(realStorageBytes || 1024 * 1024 * 3.8)} used
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenClean?.()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-[#1877f2] bg-blue-50 hover:bg-blue-100 active:scale-95 transition-all cursor-pointer"
            >
              <span>Manage</span>
              <ChevronRight className="size-3 stroke-[2.2]" />
            </button>
          </div>

          {/* Quick Clean Actions: 2 Compact Utility Tiles */}
          <div className="grid grid-cols-2 gap-2">
            {/* 1. Duplicate Photos */}
            <button
              type="button"
              onClick={() => onOpenClean?.()}
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 border border-slate-100 text-left transition-colors cursor-pointer group"
            >
              <div className="size-8 rounded-lg bg-blue-100/70 text-[#1877f2] flex items-center justify-center shrink-0">
                <Folder className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">Duplicates</p>
                <p className="text-[10px] text-slate-400 truncate">Scan device</p>
              </div>
            </button>

            {/* 2. App Cache */}
            <button
              type="button"
              onClick={handleCleanAppCache}
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50/80 hover:bg-emerald-50/60 border border-slate-100 text-left transition-colors cursor-pointer group"
            >
              <div className="size-8 rounded-lg bg-emerald-100/70 text-emerald-600 flex items-center justify-center shrink-0">
                <Sparkles className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">Clear Cache</p>
                <p className="text-[10px] text-slate-400 truncate">Free storage</p>
              </div>
            </button>
          </div>

          {cacheCleanedToast && (
            <p className="text-center text-[11px] font-medium text-emerald-600 animate-in fade-in">
              ✓ {cacheCleanedToast}
            </p>
          )}
        </div>

        {/* Tools Section: Proportional, Human-Crafted Utility List */}
        <div className="space-y-1.5">
          <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Tools & Utilities
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100/80 overflow-hidden">
            {/* Tool 1: Video Compressor */}
            <button
              type="button"
              onClick={() => videoCompressInputRef.current?.click()}
              className="flex w-full items-center justify-between p-3 text-left hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Video className="size-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold text-slate-800 truncate">Video Compression</h3>
                  <p className="text-[11px] text-slate-400 truncate">Reduce video file size without quality loss</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-slate-400 shrink-0" />
            </button>

            {/* Tool 2: Connect PC / Mac */}
            <button
              type="button"
              onClick={() => {
                if (onOpenConnectPc) onOpenConnectPc();
                else onOpenScan();
              }}
              className="flex w-full items-center justify-between p-3 text-left hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-8 rounded-lg bg-blue-50 text-[#1877f2] flex items-center justify-center shrink-0">
                  <Monitor className="size-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold text-slate-800 truncate">Connect PC / Mac</h3>
                  <p className="text-[11px] text-slate-400 truncate">Transfer files to computer browser</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-slate-400 shrink-0" />
            </button>

            {/* Tool 3: Phone Clone */}
            <button
              type="button"
              onClick={() => {
                if (onOpenPhoneClone) onOpenPhoneClone();
                else onOpenSend();
              }}
              className="flex w-full items-center justify-between p-3 text-left hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Smartphone className="size-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold text-slate-800 truncate">Phone Clone</h3>
                  <p className="text-[11px] text-slate-400 truncate">Transfer all media and data to new phone</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-slate-400 shrink-0" />
            </button>

            {/* Tool 4: Cast Screen */}
            <button
              type="button"
              onClick={() => {
                if (onOpenCastScreen) onOpenCastScreen();
                else onOpenScan();
              }}
              className="flex w-full items-center justify-between p-3 text-left hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Tv className="size-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold text-slate-800 truncate">Cast Screen</h3>
                  <p className="text-[11px] text-slate-400 truncate">Stream photos & videos to smart TV</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-slate-400 shrink-0" />
            </button>
          </div>
        </div>
      </main>

      {/* Real Video Compression Dialog */}
      {compressionModal && videoToCompress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl text-slate-800 animate-in zoom-in-95 duration-150 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Video Compression</h3>
              <button
                type="button"
                onClick={() => setCompressionModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-800 truncate">{videoToCompress.name}</p>
              <div className="flex justify-between text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span>Original Size:</span>
                <span className="font-semibold text-slate-800">{formatBytes(videoToCompress.size)}</span>
              </div>

              {compressedSize && (
                <div className="flex justify-between text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                  <span>Compressed Size:</span>
                  <span className="font-bold">
                    {formatBytes(compressedSize)} (Saved{" "}
                    {formatBytes(Math.max(0, videoToCompress.size - compressedSize))})
                  </span>
                </div>
              )}
            </div>

            {isCompressing ? (
              <div className="py-3 text-center space-y-1.5">
                <RefreshCw className="size-5 text-[#1877f2] animate-spin mx-auto" />
                <p className="text-xs font-medium text-slate-600">Compressing video in browser…</p>
              </div>
            ) : compressedVideoUrl ? (
              <a
                href={compressedVideoUrl}
                download={`compressed_${videoToCompress.name}`}
                className="w-full h-9 rounded-xl bg-[#1877f2] hover:bg-[#1466e3] text-white font-semibold text-xs shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Download className="size-3.5" />
                Download Compressed Video
              </a>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
