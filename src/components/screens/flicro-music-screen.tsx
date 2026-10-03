import { useState, useRef, useEffect } from "react";
import {
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Plus,
  Headphones,
  Check,
  Trash2,
  Disc,
} from "lucide-react";
import { formatBytes } from "@/lib/flicro/format";
import { playChime } from "@/lib/flicro/sound";

interface Track {
  id: string;
  name: string;
  artist: string;
  size: number;
  file: File;
  url: string;
}

export function MusicScreen() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeSong = currentTrackIndex !== null && tracks[currentTrackIndex] ? tracks[currentTrackIndex] : null;

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleDurationChange = () => {
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      handleNext();
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  // Update audio source when track changes
  useEffect(() => {
    if (!audioRef.current) return;
    if (activeSong) {
      audioRef.current.src = activeSong.url;
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      }
    } else {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  }, [currentTrackIndex, activeSong]);

  const togglePlay = () => {
    if (!audioRef.current || !activeSong) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const handleNext = () => {
    if (tracks.length === 0) return;
    const nextIdx = currentTrackIndex === null ? 0 : (currentTrackIndex + 1) % tracks.length;
    setCurrentTrackIndex(nextIdx);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    if (tracks.length === 0) return;
    const prevIdx =
      currentTrackIndex === null ? 0 : (currentTrackIndex - 1 + tracks.length) % tracks.length;
    setCurrentTrackIndex(prevIdx);
    setIsPlaying(true);
  };

  const handleImportMusic = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newTracks: Track[] = Array.from(files).map((f, i) => ({
      id: `track-${Date.now()}-${i}`,
      name: f.name.replace(/\.[^/.]+$/, ""),
      artist: "Local Audio",
      size: f.size,
      file: f,
      url: URL.createObjectURL(f),
    }));

    setTracks((prev) => [...newTracks, ...prev]);
    if (currentTrackIndex === null && newTracks.length > 0) {
      setCurrentTrackIndex(0);
    }
    playChime("success");
  };

  const handleDeleteTrack = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    playChime("drop");
    const toDelete = tracks[idx];
    if (toDelete?.url) URL.revokeObjectURL(toDelete.url);

    const updated = tracks.filter((_, i) => i !== idx);
    setTracks(updated);

    if (currentTrackIndex === idx) {
      if (updated.length > 0) {
        setCurrentTrackIndex(Math.min(idx, updated.length - 1));
      } else {
        setCurrentTrackIndex(null);
        setIsPlaying(false);
      }
    } else if (currentTrackIndex !== null && currentTrackIndex > idx) {
      setCurrentTrackIndex(currentTrackIndex - 1);
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex h-full w-full flex-col bg-[#f8fafc] text-slate-800 select-none overflow-y-auto font-sans">
      {/* Header */}
      <header className="safe-top flex shrink-0 items-center justify-between px-4 py-2.5 bg-white border-b border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-blue-50 text-[#1877f2] flex items-center justify-center">
            <Music className="size-4" />
          </div>
          <h1 className="text-base font-bold text-slate-900">Music</h1>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1877f2] text-white text-xs font-semibold hover:bg-[#1466e3] active:scale-95 transition-all shadow-xs cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>Add Music</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 px-4 py-3 max-w-lg mx-auto w-full space-y-3">
        {/* Now Playing Widget */}
        {activeSong && (
          <div className="rounded-2xl bg-gradient-to-br from-[#1877f2] to-[#1462cb] p-4 text-white shadow-md shadow-blue-500/15 space-y-3">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/25">
                <Disc className={`size-6 text-white ${isPlaying ? "animate-spin" : ""}`} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-white truncate">{activeSong.name}</h2>
                <p className="text-[11px] text-white/80">{formatBytes(activeSong.size)}</p>
              </div>
            </div>

            {/* Audio Progress Bar */}
            <div className="space-y-1">
              <div
                className="h-1.5 w-full rounded-full bg-white/25 overflow-hidden cursor-pointer"
                onClick={(e) => {
                  if (!audioRef.current || !duration) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const newTime = (clickX / rect.width) * duration;
                  audioRef.current.currentTime = newTime;
                  setCurrentTime(newTime);
                }}
              >
                <div
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-white/80 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-5 pt-0.5">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1.5 rounded-full hover:bg-white/20 active:scale-90 transition-transform cursor-pointer"
                aria-label="Previous"
              >
                <SkipBack className="size-4.5 text-white" />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                className="size-9 rounded-full bg-white text-[#1877f2] flex items-center justify-center shadow-sm active:scale-95 transition-transform cursor-pointer"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="size-4.5 fill-[#1877f2]" />
                ) : (
                  <Play className="size-4.5 fill-[#1877f2] translate-x-0.5" />
                )}
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-1.5 rounded-full hover:bg-white/20 active:scale-90 transition-transform cursor-pointer"
                aria-label="Next"
              >
                <SkipForward className="size-4.5 text-white" />
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {tracks.length === 0 && (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-slate-100 flex flex-col items-center justify-center space-y-3 my-4">
            <div className="size-12 rounded-2xl bg-blue-50 text-[#1877f2] flex items-center justify-center">
              <Music className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-800">No Music Loaded</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                Add MP3, WAV, or AAC audio files from your device for offline playback.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-[#1877f2] hover:bg-[#1466e3] text-white font-semibold text-xs shadow-xs active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="size-3.5" />
              Select Audio Files
            </button>
          </div>
        )}

        {/* Tracks List */}
        {tracks.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100/80">
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-700">All Songs ({tracks.length})</span>
              <span className="text-[10px] text-slate-400">Offline playback</span>
            </div>

            {tracks.map((track, idx) => {
              const isCurrent = currentTrackIndex === idx;
              return (
                <div
                  key={track.id}
                  onClick={() => {
                    setCurrentTrackIndex(idx);
                    setIsPlaying(true);
                    if (audioRef.current) {
                      audioRef.current.src = track.url;
                      audioRef.current.play().catch(() => {});
                    }
                  }}
                  className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                    isCurrent ? "bg-blue-50/70 text-[#1877f2]" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="size-6 rounded-md bg-slate-100 flex items-center justify-center text-[11px] font-semibold text-slate-600 shrink-0">
                      {isCurrent && isPlaying ? (
                        <span className="size-2 rounded-full bg-[#1877f2] animate-pulse" />
                      ) : (
                        idx + 1
                      )}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-semibold truncate ${
                          isCurrent ? "text-[#1877f2]" : "text-slate-800"
                        }`}
                      >
                        {track.name}
                      </p>
                      <p className="text-[10px] text-slate-400">{formatBytes(track.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleDeleteTrack(idx, e)}
                      className="p-1 text-slate-300 hover:text-rose-500 rounded transition-colors cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="sr-only"
        onChange={(e) => handleImportMusic(e.target.files)}
      />
    </div>
  );
}
