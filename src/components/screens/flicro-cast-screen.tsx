import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Monitor, Smartphone, Loader2, Wifi, Radio, X } from "lucide-react";
import { playChime } from "@/lib/flicro/sound";

interface CastScreenProps {
  onBack: () => void;
  wifiSsid?: string;
  defaultHost?: string;
}

export function CastScreen({ onBack, wifiSsid: initialSsid }: CastScreenProps) {
  const [wifiSsid, setWifiSsid] = useState(initialSsid || "");
  const [castDeviceName, setCastDeviceName] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [castError, setCastError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch real Wi-Fi SSID and real PC hostname from the network monitor
  useEffect(() => {
    setIsSearching(true);
    fetch("/api/network")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ssid) setWifiSsid(data.ssid);
        if (data?.castDevice) {
          setCastDeviceName(data.castDevice);
        } else if (data?.hostname) {
          setCastDeviceName(`AirPlayer-${data.hostname}`);
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsSearching(false);
      });
  }, []);

  const handleSearch = () => {
    setIsSearching(true);
    playChime("drop");
    fetch("/api/network")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ssid) setWifiSsid(data.ssid);
        if (data?.castDevice) {
          setCastDeviceName(data.castDevice);
        } else if (data?.hostname) {
          setCastDeviceName(`AirPlayer-${data.hostname}`);
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsSearching(false);
      });
  };

  const handleStartRealCast = async () => {
    playChime("drop");
    setCastError(null);
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setCastError("Screen capture is not supported in this browser.");
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as MediaTrackConstraints,
        audio: true,
      });

      streamRef.current = stream;
      setIsCasting(true);
      playChime("success");

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      stream.getVideoTracks()[0].onended = () => {
        handleStopCast();
      };
    } catch (err) {
      if (err instanceof Error && err.name !== "NotAllowedError") {
        setCastError(err.message || "Failed to start screen cast.");
      }
    }
  };

  const handleStopCast = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCasting(false);
    playChime("drop");
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-[#f8fafd] text-slate-900 select-none overflow-hidden font-sans">
      {/* Header matching Screenshot 2 */}
      <header className="safe-top flex shrink-0 items-center justify-between px-4 pt-3 pb-2 bg-[#1877f2] text-white">
        <button
          type="button"
          onClick={onBack}
          className="flex size-10 items-center justify-center rounded-full hover:bg-white/10 active:scale-95 text-white cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="size-6 stroke-[2.4]" />
        </button>
        <h1 className="text-base sm:text-lg font-bold">Cast Screen</h1>
        <div className="size-10" />
      </header>

      {/* Top Banner (Solid Blue #1877f2) matching Screenshot 2 */}
      <div className="shrink-0 bg-[#1877f2] px-6 py-6 text-white flex items-center justify-between">
        {/* Graphic: PC Monitor on left broadcasting to smartphone on right */}
        <div className="relative flex items-center gap-2">
          {/* Monitor */}
          <div className="relative flex flex-col items-center">
            <div className="w-16 h-12 rounded-lg border-2 border-white/90 bg-white/20 backdrop-blur-sm p-1 flex flex-col justify-center items-center shadow-lg">
              <Wifi className="size-5 text-white stroke-[2.5]" />
            </div>
            <div className="w-2.5 h-1.5 bg-white/90" />
            <div className="w-8 h-0.5 bg-white/90 rounded-full" />
          </div>

          {/* Wi-Fi Wave Beam */}
          <div className="flex items-center text-white/80">
            <Radio className="size-5 animate-pulse text-white" />
          </div>

          {/* Smartphone */}
          <div className="w-8 h-14 rounded-lg border-2 border-white/90 bg-white/20 backdrop-blur-sm p-0.5 flex flex-col justify-between items-center shadow-lg">
            <div className="size-1 rounded-full bg-white/80 mt-0.5" />
            <Wifi className="size-3.5 text-white stroke-[2]" />
            <div className="size-1 rounded-full bg-white/80 mb-0.5" />
          </div>
        </div>

        {/* Right Text matching Screenshot 2 */}
        <p className="text-xs sm:text-sm font-medium leading-relaxed max-w-[210px] text-white/95 text-right sm:text-left">
          Play audio and video remotely from mobile devices
        </p>
      </div>

      {/* White Section: Discover Device Bar matching Screenshot 2 */}
      <div className="shrink-0 bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between shadow-sm">
        <div className="space-y-0.5">
          <h2 className="text-sm sm:text-base font-bold text-slate-900">Discover device</h2>
          <p className="text-xs text-slate-500 font-medium">
            Current WiFi: {wifiSsid}
          </p>
        </div>

        <button
          type="button"
          onClick={handleSearch}
          className="px-4 py-2 rounded-xl bg-[#1877f2] hover:bg-[#1466e3] text-white font-bold text-xs uppercase shadow-sm active:scale-95 transition-all cursor-pointer"
        >
          SEARCH
        </button>
      </div>

      {/* Main Content Area matching Screenshot 2 */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Real Live Cast Video Display when Casting */}
        {isCasting ? (
          <div className="bg-black rounded-3xl overflow-hidden shadow-xl border border-slate-800 p-2 space-y-3">
            <div className="flex items-center justify-between px-2 pt-1 text-white">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-rose-500 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Live Casting</span>
              </div>
              <button
                type="button"
                onClick={handleStopCast}
                className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1 rounded-full cursor-pointer"
              >
                <X className="size-3.5" />
                Stop Cast
              </button>
            </div>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-video rounded-2xl bg-slate-950 object-contain"
            />
            <p className="text-[11px] text-slate-400 text-center pb-1">
              Broadcasting to {castDeviceName}
            </p>
          </div>
        ) : null}

        {/* Searching Status Indicator matching Screenshot 2 */}
        {isSearching && (
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 px-1 py-1">
            <span>Searching for devices</span>
            <Loader2 className="size-4 text-[#1877f2] animate-spin" />
          </div>
        )}

        {/* Error message if screen capture is declined */}
        {castError && (
          <p className="text-xs text-rose-500 font-semibold px-1">{castError}</p>
        )}

        {/* Discovered Device Row matching Screenshot 2 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-50 text-[#1877f2] flex items-center justify-center shrink-0">
              <Monitor className="size-5 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-snug">
                {castDeviceName}
              </p>
              <p className="text-[11px] text-slate-400">AirPlay / Cast Receiver</p>
            </div>
          </div>

          {/* Connect Button matching Screenshot 2 */}
          <button
            type="button"
            onClick={isCasting ? handleStopCast : handleStartRealCast}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer ${
              isCasting
                ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                : "bg-[#e8f1fd] text-[#1877f2] hover:bg-[#d8e8fc]"
            }`}
          >
            {isCasting ? "DISCONNECT" : "CONNECT"}
          </button>
        </div>
      </div>
    </div>
  );
}
