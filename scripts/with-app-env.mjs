#!/usr/bin/env node
/**
 * Run a command with `.grok/app-env.json` merged into its environment.
 */
import { spawn, execSync } from "node:child_process";
import { readFileSync, realpathSync, existsSync } from "node:fs";
import { constants as osConstants } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_ENV_REL_PATH = ".grok/app-env.json";

const VITE_PREFIX = "VITE_";

/**
 * Free a port if it's currently occupied by an orphaned process.
 */
function freePort(port = 8080) {
  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano | findstr :${port}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const lines = output.split("\n");
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1]?.endsWith(`:${port}`) && parts[3] === "LISTENING") {
          const pid = parts[4];
          if (pid && pid !== "0" && pid !== String(process.pid)) {
            try {
              process.kill(Number(pid), "SIGKILL");
            } catch {
              execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
            }
          }
        }
      }
    } else {
      execSync(`fuser -k ${port}/tcp || lsof -ti:${port} | xargs -r kill -9`, { stdio: "ignore" });
    }
  } catch {
    // Port was already free
  }
}

/**
 * Parse an app-env document, keeping only `VITE_`-prefixed string entries.
 */
export function parseAppEnv(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {};
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const env = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!key.startsWith(VITE_PREFIX)) continue;
    if (typeof value !== "string") continue;
    env[key] = value;
  }
  return env;
}

/** The app env recorded under `root`, or `{}` when the file is absent. */
export function readAppEnv(root) {
  try {
    return parseAppEnv(readFileSync(join(root, APP_ENV_REL_PATH), "utf8"));
  } catch {
    return {};
  }
}

/** File values under the process environment: an explicit override wins. */
export function mergeAppEnv(appEnv, processEnv) {
  return { ...appEnv, ...processEnv };
}

export function exitStatusFromChild(code, signal) {
  if (signal) {
    const signo = osConstants.signals[signal];
    return 128 + (typeof signo === "number" ? signo : 1);
  }
  return code ?? 1;
}

/** The workspace root (this file lives in `<root>/scripts/`). */
export function projectRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

export function isMainModule(moduleUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === fileURLToPath(moduleUrl);
  } catch {
    return false;
  }
}

function main(argv) {
  const [command, ...args] = argv;
  if (!command) {
    console.error("usage: node scripts/with-app-env.mjs <command> [args…]");
    process.exit(2);
  }

  // If starting dev server or binding port 8080, automatically kill any stale process on 8080
  if (args.includes("dev") || args.includes("8080") || command === "vite") {
    freePort(8080);
  }

  const root = projectRoot();
  const env = mergeAppEnv(readAppEnv(root), process.env);
  const isWin = process.platform === "win32";

  // Resolve binary paths directly on Windows without shell:true to avoid DEP0190 warnings
  let execCmd = command;
  let execArgs = args;

  if (command === "vite") {
    const viteBin = join(root, "node_modules", "vite", "bin", "vite.js");
    if (existsSync(viteBin)) {
      execCmd = process.execPath;
      execArgs = [viteBin, ...args];
    } else if (isWin) {
      execCmd = "vite.cmd";
    }
  }

  const child = spawn(execCmd, execArgs, {
    stdio: "inherit",
    env,
    shell: false,
  });

  // The dev server is long-running and is stopped by signalling this wrapper.
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => {
      try {
        child.kill(signal);
      } catch {}
    });
  }

  child.on("error", (err) => {
    console.error(`[with-app-env] failed to run ${command}:`, err?.message || err);
    process.exit(127);
  });

  child.on("exit", (code, signal) => {
    process.exit(exitStatusFromChild(code, signal));
  });
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2));
}
