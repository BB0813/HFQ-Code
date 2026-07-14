import { describe, expect, it } from "vitest";
import { compareSemver, isNewerVersion, parseSemver, stripVersionNoise } from "./semver.js";

describe("semver", () => {
  it("strips v prefix, pre-release and build metadata", () => {
    expect(stripVersionNoise("v1.2.3")).toBe("1.2.3");
    expect(stripVersionNoise("1.2.3-rc.1")).toBe("1.2.3");
    expect(stripVersionNoise("1.2.3+build.9")).toBe("1.2.3");
  });

  it("parses triples", () => {
    expect(parseSemver("1.0.2")).toEqual([1, 0, 2]);
    expect(parseSemver("v2.10")).toEqual([2, 10, 0]);
  });

  it("compares versions", () => {
    expect(compareSemver("1.0.2", "1.0.1")).toBeGreaterThan(0);
    expect(compareSemver("1.0.1", "1.0.2")).toBeLessThan(0);
    expect(compareSemver("v1.0.1", "1.0.1")).toBe(0);
    expect(isNewerVersion("1.0.2", "1.0.1")).toBe(true);
    expect(isNewerVersion("1.0.1", "1.0.1")).toBe(false);
    expect(isNewerVersion("1.0.0", "1.0.1")).toBe(false);
  });
});
