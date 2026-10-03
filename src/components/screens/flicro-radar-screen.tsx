import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CircleHelp,
  ScanLine,
} from "lucide-react";
import type { PeerInfo } from "@/lib/multiplayer";
import { formatCode } from "@/lib/flicro/format";
import { DeviceAvatar } from "@/components/device-avatar";
import { loadPhoto } from "@/lib/flicro/storage";

interface RadarScreenProps {
  mode: "send" | "receive";
  room: string;
  name: string;
  wifiSsid?: string;
  peers: PeerInfo[];
  live: string[];
  pickedCount: number;
  onBack: () => void;
  onHelp: () => void;
  onPickPeer: (peerId: string) => void;
  onOpenScanner: () => void;
  onAddFiles?: () => void;
}

export function RadarScreen({
  mode,
  room,
  name,
  wifiSsid = "",
  peers,
  live,
  pickedCount,
  onBack,
  onHelp,
  onPickPeer,
  onOpenScanner,
  onAddFiles,
}: RadarScreenProps) {
  const isSend = mode === "send";
  const title = isSend ? "Click the avatar to Send" : "Waiting to Receive";
  const myPhoto = typeof window !== "undefined" ? loadPhoto() : null;

  // Concentric radar wave pulsing
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setPulse((n) => n + 1), 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#1877f2] text-white select-none overflow-hidden font-sans">
      {/* Top Header */}
      <header className="safe-top flex shrink-0 items-center justify-between px-4 pt-3 pb-2 z-20">
        <button
          type="button"
          onClick={onBack}
          className="flex size-11 items-center justify-center rounded-full hover:bg-white/15 active:scale-90 transition-all text-white cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="size-6 stroke-[2.4]" />
        </button>

        <h1 className="text-base sm:text-lg font-semibold tracking-tight text-white text-center">
          {title}
        </h1>

        <button
          type="button"
          onClick={onHelp}
          className="flex size-11 items-center justify-center rounded-full hover:bg-white/15 active:scale-90 transition-all text-white cursor-pointer"
          aria-label="Help"
        >
          <CircleHelp className="size-6 stroke-[2]" />
        </button>
      </header>

      {/* Subheader: Current WiFi */}
      {wifiSsid ? (
        <div className="shrink-0 flex flex-col items-center pt-2 pb-1 text-center z-20">
          <p className="text-xs sm:text-sm font-normal text-white/90">
            Current WiFi:
          </p>
          <p className="text-sm sm:text-base font-semibold text-white tracking-wide mt-0.5">
            {wifiSsid}
          </p>
        </div>
      ) : null}

      {/* Main Animated Concentric Radar Workspace */}
      <div className="relative flex-1 flex items-center justify-center min-h-0 overflow-hidden">
        <div className="relative size-[min(82vw,360px)] sm:size-[380px] flex items-center justify-center">
          {/* Animated concentric circles */}
          <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none scale-100" />
          <div className="absolute size-[80%] rounded-full border border-white/25 pointer-events-none" />
          <div className="absolute size-[60%] rounded-full border border-white/30 pointer-events-none" />
          <div className="absolute size-[40%] rounded-full border border-white/35 pointer-events-none" />

          {/* Animated expanding radar pulses */}
          <span className="radar-wave" />
          <span className="radar-wave radar-wave-2" />
          <span className="radar-wave radar-wave-3" />

          {/* Floating subtle ambient dots */}
          <div className="absolute top-[20%] left-[25%] size-2 rounded-full bg-white/40 blur-[0.5px] animate-pulse" />
          <div className="absolute bottom-[28%] right-[22%] size-1.5 rounded-full bg-white/50 blur-[0.5px] animate-pulse" />
          <div className="absolute top-[40%] right-[15%] size-2.5 rounded-full bg-white/30 blur-[0.5px] animate-pulse" />
          <div className="absolute bottom-[35%] left-[18%] size-2 rounded-full bg-white/40 blur-[0.5px] animate-pulse" />

          {/* Discovered nearby peer avatars */}
          {peers.map((peer, idx) => {
            const angle = (-90 + (idx * 360) / Math.max(peers.length, 1)) * (Math.PI / 180);
            const isReady = live.includes(peer.id) || peer.channelOpen || peer.connectionState === "connected";
            return (
              <button
                key={peer.id}
                type="button"
                onClick={() => onPickPeer(peer.id)}
                className="peer-floating absolute z-30 flex flex-col items-center group cursor-pointer transition-transform hover:scale-110 active:scale-95"
                style={{
                  left: `${50 + Math.cos(angle) * 38}%`,
                  top: `${50 + Math.sin(angle) * 38}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <DeviceAvatar
                  name={peer.name}
                  photo={peer.photo}
                  size="lg"
                  showBadge
                  isOnline={isReady}
                  className="shadow-xl"
                />
                <span className="mt-1 max-w-[80px] truncate text-xs font-bold text-white drop-shadow">
                  {peer.name || "Device"}
                </span>
              </button>
            );
          })}

          {/* Center Self Avatar */}
          <div className="relative z-20 flex flex-col items-center">
            {/* File count badge above avatar for Send mode */}
            {isSend && pickedCount > 0 && (
              <div className="mb-2">
                <span className="rounded-full bg-white/20 backdrop-blur-md px-3 py-0.5 text-xs font-semibold text-white tracking-wide border border-white/30 shadow-sm">
                  {pickedCount} {pickedCount === 1 ? "file" : "files"}
                </span>
              </div>
            )}

            {/* Avatar circle with official device SVG / custom photo */}
            <div className="relative group cursor-pointer" onClick={() => peers[0] && onPickPeer(peers[0].id)}>
              <div className="p-1 rounded-full border-4 border-white/80 shadow-2xl bg-white/10 backdrop-blur-sm">
                <DeviceAvatar
                  name={name}
                  photo={myPhoto}
                  size="xl"
                  showBadge
                  isOnline
                  className="group-hover:scale-105 transition-transform"
                />
              </div>
            </div>

            {/* Device Name below avatar */}
            <p className="mt-2 text-sm sm:text-base font-semibold text-white tracking-wide drop-shadow">
              {name || (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent) ? "Android" : typeof navigator !== "undefined" && /iPhone|iPad/i.test(navigator.userAgent) ? "iPhone" : "My Device")}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Section: White Card with Floating Circular Scanner Button */}
      <div className="shrink-0 bg-white rounded-t-[32px] pt-4 pb-8 px-6 text-center text-slate-900 shadow-2xl relative z-30">
        <div className="flex flex-col items-center -mt-10">
          <button
            type="button"
            onClick={onOpenScanner}
            className="group size-16 rounded-full bg-[#1877f2] flex items-center justify-center text-white border-4 border-white shadow-xl hover:bg-[#1466e3] active:scale-95 transition-all cursor-pointer"
            aria-label="Pair Device Scanner"
          >
            <ScanLine className="size-8 group-hover:scale-110 transition-transform stroke-[2.3]" />
          </button>

          <button
            type="button"
            onClick={onOpenScanner}
            className="mt-2 text-sm font-semibold text-[#1877f2] hover:underline cursor-pointer"
          >
            Pair / Scan QR Code
          </button>

          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <span>Room code:</span>
            <span className="font-mono font-bold tracking-wider text-slate-800">
              {formatCode(room)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
