import { useEffect, useRef, useState } from "react";
import { FlicroSession, type DownloadReady, type Snap } from "./engine";
import type { HistoryEntry } from "./storage";

const EMPTY: Snap = { joined: false, peers: [], live: [], paired: [], outgoing: null, incoming: null };

export function useFlicro(args: {
  room: string;
  selfId: string;
  name: string;
  signalBase?: string;
  onDownload: (file: DownloadReady) => void;
  onHistory: (entry: HistoryEntry) => void;
}) {
  const [snap, setSnap] = useState<Snap>(EMPTY);
  const ref = useRef<FlicroSession | null>(null);
  const cb = useRef(args);
  cb.current = args;

  useEffect(() => {
    const session = new FlicroSession({
      room: args.room,
      selfId: args.selfId,
      name: args.name,
      signalBase: args.signalBase,
      onDownload: (file) => cb.current.onDownload(file),
      onHistory: (entry) => cb.current.onHistory(entry),
      onChange: setSnap,
    });
    ref.current = session;
    return () => {
      session.close();
      if (ref.current === session) ref.current = null;
    };
    // The room and this tab's id define the link. Name updates are separate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.room, args.selfId, args.signalBase]);

  useEffect(() => {
    ref.current?.setName(args.name);
  }, [args.name]);

  return {
    snap,
    send: (files: File[], peerId: string, pro = false) => ref.current?.send(files, peerId, pro) ?? "The link is still starting.",
    requestLink: (peerId: string) => ref.current?.requestLink(peerId),
    accept: () => ref.current?.accept(),
    decline: () => ref.current?.decline(),
    cancel: () => ref.current?.cancel(),
    pause: () => ref.current?.pause(),
    resume: () => ref.current?.resume(),
    retry: () => ref.current?.retry() ?? "Still starting.",
    dismiss: () => ref.current?.dismiss(),
  };
}
