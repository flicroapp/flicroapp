import { useState, useRef, useMemo, useEffect } from "react";
import {
  ArrowLeft,
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
    <div className="flex h-full flex-col bg-bg text-ink font-sans">
      {/* Header matching Settings PageShell */}
      <header className="safe-top flex shrink-0 items-center gap-1 border-b border-line bg-surface px-1">
        {onBack ? (
          <button type="button" className="flex size-11 items-center justify-center" onClick={onBack} aria-label="Back">
            <ArrowLeft className="size-5" />
          </button>
        ) : (
          <div className="size-2" />
        )}
        <h1 className="min-w-0 flex-1 truncate pr-3 text-[17px] font-semibold">Contacts</h1>
        <button
          type="button"
          onClick={() => setActiveModal("add")}
          className="flex h-8 items-center gap-1 rounded-lg bg-sky px-3 text-sm font-semibold text-white mr-2"
        >
          <Plus className="size-4" />
          <span>New</span>
        </button>
      </header>

      {/* Main Container matching Settings Layout */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {syncToast && (
          <p className="mb-4 text-sm font-semibold text-sky">{syncToast}</p>
        )}

        <section>
          <h2 className="px-1 pb-1.5 text-[13px] font-medium text-muted">Management</h2>
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <button type="button" onClick={() => setActiveModal("all")} className="flex min-h-12 w-full items-center gap-3 border-b border-line px-3 text-left last:border-b-0">
              <span className="text-sky"><Contact className="size-5" /></span>
              <span className="min-w-0 flex-1 truncate text-[15px]">All Contacts</span>
              <span className="max-w-[7.5rem] truncate text-sm text-muted">{contacts.length} saved</span>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </button>
            <button type="button" onClick={() => setActiveModal("duplicates")} className="flex min-h-12 w-full items-center gap-3 border-b border-line px-3 text-left last:border-b-0">
              <span className="text-sky"><Users className="size-5" /></span>
              <span className="min-w-0 flex-1 truncate text-[15px]">Duplicate Contacts</span>
              <span className="max-w-[7.5rem] truncate text-sm text-muted">{duplicateContacts.length} found</span>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </button>
            <button type="button" onClick={() => setActiveModal("incomplete")} className="flex min-h-12 w-full items-center gap-3 border-b border-line px-3 text-left last:border-b-0">
              <span className="text-sky"><UserRound className="size-5" /></span>
              <span className="min-w-0 flex-1 truncate text-[15px]">Incomplete Contacts</span>
              <span className="max-w-[7.5rem] truncate text-sm text-muted">{incompleteContacts.length} items</span>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </button>
            <button type="button" onClick={handleBackup} className="flex min-h-12 w-full items-center gap-3 border-b border-line px-3 text-left last:border-b-0">
              <span className="text-sky"><Download className="size-5" /></span>
              <span className="min-w-0 flex-1 truncate text-[15px]">Backup & Export</span>
              <span className="max-w-[7.5rem] truncate text-sm text-muted">.vcf file</span>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </button>
          </div>
        </section>

        <section className="mt-6">
           <h2 className="px-1 pb-1.5 text-[13px] font-medium text-muted">Device Contacts</h2>
           
           {contacts.length > 0 ? (
             <div className="overflow-hidden rounded-xl border border-line bg-surface">
               {contacts.slice(0, 5).map((contact) => (
                 <div key={contact.id} className="flex min-h-12 w-full items-center gap-3 border-b border-line px-3 text-left last:border-b-0">
                   <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-line text-[11px] font-bold">
                     {contact.name.charAt(0)}
                   </div>
                   <div className="min-w-0 flex-1">
                     <p className="truncate text-[15px]">{contact.name}</p>
                     <p className="truncate text-[13px] text-muted">{contact.phone || contact.email || "No contact info"}</p>
                   </div>
                   <button
                     type="button"
                     onClick={() => handleDeleteContact(contact.id)}
                     className="p-1 text-muted hover:text-warn"
                   >
                     <Trash2 className="size-4" />
                   </button>
                 </div>
               ))}
               {contacts.length > 5 && (
                 <button
                   type="button"
                   onClick={() => setActiveModal("all")}
                   className="flex min-h-12 w-full items-center justify-center gap-2 border-b border-line px-3 text-[15px] font-semibold text-sky last:border-b-0"
                 >
                   View all {contacts.length} contacts
                 </button>
               )}
             </div>
           ) : (
             <div className="overflow-hidden rounded-xl border border-line bg-surface p-6 text-center">
               <UserCheck className="mx-auto mb-3 size-10 text-sky" />
               <p className="text-[15px] font-semibold">Sync Device Contacts</p>
               <p className="mt-1 text-sm text-muted">
                 Securely access your phone's address book to easily share files with friends.
               </p>
               <button
                 type="button"
                 onClick={handleImportNative}
                 className="mt-4 h-11 w-full rounded-xl bg-sky font-semibold text-white"
               >
                 Allow Contacts Access
               </button>
               <p className="mt-4 text-xs text-muted">
                 * Note: Apple blocks automatic sync on iPhones. iOS Safari will prompt for a manual .vcf upload instead.
               </p>
             </div>
           )}
        </section>

        {contacts.length > 0 && (
          <button
            type="button"
            onClick={handleImportNative}
            className="mt-4 h-11 w-full rounded-xl border border-line bg-surface font-semibold text-sky flex items-center justify-center gap-2"
          >
            <Upload className="size-4" />
            <span>Import Contacts (.vcf or Device)</span>
          </button>
        )}
      </div>

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
