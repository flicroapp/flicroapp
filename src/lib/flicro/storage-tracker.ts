import { getVaultTotalSize } from "./vault-db";

export interface DeviceStorageStats {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usedPercent: number;
  vaultBytes: number;
  appCacheBytes: number;
  drivePath: string;
  source: string;
}

export async function calculateDeviceStorage(): Promise<DeviceStorageStats> {
  const vaultBytes = await getVaultTotalSize();

  let appCacheBytes = 0;
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      appCacheBytes = estimate.usage || 0;
    } catch {}
  }

  // 1. Fetch exact physical hardware storage from real server/Python backend
  try {
    const res = await fetch("/api/storage");
    if (res.ok) {
      const data = await res.json();
      if (data.totalBytes && data.availableBytes !== undefined) {
        return {
          totalBytes: data.totalBytes,
          usedBytes: data.usedBytes,
          availableBytes: data.availableBytes,
          usedPercent: data.usedPercent,
          vaultBytes,
          appCacheBytes,
          drivePath: data.path || "C:\\",
          source: data.source || "hardware",
        };
      }
    }
  } catch {}

  // 2. Fallback to navigator.storage estimate if offline / static PWA
  let totalBytes = 128 * 1024 * 1024 * 1024;
  let availableBytes = 80 * 1024 * 1024 * 1024;
  let usedBytes = 48 * 1024 * 1024 * 1024;

  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota && estimate.quota > 0) {
        totalBytes = estimate.quota;
        usedBytes = (estimate.usage || 0) + vaultBytes;
        availableBytes = Math.max(0, totalBytes - usedBytes);
      }
    } catch {}
  }

  const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;

  return {
    totalBytes,
    usedBytes,
    availableBytes,
    usedPercent,
    vaultBytes,
    appCacheBytes,
    drivePath: "Device Storage",
    source: "browser",
  };
}
