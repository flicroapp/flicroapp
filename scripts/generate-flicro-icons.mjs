import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const svgPath = join(root, "public", "flicro-icon.svg");
const svg = readFileSync(svgPath, "utf8");

function renderPng(width, height) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

console.log("Generating Flicro icons...");

const icon512 = renderPng(512, 512);
const icon180 = renderPng(180, 180);
const icon167 = renderPng(167, 167);
const icon152 = renderPng(152, 152);
const icon120 = renderPng(120, 120);

// Write new Flicro icons
writeFileSync(join(root, "public", "flicro-icon-512.png"), icon512);
writeFileSync(join(root, "public", "flicro-icon-180.png"), icon180);
writeFileSync(join(root, "public", "icon-512.png"), icon512);
writeFileSync(join(root, "public", "icon-180.png"), icon180);
writeFileSync(join(root, "public", "apple-touch-icon.png"), icon180);
writeFileSync(join(root, "public", "apple-touch-icon-180x180.png"), icon180);
writeFileSync(join(root, "public", "apple-touch-icon-167x167.png"), icon167);
writeFileSync(join(root, "public", "apple-touch-icon-152x152.png"), icon152);
writeFileSync(join(root, "public", "apple-touch-icon-120x120.png"), icon120);
writeFileSync(join(root, "public", "apple-touch-icon-precomposed.png"), icon180);

// Also copy icon-180.png to src/native/icon-180.png if needed
if (existsSync(join(root, "src", "native"))) {
  writeFileSync(join(root, "src", "native", "icon-180.png"), icon180);
}

// Remove old legacy icons
const oldFiles = [
  "v-icon.png",
  "v-icon-512.png",
  "flicro-icon-180.png",
  "flicro-icon-512.png",
];

for (const oldFile of oldFiles) {
  const p = join(root, "public", oldFile);
  if (existsSync(p)) {
    try {
      unlinkSync(p);
      console.log(`Deleted legacy icon: ${oldFile}`);
    } catch (e) {
      console.warn(`Could not delete ${oldFile}:`, e);
    }
  }
}

console.log("All Flicro icons generated successfully!");
