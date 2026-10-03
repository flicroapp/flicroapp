/**
 * Browser preview keeps the encrypted WebRTC data channel.
 * The Android and iOS projects call the FlicroNative Capacitor plugin
 * (Wi-Fi Direct, Multipeer Connectivity, and a shared local TCP port).
 * File bytes are not uploaded in either path.
 */
export const ACTIVE_TRANSPORT = "browser-direct" as const;

export type ActiveTransport = typeof ACTIVE_TRANSPORT;

export function transportNote(): string {
  return "In the browser, files move on an encrypted direct link. The Android and iOS app send over Wi-Fi Direct, Apple Multipeer, or the same Wi-Fi. File bytes are not uploaded.";
}
