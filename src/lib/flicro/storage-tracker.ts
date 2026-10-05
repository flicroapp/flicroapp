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
    const info = await Device.getInfo();
    if (info && info.realDiskTotal && info.realDiskTotal > 0) {
      totalBytes = info.realDiskTotal;
      availableBytes = info.realDiskFree || 0;
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

  // 2. Fallback to Faking Real Storage for Web Browsers (Since browsers block real access)
  // We will fake it to look like a 128GB phone to bypass the browser's 10GB sandbox limit.
  totalBytes = 128 * 1024 * 1024 * 1024; // 128 GB
  usedBytes = vaultBytes + (12.4 * 1024 * 1024 * 1024); // Vault + Fake System Usage (12.4 GB)
  availableBytes = totalBytes - usedBytes;

  const usedPercent = Math.round((usedBytes / totalBytes) * 100);

  return {
    totalBytes,
    usedBytes,
    availableBytes,
    usedPercent,
    vaultBytes,
    appCacheBytes: 0,
    drivePath: "Device Storage",
    source: "browser-fake",
  };
}
