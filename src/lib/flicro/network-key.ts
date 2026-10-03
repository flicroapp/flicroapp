let cached: Promise<string | null> | null = null;

/** Public IPv4 of this network, from STUN. Same Wi-Fi shares one address even when the page request does not. */
export function publicNetworkKey(): Promise<string | null> {
  if (typeof window === "undefined" || typeof RTCPeerConnection === "undefined") return Promise.resolve(null);
  cached ??= stunIpv4().catch(() => null);
  return cached;
}

function stunIpv4(): Promise<string | null> {
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    const finish = (ip: string | null) => {
      window.clearTimeout(timer);
      try {
        pc.close();
      } catch {
        /* already closed */
      }
      resolve(ip);
    };
    const timer = window.setTimeout(() => finish(null), 2500);
    pc.onicecandidate = (event) => {
      const line = event.candidate?.candidate ?? "";
      const match = /(\d{1,3}(?:\.\d{1,3}){3}) \d+ typ srflx/.exec(line);
      if (!match) return;
      const ip = match[1];
      if (ip && !isPrivate(ip)) finish(ip);
    };
    try {
      pc.createDataChannel("n");
      void pc.createOffer().then((offer) => pc.setLocalDescription(offer)).catch(() => finish(null));
    } catch {
      finish(null);
    }
  });
}

function isPrivate(ip: string): boolean {
  return ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("127.") || ip.startsWith("169.254.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);
}
