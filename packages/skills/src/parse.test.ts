import { describe, expect, it } from "vitest";
import { applyBaseDir, parseSkillMarkdown } from "./parse.js";

describe("parseSkillMarkdown", () => {
  it("parses name/description and body", () => {
    const raw = `---
name: demo-skill
description: Does a demo thing
---

Use this when testing.
Base: {baseDir}
`;
    const { frontmatter, body } = parseSkillMarkdown(raw);
    expect(frontmatter.name).toBe("demo-skill");
    expect(frontmatter.description).toContain("demo");
    expect(body).toContain("Use this when testing");
    expect(applyBaseDir(body, "C:\\\\skills\\\\demo")).toContain("C:\\\\skills\\\\demo");
  });

  it("parses light openclaw metadata gates", () => {
    const raw = `---
name: gated
description: needs git
metadata:
  openclaw:
    os: ["win32", "linux"]
    requires:
      bins: ["git"]
---

body
`;
    const { frontmatter } = parseSkillMarkdown(raw);
    expect(frontmatter.metadata?.openclaw?.requires?.bins).toEqual(["git"]);
    expect(frontmatter.metadata?.openclaw?.os).toContain("win32");
  });

  it("rejects missing frontmatter", () => {
    expect(() => parseSkillMarkdown("# no frontmatter\n")).toThrow(/frontmatter/);
  });
});
