/**
 * Stamp HFQ Code.exe with apps/desktop/build/icon.ico after electron-builder pack.
 *
 * Why: win.signAndEditExecutable=false skips electron-builder's rcedit/winCodeSign
 * path (avoids symlink privilege failures), so the main .exe keeps Electron's
 * default icon unless we inject ours ourselves.
 *
 * Used as electron-builder afterPack hook and can be run standalone:
 *   node scripts/stamp-win-icon.mjs [path/to/HFQ Code.exe]
 */

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const desktop = path.join(root, "apps", "desktop");
const defaultIco = path.join(desktop, "build", "icon.ico");

async function resolveResedit() {
  try {
    return await import("resedit");
  } catch {
    /* fall through */
  }
  const pnpm = path.join(root, "node_modules", ".pnpm");
  const entries = await fs.readdir(pnpm);
  const hit = entries.find((e) => e.startsWith("resedit@"));
  if (!hit) throw new Error("resedit not found under node_modules/.pnpm");
  const idx = path.join(pnpm, hit, "node_modules", "resedit", "dist", "index.mjs");
  return import(pathToFileURL(idx).href);
}

/**
 * @param {string} exePath
 * @param {string} icoPath
 */
export async function stampExeIcon(exePath, icoPath = defaultIco) {
  const ResEdit = await resolveResedit();
  const { NtExecutable, NtExecutableResource, Data, Resource } = ResEdit;
  if (!NtExecutable || !NtExecutableResource || !Data?.IconFile || !Resource?.IconGroupEntry) {
    throw new Error("resedit API incomplete");
  }

  const exeBuf = await fs.readFile(exePath);
  const icoBuf = await fs.readFile(icoPath);

  const exe = NtExecutable.from(exeBuf, {
    ignoreCert: true,
  });
  const res = NtExecutableResource.from(exe);
  const iconFile = Data.IconFile.from(icoBuf);
  const icons = iconFile.icons.map((item) => item.data);

  // Discover existing icon group ids/langs so we replace Electron's default cleanly.
  const existing = Resource.IconGroupEntry.fromEntries(res.entries);
  const targets =
    existing.length > 0
      ? existing.map((e) => ({ id: e.id, lang: e.lang }))
      : [
          { id: 1, lang: 1033 },
          { id: 1, lang: 0 },
        ];

  const seen = new Set();
  for (const t of targets) {
    const key = `${t.id}:${t.lang}`;
    if (seen.has(key)) continue;
    seen.add(key);
    Resource.IconGroupEntry.replaceIconsForResource(res.entries, t.id, t.lang, icons);
  }
  // Ensure en-US group id 1 exists even if Electron used another id.
  if (![...seen].some((k) => k.startsWith("1:"))) {
    Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, icons);
  }

  res.outputResource(exe);
  const out = Buffer.from(exe.generate());
  await fs.writeFile(exePath, out);
  return { exePath, icoPath, bytes: out.length, groups: [...seen] };
}

/** electron-builder afterPack(context) */
export default async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  const productName = context.packager.appInfo.productFilename || "HFQ Code";
  const exePath = path.join(context.appOutDir, `${productName}.exe`);
  const icoCandidates = [
    path.join(context.packager.projectDir, "build", "icon.ico"),
    defaultIco,
  ];
  let icoPath = null;
  for (const p of icoCandidates) {
    try {
      await fs.access(p);
      icoPath = p;
      break;
    } catch {
      /* next */
    }
  }
  if (!icoPath) {
    console.warn("[stamp-win-icon] icon.ico not found — skip");
    return;
  }
  try {
    await fs.access(exePath);
  } catch {
    console.warn("[stamp-win-icon] exe not found:", exePath);
    return;
  }
  const result = await stampExeIcon(exePath, icoPath);
  console.log(
    "[stamp-win-icon] stamped",
    result.exePath,
    "with",
    result.icoPath,
    "groups=",
    result.groups.join(","),
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (isMain) {
  const exeArg = process.argv[2];
  const icoArg = process.argv[3];
  if (!exeArg) {
    console.error("Usage: node scripts/stamp-win-icon.mjs <path-to-exe> [icon.ico]");
    process.exit(2);
  }
  stampExeIcon(path.resolve(exeArg), icoArg ? path.resolve(icoArg) : defaultIco)
    .then((r) => console.log("OK", r))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
