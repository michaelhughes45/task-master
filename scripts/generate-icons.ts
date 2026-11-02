import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// The logo mark from src/components/layout/Logo.tsx, with the light theme's colors
// (--primary and --brand-check in globals.css). Run with `npm run icons`.
const PRIMARY = "#1d5bd6";
const CHECK = "#7fe0aa";
const OUT_DIR = path.join(process.cwd(), "public", "icons");

interface IconSpec {
  file: string;
  size: number;
  // Rounded corners on a transparent canvas, or a full square the platform masks itself
  rounded: boolean;
  // Share of the icon the 26-unit mark spans; below 1 shrinks the check into a safe zone
  scale: number;
}

const ICONS: IconSpec[] = [
  { file: "icon-192.png", size: 192, rounded: true, scale: 1 },
  { file: "icon-512.png", size: 512, rounded: true, scale: 1 },
  // Maskable icons can be cropped to a circle of 80% of the size, so the check stays well inside it
  { file: "icon-maskable-512.png", size: 512, rounded: false, scale: 0.7 },
  // iOS rounds the corners itself and fills transparency with black
  { file: "apple-touch-icon.png", size: 180, rounded: false, scale: 0.9 },
];

function markSvg({ rounded, scale }: IconSpec) {
  const offset = (26 - 26 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26">
  <rect width="26" height="26" rx="${rounded ? 6 : 0}" fill="${PRIMARY}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M7 13.5l4 4L19.5 9" fill="none" stroke="${CHECK}" stroke-width="2.6"
      stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const icon of ICONS) {
    await sharp(Buffer.from(markSvg(icon)), { density: (72 * icon.size) / 26 })
      .resize(icon.size, icon.size)
      .png()
      .toFile(path.join(OUT_DIR, icon.file));
    console.log(`public/icons/${icon.file}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
