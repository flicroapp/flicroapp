import { useState, useRef, useMemo, useEffect } from "react";
import {
  Users,
  UserRound,
  ChevronRight,
  Download,
  Search,
  Plus,
  X,
  Trash2,
  Upload,
  UserCheck,
  Contact,
  Check,
} from "lucide-react";
import { playChime } from "@/lib/flicro/sound";

interface ContactsScreenProps {
  onBack?: () => void;
}

export interface ContactItem {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

export function ContactsScreen({ onBack }: ContactsScreenProps) {
  const [contacts, setContacts] = useState<ContactItem[]>(() => {
    try {
      const saved = localStorage.getItem("flicro_contacts");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out any previous sample contacts
          const real = parsed.filter((c) => !c.id.startsWith("c-"));
          return real;
        }
      }
    } catch {}
    return [];
  });

  const [activeModal, setActiveModal] = useState<"all" | "incomplete" | "duplicates" | "add" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [backupToast, setBackupToast] = useState(false);
  const [syncToast, setSyncToast] = useState("");

  // New Contact Form fields
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const vcfInputRef = useRef<HTMLInputElement>(null);

  // Persist real contacts to localStorage
  const saveContacts = (updated: ContactItem[]) => {
    setContacts(updated);
    try {
      localStorage.setItem("flicro_contacts", JSON.stringify(updated));
    } catch {}
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("flicro_contacts");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const real = parsed.filter((c) => !c.id.startsWith("c-"));
          if (real.length !== parsed.length) {
            localStorage.setItem("flicro_contacts", JSON.stringify(real));
          }
        }
      }
    } catch {}
  }, []);

  // Find duplicate contacts
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

  // Merge Duplicates
  const handleMergeDuplicates = () => {
    playChime("drop");
    const uniqueMap = new Map<string, ContactItem>();
    contacts.forEach((c) => {
      const key = (c.phone || c.name).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, c);
      } else {
        const existing = uniqueMap.get(key)!;
        uniqueMap.set(key, {
          ...existing,
          email: existing.email || c.email,
          phone: existing.phone || c.phone,
        });
      }
    });
    const cleaned = Array.from(uniqueMap.values());
    saveContacts(cleaned);
    playChime("success");
    setSyncToast(`Merged duplicates! ${cleaned.length} unique contacts saved.`);
    setTimeout(() => setSyncToast(""), 3000);
  };

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

  // Sync / Import from device
  const handleImportNative = async () => {
    // 1. Try Capacitor native contacts plugin first
    try {
      const { Contacts } = await import("@capacitor-community/contacts");
      const perm = await Contacts.requestPermissions();
      if (perm.contacts === "granted") {
        const result = await Contacts.getContacts({
          projection: { name: true, phones: true, emails: true },
        });
        
        if (result.contacts && result.contacts.length > 0) {
          const imported: ContactItem[] = result.contacts.map((c, i) => ({
            id: `imported-${Date.now()}-${i}`,
            name: c.name?.display || c.name?.given || "Unnamed Contact",
            phone: c.phones?.[0]?.number || "",
            email: c.emails?.[0]?.address || undefined,
          }));
          saveContacts([...imported, ...contacts]);
          playChime("success");
          setSyncToast(`Imported ${imported.length} contacts from device!`);
          setTimeout(() => setSyncToast(""), 3000);
          return;
        }
      }
    } catch (e) {
      console.warn("Capacitor Contacts API not available or failed:", e);
    }

    // 2. Fallback to Web Contacts API if Capacitor fails or we are in a browser
    if (typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window) {
      try {
        // @ts-expect-error navigator.contacts API
        const results = await navigator.contacts.select(["name", "tel", "email"], { multiple: true });
        if (results && results.length > 0) {
          const imported: ContactItem[] = results.map(
            (c: { name?: string[]; tel?: string[]; email?: string[] }, i: number) => ({
              id: `web-${Date.now()}-${i}`,
              name: c.name?.[0] || "Unnamed Contact",
              phone: c.tel?.[0] || "",
              email: c.email?.[0] || undefined,
            })
          );
          saveContacts([...imported, ...contacts]);
          playChime("success");
          setSyncToast(`Imported ${imported.length} contacts from browser!`);
          setTimeout(() => setSyncToast(""), 3000);
          return;
        }
      } catch {}
    }
    
    // 3. If everything fails or is cancelled, fallback to file upload
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
        setSyncToast(`Successfully imported ${parsed.length} contacts!`);
        setTimeout(() => setSyncToast(""), 3000);
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
      <header className="safe-top flex shrink-0 items-center justify-between px-4 py-2.5 bg-white border-b border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)] z-20">
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
      <main className="flex-1 px-4 py-3 max-w-lg mx-auto w-full space-y-3.5 pb-8">
        {syncToast && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-3.5 py-2.5 rounded-xl shadow-xs animate-in fade-in flex items-center justify-between">
            <span>{syncToast}</span>
            <Check className="size-4 text-emerald-600" />
          </div>
        )}

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

        {/* Sync / Import Button */}
        <button
          type="button"
          onClick={handleImportNative}
          className="w-full py-3 px-4 rounded-xl bg-white border border-slate-200/80 hover:bg-slate-50 text-[#1877f2] font-semibold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-[0.99] transition-all cursor-pointer"
        >
          <Upload className="size-4" />
          <span>Import Contacts (.vcf or Device)</span>
        </button>

        {/* Contacts Preview List / Empty State */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Device Contacts List</h2>
            <span className="text-[11px] text-slate-400">{contacts.length} total</span>
          </div>

          {contacts.length > 0 ? (
            <>
              <div className="divide-y divide-slate-100">
                {contacts.slice(0, 5).map((contact) => (
                  <div key={contact.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-full bg-blue-50 text-[#1877f2] font-bold text-xs flex items-center justify-center">
                        {contact.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{contact.name}</p>
                        <p className="text-[10px] text-slate-400">{contact.phone || contact.email || "No contact info"}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteContact(contact.id)}
                      className="text-slate-300 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {contacts.length > 5 && (
                <button
                  type="button"
                  onClick={() => setActiveModal("all")}
                  className="w-full text-center text-xs font-bold text-[#1877f2] pt-1 hover:underline cursor-pointer"
                >
                  View all {contacts.length} contacts
                </button>
              )}
            </>
          ) : (
            <div className="py-8 text-center text-slate-400 space-y-1">
              <p className="text-xs font-medium text-slate-600">No contacts saved</p>
              <p className="text-[11px] text-slate-400">
                Tap "+ New" above or import a .vcf contact file to add your contacts.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Hidden vCard File Input */}
      <input
        ref={vcfInputRef}
        type="file"
        accept=".vcf,text/vcard"
        className="sr-only"
        onChange={(e) => handleImportVcfFile(e.target.files)}
      />

      {/* Modal: All Contacts */}
      {activeModal === "all" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden space-y-4">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900">All Contacts ({contacts.length})</h3>
                <p className="text-xs text-slate-400">Search and manage stored contacts</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative shrink-0">
              <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, phone or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs focus:outline-hidden focus:border-[#1877f2]"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0 pr-1">
              {filteredContacts.length > 0 ? (
                filteredContacts.map((c) => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-slate-800 truncate">{c.name}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-slate-500">
                        {c.phone && <span>{c.phone}</span>}
                        {c.email && <span className="text-slate-400">{c.email}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteContact(c.id)}
                      className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">No matching contacts found</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Duplicate Contacts */}
      {activeModal === "duplicates" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden space-y-4">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900">Duplicates ({duplicateContacts.length})</h3>
                <p className="text-xs text-slate-400">Merge or delete repeated contact entries</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {duplicateContacts.length > 0 && (
              <button
                type="button"
                onClick={handleMergeDuplicates}
                className="w-full py-2.5 rounded-xl bg-[#1877f2] hover:bg-[#1466e3] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Merge & Clean All Duplicates</span>
              </button>
            )}

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0">
              {duplicateContacts.length > 0 ? (
                duplicateContacts.map((c) => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{c.name}</p>
                      <p className="text-[11px] text-slate-500">{c.phone || c.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteContact(c.id)}
                      className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <UserCheck className="size-8 text-emerald-500 mx-auto mb-2" />
                  No duplicate contacts detected!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Incomplete Contacts */}
      {activeModal === "incomplete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden space-y-4">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900">Incomplete Contacts ({incompleteContacts.length})</h3>
                <p className="text-xs text-slate-400">Missing phone numbers or emails</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0">
              {incompleteContacts.length > 0 ? (
                incompleteContacts.map((c) => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{c.name}</p>
                      <p className="text-[11px] text-amber-600 font-medium">
                        {!c.phone ? "Missing phone number" : "Missing email address"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteContact(c.id)}
                      className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <UserCheck className="size-8 text-emerald-500 mx-auto mb-2" />
                  All contacts have complete information!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Contact */}
      {activeModal === "add" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Add New Contact</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleAddSingleContact} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs focus:outline-hidden focus:border-[#1877f2]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. +1 555-0199"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs focus:outline-hidden focus:border-[#1877f2]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. john@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs focus:outline-hidden focus:border-[#1877f2]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-[#1877f2] hover:bg-[#1466e3] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
