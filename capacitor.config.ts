import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The installed app loads native-www from the app package.
 * There is no remote server URL. File transfer stays on the native plugin.
 */
const config: CapacitorConfig = {
  appId: "com.flicro.app",
  appName: "Flicro",
  webDir: "native-www",
  server: {
    androidScheme: "https",
    hostname: "localhost",
  },
};

export default config;
