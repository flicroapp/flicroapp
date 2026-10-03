import { createFileRoute } from "@tanstack/react-router";
import { execFile } from "node:child_process";
import { hostname, networkInterfaces, platform } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Every field is measured on the machine running this server.
 * Anything that cannot be measured is `null` — never a made-up value.
 */
type NetworkStats = {
  connected: boolean | null;
  signal: number | null;
  quality: "strong" | "moderate" | "weak" | null;
  bars: number | null;
  ssid: string | null;
  latencyMs: number | null;
  rxMbps: number | null;
  txMbps: number | null;
  hostname: string | null;
  localIp: string | null;
  source: "python" | "node";
};

function lanIp(): string | null {
  const nets = networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const net of list ?? []) {
      if (net.family === "IPv4" && !net.internal && !net.address.startsWith("169.254.")) return net.address;
    }
  }
  return null;
}

async function wifiFromNetsh(): Promise<Pick<NetworkStats, "connected" | "signal" | "ssid" | "rxMbps" | "txMbps">> {
  const empty = { connected: null, signal: null, ssid: null, rxMbps: null, txMbps: null };
  if (platform() !== "win32") return empty;
  try {
    const { stdout } = await execFileAsync("netsh", ["wlan", "show", "interfaces"], { timeout: 1500 });
    const state = /^\s*State\s*:\s*(.+)$/im.exec(stdout)?.[1]?.trim().toLowerCase() ?? "";
    const signal = /^\s*Signal\s*:\s*(\d+)%/im.exec(stdout)?.[1];
    const ssid = /^\s*SSID\s*:\s*(.+)$/im.exec(stdout)?.[1]?.trim();
    const rx = /Receive rate \(Mbps\)\s*:\s*([\d.]+)/i.exec(stdout)?.[1];
    const tx = /Transmit rate \(Mbps\)\s*:\s*([\d.]+)/i.exec(stdout)?.[1];
    return {
      connected: state ? state === "connected" : null,
      signal: signal ? Number(signal) : null,
      ssid: ssid || null,
      rxMbps: rx ? Number(rx) : null,
      txMbps: tx ? Number(tx) : null,
    };
  } catch {
    return empty;
  }
}

async function pingMs(): Promise<number | null> {
  const win = platform() === "win32";
  const args = win ? ["-n", "1", "-w", "800", "1.1.1.1"] : ["-c", "1", "-W", "1", "1.1.1.1"];
  try {
    const { stdout } = await execFileAsync("ping", args, { timeout: 1500 });
    const match = /time[=<]\s*([\d.]+)\s*ms/i.exec(stdout);
    return match ? Math.round(Number(match[1])) : null;
  } catch {
    return null;
  }
}

function grade(signal: number | null, latency: number | null, connected: boolean | null) {
  if (signal === null && latency === null) return { quality: null, bars: null };
  if (connected === false || (signal !== null && signal < 30) || (latency !== null && latency > 200)) {
    return { quality: "weak" as const, bars: 1 };
  }
  if ((signal !== null && signal < 65) || (latency !== null && latency > 80)) return { quality: "moderate" as const, bars: 2 };
  return { quality: "strong" as const, bars: 3 };
}

async function fromPython(): Promise<NetworkStats | null> {
  try {
    const script = join(process.cwd(), "scripts", "network_monitor.py");
    const { stdout } = await execFileAsync("python", [script], { timeout: 2500 });
    const data = JSON.parse(stdout.trim()) as Omit<NetworkStats, "source">;
    return { ...data, source: "python" };
  } catch {
    return null;
  }
}

async function getNetworkStats(): Promise<NetworkStats> {
  const py = await fromPython();
  if (py) return py;

  const [wifi, latencyMs] = await Promise.all([wifiFromNetsh(), pingMs()]);
  const { quality, bars } = grade(wifi.signal, latencyMs, wifi.connected);
  return {
    ...wifi,
    latencyMs,
    quality,
    bars,
    hostname: hostname() || null,
    localIp: lanIp(),
    source: "node",
  };
}

const handle = async () => {
  const stats = await getNetworkStats();
  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
};

export const Route = createFileRoute("/api/network")({
  server: { handlers: { GET: handle } },
});
