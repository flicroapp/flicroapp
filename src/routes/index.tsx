import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FlicroApp } from "@/components/flicro-app";
import { formatCode } from "@/lib/flicro/format";
import { getPeerId, loadName } from "@/lib/flicro/storage";

type Search = { room?: string; join?: number };

async function discoverRoom(): Promise<string> {
  try {
    const data = (await fetch(new URL("/api/nearby", window.location.origin)).then((res) => res.json())) as { room?: string };
    if (data.room && /^[a-z0-9]{6}$/.test(data.room)) return data.room;
  } catch {
    /* same code even if the lookup is slow */
  }
  return "nearby";
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const room = search.room;
    const next: Search = {};
    if (typeof room === "string" && /^[a-z0-9]{6}$/.test(room)) next.room = room;
    if (search.join === "1" || search.join === 1) next.join = 1;
    return next;
  },
  component: Page,
});

function Page() {
  const { room: urlRoom, join } = Route.useSearch();
  const navigate = useNavigate();
  const [peerId, setPeerId] = useState("");
  const [name, setName] = useState("");
  const [signalBase, setSignalBase] = useState("");
  const hold = useState({ current: false })[0];
  const opened = useRef(false);

  useEffect(() => {
    const id = getPeerId();
    setPeerId(id);
    setName(loadName(id));
    if (!opened.current) {
      opened.current = true;
      sessionStorage.removeItem("flicro-manual");
    }
    let stop = false;
    const look = async () => {
      if (sessionStorage.getItem("flicro-manual")) return;
      try {
        const room = await discoverRoom();
        if (stop || sessionStorage.getItem("flicro-manual")) return;
        if (room !== urlRoom) await navigate({ to: "/", search: { room }, replace: true });
      } catch {
        if (!stop && !urlRoom && !sessionStorage.getItem("flicro-manual")) {
          await navigate({ to: "/", search: { room: "nearby" }, replace: true });
        }
      }
    };
    void look();
    const timer = window.setInterval(() => void look(), 1200);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [urlRoom, join, navigate]);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-flicro-sky text-white">
      {urlRoom && peerId && name ? (
        <FlicroApp
          room={urlRoom}
          selfId={peerId}
          name={name}
          onName={(next) => setName(next)}
          signalBase={signalBase}
          onJoin={(room, origin) => {
            sessionStorage.setItem("flicro-manual", room);
            const base = origin && origin !== window.location.origin ? origin : "";
            if (base) sessionStorage.setItem("flicro-signal", base);
            else sessionStorage.removeItem("flicro-signal");
            setSignalBase(base);
            void navigate({ to: "/", search: { room, join: 1 } });
          }}
          onHold={(yes) => {
            hold.current = yes;
          }}
          onWifi={() => {
            sessionStorage.removeItem("flicro-manual");
            sessionStorage.removeItem("flicro-signal");
            setSignalBase("");
            void discoverRoom().then((room) => {
              if (room) void navigate({ to: "/", search: { room }, replace: true });
            });
          }}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-flicro-sky text-white">
          <div className="size-16 rounded-2xl bg-white/20 p-3 backdrop-blur-md">
            <div className="h-full w-full rounded-xl bg-white/40" />
          </div>
          <p className="mt-4 text-2xl font-bold tracking-tight">Flicro</p>
          <p className="mt-1 text-sm text-white/80">
            {urlRoom ? `Starting ${formatCode(urlRoom)}…` : "Getting a code ready…"}
          </p>
        </div>
      )}
    </div>
  );
}
