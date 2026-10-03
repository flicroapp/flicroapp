import { useState, useEffect } from "react";
import { ArrowLeft, ExternalLink, QrCode } from "lucide-react";

interface WebShareScreenProps {
  onBack: () => void;
  onScan: () => void;
  localIp?: string;
}

export function WebShareScreen({ onBack, onScan, localIp: propIp }: WebShareScreenProps) {
  const [activeIp, setActiveIp] = useState(
    propIp || (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" ? window.location.hostname : "192.168.1.37")
  );

  useEffect(() => {
    fetch("/api/network")
      .then((r) => r.json())
      .then((data) => {
        if (data?.localIp) setActiveIp(data.localIp);
      })
      .catch(() => {});
  }, []);

  const localUrl = `http://${activeIp}:8080`;

  return (
    <div className="flex h-full w-full flex-col bg-white text-slate-900 select-none overflow-hidden font-sans">
      {/* Header matching Screenshot 5 */}
      <header className="safe-top flex shrink-0 items-center justify-between px-4 pt-3 pb-2 bg-white border-b border-slate-100 shadow-sm z-20">
        <button
          type="button"
          onClick={onBack}
          className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100 active:scale-95 text-slate-800 cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="size-6 stroke-[2.4]" />
        </button>
        <h1 className="text-base sm:text-lg font-bold text-slate-900">WebShare</h1>
        <div className="size-10" />
      </header>

      {/* Top Half: Blue Area with Green-screen Laptop & Phone matching Screenshot 5 */}
      <div className="flex-1 bg-[#1877f2] flex flex-col items-center justify-center px-6 text-center text-white relative overflow-hidden">
        {/* Graphic: Laptop with Phone in front */}
        <div className="relative flex items-center justify-center my-4">
          {/* Laptop */}
          <div className="relative flex flex-col items-center">
            {/* Screen */}
            <div className="w-56 h-36 sm:w-64 sm:h-40 rounded-xl bg-white p-2 shadow-2xl flex flex-col justify-between">
              {/* Green Display matching Screenshot 5 */}
              <div className="size-full rounded-lg bg-[#22c55e] p-2 flex flex-col items-center justify-center relative">
                {/* Browser window frame */}
                <div className="w-28 h-16 rounded-md bg-white p-1 flex flex-col items-center justify-center shadow-md">
                  <div className="flex gap-1 self-start mb-1">
                    <span className="size-1.5 rounded-full bg-rose-400" />
                    <span className="size-1.5 rounded-full bg-amber-400" />
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-xs font-mono font-black text-slate-400 tracking-wider">HTTP</span>
                </div>
              </div>
            </div>
            {/* Laptop Base */}
            <div className="w-68 sm:w-76 h-3 bg-slate-200 rounded-b-xl shadow-md" />
          </div>

          {/* Smartphone overlapping bottom-left of laptop matching Screenshot 5 */}
          <div className="absolute -left-3 sm:-left-6 bottom-0 w-20 h-36 rounded-2xl bg-white p-1.5 shadow-2xl flex flex-col justify-between border-2 border-slate-100 z-10">
            {/* Green Screen with Flicro Share icon */}
            <div className="size-full rounded-xl bg-[#22c55e] flex items-center justify-center">
              <div className="size-9 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center p-1.5">
                {/* 3-circle share icon */}
                <div className="relative size-6">
                  <span className="absolute top-0 left-2 size-2 rounded-full bg-white" />
                  <span className="absolute bottom-0 left-0 size-2 rounded-full bg-white" />
                  <span className="absolute bottom-0 right-0 size-2 rounded-full bg-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Half: White Area with 2 Steps & Scan Button matching Screenshot 5 */}
      <div className="shrink-0 bg-white px-6 pt-6 pb-8 flex flex-col text-left">
        {/* Step 1 */}
        <p className="text-sm font-semibold text-slate-900 leading-snug">
          1. Open the following web page link on your PC/tablet
        </p>

        <div className="mt-2.5 space-y-1.5 text-center">
          <a
            href="https://pc.flicro.com"
            target="_blank"
            rel="noreferrer"
            className="block text-sm font-semibold text-[#1877f2] hover:underline"
          >
            https://pc.flicro.com
          </a>
          <p className="text-xs text-slate-400 font-medium">--or--</p>
          <a
            href={localUrl}
            target="_blank"
            rel="noreferrer"
            className="block text-sm font-semibold text-[#1877f2] hover:underline font-mono"
          >
            {localUrl}
          </a>
        </div>

        {/* Step 2 */}
        <p className="text-sm font-semibold text-slate-900 mt-6 leading-snug">
          2. Click the button below, and scan the QR code
        </p>

        {/* Big Blue Scan Button matching Screenshot 5 */}
        <button
          type="button"
          onClick={onScan}
          className="mt-6 w-full h-12 rounded-2xl bg-[#1877f2] hover:bg-[#1466e3] text-white font-bold text-sm shadow-lg shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
        >
          Scan
        </button>
      </div>
    </div>
  );
}
