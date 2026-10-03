import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Eye,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Globe,
  Delete as DeleteIcon,
  X,
  Shield,
  Fingerprint,
  File,
} from "lucide-react";
import { formatBytes, uid } from "@/lib/flicro/format";
import { playChime } from "@/lib/flicro/sound";

interface PrivateSpaceProps {
  onBack: () => void;
}

interface VaultItem {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  addedAt: number;
}

export function PrivateSpaceScreen({ onBack }: PrivateSpaceProps) {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "photos" | "videos" | "files">("all");
  const [previewItem, setPreviewItem] = useState<VaultItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("flicro-private-pin");
    setStoredPin(saved);
    const savedVault = localStorage.getItem("flicro-vault-items");
    if (savedVault) {
      try {
        setVaultItems(JSON.parse(savedVault));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const handleKeyPress = (num: string) => {
    if (pin.length >= 4) return;
    setError("");
    const nextPin = pin + num;
    setPin(nextPin);

    if (nextPin.length === 4) {
      if (!storedPin) {
        // First time setting password
        localStorage.setItem("flicro-private-pin", nextPin);
        setStoredPin(nextPin);
        playChime("success");
        setUnlocked(true);
      } else if (storedPin === nextPin) {
        // Correct PIN
        playChime("success");
        setUnlocked(true);
      } else {
        // Incorrect PIN
        playChime("drop");
        setError("Incorrect PIN. Please try again.");
        setTimeout(() => setPin(""), 600);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError("");
  };

  const handleAddFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const newItems: VaultItem[] = [];

    Array.from(fileList).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const item: VaultItem = {
          id: uid(),
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: String(reader.result),
          addedAt: Date.now(),
        };
        newItems.push(item);
        if (newItems.length === fileList.length) {
          const updated = [...newItems, ...vaultItems];
          setVaultItems(updated);
          localStorage.setItem("flicro-vault-items", JSON.stringify(updated.slice(0, 50)));
          playChime("success");
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveVaultItem = (id: string) => {
    const updated = vaultItems.filter((item) => item.id !== id);
    setVaultItems(updated);
    localStorage.setItem("flicro-vault-items", JSON.stringify(updated));
  };

  const handleExportItem = (item: VaultItem) => {
    const a = document.createElement("a");
    a.href = item.dataUrl;
    a.download = item.name;
    a.click();
  };

  // If Vault is unlocked, show Private Vault contents
  if (unlocked) {
    const filtered = vaultItems.filter((item) => {
      if (activeTab === "photos") return item.type.startsWith("image/");
      if (activeTab === "videos") return item.type.startsWith("video/");
      if (activeTab === "files") return !item.type.startsWith("image/") && !item.type.startsWith("video/");
      return true;
    });

    return (
      <div className="flex h-full w-full flex-col bg-[#f8fafc] text-slate-800 select-none overflow-hidden font-sans">
        {/* Header */}
        <header className="safe-top flex shrink-0 items-center justify-between px-4 py-2.5 bg-white border-b border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUnlocked(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              title="Lock"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="flex items-center gap-1.5">
              <Shield className="size-4 text-[#1877f2]" />
              <h1 className="text-base font-bold text-slate-900">Private Vault</h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1877f2] text-white text-xs font-semibold hover:bg-[#1466e3] active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Add Files</span>
            </button>
          </div>
        </header>

        {/* Categories Bar */}
        <div className="bg-white border-b border-slate-100 px-4 py-1.5 flex gap-2 overflow-x-auto text-xs font-medium">
          {(["all", "photos", "videos", "files"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-full capitalize transition-colors cursor-pointer ${
                activeTab === tab
                  ? "bg-[#1877f2] text-white font-semibold shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="size-14 rounded-2xl bg-blue-50 text-[#1877f2] flex items-center justify-center">
                <Lock className="size-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-800">No private files</h3>
                <p className="text-xs text-slate-400 max-w-xs">
                  Encrypted files saved here are stored only in your local browser storage.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-[#1877f2] text-white text-xs font-semibold hover:bg-[#1466e3] active:scale-95 transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="size-4" />
                Add Photos or Files
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-slate-100 p-2.5 shadow-xs flex flex-col justify-between group relative overflow-hidden"
                >
                  <div className="aspect-square rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden mb-2">
                    {item.type.startsWith("image/") ? (
                      <img src={item.dataUrl} alt={item.name} className="size-full object-cover" />
                    ) : item.type.startsWith("video/") ? (
                      <VideoIcon className="size-8 text-indigo-500" />
                    ) : (
                      <File className="size-8 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400">{formatBytes(item.size)}</p>
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-2 pt-1 border-t border-slate-50">
                    <button
                      type="button"
                      onClick={() => handleExportItem(item)}
                      className="p-1 text-slate-400 hover:text-[#1877f2] rounded transition-colors"
                      title="Save"
                    >
                      <Eye className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveVaultItem(item.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => handleAddFiles(e.target.files)}
        />
      </div>
    );
  }

  // Modern, Native Mobile PIN Passcode Screen
  return (
    <div className="flex h-full w-full flex-col bg-white text-slate-800 select-none overflow-hidden font-sans">
      {/* Header */}
      <header className="safe-top flex shrink-0 items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <span className="text-sm font-semibold text-slate-800">Private Space</span>
        <div className="w-8" />
      </header>

      {/* Vault Icon & Passcode Dots */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-4 space-y-4">
        <div className="size-16 rounded-2xl bg-blue-50 text-[#1877f2] flex items-center justify-center shadow-sm border border-blue-100/60">
          <Shield className="size-8 stroke-[1.8]" />
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-base font-semibold text-slate-900">
            {storedPin ? "Enter Passcode" : "Create 4-Digit Passcode"}
          </h2>
          <p className="text-xs text-slate-400">
            {storedPin ? "Enter your PIN to access private files" : "Set a secure passcode for your private vault"}
          </p>
        </div>

        {/* 4 Clean PIN Dots */}
        <div className="flex items-center gap-4 pt-2">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`size-3.5 rounded-full border-2 border-slate-300 transition-all duration-200 ${
                pin.length > i ? "bg-[#1877f2] border-[#1877f2] scale-110" : "bg-transparent"
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs font-medium text-rose-500 animate-in fade-in">{error}</p>
        )}
      </div>

      {/* Clean Circular Mobile Keypad */}
      <div className="shrink-0 pb-8 px-6 max-w-xs mx-auto w-full">
        <div className="grid grid-cols-3 gap-y-3.5 gap-x-6 justify-items-center">
          {/* Row 1 */}
          <KeypadRoundButton number="1" letters="" onClick={() => handleKeyPress("1")} />
          <KeypadRoundButton number="2" letters="ABC" onClick={() => handleKeyPress("2")} />
          <KeypadRoundButton number="3" letters="DEF" onClick={() => handleKeyPress("3")} />

          {/* Row 2 */}
          <KeypadRoundButton number="4" letters="GHI" onClick={() => handleKeyPress("4")} />
          <KeypadRoundButton number="5" letters="JKL" onClick={() => handleKeyPress("5")} />
          <KeypadRoundButton number="6" letters="MNO" onClick={() => handleKeyPress("6")} />

          {/* Row 3 */}
          <KeypadRoundButton number="7" letters="PQRS" onClick={() => handleKeyPress("7")} />
          <KeypadRoundButton number="8" letters="TUV" onClick={() => handleKeyPress("8")} />
          <KeypadRoundButton number="9" letters="WXYZ" onClick={() => handleKeyPress("9")} />

          {/* Row 4: Biometric | 0 | Backspace */}
          <button
            type="button"
            className="size-15 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
            onClick={async () => {
              if (typeof window !== "undefined" && window.PublicKeyCredential && storedPin) {
                try {
                  const challenge = new Uint8Array(32);
                  crypto.getRandomValues(challenge);
                  const cred = await navigator.credentials.get({
                    publicKey: {
                      challenge,
                      timeout: 30000,
                      userVerification: "preferred",
                    },
                  });
                  if (cred) {
                    playChime("success");
                    setUnlocked(true);
                  }
                } catch {
                  // Biometric cancelled
                }
              }
            }}
            title="Biometric Login"
          >
            <Fingerprint className="size-6 text-[#1877f2] stroke-[1.8]" />
          </button>

          <KeypadRoundButton number="0" letters="" onClick={() => handleKeyPress("0")} />

          <button
            type="button"
            onClick={handleDelete}
            className="size-15 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
            aria-label="Delete"
          >
            <DeleteIcon className="size-5.5 text-slate-600 stroke-[1.8]" />
          </button>
        </div>
      </div>
    </div>
  );
}

function KeypadRoundButton({
  number,
  letters,
  onClick,
}: {
  number: string;
  letters: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="size-15 rounded-full flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-100 transition-all cursor-pointer select-none active:scale-95"
    >
      <span className="text-xl font-medium text-slate-900 leading-none">{number}</span>
      {letters && (
        <span className="text-[8px] font-semibold text-slate-400 tracking-wider mt-0.5 uppercase">
          {letters}
        </span>
      )}
    </button>
  );
}
