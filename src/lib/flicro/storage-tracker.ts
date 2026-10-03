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
  let totalBytes = 0;
  let usedBytes = vaultBytes;
  let availableBytes = 0;
  
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      appCacheBytes = estimate.usage || 0;
      if (estimate.quota && estimate.quota > 0) {
        totalBytes = estimate.quota;
        usedBytes = appCacheBytes + vaultBytes;
        availableBytes = Math.max(0, totalBytes - usedBytes);
      }
    } catch {}
  }

  // If we couldn't get a real estimate, we won't show fake hardcoded 128GB anymore.
  // We'll show 0 or the actual used vault bytes, meaning it's "Unknown total"
  const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

  return {
    totalBytes,
    usedBytes,
    availableBytes,
    usedPercent,
    vaultBytes,
    appCacheBytes,
    drivePath: "Device Storage (App Quota)",
    source: "browser",
  };
}
