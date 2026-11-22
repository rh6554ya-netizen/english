import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.resolve(__dirname, '../client/public/icons');
fs.mkdirSync(ICONS_DIR, { recursive: true });

// CRC32 table for PNG encoding
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Signed distance to a rounded box centered at (cx, cy) with half-size (bx, by) and corner radius r
function sdRoundedBox(px, py, cx, cy, bx, by, r) {
  const dx = Math.abs(px - cx) - bx + r;
  const dy = Math.abs(py - cy) - by + r;
  const out = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  return out + inside - r;
}

// Signed distance to an arc centered at (cx, cy), radius R, half-thickness w, angle range [-ang, +ang]
function sdArc(px, py, cx, cy, R, w, maxAngle) {
  const dx = px - cx;
  const dy = py - cy;
  const ang = Math.atan2(dy, dx);
  const clampedAng = clamp(ang, -maxAngle, maxAngle);
  const ax = cx + Math.cos(clampedAng) * R;
  const ay = cy + Math.sin(clampedAng) * R;
  return Math.hypot(px - ax, py - ay) - w;
}

function renderIcon(size, { maskable = false, opaque = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const scale = maskable ? 0.72 : 0.88; // keep logo safely inside maskable safe zone
  const aa = 1.6 / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Normalized [0, 1]
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;

      // Background rounded square (or full bleed if maskable/opaque)
      let bgAlpha = 1;
      if (!maskable && !opaque) {
        const dBg = sdRoundedBox(u, v, 0.5, 0.5, 0.48, 0.48, 0.21);
        bgAlpha = 1 - smoothstep(-aa, aa, dBg);
      }

      if (bgAlpha <= 0.001) {
        continue;
      }

      // Indigo (#4f46e5) -> Violet (#7c3aed) diagonal gradient with subtle highlight
      const gradT = clamp(u * 0.55 + v * 0.55 - 0.05, 0, 1);
      let r = 79 + (124 - 79) * gradT;
      let g = 70 + (58 - 70) * gradT;
      let b = 229 + (237 - 229) * gradT;

      // Soft top-left radial glow
      const glow = Math.exp(-((u - 0.24) ** 2 + (v - 0.2) ** 2) * 5.5) * 28;
      r = clamp(r + glow, 0, 255);
      g = clamp(g + glow, 0, 255);
      b = clamp(b + glow * 0.9, 0, 255);

      // Transform into icon artwork coordinates centered at (0.5, 0.5)
      const lx = (u - 0.5) / scale + 0.5;
      const ly = (v - 0.5) / scale + 0.5;

      // Bold modern "E" glyph on left-center (built from 4 rounded bars)
      const eLeft = 0.23;
      const eBarW = 0.052;
      const eR = 0.024;
      const dStem = sdRoundedBox(lx, ly, eLeft + eBarW, 0.5, eBarW, 0.26, eR);
      const dTop = sdRoundedBox(lx, ly, eLeft + 0.17, 0.292, 0.17, 0.052, eR);
      const dMid = sdRoundedBox(lx, ly, eLeft + 0.145, 0.5, 0.145, 0.048, eR);
      const dBot = sdRoundedBox(lx, ly, eLeft + 0.17, 0.708, 0.17, 0.052, eR);
      const dLetterE = Math.min(dStem, dTop, dMid, dBot);

      // Two echo sound-wave arcs to the right of "E"
      const waveCx = 0.56;
      const waveCy = 0.5;
      const dWave1 = sdArc(lx, ly, waveCx, waveCy, 0.125, 0.028, 0.72);
      const dWave2 = sdArc(lx, ly, waveCx, waveCy, 0.225, 0.028, 0.78);

      const alphaE = 1 - smoothstep(-aa / scale, aa / scale, dLetterE);
      const alphaW1 = (1 - smoothstep(-aa / scale, aa / scale, dWave1)) * 0.95;
      const alphaW2 = (1 - smoothstep(-aa / scale, aa / scale, dWave2)) * 0.72;

      // Composite white "E" and bright cyan-tinted echo waves
      const fgR = 255;
      const fgG = 255;
      const fgB = 255;

      // Wave 2 (soft sky-cyan #a5f3fc)
      r = r * (1 - alphaW2) + 165 * alphaW2;
      g = g * (1 - alphaW2) + 243 * alphaW2;
      b = b * (1 - alphaW2) + 252 * alphaW2;

      // Wave 1 (crisp white-indigo #e0e7ff)
      r = r * (1 - alphaW1) + 238 * alphaW1;
      g = g * (1 - alphaW1) + 242 * alphaW1;
      b = b * (1 - alphaW1) + 255 * alphaW1;

      // Letter E (pure white)
      r = r * (1 - alphaE) + fgR * alphaE;
      g = g * (1 - alphaE) + fgG * alphaE;
      b = b * (1 - alphaE) + fgB * alphaE;

      const idx = (y * size + x) * 4;
      buf[idx] = Math.round(r);
      buf[idx + 1] = Math.round(g);
      buf[idx + 2] = Math.round(b);
      buf[idx + 3] = Math.round(bgAlpha * 255);
    }
  }

  return encodePng(size, size, buf);
}

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#7c3aed" />
    </linearGradient>
  </defs>
  <rect x="16" y="16" width="480" height="480" rx="110" fill="url(#bg)" />
  <g fill="#ffffff">
    <rect x="128" y="132" width="52" height="248" rx="14" />
    <rect x="128" y="132" width="166" height="50" rx="14" />
    <rect x="128" y="232" width="144" height="48" rx="14" />
    <rect x="128" y="330" width="166" height="50" rx="14" />
  </g>
  <path d="M326 206 A74 74 0 0 1 326 306" fill="none" stroke="#eef2ff" stroke-width="26" stroke-linecap="round" />
  <path d="M368 164 A130 130 0 0 1 368 348" fill="none" stroke="#a5f3fc" stroke-width="26" stroke-linecap="round" opacity="0.85" />
</svg>
`;

fs.writeFileSync(path.join(ICONS_DIR, 'favicon.svg'), faviconSvg, 'utf8');
fs.writeFileSync(path.join(ICONS_DIR, 'apple-touch-icon.png'), renderIcon(180, { opaque: true }));
fs.writeFileSync(path.join(ICONS_DIR, 'icon-192.png'), renderIcon(192));
fs.writeFileSync(path.join(ICONS_DIR, 'icon-512.png'), renderIcon(512));
fs.writeFileSync(path.join(ICONS_DIR, 'icon-maskable-512.png'), renderIcon(512, { maskable: true }));

console.log('✅ Generated PWA icons in client/public/icons/');
