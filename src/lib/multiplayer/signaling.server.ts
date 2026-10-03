/**
 * WebRTC signaling over the app database (Neon deployed, PGLite in preview).
 * Only rendezvous traffic passes through here — roster + SDP/ICE relay while a
 * mesh forms; file bytes then flow peer-to-peer. DB-backed so any serverless
 * instance can serve any poll. Mount at /api/rtc.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import type { PeerRow, RtcPollResponse, SignalRow } from "./p2p";

const ID = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const signalSchema = z.object({
  op: z.literal("signal"),
  room: ID,
  from: ID,
  to: ID,
  kind: z.enum(["offer", "answer", "ice", "ctrl"]),
  payload: z.unknown().refine((v) => v !== undefined && JSON.stringify(v).length <= 200_000, {
    message: "payload too large",
  }),
});
const leaveSchema = z.object({ op: z.literal("leave"), room: ID, peer: ID });
const postSchema = z.discriminatedUnion("op", [signalSchema, leaveSchema]);

const PEER_TTL_SECONDS = 30;
const SIGNAL_TTL_SECONDS = 60;

const globalRef = globalThis as typeof globalThis & {
  __rtcSchemaPromise__?: Promise<void>;
};

function ensureSchema(sql: Sql): Promise<void> {
  globalRef.__rtcSchemaPromise__ ??= (async () => {
    await sql.query(
      `CREATE TABLE IF NOT EXISTS webrtc_peers (
         room TEXT NOT NULL,
         peer_id TEXT NOT NULL,
         name TEXT NOT NULL DEFAULT '',
         last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
         PRIMARY KEY (room, peer_id)
       )`,
    );
    await sql.query(
      `CREATE TABLE IF NOT EXISTS webrtc_signals (
         id BIGSERIAL PRIMARY KEY,
         room TEXT NOT NULL,
         to_peer TEXT NOT NULL,
         from_peer TEXT NOT NULL,
         kind TEXT NOT NULL,
         payload JSONB NOT NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );
    await sql.query(
      `CREATE INDEX IF NOT EXISTS webrtc_signals_inbox
         ON webrtc_signals (room, to_peer, id)`,
    );
    await sql.query(
      `CREATE TABLE IF NOT EXISTS nearby_fix (
         peer_id TEXT PRIMARY KEY,
         cell TEXT NOT NULL,
         room TEXT NOT NULL DEFAULT '',
         seen TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );
    await sql.query(`ALTER TABLE nearby_fix ADD COLUMN IF NOT EXISTS room TEXT NOT NULL DEFAULT ''`);
  })().catch((err) => {
    globalRef.__rtcSchemaPromise__ = undefined;
    throw err;
  });
  return globalRef.__rtcSchemaPromise__;
}

async function roster(sql: Sql, room: string): Promise<PeerRow[]> {
  const rows = await sql.query<{ peer_id: string; name: string }>(
    `SELECT peer_id, name FROM webrtc_peers
     WHERE room = $1 AND last_seen > now() - make_interval(secs => $2)
     ORDER BY peer_id LIMIT 32`,
    [room, PEER_TTL_SECONDS],
  );
  return rows.map((r) => ({ id: r.peer_id, name: r.name }));
}

async function touchPeer(sql: Sql, room: string, peer: string, name: string) {
  await sql.query(
    `INSERT INTO webrtc_peers (room, peer_id, name, last_seen)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (room, peer_id)
     DO UPDATE SET last_seen = now(), name = EXCLUDED.name`,
    [room, peer, name],
  );
}

async function prune(sql: Sql) {
  await Promise.all([
    sql.query(`DELETE FROM webrtc_signals WHERE created_at < now() - make_interval(secs => $1)`, [
      SIGNAL_TTL_SECONDS,
    ]),
    sql.query(`DELETE FROM webrtc_peers WHERE last_seen < now() - make_interval(secs => $1)`, [
      PEER_TTL_SECONDS,
    ]),
  ]);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

async function handleGet(url: URL): Promise<Response> {
  const parsed = z
    .object({
      room: ID,
      peer: ID,
      name: z.string().max(64).default(""),
      since: z.coerce.number().int().min(0).default(0),
    })
    .safeParse({
      room: url.searchParams.get("room"),
      peer: url.searchParams.get("peer"),
      name: url.searchParams.get("name") ?? "",
      since: url.searchParams.get("since") ?? 0,
    });
  if (!parsed.success) return json({ error: "invalid query" }, 400);
  const { room, peer, name, since } = parsed.data;

  const sql = await getSql();
  await ensureSchema(sql);
  if (since === 0 || Math.random() < 0.02) await prune(sql);
  await touchPeer(sql, room, peer, name);
  const rows = await sql.query<{
    id: number;
    from_peer: string;
    kind: SignalRow["kind"];
    payload: unknown;
  }>(
    `SELECT id, from_peer, kind, payload FROM webrtc_signals
     WHERE room = $1 AND to_peer = $2 AND id > $3
     ORDER BY id LIMIT 40`,
    [room, peer, since],
  );
  const body: RtcPollResponse = {
    peers: await roster(sql, room),
    signals: [],
  };
  const seen = new Set<number>();
  const add = (r: { id: number; from_peer: string; kind: SignalRow["kind"]; payload: unknown }) => {
    const id = Number(r.id);
    if (seen.has(id)) return;
    seen.add(id);
    body.signals.push({
      id,
      from: r.from_peer,
      kind: r.kind,
      payload: r.payload,
    });
  };
  for (const row of rows) add(row);
  const roomRows = await sql.query<{
    id: number;
    from_peer: string;
    kind: SignalRow["kind"];
    payload: unknown;
  }>(
    `SELECT id, from_peer, kind, payload FROM webrtc_signals
     WHERE room = $1 AND from_peer <> $2 AND kind = 'ctrl' AND id > $3
       AND created_at > now() - make_interval(secs => 30)
       AND octet_length(payload::text) < 6000
     ORDER BY id LIMIT 40`,
    [room, peer, since],
  );
  for (const row of roomRows) add(row);
  body.signals.sort((a, b) => a.id - b.id);
  return json(body);
}

async function handlePost(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid request" }, 400);
  const msg = parsed.data;
  const sql = await getSql();
  await ensureSchema(sql);

  if (msg.op === "signal") {
    await sql.query(
      `INSERT INTO webrtc_signals (room, to_peer, from_peer, kind, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [msg.room, msg.to, msg.from, msg.kind, JSON.stringify(msg.payload)],
    );
  } else {
    await sql.query(`DELETE FROM webrtc_peers WHERE room = $1 AND peer_id = $2`, [
      msg.room,
      msg.peer,
    ]);
  }
  return json({ ok: true });
}

export async function handleSignaling(request: Request): Promise<Response> {
  try {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
    if (request.method === "GET") return await handleGet(new URL(request.url));
    if (request.method === "POST") return await handlePost(request);
    return json({ error: "method not allowed" }, 405);
  } catch (error) {
    console.error("[rtc] signaling error:", error);
    return json({ error: "signaling failed" }, 500);
  }
}

function corsHeaders(): HeadersInit {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "cache-control": "no-store",
  };
}

const ROOM_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Same public address shares one code, so phones on one Wi-Fi can see each other. */
export function roomForAddress(address: string): string {
  const hash = createHash("sha256").update(`flicro-wifi-v1:${address}`).digest();
  let out = "";
  for (let i = 0; i < 6; i += 1) out += ROOM_ALPHABET[hash[i] % ROOM_ALPHABET.length];
  return out;
}

export function clientAddress(request: Request): string {
  const direct =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim();
  if (direct) return normalizeAddress(direct);
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    for (const part of forwarded.split(",")) {
      const address = normalizeAddress(part);
      if (address && !isPrivateAddress(address)) return address;
    }
    const first = normalizeAddress(forwarded.split(",")[0] ?? "");
    if (first) return first;
  }
  return "local";
}

function normalizeAddress(raw: string): string {
  let value = raw.trim().replace(/^"|"$/g, "");
  if (value.startsWith("::ffff:")) value = value.slice(7);
  if (value.startsWith("[") && value.includes("]")) value = value.slice(1, value.indexOf("]"));
  else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(value)) value = value.replace(/:\d+$/, "");
  return value.slice(0, 64);
}

function isPrivateAddress(address: string): boolean {
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    address.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}

export async function handleNearby(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
  // One room for every open Flicro screen. A laptop, an iPhone, and an Android
  // phone do not share a public IP, so an address-based code hides them.
  return json({ room: "nearby", via: "all" });
}

export function publicIpv4(value: string): string | null {
  const ip = value.trim();
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return null;
  if (ip.split(".").some((part) => Number(part) > 255)) return null;
  if (isPrivateAddress(ip)) return null;
  return ip;
}

export async function handleOnline(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
  try {
    const sql = await getSql();
    await ensureSchema(sql);
    const rows = await sql.query<{ peer_id: string; name: string; room: string }>(
      `SELECT peer_id, name, room FROM webrtc_peers
       WHERE last_seen > now() - make_interval(secs => 12)
       ORDER BY last_seen DESC
       LIMIT 20`,
    );
    const devices = rows
      .filter((row) => /^[a-z0-9]{6}$/.test(row.room) && /^[a-zA-Z0-9_-]{1,64}$/.test(row.peer_id))
      .map((row) => ({ id: row.peer_id, name: row.name || "Device", room: row.room }));
    return json({ devices });
  } catch (error) {
    console.error("[online]", error);
    return json({ devices: [] });
  }
}

export function geoCells(lat: number, lon: number): string[] {
  const lat0 = Math.round(lat * 500) / 500;
  const lon0 = Math.round(lon * 500) / 500;
  const cells: string[] = [];
  for (let y = -1; y <= 1; y += 1) {
    for (let x = -1; x <= 1; x += 1) {
      cells.push(`${(lat0 + y * 0.002).toFixed(3)},${(lon0 + x * 0.002).toFixed(3)}`);
    }
  }
  return cells;
}
