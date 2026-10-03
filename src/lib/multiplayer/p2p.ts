/**
 * Full-mesh WebRTC rooms: one RTCPeerConnection per remote peer, signaled
 * through /api/rtc (see signaling.server.ts), game data flowing directly
 * browser-to-browser afterwards. Client-authoritative by construction — see
 * the multiplayer-p2p skill for when NOT to use this.
 *
 * Negotiation follows the "perfect negotiation" pattern: on a glare (both
 * sides offering at once) the polite peer — the lexicographically smaller id —
 * rolls back and accepts, so pairs converge without wedging.
 */

export type SignalKind = "offer" | "answer" | "ice" | "ctrl";

/**
 * Wire contract between this client and the signaling relay the app provides
 * at /api/rtc (see the multiplayer-p2p skill for a reference implementation).
 * The client only needs these shapes — the relay's storage is the app's choice.
 */
export interface PeerRow {
  id: string;
  name: string;
}
export interface SignalRow {
  id: number;
  from: string;
  kind: SignalKind;
  payload: unknown;
}
export interface RtcPollResponse {
  peers: PeerRow[];
  signals: SignalRow[];
}

export interface PeerInfo {
  id: string;
  name: string;
  connectionState: RTCPeerConnectionState;
  /** Selected local ICE candidate type: host | srflx | prflx | relay. */
  candidateType: string | null;
  /** Reliable data channel is open, so a file offer can be sent. */
  channelOpen: boolean;
  /** Data-channel ping RTT (ms), measured every 2s once connected. */
  rttMs: number | null;
  /** Small profile photo from the other device, when they have set one. */
  photo?: string;
}

export interface P2PRoomOptions {
  room: string;
  selfId: string;
  name?: string;
  /** Another site's origin, when this device joined from a scanned link. Empty means this site. */
  signalBase?: string;
  /** Defaults to VITE_STUN_URLS (comma-separated) or Google public STUN. */
  iceServers?: RTCIceServer[];
  onPeersChanged?: (peers: PeerInfo[]) => void;
  /** Fires for both the unreliable "state" and reliable "reliable" channels. */
  onMessage?: (from: string, data: unknown, channel: "state" | "reliable") => void;
  /** Raw bytes on the reliable channel. Used for file pieces, not control messages. */
  onBinary?: (from: string, data: ArrayBuffer) => void;
  /** Fires once, on the first successful signaling poll (registration). */
  onConnected?: () => void;
}

interface PeerSlot {
  pc: RTCPeerConnection;
  state?: RTCDataChannel;
  reliable?: RTCDataChannel;
  makingOffer: boolean;
  ignoreOffer: boolean;
  /** ICE candidates that arrived before the remote description (buffered). */
  pendingCandidates: RTCIceCandidateInit[];
  /** Last time this pair made observable progress toward connected. */
  lastProgressAt: number;
  /** Watchdog recreations (dialer) / stall windows (receiver) so far. */
  recoveryAttempts: number;
  /** Gave up after MAX_RECOVERY_ATTEMPTS — excluded from fast-poll pressure. */
  terminal?: boolean;
  /** Seen on the public list, not on this preview's own roster. */
  viaPublic?: number;
  /** One-shot: pc was already recreated to absorb a failing remote offer. */
  recreatedForOffer?: boolean;
  info: PeerInfo;
  pingSentAt?: number;
}

const FAST_POLL_MS = 200;
const IDLE_POLL_MS = 250;
const PING_INTERVAL_MS = 2000;
const STALL_MS = 10_000;
const MAX_RECOVERY_ATTEMPTS = 3;
const SIGNAL_RETRY_DELAYS_MS = [250, 750];
const PUBLIC_TOPIC = "flicro-206898624898-link";

export function defaultIceServers(): RTCIceServer[] {
  const extra = (import.meta.env.VITE_STUN_URLS as string | undefined)
    ?.split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (extra?.length) return extra.map((urls) => ({ urls }));
  return [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ];
}

export class P2PRoom {
  private readonly opts: P2PRoomOptions;
  private readonly peers = new Map<string, PeerSlot>();
  /** Per-remote-peer signal delivery chains (order-preserving). */
  private readonly signalQueues = new Map<string, Promise<void>>();
  private cursor = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private publicTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  private everPolled = false;
  private lastPeersFingerprint = "";
  private pinned = new Set<string>();
  private seenNtfy = new Set<string>();
  private lastMirror = new Map<string, number>();
  private helloBeat = 0;
  private rtcIds = new Set<string>();
  /** Peers whose direct link accepted bytes and then never delivered them. */
  private relayPeers = new Set<string>();
  private binBags = new Map<string, { parts: number; got: Map<number, Uint8Array> }>();

  constructor(opts: P2PRoomOptions) {
    this.opts = opts;
  }

  private endpoint(): string {
    const base = (this.opts.signalBase || "").replace(/\/$/, "");
    return `${base}/api/rtc`;
  }

  /**
   * The first poll IS the join: it registers this peer and returns the
   * roster. A failed first poll (cold DB, offline tab) must not strand the
   * room: the loop and timers start regardless and the next poll retries.
   */
  async join(): Promise<void> {
    try {
      await this.pollOnce();
    } catch {
      // First poll can fail transiently; the scheduled loop below retries.
    }
    if (this.closed) return;
    this.schedulePoll(this.anyPairConnecting() ? FAST_POLL_MS : IDLE_POLL_MS);
    this.schedulePublic(200);
    this.pingTimer = setInterval(() => {
      this.pingAll();
      this.watchdog();
    }, PING_INTERVAL_MS);
  }

  close(): void {
    this.closed = true;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.publicTimer) clearTimeout(this.publicTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    for (const slot of this.peers.values()) slot.pc.close();
    this.peers.clear();
    // Leaving the roster is the teardown broadcast: everyone's next poll
    // drops this peer and closes their side of the pair.
    void fetch(this.endpoint(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "leave", room: this.opts.room, peer: this.opts.selfId }),
      keepalive: true,
    }).catch(() => {});
  }

  /** Send on the unreliable game-state channel (drops stale packets). */
  broadcast(data: unknown): void {
    const wire = JSON.stringify({ t: "d", d: data });
    for (const slot of this.peers.values()) {
      if (slot.state?.readyState === "open") slot.state.send(wire);
    }
  }

  /** Send a small control message through signaling so Accept shows before the direct link is up. File bytes stay on the data channel. */
  sendControl(data: unknown, peerId: string): void {
    void this.postSignal(peerId, "ctrl", data);
  }

  /** Keep this device on the list for the whole transfer, even if a poll blips. */
  pin(peerId: string): void {
    if (peerId) this.pinned.add(peerId);
  }

  unpin(peerId: string): void {
    this.pinned.delete(peerId);
  }
  send(data: unknown, peerId?: string): void {
    if (peerId) void this.sendSignal(peerId, "ctrl", data);
    if (peerId && !this.peers.has(peerId)) return;
    const wire = JSON.stringify({ t: "d", d: data });
    const targets = peerId ? [this.peers.get(peerId)] : [...this.peers.values()];
    for (const slot of targets) {
      if (!slot) continue;
      if (slot.reliable?.readyState === "open") slot.reliable.send(wire);
    }
  }

  /** True when the direct file channel is open and has not been marked dead. */
  channelReady(peerId: string): boolean {
    const channel = this.peers.get(peerId)?.reliable;
    return channel?.readyState === "open" && !this.relayPeers.has(peerId);
  }

  /** Stop trusting the direct link for this peer and carry the file on the signal path. */
  preferRelay(peerId: string): void {
    if (peerId) this.relayPeers.add(peerId);
  }

  /** Send a binary file piece. The direct link is used when it is actually draining, and every piece is also posted in parallel on the room relay. */
  sendBinary(bytes: Uint8Array, peerId: string): void {
    const channel = this.peers.get(peerId)?.reliable;
    if (channel?.readyState === "open" && channel.bufferedAmount < 256 * 1024 && !this.relayPeers.has(peerId)) {
      try {
        const payload = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(payload).set(bytes);
        channel.send(payload);
      } catch {
        this.relayPeers.add(peerId);
      }
    }
    const body = JSON.stringify({
      op: "signal",
      room: this.opts.room,
      from: this.opts.selfId,
      to: peerId,
      kind: "ctrl",
      payload: { flicroBin: bytesToB64(bytes) },
    });
    void this.relaySlot().then(async () => {
      try {
        const res = await fetch(this.endpoint(), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        });
        if (!res.ok) {
          await fetch(this.endpoint(), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
          });
        }
      } catch {
        try {
          await fetch(this.endpoint(), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
          });
        } catch {
          /* the sender retries this piece when the ack does not arrive */
        }
      } finally {
        this.relayDone();
      }
    });
  }

  private relayFlying = 0;
  private relayWaiters: Array<() => void> = [];

  private relaySlot(): Promise<void> {
    if (this.relayFlying < 4) {
      this.relayFlying += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.relayWaiters.push(() => {
        this.relayFlying += 1;
        resolve();
      });
    });
  }

  private relayDone(): void {
    this.relayFlying = Math.max(0, this.relayFlying - 1);
    const next = this.relayWaiters.shift();
    if (next) next();
  }

  /** Bytes the browser has not handed to the network yet for this peer. */
  bufferedAmount(peerId: string): number {
    return this.peers.get(peerId)?.reliable?.bufferedAmount ?? 0;
  }

  peerList(): PeerInfo[] {
    return [...this.peers.values()].map((s) => ({ ...s.info }));
  }

  // ── signaling loop ─────────────────────────────────────────────────────────

  private schedulePoll(delay: number): void {
    if (this.closed) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => void this.poll(), delay);
  }

  private anyPairConnecting(): boolean {
    for (const s of this.peers.values()) {
      // Terminal pairs (NAT-blocked after all recovery attempts) must not pin
      // the session at the 400ms fast-poll rate.
      if (s.terminal) continue;
      if (s.info.connectionState !== "connected") return true;
    }
    return false;
  }

  private async pollOnce(): Promise<void> {
    const params = new URLSearchParams({
      room: this.opts.room,
      peer: this.opts.selfId,
      name: this.opts.name ?? "",
      since: String(this.cursor),
    });
    const res = await fetch(`${this.endpoint()}?${params}`);
    if (this.closed) return;
    if (!res.ok) throw new Error(`signaling poll failed: ${res.status}`);
    const body = (await res.json()) as RtcPollResponse;
    if (this.closed) return;
    if (!this.everPolled) {
      this.everPolled = true;
      this.opts.onConnected?.();
    }
    this.reconcileRoster(body.peers);
    const roster = new Set(body.peers.map((p) => p.id));
    for (const sig of body.signals) {
      this.cursor = Math.max(this.cursor, sig.id);
      await this.onSignal(sig.from, sig.kind, sig.payload, roster);
      if (this.closed) return;
    }
  }

  private async poll(): Promise<void> {
    if (this.closed) return;
    try {
      await this.pollOnce();
    } catch {
      // Transient poll failures are expected (tab sleep, deploy roll); retry.
    }
    this.schedulePoll(this.anyPairConnecting() ? FAST_POLL_MS : IDLE_POLL_MS);
  }

  private reconcileRoster(peers: { id: string; name: string }[]): void {
    const alive = new Set(peers.map((p) => p.id));
    this.rtcIds = alive;
    for (const p of peers) {
      if (p.id === this.opts.selfId) continue;
      const existing = this.peers.get(p.id);
      if (existing) {
        existing.info.name = p.name;
        existing.viaPublic = Date.now();
      } else {
        // Exactly one side dials each pair; the other waits for the offer.
        const slot = this.connectTo(p.id, p.name, this.opts.selfId > p.id);
        if (slot) slot.viaPublic = Date.now();
      }
    }
    for (const [id, slot] of this.peers) {
      if (alive.has(id) || this.pinned.has(id)) continue;
      if (slot.info.channelOpen || slot.info.connectionState === "connected") continue;
      if (slot.viaPublic && Date.now() - slot.viaPublic < 90_000) continue;
      slot.pc.close();
      this.peers.delete(id);
    }
    this.emitPeers();
  }

  private schedulePublic(delay: number): void {
    if (this.closed) return;
    if (this.publicTimer) clearTimeout(this.publicTimer);
    this.publicTimer = setTimeout(() => void this.publicTick(), delay);
  }

  private async publicTick(): Promise<void> {
    if (this.closed) return;
    try {
      await this.exchangePublic();
    } catch {
      /* the phone may be on another network; the next tick retries */
    }
    this.schedulePublic(400);
  }

  private notePublic(id: string, name: string): void {
    if (id === this.opts.selfId) return;
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return;
    const existing = this.peers.get(id);
    if (existing) {
      if (!this.rtcIds.has(id)) existing.info.name = name;
      existing.viaPublic = Date.now();
      return;
    }
    const slot = this.connectTo(id, name, this.opts.selfId > id);
    if (slot) slot.viaPublic = Date.now();
    this.emitPeers();
  }

  private async exchangePublic(): Promise<void> {
    const hello = JSON.stringify({
      op: "hi",
      id: this.opts.selfId,
      name: (this.opts.name ?? "Device").slice(0, 32),
      ts: Date.now(),
    });
    this.helloBeat += 1;
    if (this.helloBeat % 5 === 1) {
      await fetch(`https://ntfy.sh/${PUBLIC_TOPIC}`, { method: "POST", body: hello });
    }
    const res = await fetch(`https://ntfy.sh/${PUBLIC_TOPIC}/json?poll=1&since=12s`);
    if (!res.ok) return;
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      let row: { id?: string; message?: string };
      try {
        row = JSON.parse(line) as { id?: string; message?: string };
      } catch {
        continue;
      }
      if (row.id) {
        if (this.seenNtfy.has(row.id)) continue;
        this.seenNtfy.add(row.id);
        if (this.seenNtfy.size > 400) this.seenNtfy.clear();
      }
      let msg: { op?: string; id?: string; name?: string; ts?: number; to?: string; from?: string; kind?: SignalKind; payload?: unknown };
      try {
        msg = JSON.parse(row.message ?? "") as typeof msg;
      } catch {
        continue;
      }
      if (!msg.ts || Date.now() - msg.ts > 12_000) continue;
      if (msg.op === "hi" && msg.id) this.notePublic(msg.id, msg.name || "iPhone");
      if (
        msg.op === "sig" &&
        msg.to === this.opts.selfId &&
        msg.from &&
        (msg.kind === "offer" || msg.kind === "answer" || msg.kind === "ice" || msg.kind === "ctrl") &&
        (msg.kind === "ctrl" || !this.rtcIds.has(msg.from))
      ) {
        await this.onSignal(msg.from, msg.kind, msg.payload, new Set([msg.from]));
      }
    }
  }

  // ── per-pair connection ────────────────────────────────────────────────────

  private connectTo(peerId: string, name: string, initiator: boolean): PeerSlot | null {
    if (this.closed) return null;
    const pc = new RTCPeerConnection({
      iceServers: this.opts.iceServers ?? defaultIceServers(),
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });
    const slot: PeerSlot = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      pendingCandidates: [],
      lastProgressAt: Date.now(),
      recoveryAttempts: 0,
      info: {
        id: peerId,
        name,
        connectionState: pc.connectionState,
        candidateType: null,
        channelOpen: false,
        rttMs: null,
      },
    };
    this.peers.set(peerId, slot);

    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const ice = e.candidate.toJSON
        ? e.candidate.toJSON()
        : { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex };
      void this.sendSignal(peerId, "ice", ice);
    };
    pc.onconnectionstatechange = () => {
      const next = pc.connectionState;
      const iceUp = slot.info.connectionState === "connected" && (next === "new" || next === "connecting");
      if (!iceUp) slot.info.connectionState = next;
      if (next === "connecting" || next === "connected") slot.lastProgressAt = Date.now();
      if (next === "connected") {
        slot.recoveryAttempts = 0;
        slot.terminal = false;
        void this.readCandidateType(slot);
      }
      this.emitPeers();
      if (next === "failed") pc.restartIce();
      if (next === "failed" || next === "disconnected") this.schedulePoll(FAST_POLL_MS);
    };
    pc.oniceconnectionstatechange = () => {
      const ice = pc.iceConnectionState;
      if (ice === "checking" || ice === "connected" || ice === "completed") slot.lastProgressAt = Date.now();
      if ((ice === "connected" || ice === "completed") && slot.info.connectionState !== "connected") {
        slot.info.connectionState = "connected";
        slot.recoveryAttempts = 0;
        slot.terminal = false;
        void this.readCandidateType(slot);
        this.emitPeers();
      }
      if (ice === "failed") pc.restartIce();
    };
    pc.onnegotiationneeded = async () => {
      try {
        slot.makingOffer = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitForIce(pc, 800);
        if (this.closed) return;
        await this.sendSignal(peerId, "offer", sessionJSON(pc.localDescription));
      } catch {
        // A failed offer is retried on the next negotiationneeded.
      } finally {
        slot.makingOffer = false;
      }
    };
    pc.ondatachannel = (e) => this.attachChannel(slot, e.channel);

    if (initiator) {
      // Creating the channels triggers negotiationneeded → the offer.
      this.attachChannel(
        slot,
        pc.createDataChannel("state", { ordered: false, maxRetransmits: 0 }),
      );
      this.attachChannel(slot, pc.createDataChannel("reliable", { ordered: true }));
    }
    return slot;
  }

  private attachChannel(slot: PeerSlot, channel: RTCDataChannel): void {
    if (channel.label === "state") slot.state = channel;
    else slot.reliable = channel;
    channel.binaryType = "arraybuffer";
    channel.onopen = () => {
      slot.lastProgressAt = Date.now();
      if (channel.label === "state") return;
      slot.info.channelOpen = true;
      if (slot.info.connectionState !== "connected") slot.info.connectionState = "connected";
      this.emitPeers();
    };
    channel.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        this.opts.onBinary?.(slot.info.id, e.data);
        return;
      }
      let msg: { t: string; d?: unknown };
      try {
        msg = JSON.parse(e.data as string) as { t: string; d?: unknown };
      } catch {
        return;
      }
      if (msg.t === "ping") {
        if (slot.state?.readyState === "open") {
          slot.state.send(JSON.stringify({ t: "pong" }));
        }
      } else if (msg.t === "pong") {
        if (slot.pingSentAt) {
          slot.info.rttMs = Math.round(performance.now() - slot.pingSentAt);
          slot.pingSentAt = undefined;
          this.emitPeers();
        }
      } else {
        this.opts.onMessage?.(
          slot.info.id,
          msg.d,
          channel.label === "state" ? "state" : "reliable",
        );
      }
    };
  }

  /** Apply buffered ICE candidates once a remote description is in place. */
  private async flushPendingCandidates(slot: PeerSlot): Promise<void> {
    while (slot.pendingCandidates.length > 0) {
      const candidate = slot.pendingCandidates.shift()!;
      try {
        await slot.pc.addIceCandidate(candidate);
      } catch (err) {
        if (!slot.ignoreOffer) console.warn("[p2p] addIceCandidate failed:", err);
      }
      if (this.closed) return;
    }
  }

  private async onSignal(
    from: string,
    kind: SignalKind,
    payload: unknown,
    roster: Set<string>,
  ): Promise<void> {
    if (this.closed) return;
    if (kind === "ctrl") {
      const body = decodePayload(payload);
      if (body && typeof body === "object" && "flicroBin" in body && typeof (body as { flicroBin?: unknown }).flicroBin === "string") {
        const packed = body as { flicroBin: string; part?: number; parts?: number; binId?: string };
        const bytes = b64ToBytes(packed.flicroBin);
        if (!bytes) return;
        const parts = packed.parts ?? 1;
        const part = packed.part ?? 0;
        let whole = bytes;
        if (parts > 1 && packed.binId) {
          const key = `${from}:${packed.binId}`;
          let bag = this.binBags.get(key);
          if (!bag) {
            bag = { parts, got: new Map() };
            this.binBags.set(key, bag);
          }
          bag.got.set(part, bytes);
          if (bag.got.size < parts) return;
          let len = 0;
          for (let i = 0; i < parts; i += 1) len += bag.got.get(i)?.length ?? 0;
          const all = new Uint8Array(len);
          let offset = 0;
          for (let i = 0; i < parts; i += 1) {
            const piece = bag.got.get(i);
            if (!piece) return;
            all.set(piece, offset);
            offset += piece.length;
          }
          this.binBags.delete(key);
          whole = all;
        }
        const copy = new ArrayBuffer(whole.byteLength);
        new Uint8Array(copy).set(whole);
        this.opts.onBinary?.(from, copy);
        return;
      }
      this.opts.onMessage?.(from, body, "reliable");
      return;
    }
    let slot = this.peers.get(from);
    if (!slot) {
      // New peers dial us in the same poll that adds them to the roster.
      // Signals outlive membership, so drop senders the roster doesn't vouch for.
      if (!roster.has(from)) return;
      const created = this.connectTo(from, "", false);
      if (!created) return;
      slot = created;
    }
    const polite = this.opts.selfId < from;

    try {
      if (kind === "offer" || kind === "answer") {
        const description = payload as RTCSessionDescriptionInit;
        const collision =
          kind === "offer" && (slot.makingOffer || slot.pc.signalingState !== "stable");
        slot.ignoreOffer = !polite && collision;
        if (slot.ignoreOffer) return;
        try {
          await slot.pc.setRemoteDescription(description); // implicit rollback when polite
        } catch (err) {
          // A pc resumed from suspend can be unable to take any new remote
          // offer (stale DTLS fingerprint). Rebuild the pair once and apply
          // the same offer to the fresh pc before giving up.
          if (kind !== "offer" || slot.recreatedForOffer) throw err;
          const attempts = slot.recoveryAttempts;
          const name = slot.info.name;
          slot.pc.close();
          this.peers.delete(from);
          const fresh = this.connectTo(from, name, false);
          if (!fresh) return;
          fresh.recoveryAttempts = attempts;
          fresh.recreatedForOffer = true;
          slot = fresh;
          await slot.pc.setRemoteDescription(description);
        }
        if (this.closed) return;
        await this.flushPendingCandidates(slot);
        if (this.closed) return;
        if (kind === "offer") {
          const answer = await slot.pc.createAnswer();
          await slot.pc.setLocalDescription(answer);
          if (this.closed) return;
          await waitForIce(slot.pc, 800);
          if (this.closed) return;
          await this.sendSignal(from, "answer", sessionJSON(slot.pc.localDescription));
        }
      } else if (kind === "ice") {
        const candidate = payload as RTCIceCandidateInit;
        if (!slot.pc.remoteDescription) {
          // Candidate raced ahead of its SDP — hold it until the description
          // lands (flushed after every successful setRemoteDescription).
          slot.pendingCandidates.push(candidate);
          return;
        }
        try {
          await slot.pc.addIceCandidate(candidate);
        } catch (err) {
          // The enclosing catch would swallow a rethrow; log the real signal.
          if (!slot.ignoreOffer) console.warn("[p2p] addIceCandidate failed:", err);
        }
      }
    } catch {
      // Negotiation errors resolve on the next offer cycle; state is visible
      // to the app via connectionState.
    }
  }

  /**
   * Signals are serialized per remote peer (a candidate must never overtake
   * its SDP into the DB) and retried on failure with short backoff.
   */
  private sendSignal(to: string, kind: SignalKind, payload: unknown): Promise<void> {
    if (kind === "ctrl") void this.mirrorPublic(to, kind, payload);
    const prev = this.signalQueues.get(to) ?? Promise.resolve();
    const next = prev.then(() => this.postSignal(to, kind, payload));
    this.signalQueues.set(
      to,
      next.catch(() => {}),
    );
    return next;
  }

  private async mirrorPublic(to: string, kind: SignalKind, payload: unknown): Promise<void> {
    const ctrl = kind === "ctrl";
    const slot = this.peers.get(to);
    if (!ctrl && (!slot?.viaPublic || this.rtcIds.has(to))) return;
    const body = JSON.stringify({ op: "sig", to, from: this.opts.selfId, kind, payload, ts: Date.now() });
    if (body.length > 3900) return;
    const key = `${to}:${kind}:${body.length}:${body.slice(-48)}`;
    const now = Date.now();
    if (now - (this.lastMirror.get(key) ?? 0) < 120) return;
    this.lastMirror.set(key, now);
    await fetch(`https://ntfy.sh/${PUBLIC_TOPIC}`, { method: "POST", body }).catch(() => undefined);
  }

  private async postSignal(to: string, kind: SignalKind, payload: unknown): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      if (this.closed) return;
      try {
        const res = await fetch(this.endpoint(), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            op: "signal",
            room: this.opts.room,
            from: this.opts.selfId,
            to,
            kind,
            payload,
          }),
        });
        if (res.ok) {
          void this.mirrorPublic(to, kind, payload);
          return;
        }
        throw new Error(`signal POST failed: ${res.status}`);
      } catch (err) {
        if (attempt >= SIGNAL_RETRY_DELAYS_MS.length) {
          void this.mirrorPublic(to, kind, payload);
          console.warn(`[p2p] signal ${kind} to ${to} failed after retries`, err);
          return;
        }
        await new Promise((r) => setTimeout(r, SIGNAL_RETRY_DELAYS_MS[attempt]));
      }
    }
  }

  // ── diagnostics + recovery ─────────────────────────────────────────────────

  private pingAll(): void {
    const wire = JSON.stringify({ t: "ping" });
    for (const slot of this.peers.values()) {
      if (slot.state?.readyState !== "open") continue;
      const stale =
        slot.pingSentAt !== undefined && performance.now() - slot.pingSentAt > 2 * PING_INTERVAL_MS;
      if (slot.pingSentAt === undefined || stale) {
        // A lost pong must not freeze rttMs forever: expire and re-ping.
        slot.pingSentAt = performance.now();
        slot.state.send(wire);
      }
    }
  }

  /**
   * Stuck-pair recovery, piggybacked on the ping interval. A pair that has
   * made no progress for STALL_MS gets rebuilt by the dialer with a FRESH
   * RTCPeerConnection (new DTLS identity — fixes the suspend/resume
   * fingerprint wedge). After MAX_RECOVERY_ATTEMPTS the pair is terminal:
   * visible to the app as its last connectionState, ignored by fast-poll.
   */
  private watchdog(): void {
    if (this.closed) return;
    const now = Date.now();
    for (const [peerId, slot] of this.peers) {
      // pc.close() and some suspend/resume wedges never fire
      // connectionstatechange — read the LIVE state so a silently-dead pc
      // still trips the stall timer instead of hiding behind a cached
      // "connected". Only live progress states refresh the stall clock.
      const live = slot.pc.connectionState;
      if (live !== slot.info.connectionState) {
        slot.info.connectionState = live;
        if (live === "connecting" || live === "connected") slot.lastProgressAt = now;
        this.emitPeers();
      }
      if (slot.terminal || live === "connected" || slot.viaPublic) continue;
      if (now - slot.lastProgressAt <= STALL_MS) continue;
      if (slot.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
        slot.terminal = true;
        this.emitPeers();
        continue;
      }
      slot.recoveryAttempts += 1;
      slot.lastProgressAt = now; // re-arm the stall window
      if (this.opts.selfId > peerId) {
        // We are the dialer: rebuild the pair from scratch.
        const { name } = slot.info;
        const attempts = slot.recoveryAttempts;
        slot.pc.close();
        this.peers.delete(peerId);
        const fresh = this.connectTo(peerId, name, true);
        if (fresh) fresh.recoveryAttempts = attempts;
        this.schedulePoll(FAST_POLL_MS);
      }
      // Receiver side: count the stall window and wait for the dialer's
      // fresh offer (onSignal absorbs it, recreating our pc if needed).
    }
  }

  private async readCandidateType(slot: PeerSlot): Promise<void> {
    // relay = TURN (none configured by default); srflx/host = direct path.
    try {
      const stats = await slot.pc.getStats();
      let selected: RTCIceCandidatePairStats | undefined;
      stats.forEach((s) => {
        if (s.type === "candidate-pair" && (s as RTCIceCandidatePairStats).nominated) {
          selected = s as RTCIceCandidatePairStats;
        }
      });
      const localId = selected?.localCandidateId;
      if (localId) {
        const local = stats.get(localId) as { candidateType?: string } | undefined;
        slot.info.candidateType = local?.candidateType ?? null;
        this.emitPeers();
      }
    } catch {
      // getStats is best-effort diagnostics only.
    }
  }

  private emitPeers(): void {
    // Only notify when something observable actually changed — React state
    // setters otherwise re-render consumers on every poll/ping.
    const list = this.peerList();
    const fingerprint = JSON.stringify(
      list.map((p) => [p.id, p.name, p.connectionState, p.channelOpen, p.candidateType, p.rttMs]),
    );
    if (fingerprint === this.lastPeersFingerprint) return;
    this.lastPeersFingerprint = fingerprint;
    this.opts.onPeersChanged?.(list);
  }
}

function decodePayload(value: unknown): unknown {
  let current = value;
  for (let i = 0; i < 2 && typeof current === "string"; i += 1) {
    try {
      current = JSON.parse(current);
    } catch {
      break;
    }
  }
  return current;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const stride = 8192;
  for (let i = 0; i < bytes.length; i += stride) {
    const slice = bytes.subarray(i, Math.min(bytes.length, i + stride));
    bin += String.fromCharCode.apply(null, slice as unknown as number[]);
  }
  return btoa(bin);
}

function b64ToBytes(value: string): Uint8Array | null {
  try {
    const bin = atob(value);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function sessionJSON(desc: RTCSessionDescription | null): RTCSessionDescriptionInit {
  if (!desc) throw new Error("missing description");
  return { type: desc.type, sdp: desc.sdp ?? "" };
}

function waitForIce(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      pc.removeEventListener("icegatheringstatechange", onChange);
      window.clearTimeout(timer);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === "complete") finish();
    };
    pc.addEventListener("icegatheringstatechange", onChange);
    const timer = window.setTimeout(finish, timeoutMs);
  });
}
