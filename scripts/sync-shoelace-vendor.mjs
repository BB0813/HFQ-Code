/**
 * Copy @shoelace-style/shoelace + bare ESM deps into apps/desktop/renderer/vendor
 * so Electron can load components offline under CSP (file://, no CDN).
 *
 * Usage: node scripts/sync-shoelace-vendor.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktop = path.join(root, "apps/desktop");
const src = path.join(desktop, "node_modules/@shoelace-style/shoelace");
const dest = path.join(desktop, "renderer/vendor/shoelace");
const depsDest = path.join(desktop, "renderer/vendor/esm");
const require = createRequire(path.join(desktop, "package.json"));

if (!fs.existsSync(path.join(src, "dist"))) {
  console.error("Missing", src, "— run: pnpm --filter @hfq/desktop add @shoelace-style/shoelace@2.20.1");
  process.exit(1);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    if (ent.name === "node_modules") continue;
    const a = path.join(from, ent.name);
    const b = path.join(to, ent.name);
    if (ent.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

function packageRoot(name) {
  const requireFromShoelace = createRequire(path.join(src, "package.json"));
  try {
    return path.dirname(requireFromShoelace.resolve(name + "/package.json"));
  } catch {
    try {
      return path.dirname(createRequire(path.join(root, "package.json")).resolve(name + "/package.json"));
    } catch {
      const pnpm = path.join(root, "node_modules/.pnpm");
      if (!fs.existsSync(pnpm)) return null;
      const escaped = name.startsWith("@") ? name.replace("/", "+") : name;
      for (const d of fs.readdirSync(pnpm)) {
        if (!d.startsWith(escaped + "@")) continue;
        const candidate = path.join(pnpm, d, "node_modules", ...name.split("/"));
        if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
      }
      return null;
    }
  }
}

function copyPackage(name) {
  const from = packageRoot(name);
  if (!from) {
    console.warn("skip missing package", name);
    return null;
  }
  const to = path.join(depsDest, name);
  if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
  copyDir(from, to);
  console.log("  +", name);
  return to;
}

function resolveEntry(pkgName, candidateRel) {
  const stripped = candidateRel.startsWith("./") ? candidateRel.slice(2) : candidateRel;
  const abs = path.join(desktop, "renderer", stripped);
  if (fs.existsSync(abs)) return candidateRel;
  const rootDir = path.join(depsDest, pkgName);
  const pkgPath = path.join(rootDir, "package.json");
  if (!fs.existsSync(pkgPath)) return candidateRel;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const tryPaths = [];
  if (typeof pkg.module === "string") tryPaths.push(pkg.module);
  if (typeof pkg.main === "string") tryPaths.push(pkg.main);
  if (pkg.exports) {
    const exp = pkg.exports["."] || pkg.exports;
    if (typeof exp === "string") tryPaths.push(exp);
    else if (exp && typeof exp === "object") {
      for (const k of ["import", "default", "module", "browser"]) {
        const v = exp[k];
        if (typeof v === "string") tryPaths.push(v);
        else if (v && typeof v.import === "string") tryPaths.push(v.import);
      }
    }
  }
  for (const rel of tryPaths) {
    const full = path.join(rootDir, rel);
    if (fs.existsSync(full)) {
      return "./vendor/esm/" + pkgName + "/" + String(rel).split(path.sep).join("/");
    }
  }
  for (const name of ["index.js", "dist/index.js", "lit-html.js", "reactive-element.js"]) {
    if (fs.existsSync(path.join(rootDir, name))) {
      return "./vendor/esm/" + pkgName + "/" + name;
    }
  }
  return candidateRel;
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
copyDir(path.join(src, "dist"), path.join(dest, "dist"));
for (const f of ["package.json", "LICENSE.md", "README.md"]) {
  const p = path.join(src, f);
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(dest, f));
}
console.log("Synced Shoelace ->", path.relative(root, dest));

fs.rmSync(depsDest, { recursive: true, force: true });
fs.mkdirSync(depsDest, { recursive: true });
console.log("Vendoring ESM deps...");
for (const name of [
  "lit",
  "lit-html",
  "lit-element",
  "@lit/reactive-element",
  "@ctrl/tinycolor",
  "@floating-ui/dom",
  "@floating-ui/core",
  "@floating-ui/utils",
  "@shoelace-style/localize",
  "@shoelace-style/animations",
  "composed-offset-position",
  "qr-creator",
]) {
  copyPackage(name);
}

const importMap = {
  imports: {
    lit: "./vendor/esm/lit/index.js",
    "lit/": "./vendor/esm/lit/",
    "lit-html": "./vendor/esm/lit-html/lit-html.js",
    "lit-html/": "./vendor/esm/lit-html/",
    "lit-element": "./vendor/esm/lit-element/index.js",
    "lit-element/": "./vendor/esm/lit-element/",
    "@lit/reactive-element": "./vendor/esm/@lit/reactive-element/reactive-element.js",
    "@lit/reactive-element/": "./vendor/esm/@lit/reactive-element/",
    "@ctrl/tinycolor": "./vendor/esm/@ctrl/tinycolor/dist/module/public_api.js",
    "@floating-ui/dom": "./vendor/esm/@floating-ui/dom/dist/floating-ui.dom.esm.js",
    "@floating-ui/core": "./vendor/esm/@floating-ui/core/dist/floating-ui.core.esm.js",
    "@floating-ui/utils": "./vendor/esm/@floating-ui/utils/dist/floating-ui.utils.esm.js",
    "@floating-ui/utils/dom": "./vendor/esm/@floating-ui/utils/dist/floating-ui.utils.dom.esm.js",
    "@shoelace-style/localize": "./vendor/esm/@shoelace-style/localize/dist/index.js",
    "@shoelace-style/animations": "./vendor/esm/@shoelace-style/animations/dist/index.js",
    "composed-offset-position": "./vendor/esm/composed-offset-position/dist/composed-offset-position.esm.js",
    "qr-creator": "./vendor/esm/qr-creator/dist/qr-creator.es6.min.js",
  },
};

for (const [key, val] of Object.entries(importMap.imports)) {
  if (key.endsWith("/")) continue;
  const pkg = key.startsWith("@") ? key.split("/").slice(0, 2).join("/") : key.split("/")[0];
  importMap.imports[key] = resolveEntry(pkg, val);
  const stripped = importMap.imports[key].startsWith("./") ? importMap.imports[key].slice(2) : importMap.imports[key];
  const abs = path.join(desktop, "renderer", stripped);
  console.log("map", key, "->", importMap.imports[key], fs.existsSync(abs) ? "OK" : "MISSING");
}

const mapPath = path.join(desktop, "renderer/vendor/importmap.json");
fs.writeFileSync(mapPath, JSON.stringify(importMap, null, 2));
console.log("Wrote", path.relative(root, mapPath));

const htmlPath = path.join(desktop, "renderer/index.html");
let html = fs.readFileSync(htmlPath, "utf8");
const mapScript = '<script type="importmap">\n' + JSON.stringify(importMap, null, 2) + "\n    </script>";
const start = "<!-- SHOELACE-IMPORTMAP-START -->";
const end = "<!-- SHOELACE-IMPORTMAP-END -->";
if (html.includes(start) && html.includes(end)) {
  const re = new RegExp(start + "[\s\S]*?" + end);
  html = html.replace(re, start + "\n    " + mapScript + "\n    " + end);
  fs.writeFileSync(htmlPath, html);
  console.log("Updated import map in index.html");
} else if (!html.includes('type="importmap"')) {
  html = html.replace(
    '<link rel="stylesheet" href="./vendor/shoelace/dist/themes/dark.css" />',
    start + "\n    " + mapScript + "\n    " + end + "\n    " +
      '<link rel="stylesheet" href="./vendor/shoelace/dist/themes/dark.css" />',
  );
  fs.writeFileSync(htmlPath, html);
  console.log("Injected import map into index.html");
} else {
  console.log("index.html already has importmap; json only");
}

console.log("Done.");
