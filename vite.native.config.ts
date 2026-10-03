import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Static bundle for the installed Android and iOS apps.
 * The website build stays server-rendered. This one writes a self-contained
 * client into native-www, which Capacitor copies into the app.
 */
export default defineConfig({
  root: fileURLToPath(new URL("./src/native", import.meta.url)),
  base: "./",
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  build: {
    outDir: fileURLToPath(new URL("./native-www", import.meta.url)),
    emptyOutDir: true,
    assetsDir: "assets",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [tailwindcss(), react()],
});
