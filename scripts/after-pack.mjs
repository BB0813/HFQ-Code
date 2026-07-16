/**
 * electron-builder afterPack for Windows:
 *   1) resedit stamp icon (existing)
 *   2) Authenticode sign main exe (must be AFTER resedit — re-signing would break if order reversed)
 *
 * Wired as: "afterPack": "../../scripts/after-pack.mjs"
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function afterPack(context) {
  // 1) Icon stamp (always try on win32)
  const stampMod = await import(pathToFileURL(path.join(__dirname, "stamp-win-icon.mjs")).href);
  const stamp = stampMod.default;
  if (typeof stamp === "function") {
    await stamp(context);
  }

  if (context.electronPlatformName !== "win32") return;

  // 2) Sign unpacked main exe (after icon mutation)
  const { signUnpackedMainExe } = await import(
    pathToFileURL(path.join(__dirname, "windows-sign.mjs")).href
  );
  const productName =
    context.packager?.appInfo?.productFilename ||
    context.packager?.appInfo?.productName ||
    "HFQ Code";
  console.log("[after-pack] signing main exe in", context.appOutDir);
  signUnpackedMainExe(context.appOutDir, productName);
  console.log("[after-pack] sign complete");
}
