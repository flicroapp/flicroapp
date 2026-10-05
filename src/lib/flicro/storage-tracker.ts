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
  
  // 1. Try Native App Bypass to get REAL hardware storage
  try {
    const { Device } = await import("@capacitor/device");
    const info = await Device.getInfo() as any;
    if (info && (info.realDiskTotal || info.diskTotal) && (info.realDiskTotal || info.diskTotal) > 0) {
      totalBytes = info.realDiskTotal || info.diskTotal;
      availableBytes = info.realDiskFree || info.diskFree || 0;
      usedBytes = totalBytes - availableBytes;
      
      return {
        totalBytes,
        usedBytes,
        availableBytes,
        usedPercent: Math.round((usedBytes / totalBytes) * 100),
        vaultBytes,
        appCacheBytes: 0,
        drivePath: "True Hardware Storage",
        source: "native",
      };
    }
  } catch (e) {
    // Native API not available, fall back to browser sandbox
  }

  // 2. Fallback to Browser Quota Sandbox (Real API data, no hardcoded fakes)
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

  const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

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
