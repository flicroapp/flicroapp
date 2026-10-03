import { useState, useRef, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  Check,
  Folder,
  FileText,
  Video,
  Music,
  UserRound,
  FileSpreadsheet,
  FileCode,
  File as FileIcon,
  ChevronUp,
  Plus,
  Image as ImageIcon,
  Trash2,
  Upload,
} from "lucide-react";
import { formatBytes } from "@/lib/flicro/format";
import { playChime } from "@/lib/flicro/sound";

interface SelectFilesScreenProps {
  onBack: () => void;
  onSend: (files: File[]) => void;
  pickedCount: number;
}

type CategoryTab = "files" | "photos" | "videos" | "music" | "contacts" | "more";
type PhotoSubTab = "recent" | "folders";

interface ContactItem {
  id: string;
  name: string;
  phone?: string;
  initial: string;
}

const ALPHABET_RAIL = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "#"
];

export function SelectFilesScreen({ onBack, onSend, pickedCount }: SelectFilesScreenProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryTab>("photos");
  const [photoSubTab, setPhotoSubTab] = useState<PhotoSubTab>("recent");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // Real user files from their actual device
  const [userPhotos, setUserPhotos] = useState<File[]>([]);
  const [userDocs, setUserDocs] = useState<File[]>([]);
  const [userVideos, setUserVideos] = useState<File[]>([]);
  const [userAudio, setUserAudio] = useState<File[]>([]);
  const [contactsList, setContactsList] = useState<ContactItem[]>(() => {
    try {
      const saved = localStorage.getItem("flicro_contacts");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const vcfInputRef = useRef<HTMLInputElement>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      playChime("drop");
      return next;
    });
  };

  const openDocPicker = (ext?: string) => {
    if (docInputRef.current) {
      if (ext) docInputRef.current.accept = ext;
      else docInputRef.current.removeAttribute("accept");
      docInputRef.current.click();
    }
  };

  const handleSendSelected = () => {
    const chosenFiles: File[] = [];

    // 1. Real picked device photos
    userPhotos.forEach((file) => {
      const photoId = `user-photo-${file.name}-${file.lastModified}`;
      if (selectedIds[photoId]) {
        chosenFiles.push(file);
      }
    });

    // 2. Real picked device docs
    userDocs.forEach((file) => {
      const docId = `user-doc-${file.name}-${file.lastModified}`;
      if (selectedIds[docId]) {
        chosenFiles.push(file);
      }
    });

    // 3. Real picked device videos
    userVideos.forEach((file) => {
      const vidId = `user-video-${file.name}-${file.lastModified}`;
      if (selectedIds[vidId]) {
        chosenFiles.push(file);
      }
    });

    // 4. Real picked device audio
    userAudio.forEach((file) => {
      const audId = `user-audio-${file.name}-${file.lastModified}`;
      if (selectedIds[audId]) {
        chosenFiles.push(file);
      }
    });

    // 5. Selected contacts converted to genuine RFC-6350 vCards
    contactsList.forEach((contact) => {
      if (selectedIds[contact.id]) {
        const vcard = `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${contact.name}\r\nTEL;TYPE=CELL:${contact.phone || ""}\r\nEND:VCARD\r\n`;
        chosenFiles.push(
          new File([new Blob([vcard], { type: "text/vcard" })], `${contact.name}.vcf`, {
            type: "text/vcard",
            lastModified: Date.now(),
          })
        );
      }
    });

    if (chosenFiles.length === 0) {
      showToast("Please select at least one file or contact to send.");
      playChime("drop");
      return;
    }

    playChime("success");
    onSend(chosenFiles);
  };

  // Group user photos by date
  const groupedPhotos = useMemo(() => {
    const groups: Record<string, { label: string; photos: File[] }> = {};
    userPhotos.forEach((p) => {
      const date = new Date(p.lastModified);
      const isToday = new Date().toDateString() === date.toDateString();
      const key = isToday ? "Today" : date.toISOString().slice(0, 10);
      if (!groups[key]) {
        groups[key] = { label: key, photos: [] };
      }
      groups[key].photos.push(p);
    });
    return groups;
  }, [userPhotos]);

  const totalSelected = Object.values(selectedIds).filter(Boolean).length;

  return (
    <div className="flex h-full w-full flex-col bg-[#f8fafd] text-slate-900 select-none overflow-hidden font-sans">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-xl border border-white/10 animate-in fade-in duration-150">
          {toastMessage}
        </div>
      )}

      {/* Top Header */}
      <header className="safe-top flex shrink-0 items-center justify-between px-4 pt-3 pb-2 bg-white border-b border-slate-100">
        <button
          type="button"
          onClick={onBack}
          className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100 active:scale-95 text-slate-800 cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="size-6 stroke-[2.4]" />
        </button>
        <h1 className="text-base sm:text-lg font-bold text-slate-900">Select Files</h1>
        <div className="size-10" />
      </header>

      {/* Horizontal Category Tabs: Files | Photos | Videos | Music | Contacts | More */}
      <div className="shrink-0 bg-white border-b border-slate-100 px-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center min-w-max">
          {(
            [
              { id: "files", label: "Files" },
              { id: "photos", label: "Photos" },
              { id: "videos", label: "Videos" },
              { id: "music", label: "Music" },
              { id: "contacts", label: "Contacts" },
              { id: "more", label: "More" },
            ] as const
          ).map((tab) => {
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`relative px-4 py-3 text-sm font-semibold transition-colors cursor-pointer ${
                  isActive ? "text-[#1877f2] font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-[#1877f2]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* ================= PHOTOS TAB ================= */}
        {activeCategory === "photos" && (
          <div className="p-4 space-y-4">
            {/* Sub-segmented control: Recent | FOLDERS */}
            <div className="flex rounded-2xl bg-slate-200/70 p-1 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setPhotoSubTab("recent")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  photoSubTab === "recent"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Recent
              </button>
              <button
                type="button"
                onClick={() => setPhotoSubTab("folders")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl uppercase transition-all cursor-pointer ${
                  photoSubTab === "folders"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                FOLDERS
              </button>
            </div>

            {/* Sub-tab 1: Recent Photo Grid */}
            {photoSubTab === "recent" && (
              <div className="space-y-4">
                {/* Real Action Tiles: Camera & Add Photos */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Tile 1: Camera tile */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="aspect-square rounded-2xl bg-[#e0f2fe] flex flex-col items-center justify-center text-[#0284c7] hover:bg-[#bae6fd] active:scale-95 transition-all cursor-pointer shadow-sm border border-blue-100"
                  >
                    <Camera className="size-8 stroke-[2.2]" />
                    <span className="text-xs font-bold mt-1 text-[#0369a1]">Camera</span>
                  </button>

                  {/* Tile 2: Pick real device photos */}
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="aspect-square rounded-2xl bg-[#eef2f6] flex flex-col items-center justify-center text-slate-700 hover:bg-slate-200 active:scale-95 transition-all cursor-pointer shadow-sm border border-slate-200"
                  >
                    <ImageIcon className="size-7 stroke-[2] text-[#1877f2]" />
                    <span className="text-xs font-bold mt-1 text-slate-800">+ Add Photos</span>
                  </button>

                  {userPhotos.length === 0 && (
                    <div className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-2 text-center text-slate-400">
                      <span className="text-[11px] font-medium leading-tight">Pick photos from device</span>
                    </div>
                  )}
                </div>

                {/* Real User Photos by Groups */}
                {Object.keys(groupedPhotos).length > 0 ? (
                  Object.entries(groupedPhotos).map(([groupKey, group]) => {
                    const allInGroupSelected = group.photos.every((p) =>
                      Boolean(selectedIds[`user-photo-${p.name}-${p.lastModified}`])
                    );

                    return (
                      <div key={groupKey} className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                          <span className="flex items-center gap-1">
                            <span>⌵</span> {group.label} ({group.photos.length})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...selectedIds };
                              group.photos.forEach((p) => {
                                const id = `user-photo-${p.name}-${p.lastModified}`;
                                updated[id] = !allInGroupSelected;
                              });
                              setSelectedIds(updated);
                            }}
                            className={`size-5 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer ${
                              allInGroupSelected
                                ? "bg-[#1877f2] border-[#1877f2] text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {allInGroupSelected && <Check className="size-3 stroke-[3]" />}
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {group.photos.map((photo) => {
                            const photoId = `user-photo-${photo.name}-${photo.lastModified}`;
                            const isSelected = Boolean(selectedIds[photoId]);
                            const url = URL.createObjectURL(photo);

                            return (
                              <div
                                key={photoId}
                                onClick={() => toggleSelect(photoId)}
                                className="relative aspect-square rounded-2xl overflow-hidden bg-slate-200 cursor-pointer shadow-sm group border border-slate-200/60"
                              >
                                <img
                                  src={url}
                                  alt={photo.name}
                                  className="size-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div
                                  className={`absolute top-2 right-2 flex size-6 items-center justify-center rounded-full transition-all ${
                                    isSelected
                                      ? "bg-[#1877f2] border-2 border-white text-white shadow-md scale-105"
                                      : "border-2 border-white/90 bg-black/25 backdrop-blur-[1px]"
                                  }`}
                                >
                                  {isSelected && <Check className="size-3.5 stroke-[3]" />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <p className="text-sm font-semibold">No photos selected from device</p>
                    <p className="text-xs">Tap Camera or &ldquo;+ Add Photos&rdquo; above to load real photos.</p>
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 2: Folders list */}
            {photoSubTab === "folders" && (
              <div className="space-y-2.5">
                {userPhotos.length > 0 ? (
                  <div
                    onClick={() => {
                      const all = userPhotos.every((p) =>
                        Boolean(selectedIds[`user-photo-${p.name}-${p.lastModified}`])
                      );
                      const updated = { ...selectedIds };
                      userPhotos.forEach((p) => {
                        updated[`user-photo-${p.name}-${p.lastModified}`] = !all;
                      });
                      setSelectedIds(updated);
                    }}
                    className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight className="size-4 text-slate-400 stroke-[2.5]" />
                      <span className="text-sm font-bold text-slate-800">Device Photos</span>
                      <span className="text-xs text-slate-400">({userPhotos.length})</span>
                    </div>
                    <div
                      className={`size-5 rounded-full border-2 flex items-center justify-center ${
                        userPhotos.every((p) => selectedIds[`user-photo-${p.name}-${p.lastModified}`])
                          ? "bg-[#1877f2] border-[#1877f2] text-white"
                          : "border-slate-300"
                      }`}
                    >
                      {userPhotos.every((p) => selectedIds[`user-photo-${p.name}-${p.lastModified}`]) && (
                        <Check className="size-3 stroke-[3]" />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center text-slate-400 space-y-1">
                    <p className="text-sm font-semibold">No folders</p>
                    <p className="text-xs">Add photos to view your device albums here.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= FILES TAB ================= */}
        {activeCategory === "files" && (
          <div className="p-4 space-y-4">
            {/* White Documents card */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 mb-4">Documents</h2>

              {/* Grid of 7 document picker categories */}
              <div className="grid grid-cols-4 gap-4 sm:gap-6 text-center">
                {/* 1. ALL */}
                <button
                  type="button"
                  onClick={() => openDocPicker()}
                  className="flex flex-col items-center group cursor-pointer"
                >
                  <div className="size-14 rounded-2xl flex items-center justify-center transition-all bg-blue-50 text-[#1877f2] group-hover:scale-105 active:scale-95 shadow-sm">
                    <Folder className="size-8 fill-[#1877f2]" />
                  </div>
                  <span className="mt-2 text-xs font-bold text-slate-800">ALL</span>
                </button>

                {/* 2. PDF */}
                <button
                  type="button"
                  onClick={() => openDocPicker(".pdf")}
                  className="flex flex-col items-center group cursor-pointer"
                >
                  <div className="size-14 rounded-2xl flex items-center justify-center transition-all bg-rose-50 text-rose-500 group-hover:scale-105 active:scale-95 shadow-sm">
                    <FileText className="size-8 stroke-[2.2]" />
                  </div>
                  <span className="mt-2 text-xs font-bold text-slate-800">PDF</span>
                </button>

                {/* 3. EXCEL */}
                <button
                  type="button"
                  onClick={() => openDocPicker(".xls,.xlsx,.csv")}
                  className="flex flex-col items-center group cursor-pointer"
                >
                  <div className="size-14 rounded-2xl flex items-center justify-center transition-all bg-emerald-50 text-emerald-500 group-hover:scale-105 active:scale-95 shadow-sm">
                    <FileSpreadsheet className="size-8 stroke-[2.2]" />
                  </div>
                  <span className="mt-2 text-xs font-bold text-slate-800">EXCEL</span>
                </button>

                {/* 4. PPT */}
                <button
                  type="button"
                  onClick={() => openDocPicker(".ppt,.pptx")}
                  className="flex flex-col items-center group cursor-pointer"
                >
                  <div className="size-14 rounded-2xl flex items-center justify-center transition-all bg-orange-50 text-orange-500 group-hover:scale-105 active:scale-95 shadow-sm">
                    <FileIcon className="size-8 stroke-[2.2]" />
                  </div>
                  <span className="mt-2 text-xs font-bold text-slate-800">PPT</span>
                </button>

                {/* 5. TXT */}
                <button
                  type="button"
                  onClick={() => openDocPicker(".txt,.md")}
                  className="flex flex-col items-center group cursor-pointer"
                >
                  <div className="size-14 rounded-2xl flex items-center justify-center transition-all bg-purple-50 text-purple-500 group-hover:scale-105 active:scale-95 shadow-sm">
                    <FileText className="size-8 stroke-[2.2]" />
                  </div>
                  <span className="mt-2 text-xs font-bold text-slate-800">TXT</span>
                </button>

                {/* 6. DOC */}
                <button
                  type="button"
                  onClick={() => openDocPicker(".doc,.docx")}
                  className="flex flex-col items-center group cursor-pointer"
                >
                  <div className="size-14 rounded-2xl flex items-center justify-center transition-all bg-sky-50 text-sky-500 group-hover:scale-105 active:scale-95 shadow-sm">
                    <FileText className="size-8 stroke-[2.2]" />
                  </div>
                  <span className="mt-2 text-xs font-bold text-slate-800">DOC</span>
                </button>

                {/* 7. WPS */}
                <button
                  type="button"
                  onClick={() => openDocPicker(".wps")}
                  className="flex flex-col items-center group cursor-pointer"
                >
                  <div className="size-14 rounded-2xl flex items-center justify-center transition-all bg-blue-50 text-blue-600 group-hover:scale-105 active:scale-95 shadow-sm">
                    <FileCode className="size-8 stroke-[2.2]" />
                  </div>
                  <span className="mt-2 text-xs font-bold text-slate-800">WPS</span>
                </button>
              </div>
            </div>

            {/* Real device picked documents */}
            {userDocs.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Selected Documents ({userDocs.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => openDocPicker()}
                    className="text-xs font-bold text-[#1877f2] hover:underline cursor-pointer"
                  >
                    + Add More
                  </button>
                </div>
                <div className="divide-y divide-slate-100 bg-white rounded-2xl p-2 shadow-sm border border-slate-100">
                  {userDocs.map((doc) => {
                    const docId = `user-doc-${doc.name}-${doc.lastModified}`;
                    const isSelected = Boolean(selectedIds[docId]);
                    return (
                      <div
                        key={docId}
                        onClick={() => toggleSelect(docId)}
                        className="py-3 px-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded-xl"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-10 rounded-xl bg-blue-50 text-[#1877f2] flex items-center justify-center shrink-0">
                            <FileText className="size-5" />
                          </div>
                          <div className="min-w-0 truncate">
                            <p className="text-xs font-bold text-slate-900 truncate">{doc.name}</p>
                            <p className="text-[10px] text-slate-400">{formatBytes(doc.size)}</p>
                          </div>
                        </div>
                        <div
                          className={`size-5 rounded-full border-2 flex items-center justify-center ml-2 shrink-0 ${
                            isSelected ? "bg-[#1877f2] border-[#1877f2] text-white" : "border-slate-300"
                          }`}
                        >
                          {isSelected && <Check className="size-3 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 space-y-1">
                <p className="text-sm font-semibold">No documents added</p>
                <p className="text-xs">Tap any category icon above to select real files from your device.</p>
              </div>
            )}
          </div>
        )}

        {/* ================= VIDEOS TAB ================= */}
        {activeCategory === "videos" && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Device Videos</h2>
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="text-xs font-bold text-[#1877f2] hover:underline cursor-pointer"
              >
                + Add Video
              </button>
            </div>

            {userVideos.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {userVideos.map((v) => {
                  const vidId = `user-video-${v.name}-${v.lastModified}`;
                  const isSelected = Boolean(selectedIds[vidId]);
                  const videoUrl = URL.createObjectURL(v);

                  return (
                    <div
                      key={vidId}
                      onClick={() => toggleSelect(vidId)}
                      className="relative h-36 rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 cursor-pointer group"
                    >
                      <video
                        src={videoUrl}
                        className="size-full object-cover"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                        <Video className="size-8 text-white/90" />
                      </div>
                      <div className="absolute bottom-2 left-2 right-2 text-white text-[10px] font-bold truncate drop-shadow">
                        {v.name} · {formatBytes(v.size)}
                      </div>
                      <div
                        className={`absolute top-2 right-2 size-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? "bg-[#1877f2] border-white text-white" : "border-white/80 bg-black/30"
                        }`}
                      >
                        {isSelected && <Check className="size-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Video className="size-10 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold">No videos selected</p>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-[#1877f2] text-white text-xs font-bold hover:bg-[#1466e3] active:scale-95 cursor-pointer shadow-sm"
                >
                  Select Videos from Device
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= MUSIC TAB ================= */}
        {activeCategory === "music" && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Audio Tracks</h2>
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="text-xs font-bold text-[#1877f2] hover:underline cursor-pointer"
              >
                + Add Audio
              </button>
            </div>

            {userAudio.length > 0 ? (
              <div className="divide-y divide-slate-100 bg-white rounded-2xl p-2 shadow-sm border border-slate-100">
                {userAudio.map((a) => {
                  const audId = `user-audio-${a.name}-${a.lastModified}`;
                  const isSelected = Boolean(selectedIds[audId]);
                  return (
                    <div
                      key={audId}
                      onClick={() => toggleSelect(audId)}
                      className="py-3 px-2 flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded-xl"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-9 rounded-xl bg-blue-50 text-[#1877f2] flex items-center justify-center shrink-0">
                          <Music className="size-5" />
                        </div>
                        <div className="min-w-0 truncate">
                          <p className="text-xs font-bold text-slate-900 truncate">{a.name}</p>
                          <p className="text-[10px] text-slate-400">{formatBytes(a.size)}</p>
                        </div>
                      </div>
                      <div
                        className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-[#1877f2] border-[#1877f2] text-white" : "border-slate-300"
                        }`}
                      >
                        {isSelected && <Check className="size-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Music className="size-10 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold">No audio files selected</p>
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-[#1877f2] text-white text-xs font-bold hover:bg-[#1466e3] active:scale-95 cursor-pointer shadow-sm"
                >
                  Select Audio from Device
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= CONTACTS TAB ================= */}
        {activeCategory === "contacts" && (
          <div className="space-y-1">
            {/* Header: Contacts count + Import button */}
            <div className="flex items-center justify-between px-5 pt-3 pb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-800">
                  Contacts ({contactsList.length})
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    if ("contacts" in navigator && "ContactsManager" in window) {
                      try {
                        // @ts-expect-error navigator.contacts API
                        const results = await navigator.contacts.select(["name", "tel"], { multiple: true });
                        if (results && results.length > 0) {
                          const imported: ContactItem[] = results.map(
                            (c: { name?: string[]; tel?: string[] }, i: number) => ({
                              id: `imported-${Date.now()}-${i}`,
                              name: c.name?.[0] || "Contact",
                              phone: c.tel?.[0] || "",
                              initial: (c.name?.[0] || "C")[0].toUpperCase(),
                            })
                          );
                          setContactsList((prev) => {
                            const next = [...imported, ...prev];
                            try { localStorage.setItem("flicro_contacts", JSON.stringify(next)); } catch {}
                            return next;
                          });
                          playChime("success");
                          return;
                        }
                      } catch {}
                    }
                    vcfInputRef.current?.click();
                  }}
                  className="text-[11px] font-bold text-[#1877f2] bg-blue-50 hover:bg-blue-100 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
                >
                  + Import Contacts (.vcf)
                </button>
              </div>

              {contactsList.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allA = contactsList.every((c) => selectedIds[c.id]);
                    const updated = { ...selectedIds };
                    contactsList.forEach((c) => {
                      updated[c.id] = !allA;
                    });
                    setSelectedIds(updated);
                  }}
                  className={`size-5 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer ${
                    contactsList.every((c) => selectedIds[c.id])
                      ? "bg-[#1877f2] border-[#1877f2] text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {contactsList.every((c) => selectedIds[c.id]) && <Check className="size-3 stroke-[3]" />}
                </button>
              )}
            </div>

            {contactsList.length > 0 ? (
              <div className="relative flex">
                {/* Contact rows list */}
                <div className="flex-1 pr-7">
                  {contactsList.map((contact) => {
                    const isSelected = Boolean(selectedIds[contact.id]);
                    return (
                      <div
                        key={contact.id}
                        onClick={() => toggleSelect(contact.id)}
                        className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 active:bg-slate-100 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="size-11 shrink-0 rounded-2xl bg-[#e8f1fd] text-[#1877f2] flex items-center justify-center font-bold text-base shadow-sm">
                            {contact.initial}
                          </div>
                          <div className="min-w-0 truncate">
                            <p className="text-sm font-semibold text-slate-800 truncate leading-snug">
                              {contact.name}
                            </p>
                            {contact.phone && (
                              <p className="text-xs text-slate-400 truncate mt-0.5 font-normal">
                                {contact.phone}
                              </p>
                            )}
                          </div>
                        </div>

                        <div
                          className={`size-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ml-3 ${
                            isSelected
                              ? "bg-[#1877f2] border-[#1877f2] text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="size-3 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Vertical Alphabetical Jump Rail */}
                <div className="absolute right-1 top-0 bottom-0 flex flex-col items-center justify-start py-0.5 select-none pointer-events-auto">
                  {ALPHABET_RAIL.map((char) => (
                    <button
                      key={char}
                      type="button"
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center text-[9px] font-semibold text-slate-400 hover:text-[#1877f2] cursor-pointer"
                    >
                      {char}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <UserRound className="size-10 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold">No contacts imported</p>
                <button
                  type="button"
                  onClick={() => vcfInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-[#1877f2] text-white text-xs font-bold hover:bg-[#1466e3] active:scale-95 cursor-pointer shadow-sm"
                >
                  Import .vcf File from Device
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= MORE TAB ================= */}
        {activeCategory === "more" && (
          <div className="p-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3.5 hover:bg-slate-50 active:scale-[0.99] transition-all cursor-pointer text-left"
            >
              <div className="size-12 rounded-2xl bg-[#e8f1fd] text-[#1877f2] flex items-center justify-center shrink-0 shadow-sm">
                <Plus className="size-6 stroke-[2.5]" />
              </div>
              <span className="text-sm font-semibold text-slate-800">
                Add any file from device storage
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Hidden inputs for real device file & contact picking */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onSend(Array.from(e.target.files));
          }
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            setUserPhotos((prev) => [...files, ...prev]);
            playChime("drop");
          }
        }}
      />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            setUserPhotos((prev) => [...files, ...prev]);
            playChime("drop");
          }
        }}
      />
      <input
        ref={docInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            setUserDocs((prev) => [...files, ...prev]);
            playChime("drop");
          }
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            setUserVideos((prev) => [...files, ...prev]);
            playChime("drop");
          }
        }}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            setUserAudio((prev) => [...files, ...prev]);
            playChime("drop");
          }
        }}
      />
      <input
        ref={vcfInputRef}
        type="file"
        accept=".vcf,text/vcard"
        className="sr-only"
        onChange={async (e) => {
          if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const text = await file.text();
            const imported: ContactItem[] = [];
            const blocks = text.split("BEGIN:VCARD");
            blocks.forEach((block, idx) => {
              const fnMatch = block.match(/FN:(.+)/i);
              const telMatch = block.match(/TEL.*:(.+)/i);
              if (fnMatch) {
                const name = fnMatch[1].trim();
                const phone = telMatch ? telMatch[1].trim() : "";
                imported.push({
                  id: `vcf-${Date.now()}-${idx}`,
                  name,
                  phone,
                  initial: name[0]?.toUpperCase() || "A",
                });
              }
            });
            if (imported.length > 0) {
              setContactsList((prev) => {
                const updated = [...imported, ...prev];
                try {
                  localStorage.setItem("flicro_contacts", JSON.stringify(updated));
                } catch {}
                return updated;
              });
              playChime("success");
            }
          }
        }}
      />

      {/* Bottom Sticky Action Bar */}
      <div className="shrink-0 bg-white border-t border-slate-200/80 px-5 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] z-30 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <ChevronUp className="size-4 text-slate-400 stroke-[2.5]" />
          <span>
            {totalSelected > 0
              ? `${totalSelected} File(s) Selected`
              : pickedCount > 0
              ? `${pickedCount} File(s) Selected`
              : "0 Files Selected"}
          </span>
        </div>

        <button
          type="button"
          onClick={handleSendSelected}
          className="px-8 py-2.5 rounded-2xl bg-[#1877f2] hover:bg-[#1466e3] text-white font-bold text-sm shadow-md shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
        >
          Send
        </button>
      </div>
    </div>
  );
}
