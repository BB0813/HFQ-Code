import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertInstallerPathInUpdatesDir,
  assertSilentInstallAllowed,
  buildPendingInstallMarker,
  evaluatePendingInstallOnBoot,
  isNsisInstallerCandidate,
  isPortableInstallerName,
  isPortableRuntime,
  NSIS_SILENT_ARGS,
  parsePendingInstallMarker,
} from "./update-silent.js";

describe("update-silent L3 helpers", () => {
  it("detects portable names and runtime", () => {
    expect(isPortableInstallerName("HFQ Code-1.1.8-portable.exe")).toBe(true);
    expect(isPortableInstallerName("HFQ Code-1.1.8-x64.exe")).toBe(false);
    expect(isPortableRuntime({ PORTABLE_EXECUTABLE_DIR: "C:\\p" }, "C:\\app\\HFQ Code.exe")).toBe(
      true,
    );
    expect(isPortableRuntime({}, "C:\\apps\\HFQ Code-portable.exe")).toBe(true);
    expect(isPortableRuntime({}, "C:\\Program Files\\HFQ Code\\HFQ Code.exe")).toBe(false);
  });

  it("accepts NSIS candidates and rejects portable", () => {
    expect(isNsisInstallerCandidate("HFQ Code-1.1.8-x64.exe")).toBe(true);
    expect(isNsisInstallerCandidate("HFQ-Code-Setup-1.1.8.exe")).toBe(true);
    expect(isNsisInstallerCandidate("HFQ Code-1.1.8-portable.exe")).toBe(false);
    expect(isNsisInstallerCandidate("notes.txt")).toBe(false);
    expect(NSIS_SILENT_ARGS).toEqual(["/S"]);
  });

  it("sandboxes installer path under updates root", () => {
    const root = path.resolve("/tmp/hfq-updates");
    const ok = path.join(root, "HFQ Code-1.1.8-x64.exe");
    expect(assertInstallerPathInUpdatesDir(ok, root)).toBe(path.resolve(ok));

    expect(() =>
      assertInstallerPathInUpdatesDir(path.join(root, "..", "evil.exe"), root),
    ).toThrow(/updates/);

    expect(() =>
      assertInstallerPathInUpdatesDir(path.join(root, "HFQ Code-1.1.8-portable.exe"), root),
    ).toThrow(/Portable/);
  });

  it("builds and parses pending-install markers", () => {
    const marker = buildPendingInstallMarker({
      version: "v1.1.8",
      filePath: path.join("/tmp/updates", "HFQ Code-1.1.8-x64.exe"),
      mode: "silent",
      reason: "install-and-restart",
      currentVersionAtSchedule: "1.1.7",
    });
    expect(marker.version).toBe("1.1.8");
    expect(marker.mode).toBe("silent");
    expect(marker.reason).toBe("install-and-restart");

    const parsed = parsePendingInstallMarker({
      version: "1.1.8",
      filePath: marker.filePath,
      mode: "silent",
      scheduledAt: marker.scheduledAt,
    });
    expect(parsed?.version).toBe("1.1.8");
    expect(parsePendingInstallMarker(null)).toBeNull();
    expect(parsePendingInstallMarker({ version: "1.0" })).toBeNull();
  });

  it("evaluates boot recovery vs target version", () => {
    const marker = buildPendingInstallMarker({
      version: "1.1.8",
      filePath: "/tmp/u/a.exe",
    });
    expect(evaluatePendingInstallOnBoot(null, "1.1.7").status).toBe("none");
    const ok = evaluatePendingInstallOnBoot(marker, "1.1.8");
    expect(ok.status).toBe("success");
    if (ok.status === "success") {
      expect(ok.message).toMatch(/1\.1\.8/);
    }
    const pending = evaluatePendingInstallOnBoot(marker, "1.1.7");
    expect(pending.status).toBe("pending");
  });

  it("gates silent install on prefs and portable runtime", () => {
    expect(() =>
      assertSilentInstallAllowed({ silentInstall: false }),
    ).toThrow(/未开启/);
    expect(() =>
      assertSilentInstallAllowed({ silentInstall: true, portableRuntime: true }),
    ).toThrow(/Portable/);
    expect(() =>
      assertSilentInstallAllowed({
        silentInstall: true,
        silentInstallAcceptedAt: "2026-07-20T00:00:00.000Z",
      }),
    ).not.toThrow();
  });
});
