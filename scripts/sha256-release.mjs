/**
 * Write SHA256 checksums for release artifacts under apps/desktop/release.
 *
 * Usage: node scripts/sha256-release.mjs
 * Output: apps/desktop/release/SHA256SUMS.txt  (GNU coreutils style: "<hash>  <filename>")
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const releaseDir = path.resolve(__dirname, "..", "apps", "desktop", "release");

async function sha256File(filePath) {
  const buf = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function main() {
  const entries = await fs.readdir(releaseDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => {
      const lower = name.toLowerCase();
      return (
        lower.endsWith(".exe") ||
        lower.endsWith(".blockmap") ||
        lower.endsWith(".zip") ||
        lower.endsWith(".7z")
      );
    })
    .filter((name) => name.toUpperCase() !== "SHA256SUMS.TXT")
    .sort((a, b) => a.localeCompare(b));

  if (!files.length) {
    throw new Error(`no release artifacts in ${releaseDir}`);
  }

  const lines = [];
  for (const name of files) {
    const full = path.join(releaseDir, name);
    const hash = await sha256File(full);
    // Two spaces — compatible with `sha256sum -c`
    lines.push(`${hash}  ${name}`);
    console.log(hash, name);
  }

  const out = path.join(releaseDir, "SHA256SUMS.txt");
  await fs.writeFile(out, lines.join("\n") + "\n", "utf8");
  console.log("wrote", out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
