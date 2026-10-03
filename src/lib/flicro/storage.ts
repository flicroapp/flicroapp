import { deviceKind, uid } from "./format";

const NAME_KEY = "flicro-name";
const TAB_KEY = "flicro-tab";
const HISTORY_KEY = "flicro-history";
const PRO_KEY = "flicro-pro";

export type HistoryFile = {
  name: string;
  size: number;
  opfsName: string | null;
};

export type HistoryEntry = {
  id: string;
  at: number;
  direction: "sent" | "received";
  peer: string;
  status: "delivered" | "received" | "declined" | "failed" | "cancelled";
  detail: string;
  files: HistoryFile[];
};

export function getPeerId(): string {
  try {
    let id = sessionStorage.getItem(TAB_KEY);
    if (!id || !/^[a-zA-Z0-9_-]{8,64}$/.test(id)) {
      id = uid();
      sessionStorage.setItem(TAB_KEY, id);
    }
    return id;
  } catch {
    return uid();
  }
}

export function loadName(peerId: string): string {
  try {
    const saved = localStorage.getItem(NAME_KEY)?.trim() ?? "";
    if (saved && !/^(iPhone|iPad|Android|Mac|Windows|Linux) [A-F0-9]{2}$/.test(saved)) {
      return saved.slice(0, 32);
    }
    if (saved) localStorage.removeItem(NAME_KEY);
  } catch {
    /* private mode can block storage; the device name still works */
  }
  void peerId;
  return deviceKind();
}

export function saveName(name: string) {
  const trimmed = name.trim().slice(0, 32);
  if (!trimmed) {
    localStorage.removeItem(NAME_KEY);
    return;
  }
  localStorage.setItem(NAME_KEY, trimmed);
}

const PHOTO_KEY = "flicro-photo";

export function loadPhoto(): string {
  const value = localStorage.getItem(PHOTO_KEY) ?? "";
  return value.startsWith("data:image/") && value.length <= 24_000 ? value : "";
}

export function savePhoto(dataUrl: string) {
  if (!dataUrl) {
    localStorage.removeItem(PHOTO_KEY);
    return;
  }
  if (dataUrl.startsWith("data:image/") && dataUrl.length <= 24_000) localStorage.setItem(PHOTO_KEY, dataUrl);
}

/** Square JPEG small enough to keep on this device and show to the other device. */
export function readProfilePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 96;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx || !img.width || !img.height) {
        URL.revokeObjectURL(url);
        reject(new Error("Couldn't read that photo."));
        return;
      }
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      let data = canvas.toDataURL("image/jpeg", 0.72);
      if (data.length > 24_000) data = canvas.toDataURL("image/jpeg", 0.45);
      if (!data.startsWith("data:image/") || data.length > 24_000) {
        reject(new Error("That photo is still too large."));
        return;
      }
      resolve(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that photo."));
    };
    img.src = url;
  });
}

export function loadPro(): boolean {
  return localStorage.getItem(PRO_KEY) === "1";
}

export function savePro(on: boolean) {
  localStorage.setItem(PRO_KEY, on ? "1" : "0");
}

const SETUP_KEY = "flicro-setup";
const NOTIFY_KEY = "flicro-notify";
const LEAVE_KEY = "flicro-leave";
const PIN_KEY = "flicro-pin";
const BIO_KEY = "flicro-bio";

export function setupDone(): boolean {
  return localStorage.getItem(SETUP_KEY) === "1";
}

export function markSetupDone() {
  localStorage.setItem(SETUP_KEY, "1");
}

export function loadNotify(): boolean {
  return localStorage.getItem(NOTIFY_KEY) === "1";
}

export function saveNotify(on: boolean) {
  localStorage.setItem(NOTIFY_KEY, on ? "1" : "0");
}

export function loadAutoLeave(): boolean {
  return localStorage.getItem(LEAVE_KEY) === "1";
}

export function saveAutoLeave(on: boolean) {
  localStorage.setItem(LEAVE_KEY, on ? "1" : "0");
}

export function hasPin(): boolean {
  return Boolean(localStorage.getItem(PIN_KEY));
}

export function clearPin() {
  localStorage.removeItem(PIN_KEY);
  localStorage.removeItem(BIO_KEY);
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function b64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function pinHash(pin: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 120_000, hash: "SHA-256" },
    key,
    256,
  );
  return bytesToB64(new Uint8Array(bits));
}

export async function savePin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pinHash(pin, salt);
  localStorage.setItem(PIN_KEY, JSON.stringify({ salt: bytesToB64(salt), hash }));
}

export async function checkPin(pin: string): Promise<boolean> {
  const raw = localStorage.getItem(PIN_KEY);
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw) as { salt?: string; hash?: string };
    if (!saved.salt || !saved.hash) return false;
    const hash = await pinHash(pin, b64ToBytes(saved.salt));
    return hash === saved.hash;
  } catch {
    return false;
  }
}

export function loadBio(): string | null {
  return localStorage.getItem(BIO_KEY);
}

export function saveBio(id: string | null) {
  if (!id) localStorage.removeItem(BIO_KEY);
  else localStorage.setItem(BIO_KEY, id);
}

function isEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<HistoryEntry>;
  return (
    typeof v.id === "string" &&
    typeof v.at === "number" &&
    (v.direction === "sent" || v.direction === "received") &&
    typeof v.peer === "string" &&
    typeof v.status === "string" &&
    typeof v.detail === "string" &&
    Array.isArray(v.files)
  );
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(0, 40);
  } catch {
    return [];
  }
}

export function appendHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, 40);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export async function readOpfs(name: string): Promise<File | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(name);
    return await handle.getFile();
  } catch {
    return null;
  }
}

export async function clearHistoryStore(): Promise<void> {
  const items = loadHistory();
  localStorage.removeItem(HISTORY_KEY);
  try {
    const root = await navigator.storage.getDirectory();
    for (const item of items) {
      for (const file of item.files) {
        if (file.opfsName) await root.removeEntry(file.opfsName).catch(() => {});
      }
    }
  } catch {
    // Private mode and older browsers have no private file system.
  }
}
