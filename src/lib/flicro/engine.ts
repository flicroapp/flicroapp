import { P2PRoom, type P2PRoomOptions, type PeerInfo } from "@/lib/multiplayer";
import { loadPhoto } from "./storage";
import type { HistoryEntry, HistoryFile } from "./storage";
import { ACTIVE_TRANSPORT } from "./transport";
import {
  MAX_FILE_BYTES,
  MAX_FILES,
  MEMORY_SINK_MAX,
  NORMAL_CHUNK,
  NORMAL_WINDOW,
  PRO_CHUNK,
  PRO_WINDOW,
  baseName,
  folderName,
  formatBytes,
  uid,
} from "./format";

export type FileProgress = {
  id: string;
  name: string;
  size: number;
  done: number;
};

export type TransferStatus =
  | "awaiting"
  | "offered"
  | "receiving"
  | "sending"
  | "paused"
  | "done"
  | "declined"
  | "failed"
  | "cancelled";

export type Outgoing = {
  transferId: string;
  peerId: string;
  peerName: string;
  status: TransferStatus;
  error: string;
  files: FileProgress[];
  startedAt: number | null;
  pro: boolean;
};

export type Incoming = {
  transferId: string;
  peerId: string;
  peerName: string;
  status: TransferStatus;
  error: string;
  files: FileProgress[];
  startedAt: number | null;
  pro: boolean;
};

export type DownloadReady = {
  id: string;
  name: string;
  size: number;
  blob: Blob;
  opfsName: string | null;
};

export type Snap = {
  joined: boolean;
  peers: PeerInfo[];
  live: string[];
  paired: string[];
  outgoing: Outgoing | null;
  incoming: Incoming | null;
};

type OfferFile = { id: string; name: string; size: number; mime: string };

type Msg =
  | { v: 1; type: "hello"; photo?: string }
  | { v: 1; type: "link" }
  | { v: 1; type: "linked" }
  | { v: 1; type: "offer"; transferId: string; files: OfferFile[]; chunk: number; pro: boolean }
  | { v: 1; type: "decision"; transferId: string; accept: boolean }
  | { v: 1; type: "busy"; transferId: string }
  | { v: 1; type: "cancel"; transferId: string }
  | { v: 1; type: "ack"; transferId: string; fileId: string; i: number }
  | { v: 1; type: "file-done"; transferId: string; fileId: string };

type BinChunk = { type: "chunk"; transferId: string; fileId: string; i: number; bytes: Uint8Array };

type Sink = {
  opfsName: string | null;
  write: (bytes: Uint8Array) => Promise<void>;
  finish: (mime: string) => Promise<Blob>;
  abort: () => Promise<void>;
};

const MAX_CHUNK_INDEX = 2_000_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function terminal(status: TransferStatus): boolean {
  return status === "done" || status === "declined" || status === "failed" || status === "cancelled";
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function parseMsg(data: unknown): Msg | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (o.v !== 1 || typeof o.type !== "string") return null;
  const transferId = typeof o.transferId === "string" ? o.transferId.slice(0, 64) : "";
  switch (o.type) {
    case "hello": {
      const photo = typeof o.photo === "string" && o.photo.startsWith("data:image/") && o.photo.length <= 24_000 ? o.photo : "";
      return photo ? { v: 1, type: "hello", photo } : { v: 1, type: "hello" };
    }
    case "link":
      return { v: 1, type: "link" };
    case "linked":
      return { v: 1, type: "linked" };
    case "offer": {
      if (!transferId || !Array.isArray(o.files)) return null;
      const chunk = o.chunk === NORMAL_CHUNK || o.chunk === PRO_CHUNK ? o.chunk : 0;
      if (!chunk) return null;
      const files: OfferFile[] = [];
      for (const item of o.files) {
        if (!item || typeof item !== "object") return null;
        const f = item as Record<string, unknown>;
        if (
          typeof f.id !== "string" ||
          typeof f.name !== "string" ||
          typeof f.size !== "number" ||
          typeof f.mime !== "string"
        ) {
          return null;
        }
        if (!Number.isFinite(f.size) || f.size < 0 || f.size > MAX_FILE_BYTES) return null;
        files.push({
          id: f.id.slice(0, 64),
          name: folderName(f.name),
          size: Math.floor(f.size),
          mime: f.mime.slice(0, 120),
        });
      }
      if (!files.length || files.length > MAX_FILES) return null;
      return { v: 1, type: "offer", transferId, files, chunk, pro: o.pro === true };
    }
    case "decision":
      if (!transferId || typeof o.accept !== "boolean") return null;
      return { v: 1, type: "decision", transferId, accept: o.accept };
    case "busy":
      if (!transferId) return null;
      return { v: 1, type: "busy", transferId };
    case "cancel":
      if (!transferId) return null;
      return { v: 1, type: "cancel", transferId };
    case "ack":
      if (!transferId || typeof o.fileId !== "string" || typeof o.i !== "number" || !Number.isInteger(o.i)) {
        return null;
      }
      return { v: 1, type: "ack", transferId, fileId: o.fileId.slice(0, 64), i: o.i };
    case "file-done":
      if (!transferId || typeof o.fileId !== "string") return null;
      return { v: 1, type: "file-done", transferId, fileId: o.fileId.slice(0, 64) };
    default:
      return null;
  }
}

async function createSink(fileId: string, name: string, size: number): Promise<Sink> {
  const opfsName = `${fileId.slice(0, 8)}-${name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60)}`;
  const memory = (): Sink => {
    const parts: BlobPart[] = [];
    return {
      opfsName: null,
      write: async (bytes) => {
        parts.push(bytes.slice());
      },
      finish: async (mime) => new Blob(parts, { type: mime || "application/octet-stream" }),
      abort: async () => {
        parts.length = 0;
      },
    };
  };
  // iPhone private-file storage can hang forever on the first write, which
  // leaves both devices at 0%. Photos fit in memory, so use that path.
  if (size <= 64 * 1024 * 1024) return memory();
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(opfsName, { create: true });
    const writable = await handle.createWritable();
    return {
      opfsName,
      write: async (bytes) => {
        await writable.write(bytes as BufferSource);
      },
      finish: async () => {
        await writable.close();
        return handle.getFile();
      },
      abort: async () => {
        await writable.abort();
      },
    };
  } catch {
    if (size > MEMORY_SINK_MAX) {
      throw new Error("This browser can't hold a file this large. Use Safari or Chrome, then accept again.");
    }
    return memory();
  }
}

function encodeChunk(transferId: string, fileId: string, index: number, bytes: Uint8Array): Uint8Array {
  const t = encoder.encode(transferId);
  const f = encoder.encode(fileId);
  const out = new Uint8Array(7 + t.length + f.length + bytes.length);
  const view = new DataView(out.buffer);
  out[0] = 0x56;
  view.setUint32(1, index);
  out[5] = t.length;
  out[6] = f.length;
  out.set(t, 7);
  out.set(f, 7 + t.length);
  out.set(bytes, 7 + t.length + f.length);
  return out;
}

function decodeChunk(buf: ArrayBuffer): BinChunk | null {
  if (buf.byteLength < 7) return null;
  const bytes = new Uint8Array(buf);
  if (bytes[0] !== 0x56) return null;
  const index = new DataView(buf).getUint32(1);
  const tLen = bytes[5] ?? 0;
  const fLen = bytes[6] ?? 0;
  if (tLen < 8 || tLen > 64 || fLen < 8 || fLen > 64) return null;
  const start = 7;
  if (buf.byteLength < start + tLen + fLen) return null;
  if (index > MAX_CHUNK_INDEX) return null;
  const payload = bytes.subarray(start + tLen + fLen);
  if (payload.length > 256 * 1024) return null;
  return {
    type: "chunk",
    transferId: decoder.decode(bytes.subarray(start, start + tLen)),
    fileId: decoder.decode(bytes.subarray(start + tLen, start + tLen + fLen)),
    i: index,
    bytes: payload,
  };
}

function pieceLength(size: number, index: number, chunk: number): number | null {
  if (size === 0 || chunk <= 0) return null;
  const full = Math.floor(size / chunk);
  const rem = size % chunk;
  const total = rem === 0 ? full : full + 1;
  if (index < 0 || index >= total) return null;
  if (index === total - 1 && rem !== 0) return rem;
  return chunk;
}

function readPiece(blob: Blob, index: number, chunk: number): Promise<Uint8Array> {
  const start = index * chunk;
  return blob
    .slice(start, Math.min(blob.size, start + chunk))
    .arrayBuffer()
    .then((buf) => new Uint8Array(buf));
}

export class FlicroSession {
  private p2p: P2PRoom;
  private opts: { room: string; selfId: string; name: string };
  private onDownload: (file: DownloadReady) => void;
  private onHistory: (entry: HistoryEntry) => void;
  private onChange: (snap: Snap) => void;
  private helloTimer = 0;
  private hailedAt = new Map<string, number>();
  private offerTimer = 0;
  private emitTimer = 0;
  private token = 0;
  private closed = false;
  private joined = false;
  private peers: PeerInfo[] = [];
  private live = new Set<string>();
  private photos = new Map<string, string>();
  private photoSent = new Map<string, string>();
  private outgoing: Outgoing | null = null;
  private incoming: Incoming | null = null;
  private files = new Map<string, File>();
  private mimes = new Map<string, string>();
  private acks = new Map<string, number>();
  private decision: { transferId: string; accept: boolean } | null = null;
  private sinks = new Map<string, Sink>();
  private expected = new Map<string, number>();
  private got = new Map<string, number>();
  private heldPieces = new Map<string, Map<number, Uint8Array>>();
  private pendingDone = new Set<string>();
  private writeChain: Promise<void> = Promise.resolve();
  private sinksReady = false;
  private queued: Array<BinChunk | Extract<Msg, { type: "file-done" }>> = [];
  private finished = new Set<string>();
  private seenTransfers = new Set<string>();
  private paired = new Set<string>();
  private recorded = false;
  private recvGen = 0;
  private pipeChunk = NORMAL_CHUNK;
  private pipeWindow = NORMAL_WINDOW;
  private pipePro = false;
  private recvChunk = NORMAL_CHUNK;
  private hold = false;
  private decisionPump = 0;
  private link: P2PRoomOptions;
  readonly transport = ACTIVE_TRANSPORT;

  constructor(args: {
    room: string;
    selfId: string;
    name: string;
    signalBase?: string;
    onDownload: (file: DownloadReady) => void;
    onHistory: (entry: HistoryEntry) => void;
    onChange: (snap: Snap) => void;
  }) {
    this.opts = { room: args.room, selfId: args.selfId, name: args.name.slice(0, 64) };
    this.onDownload = args.onDownload;
    this.onHistory = args.onHistory;
    this.onChange = args.onChange;
    this.link = {
      room: args.room,
      selfId: args.selfId,
      name: this.opts.name,
      signalBase: args.signalBase || "",
      onPeersChanged: (peers) => this.onPeers(peers),
      onMessage: (from, data) => this.onMessage(from, data),
      onBinary: (from, data) => this.onBinary(from, data),
      onConnected: () => {
        this.joined = true;
        this.emit();
      },
    };
    this.p2p = new P2PRoom(this.link);
    void this.p2p.join();
    this.helloTimer = window.setInterval(() => this.sayHello(), 400);
    this.emit();
  }

  setName(name: string) {
    this.opts.name = name.trim().slice(0, 64) || "Device";
    this.link.name = this.opts.name;
  }

  snapshot(): Snap {
    return {
      joined: this.joined,
      peers: this.peers.map((p) => ({ ...p })),
      live: [...this.live],
      paired: [...this.paired],
      outgoing: this.outgoing ? { ...this.outgoing, files: this.outgoing.files.map((f) => ({ ...f })) } : null,
      incoming: this.incoming ? { ...this.incoming, files: this.incoming.files.map((f) => ({ ...f })) } : null,
    };
  }

  requestLink(peerId: string) {
    const msg = { v: 1 as const, type: "link" as const };
    let n = 0;
    const tick = () => {
      if (this.closed || this.paired.has(peerId) || n > 10) return;
      n += 1;
      this.p2p.sendControl(msg, peerId);
      window.setTimeout(tick, 1500);
    };
    tick();
  }

  send(list: File[], peerId: string, pro = false): string | null {
    if (!list.length) return "Choose a file first.";
    if (list.length > MAX_FILES) return `You can send up to ${MAX_FILES} files at once.`;
    if (this.incoming && !terminal(this.incoming.status)) return "Finish the incoming transfer first.";
    if (this.outgoing && !terminal(this.outgoing.status)) return "A transfer is already running.";
    const peer = this.peers.find((p) => p.id === peerId);
    if (!peer) return "That device is not on this code.";
    const transferId = uid();
    const progress: FileProgress[] = list.map((file) => {
      const id = uid();
      this.files.set(id, file);
      return { id, name: folderName(file.webkitRelativePath || file.name), size: file.size, done: 0 };
    });
    this.token += 1;
    const token = this.token;
    this.recorded = false;
    this.decision = null;
    this.pipePro = pro;
    this.pipeChunk = pro ? PRO_CHUNK : NORMAL_CHUNK;
    this.pipeWindow = pro ? PRO_WINDOW : NORMAL_WINDOW;
    this.outgoing = {
      transferId,
      peerId,
      peerName: peer.name || "Device",
      status: "awaiting",
      error: "",
      files: progress,
      startedAt: null,
      pro,
    };
    this.p2p.pin(peerId);
    this.incoming = null;
    this.emit();
    const payload = {
      v: 1 as const,
      type: "offer" as const,
      transferId,
      pro,
      chunk: this.pipeChunk,
      files: progress.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        mime: this.files.get(f.id)?.type || "application/octet-stream",
      })),
    };
    this.stopOfferLoop();
    const tick = () => {
      if (this.closed || this.token !== token) return;
      if (this.decision?.transferId === transferId) return;
      this.p2p.send(payload, peerId);
      this.p2p.sendControl(payload, peerId);
    };
    tick();
    this.offerTimer = window.setInterval(tick, 350);
    void this.runSend(transferId, peerId, token);
    return null;
  }

  accept() {
    if (!this.incoming || this.incoming.status !== "offered") return;
    if (this.incoming.transferId.startsWith("link:")) {
      const peerId = this.incoming.peerId;
      this.paired.add(peerId);
      this.live.add(peerId);
      this.p2p.sendControl({ v: 1, type: "linked" }, peerId);
      this.incoming = null;
      this.emit();
      return;
    }
    this.incoming = { ...this.incoming, status: "receiving", startedAt: Date.now(), error: "" };
    const peerId = this.incoming.peerId;
    const transferId = this.incoming.transferId;
    const decisionMsg = { v: 1 as const, type: "decision" as const, transferId, accept: true };
    this.sinksReady = false;
    this.emit();
    if (this.decisionPump) window.clearInterval(this.decisionPump);
    const pump = () => {
      if (this.closed || this.incoming?.transferId !== transferId || this.incoming.status !== "receiving") {
        if (this.decisionPump) window.clearInterval(this.decisionPump);
        this.decisionPump = 0;
        return;
      }
      if ([...this.got.values()].some((n) => n > 0)) {
        window.clearInterval(this.decisionPump);
        this.decisionPump = 0;
        return;
      }
      this.p2p.send(decisionMsg, peerId);
      this.p2p.sendControl(decisionMsg, peerId);
    };
    pump();
    this.decisionPump = window.setInterval(pump, 400);
    void this.prepareSinks();
  }

  decline() {
    if (!this.incoming || this.incoming.status !== "offered") return;
    if (this.incoming.transferId.startsWith("link:")) {
      this.incoming = null;
      this.emit();
      return;
    }
    const current = this.incoming;
    const declineMsg = { v: 1 as const, type: "decision" as const, transferId: current.transferId, accept: false };
    this.p2p.send(declineMsg, current.peerId);
    this.p2p.sendControl(declineMsg, current.peerId);
    this.incoming = { ...current, status: "declined", error: "You declined." };
    this.p2p.unpin(current.peerId);
    this.record("received", "declined", "Declined");
    this.emit();
  }

  cancel() {
    const active = this.outgoing && !terminal(this.outgoing.status) ? this.outgoing : null;
    const incoming = this.incoming && !terminal(this.incoming.status) ? this.incoming : null;
    const current = active ?? incoming;
    if (!current) return;
    this.hold = false;
    this.token += 1;
    this.stopOfferLoop();
    const cancelMsg = { v: 1 as const, type: "cancel" as const, transferId: current.transferId };
    this.p2p.send(cancelMsg, current.peerId);
    this.p2p.sendControl(cancelMsg, current.peerId);
    this.p2p.unpin(current.peerId);
    if (active) this.outgoing = { ...active, status: "cancelled", error: "You cancelled." };
    if (incoming) {
      this.incoming = { ...incoming, status: "cancelled", error: "You cancelled." };
      this.recvGen += 1;
    }
    this.record(active ? "sent" : "received", "cancelled", "Cancelled");
    void this.abortSinks();
    this.emit();
  }

  pause() {
    if (!this.outgoing || this.outgoing.status !== "sending") return;
    this.hold = true;
    this.outgoing = { ...this.outgoing, status: "paused" };
    this.emit();
  }

  resume() {
    if (!this.outgoing || this.outgoing.status !== "paused") return;
    this.hold = false;
    this.outgoing = { ...this.outgoing, status: "sending" };
    this.emit();
  }

  retry(): string | null {
    const current = this.outgoing;
    if (!current || current.status !== "failed") return "Nothing failed to retry.";
    const list: File[] = [];
    for (const file of current.files) {
      const blob = this.files.get(file.id);
      if (blob) list.push(blob);
    }
    if (!list.length) return "Those files are no longer on this device.";
    const peerId = current.peerId;
    const pro = current.pro;
    this.outgoing = null;
    this.recorded = false;
    this.hold = false;
    return this.send(list, peerId, pro);
  }

  dismiss() {
    if (this.outgoing && terminal(this.outgoing.status)) this.outgoing = null;
    if (this.incoming && terminal(this.incoming.status)) this.incoming = null;
    this.emit();
  }

  close() {
    this.closed = true;
    this.token += 1;
    this.stopOfferLoop();
    if (this.decisionPump) window.clearInterval(this.decisionPump);
    if (this.helloTimer) window.clearInterval(this.helloTimer);
    if (this.emitTimer) window.clearTimeout(this.emitTimer);
    void this.abortSinks();
    this.p2p.close();
  }

  private async prepareSinks() {
    const incoming = this.incoming;
    const gen = this.recvGen;
    if (!incoming) return;
    try {
      for (const file of incoming.files) {
        if (gen !== this.recvGen) return;
        this.mimes.set(file.id, this.mimes.get(file.id) || "application/octet-stream");
        this.sinks.set(file.id, await createSink(file.id, file.name, file.size));
        this.expected.set(file.id, 0);
        this.got.set(file.id, 0);
      }
      if (gen !== this.recvGen) return;
      this.sinksReady = true;
      const queued = this.queued;
      this.queued = [];
      for (const msg of queued) this.enqueue(msg, gen);
    } catch {
      if (gen === this.recvGen) this.failIncoming("This browser couldn't open a place to store the file.");
    }
  }

  private sayHello() {
    if (this.closed) return;
    const photo = loadPhoto();
    for (const peer of this.peers) {
      const hello: { v: 1; type: "hello"; photo?: string } = { v: 1, type: "hello" };
      if (photo && this.photoSent.get(peer.id) !== photo) {
        hello.photo = photo;
        this.photoSent.set(peer.id, photo);
      }
      if (this.live.has(peer.id) && !hello.photo) continue;
      const last = this.hailedAt.get(peer.id) ?? 0;
      if (Date.now() - last > 300) {
        this.hailedAt.set(peer.id, Date.now());
        this.p2p.sendControl(hello, peer.id);
      }
      if (peer.channelOpen || peer.connectionState === "connected") this.p2p.send(hello, peer.id);
    }
  }

  private onPeers(peers: PeerInfo[]) {
    this.peers = peers
      .filter((p) => p.id !== this.opts.selfId)
      .map((peer) => ({ ...peer, photo: this.photos.get(peer.id) || peer.photo }));
    const ids = new Set(this.peers.map((p) => p.id));
    for (const id of [...this.live]) if (!ids.has(id)) this.live.delete(id);
    for (const peer of this.peers) {
      if (this.outgoing?.peerId === peer.id) this.outgoing = { ...this.outgoing, peerName: peer.name || "Device" };
      if (this.incoming?.peerId === peer.id) this.incoming = { ...this.incoming, peerName: peer.name || "Device" };
    }
    if (this.outgoing && !terminal(this.outgoing.status) && !ids.has(this.outgoing.peerId)) {
      this.sayHello();
      this.emit();
      return;
    }
    if (this.incoming && !terminal(this.incoming.status) && !ids.has(this.incoming.peerId) && !this.incoming.transferId.startsWith("link:")) {
      this.sayHello();
      this.emit();
      return;
    }
    this.sayHello();
    this.emit();
  }

  private onMessage(from: string, data: unknown) {
    const msg = parseMsg(data);
    if (!msg) return;
    if (msg.type === "hello") {
      if (msg.photo) {
        this.photos.set(from, msg.photo);
        const peer = this.peers.find((item) => item.id === from);
        if (peer) peer.photo = msg.photo;
      }
      const known = this.live.has(from);
      this.live.add(from);
      if (!known) this.p2p.send({ v: 1, type: "hello" }, from);
      this.emit();
      return;
    }
    if (msg.type === "link") {
      if (this.paired.has(from)) {
        this.live.add(from);
        this.p2p.sendControl({ v: 1, type: "linked" }, from);
        this.emit();
        return;
      }
      if (this.incoming && !terminal(this.incoming.status) && !this.incoming.transferId.startsWith("link:")) return;
      if (this.outgoing && !terminal(this.outgoing.status)) return;
      if (this.incoming?.transferId === `link:${from}` && this.incoming.status === "offered") return;
      const peer = this.peers.find((item) => item.id === from);
      this.incoming = {
        transferId: `link:${from}`,
        peerId: from,
        peerName: peer?.name || "Device",
        status: "offered",
        error: "",
        startedAt: null,
        pro: false,
        files: [],
      };
      this.emit();
      return;
    }
    if (msg.type === "linked") {
      this.paired.add(from);
      this.live.add(from);
      this.emit();
      return;
    }
    if (msg.type === "offer") {
      this.onOffer(from, msg);
      return;
    }
    if (msg.type === "decision") {
      if (this.outgoing?.transferId === msg.transferId && this.outgoing.status === "awaiting") {
        this.decision = { transferId: msg.transferId, accept: msg.accept };
        this.stopOfferLoop();
      }
      return;
    }
    if (msg.type === "busy") {
      if (this.outgoing?.transferId === msg.transferId && this.outgoing.status === "awaiting") {
        this.stopOfferLoop();
        this.failOutgoing("They are busy with another transfer.");
      }
      return;
    }
    if (msg.type === "cancel") {
      if (this.outgoing?.transferId === msg.transferId && !terminal(this.outgoing.status)) {
        this.token += 1;
        this.stopOfferLoop();
        this.outgoing = { ...this.outgoing, status: "cancelled", error: "They cancelled." };
        this.record("sent", "cancelled", "They cancelled");
        this.emit();
      }
      if (this.incoming?.transferId === msg.transferId && !terminal(this.incoming.status)) {
        this.incoming = { ...this.incoming, status: "cancelled", error: "They cancelled." };
        this.recvGen += 1;
        this.record("received", "cancelled", "They cancelled");
        void this.abortSinks();
        this.emit();
      }
      return;
    }
    if (msg.type === "ack") {
      if (this.outgoing?.transferId !== msg.transferId) return;
      const prev = this.acks.get(msg.fileId) ?? -1;
      if (msg.i > prev) this.acks.set(msg.fileId, msg.i);
      const file = this.outgoing.files.find((f) => f.id === msg.fileId);
      if (file) file.done = Math.min(file.size, (msg.i + 1) * this.pipeChunk);
      this.emitSoon();
      return;
    }
    if (msg.type === "file-done") {
      if (this.incoming?.transferId !== msg.transferId || this.incoming.status !== "receiving") return;
      if (!this.sinksReady) {
        this.queued.push(msg);
        return;
      }
      this.enqueue(msg, this.recvGen);
    }
  }

  private onBinary(from: string, data: ArrayBuffer) {
    const msg = decodeChunk(data);
    if (!msg) return;
    if (from !== this.incoming?.peerId) return;
    if (this.incoming.transferId !== msg.transferId || this.incoming.status !== "receiving") return;
    if (!this.sinksReady) {
      this.queued.push(msg);
      return;
    }
    this.enqueue(msg, this.recvGen);
  }

  private onOffer(from: string, msg: Extract<Msg, { type: "offer" }>) {
    if (this.seenTransfers.has(msg.transferId)) return;
    const busy =
      (this.outgoing && !terminal(this.outgoing.status)) ||
      (this.incoming && !terminal(this.incoming.status));
    const linkOnly = this.incoming?.transferId.startsWith("link:") && this.incoming.status === "offered";
    const sameSender =
      this.incoming &&
      !terminal(this.incoming.status) &&
      this.incoming.peerId === from &&
      !this.incoming.transferId.startsWith("link:");
    if (busy && !linkOnly && !sameSender) {
      this.p2p.send({ v: 1, type: "busy", transferId: msg.transferId }, from);
      return;
    }
    this.seenTransfers.add(msg.transferId);
    this.recvGen += 1;
    this.sinksReady = false;
    this.queued = [];
    this.sinks = new Map();
    this.expected = new Map();
    this.got = new Map();
    this.heldPieces = new Map();
    this.pendingDone = new Set();
    this.finished = new Set();
    this.writeChain = Promise.resolve();
    const peer = this.peers.find((p) => p.id === from);
    this.mimes.clear();
    for (const file of msg.files) this.mimes.set(file.id, file.mime);
    this.recorded = false;
    this.recvChunk = msg.chunk;
    this.incoming = {
      transferId: msg.transferId,
      peerId: from,
      peerName: peer?.name || "Device",
      status: "offered",
      error: "",
      startedAt: null,
      pro: msg.pro,
      files: msg.files.map((f) => ({ id: f.id, name: f.name, size: f.size, done: 0 })),
    };
    this.p2p.pin(from);
    this.emit();
  }

  private enqueue(msg: BinChunk | Extract<Msg, { type: "file-done" }>, gen: number) {
    this.writeChain = this.writeChain
      .then(async () => {
        if (gen !== this.recvGen) return;
        if (msg.type === "chunk") await this.applyChunk(msg);
        else await this.applyDone(msg);
      })
      .catch(() => {
        if (gen !== this.recvGen) return;
        this.failIncoming("The file could not be saved on this device.");
      });
  }

  private async applyChunk(msg: BinChunk) {
    const incoming = this.incoming;
    if (!incoming || incoming.transferId !== msg.transferId || terminal(incoming.status)) return;
    const file = incoming.files.find((f) => f.id === msg.fileId);
    const sink = this.sinks.get(msg.fileId);
    if (!file || !sink) return;
    const expect = this.expected.get(msg.fileId) ?? 0;
    if (msg.i < expect) {
      this.p2p.send({ v: 1, type: "ack", transferId: msg.transferId, fileId: msg.fileId, i: msg.i }, incoming.peerId);
      return;
    }
    const needed = pieceLength(file.size, msg.i, this.recvChunk);
    if (needed === null || msg.bytes.length !== needed) {
      this.failIncoming("A piece of the file was the wrong size.");
      return;
    }
    if (msg.i !== expect) {
      let bag = this.heldPieces.get(msg.fileId);
      if (!bag) {
        bag = new Map();
        this.heldPieces.set(msg.fileId, bag);
      }
      if (!bag.has(msg.i)) bag.set(msg.i, msg.bytes.slice());
      return;
    }
    await this.writePiece(incoming, file, sink, msg.i, msg.bytes);
    await this.drainHeld(incoming, file, sink);
  }

  private async writePiece(incoming: Incoming, file: FileProgress, sink: Sink, index: number, bytes: Uint8Array) {
    await sink.write(bytes.slice());
    const got = (this.got.get(file.id) ?? 0) + bytes.length;
    this.got.set(file.id, got);
    this.expected.set(file.id, index + 1);
    file.done = Math.min(file.size, got);
    this.p2p.send({ v: 1, type: "ack", transferId: incoming.transferId, fileId: file.id, i: index }, incoming.peerId);
    this.emitSoon();
  }

  private async drainHeld(incoming: Incoming, file: FileProgress, sink: Sink) {
    const bag = this.heldPieces.get(file.id);
    if (bag) {
      let expect = this.expected.get(file.id) ?? 0;
      while (bag.has(expect)) {
        const bytes = bag.get(expect)!;
        bag.delete(expect);
        await this.writePiece(incoming, file, sink, expect, bytes);
        expect = this.expected.get(file.id) ?? 0;
      }
    }
    if (this.pendingDone.has(file.id) && (this.got.get(file.id) ?? 0) === file.size) {
      this.pendingDone.delete(file.id);
      await this.finishFile(incoming, file, sink);
    }
  }

  private async finishFile(incoming: Incoming, file: FileProgress, sink: Sink) {
    if (this.finished.has(file.id)) return;
    const blob = await sink.finish(this.mimes.get(file.id) || "");
    this.finished.add(file.id);
    file.done = file.size;
    this.onDownload({
      id: file.id,
      name: file.name,
      size: file.size,
      blob,
      opfsName: sink.opfsName,
    });
    if (incoming.files.every((f) => this.finished.has(f.id))) {
      this.p2p.unpin(incoming.peerId);
      this.incoming = { ...incoming, status: "done", error: "" };
      this.record("received", "received", "Received");
    }
    this.emit();
  }

  private async applyDone(msg: Extract<Msg, { type: "file-done" }>) {
    const incoming = this.incoming;
    if (!incoming || incoming.transferId !== msg.transferId || this.finished.has(msg.fileId)) return;
    const file = incoming.files.find((f) => f.id === msg.fileId);
    const sink = this.sinks.get(msg.fileId);
    if (!file || !sink) return;
    const got = this.got.get(msg.fileId) ?? 0;
    if (got !== file.size) {
      this.pendingDone.add(msg.fileId);
      return;
    }
    await this.finishFile(incoming, file, sink);
  }

  private async runSend(transferId: string, peerId: string, token: number) {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (this.closed || this.token !== token) return;
      if (this.decision?.transferId === transferId) break;
      await sleep(200);
    }
    if (this.token !== token) return;
    if (!this.decision || this.decision.transferId !== transferId) {
      this.stopOfferLoop();
      this.failOutgoing("They didn't answer.");
      return;
    }
    if (!this.decision.accept) {
      if (this.outgoing) {
        this.p2p.unpin(this.outgoing.peerId);
        this.outgoing = { ...this.outgoing, status: "declined", error: "They declined." };
      }
      this.record("sent", "declined", "They declined");
      this.emit();
      return;
    }
    if (this.outgoing) this.outgoing = { ...this.outgoing, status: "sending", startedAt: Date.now() };
    this.emit();
    const files = this.outgoing?.files ?? [];
    const chunk = this.pipeChunk;
    const windowSize = this.pipeWindow;
    const pro = this.pipePro;
    try {
      for (const file of files) {
        const blob = this.files.get(file.id);
        if (!blob) throw new Error("That file is no longer available.");
        const total = Math.ceil(blob.size / chunk);
        let ahead: Promise<Uint8Array> | null = total > 0 ? readPiece(blob, 0, chunk) : null;
        for (let i = 0; i < total; i += 1) {
          if (this.token !== token) return;
          await this.waitWhileHeld(token);
          if (this.token !== token) return;
          await this.waitOrResend(blob, transferId, file.id, i - windowSize, chunk, peerId, token);
          await this.waitBuffer(peerId, token);
          await this.waitWhileHeld(token);
          if (this.token !== token) return;
          const bytes = await (ahead ?? readPiece(blob, i, chunk));
          ahead = i + 1 < total ? readPiece(blob, i + 1, chunk) : null;
          try {
            this.p2p.sendBinary(encodeChunk(transferId, file.id, i, bytes), peerId);
          } catch {
            throw new Error(
              pro
                ? "Pro pieces are too big for this browser. Turn Pro off and send again."
                : "The link could not send a piece of the file.",
            );
          }
        }
        if (total > 0) await this.waitOrResend(blob, transferId, file.id, total - 1, chunk, peerId, token);
        if (this.token !== token) return;
        this.p2p.send({ v: 1, type: "file-done", transferId, fileId: file.id }, peerId);
        file.done = file.size;
        this.emit();
      }
      if (this.outgoing) this.outgoing = { ...this.outgoing, status: "done", error: "" };
      if (this.outgoing) this.p2p.unpin(this.outgoing.peerId);
      this.record("sent", "delivered", "Delivered");
      this.emit();
    } catch (error) {
      if (this.token !== token) return;
      const message = error instanceof Error ? error.message : "The transfer stopped.";
      this.failOutgoing(message);
    }
  }

  private async waitOrResend(
    blob: Blob,
    transferId: string,
    fileId: string,
    target: number,
    chunk: number,
    peerId: string,
    token: number,
  ) {
    if (target < 0) return;
    try {
      await this.waitAck(fileId, target, token, 12_000);
      return;
    } catch {
      if (this.token !== token) return;
    }
    let guard = 0;
    while ((this.acks.get(fileId) ?? -1) < target && guard < 8) {
      if (this.token !== token) return;
      const missing = (this.acks.get(fileId) ?? -1) + 1;
      const again = await readPiece(blob, missing, chunk);
      this.p2p.sendBinary(encodeChunk(transferId, fileId, missing, again), peerId);
      guard += 1;
      try {
        await this.waitAck(fileId, target, token, 12_000);
        return;
      } catch {
        if (this.token !== token) return;
      }
    }
    if ((this.acks.get(fileId) ?? -1) < target) {
      throw new Error("The link stalled before the file finished.");
    }
  }

  private waitAck(fileId: string, target: number, token: number, timeoutMs = 45_000): Promise<void> {
    if (target < 0 || (this.acks.get(fileId) ?? -1) >= target) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let started = Date.now();
      let last = this.acks.get(fileId) ?? -1;
      const timer = window.setInterval(() => {
        if (this.token !== token) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (this.hold) {
          started = Date.now();
          return;
        }
        const got = this.acks.get(fileId) ?? -1;
        if (got !== last) {
          last = got;
          started = Date.now();
        }
        if (got >= target) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (Date.now() - started > timeoutMs) {
          window.clearInterval(timer);
          reject(new Error("The link stalled before the file finished."));
        }
      }, this.pipePro ? 12 : 30);
    });
  }

  private async waitWhileHeld(token: number) {
    while (this.hold) {
      if (this.closed || this.token !== token) return;
      await sleep(80);
    }
  }

  private async waitBuffer(peerId: string, token: number) {
    const cap = this.pipePro ? 8 * 1024 * 1024 : 192 * 1024;
    const started = Date.now();
    while (this.p2p.bufferedAmount(peerId) > cap) {
      if (this.token !== token) return;
      if (Date.now() - started > 45_000) throw new Error("The link stalled before the file finished.");
      await sleep(this.pipePro ? 8 : 20);
    }
  }

  private failOutgoing(message: string) {
    this.stopOfferLoop();
    if (!this.outgoing || terminal(this.outgoing.status)) return;
    this.p2p.unpin(this.outgoing.peerId);
    this.token += 1;
    this.outgoing = { ...this.outgoing, status: "failed", error: message };
    this.record("sent", "failed", message);
    this.emit();
  }

  private failIncoming(message: string) {
    if (!this.incoming || terminal(this.incoming.status)) return;
    this.p2p.unpin(this.incoming.peerId);
    const peerId = this.incoming.peerId;
    const transferId = this.incoming.transferId;
    this.incoming = { ...this.incoming, status: "failed", error: message };
    this.recvGen += 1;
    this.record("received", "failed", message);
    this.p2p.send({ v: 1, type: "cancel", transferId }, peerId);
    void this.abortSinks();
    this.emit();
  }

  private record(direction: "sent" | "received", status: HistoryEntry["status"], detail: string) {
    if (this.recorded) return;
    const current = direction === "sent" ? this.outgoing : this.incoming;
    if (!current) return;
    this.recorded = true;
    const files: HistoryFile[] = current.files.map((file) => ({
      name: file.name,
      size: file.size,
      opfsName: direction === "received" ? (this.sinks.get(file.id)?.opfsName ?? null) : null,
    }));
    this.onHistory({
      id: current.transferId,
      at: Date.now(),
      direction,
      peer: current.peerName,
      status,
      detail,
      files,
    });
  }

  private async abortSinks() {
    const sinks = [...this.sinks.values()];
    this.sinks.clear();
    await Promise.all(sinks.map((sink) => sink.abort().catch(() => {})));
  }

  private stopOfferLoop() {
    if (this.offerTimer) window.clearInterval(this.offerTimer);
    this.offerTimer = 0;
  }

  private emit() {
    if (this.emitTimer) {
      window.clearTimeout(this.emitTimer);
      this.emitTimer = 0;
    }
    if (!this.closed) this.onChange(this.snapshot());
  }

  private emitSoon() {
    if (this.emitTimer || this.closed) return;
    this.emitTimer = window.setTimeout(() => {
      this.emitTimer = 0;
      if (!this.closed) this.onChange(this.snapshot());
    }, 80);
  }
}
