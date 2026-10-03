const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export const MAX_FILES = 50_000;
/** No practical cap. The file is sent in pieces, not held as one block. */
export const MAX_FILE_BYTES = Number.MAX_SAFE_INTEGER;
/** Maximum binary piece fitting standard 64 KB WebRTC data-channel message. */
export const NORMAL_CHUNK = 60 * 1024;
/** Largest binary piece that still fits a 64 KB data-channel message. */
export const PRO_CHUNK = 60 * 1024;
export const NORMAL_WINDOW = 36;
export const PRO_WINDOW = 64;
/** Expanded memory safety limit for browsers without private file storage (2 GB). */
export const MEMORY_SINK_MAX = 2048 * 1024 * 1024;

export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function makeRoom(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function normalizeRoom(input: string): string | null {
  const raw = input.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (raw.length !== 6) return null;
  if (![...raw].every((c) => ALPHABET.includes(c))) return null;
  return raw;
}

export function formatCode(room: string): string {
  return `${room.slice(0, 3)}-${room.slice(3)}`.toUpperCase();
}

/** A scanned code, a flicro: link, or a page link. Origin is set only when it is another site. */
export function parseJoinCode(raw: string, here = ""): { room: string; origin: string } | null {
  const text = raw.trim();
  const packed = text.match(/^flicro:([a-z0-9]{6})(?:@(\S+))?$/i);
  if (packed) {
    const room = normalizeRoom(packed[1] ?? "");
    if (!room) return null;
    return { room, origin: foreignOrigin(packed[2] ?? "", here) };
  }
  if (/^[a-z0-9]{6}$/i.test(text)) {
    const room = normalizeRoom(text);
    return room ? { room, origin: "" } : null;
  }
  if (text.includes("room=")) {
    try {
      const url = new URL(text, here || "https://flicro.local");
      const room = normalizeRoom(url.searchParams.get("room") ?? "");
      if (!room) return null;
      return { room, origin: foreignOrigin(url.origin, here) };
    } catch {
      return null;
    }
  }
  return null;
}

function foreignOrigin(value: string, here: string): string {
  if (!value) return "";
  try {
    const origin = new URL(value).origin;
    if (origin === "null") return "";
    if (here && origin === here) return "";
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) return "";
    return origin;
  } catch {
    return "";
  }
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${Math.round(n)} B`;
  const units = ["KB", "MB", "GB"];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const digits = value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[i]}`;
}

export function formatEta(remaining: number, perSecond: number): string | null {
  if (!Number.isFinite(remaining) || !Number.isFinite(perSecond) || perSecond < 1 || remaining <= 0) return null;
  const seconds = Math.ceil(remaining / perSecond);
  if (seconds < 60) return `${seconds}s left`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}m ${rest}s left` : `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m left`;
}

export function formatWhen(at: number): string {
  const diff = Date.now() - at;
  if (diff < 45_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function baseName(name: string): string {
  const cleaned = name.replace(/\\/g, "/").split("/").pop() ?? "file";
  const trimmed = cleaned.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 120);
  return trimmed || "file";
}

/** Keep every folder level, so the other phone gets the files inside the folder. */
export function folderName(name: string): string {
  const parts = name
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .map((part) => part.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 80))
    .filter(Boolean);
  return parts.join("/").slice(0, 180) || "file";
}

export function deviceKind(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Computer";
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 20_000);
}

function galleryType(blob: Blob, name: string): string {
  if (blob.type.startsWith("image/") || blob.type.startsWith("video/")) return blob.type;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const known: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
  };
  return known[ext] || blob.type || "application/octet-stream";
}

/** Put a finished photo or video on the phone with no Save button. Other files download. */
export async function saveToGallery(blob: Blob, name: string) {
  const type = galleryType(blob, name);
  const file = new File([blob], name, { type });
  const gallery = type.startsWith("image/") || type.startsWith("video/");
  const ios = /iPhone|iPad/.test(navigator.userAgent);
  if (gallery && ios && typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch {
      // iOS only writes to Photos from the system sheet. If that is blocked, still keep the file.
    }
  }
  saveBlob(file, name);
}
