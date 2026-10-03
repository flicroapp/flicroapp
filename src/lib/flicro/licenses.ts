/** License identifiers read from each package's own package.json in this build. */
export type LicenseEntry = { name: string; version: string; license: string };

export const INTERFACE_LICENSES: LicenseEntry[] = [
  { name: "react", version: "19.3.0", license: "MIT" },
  { name: "react-dom", version: "19.3.0", license: "MIT" },
  { name: "@tanstack/react-router", version: "1.170.39", license: "MIT" },
  { name: "@tanstack/react-start", version: "1.168.58", license: "MIT" },
  { name: "lucide-react", version: "0.510.0", license: "ISC" },
  { name: "jsqr", version: "1.4.0", license: "Apache-2.0" },
  { name: "qrcode", version: "1.5.4", license: "MIT" },
  { name: "@capacitor/core", version: "8.5.2", license: "MIT" },
  { name: "firebase", version: "12.19.0", license: "Apache-2.0" },
];

/** Present in the Android and iOS projects. Not used by the website preview. */
export const NATIVE_SHELL_LICENSES: LicenseEntry[] = [
  { name: "@capacitor/android", version: "8.5.2", license: "MIT" },
  { name: "@capacitor/ios", version: "8.5.2", license: "MIT" },
];

/** Used by the website service. Not used to move file bytes on the installed app. */
export const WEBSITE_SERVICE_LICENSES: LicenseEntry[] = [
  { name: "better-auth", version: "1.6.33", license: "MIT" },
  { name: "jose", version: "6.2.9", license: "MIT" },
  { name: "kysely", version: "0.28.17", license: "MIT" },
  { name: "pg", version: "8.23.0", license: "MIT" },
  { name: "@electric-sql/pglite", version: "0.5.8", license: "Apache-2.0" },
  { name: "zod", version: "4.6.5", license: "MIT" },
];
