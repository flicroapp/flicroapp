import fs from "node:fs";
import path from "node:path";

const publicDir = path.resolve(process.cwd(), "public");

// Boy and sister holding phone photo illustration matching Screenshot 1 & 2
const kidsPhoneSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="wallBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fffbeb"/>
      <stop offset="60%" stop-color="#fef3c7"/>
      <stop offset="100%" stop-color="#fde68a"/>
    </linearGradient>
    <linearGradient id="sisterKurti" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="100%" stop-color="#facc15"/>
    </linearGradient>
    <linearGradient id="boyShirt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#93c5fd"/>
      <stop offset="100%" stop-color="#60a5fa"/>
    </linearGradient>
    <linearGradient id="skin1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fcd34d"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  
  <!-- Warm home wall background -->
  <rect width="400" height="400" fill="url(#wallBg)"/>
  
  <!-- Sister (Right) -->
  <!-- Shoulders & dress -->
  <path d="M190 400 L210 270 C220 240 260 230 310 240 C350 250 370 280 390 400 Z" fill="url(#sisterKurti)"/>
  <!-- Blue jeans / lap -->
  <path d="M240 330 C260 300 320 300 360 330 L380 400 L220 400 Z" fill="#2563eb" opacity="0.9"/>
  <!-- Neck -->
  <rect x="270" y="200" width="40" height="50" rx="8" fill="url(#skin1)"/>
  <!-- Head -->
  <ellipse cx="290" cy="160" rx="42" ry="52" fill="url(#skin1)"/>
  <!-- Long dark hair -->
  <path d="M235 150 C235 90 270 70 305 70 C345 70 355 100 355 180 C345 250 325 280 325 320 L245 270 C240 220 235 190 235 150 Z" fill="#18181b"/>
  <!-- Smile & face -->
  <ellipse cx="275" cy="155" rx="4.5" ry="3" fill="#18181b"/>
  <ellipse cx="308" cy="155" rx="4.5" ry="3" fill="#18181b"/>
  <path d="M280 180 Q292 195 304 180" stroke="#b91c1c" stroke-width="3" fill="none" stroke-linecap="round"/>
  
  <!-- Boy (Left) leaning on sister's shoulder -->
  <!-- Blue T-shirt -->
  <path d="M30 400 L50 280 C60 250 100 240 160 250 C190 260 210 290 220 400 Z" fill="url(#boyShirt)"/>
  <!-- Neck -->
  <rect x="110" y="210" width="36" height="45" rx="6" fill="url(#skin1)"/>
  <!-- Head tilted -->
  <g transform="rotate(12, 130, 170)">
    <ellipse cx="130" cy="170" rx="38" ry="46" fill="url(#skin1)"/>
    <!-- Short boy hair -->
    <path d="M88 160 C88 115 110 100 135 100 C160 100 172 120 172 160 C160 135 140 125 130 125 C115 125 98 135 88 160 Z" fill="#18181b"/>
    <!-- Big joyful smile -->
    <ellipse cx="118" cy="165" rx="4" ry="2.8" fill="#18181b"/>
    <ellipse cx="145" cy="165" rx="4" ry="2.8" fill="#18181b"/>
    <path d="M120 190 Q132 208 146 190" stroke="#b91c1c" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  </g>
  
  <!-- Smartphone in sister's hands -->
  <rect x="275" y="260" width="46" height="78" rx="8" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
  <rect x="280" y="266" width="36" height="62" rx="4" fill="#3b82f6" opacity="0.3"/>
  <circle cx="298" cy="272" r="3" fill="#64748b"/>
  <!-- Hands holding phone -->
  <ellipse cx="272" cy="295" rx="14" ry="10" fill="url(#skin1)"/>
  <ellipse cx="324" cy="295" rx="14" ry="10" fill="url(#skin1)"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, "kids-phone.svg"), kidsPhoneSvg);
console.log("Successfully generated kids-phone.svg in public/!");
