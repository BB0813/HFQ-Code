import { describe, expect, it } from "vitest";
import {
  formatCompactUserContent,
  formatGoalUserContent,
  parseUserSlash,
} from "./slash.js";

describe("parseUserSlash", () => {
  it("parses /goal with body", () => {
    const p = parseUserSlash("/goal 梳理 packages 并写摘要");
    expect(p.kind).toBe("goal");
    expect(p.body).toBe("梳理 packages 并写摘要");
    expect(p.displayText).toBe("/goal 梳理 packages 并写摘要");
  });

  it("parses bare /goal", () => {
    const p = parseUserSlash("/goal");
    expect(p.kind).toBe("goal");
    expect(p.body).toBe("");
  });

  it("parses /compact", () => {
    const p = parseUserSlash("/compact keep file paths");
    expect(p.kind).toBe("compact");
    expect(p.body).toBe("keep file paths");
  });

  it("leaves plain text alone", () => {
    const p = parseUserSlash("list");
    expect(p.kind).toBe("plain");
    expect(p.body).toBe("list");
  });

  it("is case-insensitive on command token", () => {
    expect(parseUserSlash("/GOAL do it").kind).toBe("goal");
    expect(parseUserSlash("/Compact").kind).toBe("compact");
  });
});

describe("formatGoalUserContent", () => {
  it("embeds the goal and long-run markers", () => {
    const text = formatGoalUserContent("ship feature X");
    expect(text).toContain("HFQ Goal mode");
    expect(text).toContain("ship feature X");
    expect(text).toContain("elevated tool budget");
  });
});

describe("formatCompactUserContent", () => {
  it("includes optional note", () => {
    const text = formatCompactUserContent("keep diffs");
    expect(text).toContain("Compact request");
    expect(text).toContain("keep diffs");
  });
});
