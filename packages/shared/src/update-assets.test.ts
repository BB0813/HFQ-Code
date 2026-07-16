import { describe, expect, it } from "vitest";
import {
  assertAllowedUpdateDownloadUrl,
  pickUpdateAsset,
  resolveAssetDownloadUrl,
  sanitizeUpdateFileName,
  scoreUpdateAsset,
} from "./update-assets.js";

describe("update-assets", () => {
  it("scores NSIS higher than portable", () => {
    expect(scoreUpdateAsset("HFQ Code-1.0.9-x64.exe")).toBeGreaterThan(
      scoreUpdateAsset("HFQ Code-1.0.9-portable.exe"),
    );
    expect(scoreUpdateAsset("notes.md")).toBeLessThan(0);
  });

  it("picks best installer asset", () => {
    const best = pickUpdateAsset([
      {
        name: "SHA256SUMS.txt",
        url: "https://github.com/BB0813/HFQ-Code/releases/download/v1/SHA256SUMS.txt",
      },
      {
        name: "HFQ Code-1.0.9-portable.exe",
        url: "https://github.com/BB0813/HFQ-Code/releases/download/v1/portable.exe",
      },
      {
        name: "HFQ Code-1.0.9-x64.exe",
        url: "https://github.com/BB0813/HFQ-Code/releases/download/v1/setup.exe",
        mirrorUrl: "https://ghproxy.com/https://github.com/…/setup.exe",
      },
    ]);
    expect(best?.name).toMatch(/x64/);
    expect(resolveAssetDownloadUrl(best!, true)).toContain("ghproxy");
  });

  it("sanitizes filenames", () => {
    const safe = sanitizeUpdateFileName("../../evil.exe");
    expect(safe).not.toMatch(/[/\\]/);
    expect(safe).toMatch(/evil\.exe$/i);
    expect(safe).toMatch(/\.exe$/i);
    expect(sanitizeUpdateFileName("noext")).toMatch(/\.exe$/i);
  });

  it("allows github and mirror hosts; rejects others", () => {
    expect(() =>
      assertAllowedUpdateDownloadUrl(
        "https://objects.githubusercontent.com/github-production-release-asset/1/x",
      ),
    ).not.toThrow();
    expect(() =>
      assertAllowedUpdateDownloadUrl("https://evil.example/malware.exe"),
    ).toThrow(/not allowed/i);
    expect(() => assertAllowedUpdateDownloadUrl("http://github.com/a/b")).toThrow(/https/i);
  });
});
