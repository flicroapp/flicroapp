import jsQR from "jsqr";
import QRCode from "qrcode";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Download,
  FileText,
  Folder,
  House,
  CircleHelp,
  Image as ImageIcon,
  Menu,
  Monitor,
  Moon,
  Music,
  Pause,
  Play,
  QrCode,
  RotateCcw,
  Send,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserRound,
  Users,
  Video,
  Crown,
  Plus,
  ChevronRight,
  Layers,
  ScanLine,
  Lock as LockIcon,
  Activity as ActivityIcon,
  RefreshCw,
  X,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { FlicroNative, type NativeFile, type NativePeer } from "@/lib/flicro/native-client";
import { finishGoogleRedirect } from "@/lib/flicro/account";
import { Settings, SettingsDrawer, type SettingsPage } from "@/components/flicro-settings";
import { useFlicro } from "@/lib/flicro/use-flicro";
import { HomeScreen } from "@/components/screens/flicro-home-screen";
import { RadarScreen } from "@/components/screens/flicro-radar-screen";
import { PrivateSpaceScreen } from "@/components/screens/flicro-private-space";
import { ContactsScreen } from "@/components/screens/flicro-contacts-screen";
import { MusicScreen } from "@/components/screens/flicro-music-screen";
import { CleanScreen } from "@/components/screens/flicro-clean-screen";
import { SelectFilesScreen } from "@/components/screens/flicro-select-files-screen";
import { ConnectPcScreen } from "@/components/screens/flicro-connect-pc-screen";
import { WebShareScreen } from "@/components/screens/flicro-webshare-screen";
import { PhoneCloneScreen } from "@/components/screens/flicro-phone-clone-screen";
import { CastScreen } from "@/components/screens/flicro-cast-screen";
import { playChime } from "@/lib/flicro/sound";
import { applyTheme, loadTheme, type Theme } from "@/lib/flicro/theme";
import type { DownloadReady, FileProgress, Incoming, Outgoing } from "@/lib/flicro/engine";
import type { PeerInfo } from "@/lib/multiplayer";
import {
  MAX_FILES,
  baseName,
  formatBytes,
  formatCode,
  formatEta,
  formatWhen,
  normalizeRoom,
  parseJoinCode,
  saveBlob,
  saveToGallery,
  uid,
} from "@/lib/flicro/format";
import {
  appendHistory,
  checkPin,
  clearHistoryStore,
  hasPin,
  loadAutoLeave,
  loadBio,
  loadHistory,
  loadName,
  loadNotify,
  loadPro,
  markSetupDone,
  readOpfs,
  saveName,
  savePro,
  setupDone,
  type HistoryEntry,
} from "@/lib/flicro/storage";

type Tab = "home" | "private" | "music" | "contacts" | "me";
type Overlay = null | "send" | "receive" | "select_files" | "clean" | "connect_pc" | "webshare" | "phone_clone" | "cast_screen";
type Picked = { key: string; file: File };

export function FlicroApp({
  room,
  selfId,
  name,
  signalBase = "",
  onName,
  onJoin,
  onWifi,
  onHold,
}: {
  room: string;
  selfId: string;
  name: string;
  signalBase?: string;
  onName: (name: string) => void;
  onJoin: (room: string, origin?: string) => void;
  onWifi: () => void;
  onHold: (yes: boolean) => void;
}) {
  const [booting, setBooting] = useState(true);
  const [setup, setSetup] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    setSetup(!setupDone());
    setLocked(hasPin());
    void finishGoogleRedirect().catch(() => {});
    const timer = window.setTimeout(() => setBooting(false), 650);
    return () => window.clearTimeout(timer);
  }, []);

  if (booting) return <Splash />;
  if (setup) {
    return (
      <Setup
        onDone={() => {
          markSetupDone();
          setSetup(false);
        }}
      />
    );
  }
  if (locked) return <Lock onUnlock={() => setLocked(false)} />;

  return <Shell room={room} selfId={selfId} name={name} signalBase={signalBase} onName={onName} onJoin={onJoin} onWifi={onWifi} onHold={onHold} onLock={() => setLocked(true)} />;
}

function Shell({
  room,
  selfId,
  name,
  signalBase,
  onName,
  onJoin,
  onWifi,
  onHold,
  onLock,
}: {
  room: string;
  selfId: string;
  name: string;
  signalBase: string;
  onName: (name: string) => void;
  onJoin: (room: string, origin?: string) => void;
  onWifi: () => void;
  onHold: (yes: boolean) => void;
  onLock: () => void;
}) {
  const [tab, setTab] = useState<Tab>("home");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [wifiSsid, setWifiSsid] = useState("");

  useEffect(() => {
    fetch("/api/network")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ssid) setWifiSsid(data.ssid);
      })
      .catch(() => {});
  }, []);

  const [picked, setPicked] = useState<Picked[]>([]);
  const [downloads, setDownloads] = useState<DownloadReady[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [notice, setNotice] = useState("");
  const [aim, setAim] = useState<{ id: string; name: string; note: string } | null>(null);
  const aimRef = useRef(aim);
  aimRef.current = aim;
  const [pro, setPro] = useState(false);
  const [web, setWeb] = useState(false);
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [settingsPage, setSettingsPage] = useState<SettingsPage>("hub");
  const [hunt, setHunt] = useState(0);
  const [nativePeers, setNativePeers] = useState<NativePeer[]>([]);
  const [nativeFiles, setNativeFiles] = useState<NativeFile[]>([]);
  const [nativeIncoming, setNativeIncoming] = useState<Incoming | null>(null);
  const [nativeOutgoing, setNativeOutgoing] = useState<Outgoing | null>(null);
  const native = Capacitor.isNativePlatform();
  const nativeInRef = useRef<Incoming | null>(null);
  const nativeOutRef = useRef<Outgoing | null>(null);
  nativeInRef.current = nativeIncoming;
  nativeOutRef.current = nativeOutgoing;
  const mediaRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const told = useRef("");
  const left = useRef("");
  useEffect(() => {
    folderRef.current?.setAttribute("webkitdirectory", "");
    folderRef.current?.setAttribute("directory", "");
  }, []);
  useScreenBox();

  const [theme, setTheme] = useState<Theme>("light");
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    setTheme(loadTheme());
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  useEffect(() => {
    setHistory(loadHistory());
    setPro(loadPro());

    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        addFiles(e.clipboardData.files);
        playChime("drop");
        setNotice(`Pasted ${e.clipboardData.files.length} file(s) from clipboard.`);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const link = useFlicro({
    room,
    selfId,
    name,
    signalBase,
    onDownload: (file) => {
      setDownloads((current) => [file, ...current.filter((item) => item.id !== file.id)]);
      void saveToGallery(file.blob, file.name);
      playChime("success");
    },
    onHistory: (entry) => setHistory(appendHistory(entry)),
  });

  useEffect(() => {
    onHold(link.snap.peers.length > 0 || nativePeers.length > 0);
  }, [link.snap.peers.length, nativePeers.length, onHold]);

  const active = link.snap.outgoing ?? link.snap.incoming;

  useEffect(() => {
    if (!active || active.status !== "done" || !loadNotify()) return;
    if (told.current === active.transferId) return;
    told.current = active.transferId;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const who = active.peerName || "the other device";
    const body = link.snap.outgoing?.status === "done" ? `Delivered to ${who}.` : `Received from ${who}.`;
    try {
      new Notification("Flicro", { body });
    } catch {
      // Some browsers block the constructor without a service worker.
    }
  }, [active, link.snap.outgoing]);

  useEffect(() => {
    if (!active || active.status !== "done" || !loadAutoLeave()) return;
    if (left.current === active.transferId) return;
    left.current = active.transferId;
    const timer = window.setTimeout(() => onWifi(), 2000);
    return () => window.clearTimeout(timer);
  }, [active, onWifi]);

  useEffect(() => {
    if (!native) return;
    const handles: Array<{ remove: () => void }> = [];
    let stop = false;
    void (async () => {
      handles.push(await FlicroNative.addListener("peers", (payload) => setNativePeers(payload.peers)));
      handles.push(
        await FlicroNative.addListener("offer", (payload) => {
          setNativeIncoming({
            transferId: "native",
            peerId: payload.peerId,
            peerName: payload.name,
            status: "offered",
            error: "",
            startedAt: null,
            pro: false,
            files: payload.files.map((file, index) => ({
              id: String(index),
              name: file.name,
              size: file.size,
              done: 0,
            })),
          });
        }),
      );
      handles.push(
        await FlicroNative.addListener("progress", (payload) => {
          const apply = (current: Incoming | null): Incoming | null => {
            if (!current) return current;
            return {
              ...current,
              status: current.status === "paused" ? "paused" : payload.peerId === "incoming" ? "receiving" : "sending",
              startedAt: current.startedAt ?? Date.now(),
              files: spreadBytes(current.files, payload.bytes),
            };
          };
          if (payload.peerId === "incoming") setNativeIncoming(apply);
          else setNativeOutgoing(apply);
        }),
      );
      handles.push(
        await FlicroNative.addListener("done", (payload) => {
          const declined = /declined/i.test(payload.message);
          const status = payload.ok ? "done" : declined ? "declined" : "failed";
          const outgoingHit = nativeOutRef.current?.peerId === payload.peerId;
          const current = outgoingHit ? nativeOutRef.current : nativeInRef.current;
          const files = current?.files ?? [];
          if (outgoingHit && nativeOutRef.current) {
            setNativeOutgoing({ ...nativeOutRef.current, status, error: payload.ok ? "" : payload.message });
          } else if (nativeInRef.current) {
            setNativeIncoming({ ...nativeInRef.current, status, error: payload.ok ? "" : payload.message });
          }
          setNotice(payload.ok ? "Transfer finished. The phones stay paired." : payload.message);
          if (payload.ok && loadNotify() && typeof Notification !== "undefined" && Notification.permission === "granted" && current) {
            try {
              new Notification("Flicro", { body: outgoingHit ? `Delivered to ${current.peerName}.` : `Received from ${current.peerName}.` });
            } catch {
              // The installed app may require a notification permission the user has not granted.
            }
          }
          if (!files.length || !current) return;
          setHistory(
            appendHistory({
              id: uid(),
              at: Date.now(),
              direction: outgoingHit ? "sent" : "received",
              peer: current.peerName || "Device",
              status: payload.ok ? (outgoingHit ? "delivered" : "received") : declined ? "declined" : "failed",
              detail: payload.ok ? "Moved on the local link. Nothing was uploaded." : payload.message,
              files: files.map((file) => ({ name: file.name, size: file.size, opfsName: null })),
            }),
          );
        }),
      );
      if (!stop) await FlicroNative.startDiscovery({ name });
    })();
    return () => {
      stop = true;
      handles.forEach((handle) => handle.remove());
      void FlicroNative.stopDiscovery();
    };
  }, [native, name]);

  function sendTo(peerId: string) {
    const nativePeer = nativePeers.find((peer) => peer.id === peerId);
    const webPeer = link.snap.peers.find((peer) => peer.id === peerId);
    const label = nativePeer?.name || webPeer?.name || "Device";
    const linked = (link.snap.paired ?? []).includes(peerId);
    const ready = native ? nativeFiles.length > 0 : picked.length > 0;
    if (!(native && nativePeer) && !ready) {
      link.requestLink(peerId);
      setNotice(`Invitation sent to ${label}. They should see Accept now.`);
    }
    if (!ready) {
      setAim({
        id: peerId,
        name: label,
        note: linked
          ? "Connected. Choose photos, files, or a folder. They get Accept for the files, and either side can send."
          : "They get Accept on their screen. After that, both sides stay connected and either one can send.",
      });
      return;
    }
    const error = dispatchSend(peerId);
    if (error) setAim({ id: peerId, name: label, note: error });
    else setAim(null);
  }

  function dispatchSend(peerId: string): string | null {
    const nativePeer = nativePeers.find((peer) => peer.id === peerId);
    if (native && nativePeer) {
      void sendNative(nativePeer);
      return null;
    }
    return link.send(
      picked.map((item) => item.file),
      peerId,
      pro,
    );
  }

  async function sendNative(peer: NativePeer) {
    if (!nativeFiles.length) {
      setNotice("Choose files with Send first.");
      return;
    }
    const forming = peer.transport === "wifi-direct" && peer.id.split(":").length > 2;
    try {
      if (forming) {
        await FlicroNative.connect({ peerId: peer.id });
        setNotice("Wi-Fi Direct is connecting. Tap that phone again in a moment to send.");
        return;
      }
      setNativeOutgoing({
        transferId: "native-out",
        peerId: peer.id,
        peerName: peer.name,
        status: "awaiting",
        error: "",
        startedAt: null,
        pro,
        files: nativeFiles.map((file, index) => ({ id: String(index), name: file.name, size: file.size, done: 0 })),
      });
      await FlicroNative.send({ peerId: peer.id, files: nativeFiles });
      setTab("home");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start the transfer.";
      setNotice(message);
      setNativeOutgoing((current) => (current ? { ...current, status: "failed", error: message } : current));
    }
  }

  function takeNative(files: NativeFile[]) {
    if (!files.length) {
      setNotice("Nothing was selected.");
      return;
    }
    const next = files.slice(0, MAX_FILES);
    setNativeFiles(next);
    setHunt(Date.now());
    setTab("home");
    setHelp(false);
    const target = aimRef.current;
    if (target) {
      setAim(null);
      setNativeOutgoing({
        transferId: "native-out",
        peerId: target.id,
        peerName: target.name,
        status: "awaiting",
        error: "",
        startedAt: null,
        pro,
        files: next.map((file, index) => ({ id: String(index), name: file.name, size: file.size, done: 0 })),
      });
      void FlicroNative.send({ peerId: target.id, files: next }).catch((err) => {
        const message = err instanceof Error ? err.message : "Could not start the transfer.";
        setNotice(message);
        setNativeOutgoing((current) => (current ? { ...current, status: "failed", error: message } : current));
      });
      return;
    }
    setNotice(files.length > MAX_FILES ? `Added ${MAX_FILES} files. The rest were left out.` : `${next.length} ${next.length === 1 ? "file" : "files"} ready.`);
  }

  function addFiles(list: FileList | File[] | null) {
    if (!list?.length) return;
    playChime("drop");
    const next = [...picked];
    let extra = 0;
    for (const file of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        extra += 1;
        continue;
      }
      const key = `${file.webkitRelativePath || file.name}:${file.size}:${file.lastModified}`;
      if (next.some((item) => item.key === key)) continue;
      next.push({ key, file });
    }
    setPicked(next);
    setHunt(Date.now());
    setTab("home");
    setHelp(false);
    const target = aimRef.current;
    if (target && next.length) {
      const error = link.send(
        next.map((item) => item.file),
        target.id,
        pro,
      );
      if (error) setAim({ ...target, note: error });
      else setAim(null);
    }
    const nested = Array.from(list).some((file) => (file.webkitRelativePath || file.name).includes("/"));
    const top = (Array.from(list)[0]?.webkitRelativePath || Array.from(list)[0]?.name || "").split("/")[0];
    if (extra) setNotice(`Added ${MAX_FILES} files. ${extra} more in that folder were left out.`);
    else if (nested) setNotice(`${top} · ${next.length} files, including everything inside.`);
    else setNotice("");
  }

  async function openFolder() {
    if (native) {
      try {
        const result = await FlicroNative.pickFolder();
        takeNative(result.files);
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Could not open that folder.");
      }
      return;
    }
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const picker = (window as Window & { showDirectoryPicker?: () => Promise<DirHandle> }).showDirectoryPicker;
    if (!ios && picker) {
      try {
        const dir = await picker();
        const files = await filesInside(dir, dir.name);
        if (!files.length) {
          setNotice("That folder has no files.");
          return;
        }
        addFiles(files);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
    (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true;
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = () => {
      const files = input.files ? Array.from(input.files) : [];
      input.remove();
      if (!files.length) return;
      const nested = files.some((file) => (file.webkitRelativePath || "").includes("/"));
      addFiles(files);
      if (!nested) {
        setNotice("This phone opened files one by one. Tap every file in the folder, or use a computer to take the whole folder at once.");
      }
    };
    input.click();
  }

  const nativeBusy = [nativeIncoming, nativeOutgoing].some((item) => item && !isTerminal(item.status));
  const radarPeers: PeerInfo[] = [
    ...nativePeers.map((peer) => ({
      id: peer.id,
      name: peer.name,
      connectionState: "connected" as const,
      candidateType: peer.transport,
      channelOpen: true,
      rttMs: null,
    })),
    ...link.snap.peers,
  ];
  const chosen = nativeFiles.length || picked.length;

  return (
    <div
      className={`flex h-dvh w-full flex-col overflow-hidden text-ink ${tab === "home" ? "bg-flicro-sky text-white" : "bg-bg"}`}
      onDragEnter={(e) => {
        e.preventDefault();
        dragCounter.current += 1;
        if (e.dataTransfer.types.includes("Files")) {
          setIsDragging(true);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDragging && e.dataTransfer.types.includes("Files")) {
          setIsDragging(true);
        }
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) {
          dragCounter.current = 0;
          setIsDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragCounter.current = 0;
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          addFiles(e.dataTransfer.files);
        }
      }}
    >
      {/* Fullscreen drag overlay */}
      {isDragging ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-blue-950/85 backdrop-blur-xl border-4 border-dashed border-white/60 text-white pointer-events-none transition-all">
          <div className="size-24 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-6 shadow-2xl animate-bounce">
            <Upload className="size-12 text-white" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Drop files to send</h2>
          <p className="mt-2 text-base text-white/80 max-w-sm text-center">
            Files will be staged immediately for direct P2P transfer
          </p>
        </div>
      ) : null}

      <main className="min-h-0 w-full flex-1 overflow-hidden bg-[#f4f7fc]">
        {/* Fullscreen Overlays for Send and Receive Radars, File Selection, and Clean Storage */}
        {overlay === "clean" ? (
          <CleanScreen onBack={() => setOverlay(null)} />
        ) : null}

        {overlay === "select_files" ? (
          <SelectFilesScreen
            pickedCount={chosen}
            onBack={() => setOverlay(null)}
            onSend={(selected) => {
              addFiles(selected);
              setOverlay("send");
            }}
          />
        ) : null}

        {overlay === "send" ? (
          <RadarScreen
            mode="send"
            room={room}
            name={name}
            wifiSsid={wifiSsid}
            peers={radarPeers}
            live={link.snap.live}
            pickedCount={chosen}
            onBack={() => setOverlay(null)}
            onHelp={() => setHelp(true)}
            onPickPeer={sendTo}
            onOpenScanner={() => setWeb(true)}
            onAddFiles={() => setOverlay("select_files")}
          />
        ) : null}

        {overlay === "receive" ? (
          <RadarScreen
            mode="receive"
            room={room}
            name={name}
            wifiSsid={wifiSsid}
            peers={radarPeers}
            live={link.snap.live}
            pickedCount={0}
            onBack={() => setOverlay(null)}
            onHelp={() => setHelp(true)}
            onPickPeer={sendTo}
            onOpenScanner={() => setWeb(true)}
          />
        ) : null}

        {overlay === "connect_pc" ? (
          <ConnectPcScreen
            onBack={() => setOverlay(null)}
            onConnect={() => setOverlay("send")}
          />
        ) : null}

        {overlay === "webshare" ? (
          <WebShareScreen
            onBack={() => setOverlay(null)}
            onScan={() => {
              setOverlay(null);
              setWeb(true);
            }}
          />
        ) : null}

        {overlay === "phone_clone" ? (
          <PhoneCloneScreen
            onBack={() => setOverlay(null)}
            onSelectRole={(role) => {
              if (role === "new") {
                setOverlay("receive");
              } else {
                setOverlay("select_files");
              }
            }}
          />
        ) : null}

        {overlay === "cast_screen" ? (
          <CastScreen
            onBack={() => setOverlay(null)}
            wifiSsid={wifiSsid}
          />
        ) : null}

        {/* Tab 1: Home Screen matching Screenshot 1 */}
        {tab === "home" && !overlay ? (
          <HomeScreen
            room={room}
            name={name}
            pickedCount={chosen}
            files={picked.map((item) => item.file)}
            onOpenSend={() => setOverlay("select_files")}
            onOpenReceive={() => setOverlay("receive")}
            onOpenFiles={() => setOverlay("select_files")}
            onOpenClean={() => setOverlay("clean")}
            onOpenConnectPc={() => setOverlay("connect_pc")}
            onOpenWebShare={() => setOverlay("webshare")}
            onOpenPhoneClone={() => setOverlay("phone_clone")}
            onOpenCastScreen={() => setOverlay("cast_screen")}
            onOpenScan={() => setWeb(true)}
            onOpenPro={() => {
              setPro(true);
              savePro(true);
              setSettingsPage("hub");
              setTab("me");
            }}
            onClearPicked={() => setPicked([])}
            onAddFiles={(f) => {
              addFiles(f);
              setOverlay("send");
            }}
            transferring={Boolean(nativeBusy || (active && !["done", "declined", "failed", "cancelled"].includes(active.status)))}
            networkBadge={<NetworkBadge transferring={Boolean(nativeBusy || (active && !["done", "declined", "failed", "cancelled"].includes(active.status)))} />}
          />
        ) : null}

        {/* Tab 2: Private Space matching Screenshot 4 */}
        {tab === "private" && !overlay ? (
          <PrivateSpaceScreen onBack={() => setTab("home")} />
        ) : null}

        {/* Tab 3: Music Tab */}
        {tab === "music" && !overlay ? (
          <MusicScreen />
        ) : null}

        {/* Tab 4: Contacts matching Screenshot 5 */}
        {tab === "contacts" && !overlay ? (
          <ContactsScreen onBack={() => setTab("home")} />
        ) : null}

        {/* Tab 5: Me / Settings Profile */}
        {tab === "me" && !overlay ? (
          <Settings
            page={settingsPage}
            onPage={setSettingsPage}
            name={name}
            room={room}
            selfId={selfId}
            onName={onName}
            onLock={onLock}
            onHistory={() => {}}
            native={native}
            history={history}
            downloads={downloads}
            pro={pro}
            onPro={(on) => {
              setPro(on);
              savePro(on);
            }}
          />
        ) : null}
      </main>

      {/* Bottom Navigation Dock matching Screenshots 1, 4, and 5 */}
      <nav className="dock shrink-0 border-t border-slate-200/80 bg-white/95 backdrop-blur-md text-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-30">
        <div className="grid grid-cols-5">
          <Dock
            label="Home"
            active={tab === "home" && !overlay}
            onClick={() => {
              setOverlay(null);
              setTab("home");
            }}
            icon={<House className="size-5" />}
          />
          <Dock
            label="Private Space"
            active={tab === "private" && !overlay}
            onClick={() => {
              setOverlay(null);
              setTab("private");
            }}
            icon={<LockIcon className="size-5" />}
          />
          <Dock
            label="Music"
            active={tab === "music" && !overlay}
            onClick={() => {
              setOverlay(null);
              setTab("music");
            }}
            icon={<Music className="size-5" />}
          />
          <Dock
            label="Contacts"
            active={tab === "contacts" && !overlay}
            onClick={() => {
              setOverlay(null);
              setTab("contacts");
            }}
            icon={<UserRound className="size-5" />}
          />
          <Dock
            label="Me"
            active={tab === "me" && !overlay}
            onClick={() => {
              setOverlay(null);
              setTab("me");
              setSettingsPage("hub");
            }}
            icon={<UserRound className="size-5" />}
          />
        </div>
      </nav>
      <input ref={mediaRef} type="file" accept="image/*,video/*" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={fileRef} type="file" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      <input
        ref={folderRef}
        type="file"
        multiple
        className="sr-only"
        // @ts-expect-error directory selection is not in the React typings
        webkitdirectory=""
        directory=""
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {web ? (
        <WebShare
          room={room}
          onJoin={(next, origin) => {
            setWeb(false);
            setTab("home");
            setHunt(Date.now());
            setNotice(next === room ? "Already on this code. The other device should appear here." : `Joined ${formatCode(next)}. The other device should appear in a moment.`);
            onJoin(next, origin);
          }}
          onClose={() => setWeb(false)}
        />
      ) : null}
      {menu ? (
        <SettingsDrawer
          name={name}
          onClose={() => setMenu(false)}
          onOpen={(page) => {
            setMenu(false);
            setSettingsPage(page);
            setTab("me");
          }}
          onWifi={() => {
            setMenu(false);
            onWifi();
          }}
          onHistory={() => {
            setMenu(false);
            setSettingsPage("sent");
            setTab("me");
          }}
        />
      ) : null}
      {help ? (
        <HelpSheet
          onClose={() => setHelp(false)}
          onPhotos={() => {
            if (!native) {
              mediaRef.current?.click();
              return;
            }
            void FlicroNative.pickFiles().then((result) => takeNative(result.files)).catch((err) => {
              setNotice(err instanceof Error ? err.message : "Could not open photos.");
            });
          }}
          onFiles={() => {
            if (!native) {
              fileRef.current?.click();
              return;
            }
            void FlicroNative.pickDocuments().then((result) => takeNative(result.files)).catch((err) => {
              setNotice(err instanceof Error ? err.message : "Could not open files.");
            });
          }}
          onFolder={() => void openFolder()}
        />
      ) : null}
      <AskPerms onLocated={onWifi} />

      {aim ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60" role="dialog" aria-modal="true" aria-label={`Send to ${aim.name}`}>
          <div className="w-full rounded-t-3xl bg-white px-4 pt-5 pb-6 text-[#102033]">
            <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Send to {aim.name}</h2>
                  <p className="mt-1 text-sm text-[#3d5166]">{aim.note}</p>
                </div>
                <button type="button" className="flex size-11 items-center justify-center" onClick={() => setAim(null)} aria-label="Close">
                  <X className="size-5" />
                </button>
              </div>
              <button type="button" className="h-12 rounded-2xl bg-[#2f7cf6] font-semibold text-white" onClick={() => {
                if (native) void FlicroNative.pickFiles().then((result) => takeNative(result.files)).catch((err) => setAim((current) => current ? { ...current, note: err instanceof Error ? err.message : "Could not open photos." } : current));
                else mediaRef.current?.click();
              }}>
                Photos
              </button>
              <button type="button" className="h-12 rounded-2xl border border-[#d5e3ee] font-semibold" onClick={() => {
                if (native) void FlicroNative.pickDocuments().then((result) => takeNative(result.files)).catch((err) => setAim((current) => current ? { ...current, note: err instanceof Error ? err.message : "Could not open files." } : current));
                else fileRef.current?.click();
              }}>
                Files
              </button>
              <button type="button" className="h-12 rounded-2xl border border-[#d5e3ee] font-semibold" onClick={() => void openFolder()}>
                Folder
              </button>
              {chosen > 0 ? (
                <button type="button" className="h-12 rounded-2xl bg-[#128a4e] font-semibold text-white" onClick={() => sendTo(aim.id)}>
                  Send {chosen} {chosen === 1 ? "file" : "files"} now
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <TransferSheet
        outgoing={sheetSide(native, nativeOutgoing, link.snap.outgoing)}
        incoming={sheetSide(native, nativeIncoming, link.snap.incoming)}
        downloads={downloads}
        pauseReceive={Boolean(nativeIncoming && (nativeIncoming.status === "receiving" || nativeIncoming.status === "paused"))}
        onAccept={() => {
          if (nativeIncoming && !isTerminal(nativeIncoming.status)) {
            void FlicroNative.accept();
            setNativeIncoming({ ...nativeIncoming, status: "receiving", startedAt: Date.now() });
            return;
          }
          link.accept();
        }}
        onDecline={() => {
          if (nativeIncoming && nativeIncoming.status === "offered") {
            void FlicroNative.decline();
            setNativeIncoming({ ...nativeIncoming, status: "declined" });
            return;
          }
          link.decline();
        }}
        onCancel={() => {
          if (nativeBusy) {
            void FlicroNative.cancel();
            setNativeIncoming((current) => (current && !isTerminal(current.status) ? { ...current, status: "cancelled", error: "You cancelled." } : current));
            setNativeOutgoing((current) => (current && !isTerminal(current.status) ? { ...current, status: "cancelled", error: "You cancelled." } : current));
            return;
          }
          link.cancel();
        }}
        onPause={() => {
          if (nativeBusy) {
            void FlicroNative.pause();
            setNativeOutgoing((current) => (current && current.status === "sending" ? { ...current, status: "paused" } : current));
            setNativeIncoming((current) => (current && current.status === "receiving" ? { ...current, status: "paused" } : current));
            return;
          }
          link.pause();
        }}
        onResume={() => {
          if (nativeOutgoing?.status === "paused" || nativeIncoming?.status === "paused") {
            void FlicroNative.resume();
            setNativeOutgoing((current) => (current && current.status === "paused" ? { ...current, status: "sending" } : current));
            setNativeIncoming((current) => (current && current.status === "paused" ? { ...current, status: "receiving" } : current));
            return;
          }
          link.resume();
        }}
        onRetry={() => {
          if (nativeOutgoing?.status === "failed") {
            const peer = nativePeers.find((item) => item.id === nativeOutgoing.peerId);
            if (peer) void sendNative(peer);
            else setNotice("That device is no longer nearby.");
            return;
          }
          setNotice(link.retry() ?? "");
        }}
        onDismiss={() => {
          setNativeIncoming((current) => (current && isTerminal(current.status) ? null : current));
          setNativeOutgoing((current) => (current && isTerminal(current.status) ? null : current));
          link.dismiss();
        }}
      />
    </div>
  );
}

function AskPerms({ onLocated }: { onLocated: () => void }) {
  const [step, setStep] = useState<"notify" | "location" | null>(null);
  useEffect(() => {
    if (!setupDone() || localStorage.getItem("flicro-perms") === "1") return;
    setStep("notify");
  }, []);
  if (!step) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50">
      <div className="w-full rounded-t-3xl bg-surface px-5 pt-5 pb-8 text-ink">
        <h2 className="text-lg font-semibold">{step === "notify" ? "Allow notifications" : "Allow location"}</h2>
        <p className="mt-2 text-sm text-pretty text-muted">
          {step === "notify"
            ? "This phone's own prompt will open. It is only used when a transfer finishes."
            : "This phone's own prompt will open. It is only used to find a phone a few steps away."}
        </p>
        <button
          type="button"
          className="mt-4 h-12 w-full rounded-2xl bg-sky font-semibold text-white"
          onClick={() => {
            if (step === "notify") {
              if (typeof Notification === "undefined") setStep("location");
              else void Notification.requestPermission().finally(() => setStep("location"));
              return;
            }
            localStorage.setItem("flicro-perms", "1");
            setStep(null);
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(
              () => {
                localStorage.setItem("flicro-geo", "1");
                onLocated();
              },
              () => {},
              { enableHighAccuracy: true, timeout: 8000 },
            );
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function HelpSheet({
  onClose,
  onPhotos,
  onFiles,
  onFolder,
}: {
  onClose: () => void;
  onPhotos: () => void;
  onFiles: () => void;
  onFolder: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/50">
      <div className="max-h-[80%] w-full overflow-y-auto rounded-t-3xl bg-surface px-5 pt-4 pb-8 text-ink">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <h2 className="text-center text-lg font-semibold">How to use</h2>
        <video
          className="mt-4 aspect-[9/16] max-h-[52vh] w-full rounded-2xl bg-black object-contain"
          src="/how-to-60.mp4"
          controls
          playsInline
          preload="metadata"
        />
        <ol className="mt-4 flex flex-col gap-3 text-sm">
          <li>1. Open Flicro on the other phone. Stay on this Wi-Fi.</li>
          <li>2. It shows up on the circle. Tap it to send.</li>
          <li>3. If it does not, scan their code. The scanner closes when the code is read.</li>
        </ol>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button type="button" className="h-12 rounded-2xl bg-[#1877f2] font-semibold text-white cursor-pointer" onClick={onPhotos}>Photos</button>
          <button type="button" className="h-12 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer" onClick={onFiles}>Files</button>
          <button type="button" className="h-12 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer" onClick={onFolder}>Folder</button>
        </div>
        <button type="button" className="mt-3 h-12 w-full rounded-2xl border border-slate-200 bg-white font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

type DirHandle = {
  name: string;
  entries: () => AsyncIterable<[string, DirEntry]>;
};

type DirEntry = DirHandle & {
  kind: "file" | "directory";
  getFile: () => Promise<File>;
};

async function filesInside(dir: DirHandle, prefix: string): Promise<File[]> {
  const out: File[] = [];
  for await (const [name, handle] of dir.entries()) {
    const path = `${prefix}/${name}`;
    if (handle.kind === "file") {
      const file = await handle.getFile();
      out.push(new File([file], path, { type: file.type, lastModified: file.lastModified }));
    } else {
      out.push(...(await filesInside(handle, path)));
    }
  }
  return out;
}

function Dock({
  label,
  active,
  onClick,
  icon,
  badge,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-all ${
        active ? "text-sky scale-105" : "text-muted hover:text-ink"
      }`}
    >
      <div className="relative">
        {icon}
        {badge !== undefined && badge > 0 ? (
          <span className="absolute -top-1.5 -right-2.5 flex size-4 items-center justify-center rounded-full bg-sky text-[9px] font-bold text-white shadow-sm">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </div>
      {label}
    </button>
  );
}

function Splash() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-field text-white">
      <LogoMark />
      <p className="mt-4 text-2xl font-semibold tracking-tight">Flicro</p>
      <p className="mt-1 text-sm text-white/80">Files stay between your devices</p>
    </div>
  );
}

function LogoMark() {
  return (
    <div className="relative group">
      <div className="absolute -inset-2 rounded-3xl bg-white/25 blur-lg animate-pulse" />
      <img
        src="/flicro-icon-180.png"
        alt="Flicro"
        className="relative size-20 rounded-3xl shadow-2xl border-2 border-white/40"
      />
    </div>
  );
}

const STEPS = [
  {
    title: "Same code, two devices",
    body: "Open Flicro on both. The other device shows up only after it joins your code. Nothing is invented.",
  },
  {
    title: "The file never sits on a server",
    body: "After you accept, the bytes go straight from one browser to the other. Flicro does not keep a copy.",
  },
  {
    title: "Lock this phone if you want",
    body: "The link is encrypted. A PIN stays on this device. No account is required.",
  },
];

function Setup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const item = STEPS[step] ?? STEPS[0];
  return (
    <div className="flex h-full w-full flex-col bg-white text-slate-900 px-6 pt-10 pb-6 select-none font-sans">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <LogoMark />
        <p className="mt-8 text-sm font-bold text-[#1877f2]">
          {step + 1} of {STEPS.length}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{item.title}</h1>
        <p className="mt-3 text-base text-slate-500 leading-relaxed">{item.body}</p>
        <div className="mt-auto grid grid-cols-2 gap-3">
          <button
            type="button"
            className="h-12 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 active:scale-95 font-semibold text-slate-800 transition-all cursor-pointer shadow-sm"
            onClick={onDone}
          >
            Skip
          </button>
          <button
            type="button"
            className="h-12 rounded-2xl bg-[#1877f2] hover:bg-[#1466e3] active:scale-95 font-semibold text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            onClick={() => {
              if (step >= STEPS.length - 1) onDone();
              else setStep((n) => n + 1);
            }}
          >
            {step >= STEPS.length - 1 ? "Start" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Lock({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(next: string) {
    setBusy(true);
    const ok = await checkPin(next);
    setBusy(false);
    if (!ok) {
      setError("Wrong PIN.");
      setPin("");
      return;
    }
    onUnlock();
  }

  function press(key: string) {
    if (busy) return;
    setError("");
    const next = (pin + key).slice(0, 4);
    setPin(next);
    if (next.length === 4) void submit(next);
  }

  return (
    <div className="flex h-full w-full flex-col bg-surface text-ink">
      <div className="flex flex-1 flex-col items-center px-6 pt-16">
        <LogoMark />
        <h1 className="mt-6 text-xl font-semibold">Enter PIN</h1>
        <p className="mt-1 text-sm text-muted">This lock stays on this device.</p>
        <div className="mt-6 flex gap-4">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`size-3.5 rounded-full border-2 border-sky ${pin.length > i ? "bg-sky" : "bg-transparent"}`} />
          ))}
        </div>
        {error ? <p className="mt-3 text-sm text-warn">{error}</p> : null}
        {loadBio() ? (
          <button type="button" className="mt-4 h-11 px-3 text-sm font-semibold text-sky" onClick={() => void unlockBio(onUnlock, setError)}>
            Use fingerprint or face
          </button>
        ) : null}
      </div>
      <PinPad onKey={press} onDelete={() => setPin((value) => value.slice(0, -1))} />
    </div>
  );
}

function PinPad({ onKey, onDelete }: { onKey: (key: string) => void; onDelete: () => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
  return (
    <div className="grid grid-cols-3 border-t border-line bg-surface">
      {keys.map((key) =>
        key === "" ? (
          <span key="blank" />
        ) : (
          <button
            key={key}
            type="button"
            className="h-16 border-b border-l border-line text-xl font-semibold"
            onClick={() => (key === "del" ? onDelete() : onKey(key))}
          >
            {key === "del" ? "Delete" : key}
          </button>
        ),
      )}
    </div>
  );
}

function useScreenBox() {
  useEffect(() => {
    const apply = () => {
      const view = window.visualViewport;
      const height = Math.round(view?.height ?? window.innerHeight);
      const width = Math.round(view?.width ?? window.innerWidth);
      document.documentElement.style.setProperty("--app-h", `${height}px`);
      document.documentElement.style.setProperty("--app-w", `${width}px`);
      document.documentElement.style.background = document.documentElement.dataset.theme === "dark" ? "#000000" : "#2f7cf6";
    };
    apply();
    window.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("scroll", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("scroll", apply);
    };
  }, []);
}

interface NetworkState {
  connected: boolean | null;
  signal: number | null;
  quality: "strong" | "moderate" | "weak" | null;
  bars: number | null;
  ssid: string | null;
  latencyMs: number | null;
  rxMbps: number | null;
  txMbps: number | null;
}

// Authentic Wi-Fi signal icon: green for strong, amber-red for weak
function PhoneWifiIndicator({
  bars,
  quality,
}: {
  bars: number;
  quality: "strong" | "moderate" | "weak" | null;
}) {
  const isStrong = quality === "strong" || bars >= 3;
  const isWeak = quality === "weak" || quality === "moderate" || (bars > 0 && bars < 3);

  // Strong: green (#10b981), Weak/Moderate: amber-red (#ef4444), Unknown: muted grey
  const activeColor = isStrong ? "#10b981" : isWeak ? "#ef4444" : "#94a3b8";
  const dimColor = isStrong ? "rgba(16, 185, 129, 0.25)" : isWeak ? "rgba(239, 68, 68, 0.25)" : "rgba(148, 163, 184, 0.25)";

  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 shrink-0 transition-colors duration-300"
      fill="none"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Top outer curve */}
      <path
        d="M2 8.82a15 15 0 0 1 20 0"
        stroke={bars >= 3 ? activeColor : dimColor}
        className="transition-colors duration-300"
      />
      {/* Middle curve */}
      <path
        d="M5 12.86a10.5 10.5 0 0 1 14 0"
        stroke={bars >= 2 ? activeColor : dimColor}
        className="transition-colors duration-300"
      />
      {/* Inner curve */}
      <path
        d="M8.5 16.43a6 6 0 0 1 7 0"
        stroke={bars >= 1 ? activeColor : dimColor}
        className="transition-colors duration-300"
      />
      {/* Center base dot */}
      <circle
        cx="12"
        cy="20"
        r="1.4"
        fill={activeColor}
        stroke="none"
        className="transition-colors duration-300"
      />
    </svg>
  );
}

function NetworkBadge({ transferring }: { transferring?: boolean }) {
  const [net, setNet] = useState<NetworkState | null>(null);

  // Poll real network state
  const fetchNet = async () => {
    try {
      const res = await fetch("/api/network");
      if (res.ok) {
        const data = (await res.json()) as NetworkState;
        setNet(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNet();
    const timer = window.setInterval(fetchNet, 3000);
    return () => window.clearInterval(timer);
  }, []);

  const quality = net?.quality ?? null;
  const bars = net?.bars ?? (quality === "strong" ? 3 : quality === "weak" ? 1 : 2);
  const isStrong = quality === "strong" || bars >= 3;
  const isWeak = quality === "weak" || quality === "moderate" || (bars > 0 && bars < 3);

  const badgeClass = isStrong
    ? "bg-emerald-50 text-emerald-600 border border-emerald-200/80 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
    : isWeak
      ? "bg-rose-50 text-rose-600 border border-rose-200/80 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
      : "bg-slate-50 text-slate-400 border border-slate-200";

  return (
    <div
      className={`flex items-center justify-center size-8 rounded-full transition-all duration-300 ${badgeClass}`}
      title={isStrong ? "Wi-Fi: Strong Signal" : isWeak ? "Wi-Fi: Weak Signal" : "Wi-Fi"}
      aria-label="Wi-Fi Signal Status"
    >
      <PhoneWifiIndicator bars={bars} quality={quality} />
    </div>
  );
}

function Home({
  room,
  name,
  snap,
  picked,
  files,
  notice,
  hunt,
  nativeMode,
  transferring,
  theme,
  onToggleTheme,
  onPick,
  onScan,
  onHelp,
  onRetry,
  onClearPicked,
  onSendPicked,
}: {
  room: string;
  name: string;
  snap: { joined: boolean; peers: PeerInfo[]; live: string[] };
  picked: number;
  files: File[];
  notice: string;
  hunt: number;
  nativeMode: boolean;
  transferring: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  onPick: (peerId: string) => void;
  onScan: () => void;
  onHelp: () => void;
  onRetry: () => void;
  onClearPicked: () => void;
  onSendPicked: () => void;
}) {
  const [copiedToast, setCopiedToast] = useState(false);
  const live = new Set(snap.live);
  const people = snap.peers.filter((peer) => {
    if (!peer.id) return false;
    const twins = snap.peers.filter((other) => other.name && other.name === peer.name);
    if (twins.length < 2) return true;
    const ready = live.has(peer.id) || peer.channelOpen || peer.connectionState === "connected";
    if (ready) return true;
    return !twins.some((other) => other.id !== peer.id && (live.has(other.id) || other.channelOpen || other.connectionState === "connected"));
  });
  const mark = transferring ? "transfer" : "send";
  const [, tick] = useState(0);
  useEffect(() => {
    if (!hunt || people.length) return;
    const timer = window.setInterval(() => tick((n) => n + 1), 400);
    return () => window.clearInterval(timer);
  }, [hunt, people.length]);
  const missed = Boolean(hunt && picked > 0 && people.length === 0 && (snap.joined || nativeMode) && Date.now() - hunt > 8000);
  const first =
    people.find((peer) => peer.name !== name && (live.has(peer.id) || peer.channelOpen || peer.connectionState === "connected")) ??
    people.find((peer) => peer.name !== name) ??
    people[0];

  const handleCopyCode = async () => {
    try {
      const page = new URL(window.location.href);
      page.search = `?room=${room}&join=1`;
      page.hash = "";
      await navigator.clipboard.writeText(page.toString());
      playChime("copy");
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2400);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative flex h-full flex-col bg-flicro-sky text-white select-none">
      {/* Top Header */}
      <header className="safe-top flex shrink-0 items-center justify-between px-4 pt-3 pb-1">
        {/* Connection status badge */}
        <NetworkBadge transferring={transferring} />

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-full hover:bg-white/15 active:scale-90 transition-all"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            title="Toggle Light / Dark mode"
          >
            {theme === "dark" ? <Sun className="size-5 text-amber-300" /> : <Moon className="size-5" />}
          </button>
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-full hover:bg-white/15 active:scale-90 transition-all"
            onClick={onHelp}
            aria-label="How to use"
            title="How to use"
          >
            <CircleHelp className="size-5" />
          </button>
        </div>
      </header>

      {/* Device Name & Clickable Room Code Badge */}
      <div className="shrink-0 flex flex-col items-center pt-1 pb-2">
        <h1 className="text-sm font-medium text-white/80">Tap a device to send</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-white/70 font-medium">{name}</span>
          <span className="text-white/40">•</span>
          <button
            type="button"
            onClick={handleCopyCode}
            className="group flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 px-3 py-0.5 text-xs font-bold tracking-wider uppercase backdrop-blur-md border border-white/30 transition-all shadow-sm"
            title="Click to copy invite link"
          >
            {copiedToast ? <Check className="size-3 text-emerald-300" /> : <Copy className="size-3 opacity-70 group-hover:opacity-100" />}
            <span>{formatCode(room)}</span>
          </button>
        </div>
        {copiedToast ? (
          <span className="mt-1 text-[11px] font-semibold text-emerald-300 animate-fade-in">
            Invite link copied to clipboard!
          </span>
        ) : null}
      </div>

      {/* Main Radar Workspace */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4">
        {missed ? (
          <div className="px-6 py-8 rounded-3xl glass-panel text-center max-w-sm">
            <p className="text-xl font-bold">No device detected yet</p>
            <p className="mt-2 text-sm text-white/80">
              Open Flicro on the laptop or the other phone on this Wi-Fi, or scan the code below.
            </p>
            <button
              type="button"
              className="mt-5 h-12 w-full rounded-2xl bg-white font-semibold text-ink shadow-lg active:scale-95 transition-all"
              onClick={onScan}
            >
              Scan or show code
            </button>
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-white/80 hover:text-white"
              onClick={onRetry}
            >
              Search this network again
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {/* Live Thumbs */}
            <LiveThumbs files={files.map((file, index) => ({ id: String(index), name: file.name, blob: file }))} />

            {/* Radar View */}
            <Radar
              peers={people}
              live={snap.live}
              onPick={onPick}
              mark={mark}
              hunting={Boolean(picked > 0 && people.length === 0)}
            />

            {first ? (
              <button
                type="button"
                className="mt-6 flex items-center gap-2 h-12 rounded-full bg-white px-7 text-sm font-bold text-ink shadow-xl hover:bg-white/95 active:scale-95 transition-all"
                onPointerDown={(event) => {
                  event.preventDefault();
                  onPick(first.id);
                }}
              >
                <Send className="size-4 text-sky" />
                Send to {first.name || "Phone"}
              </button>
            ) : (
              <div className="mt-5 flex flex-col items-center text-center">
                <p className="text-sm font-medium text-white/90">
                  {picked ? "Ready! Tap a device on the radar" : "Looking for devices on this network…"}
                </p>
                <p className="mt-0.5 text-xs text-white/60">
                  Drag & drop files anywhere, or scan a code to connect
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Staged Files Bar */}
      {picked > 0 ? (
        <div className="shrink-0 px-4 pb-2">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl glass-panel px-4 py-2.5 shadow-lg">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky text-white">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate text-white">
                  {picked} {picked === 1 ? "file" : "files"} staged
                </p>
                <p className="text-[11px] text-white/70">
                  Drop more or pick a device
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onClearPicked}
                className="px-2.5 py-1 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={onSendPicked}
                className="px-3.5 py-1.5 text-xs font-bold bg-white text-ink rounded-xl shadow-md hover:bg-white/90 active:scale-95 transition-all"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {notice ? (
        <p className="shrink-0 px-6 pb-2 text-center text-xs font-medium text-white/90 drop-shadow">
          {notice}
        </p>
      ) : null}

      {/* Bottom Floating Scan / Join Action */}
      <div className="shrink-0 pb-4 pt-1 flex items-center justify-center px-4">
        <button
          type="button"
          className="glass-pill flex items-center gap-2.5 h-12 px-6 rounded-full font-semibold text-white hover:bg-white/25 active:scale-95 transition-all shadow-lg text-sm"
          onClick={onScan}
          aria-label="Scan a code"
        >
          <QrCode className="size-5" />
          <span>Scan QR or Enter Code</span>
        </button>
      </div>
    </div>
  );
}

function Radar({
  peers,
  live,
  onPick,
  mark,
  hunting = false,
}: {
  peers: PeerInfo[];
  live: string[];
  onPick?: (peerId: string) => void;
  mark: "send" | "receive" | "transfer";
  hunting?: boolean;
}) {
  return (
    <div className={`relative aspect-square w-[min(76vw,310px)] sm:w-[320px] ${hunting ? "hunt" : ""}`}>
      {/* Concentric rings */}
      <div className="radar-ring radar-ring-1" />
      <div className="radar-ring radar-ring-2" />
      <div className="radar-ring radar-ring-3" />
      {/* Sweeping sonar beam */}
      <div className="radar-beam" />
      {/* Expanding pulses */}
      <span className="radar-wave" />
      <span className="radar-wave radar-wave-2" />
      <span className="radar-wave radar-wave-3" />
      <div className="absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
        <button
          type="button"
          className="group rounded-full p-1 transition-transform duration-200 hover:scale-105 active:scale-95"
          onPointerDown={(event) => {
            event.preventDefault();
            if (peers[0]) onPick?.(peers[0].id);
          }}
          aria-label={peers[0] ? `Send to ${peers[0].name || "Phone"}` : "No device yet"}
        >
          <CenterMark mode={mark} />
        </button>
      </div>
      {peers.slice(0, 6).map((peer, index) => {
        const angle = (-90 + (index * 360) / Math.max(peers.length, 1)) * (Math.PI / 180);
        const ready = live.includes(peer.id) || peer.channelOpen || peer.connectionState === "connected";
        const status = peer.candidateType === "wifi-direct" ? "Wi-Fi Direct" : peer.candidateType === "multipeer" ? "Nearby" : peer.candidateType === "lan" ? "Same Wi-Fi" : ready ? "Ready" : "Connecting";
        return (
          <button
            key={peer.id}
            type="button"
            disabled={!onPick}
            className="peer-floating absolute z-20 flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center group cursor-pointer transition-transform hover:scale-110 active:scale-95"
            style={{ left: `${50 + Math.cos(angle) * 40}%`, top: `${50 + Math.sin(angle) * 40}%` }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onPick?.(peer.id);
            }}
          >
            <div className="relative">
              <DeviceGlyph label={peer.name || "Phone"} photo={peer.photo} />
              <span className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-white ${ready ? "bg-emerald-400" : "bg-amber-400"}`} />
            </div>
            <span className="mt-1 max-w-20 truncate text-xs font-semibold text-white drop-shadow-sm">{peer.name || "Phone"}</span>
            <span className="text-[10px] text-white/80 font-medium">{status}</span>
          </button>
        );
      })}
    </div>
  );
}

function CenterMark({ mode }: { mode: "send" | "receive" | "transfer" }) {
  return (
    <span className="flex size-18 items-center justify-center rounded-full bg-white text-sky shadow-[0_0_35px_rgba(255,255,255,0.4)] border border-white/60">
      {mode === "transfer" ? <TransferGlyph /> : mode === "receive" ? <ReceiveGlyph /> : <SendGlyph />}
    </span>
  );
}

function SendGlyph() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
      <path d="M6 16h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 8l8 8-8 8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReceiveGlyph() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
      <path d="M16 6v14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M10 16l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 26h16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function TransferGlyph() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
      <path d="M8 13h12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 8l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 19H12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 24l-5-5 5-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DeviceGlyph({ label, photo }: { label: string; photo?: string }) {
  if (photo) return <img src={photo} alt="" className="size-13 rounded-2xl object-cover bg-white shadow-md border border-white/60" />;
  const kind = label.toLowerCase();
  const laptop = /mac|windows|linux|computer/.test(kind);
  const android = /android/.test(kind);
  return (
    <span className="flex size-13 items-center justify-center rounded-2xl bg-white text-ink shadow-[0_4px_16px_rgba(0,0,0,0.18)] border border-white/80 transition-transform group-hover:scale-105">
      {laptop ? <LaptopGlyph /> : <HandsetGlyph android={android} />}
    </span>
  );
}

function HandsetGlyph({ android }: { android: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
      <rect x="9" y="3" width="14" height="26" rx={android ? 2.5 : 4} fill="none" stroke="currentColor" strokeWidth="2" />
      {android ? (
        <circle cx="16" cy="6.2" r="0.9" fill="currentColor" />
      ) : (
        <path d="M13 6.2h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      )}
      <path d="M14 25.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function LaptopGlyph() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
      <rect x="6" y="6" width="20" height="14" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M4 22h24l-2 3H6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function SendScreen({
  picked,
  setPicked,
  pro,
  onPro,
  notice,
  onReview,
  onDropFiles,
}: {
  picked: Picked[];
  setPicked: (next: Picked[]) => void;
  pro: boolean;
  onPro: (on: boolean) => void;
  notice: string;
  onReview: () => void;
  onDropFiles?: (files: FileList | File[]) => void;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folderRef.current?.setAttribute("webkitdirectory", "");
    folderRef.current?.setAttribute("directory", "");
  }, []);

  function add(list: FileList | null) {
    if (!list) return;
    const next = [...picked];
    for (const file of list) {
      const key = `${file.webkitRelativePath || file.name}:${file.size}:${file.lastModified}`;
      if (next.some((item) => item.key === key)) continue;
      next.push({ key, file });
    }
    setPicked(next.slice(0, MAX_FILES));
  }

  const totalBytes = picked.reduce((sum, item) => sum + item.file.size, 0);

  const kinds = [
    { label: "Photos", icon: <ImageIcon className="size-5" />, color: "text-emerald-500 bg-emerald-500/10", open: () => photoRef.current?.click() },
    { label: "Videos", icon: <Video className="size-5" />, color: "text-purple-500 bg-purple-500/10", open: () => videoRef.current?.click() },
    { label: "Music", icon: <Music className="size-5" />, color: "text-amber-500 bg-amber-500/10", open: () => audioRef.current?.click() },
    { label: "Files", icon: <FileText className="size-5" />, color: "text-sky bg-sky/10", open: () => fileRef.current?.click() },
    { label: "Folder", icon: <Folder className="size-5" />, color: "text-indigo-500 bg-indigo-500/10", open: () => folderRef.current?.click() },
  ];

  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Send Files</h1>
          <p className="mt-0.5 text-xs text-muted">
            Direct peer-to-peer • No size limits • End-to-end encrypted
          </p>
        </div>
        {picked.length > 0 ? (
          <button
            type="button"
            onClick={() => setPicked([])}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 hover:text-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="size-3.5" />
            Clear All
          </button>
        ) : null}
      </div>

      {/* Categories Grid */}
      <div className="mt-4 grid grid-cols-5 gap-2">
        {kinds.map((kind) => (
          <button
            key={kind.label}
            type="button"
            onClick={kind.open}
            className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface py-3.5 px-1 text-xs font-semibold shadow-card hover:border-sky/50 hover:shadow-md active:scale-95 transition-all"
          >
            <span className={`flex size-10 items-center justify-center rounded-xl ${kind.color} group-hover:scale-110 transition-transform`}>
              {kind.icon}
            </span>
            <span className="text-ink">{kind.label}</span>
          </button>
        ))}
      </div>

      {/* Drag & Drop Target Area */}
      <div
        className="mt-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line hover:border-sky/60 bg-surface/60 p-6 text-center transition-all cursor-pointer group hover:bg-sky/5"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            if (onDropFiles) onDropFiles(e.dataTransfer.files);
            else add(e.dataTransfer.files);
          }
        }}
      >
        <div className="size-12 rounded-2xl bg-sky/10 flex items-center justify-center mb-2 text-sky group-hover:scale-110 transition-transform">
          <Upload className="size-6" />
        </div>
        <p className="text-sm font-semibold text-ink">Click or drag & drop files here</p>
        <p className="mt-0.5 text-xs text-muted">Supports photos, videos, documents, or multiple files</p>
      </div>

      <input ref={photoRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input ref={videoRef} type="file" accept="video/*" multiple className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input ref={audioRef} type="file" accept="audio/*" multiple className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input ref={fileRef} type="file" multiple className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input
        ref={folderRef}
        type="file"
        multiple
        className="sr-only"
        // @ts-expect-error directory selection is not in the React typings
        webkitdirectory=""
        directory=""
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />

      <section className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm">Turbo Pro Mode</h2>
              <span className="rounded-full bg-emerald-500/10 text-emerald-500 px-2 py-0.5 text-[10px] font-bold">
                FREE
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              Higher packet concurrency for maximum speed on fast Wi-Fi networks.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pro}
            aria-label="Pro mode"
            onClick={() => onPro(!pro)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${pro ? "bg-leaf" : "bg-line"}`}
          >
            <span className={`switch-knob absolute top-0.5 size-6 rounded-full bg-white shadow-card ${pro ? "left-5" : "left-0.5"}`} />
          </button>
        </div>
      </section>

      {/* Staged list */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
            Staged Files ({picked.length})
          </h2>
          {picked.length > 0 ? (
            <span className="text-xs font-semibold text-muted tabular-nums">
              Total: {formatBytes(totalBytes)}
            </span>
          ) : null}
        </div>

        <ul className="flex flex-col gap-2">
          {picked.length === 0 ? (
            <li className="flex flex-col items-center justify-center py-6 text-center rounded-2xl border border-dashed border-line bg-surface/40">
              <FileText className="size-6 text-muted mb-1 opacity-50" />
              <p className="text-xs text-muted">No files chosen yet. Tap a category above or drop files.</p>
            </li>
          ) : null}
          {picked.map((item) => (
            <li key={item.key} className="flex items-center gap-3 rounded-2xl bg-surface px-3.5 py-2.5 border border-line/60 shadow-sm">
              <FileText className="size-5 shrink-0 text-sky" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-ink">
                  {baseName(item.file.webkitRelativePath || item.file.name)}
                </p>
                <p className="text-[11px] tabular-nums text-muted">{formatBytes(item.file.size)}</p>
              </div>
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-full hover:bg-warn-soft text-muted hover:text-warn transition-colors"
                aria-label={`Remove ${item.file.name}`}
                onClick={() => setPicked(picked.filter((file) => file.key !== item.key))}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {notice ? <p className="mt-3 text-sm text-warn">{notice}</p> : null}

      <button
        type="button"
        disabled={picked.length === 0}
        onClick={onReview}
        className="mt-5 h-12 w-full rounded-2xl bg-sky font-semibold text-white shadow-lg shadow-sky/20 hover:bg-sky/95 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all"
      >
        {picked.length ? `Choose Device on Radar (${picked.length})` : "Select Files to Send"}
      </button>
    </div>
  );
}

function ReceiveScreen({
  room,
  name,
  peers,
  live,
  downloads,
  onJoin,
  onWeb,
  transferring,
  onMenu,
}: {
  room: string;
  name: string;
  peers: PeerInfo[];
  live: string[];
  downloads: DownloadReady[];
  onJoin: (room: string, origin?: string) => void;
  onWeb: () => void;
  transferring: boolean;
  onMenu: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      const page = new URL(window.location.href);
      page.search = `?room=${room}&join=1`;
      page.hash = "";
      await navigator.clipboard.writeText(page.toString());
      playChime("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex h-full flex-col bg-flicro-sky text-white select-none">
      <header className="safe-top flex shrink-0 items-center justify-between px-3 pt-3 pb-1">
        <button type="button" className="flex size-10 items-center justify-center rounded-full hover:bg-white/15 active:scale-95 transition-all" onClick={onMenu} aria-label="Menu">
          <Menu className="size-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="text-base font-bold">Waiting to Receive</h1>
          <p className="text-xs text-white/70">{name}</p>
        </div>
        <button
          type="button"
          onClick={copyCode}
          className="flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 px-3 py-1 text-xs font-bold tracking-wider uppercase backdrop-blur-md border border-white/30 transition-all active:scale-95"
          title="Click to copy invite link"
        >
          {copied ? <Check className="size-3 text-emerald-300" /> : <Copy className="size-3 opacity-80" />}
          <span>{formatCode(room)}</span>
        </button>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Radar peers={peers} live={live} mark={transferring ? "transfer" : "receive"} />
      </div>

      <div className="shrink-0 rounded-t-3xl bg-surface px-5 pt-4 pb-4 text-ink shadow-[0_-8px_30px_rgba(0,0,0,0.1)] border-t border-line/50">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted text-center">
          Join with Code
        </p>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = normalizeRoom(code);
            if (!next) {
              setError("Enter the 6-character code.");
              return;
            }
            if (next === room) {
              setError("You're already on this code.");
              return;
            }
            setError("");
            onJoin(next);
          }}
        >
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="Room code (e.g. ABC123)"
            aria-label="Code to join"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="h-12 min-w-0 flex-1 rounded-2xl border-2 border-slate-300 bg-white px-4 text-sm font-bold font-mono tracking-widest uppercase text-slate-900 placeholder:text-slate-400 placeholder:font-sans focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
          />
          <button type="submit" className="h-12 shrink-0 rounded-2xl bg-sky px-5 font-semibold text-white shadow-md hover:bg-sky/95 active:scale-95 transition-all">
            Join
          </button>
        </form>
        {error ? <p className="mt-2 text-xs text-warn text-center font-medium">{error}</p> : null}
        <button
          type="button"
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface hover:bg-bg font-semibold text-xs text-muted hover:text-ink transition-colors"
          onClick={onWeb}
        >
          <Monitor className="size-4" />
          <span>Connect with PC or Scanner</span>
        </button>
        {downloads.length > 0 ? (
          <ul className="mt-3 flex max-h-24 flex-col gap-2 overflow-y-auto">
            {downloads.map((file) => (
              <li key={file.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                <span className="text-sm text-muted">Saved</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function WebShare({ room, onJoin, onClose }: { room: string; onJoin: (room: string, origin?: string) => void; onClose: () => void }) {
  const [link, setLink] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    const page = new URL(window.location.href);
    page.search = `?room=${room}&join=1`;
    page.hash = "";
    const local = page.hostname === "localhost" || page.hostname === "127.0.0.1";
    setLink(local ? `flicro:${room}` : page.toString());
    return () => {
      stopRef.current = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [room]);

  function take(raw: string) {
    const parsed = parseJoinCode(raw, window.location.origin);
    if (!parsed) {
      setScanError("Invalid 6-character code.");
      return;
    }
    onJoin(parsed.room, parsed.origin);
  }

  async function copy(text: string) {
    const page = new URL(window.location.href);
    page.search = `?room=${room}&join=1`;
    page.hash = "";
    const share = page.hostname === "localhost" || page.hostname === "127.0.0.1" ? text : page.toString();
    try {
      await navigator.clipboard.writeText(share);
      setCopied(share.startsWith("flicro:") || !share.includes("://") ? "Code copied" : "Link copied");
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("Failed to copy");
      setTimeout(() => setCopied(""), 2000);
    }
  }

  async function scan() {
    setScanError("");
    if (scanning) {
      stopRef.current = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setScanning(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError("No camera support on this browser.");
      return;
    }

    stopRef.current = false;
    setScanning(true);

    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        // Fallback for laptops/webcams without environment lens
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      
      // Allow video element to mount
      setTimeout(async () => {
        const video = videoRef.current;
        if (!video || stopRef.current) {
          stream?.getTracks().forEach((track) => track.stop());
          return;
        }

        video.srcObject = stream;
        await video.play().catch(() => {});

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const started = Date.now();

        const tick = () => {
          if (stopRef.current || !streamRef.current) return;
          if (!ctx || video.readyState < 2) {
            requestAnimationFrame(tick);
            return;
          }

          if (Date.now() - started > 45000) {
            setScanError("No QR code detected. Try typing the code.");
            stream?.getTracks().forEach((track) => track.stop());
            setScanning(false);
            return;
          }

          const width = Math.min(video.videoWidth || 640, 720);
          const height = Math.max(1, Math.round(width * ((video.videoHeight || 640) / (video.videoWidth || 640))));
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(video, 0, 0, width, height);
          const image = ctx.getImageData(0, 0, width, height);
          const found = jsQR(image.data, width, height, { inversionAttempts: "attemptBoth" });
          const raw = found?.data ?? "";

          if (parseJoinCode(raw, window.location.origin)) {
            stream?.getTracks().forEach((track) => track.stop());
            setScanning(false);
            take(raw);
            return;
          }

          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, 50);
    } catch (err) {
      setScanning(false);
      setScanError("Camera access denied or unavailable.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface text-ink select-none overflow-hidden">
      {/* Clean compact header */}
      <header className="safe-top flex h-12 shrink-0 items-center justify-between border-b border-line px-3">
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-full hover:bg-bg active:scale-95 text-ink transition-all cursor-pointer"
          onClick={onClose}
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <span className="text-sm font-semibold">Pair Device</span>
        <div className="w-9" />
      </header>

      {/* Main compact body - fits on one screen without scrolling */}
      <div className="flex-1 flex flex-col items-center justify-between px-5 py-4 max-w-sm mx-auto w-full overflow-hidden">
        {/* Top: QR & Room Code */}
        <div className="flex flex-col items-center w-full">
          <div className="mt-1">
            {link ? <QrBlock value={link} /> : null}
          </div>

          {/* Pairing Code + Copy in one clean line */}
          <div className="mt-3 flex items-center gap-2">
            <span className="font-mono text-2xl font-bold tracking-widest text-sky">
              {formatCode(room)}
            </span>
            <button
              type="button"
              onClick={() => void copy(formatCode(room))}
              className="flex size-8 items-center justify-center rounded-lg border border-line hover:bg-bg text-muted hover:text-ink active:scale-95 transition-all cursor-pointer"
              title="Copy code"
            >
              <Copy className="size-4" />
            </button>
          </div>

          {/* Small clean copy link button */}
          <button
            type="button"
            className="mt-1.5 text-xs font-medium text-sky hover:underline flex items-center gap-1 cursor-pointer py-1"
            onClick={() => void copy(link)}
          >
            <span>{copied || "Copy share link"}</span>
          </button>
        </div>

        {/* Divider */}
        <div className="w-full my-1.5 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-[11px] text-muted uppercase font-medium">or join</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        {/* Bottom: Enter code & Scan */}
        <div className="w-full flex flex-col gap-2">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              take(code);
            }}
          >
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="Enter their code"
              aria-label="Code to join"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-sm font-mono font-semibold tracking-wider uppercase text-ink placeholder:text-muted placeholder:font-sans focus:border-sky focus:outline-none"
            />
            <button
              type="submit"
              className="h-10 shrink-0 rounded-xl bg-sky hover:bg-sky/90 px-4 text-xs font-semibold text-white active:scale-95 transition-all cursor-pointer"
            >
              Join
            </button>
          </form>

          <button
            type="button"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line hover:bg-bg text-xs font-semibold text-ink active:scale-95 transition-all cursor-pointer"
            onClick={() => void scan()}
          >
            <QrCode className="size-4 text-muted" />
            <span>{scanning ? "Stop camera" : "Scan camera"}</span>
          </button>

          {scanError ? (
            <p className="text-center text-xs text-warn font-medium">{scanError}</p>
          ) : null}
        </div>

        {/* Camera Viewfinder if scanning */}
        {scanning ? (
          <div className="relative mt-2 w-full overflow-hidden rounded-2xl border border-line bg-black">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted />
            <button
              type="button"
              onClick={() => {
                streamRef.current?.getTracks().forEach((track) => track.stop());
                setScanning(false);
              }}
              className="absolute top-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-black cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Activity({
  history,
  downloads,
  onClear,
}: {
  history: HistoryEntry[];
  downloads: DownloadReady[];
  onClear: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  async function saveFromHistory(entry: HistoryEntry, index: number) {
    const file = entry.files[index];
    if (!file) return;
    const live = downloads.find((item) => item.name === file.name && item.size === file.size);
    if (live) {
      saveBlob(live.blob, live.name);
      return;
    }
    if (file.opfsName) {
      const stored = await readOpfs(file.opfsName);
      if (stored) {
        saveBlob(stored, file.name);
        return;
      }
    }
    setNote("That copy is no longer on this device. Ask them to send it again.");
  }
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-4 pt-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">History</h1>
        {history.length > 0 ? (
          <button type="button" className="h-11 px-2 text-sm font-semibold text-warn" onClick={() => void onClear()}>
            Clear
          </button>
        ) : null}
      </div>
      {note ? <p className="text-sm text-warn">{note}</p> : null}
      {history.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-pretty text-muted">
          No transfers on this device yet. Only real sends and receives show up here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {history.map((entry) => (
            <li key={entry.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold">
                  {entry.direction === "sent" ? "Sent" : "Received"} · {entry.peer}
                </p>
                <p className="text-sm text-muted">{formatWhen(entry.at)}</p>
              </div>
              <p className="mt-1 text-sm text-muted">{entry.detail}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {entry.files.map((file, index) => (
                  <li key={`${entry.id}-${file.name}-${index}`} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                    <span className="text-sm tabular-nums text-muted">{formatBytes(file.size)}</span>
                    {entry.direction === "received" && entry.status === "received" ? (
                      <button type="button" className="h-11 px-2 text-sm font-semibold text-sky" onClick={() => void saveFromHistory(entry, index)}>
                        Save
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TransferSheet({
  outgoing,
  incoming,
  downloads,
  onAccept,
  onDecline,
  onCancel,
  onPause,
  onResume,
  onRetry,
  onDismiss,
  pauseReceive = false,
}: {
  outgoing: Outgoing | null;
  incoming: Incoming | null;
  downloads: DownloadReady[];
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
  onRetry: () => void;
  onDismiss: () => void;
  pauseReceive?: boolean;
}) {
  const current = incoming ?? outgoing;
  if (!current) return null;
  const percent = progressPercent(current.files, current.status);
  const waiting = current.status === "awaiting" || current.status === "receiving" || current.status === "sending" || current.status === "paused";
  const pace = rate(current);
  const total = current.files.reduce((sum, file) => sum + file.size, 0);
  const done = current.files.reduce((sum, file) => sum + file.done, 0);
  const eta = current.status === "paused" ? "Paused" : pace ? formatEta(total - done, pace.perSecond) : null;
  const busy = current.status === "sending" || current.status === "receiving" || current.status === "awaiting" || current.status === "paused";

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70" role="dialog" aria-modal="true" aria-label={sheetTitle(incoming, outgoing)}>
      <div className="dock w-full rounded-t-3xl bg-surface px-4 pt-4">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-pretty">{sheetTitle(incoming, outgoing)}</h2>
              {current.pro ? <p className="text-sm font-semibold text-leaf">Pro</p> : null}
              <p className="text-sm text-muted">
                {incoming?.status === "offered" && incoming.files.length === 0
                  ? "Accept to stay connected. Either device can send or receive."
                  : isTerminal(current.status)
                    ? "Still connected. Either device can send the next files."
                    : current.status === "offered" || current.status === "awaiting"
                      ? "They must accept before anything moves."
                      : "Sending straight between the devices."}
              </p>
            </div>
            {isTerminal(current.status) ? (
              <button type="button" className="flex size-11 items-center justify-center" onClick={onDismiss} aria-label="Close">
                <X className="size-5" />
              </button>
            ) : null}
          </div>
          <ul className="flex flex-col gap-1">
            {current.files.map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{file.name}</span>
                <span className="shrink-0 tabular-nums text-muted">{formatBytes(file.size)}</span>
              </li>
            ))}
          </ul>
          <LiveThumbs
            files={downloads
              .filter((file) => current.files.some((item) => item.id === file.id))
              .map((file) => ({ id: file.id, name: file.name, blob: file.blob }))}
          />
          {waiting || current.status === "done" ? (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="bar-fill h-full" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-1 text-sm tabular-nums text-muted">
                {percent}%{pace ? ` · ${pace.label}` : ""}
                {eta ? ` · ${eta}` : ""}
              </p>
            </div>
          ) : null}
          {current.error ? <p className="text-sm text-warn">{current.error}</p> : null}
          {current.status === "offered" ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="h-12 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer" onClick={onDecline}>
                Decline
              </button>
              <button type="button" className="h-12 rounded-2xl bg-[#1877f2] font-semibold text-white cursor-pointer" onClick={onAccept}>
                Accept
              </button>
            </div>
          ) : null}
          {outgoing?.status === "sending" || (pauseReceive && incoming?.status === "receiving") ? (
            <button type="button" className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer" onClick={onPause}>
              <Pause className="size-4" />
              Pause
            </button>
          ) : null}
          {outgoing?.status === "paused" || (pauseReceive && incoming?.status === "paused") ? (
            <button type="button" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-sky font-semibold text-white" onClick={onResume}>
              <Play className="size-4" />
              Resume
            </button>
          ) : null}
          {outgoing?.status === "failed" ? (
            <button type="button" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-sky font-semibold text-white" onClick={onRetry}>
              <RotateCcw className="size-4" />
              Retry
            </button>
          ) : null}
          {busy ? (
            <button type="button" className="h-12 rounded-2xl border border-line font-semibold text-warn" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
          {incoming?.status === "done" ? (
            <p className="text-center text-sm font-semibold text-muted">Saved to your gallery.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LiveThumbs({ files }: { files: { id: string; name: string; blob: Blob }[] }) {
  const [urls, setUrls] = useState<{ id: string; url: string; video: boolean }[]>([]);
  const signature = files.map((file) => `${file.id}:${file.blob.size}:${file.blob.type}`).join("|");
  useEffect(() => {
    const next = files
      .filter((file) => file.blob.type.startsWith("image/") || file.blob.type.startsWith("video/"))
      .slice(0, 12)
      .map((file) => ({
        id: file.id,
        url: URL.createObjectURL(file.blob),
        video: file.blob.type.startsWith("video/"),
      }));
    setUrls(next);
    return () => {
      for (const item of next) URL.revokeObjectURL(item.url);
    };
    // signature is the real change signal; files is read for the matching blobs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  if (!urls.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto">
      {urls.map((item) =>
        item.video ? (
          <video key={item.id} src={item.url} className="size-16 shrink-0 rounded-xl bg-bg object-cover" muted playsInline />
        ) : (
          <img key={item.id} src={item.url} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
        ),
      )}
    </div>
  );
}

function sheetSide<T extends { status: string }>(native: boolean, local: T | null, web: T | null): T | null {
  if (!native) return web;
  if (local && !isTerminal(local.status)) return local;
  if (web && !isTerminal(web.status)) return web;
  return local ?? web;
}

function spreadBytes(files: FileProgress[], bytes: number): FileProgress[] {
  let left = bytes;
  return files.map((file) => {
    const done = Math.min(file.size, Math.max(0, left));
    left -= done;
    return { ...file, done };
  });
}

function sheetTitle(incoming: Incoming | null, outgoing: Outgoing | null): string {
  if (incoming?.status === "offered") {
    if (incoming.files.length === 0) return `${incoming.peerName} wants to connect`;
    const count = incoming.files.length;
    return `${incoming.peerName} wants to send ${count} ${count === 1 ? "file" : "files"}`;
  }
  if (incoming?.status === "receiving") return `Receiving from ${incoming.peerName}`;
  if (incoming?.status === "done") return "Received";
  if (incoming?.status === "declined") return "Declined";
  if (incoming?.status === "cancelled") return "Cancelled";
  if (incoming?.status === "failed") return "Receive failed";
  if (outgoing?.status === "awaiting") return `Waiting for ${outgoing.peerName} to accept`;
  if (outgoing?.status === "sending") return `Sending to ${outgoing.peerName}`;
  if (outgoing?.status === "paused") return "Paused";
  if (outgoing?.status === "done") return `Delivered to ${outgoing.peerName}`;
  if (outgoing?.status === "declined") return `${outgoing.peerName} declined`;
  if (outgoing?.status === "cancelled") return "Cancelled";
  if (outgoing?.status === "failed") return "Send failed";
  return "Transfer";
}

function isTerminal(status: string) {
  return status === "done" || status === "declined" || status === "failed" || status === "cancelled";
}

function progressPercent(files: FileProgress[], status: string): number {
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const done = files.reduce((sum, file) => sum + file.done, 0);
  if (total <= 0) return status === "done" || status === "sending" || status === "receiving" ? 100 : 0;
  return Math.min(100, Math.round((done / total) * 100));
}

function rate(current: { startedAt: number | null; files: FileProgress[]; status: string }): { label: string; perSecond: number } | null {
  if (!current.startedAt) return null;
  if (current.status !== "sending" && current.status !== "receiving" && current.status !== "done" && current.status !== "paused") return null;
  const elapsed = (Date.now() - current.startedAt) / 1000;
  if (elapsed < 0.4) return null;
  const done = current.files.reduce((sum, file) => sum + file.done, 0);
  if (done <= 0) return null;
  const perSecond = done / elapsed;
  return { label: `${formatBytes(perSecond)}/s`, perSecond };
}

function QrBlock({ value }: { value: string }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let active = true;
    if (!value) return;

    QRCode.toString(value, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((markup) => {
        if (active) setSvg(markup);
      })
      .catch((err) => {
        console.error("QR Code generation error:", err);
      });

    return () => {
      active = false;
    };
  }, [value]);

  if (!svg) {
    return (
      <div className="flex h-36 w-36 items-center justify-center rounded-2xl bg-slate-50 border border-slate-200">
        <RefreshCw className="size-5 text-[#1877f2] animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="qr mx-auto w-40 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}


async function unlockBio(onUnlock: () => void, setError: (message: string) => void) {
  const stored = loadBio();
  if (!stored || !window.PublicKeyCredential) {
    setError("Fingerprint or face isn't set up.");
    return;
  }
  try {
    const raw = atob(stored);
    const id = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) id[i] = raw.charCodeAt(i);
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id }],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    if (cred) onUnlock();
    else setError("Unlock was cancelled.");
  } catch {
    setError("Fingerprint or face didn't unlock.");
  }
}
