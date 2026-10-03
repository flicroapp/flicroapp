import fs from "node:fs";
import path from "node:path";

const files = ["pglite.data", "pglite.wasm", "initdb.wasm"];
const srcDir = path.resolve(process.cwd(), "node_modules/@electric-sql/pglite/dist");
const destDir = path.resolve(process.cwd(), ".vercel/output/functions/__server.func/_libs");

try {
  if (fs.existsSync(srcDir)) {
    fs.mkdirSync(destDir, { recursive: true });
    for (const file of files) {
      const src = path.join(srcDir, file);
      const dest = path.join(destDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }
  }
} catch (err) {
  // Ignored if pglite assets are optional
}
