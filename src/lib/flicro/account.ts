/**
 * Guest is the default. Email and Google sign-in use Firebase Auth.
 * File bytes are never sent to Firebase.
 */
import { firebaseApiKey, firebaseConfig } from "@/lib/flicro/firebase-config";

export type Account = { guest: true } | { guest: false; email: string; idToken: string };

const KEY = "flicro-account";
const GOOGLE_PENDING = "flicro-google-pending";

type Saved = { email: string; idToken: string; refreshToken?: string };

export function firebaseConfigured(): boolean {
  return Boolean(firebaseApiKey());
}

export function loadAccount(): Account {
  const saved = readSaved();
  if (!saved) return { guest: true };
  return { guest: false, email: saved.email, idToken: saved.idToken };
}

export function signOutAccount() {
  localStorage.removeItem(KEY);
}

export function removeSignInFromDevice() {
  signOutAccount();
}

/** Asks Firebase Auth to delete the signed-in user. Does not delete files. */
export async function deleteFirebaseAccount(): Promise<void> {
  const saved = readSaved();
  if (!saved) throw new Error("There is no account on this device.");
  const key = firebaseApiKey();
  const idToken = await freshIdToken(saved);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const body = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) throw new Error(friendlyAuthError(body.error?.message, "Could not delete the account."));
  signOutAccount();
}

export async function signInEmail(email: string, password: string): Promise<Account> {
  checkEmailPassword(email, password);
  return passwordRequest("signInWithPassword", email.trim(), password, "Sign-in failed.");
}

export async function signUpEmail(email: string, password: string): Promise<Account> {
  checkEmailPassword(email, password);
  return passwordRequest("signUp", email.trim(), password, "Could not create the account.");
}

/** Opens Google. If the popup is blocked, the browser continues at Google and comes back. */
export async function signInGoogle(): Promise<Account> {
  const auth = await googleAuth();
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import("firebase/auth");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  sessionStorage.setItem(GOOGLE_PENDING, "1");
  try {
    const cred = await signInWithPopup(auth, provider);
    sessionStorage.removeItem(GOOGLE_PENDING);
    return await persistFirebaseUser(cred.user);
  } catch (err) {
    const code = firebaseErrorCode(err);
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, provider);
      return new Promise(() => {});
    }
    sessionStorage.removeItem(GOOGLE_PENDING);
    throw new Error(friendlyAuthError(err, "Google sign-in failed."));
  }
}

let redirectOnce: Promise<Account | null> | null = null;

/** Completes a Google redirect if this page load is the return trip. Safe to call more than once. */
export function finishGoogleRedirect(): Promise<Account | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (sessionStorage.getItem(GOOGLE_PENDING) !== "1") return Promise.resolve(null);
  if (!redirectOnce) {
    redirectOnce = (async () => {
      try {
        const auth = await googleAuth();
        const { getRedirectResult } = await import("firebase/auth");
        const cred = await getRedirectResult(auth);
        sessionStorage.removeItem(GOOGLE_PENDING);
        if (!cred?.user) return null;
        return await persistFirebaseUser(cred.user);
      } catch (err) {
        sessionStorage.removeItem(GOOGLE_PENDING);
        redirectOnce = null;
        throw new Error(friendlyAuthError(err, "Google sign-in failed."));
      }
    })();
  }
  return redirectOnce;
}

async function passwordRequest(method: "signInWithPassword" | "signUp", email: string, password: string, fallback: string): Promise<Account> {
  const key = firebaseApiKey();
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = (await res.json()) as { email?: string; idToken?: string; refreshToken?: string; error?: { message?: string } };
  if (!res.ok || !body.email || !body.idToken) {
    throw new Error(friendlyAuthError(body.error?.message, fallback));
  }
  return persist(body.email, body.idToken, body.refreshToken);
}

function checkEmailPassword(email: string, password: string) {
  if (!email.trim().includes("@")) throw new Error("Enter an email.");
  if (password.length < 6) throw new Error("Use at least 6 characters.");
}

function persist(email: string, idToken: string, refreshToken?: string): Account {
  const saved: Saved = { email, idToken };
  if (refreshToken) saved.refreshToken = refreshToken;
  localStorage.setItem(KEY, JSON.stringify(saved));
  return { guest: false, email, idToken };
}

async function persistFirebaseUser(user: { email: string | null; refreshToken: string; getIdToken: () => Promise<string> }): Promise<Account> {
  if (!user.email) throw new Error("Google did not share an email. Choose an account that has one.");
  const idToken = await user.getIdToken();
  return persist(user.email, idToken, user.refreshToken);
}

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; idToken?: string; refreshToken?: string };
    if (!parsed.email || !parsed.idToken) return null;
    return { email: parsed.email, idToken: parsed.idToken, refreshToken: parsed.refreshToken };
  } catch {
    return null;
  }
}

async function freshIdToken(saved: Saved): Promise<string> {
  if (!saved.refreshToken) return saved.idToken;
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(firebaseApiKey())}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: saved.refreshToken }),
  });
  const body = (await res.json()) as { id_token?: string; refresh_token?: string };
  if (!res.ok || !body.id_token) return saved.idToken;
  persist(saved.email, body.id_token, body.refresh_token || saved.refreshToken);
  return body.id_token;
}

async function googleAuth() {
  const { getFirebaseApp } = await import("@/lib/flicro/firebase-config");
  const { getAuth } = await import("firebase/auth");
  return getAuth(getFirebaseApp());
}

function firebaseErrorCode(err: unknown): string {
  if (err && typeof err === "object" && "code" in err && typeof err.code === "string") return err.code;
  return "";
}

function friendlyAuthError(err: unknown, fallback: string): string {
  const raw = typeof err === "string" ? err : err instanceof Error ? err.message : "";
  const code = firebaseErrorCode(err);
  const host = typeof location === "undefined" ? "this site" : location.hostname;
  if (code.includes("unauthorized-domain") || raw.includes("unauthorized-domain")) {
    return `Google blocked this site. In Firebase, open Authentication, then Settings, then Authorized domains, and add ${host}.`;
  }
  const known: [string, string][] = [
    ["EMAIL_NOT_FOUND", "No account uses that email. Create an account, or continue with Google."],
    ["INVALID_PASSWORD", "That password is wrong."],
    ["INVALID_LOGIN_CREDENTIALS", "That email or password is wrong."],
    ["INVALID_EMAIL", "That email doesn't look right."],
    ["MISSING_PASSWORD", "Enter a password."],
    ["WEAK_PASSWORD", "Use at least 6 characters."],
    ["EMAIL_EXISTS", "That email already has an account. Sign in instead."],
    ["TOO_MANY_ATTEMPTS_TRY_LATER", "Too many tries. Wait a minute and try again."],
    ["USER_DISABLED", "That account is disabled in Firebase."],
    ["OPERATION_NOT_ALLOWED", "That sign-in method is turned off in Firebase."],
    ["API_KEY_INVALID", "Firebase rejected the web key."],
    ["auth/popup-closed-by-user", "Google sign-in was cancelled."],
    ["auth/cancelled-popup-request", "Google sign-in was cancelled."],
    ["auth/popup-blocked", "The browser blocked the Google window."],
    ["auth/network-request-failed", "Couldn't reach Google. Check the connection and try again."],
    ["auth/account-exists-with-different-credential", "That email already uses a password. Sign in with email."],
    ["CREDENTIAL_TOO_OLD_LOGIN_AGAIN", "Sign in again, then delete the account."],
  ];
  for (const [key, text] of known) {
    if (code.includes(key) || raw.includes(key)) return text;
  }
  if (!raw || /^[A-Z0-9_ :.-]+$/.test(raw)) return fallback;
  return raw;
}
