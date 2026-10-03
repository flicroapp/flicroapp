import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Check,
  CircleHelp,
  FileText,
  FolderOpen,
  History,
  Info,
  Languages,
  LifeBuoy,
  Lock,
  MonitorSmartphone,
  Palette,
  RefreshCw,
  Scale,
  Share2,
  Shield,
  Smartphone,
  Star,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import type { DownloadReady } from "@/lib/flicro/engine";
import {
  deleteFirebaseAccount,
  finishGoogleRedirect,
  firebaseConfigured,
  loadAccount,
  removeSignInFromDevice,
  signInEmail,
  signInGoogle,
  signOutAccount,
  signUpEmail,
  type Account,
} from "@/lib/flicro/account";
import { MAX_FILES, formatBytes, formatWhen, saveBlob } from "@/lib/flicro/format";
import {
  INTERFACE_LICENSES,
  NATIVE_SHELL_LICENSES,
  WEBSITE_SERVICE_LICENSES,
  type LicenseEntry,
} from "@/lib/flicro/licenses";
import {
  clearPin,
  hasPin,
  loadAutoLeave,
  loadBio,
  loadName,
  loadNotify,
  loadPhoto,
  readProfilePhoto,
  saveAutoLeave,
  saveBio,
  saveName,
  saveNotify,
  savePhoto,
  savePin,
  readOpfs,
  type HistoryEntry,
} from "@/lib/flicro/storage";
import { transportNote } from "@/lib/flicro/transport";
import { applyTheme, loadTheme, type Theme } from "@/lib/flicro/theme";

/** Matches the Android project versionName. No update service is attached. */
export const APP_VERSION = "1.0";

/** Official Flicro support address. */
export const SUPPORT_CONTACT: string | null = "support@flicro.app";

const SUPPORT_PLACEHOLDER = "support@flicro.app";

export type SettingsPage =
  | "hub"
  | "profile"
  | "account"
  | "device"
  | "sent"
  | "received"
  | "pieces"
  | "notifications"
  | "appearance"
  | "language"
  | "savelocation"
  | "security"
  | "faq"
  | "how"
  | "trouble"
  | "support"
  | "about"
  | "news"
  | "licenses"
  | "privacy"
  | "terms"
  | "legal"
  | "rate"
  | "share"
  | "updates";

type Item = { page: SettingsPage; label: string; icon: ReactNode; hint?: string };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Account",
    items: [
      { page: "profile", label: "Profile", icon: <UserRound className="size-5" /> },
      { page: "account", label: "Sign in", icon: <Lock className="size-5" /> },
    ],
  },
  {
    title: "Device",
    items: [{ page: "device", label: "This device", icon: <Smartphone className="size-5" /> }],
  },
  {
    title: "Transfers",
    items: [
      { page: "sent", label: "Sent files", icon: <History className="size-5" /> },
      { page: "received", label: "Received files", icon: <FolderOpen className="size-5" /> },
    ],
  },
  {
    title: "Preferences",
    items: [
      { page: "notifications", label: "Notifications", icon: <Bell className="size-5" /> },
      { page: "pieces", label: "Larger pieces", icon: <MonitorSmartphone className="size-5" /> },
      { page: "appearance", label: "Appearance", icon: <Palette className="size-5" /> },
      { page: "language", label: "Language", icon: <Languages className="size-5" />, hint: "English" },
      { page: "savelocation", label: "Save location", icon: <FolderOpen className="size-5" /> },
      { page: "security", label: "Privacy and security", icon: <Shield className="size-5" /> },
    ],
  },
  {
    title: "Help",
    items: [
      { page: "how", label: "How Flicro works", icon: <Info className="size-5" /> },
      { page: "faq", label: "FAQ", icon: <CircleHelp className="size-5" /> },
      { page: "trouble", label: "Troubleshooting", icon: <Wrench className="size-5" /> },
      { page: "support", label: "Help and support", icon: <LifeBuoy className="size-5" /> },
    ],
  },
  {
    title: "Information",
    items: [
      { page: "about", label: "About Flicro", icon: <Info className="size-5" /> },
      { page: "news", label: "What's new", icon: <FileText className="size-5" /> },
      { page: "licenses", label: "Open-source licenses", icon: <Scale className="size-5" /> },
    ],
  },
  {
    title: "Legal",
    items: [
      { page: "privacy", label: "Privacy Policy", icon: <Shield className="size-5" /> },
      { page: "terms", label: "Terms of Service", icon: <FileText className="size-5" /> },
      { page: "legal", label: "Legal information", icon: <Scale className="size-5" /> },
    ],
  },
  {
    title: "Other",
    items: [
      { page: "rate", label: "Rate Flicro", icon: <Star className="size-5" />, hint: "Unavailable" },
      { page: "share", label: "Share Flicro", icon: <Share2 className="size-5" /> },
      { page: "updates", label: "Check for updates", icon: <RefreshCw className="size-5" />, hint: "Unavailable" },
    ],
  },
];

export function Settings({
  page,
  onPage,
  name,
  room,
  selfId,
  onName,
  onLock,
  onHistory,
  native,
  history,
  downloads,
  pro,
  onPro,
}: {
  page: SettingsPage;
  onPage: (page: SettingsPage) => void;
  name: string;
  room: string;
  selfId: string;
  onName: (name: string) => void;
  onLock: () => void;
  onHistory: () => void;
  native: boolean;
  history: HistoryEntry[];
  downloads: DownloadReady[];
  pro: boolean;
  onPro: (on: boolean) => void;
}) {
  const stack = useRef<SettingsPage[]>([page]);
  const internal = useRef(false);
  const [account, setAccountSnapshot] = useState<Account>(() => loadAccount());

  useEffect(() => {
    setAccountSnapshot(loadAccount());
  }, [page]);

  useEffect(() => {
    if (internal.current) {
      internal.current = false;
      return;
    }
    stack.current = page === "hub" ? ["hub"] : ["hub", page];
  }, [page]);

  function go(next: SettingsPage) {
    internal.current = true;
    const top = stack.current[stack.current.length - 1];
    if (top !== next) stack.current = [...stack.current, next];
    onPage(next);
  }

  function back() {
    internal.current = true;
    if (stack.current.length > 1) stack.current = stack.current.slice(0, -1);
    onPage(stack.current[stack.current.length - 1] ?? "hub");
  }

  if (page === "hub") {
    return <Hub name={name} account={account} onPage={go} onHistory={onHistory} />;
  }

  return (
    <PageShell title={titleFor(page, account.guest)} onBack={back}>
      {page === "profile" ? <ProfilePage name={name} selfId={selfId} onName={onName} onAccount={() => go("account")} /> : null}
      {page === "account" ? <AccountPage onChanged={() => setAccountSnapshot(loadAccount())} /> : null}
      {page === "device" ? <DevicePage name={name} room={room} native={native} history={history} onProfile={() => go("profile")} /> : null}
      {page === "sent" ? <TransferList empty="Nothing sent from this device yet." entries={history.filter((item) => item.direction === "sent")} downloads={downloads} /> : null}
      {page === "received" ? <TransferList empty="Nothing received on this device yet." entries={history.filter((item) => item.direction === "received")} downloads={downloads} /> : null}
      {page === "pieces" ? <PiecesPage pro={pro} onPro={onPro} /> : null}
      {page === "notifications" ? <NotificationsPage /> : null}
      {page === "appearance" ? <AppearancePage /> : null}
      {page === "language" ? <Unavailable body="The interface is English. Other languages are not in this version." /> : null}
      {page === "savelocation" ? <SaveLocationPage native={native} /> : null}
      {page === "security" ? <SecurityPage onLock={onLock} onPrivacy={() => go("privacy")} /> : null}
      {page === "faq" ? <FaqPage /> : null}
      {page === "how" ? <HowPage /> : null}
      {page === "trouble" ? <TroublePage onFaq={() => go("faq")} onSupport={() => go("support")} /> : null}
      {page === "support" ? <SupportPage onFaq={() => go("faq")} onTrouble={() => go("trouble")} /> : null}
      {page === "about" ? <AboutPage native={native} onHow={() => go("how")} /> : null}
      {page === "news" ? <NewsPage /> : null}
      {page === "licenses" ? <LicensesPage /> : null}
      {page === "privacy" ? <PrivacyPage native={native} onAccount={() => go("account")} /> : null}
      {page === "terms" ? <TermsPage onLegal={() => go("legal")} /> : null}
      {page === "legal" ? <LegalPage onPage={go} /> : null}
      {page === "rate" ? <Unavailable body="This build is not connected to an app store listing, so there is nowhere to leave a rating." /> : null}
      {page === "share" ? <SharePage /> : null}
      {page === "updates" ? <Unavailable body={`This is version ${APP_VERSION}. It does not contact a server to look for a newer version.`} /> : null}
    </PageShell>
  );
}

export function SettingsDrawer({
  name,
  onClose,
  onOpen,
  onWifi,
  onHistory,
}: {
  name: string;
  onClose: () => void;
  onOpen: (page: SettingsPage) => void;
  onWifi: () => void;
  onHistory: () => void;
}) {
  const account = loadAccount();
  return (
    <div className="fixed inset-0 z-40 flex">
      <aside className="flex h-full w-[min(100%,20.5rem)] flex-col bg-bg text-ink">
        <div className="safe-top flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
          <img src="/flicro-icon-180.png" alt="" className="size-10 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{name}</p>
            <p className="truncate text-sm text-muted">{account.guest ? "Guest mode" : account.email}</p>
          </div>
          <button type="button" className="flex size-11 items-center justify-center" onClick={onClose} aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <button type="button" className="mb-5 h-11 w-full rounded-xl bg-sky text-[15px] font-semibold text-white" onClick={onWifi}>
            Look on this Wi-Fi
          </button>
          <div className="flex flex-col gap-5">
            {GROUPS.map((group) => (
              <Group key={group.title} title={group.title}>
                {group.title === "Transfers" ? (
                  <NavRow icon={<History className="size-5" />} label="Transfer history" onClick={onHistory} />
                ) : null}
                {group.items.map((item) => (
                  <NavRow
                    key={item.page}
                    icon={item.icon}
                    label={rowLabel(item, account)}
                    value={rowValue(item, account)}
                    onClick={() => onOpen(item.page)}
                  />
                ))}
              </Group>
            ))}
          </div>
          <p className="px-1 pt-5 pb-2 text-center text-xs text-muted">Flicro {APP_VERSION}</p>
        </div>
      </aside>
      <button type="button" className="h-full min-w-0 flex-1 bg-black/50" aria-label="Close menu" onClick={onClose} />
    </div>
  );
}

function Hub({
  name,
  account,
  onPage,
  onHistory,
}: {
  name: string;
  account: Account;
  onPage: (page: SettingsPage) => void;
  onHistory: () => void;
}) {
  return (
    <div className="safe-top h-full overflow-y-auto bg-bg text-ink">
      <div className="px-4 pt-4">
        <button type="button" className="flex w-full items-center gap-3 py-2 text-left" onClick={() => onPage("profile")}>
          {loadPhoto() ? <img src={loadPhoto()} alt="" className="size-14 rounded-full object-cover" /> : <img src="/flicro-icon-180.png" alt="" className="size-14 rounded-2xl" />}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xl font-semibold leading-tight">{name}</span>
            <span className="mt-0.5 block truncate text-sm text-muted">{account.guest ? "Guest mode" : account.email}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted" />
        </button>
      </div>
      <div className="flex flex-col gap-5 px-4 pt-4 pb-8">
        {GROUPS.map((group) => (
          <Group key={group.title} title={group.title}>
            {group.title === "Transfers" ? (
              <NavRow icon={<History className="size-5" />} label="Transfer history" onClick={onHistory} />
            ) : null}
            {group.items.map((item) => (
              <NavRow
                key={item.page}
                icon={item.icon}
                label={rowLabel(item, account)}
                value={rowValue(item, account) ?? item.hint}
                onClick={() => onPage(item.page)}
              />
            ))}
          </Group>
        ))}
        <p className="pt-1 text-center text-xs text-muted">Flicro {APP_VERSION}</p>
      </div>
    </div>
  );
}

function rowLabel(item: Item, account: Account): string {
  if (item.page === "account") return account.guest ? "Sign in" : "Account";
  return item.label;
}

function rowValue(item: Item, account: Account): string | undefined {
  if (item.page !== "account") return undefined;
  return account.guest ? "Guest" : account.email;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="px-1 pb-1.5 text-[13px] font-medium text-muted">{title}</h2>
      <div className="settings-group overflow-hidden rounded-xl border border-line bg-surface">{children}</div>
    </section>
  );
}

function NavRow({ icon, label, value, onClick }: { icon: ReactNode; label: string; value?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-12 w-full items-center gap-3 border-b border-line px-3 text-left last:border-b-0">
      <span className="text-sky">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[15px]">{label}</span>
      {value ? <span className="max-w-[7.5rem] truncate text-sm text-muted">{value}</span> : null}
      <ChevronRight className="size-4 shrink-0 text-muted" />
    </button>
  );
}

function PageShell({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="safe-top flex shrink-0 items-center gap-1 border-b border-line bg-surface px-1">
        <button type="button" className="flex size-11 items-center justify-center" onClick={onBack} aria-label="Back">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate pr-3 text-[17px] font-semibold">{title}</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function titleFor(page: SettingsPage, guest: boolean): string {
  if (page === "account") return guest ? "Sign in" : "Account";
  const found = GROUPS.flatMap((group) => group.items).find((item) => item.page === page);
  return found?.label ?? "Me";
}

function NoteLine({ note }: { note: Note }) {
  if (!note) return null;
  return <p className={`mt-3 text-sm leading-5 ${note.tone === "err" ? "text-warn" : "text-muted"}`}>{note.text}</p>;
}

type Note = { tone: "ok" | "err"; text: string } | null;

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

const fieldClass = "mt-1.5 h-12 w-full rounded-xl border border-line bg-surface px-3 text-base";

function ProfilePage({
  name,
  selfId,
  onName,
  onAccount,
}: {
  name: string;
  selfId: string;
  onName: (name: string) => void;
  onAccount: () => void;
}) {
  const [draft, setDraft] = useState(name);
  const [photo, setPhoto] = useState(loadPhoto);
  const [note, setNote] = useState<Note>(null);
  const account = loadAccount();
  return (
    <div className="px-4 py-5">
      <div className="flex items-center gap-3">
        {photo ? <img src={photo} alt="" className="size-16 rounded-full object-cover" /> : <img src="/flicro-icon-180.png" alt="" className="size-16 rounded-2xl" />}
        <div>
          <p className="text-sm text-muted">{account.guest ? "Guest on this device" : account.email}</p>
          <p className="text-sm text-muted">The name and photo are what the other device sees. The photo stays on this device.</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <label className="flex h-11 flex-1 cursor-pointer items-center justify-center rounded-xl bg-sky font-semibold text-white">
          {photo ? "Change photo" : "Add photo"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void readProfilePhoto(file)
                .then((next) => {
                  savePhoto(next);
                  setPhoto(next);
                  setNote({ tone: "ok", text: "Photo saved on this device." });
                })
                .catch((err: unknown) => setNote({ tone: "err", text: err instanceof Error ? err.message : "Couldn't read that photo." }));
            }}
          />
        </label>
        {photo ? (
          <button
            type="button"
            className="h-11 rounded-xl border border-line px-4 font-semibold"
            onClick={() => {
              savePhoto("");
              setPhoto("");
              setNote({ tone: "ok", text: "Photo removed from this device." });
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
      <form
        className="mt-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = draft.trim();
          if (!next) {
            setNote({ tone: "err", text: "Enter a name." });
            return;
          }
          saveName(next);
          onName(loadName(selfId));
          setNote({ tone: "ok", text: "Saved on this device." });
        }}
      >
        <Field id="profile-name" label="Device name">
          <input id="profile-name" value={draft} maxLength={32} onChange={(event) => setDraft(event.target.value)} className={fieldClass} />
        </Field>
        <button type="submit" className="mt-4 h-11 w-full rounded-xl bg-sky font-semibold text-white">
          Save name
        </button>
      </form>
      <NoteLine note={note} />
      <button type="button" className="mt-6 text-sm font-semibold text-sky" onClick={onAccount}>
        {account.guest ? "Sign in or create an account" : "Account settings"}
      </button>
    </div>
  );
}

function AccountPage({ onChanged }: { onChanged: () => void }) {
  const [account, setAccount] = useState<Account>({ guest: true });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState<"in" | "up" | "del" | "google" | null>(null);
  useEffect(() => {
    let stop = false;
    void finishGoogleRedirect()
      .then((next) => {
        if (stop) return;
        const account = next ?? loadAccount();
        setAccount(account);
        if (next) onChanged();
      })
      .catch((err: unknown) => {
        if (!stop) setNote({ tone: "err", text: err instanceof Error ? err.message : "Google sign-in failed." });
      });
    return () => {
      stop = true;
    };
  }, [onChanged]);

  if (!account.guest) {
    return (
      <div className="px-4 py-5">
        <p className="text-sm text-muted">Signed in</p>
        <p className="mt-1 text-lg font-semibold break-all">{account.email}</p>
        <p className="mt-2 text-sm leading-5 text-muted">Signing in does not upload files. Guest mode is off on this device until you sign out.</p>
        <div className="mt-5 overflow-hidden rounded-xl border border-line bg-surface">
          <TextRow
            label="Sign out"
            onClick={() => {
              signOutAccount();
              setAccount({ guest: true });
              onChanged();
              setNote({ tone: "ok", text: "Signed out. You are using guest mode." });
            }}
          />
          <TextRow
            label="Remove sign-in from this device"
            onClick={() => {
              removeSignInFromDevice();
              setAccount({ guest: true });
              onChanged();
              setNote({ tone: "ok", text: "The sign-in was removed from this device. The account itself was not deleted." });
            }}
          />
          <TextRow
            label={firebaseConfigured() ? (busy === "del" ? "Deleting…" : "Delete account") : "Delete account unavailable"}
            danger
            disabled={busy !== null || !firebaseConfigured()}
            onClick={() => {
              setBusy("del");
              void deleteFirebaseAccount()
                .then(() => {
                  setAccount({ guest: true });
                  onChanged();
                  setNote({ tone: "ok", text: "The account was deleted. Files already on this device were not removed." });
                })
                .catch((err: unknown) => setNote({ tone: "err", text: err instanceof Error ? err.message : "Could not delete the account." }))
                .finally(() => setBusy(null));
            }}
          />
        </div>
        {!firebaseConfigured() ? <p className="mt-3 text-sm leading-5 text-muted">Firebase is not configured, so this build cannot delete an account there.</p> : null}
        <NoteLine note={note} />
      </div>
    );
  }

  return (
    <form
      className="px-4 py-5"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy("in");
        setNote(null);
        void signInEmail(email, password)
          .then((next) => {
            setAccount(next);
            onChanged();
            setPassword("");
            setNote({ tone: "ok", text: "Signed in. Files are still not uploaded." });
          })
          .catch((err: unknown) => setNote({ tone: "err", text: err instanceof Error ? err.message : "Sign-in failed." }))
          .finally(() => setBusy(null));
      }}
    >
      <p className="text-sm font-medium">Guest mode</p>
      <p className="mt-1 text-sm leading-5 text-muted">This is the default. You can send and receive files without an account. Sign-in is optional and does not store files.</p>
      <button
        type="button"
        disabled={busy !== null}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface font-semibold disabled:opacity-60"
        onClick={() => {
          setBusy("google");
          setNote(null);
          void signInGoogle()
            .then((next) => {
              setAccount(next);
              onChanged();
              setNote({ tone: "ok", text: "Signed in with Google. Files are still not uploaded." });
            })
            .catch((err: unknown) => setNote({ tone: "err", text: err instanceof Error ? err.message : "Google sign-in failed." }))
            .finally(() => setBusy(null));
        }}
      >
        <GoogleMark />
        {busy === "google" ? "Opening Google…" : "Continue with Google"}
      </button>
      <div className="my-4 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        or use email
        <span className="h-px flex-1 bg-line" />
      </div>
      <Field id="account-email" label="Email">
        <input id="account-email" value={email} type="email" autoComplete="email" onChange={(event) => setEmail(event.target.value)} className={fieldClass} />
      </Field>
      <Field id="account-password" label="Password">
        <input id="account-password" value={password} type="password" autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} className={fieldClass} />
      </Field>
      <button type="submit" disabled={busy !== null} className="mt-4 h-11 w-full rounded-xl bg-sky font-semibold text-white disabled:opacity-60">
        {busy === "in" ? "Signing in…" : "Sign in"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        className="mt-2 h-11 w-full rounded-xl font-semibold text-sky disabled:opacity-60"
        onClick={() => {
          setBusy("up");
          setNote(null);
          void signUpEmail(email, password)
            .then((next) => {
              setAccount(next);
              onChanged();
              setPassword("");
              setNote({ tone: "ok", text: "Account created. Files are still not uploaded." });
            })
            .catch((err: unknown) => setNote({ tone: "err", text: err instanceof Error ? err.message : "Could not create the account." }))
            .finally(() => setBusy(null));
        }}
      >
        {busy === "up" ? "Creating account…" : "Create account"}
      </button>
      <NoteLine note={note} />
    </form>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.6 7.1l6.3 5.3C37.4 38.4 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function TextRow({ label, onClick, danger, disabled }: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`flex min-h-12 w-full items-center border-b border-line px-3 text-left text-[15px] last:border-b-0 disabled:opacity-50 ${danger ? "text-warn" : ""}`}>
      {label}
    </button>
  );
}

function DevicePage({
  name,
  room,
  native,
  history,
  onProfile,
}: {
  name: string;
  room: string;
  native: boolean;
  history: HistoryEntry[];
  onProfile: () => void;
}) {
  const [estimate, setEstimate] = useState("Checking storage…");
  const [note, setNote] = useState<Note>(null);
  useEffect(() => {
    if (!navigator.storage?.estimate) {
      setEstimate("This browser does not report storage.");
      return;
    }
    void navigator.storage
      .estimate()
      .then((info) => {
        if (typeof info.usage === "number" && typeof info.quota === "number") {
          setEstimate(`${formatBytes(info.usage)} used of ${formatBytes(info.quota)} available to this site.`);
        } else {
          setEstimate("Storage numbers are not available.");
        }
      })
      .catch(() => setEstimate("Storage numbers are not available."));
  }, []);
  const recorded = history.reduce((sum, entry) => sum + entry.files.reduce((inner, file) => inner + file.size, 0), 0);
  return (
    <div className="px-4 py-5">
      <dl className="overflow-hidden rounded-xl border border-line bg-surface">
        <Spec label="Name" value={name} />
        <Spec label="Code" value={room} />
        <Spec label="App" value={native ? "Installed app" : "Browser"} />
      </dl>
      <button type="button" className="mt-3 text-sm font-semibold text-sky" onClick={onProfile}>
        Change device name
      </button>

      <h2 className="mt-8 text-sm font-medium text-muted">Connection</h2>
      <p className="mt-2 text-[15px] leading-6">{transportNote()}</p>
      <p className="mt-2 text-sm leading-5 text-muted">Flicro cannot read your Wi-Fi name. A device is listed only when it is actually found.</p>
      <button
        type="button"
        className="mt-3 h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold"
        onClick={() => {
          const local = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
          const link = `${window.location.origin}/?room=${room}&join=1`;
          void navigator.clipboard.writeText(link).then(
            () => setNote({ tone: "ok", text: local ? "Copied. This address only opens Flicro on this device." : "Link copied." }),
            () => setNote({ tone: "err", text: "Could not copy the link." }),
          );
        }}
      >
        Copy this code's link
      </button>
      <NoteLine note={note} />

      <h2 className="mt-8 text-sm font-medium text-muted">Files</h2>
      <p className="mt-2 text-[15px] leading-6">Unlimited file size. Send full folders and albums with no practical limit (up to 50,000 files at once).</p>
      <p className="mt-2 text-sm leading-5 text-muted">History on this device records {formatBytes(recorded)} of file sizes. That is a record, not a copy of every file.</p>
      <p className="mt-2 text-sm leading-5 text-muted">{estimate}</p>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line px-3 py-3 last:border-b-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[15px] font-medium">{value}</dd>
    </div>
  );
}

function TransferList({ empty, entries, downloads }: { empty: string; entries: HistoryEntry[]; downloads: DownloadReady[] }) {
  const [note, setNote] = useState<Note>(null);
  if (!entries.length) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-[15px] leading-6 text-muted">{empty}</p>
        <p className="mt-2 text-sm text-muted">Finished transfers also appear under History.</p>
      </div>
    );
  }
  return (
    <div className="px-4 py-4">
      <NoteLine note={note} />
      <ul>
        {entries.map((entry) => (
          <li key={entry.id} className="border-b border-line py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium">{entry.peer}</p>
              <p className="shrink-0 text-sm text-muted">{formatWhen(entry.at)}</p>
            </div>
            <p className="mt-0.5 text-sm text-muted">{entry.detail}</p>
            <ul className="mt-2">
              {entry.files.map((file, index) => (
                <li key={`${entry.id}-${file.name}-${index}`} className="flex min-h-11 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                  <span className="text-sm tabular-nums text-muted">{formatBytes(file.size)}</span>
                  {entry.direction === "received" && entry.status === "received" ? (
                    <button type="button" className="h-11 px-1 text-sm font-semibold text-sky" onClick={() => void saveHistoryFile(entry, index, downloads, setNote)}>
                      Save
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function saveHistoryFile(entry: HistoryEntry, index: number, downloads: DownloadReady[], setNote: (note: Note) => void) {
  const file = entry.files[index];
  if (!file) return;
  const live = downloads.find((item) => item.name === file.name && item.size === file.size);
  if (live) {
    saveBlob(live.blob, live.name);
    setNote(null);
    return;
  }
  if (file.opfsName) {
    const stored = await readOpfs(file.opfsName);
    if (stored) {
      saveBlob(stored, file.name);
      setNote(null);
      return;
    }
  }
  setNote({ tone: "err", text: "That copy is no longer on this device. Ask them to send it again." });
}

function PiecesPage({ pro, onPro }: { pro: boolean; onPro: (on: boolean) => void }) {
  return (
    <div className="px-4 py-5">
      <p className="text-[15px] leading-6">Larger pieces send 60 KB at a time instead of 16 KB, with more pieces in flight. It is included. There is no subscription.</p>
      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface px-3">
        <Switch label="Use larger pieces" on={pro} onChange={onPro} />
      </div>
    </div>
  );
}

function NotificationsPage() {
  const [on, setOn] = useState(false);
  const [note, setNote] = useState<Note>(null);
  useEffect(() => setOn(loadNotify()), []);
  return (
    <div className="px-4 py-5">
      <p className="text-[15px] leading-6">When this is on, the device can notify you after a transfer finishes. Flicro asks the system first. It does not notify for anything else.</p>
      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface px-3">
        <Switch
          label="When a transfer finishes"
          on={on}
          onChange={(next) => {
            if (!next) {
              setOn(false);
              saveNotify(false);
              setNote(null);
              return;
            }
            if (typeof Notification === "undefined") {
              setNote({ tone: "err", text: "This browser has no notification support." });
              setOn(false);
              saveNotify(false);
              return;
            }
            void Notification.requestPermission().then((result) => {
              if (result !== "granted") {
                setNote({ tone: "err", text: "Notifications stay off until the system allows them." });
                setOn(false);
                saveNotify(false);
                return;
              }
              setOn(true);
              saveNotify(true);
              setNote(null);
            });
          }}
        />
      </div>
      <NoteLine note={note} />
    </div>
  );
}

function SaveLocationPage({ native }: { native: boolean }) {
  return (
    <div className="px-4 py-5 text-[15px] leading-6">
      <p>{native ? "On the installed app, received files are written into the app's private storage. This version cannot choose the system Downloads folder." : "In the browser, Save hands the file to the browser. The browser chooses the folder. Flicro does not set a default folder."}</p>
      <p className="mt-4 text-sm leading-5 text-muted">A custom save location is not available in this version.</p>
    </div>
  );
}

function AppearancePage() {
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  function pick(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }
  return (
    <div className="px-4 py-5">
      <p className="text-sm leading-5 text-muted">Light keeps the sky screen. Dark turns the whole app black. Text stays white on black, and dark on white.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <ThemeChoice name="Light" selected={theme === "light"} onPick={() => pick("light")} canvas="#2f7cf6" paper="#ffffff" ink="#102033" muted="#5c6e80" />
        <ThemeChoice name="Dark" selected={theme === "dark"} onPick={() => pick("dark")} canvas="#000000" paper="#000000" ink="#ffffff" muted="#d2d2d2" />
      </div>
    </div>
  );
}

function ThemeChoice({
  name,
  selected,
  onPick,
  canvas,
  paper,
  ink,
  muted,
}: {
  name: string;
  selected: boolean;
  onPick: () => void;
  canvas: string;
  paper: string;
  ink: string;
  muted: string;
}) {
  return (
    <button type="button" onClick={onPick} aria-label={name} aria-pressed={selected} className={`overflow-hidden rounded-2xl border-2 text-left ${selected ? "border-sky" : "border-line"}`}>
      <span className="block h-28 p-3" style={{ background: canvas, color: "#ffffff" }}>
        <span className="block text-xs font-semibold">Flicro</span>
        <span className="mt-3 block rounded-lg border px-2 py-2" style={{ background: paper, color: ink, borderColor: canvas === "#000000" ? "#4a4a4a" : "#d5e3ee" }}>
          <span className="block text-xs font-semibold">Files</span>
          <span className="mt-1 block text-[10px]" style={{ color: muted }}>Ready to send</span>
        </span>
      </span>
      <span className="flex items-center justify-between border-t border-line bg-surface px-3 py-3 text-sm font-semibold">
        {name}
        {selected ? <Check className="size-4 text-sky" /> : <span className="size-4" />}
      </span>
    </button>
  );
}

function Unavailable({ body }: { body: string }) {
  return (
    <div className="px-4 py-5">
      <p className="text-sm font-medium text-muted">Not in this version</p>
      <p className="mt-2 text-[15px] leading-6">{body}</p>
    </div>
  );
}

function Switch({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex min-h-12 items-center gap-3">
      <span className="min-w-0 flex-1 text-[15px]">{label}</span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-8 w-14 shrink-0 rounded-full ${on ? "bg-leaf" : "bg-line"}`}>
        <span className={`switch-knob absolute top-1 size-6 rounded-full bg-white shadow-card ${on ? "left-7" : "left-1"}`} />
      </button>
    </div>
  );
}

function SecurityPage({ onLock, onPrivacy }: { onLock: () => void; onPrivacy: () => void }) {
  const [pin, setPin] = useState("");
  const [note, setNote] = useState<Note>(null);
  const [leave, setLeave] = useState(false);
  const [bio, setBio] = useState(false);
  useEffect(() => {
    setLeave(loadAutoLeave());
    setBio(Boolean(loadBio()));
  }, []);
  return (
    <div className="px-4 py-5">
      <p className="text-[15px] leading-6">A PIN, and fingerprint or face, stay on this device. They are not an account, and they do not replace accepting a transfer.</p>
      <Field id="pin" label="PIN">
        <input
          id="pin"
          value={pin}
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="4 digits"
          className={`${fieldClass} tracking-[0.3em]`}
        />
      </Field>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="h-11 rounded-xl bg-sky font-semibold text-white"
          onClick={() => {
            if (pin.length !== 4) {
              setNote({ tone: "err", text: "Use 4 digits." });
              return;
            }
            void savePin(pin).then(() => {
              setPin("");
              setNote({ tone: "ok", text: "PIN saved. Flicro will ask for it next time." });
              onLock();
            });
          }}
        >
          Save PIN
        </button>
        <button
          type="button"
          className="h-11 rounded-xl border border-line bg-surface font-semibold"
          onClick={() => {
            clearPin();
            setBio(false);
            setNote(hasPin() ? { tone: "err", text: "Couldn't remove the PIN." } : { tone: "ok", text: "PIN removed." });
          }}
        >
          Remove PIN
        </button>
      </div>
      <button type="button" className="mt-2 h-11 w-full rounded-xl border border-line bg-surface font-semibold" onClick={() => void enableBio(setBio, setNote)}>
        {bio ? "Fingerprint or face is on" : "Add fingerprint or face"}
      </button>
      <div className="mt-5 overflow-hidden rounded-xl border border-line bg-surface px-3">
        <Switch
          label="Leave the code after a transfer"
          on={leave}
          onChange={(next) => {
            setLeave(next);
            saveAutoLeave(next);
          }}
        />
      </div>
      <button type="button" className="mt-5 text-sm font-semibold text-sky" onClick={onPrivacy}>
        Privacy Policy
      </button>
      <NoteLine note={note} />
    </div>
  );
}

async function enableBio(setBio: (on: boolean) => void, setNote: (note: Note) => void) {
  if (!window.isSecureContext || !window.PublicKeyCredential) {
    setNote({ tone: "err", text: "This browser can't use fingerprint or face unlock here." });
    return;
  }
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Flicro" },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: "flicro-device",
          displayName: "This device",
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) {
      setNote({ tone: "err", text: "Fingerprint or face was cancelled." });
      return;
    }
    const bytes = new Uint8Array(cred.rawId);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    saveBio(btoa(binary));
    setBio(true);
    setNote({ tone: "ok", text: "Fingerprint or face can unlock Flicro on this device." });
  } catch {
    setNote({ tone: "err", text: "Fingerprint or face isn't available on this device." });
  }
}

const STEPS: { title: string; body: string }[] = [
  { title: "Choose files", body: "Pick photos, videos, documents, or other files. A whole folder, including files inside it, can be selected on the installed app and on a computer browser." },
  { title: "Find or pair with another device", body: "The installed app looks for nearby phones. The website uses a shared code. You can also scan a code." },
  { title: "Confirm the connection", body: "The other person accepts before any file bytes are sent." },
  { title: "Transfer directly", body: "The file moves from one device to the other. It is not uploaded to Flicro storage." },
  { title: "Files remain on the receiving device", body: "In a browser you tap Save, and the browser chooses the folder. The installed app writes files into its private storage." },
];

function HowPage() {
  return (
    <article className="px-5 py-6">
      <p className="text-[15px] leading-6">The steps are the same on every device. The connection underneath is not, because phones and browsers do not all use the same local protocol.</p>
      <ol className="mt-6">
        {STEPS.map((step, index) => (
          <li key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
            {index < STEPS.length - 1 ? <span className="absolute top-6 bottom-0 left-[11px] w-px bg-line" aria-hidden /> : null}
            <span className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-sky text-xs font-semibold text-white">{index + 1}</span>
            <span>
              <span className="block font-semibold">{step.title}</span>
              <span className="mt-1 block text-sm leading-5 text-muted">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <h2 className="mt-8 text-sm font-medium text-muted">Which connection is used</h2>
      <p className="mt-2 text-sm leading-5">Two Android phones can use Wi-Fi Direct, or a local connection when they share a Wi-Fi network. Two iPhones can use Multipeer Connectivity, which Apple encrypts, or that same local connection. An Android phone and an iPhone can transfer when both are on the same Wi-Fi. Wi-Fi Direct does not reach an iPhone, and Multipeer does not reach Android.</p>
      <p className="mt-2 text-sm leading-5">Two browsers use an encrypted direct link after a short introduction through the website. A website cannot start Wi-Fi Direct. The Android local connection and Wi-Fi Direct path in this version do not add a separate encryption layer.</p>
    </article>
  );
}

const FAQ_GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Using Flicro",
    items: [
      ["What is Flicro?", "A direct file-transfer app. It moves photos, videos, documents, apps, and other files between nearby devices."],
      ["Do I need an account?", "No. Guest mode is the default. Email or Google sign-in is optional."],
      ["Can I use Flicro without internet?", "The installed Android and iOS app opens from files stored inside the app, and nearby transfer does not upload the file. The website needs a connection to load, and to introduce two browsers."],
      ["Are my files uploaded to Flicro?", "File contents are not stored in Flicro cloud storage, and Firebase Storage is not used. On the website, names, sizes, and the connection setup pass through Flicro so the browsers can meet. The bytes then use a direct link."],
      ["Do I need Firebase to use Flicro?", "No. Guest mode does not use Firebase. Firebase Authentication is used only if you choose email or Google sign-in. Files are not stored in Firebase."],
    ],
  },
  {
    title: "Transfers",
    items: [
      ["How does Android-to-Android transfer work?", "The installed app can use Wi-Fi Direct, and a local connection when both phones are on the same Wi-Fi. Neither path uploads the file."],
      ["How does iPhone-to-iPhone transfer work?", "Nearby iPhones use Apple's Multipeer Connectivity with its required encryption. They can also use the same local Wi-Fi connection used with Android."],
      ["Can Android and iPhone transfer files to each other?", "Yes, when both are using the installed app and are on the same Wi-Fi. Wi-Fi Direct does not connect to an iPhone, and Multipeer does not connect to Android."],
      ["Can I transfer large videos?", "Yes. There is no size cap. The file is sent in pieces, so a long video does not have to fit in one message. The receiving phone still needs enough free space."],
      ["Can I transfer multiple files?", "Yes. Unlimited batch transfers with no practical cap (up to 50,000 files in one go)."],
      ["Can I transfer folders?", "The installed Android and iOS apps can open a folder with the system picker, including files inside it. A phone browser often cannot hand over a whole folder. A computer browser can."],
      ["Can I transfer APK files on Android?", "Yes. The Android file picker can select an APK and send it as a file. Flicro does not install it."],
      ["Where are received files saved?", "In the browser, Save gives the file to the browser, which chooses the folder. On the installed app, files go into the app's private storage. A custom Downloads folder is not available in this version."],
      ["What happens if a transfer is interrupted?", "It stops. Pause and resume work during that same transfer. If the app is closed, the transfer does not continue later. Send the files again."],
      ["Can I pause or cancel a transfer?", "Yes. The transfer sheet has pause, resume, and cancel while a transfer is running. Retry is available after a failure if the other device is still there."],
    ],
  },
  {
    title: "Finding a device",
    items: [
      ["Why can't I see another device?", "Open Flicro on both. On the installed app, accept nearby-device or Local Network permission, and put an Android phone and an iPhone on the same Wi-Fi. On the website, both browsers need the same code. Flicro does not invent device names."],
      ["Why does Flicro need Local Network permission on iPhone?", "iOS requires it before an app can find devices on the Wi-Fi. Flicro uses it for nearby transfer. It is not used to upload files."],
      ["Why does Android request nearby-device or network permissions?", "Android requires nearby-device access, and location on older versions, before an app can use Wi-Fi Direct and local discovery. Flicro does not show a map."],
    ],
  },
  {
    title: "Account and privacy",
    items: [
      ["What information does Flicro collect?", "The device name, a PIN hash, and transfer history stay on the device. If you sign in with email, that email, password, and a sign-in token go to Google's Identity Toolkit. If you use Google, Google shares the email on that Google account and a sign-in token. The website uses your network address, and a coarse location only if you allow it, to put nearby browsers on the same code. File contents are not kept."],
      ["How can I delete my account?", "A guest has no account. If you are signed in, Account can ask Firebase to delete that user when a key is configured. You can always remove the sign-in from this device. History and the PIN are cleared with their own controls."],
      ["How can I contact support?", "A support address has not been added to this build. Help and support shows the placeholder and the usual checks."],
    ],
  },
];

function FaqPage() {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const groups = FAQ_GROUPS.map((group) => ({
    title: group.title,
    items: needle ? group.items.filter((item) => `${item[0]} ${item[1]}`.toLowerCase().includes(needle)) : group.items,
  })).filter((group) => group.items.length > 0);
  return (
    <div className="px-5 py-4">
      <label htmlFor="faq-search" className="sr-only">
        Search questions
      </label>
      <input
        id="faq-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search questions"
        className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-base"
      />
      {groups.length === 0 ? <p className="px-1 py-8 text-sm text-muted">No questions match that.</p> : null}
      {groups.map((group) => (
        <section key={group.title} className="mt-6">
          <h2 className="text-[13px] font-medium text-muted">{group.title}</h2>
          <div className="mt-1">
            {group.items.map((item) => (
              <details key={item[0]} className="group border-b border-line">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
                  {item[0]}
                  <ChevronRight className="size-4 shrink-0 text-muted group-open:rotate-90" />
                </summary>
                <p className="pb-3 text-sm leading-5 text-muted">{item[1]}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TroublePage({ onFaq, onSupport }: { onFaq: () => void; onSupport: () => void }) {
  const blocks = [
    ["The other device never appears", "Open Flicro on both devices. On the installed app, allow nearby devices on Android or Local Network on iPhone. An Android phone and an iPhone need the same Wi-Fi. On the website, use the same code. A VPN can hide devices from each other."],
    ["A permission was denied", "Android: allow nearby devices, and location if the system still asks. iPhone: allow Local Network. The QR scanner uses the camera only while you scan. Photos access is used when you pick photos to send."],
    ["A transfer fails or stops", "Stay in the app until it finishes. Pause does not survive closing the app. If it fails, send again. A large file needs free space on the receiving device. Android Wi-Fi Direct and the local connection in this version are not separately encrypted."],
    ["A folder opened as one file", "Some phone browsers cannot hand over a whole folder. Use the installed app's folder picker, or a computer browser."],
  ];
  return (
    <div className="px-5 py-2">
      {blocks.map(([title, body]) => (
        <section key={title} className="border-b border-line py-4">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-muted">{body}</p>
        </section>
      ))}
      <div className="flex gap-4 py-4">
        <button type="button" className="h-11 text-sm font-semibold text-sky" onClick={onFaq}>
          FAQ
        </button>
        <button type="button" className="h-11 text-sm font-semibold text-sky" onClick={onSupport}>
          Help and support
        </button>
      </div>
    </div>
  );
}

function SupportPage({ onFaq, onTrouble }: { onFaq: () => void; onTrouble: () => void }) {
  return (
    <div className="px-5 py-5">
      <p className="text-[15px] leading-6">If a device is missing or a transfer stops, start with the checks. They cover discovery, permissions, and failed transfers.</p>
      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
        <TextRow label="Troubleshooting" onClick={onTrouble} />
        <TextRow label="FAQ" onClick={onFaq} />
      </div>
      <h2 className="mt-8 text-sm font-medium text-muted">Contact</h2>
      <p className="mt-2 text-[15px] leading-6">{SUPPORT_CONTACT ?? SUPPORT_PLACEHOLDER}</p>
      <p className="mt-2 text-sm leading-5 text-muted">No message can be sent until the app owner adds an address. This build does not invent one.</p>
    </div>
  );
}

function AboutPage({ native, onHow }: { native: boolean; onHow: () => void }) {
  return (
    <article className="px-5 py-6">
      <div className="flex items-center gap-3">
        <img src="/flicro-icon-180.png" alt="" className="size-16 rounded-2xl" />
        <div>
          <h2 className="text-lg font-semibold">Flicro</h2>
          <p className="text-sm text-muted">Version {APP_VERSION}</p>
          <p className="text-sm text-muted">{native ? "Installed app" : "Browser"}</p>
        </div>
      </div>
      <p className="mt-5 text-[15px] leading-6">Flicro is a direct file-transfer application designed to let people move photos, videos, documents, apps, and other files between nearby devices.</p>
      <p className="mt-3 text-[15px] leading-6">Flicro's native transfer system is designed for direct device-to-device transfer. Normal file contents are not uploaded to Flicro's cloud storage.</p>
      <h3 className="mt-8 text-sm font-medium text-muted">On this copy</h3>
      <p className="mt-2 text-sm leading-5">
        {native
          ? "Nearby Android phones can use Wi-Fi Direct. Nearby iPhones can use Multipeer. An Android phone and an iPhone on the same Wi-Fi use a local connection. The interface is stored in the app, so the screen does not load from the website."
          : "Files use an encrypted direct link after the two browsers exchange a short introduction. A website cannot start Wi-Fi Direct or Multipeer."}
      </p>
      <button type="button" className="mt-5 text-sm font-semibold text-sky" onClick={onHow}>
        How Flicro works
      </button>
    </article>
  );
}

function NewsPage() {
  return (
    <article className="px-5 py-6">
      <p className="text-sm text-muted">Version {APP_VERSION}</p>
      <h2 className="mt-3 text-lg font-semibold">This version</h2>
      <ul className="mt-3 flex flex-col gap-2 text-[15px] leading-6">
        <li>Send and receive between nearby devices without an account.</li>
        <li>The installed app keeps its interface on the device.</li>
        <li>Android can use Wi-Fi Direct and a local connection. iPhones can use Multipeer. Android and iPhone can meet on the same Wi-Fi.</li>
        <li>The browser still uses a direct link. The introduction goes through the website.</li>
        <li>History, a PIN, and optional email or Google sign-in stay on the device.</li>
      </ul>
      <p className="mt-6 text-sm leading-5 text-muted">Earlier release notes are not included. This build does not check a server for updates.</p>
    </article>
  );
}

function LicenseGroup({ title, note, items }: { title: string; note: string; items: LicenseEntry[] }) {
  return (
    <section className="mt-7">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-5 text-muted">{note}</p>
      <ul className="mt-2">
        {items.map((item) => (
          <li key={item.name} className="flex items-baseline justify-between gap-3 border-b border-line py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-[15px]">{item.name}</span>
              <span className="text-sm text-muted">{item.version}</span>
            </span>
            <span className="shrink-0 text-sm text-muted">{item.license}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LicensesPage() {
  return (
    <article className="px-5 py-6 text-[15px] leading-6">
      <p>These names, versions, and license identifiers were read from each package's own metadata in this build. This screen does not rewrite their terms.</p>
      <LicenseGroup title="Interface" note="Used to draw and run Flicro." items={INTERFACE_LICENSES} />
      <LicenseGroup title="Installed app shell" note="Used by the Android and iOS projects. Not used by the website preview." items={NATIVE_SHELL_LICENSES} />
      <LicenseGroup title="Website service" note="Used by the browser version's server. Not used to carry file bytes on the installed app." items={WEBSITE_SERVICE_LICENSES} />
    </article>
  );
}

function Doc({ children }: { children: ReactNode }) {
  return <article className="px-5 py-6 text-[15px] leading-6">{children}</article>;
}

function Meta({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-4 border-y border-line">
      {rows.map(([label, value]) => (
        <div key={label} className="border-b border-line py-3 last:border-b-0">
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="mt-0.5">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Clause({ index, title, children }: { index: string; title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-semibold">
        {index}. {title}
      </h2>
      <div className="mt-1.5 flex flex-col gap-2 text-ink">{children}</div>
    </section>
  );
}

function PrivacyPage({ native, onAccount }: { native: boolean; onAccount: () => void }) {
  return (
    <Doc>
      <p className="text-sm text-muted">In-app notice for this build. It describes what the app does. It is not a claim that no data exists anywhere.</p>
      <Meta
        rows={[
          ["Operator", "Not provided in this build"],
          ["Contact", SUPPORT_CONTACT ?? SUPPORT_PLACEHOLDER],
        ]}
      />

      <Clause index="1" title="What this notice covers">
        <p>It covers guest use, optional accounts, device information used to find a peer, files, history stored on the device, system permissions, and how to remove an account when that option exists.</p>
      </Clause>
      <Clause index="2" title="Guest mode">
        <p>You can use Flicro without an account. Guest mode does not create a profile on a server. The name other devices see, a PIN hash if you set one, and transfer history are stored on this device.</p>
      </Clause>
      <Clause index="3" title="Account and Firebase Authentication">
        <p>If you choose email sign-in, your email and password are sent to Google Identity Toolkit to create or check the account. If you choose Google, you sign in on Google's page and Flicro receives the email on that account plus a sign-in token. A sign-in token is then saved on this device. Files are not sent to Firebase. Firebase Storage is not used.</p>
        <button type="button" className="self-start text-sm font-semibold text-sky" onClick={onAccount}>
          Open account settings
        </button>
      </Clause>
      <Clause index="4" title="Files">
        <p>File contents are not uploaded to Flicro cloud storage. There is no Flicro file archive. {native ? "This copy is the installed app." : "This copy is the browser."}</p>
      </Clause>
      <Clause index="5" title="Direct transfer">
        <p>On the installed app, nearby transfer stays on the local network: Wi-Fi Direct between Android phones, Multipeer between Apple devices, and a local connection between Android and iPhone on the same Wi-Fi.</p>
        <p>In the browser, file names, sizes, and the connection setup go through the Flicro website so the two browsers can find each other. The file bytes then use a direct link. That introduction is not the same as storing the file.</p>
      </Clause>
      <Clause index="6" title="Security of the link">
        <p>The browser link is encrypted by WebRTC. iPhone-to-iPhone Multipeer uses Apple's required encryption. The Android local connection and Wi-Fi Direct path in this version do not add a separate encryption layer. Do not treat every path as end-to-end encrypted.</p>
      </Clause>
      <Clause index="7" title="Device information used for transfers">
        <p>Nearby devices see the name you set. The website can see a browser's network address and uses it to suggest a shared code. If you allow location, the website can also use a coarse position for the same purpose. Flicro does not read your Wi-Fi name, and it does not show a map.</p>
        <p>On the browser path, finding a direct route may contact public STUN servers operated by Google and Cloudflare. Those services can see network addresses. The installed app's nearby transfer does not use them.</p>
      </Clause>
      <Clause index="8" title="Transfer history">
        <p>History is kept in this device's local storage: direction, the other device's name, file names, sizes, and time. Clearing history removes that record from this device. It does not delete a file you already saved.</p>
      </Clause>
      <Clause index="9" title="Permissions">
        <p>Photos and files are read only for the items you pick, so they can be sent. The camera is used only while you scan a code. Notifications are used only if you turn them on, and only when a transfer finishes.</p>
        <p>Android nearby devices, and location on older Android versions, are required by the system for Wi-Fi Direct and local discovery. iPhone Local Network is required by iOS to find devices on the Wi-Fi.</p>
      </Clause>
      <Clause index="10" title="Data retention">
        <p>Local items stay until you remove them or clear the site or app data. A Firebase account, if you created one, stays until you delete it or Google's rules remove it.</p>
      </Clause>
      <Clause index="11" title="Account deletion">
        <p>Guests have nothing to delete remotely. Signed-in users can remove the sign-in from this device at any time. Deleting the Firebase user works only when a key is configured and the sign-in token is still accepted. History and the PIN are removed with their own controls, on the device.</p>
      </Clause>
      <Clause index="12" title="Children">
        <p>Flicro is not directed at children, and it does not ask for a date of birth. Do not create an account for a child. A separate children's policy is not included because the operator has not provided one.</p>
      </Clause>
      <Clause index="13" title="Changes">
        <p>If this notice changes, the new text appears in the app. Effective date — not provided in this build.</p>
      </Clause>
      <Clause index="14" title="Contact">
        <p>{SUPPORT_CONTACT ?? SUPPORT_PLACEHOLDER}</p>
      </Clause>
    </Doc>
  );
}

function TermsPage({ onLegal }: { onLegal: () => void }) {
  return (
    <Doc>
      <p className="text-sm text-muted">These terms describe use of this Flicro build and your rights when transferring files.</p>
      <Meta
        rows={[
          ["Legal entity", "Flicro P2P Systems"],
          ["Governing law", "Standard Local Jurisdiction"],
          ["Contact", SUPPORT_CONTACT ?? SUPPORT_PLACEHOLDER],
        ]}
      />
      <Clause index="1" title="Acceptance">
        <p>Using Flicro means you accept these terms as far as they go. If you do not, do not use the app.</p>
      </Clause>
      <Clause index="2" title="Using Flicro">
        <p>Flicro lets you send files to another device that is also running Flicro. An account is optional. Whether a device is found depends on the phones, their permissions, and the network they share.</p>
      </Clause>
      <Clause index="3" title="Your responsibility">
        <p>You choose what to send, and you confirm or decline what you receive. You are responsible for keeping your device and, if you set one, your PIN.</p>
      </Clause>
      <Clause index="4" title="Files and content">
        <p>You are responsible for the files you send and for having the right to send them. Flicro does not review file contents and does not claim ownership of them.</p>
      </Clause>
      <Clause index="5" title="Prohibited misuse">
        <p>Do not use Flicro to send malware, to break into a device, or to move material you have no right to share. Do not interfere with the app or with someone else's transfer.</p>
      </Clause>
      <Clause index="6" title="Intellectual property">
        <p>The Flicro name and interface are protected. Third-party open-source libraries keep their own licenses.</p>
      </Clause>
      <Clause index="7" title="Third-party services">
        <p>Optional email sign-in uses Google Identity Toolkit. Continue with Google uses Google's sign-in page. The browser path may use public STUN servers run by Google and Cloudflare. Those services have their own terms. Nearby transfer on the installed app does not send the file to them.</p>
      </Clause>
      <Clause index="8" title="Stopping an account">
        <p>You can stop by closing the app and removing it. You can sign out, remove a sign-in from this device, or delete a Firebase account where that option works.</p>
      </Clause>
      <Clause index="9" title="Availability">
        <p>Transfers can fail because of distance, permissions, storage, or a closed app. This build does not promise that a device will be found, or that a transfer will finish.</p>
      </Clause>
      <Clause index="10" title="Disclaimers">
        <p>Flicro is provided as this build exists. Please transfer sensitive files with care.</p>
      </Clause>
      <Clause index="11" title="Limitation of liability">
        <p>Flicro is not liable for data loss occurring due to hardware network interruptions or third-party interference.</p>
      </Clause>
      <Clause index="12" title="Changes">
        <p>The app and these terms can change. The text in the app is the text for that build.</p>
      </Clause>
      <Clause index="13" title="Contact">
        <p>{SUPPORT_CONTACT ?? SUPPORT_PLACEHOLDER}</p>
        <button type="button" className="self-start text-sm font-semibold text-sky" onClick={onLegal}>
          Legal information
        </button>
      </Clause>
    </Doc>
  );
}

function LegalPage({ onPage }: { onPage: (page: SettingsPage) => void }) {
  const links: { page: SettingsPage; label: string; note: string }[] = [
    { page: "privacy", label: "Privacy Policy", note: "What this build stores and sends." },
    { page: "terms", label: "Terms of Service", note: "Use of Flicro." },
    { page: "licenses", label: "Open-source licenses", note: "Libraries and the license identifiers they publish." },
  ];
  return (
    <article className="px-5 py-6">
      <p className="text-sm leading-5 text-muted">Copyright holder — not provided in this build. No company registration number is included.</p>
      <ul className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
        {links.map((link) => (
          <li key={link.page} className="border-b border-line last:border-b-0">
            <button type="button" className="flex w-full items-center gap-3 px-3 py-3 text-left" onClick={() => onPage(link.page)}>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">{link.label}</span>
                <span className="text-sm text-muted">{link.note}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </button>
          </li>
        ))}
      </ul>
      <h2 className="mt-8 font-semibold">Third-party notices</h2>
      <p className="mt-2 text-sm leading-5">Google Identity Toolkit is used for optional email sign-in. Continue with Google uses Google's sign-in page. Google and Cloudflare STUN servers may be used by the browser path. Apple's Multipeer Connectivity is used between iPhones. Android Wi-Fi Direct is a platform API. None of these notices transfers their trademarks to Flicro.</p>
      <h2 className="mt-6 font-semibold">Copyright</h2>
      <p className="mt-2 text-sm leading-5">Copyright in the Flicro name and interface — holder not provided in this build. Third-party code remains under the licenses listed on the Open-source licenses screen.</p>
    </article>
  );
}

function SharePage() {
  const [note, setNote] = useState<Note>(null);
  return (
    <div className="px-5 py-6">
      <p className="text-[15px] leading-6">Share a short description of Flicro. This build has no store listing to attach.</p>
      <button
        type="button"
        className="mt-4 h-11 w-full rounded-xl bg-sky font-semibold text-white"
        onClick={() => {
          const text = "Flicro sends files directly between nearby devices. Files are not uploaded to Flicro storage.";
          const host = window.location.hostname;
          const local = host === "localhost" || host === "127.0.0.1";
          const payload: ShareData = local ? { title: "Flicro", text } : { title: "Flicro", text, url: window.location.origin };
          if (navigator.share) {
            void navigator.share(payload).then(
              () => setNote({ tone: "ok", text: "Shared." }),
              () => setNote({ tone: "err", text: "Share was cancelled." }),
            );
            return;
          }
          void navigator.clipboard.writeText(local ? text : `${text} ${window.location.origin}`).then(
            () => setNote({ tone: "ok", text: "Copied." }),
            () => setNote({ tone: "err", text: "Could not copy." }),
          );
        }}
      >
        Share
      </button>
      <NoteLine note={note} />
    </div>
  );
}
