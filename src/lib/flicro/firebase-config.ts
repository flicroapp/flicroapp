/**
 * Public web config from the Flicro Firebase project.
 * This is the browser key, not a service-account secret.
 * File bytes are never sent to Firebase.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyDX9yM1frryZumwS41VnbT0oiOSJlRTg_E",
  authDomain: "flicro.firebaseapp.com",
  projectId: "flicro",
  storageBucket: "flicro.firebasestorage.app",
  messagingSenderId: "206898624898",
  appId: "1:206898624898:web:0d89caf00f2c83d4d5f79b",
};

export function firebaseApiKey(): string {
  const fromEnv = import.meta.env.VITE_FIREBASE_API_KEY;
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  return firebaseConfig.apiKey;
}
