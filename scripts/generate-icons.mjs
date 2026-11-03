// Builds every favicon and app icon from the Deuce shuttle mark.
// Run with `npm run icons` after changing public/branding/deuce-icon-logo.png.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(root, "public/branding/deuce-icon-logo.png");
// Warm off-white from the Deuce mobile logo, so the navy mark reads on light and dark browser tabs.
const BACKGROUND = "#efeeea";

/**
 * Draws the mark centred on a background.
 * `markScale` is the mark's height as a share of the icon; `radius` rounds the corners (0 = square).
 */
const renderIcon = async ({ size, markScale, radius = 0 }) => {
  const mark = await sharp(SOURCE)
    .trim()
    .resize({ height: Math.round(size * markScale), width: Math.round(size * markScale), fit: "inside" })
    .toBuffer();
  const { width, height } = await sharp(mark).metadata();

  const background = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" rx="${radius}" fill="${BACKGROUND}"/></svg>`,
  );

  return sharp(background)
    .composite([{ input: mark, left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) }])
    .png({ compressionLevel: 9 })
    .toBuffer();
};

/** Packs PNG images into a single .ico (PNG-compressed entries, supported by all current browsers). */
const toIco = (images) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 means 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette colours
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
};

const outputs = [
  // Browser tab icons: rounded so they look like an app icon next to other tabs.
  { file: "public/icons/favicon-32.png", size: 32, markScale: 0.8, radius: 7 },
  // Home screen and install icons. Platforms apply their own corner rounding, so these are square.
  { file: "public/icons/icon-192.png", size: 192, markScale: 0.72 },
  { file: "public/icons/icon-512.png", size: 512, markScale: 0.72 },
  // Maskable icons keep the mark inside the central safe zone, so Android can crop to any shape.
  { file: "public/icons/icon-maskable-192.png", size: 192, markScale: 0.56 },
  { file: "public/icons/icon-maskable-512.png", size: 512, markScale: 0.56 },
  // iOS home screen icon.
  { file: "public/apple-icon.png", size: 180, markScale: 0.7 },
];

await mkdir(path.join(root, "public/icons"), { recursive: true });

for (const output of outputs) {
  await writeFile(path.join(root, output.file), await renderIcon(output));
  console.log(`wrote ${output.file}`);
}

const icoSizes = [16, 32, 48];
const icoImages = await Promise.all(
  icoSizes.map(async (size) => ({
    size,
    data: await renderIcon({ size, markScale: 0.8, radius: Math.round(size * 0.22) }),
  })),
);
await writeFile(path.join(root, "src/app/favicon.ico"), toIco(icoImages));
console.log(`wrote src/app/favicon.ico (${icoSizes.join(", ")}px)`);
