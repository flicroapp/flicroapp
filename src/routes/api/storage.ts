import { createFileRoute } from "@tanstack/react-router";
import { execFile } from "node:child_process";
import { statfs } from "node:fs/promises";
import { platform } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface RealStorageResponse {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usedPercent: number;
  path: string;
  source: "python" | "node";
}

async function getStorageFromPython(): Promise<RealStorageResponse | null> {
  try {
    const script = join(process.cwd(), "scripts", "storage_monitor.py");
    const { stdout } = await execFileAsync("python", [script], { timeout: 2500 });
    const data = JSON.parse(stdout.trim());
    if (data.totalBytes && data.availableBytes !== undefined) {
      return {
        totalBytes: data.totalBytes,
        usedBytes: data.usedBytes,
        availableBytes: data.availableBytes,
        usedPercent: data.usedPercent,
        path: data.path || "Device Drive",
        source: "python",
      };
    }
  } catch {}
  return null;
}

async function getStorageFromNode(): Promise<RealStorageResponse | null> {
  try {
    const rootPath = platform() === "win32" ? process.env.SystemDrive || "C:\\" : "/";
    const stats = await statfs(rootPath);
    const totalBytes = stats.blocks * stats.bsize;
    const availableBytes = stats.bfree * stats.bsize;
    const usedBytes = Math.max(0, totalBytes - availableBytes);
    const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;

    return {
      totalBytes,
      usedBytes,
      availableBytes,
      usedPercent,
      path: rootPath,
      source: "node",
    };
  } catch {}
  return null;
}

const handle = async () => {
  let stats = await getStorageFromPython();
  if (!stats) {
    stats = await getStorageFromNode();
  }

  if (!stats) {
    return new Response(JSON.stringify({ error: "Could not read disk stats" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
};

export const Route = createFileRoute("/api/storage")({
  server: { handlers: { GET: handle } },
});
