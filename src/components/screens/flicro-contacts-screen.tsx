import { useState, useRef, useMemo } from "react";
import {
  Users,
  UserRound,
  Layers,
  ChevronRight,
  Download,
  Search,
  Plus,
  X,
  Phone,
  Mail,
  Trash2,
  Upload,
  UserCheck,
  Contact,
} from "lucide-react";
import { playChime } from "@/lib/flicro/sound";

interface ContactsScreenProps {
  onBack?: () => void;
}

interface ContactItem {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

export function ContactsScreen({ onBack }: ContactsScreenProps) {
  const [contacts, setContacts] = useState<ContactItem[]>(() => {
    try {
      const saved = localStorage.getItem("flicro_contacts");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [activeModal, setActiveModal] = useState<"all" | "incomplete" | "duplicates" | "add" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [backupToast, setBackupToast] = useState(false);

  // New Contact Form fields
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const vcfInputRef = useRef<HTMLInputElement>(null);

  // Persist contacts to localStorage
  const saveContacts = (updated: ContactItem[]) => {
    setContacts(updated);
    try {
      localStorage.setItem("flicro_contacts", JSON.stringify(updated));
    } catch {}
  };

  // Find real duplicate contacts
  const duplicateContacts = useMemo(() => {
    const seen = new Map<string, ContactItem>();
    const dupes: ContactItem[] = [];
    contacts.forEach((c) => {
      const key = (c.phone || c.name).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (key && seen.has(key)) {
        dupes.push(c);
      } else if (key) {
        seen.set(key, c);
      }
    });
    return dupes;
  }, [contacts]);

  const incompleteContacts = useMemo(() => {
    return contacts.filter((c) => !c.email || !c.phone);
  }, [contacts]);

  // Real backup: vCard format
  const handleBackup = () => {
    if (contacts.length === 0) {
      alert("No contacts to backup. Please import or add contacts first.");
      return;
    }

    let vcfContent = "";
    contacts.forEach((c) => {
      vcfContent += "BEGIN:VCARD\r\nVERSION:3.0\r\n";
      vcfContent += `FN:${c.name}\r\n`;
      if (c.phone) vcfContent += `TEL;TYPE=CELL:${c.phone}\r\n`;
      if (c.email) vcfContent += `EMAIL:${c.email}\r\n`;
      vcfContent += "END:VCARD\r\n";
    });

    const blob = new Blob([vcfContent], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Contacts_Backup_${new Date().toISOString().slice(0, 10)}.vcf`;
    link.click();
    URL.revokeObjectURL(url);

    playChime("success");
    setBackupToast(true);
    setTimeout(() => setBackupToast(false), 2500);
  };

  // Real import from device
  const handleImportNative = async () => {
    if (typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window) {
      try {
        // @ts-expect-error navigator.contacts API
        const results = await navigator.contacts.select(["name", "tel", "email"], { multiple: true });
        if (results && results.length > 0) {
          const imported: ContactItem[] = results.map(
            (c: { name?: string[]; tel?: string[]; email?: string[] }, i: number) => ({
              id: `imported-${Date.now()}-${i}`,
              name: c.name?.[0] || "Unnamed Contact",
              phone: c.tel?.[0] || "",
              email: c.email?.[0] || undefined,
            })
          );
          saveContacts([...imported, ...contacts]);
          playChime("success");
          return;
        }
      } catch {}
    }
    vcfInputRef.current?.click();
  };

  const handleImportVcfFile = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || "");
      const cards = text.split("BEGIN:VCARD");
      const parsed: ContactItem[] = [];

      cards.forEach((card, idx) => {
        if (!card.trim()) return;
        const nameMatch = card.match(/FN:(.*)/);
        const telMatch = card.match(/TEL.*:(.*)/);
        const emailMatch = card.match(/EMAIL.*:(.*)/);

        if (nameMatch || telMatch) {
          parsed.push({
            id: `vcf-${Date.now()}-${idx}`,
            name: nameMatch ? nameMatch[1].trim() : "Imported Contact",
            phone: telMatch ? telMatch[1].trim() : "",
            email: emailMatch ? emailMatch[1].trim() : undefined,
          });
        }
      });

      if (parsed.length > 0) {
        saveContacts([...parsed, ...contacts]);
        playChime("success");
      }
    };
    reader.readAsText(file);
  };

  const handleAddSingleContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const item: ContactItem = {
      id: `manual-${Date.now()}`,
      name: newName.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim() || undefined,
    };

    saveContacts([item, ...contacts]);
    setNewName("");
    setNewPhone("");
    setNewEmail("");
    setActiveModal(null);
    playChime("success");
  };

  const handleDeleteContact = (id: string) => {
    saveContacts(contacts.filter((c) => c.id !== id));
    playChime("drop");
  };

  const filteredContacts = useMemo(() => {
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [contacts, searchQuery]);

  return (
    <div className="flex h-full w-full flex-col bg-[#f8fafc] text-slate-800 select-none overflow-y-auto font-sans">
      {/* Header */}
      <header className="safe-top flex shrink-0 items-center justify-between px-4 py-2.5 bg-white border-b border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>
          )}
          <h1 className="text-base font-bold text-slate-900">Contacts</h1>
        </div>

        <button
          type="button"
          onClick={() => setActiveModal("add")}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1877f2] text-white text-xs font-semibold hover:bg-[#1466e3] active:scale-95 transition-all shadow-xs cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>New</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 px-4 py-3 max-w-lg mx-auto w-full space-y-3.5">
        {/* Sleek Grouped Utility Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100/80 overflow-hidden">
          {/* Item 1: All Contacts */}
          <button
            type="button"
            onClick={() => setActiveModal("all")}
            className="flex w-full items-center justify-between p-3 text-left hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-8 rounded-lg bg-blue-50 text-[#1877f2] flex items-center justify-center shrink-0">
                <Contact className="size-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-semibold text-slate-800">All Contacts</h3>
                <p className="text-[11px] text-slate-400">{contacts.length} saved</p>
              </div>
            </div>
            <ChevronRight className="size-4 text-slate-400 shrink-0" />
          </button>

          {/* Item 2: Duplicate Contacts */}
          <button
            type="button"
            onClick={() => setActiveModal("duplicates")}
            className="flex w-full items-center justify-between p-3 text-left hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Users className="size-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-semibold text-slate-800">Duplicate Contacts</h3>
                <p className="text-[11px] text-slate-400">{duplicateContacts.length} found</p>
              </div>
            </div>
            <ChevronRight className="size-4 text-slate-400 shrink-0" />
          </button>

          {/* Item 3: Incomplete Contacts */}
          <button
            type="button"
            onClick={() => setActiveModal("incomplete")}
            className="flex w-full items-center justify-between p-3 text-left hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <UserRound className="size-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-semibold text-slate-800">Incomplete Contacts</h3>
                <p className="text-[11px] text-slate-400">{incompleteContacts.length} items</p>
              </div>
            </div>
            <ChevronRight className="size-4 text-slate-400 shrink-0" />
          </button>

          {/* Item 4: Backup & Export */}
          <button
            type="button"
            onClick={handleBackup}
            className="flex w-full items-center justify-between p-3 text-left hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Download className="size-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-semibold text-slate-800">Backup & Export</h3>
                <p className="text-[11px] text-slate-400">Save as standard .vcf</p>
              </div>
            </div>
            <ChevronRight className="size-4 text-slate-400 shrink-0" />
          </button>
        </div>

        {/* Compact Import Action */}
        <button
          type="button"
          onClick={handleImportNative}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white border border-slate-200/80 text-[#1877f2] font-semibold text-xs hover:bg-blue-50/50 active:scale-98 transition-all shadow-xs cursor-pointer"
        >
          <Upload className="size-4" />
          <span>Import Contacts (.vcf or Device)</span>
        </button>

        {backupToast && (
          <p className="text-center text-xs font-medium text-emerald-600 animate-in fade-in">
            ✓ Contacts exported successfully
          </p>
        )}

        {/* Quick Contact List Preview if contacts exist */}
        {contacts.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
              Recent Contacts
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100/80 overflow-hidden">
              {contacts.slice(0, 6).map((c) => (
                <div key={c.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 rounded-full bg-blue-50 text-[#1877f2] font-bold text-xs flex items-center justify-center shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{c.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{c.phone || c.email || "No details"}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteContact(c.id)}
                    className="p-1 text-slate-300 hover:text-rose-500 rounded transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Hidden File Input for VCF */}
      <input
        ref={vcfInputRef}
        type="file"
        accept=".vcf,text/vcard"
        className="sr-only"
        onChange={(e) => handleImportVcfFile(e.target.files)}
      />

      {/* Add / View Modals */}
      {activeModal === "add" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <form
            onSubmit={handleAddSingleContact}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl text-slate-800 space-y-3.5"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add New Contact</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded-full"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1877f2]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. +1 234 567 8900"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1877f2]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. john@example.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1877f2]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#1877f2] hover:bg-[#1466e3] text-white text-xs font-semibold"
              >
                Save Contact
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View All / Duplicates Modal */}
      {(activeModal === "all" || activeModal === "duplicates" || activeModal === "incomplete") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl text-slate-800 space-y-3 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
              <h3 className="text-sm font-bold text-slate-900 capitalize">
                {activeModal === "all" ? "All Contacts" : activeModal === "duplicates" ? "Duplicate Contacts" : "Incomplete Contacts"}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded-full"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="relative shrink-0">
              <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts…"
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#1877f2]"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {(activeModal === "duplicates" ? duplicateContacts : activeModal === "incomplete" ? incompleteContacts : filteredContacts).length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6">No contacts found</p>
              ) : (
                (activeModal === "duplicates" ? duplicateContacts : activeModal === "incomplete" ? incompleteContacts : filteredContacts).map((c) => (
                  <div key={c.id} className="py-2.5 px-1 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{c.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{c.phone || c.email || "No details"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteContact(c.id)}
                      className="p-1 text-slate-300 hover:text-rose-500 rounded"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
