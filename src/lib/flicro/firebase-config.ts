import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";

/**
 * Public web config from the Flicro Firebase project.
 * This is the browser key, not a service-account secret.
 * File bytes are never sent to Firebase.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyB-bW8JdzAs3oLtc9FaawGZHnbHKmxKkjA",
  authDomain: "flicroapp-19821.firebaseapp.com",
  projectId: "flicroapp-19821",
  storageBucket: "flicroapp-19821.firebasestorage.app",
  messagingSenderId: "43061476953",
  appId: "1:43061476953:web:6aa058d50caadb75f93b48",
  measurementId: "G-KHBQK55QVN",
  // TODO: Add your Google OAuth Web Client ID here for the seamless One Tap login.
  // Example: "123456789-abc123xyz.apps.googleusercontent.com"
  googleClientId: "", 
};

export function firebaseApiKey(): string {
  const fromEnv = import.meta.env.VITE_FIREBASE_API_KEY;
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  return firebaseConfig.apiKey;
}

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  const app = initializeApp({ ...firebaseConfig, apiKey: firebaseApiKey() });
  
  if (typeof window !== "undefined" && firebaseConfig.measurementId) {
    import("firebase/analytics")
      .then(({ getAnalytics, isSupported }) => {
        isSupported().then((yes) => {
          if (yes) getAnalytics(app);
        });
      })
      .catch(() => {});
  }
  
  return app;
}
