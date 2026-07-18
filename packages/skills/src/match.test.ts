import { describe, expect, it } from "vitest";
import type { SkillRecord } from "@hfq/shared";
import { formatMatchedSkillBodies, matchSkills } from "./match.js";

function skill(partial: Partial<SkillRecord> & Pick<SkillRecord, "name" | "description">): SkillRecord {
  return {
    dir: `/skills/${partial.name}`,
    source: "bundled",
    body: partial.body ?? `# ${partial.name}\nUse mermaid for architecture diagrams.`,
    enabled: true,
    eligible: true,
    ...partial,
  };
}

describe("matchSkills", () => {
  const skills = [
    skill({
      name: "diagram",
      description: "Draw architecture flowcharts sequences and state machines as mermaid diagrams",
      body: "Emit mermaid fences. Prefer flowchart TD.",
    }),
    skill({
      name: "hello-workspace",
      description: "Tiny sample skill for workspace greeting",
      body: "Say hello to the workspace.",
    }),
    skill({
      name: "mcp-builder",
      description: "Build MCP servers with solid tool design",
      body: "Design tools carefully.",
      eligible: false,
    }),
  ];

  it("ranks diagram for architecture / mermaid queries", () => {
    const hits = matchSkills("画一个系统架构图 with mermaid", skills, { limit: 2 });
    expect(hits[0]?.skill.name).toBe("diagram");
    expect(hits[0]!.score).toBeGreaterThan(0);
  });

  it("boosts preferred profile skill ids", () => {
    const hits = matchSkills("help", skills, { limit: 2, preferNames: ["diagram"], minScore: 1 });
    expect(hits.some((h) => h.skill.name === "diagram")).toBe(true);
  });

  it("ignores ineligible skills", () => {
    const hits = matchSkills("build MCP server tools", skills, { limit: 3, minScore: 1 });
    expect(hits.every((h) => h.skill.name !== "mcp-builder")).toBe(true);
  });

  it("formats bodies under budget", () => {
    const hits = matchSkills("architecture mermaid", skills, { limit: 1 });
    const text = formatMatchedSkillBodies(hits, 500);
    expect(text).toMatch(/Matched skill details/);
    expect(text).toMatch(/diagram/);
  });
});
