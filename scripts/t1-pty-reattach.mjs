/**
 * Electron T1 smoke (1.1.9): Terminal marker → leave → return → still visible.
 * Uses Chromium CDP (--remote-debugging-port) + Playwright connect_over_cdp.
 *
 * Exit 0 = PASS, non-zero = FAIL.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const desktop = path.join(root, "apps", "desktop");
const MARKER = "HFQ-1.1.9-REATTACH";
const PORT = Number(process.env.HFQ_T1_CDP_PORT || 9333);
const WORKSPACE =
  process.env.HFQ_T1_WORKSPACE ||
  "Z:\\HFQ-Code-test";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function findElectron() {
  const p = path.join(desktop, "node_modules", "electron", "dist", "electron.exe");
  if (fs.existsSync(p)) return p;
  throw new Error("electron.exe not found under apps/desktop/node_modules/electron/dist");
}

async function main() {
  // Ensure boot route
  for (const ud of [
    path.join(process.env.APPDATA || "", "@hfq", "desktop"),
    path.join(process.env.APPDATA || "", "HFQ-Code"),
  ]) {
    try {
      fs.mkdirSync(ud, { recursive: true });
      fs.writeFileSync(path.join(ud, "boot-route.txt"), "terminal", "utf8");
    } catch {
      /* ignore */
    }
  }

  // Kill stale
  try {
    spawn("taskkill", ["/F", "/IM", "electron.exe"], { stdio: "ignore" });
  } catch {
    /* ignore */
  }
  await sleep(1500);

  const electronBin = findElectron();
  const env = {
    ...process.env,
    ELECTRON_RENDERER_HASH: "terminal",
    ELECTRON_ENABLE_LOGGING: "1",
  };
  const child = spawn(
    electronBin,
    [
      `--remote-debugging-port=${PORT}`,
      "electron/main.cjs",
    ],
    {
      cwd: desktop,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: false,
    },
  );
  let logs = "";
  child.stdout?.on("data", (d) => {
    logs += d.toString();
  });
  child.stderr?.on("data", (d) => {
    logs += d.toString();
  });

  // Dynamic import playwright (may be Python-only; try npx playwright-core via node_modules)
  let chromium;
  try {
    const require = createRequire(path.join(root, "package.json"));
    // Prefer playwright-core if present
    let pw;
    try {
      pw = require("playwright-core");
    } catch {
      try {
        pw = require("playwright");
      } catch {
        // Use Python bridge fallback path — throw to outer
        throw new Error("node playwright not installed");
      }
    }
    chromium = pw.chromium;
  } catch (e) {
    console.error("NODE_PLAYWRIGHT_MISSING", e.message);
    // Fall back: pure CDP via fetch + WebSocket is heavy; use Python script instead
    child.kill();
    process.exit(3);
  }

  let browser;
  try {
    // Wait for CDP
    let connected = false;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      try {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
        connected = true;
        break;
      } catch {
        /* retry */
      }
    }
    if (!connected || !browser) throw new Error("CDP connect failed");

    const contexts = browser.contexts();
    const context = contexts[0] || (await browser.newContext());
    let page = context.pages()[0];
    for (let i = 0; i < 30 && !page; i++) {
      await sleep(400);
      page = context.pages()[0];
    }
    if (!page) throw new Error("no page");

    // Wait for app ready (window.hfq)
    await page.waitForFunction(() => typeof window.hfq !== "undefined", null, {
      timeout: 30_000,
    });
    await sleep(2000);

    // Bind workspace if needed
    const info = await page.evaluate(async () => {
      const h = window.hfq;
      const i = await h.getInfo();
      return i;
    });
    console.log("app info", { version: info?.version, workspacePath: info?.workspacePath });

    if (!info?.workspacePath) {
      const ws = await page.evaluate(async (wsPath) => {
        return window.hfq.setWorkspace({ workspacePath: wsPath });
      }, WORKSPACE);
      console.log("setWorkspace", ws);
      await sleep(1000);
    }

    // Navigate hash to terminal
    await page.evaluate(() => {
      location.hash = "#/terminal";
    });
    await sleep(1500);

    // Ensure we're on terminal so panel mounts xterm
    await page.evaluate(() => {
      location.hash = "#/terminal";
    });
    await sleep(1500);

    // Create via UI button if present, else IPC
    let ptyId = null;
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const b =
        btns.find((el) => (el.getAttribute("aria-label") || "") === "新建终端") ||
        btns.find((el) => (el.getAttribute("title") || "").includes("新建终端"));
      if (b) {
        b.click();
        return true;
      }
      return false;
    });
    console.log("clicked create button", clicked);
    await sleep(2000);

    if (clicked) {
      const listed = await page.evaluate(async () => {
        const raw = await window.hfq.ptyList();
        return raw;
      });
      const arr = Array.isArray(listed) ? listed : listed?.sessions || listed?.items || [];
      ptyId = arr[0]?.id || null;
      console.log("after UI create list", arr.map((s) => s.id));
    }
    if (!ptyId) {
      const created = await page.evaluate(async () => {
        return window.hfq.ptyCreate({ cols: 100, rows: 30, shell: "cmd" });
      });
      console.log("ptyCreate fallback", created);
      ptyId = created?.id || null;
      // remount terminal to refresh store
      await page.evaluate(() => {
        location.hash = "#/chat";
      });
      await sleep(500);
      await page.evaluate(() => {
        location.hash = "#/terminal";
      });
      await sleep(1500);
    }
    if (!ptyId) throw new Error("ptyCreate failed");

    // Give shell a moment, then write marker
    await sleep(1500);
    await page.evaluate(
      async ({ id, marker }) => {
        await window.hfq.ptyWrite({ id, data: `echo ${marker}\r` });
      },
      { id: ptyId, marker: MARKER },
    );
    await sleep(2500);

    // Verify ring already has marker via BE (precondition)
    const sb1 = await page.evaluate(async (id) => window.hfq.ptyGetScrollback({ id }), ptyId);
    const hasMarkerInRing = String(sb1?.data || "").includes(MARKER);
    console.log("ring after echo", {
      hasMarkerInRing,
      chars: sb1?.chars,
      truncated: sb1?.truncated,
    });
    if (!hasMarkerInRing) {
      // try powershell style write once more
      await page.evaluate(
        async ({ id, marker }) => {
          await window.hfq.ptyWrite({ id, data: `echo ${marker}\r\n` });
        },
        { id: ptyId, marker: MARKER },
      );
      await sleep(2000);
    }
    const sb1b = await page.evaluate(async (id) => window.hfq.ptyGetScrollback({ id }), ptyId);
    if (!String(sb1b?.data || "").includes(MARKER)) {
      throw new Error("marker not in BE ring after write");
    }

    // Leave Terminal → Chat ≥3s
    await page.evaluate(() => {
      location.hash = "#/chat";
    });
    await sleep(3500);

    // Session still alive
    const listed = await page.evaluate(async () => window.hfq.ptyList());
    const still = (listed?.sessions || listed || []).find?.((s) => s.id === ptyId) ||
      (Array.isArray(listed) ? listed.find((s) => s.id === ptyId) : null);
    console.log("list while away", listed);
    if (!still && !(Array.isArray(listed) && listed.some((s) => s.id === ptyId))) {
      // ptyList shape may be {sessions} or array
      const arr = Array.isArray(listed) ? listed : listed?.sessions || [];
      if (!arr.some((s) => s.id === ptyId)) {
        throw new Error("PTY killed while on Chat (should survive route switch)");
      }
    }

    // Return Terminal — remount should call ptyGetScrollback
    await page.evaluate(() => {
      location.hash = "#/terminal";
    });
    await sleep(3000);

    // Assert: DOM / xterm still shows marker OR BE ring still has it and FE requested scrollback
    const sb2 = await page.evaluate(async (id) => window.hfq.ptyGetScrollback({ id }), ptyId);
    const ringOk = String(sb2?.data || "").includes(MARKER);

    // Probe xterm DOM text if present
    const domText = await page.evaluate(() => {
      const roots = document.querySelectorAll(".xterm-rows, .xterm, [class*='xterm']");
      let t = "";
      roots.forEach((el) => {
        t += el.textContent || "";
      });
      return t;
    });
    const domOk = domText.includes(MARKER);
    console.log("after return", { ringOk, domOk, domLen: domText.length });

    // T1 product assertion: user-visible OR remount path with ring (xterm may strip ansi)
    // Prefer DOM; if xterm not painted in headless-ish, accept ring + session alive as
    // incomplete — release prompt requires screen. Try one more remount.
    if (!domOk) {
      await page.evaluate(() => {
        location.hash = "#/chat";
      });
      await sleep(1000);
      await page.evaluate(() => {
        location.hash = "#/terminal";
      });
      await sleep(2500);
    }
    const domText2 = await page.evaluate(() => {
      const roots = document.querySelectorAll(".xterm-rows, .xterm, [class*='xterm']");
      let t = "";
      roots.forEach((el) => {
        t += el.textContent || "";
      });
      // Also full body fallback
      return t || document.body?.innerText || "";
    });
    const domOk2 = domText2.includes(MARKER);
    console.log("dom retry", { domOk2, sample: domText2.slice(0, 200) });

    const evidenceDir = path.join(process.env.APPDATA || root, "HFQ-Code", "t1-evidence");
    fs.mkdirSync(evidenceDir, { recursive: true });
    const evidence = {
      at: new Date().toISOString(),
      version: info?.version,
      marker: MARKER,
      ptyId,
      ringAfterEcho: hasMarkerInRing,
      ringAfterReturn: ringOk,
      domAfterReturn: domOk || domOk2,
      sessionSurvivedChat: true,
    };
    fs.writeFileSync(path.join(evidenceDir, "t1-1.1.9.json"), JSON.stringify(evidence, null, 2));

    // Screenshot via CDP
    try {
      const shot = await page.screenshot({
        path: path.join(evidenceDir, "t1-1.1.9-terminal.png"),
        fullPage: false,
      });
      console.log("screenshot bytes", shot?.length || "ok");
    } catch (e) {
      console.log("screenshot failed", e.message);
    }

    if (!(domOk || domOk2)) {
      // Hard fail if no DOM — release requires screen visibility
      console.error("T1_FAIL: marker not visible in Terminal DOM after reattach");
      console.error("ringOk=", ringOk, "logs tail=", logs.slice(-500));
      process.exitCode = 2;
    } else {
      console.log("T1_PASS");
      process.exitCode = 0;
    }
  } catch (err) {
    console.error("T1_ERROR", err);
    process.exitCode = 1;
  } finally {
    try {
      await browser?.close();
    } catch {
      /* ignore */
    }
    try {
      child.kill();
    } catch {
      /* ignore */
    }
    try {
      spawn("taskkill", ["/F", "/IM", "electron.exe"], { stdio: "ignore" });
    } catch {
      /* ignore */
    }
  }
}

main();
