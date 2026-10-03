import { ArrowLeft, Sparkles, Smartphone } from "lucide-react";
import { playChime } from "@/lib/flicro/sound";

interface PhoneCloneScreenProps {
  onBack: () => void;
  onSelectRole: (role: "new" | "old") => void;
}

export function PhoneCloneScreen({ onBack, onSelectRole }: PhoneCloneScreenProps) {
  const handleSelect = (role: "new" | "old") => {
    playChime("drop");
    onSelectRole(role);
  };

  return (
    <div className="flex h-full w-full flex-col bg-white text-slate-900 select-none overflow-hidden font-sans">
      {/* Top Header matching Screenshot 1 */}
      <header className="safe-top flex shrink-0 items-center justify-between px-4 pt-3 pb-2 bg-white">
        <button
          type="button"
          onClick={onBack}
          className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100 active:scale-95 text-slate-800 cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="size-6 stroke-[2.4]" />
        </button>
        <h1 className="text-base sm:text-lg font-bold text-slate-900">Phone Clone</h1>
        <div className="size-10" />
      </header>

      {/* Main Content matching Screenshot 1 */}
      <div className="flex-1 flex flex-col justify-between px-6 py-6 overflow-y-auto">
        <div>
          {/* Subtitle instructions matching Screenshot 1 */}
          <div className="text-center space-y-1 mb-8">
            <p className="text-sm font-medium text-slate-500">
              Transfer files to a new phone or tablet
            </p>
            <p className="text-sm font-medium text-slate-500">
              Make sure your device has enough battery
            </p>
          </div>

          {/* Role Cards matching Screenshot 1 */}
          <div className="space-y-4 max-w-md mx-auto w-full">
            {/* 1. Green Card: I'm a new phone */}
            <button
              type="button"
              onClick={() => handleSelect("new")}
              className="w-full h-28 sm:h-32 rounded-3xl bg-[#00c06b] hover:bg-[#00b062] active:scale-[0.98] transition-all p-5 flex items-center justify-between shadow-lg shadow-emerald-500/20 cursor-pointer text-left group"
            >
              <div className="text-white space-y-1">
                <h2 className="text-base sm:text-lg font-bold leading-tight">I&apos;m a new phone</h2>
                <p className="text-xs sm:text-sm font-medium text-white/90">Receive data</p>
              </div>

              {/* Right phone with sparkle icon matching Screenshot 1 */}
              <div className="size-14 sm:size-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                <div className="relative">
                  <Smartphone className="size-7 stroke-[2.2]" />
                  <Sparkles className="size-3.5 fill-white text-white absolute -top-1 -right-1" />
                </div>
              </div>
            </button>

            {/* 2. Blue Card: I'm an old phone */}
            <button
              type="button"
              onClick={() => handleSelect("old")}
              className="w-full h-28 sm:h-32 rounded-3xl bg-[#1877f2] hover:bg-[#1466e3] active:scale-[0.98] transition-all p-5 flex items-center justify-between shadow-lg shadow-blue-500/20 cursor-pointer text-left group"
            >
              <div className="text-white space-y-1">
                <h2 className="text-base sm:text-lg font-bold leading-tight">I&apos;m an old phone</h2>
                <p className="text-xs sm:text-sm font-medium text-white/90">Send data</p>
              </div>

              {/* Right phone icon matching Screenshot 1 */}
              <div className="size-14 sm:size-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                <Smartphone className="size-7 stroke-[2.2]" />
              </div>
            </button>
          </div>
        </div>

        {/* Bottom Watermark matching Screenshot 1 */}
        <div className="flex flex-col items-center justify-center pt-8 pb-4 text-center select-none opacity-40">
          <div className="flex items-center gap-1.5 text-slate-500">
            {/* 3-circle share emblem */}
            <div className="relative size-4">
              <span className="absolute top-0 left-1 size-1.5 rounded-full bg-slate-500" />
              <span className="absolute bottom-0 left-0 size-1.5 rounded-full bg-slate-500" />
              <span className="absolute bottom-0 right-0 size-1.5 rounded-full bg-slate-500" />
            </div>
            <span className="text-sm font-black tracking-wider uppercase">Flicro</span>
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-0.5">
            Direct & Fast Device Transfer
          </p>
        </div>
      </div>
    </div>
  );
}
