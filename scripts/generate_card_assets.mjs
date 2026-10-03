// Script to generate high quality visual SVG assets for the Home screen cards
import fs from "node:fs";
import path from "node:path";

const publicDir = path.resolve(process.cwd(), "public");

// 1. Similar Photos (Man by swimming pool in sunny day)
const personPoolSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="60%" stop-color="#bae6fd"/>
      <stop offset="100%" stop-color="#e0f2fe"/>
    </linearGradient>
    <linearGradient id="poolGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="50%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <linearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d97706"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
    <linearGradient id="vestGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <!-- Pool background -->
  <rect width="400" height="400" fill="url(#poolGrad)"/>
  <!-- Pool water ripples -->
  <path d="M0 160 Q100 140 200 160 T400 160 L400 400 L0 400 Z" fill="#0369a1" opacity="0.4"/>
  <path d="M0 240 Q100 220 200 240 T400 240 L400 400 L0 400 Z" fill="#075985" opacity="0.4"/>
  <!-- Pool edge / deck -->
  <rect x="0" y="80" width="400" height="60" fill="#fef08a" opacity="0.8"/>
  <rect x="0" y="0" width="400" height="80" fill="url(#skyGrad)"/>
  
  <!-- Person silhouette / portrait -->
  <!-- Neck & shoulders -->
  <path d="M120 400 L120 320 C120 290 150 270 200 270 C250 270 280 290 280 320 L280 400 Z" fill="url(#vestGrad)"/>
  <!-- Tank top white trim -->
  <path d="M150 320 C150 300 170 290 200 290 C230 290 250 300 250 320 L240 400 L160 400 Z" fill="#e2e8f0"/>
  <path d="M165 330 C165 315 180 305 200 305 C220 305 235 315 235 330 L230 400 L170 400 Z" fill="url(#vestGrad)"/>
  
  <!-- Neck -->
  <rect x="175" y="220" width="50" height="60" rx="8" fill="url(#skinGrad)"/>
  <!-- Head -->
  <ellipse cx="200" cy="180" rx="42" ry="52" fill="url(#skinGrad)"/>
  <!-- Hair -->
  <path d="M155 170 C155 130 180 120 200 120 C220 120 245 130 245 170 C235 150 215 140 200 140 C185 140 165 150 155 170 Z" fill="#18181b"/>
  <!-- Beard & Mustache -->
  <path d="M165 195 C165 228 185 240 200 240 C215 240 235 228 235 195 C225 210 215 215 200 215 C185 215 175 210 165 195 Z" fill="#18181b"/>
  <path d="M185 198 Q200 194 215 198 Q200 204 185 198 Z" fill="#18181b"/>
  <!-- Eyes & eyebrows -->
  <ellipse cx="185" cy="175" rx="4" ry="2.5" fill="#18181b"/>
  <ellipse cx="215" cy="175" rx="4" ry="2.5" fill="#18181b"/>
  <path d="M178 168 Q185 165 192 168" stroke="#18181b" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  <path d="M208 168 Q215 165 222 168" stroke="#18181b" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  <!-- Sunlight reflection -->
  <ellipse cx="320" cy="60" rx="35" ry="35" fill="#ffffff" opacity="0.6"/>
</svg>`;

// 2. Video 1: Woman at shrine / temple
const compressionWomanSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="300" height="400">
  <defs>
    <linearGradient id="templeSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#fdba74"/>
      <stop offset="100%" stop-color="#cbd5e1"/>
    </linearGradient>
    <linearGradient id="sariGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#a3e635"/>
      <stop offset="60%" stop-color="#65a30d"/>
      <stop offset="100%" stop-color="#4d7c0f"/>
    </linearGradient>
  </defs>
  <rect width="300" height="400" fill="url(#templeSky)"/>
  <!-- Temple background pagoda roof -->
  <polygon points="150,40 50,110 250,110" fill="#b45309"/>
  <polygon points="150,90 80,140 220,140" fill="#78350f"/>
  <rect x="100" y="140" width="100" height="100" fill="#f8fafc" opacity="0.9"/>
  <circle cx="150" cy="80" r="14" fill="#fbbf24"/>
  <!-- Courtyard bells / lamps -->
  <rect x="40" y="160" width="10" height="120" fill="#334155"/>
  <circle cx="45" cy="200" r="10" fill="#d97706"/>
  <!-- Woman figure -->
  <path d="M80 400 L95 260 C100 230 130 220 150 220 C170 220 200 230 205 260 L220 400 Z" fill="url(#sariGrad)"/>
  <!-- Sari pallu drape -->
  <path d="M100 250 Q140 280 180 340 L195 400 L120 400 Z" fill="#d9f99d" opacity="0.8"/>
  <!-- Head & Hair -->
  <ellipse cx="150" cy="180" rx="26" ry="32" fill="#d97706"/>
  <ellipse cx="150" cy="165" rx="30" ry="28" fill="#171717"/>
  <path d="M125 170 Q150 140 175 170 Q165 195 150 195 Q135 195 125 170 Z" fill="#171717"/>
</svg>`;

// 3. Video 2: Eco recycle arrows with Flicro mark
const compressionEcoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="300" height="400">
  <defs>
    <linearGradient id="ecoBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="60%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#cbd5e1"/>
    </linearGradient>
    <linearGradient id="greenArrow1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#84cc16"/>
      <stop offset="100%" stop-color="#22c55e"/>
    </linearGradient>
    <linearGradient id="greenArrow2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#16a34a"/>
      <stop offset="100%" stop-color="#15803d"/>
    </linearGradient>
  </defs>
  <rect width="300" height="400" fill="url(#ecoBg)"/>
  
  <!-- Circular Eco Recycle Arrows -->
  <g transform="translate(150, 160)">
    <!-- Top curved arrow -->
    <path d="M -70,-20 A 80 80 0 0 1 65,-25" fill="none" stroke="url(#greenArrow1)" stroke-width="26" stroke-linecap="round"/>
    <polygon points="75,-42 92,-15 62,-10" fill="url(#greenArrow1)"/>
    
    <!-- Bottom curved arrow -->
    <path d="M 70,20 A 80 80 0 0 1 -65,25" fill="none" stroke="url(#greenArrow2)" stroke-width="26" stroke-linecap="round"/>
    <polygon points="-75,42 -92,15 -62,10" fill="url(#greenArrow2)"/>
    
    <!-- Central leaf symbol -->
    <path d="M -15,-10 C -15,-40 25,-45 35,-15 C 35,15 -5,20 -15,-10 Z" fill="#4ade80" opacity="0.9"/>
  </g>
  
  <!-- Flicro Text at bottom matching Screenshot 1 -->
  <text x="150" y="320" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="900" text-anchor="middle" fill="#1e3a1f" letter-spacing="-0.5">Flicro</text>
  <text x="150" y="342" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" text-anchor="middle" fill="#15803d">VIDEO COMPRESSOR</text>
</svg>`;

// 4. Video 3: Interior / Room Surface
const compressionSurfaceSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="300" height="400">
  <defs>
    <linearGradient id="surfBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="50%" stop-color="#475569"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="glassReflection" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#94a3b8" stop-opacity="0.2"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#94a3b8" stop-opacity="0.1"/>
    </linearGradient>
  </defs>
  <rect width="300" height="400" fill="url(#surfBg)"/>
  <!-- Tiles and glass surface perspective -->
  <polygon points="0,150 300,100 300,400 0,400" fill="#1e293b"/>
  <line x1="0" y1="220" x2="300" y2="170" stroke="#64748b" stroke-width="2"/>
  <line x1="0" y1="310" x2="300" y2="260" stroke="#64748b" stroke-width="2"/>
  <line x1="120" y1="130" x2="80" y2="400" stroke="#64748b" stroke-width="2"/>
  <line x1="220" y1="115" x2="200" y2="400" stroke="#64748b" stroke-width="2"/>
  <!-- Glass sheen diagonal reflection -->
  <polygon points="50,140 110,130 250,400 190,400" fill="url(#glassReflection)"/>
  <!-- Ambient lighting dots -->
  <circle cx="240" cy="80" r="25" fill="#f8fafc" opacity="0.3"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, "person-pool.svg"), personPoolSvg);
fs.writeFileSync(path.join(publicDir, "compression-woman.svg"), compressionWomanSvg);
fs.writeFileSync(path.join(publicDir, "compression-eco.svg"), compressionEcoSvg);
fs.writeFileSync(path.join(publicDir, "compression-surface.svg"), compressionSurfaceSvg);

console.log("Successfully generated all home screen visual cards in public/!");
