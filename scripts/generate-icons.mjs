/**
 * Regenerate desktop icons from brand/hfq-code-logo.png.
 *
 * 1) Resize master PNG via PowerShell System.Drawing
 * 2) Build multi-size .ico (PNG-compressed entries) in pure Node
 * 3) Write build/icon.ico, build/icon.png, renderer/assets/logo-256.png
 *
 * Usage: node scripts/generate-icons.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const brand = path.join(root, "brand", "hfq-code-logo.png");
const buildDir = path.join(root, "apps", "desktop", "build");
const assetsDir = path.join(root, "apps", "desktop", "renderer", "assets");
const workDir = path.join(buildDir, ".icon-gen");

/** Sizes embedded into the .ico (Windows shell picks the closest). */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const EXTRA = [512];

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}`));
    });
  });
}

async function resizeWithPowerShell(src, dest, size) {
  const ps = `
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile('${src.replaceAll("'", "''")}')
$bmp = New-Object System.Drawing.Bitmap ${size}, ${size}
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)
$g.DrawImage($src, 0, 0, ${size}, ${size})
$bmp.Save('${dest.replaceAll("'", "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $src.Dispose()
`;
  await run("powershell.exe", ["-NoProfile", "-Command", ps]);
}

/**
 * Build a multi-size ICO from PNG buffers (Vista+ PNG-compressed entries).
 * @param {Array<{ size: number, png: Buffer }>} images
 */
function buildIco(images) {
  const count = images.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries = [];
  const payloads = [];
  for (const img of images) {
    const png = img.png;
    const w = img.size >= 256 ? 0 : img.size;
    const h = img.size >= 256 ? 0 : img.size;
    const entry = Buffer.alloc(16);
    entry.writeUInt8(w, 0);
    entry.writeUInt8(h, 1);
    entry.writeUInt8(0, 2); // colors
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bit count
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    payloads.push(png);
    offset += png.length;
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type icon
  header.writeUInt16LE(count, 4);
  return Buffer.concat([header, ...entries, ...payloads]);
}

async function main() {
  await fs.access(brand);
  await fs.mkdir(buildDir, { recursive: true });
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.rm(workDir, { recursive: true, force: true });
  await fs.mkdir(workDir, { recursive: true });

  console.log("source:", brand);
  const allSizes = [...new Set([...ICO_SIZES, ...EXTRA])].sort((a, b) => a - b);
  /** @type {Map<number, Buffer>} */
  const pngs = new Map();
  for (const size of allSizes) {
    const out = path.join(workDir, `icon_${size}x${size}.png`);
    await resizeWithPowerShell(brand, out, size);
    pngs.set(size, await fs.readFile(out));
    console.log("resized", size, pngs.get(size).length, "bytes");
  }

  await fs.writeFile(path.join(buildDir, "icon.png"), pngs.get(512));
  await fs.writeFile(path.join(assetsDir, "logo-256.png"), pngs.get(256));
  console.log("wrote", path.join(buildDir, "icon.png"));
  console.log("wrote", path.join(assetsDir, "logo-256.png"));

  const icoImages = ICO_SIZES.map((size) => ({ size, png: pngs.get(size) }));
  const icoBuf = buildIco(icoImages);
  await fs.writeFile(path.join(buildDir, "icon.ico"), icoBuf);
  console.log("wrote", path.join(buildDir, "icon.ico"), icoBuf.length, "bytes", ICO_SIZES.join("/"));

  await fs.rm(workDir, { recursive: true, force: true });
  console.log("icons refreshed from brand/hfq-code-logo.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
