import { useEffect, useRef, useState } from "react";
import { FlicroApp } from "@/components/flicro-app";
import { getPeerId, loadName } from "@/lib/flicro/storage";

type Boot = { id: string; name: string; room: string; join: boolean };

function readBoot(): Boot {
  const id = getPeerId();
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("room");
  const joined = params.get("join") === "1" && Boolean(fromUrl);
  const room = joined && fromUrl && /^[a-z0-9]{6}$/.test(fromUrl) ? fromUrl : "nearby";
  return { id, name: loadName(id), room, join: joined };
}

/** Nearby room lookup is optional. A missing server must not block the screen. */
async function discoverRoom(): Promise<string> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 1200);
  try {
    const res = await fetch(new URL("/api/nearby", window.location.origin), { signal: ctrl.signal });
    if (!res.ok) return "nearby";
    const data = (await res.json()) as { room?: string };
    return data.room && /^[a-z0-9]{6}$/.test(data.room) ? data.room : "nearby";
  } catch {
    return "nearby";
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Installed-app shell. Laptop, iPhone, and Android share one web room.
 * Wi-Fi Direct and Multipeer still find same-platform phones on the local link.
 */
export function NativeRoot() {
  const boot = useState(readBoot)[0];
  const [room, setRoom] = useState(boot.room);
  const [name, setName] = useState(boot.name);
  const [signalBase, setSignalBase] = useState("");
  const hold = useRef(false);
  const manual = useRef(false);

  useEffect(() => {
    let stop = false;
    const look = async () => {
      if (manual.current || sessionStorage.getItem("flicro-manual")) return;
      const next = await discoverRoom();
      if (!stop && next) setRoom(next);
    };
    void look();
    const timer = window.setInterval(() => void look(), 1200);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [boot.id]);

  return (
    <div className="h-full w-full overflow-hidden bg-field text-ink">
      <FlicroApp
        room={room}
        selfId={boot.id}
        name={name}
        onName={(next) => setName(next)}
        signalBase={signalBase}
        onJoin={(next, origin) => {
          manual.current = true;
          sessionStorage.setItem("flicro-manual", next);
          const base = origin && origin !== window.location.origin ? origin : "";
          if (base) sessionStorage.setItem("flicro-signal", base);
          else sessionStorage.removeItem("flicro-signal");
          setSignalBase(base);
          setRoom(next);
          const url = new URL(window.location.href);
          url.searchParams.set("room", next);
          url.searchParams.set("join", "1");
          history.replaceState(null, "", `${url.pathname}${url.search}`);
        }}
        onHold={(yes) => {
          hold.current = yes;
        }}
        onWifi={() => {
          manual.current = false;
          sessionStorage.removeItem("flicro-manual");
          sessionStorage.removeItem("flicro-signal");
          setSignalBase("");
          void discoverRoom().then((next) => {
            if (next) setRoom(next);
          });
        }}
      />
    </div>
  );
}
