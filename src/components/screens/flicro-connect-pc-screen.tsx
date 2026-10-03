import { useState } from "react";
import { ArrowLeft, Monitor, Smartphone, Check } from "lucide-react";
import { playChime } from "@/lib/flicro/sound";

interface ConnectPcScreenProps {
  onBack: () => void;
  onConnect: () => void;
  deviceName?: string;
}

export function ConnectPcScreen({ onBack, onConnect, deviceName = "iPhone" }: ConnectPcScreenProps) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const handleStart = () => {
    playChime("success");
    onConnect();
  };

  return (
    <div className="flex h-full w-full flex-col bg-white text-slate-900 select-none overflow-hidden font-sans">
      {/* Header matching Screenshot 4 */}
      <header className="safe-top flex shrink-0 items-center justify-between px-4 pt-3 pb-2 bg-white border-b border-slate-100 shadow-sm z-20">
        <button
          type="button"
          onClick={onBack}
          className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100 active:scale-95 text-slate-800 cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="size-6 stroke-[2.4]" />
        </button>
        <h1 className="text-base sm:text-lg font-bold text-slate-900">Connect PC/Mac</h1>
        <div className="size-10" />
      </header>

      {/* Top Half: Blue Area with Phone-to-PC Graphic matching Screenshot 4 */}
      <div className="flex-1 bg-[#1877f2] flex flex-col items-center justify-center px-6 text-center text-white relative overflow-hidden">
        {/* Subtle background radar circle */}
        <div className="absolute size-72 rounded-full border border-white/15 pointer-events-none" />

        {/* Graphic: Phone • • • • • PC Monitor matching Screenshot 4 */}
        <div className="relative flex items-center justify-center gap-4 sm:gap-8 my-6">
          {/* Phone */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-28 sm:w-20 sm:h-36 rounded-2xl border-2 border-white/90 bg-white/20 backdrop-blur-md p-1.5 flex flex-col justify-between shadow-2xl">
              <div className="size-1 rounded-full bg-white/70 mx-auto" />
              <div className="size-10 sm:size-12 rounded-full border-2 border-white/60 mx-auto flex items-center justify-center">
                <div className="size-4 rounded-full bg-white/80 animate-ping" />
              </div>
              <div className="size-1.5 rounded-full bg-white/70 mx-auto" />
            </div>
          </div>

          {/* Glowing Animated Connecting Dots • • • • • */}
          <div className="flex items-center gap-1.5 text-white/80">
            <span className="size-1.5 rounded-full bg-white animate-pulse" />
            <span className="size-1.5 rounded-full bg-white animate-pulse delay-100" />
            <span className="size-1.5 rounded-full bg-white animate-pulse delay-200" />
            <span className="size-1.5 rounded-full bg-white animate-pulse delay-300" />
            <span className="size-1.5 rounded-full bg-white animate-pulse delay-500" />
          </div>

          {/* Desktop Monitor */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-20 sm:w-32 sm:h-24 rounded-xl border-2 border-white/90 bg-white/20 backdrop-blur-md p-2 flex items-center justify-center shadow-2xl">
              <div className="w-12 h-14 rounded-lg bg-white/90 p-1 flex flex-col gap-1">
                <div className="h-3 w-full rounded bg-blue-500" />
                <div className="h-1.5 w-3/4 rounded bg-slate-300" />
                <div className="h-1.5 w-full rounded bg-slate-200" />
              </div>
            </div>
            {/* Monitor Stand */}
            <div className="w-4 h-3 bg-white/80" />
            <div className="w-12 h-1 bg-white/80 rounded-full" />
          </div>
        </div>

        {/* Text underneath graphic matching Screenshot 4 */}
        <p className="text-sm sm:text-base font-semibold text-white/95 mt-2">
          Transfer files between PC/Mac and {deviceName}
        </p>
      </div>

      {/* Bottom Half: White Area with Instructions & Button matching Screenshot 4 */}
      <div className="shrink-0 bg-white px-6 pt-8 pb-10 flex flex-col items-center text-center">
        <p className="text-sm font-semibold text-slate-800">
          Open Flicro on your PC or Mac
        </p>

        {connecting && (
          <p className="text-xs font-semibold text-[#1877f2] mt-3 animate-pulse">
            Scanning local network for PC/Mac…
          </p>
        )}

        {connected && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full mt-3">
            <Check className="size-3.5 stroke-[3]" />
            Connected to PC!
          </div>
        )}

        {/* Footnote matching Screenshot 4 */}
        <p className="text-[11px] text-slate-400 mt-16 mb-4">
          Visit https://pc.flicro.com in your PC browser
        </p>

        {/* Big Blue Action Button matching Screenshot 4 */}
        <button
          type="button"
          onClick={handleStart}
          disabled={connecting || connected}
          className="w-full h-12 rounded-2xl bg-[#1877f2] hover:bg-[#1466e3] text-white font-bold text-sm shadow-lg shadow-blue-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-70"
        >
          {connecting ? "Searching..." : connected ? "Connected" : "Connect PC/MAC"}
        </button>
      </div>
    </div>
  );
}
