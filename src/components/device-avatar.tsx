import { useMemo } from "react";
import { Smartphone, Laptop, Monitor, User } from "lucide-react";

export interface DeviceAvatarProps {
  name?: string;
  photo?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showBadge?: boolean;
  isOnline?: boolean;
}

export function DeviceAvatar({
  name = "",
  photo = null,
  size = "md",
  className = "",
  showBadge = false,
  isOnline = false,
}: DeviceAvatarProps) {
  const deviceType = useMemo(() => {
    const text = (name + " " + (typeof navigator !== "undefined" ? navigator.userAgent : "")).toLowerCase();
    if (text.includes("iphone") || text.includes("ipad") || text.includes("ios") || text.includes("apple")) {
      return "apple";
    }
    if (text.includes("android") || text.includes("samsung") || text.includes("pixel") || text.includes("xiaomi")) {
      return "android";
    }
    if (text.includes("windows") || text.includes("pc") || text.includes("desktop")) {
      return "windows";
    }
    if (text.includes("mac") || text.includes("macbook")) {
      return "mac";
    }
    return "phone";
  }, [name]);

  const sizeClasses = {
    sm: "size-9 text-xs",
    md: "size-12 text-sm",
    lg: "size-16 text-base",
    xl: "size-20 sm:size-24 text-lg",
  }[size];

  const iconSizes = {
    sm: "size-5",
    md: "size-6",
    lg: "size-8",
    xl: "size-10 sm:size-12",
  }[size];

  // If custom photo is provided and valid, render it
  if (photo && photo.trim() && !photo.includes("avatar-character.jpg")) {
    return (
      <div className={`relative inline-flex items-center justify-center rounded-full bg-white shadow-md overflow-hidden ${sizeClasses} ${className}`}>
        <img src={photo} alt={name || "Profile"} className="size-full object-cover" />
        {showBadge && (
          <span
            className={`absolute bottom-0.5 right-0.5 size-3 rounded-full border-2 border-white ${
              isOnline ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
        )}
      </div>
    );
  }

  // Render official device glyph based on platform
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full shadow-md select-none transition-transform ${
        deviceType === "apple"
          ? "bg-gradient-to-br from-slate-900 to-slate-800 text-white border-2 border-slate-700/50"
          : deviceType === "android"
          ? "bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-2 border-emerald-400/50"
          : deviceType === "windows"
          ? "bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-2 border-blue-400/50"
          : "bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-2 border-white/60"
      } ${sizeClasses} ${className}`}
    >
      {deviceType === "apple" ? (
        // Apple / iPhone Official SVG Icon
        <svg viewBox="0 0 24 24" className={`${iconSizes} fill-current`} aria-label="Apple iPhone">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.16c.66-.82 1.11-1.96.99-3.1-.96.04-2.12.64-2.8 1.44-.6.69-1.12 1.83-.98 2.94 1.07.08 2.15-.55 2.79-1.28" />
        </svg>
      ) : deviceType === "android" ? (
        // Android Official SVG Icon
        <svg viewBox="0 0 24 24" className={`${iconSizes} fill-current`} aria-label="Android">
          <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-4.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 2.23 12.95 2 12 2c-.96 0-1.86.23-2.66.63L7.85.95c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.9 6 5.34 6 7h12c0-1.66-.97-3.1-2.47-3.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z" />
        </svg>
      ) : deviceType === "windows" ? (
        // Windows Official SVG Icon
        <svg viewBox="0 0 24 24" className={`${iconSizes} fill-current`} aria-label="Windows PC">
          <path d="M3 5.557L10.395 4.5v6.945H3V5.557zm0 12.886l7.395 1.057v-6.945H3v5.888zm8.605 1.229L21 21.3V11.445H11.605v8.227zm0-15.344v8.117H21V2.7L11.605 4.328z" />
        </svg>
      ) : (
        <Smartphone className={iconSizes} />
      )}

      {showBadge && (
        <span
          className={`absolute bottom-0.5 right-0.5 size-3 rounded-full border-2 border-white ${
            isOnline ? "bg-emerald-400" : "bg-amber-400"
          }`}
        />
      )}
    </div>
  );
}
