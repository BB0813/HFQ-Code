import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadSkills, skillsPromptIndex } from "./loader.js";

const temps: string[] = [];

afterEach(async () => {
  await Promise.all(
    temps.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

async function tmpDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

async function writeSkill(
  root: string,
  name: string,
  description: string,
  extraFront = "",
): Promise<void> {
  const dir = path.join(root, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "SKILL.md"),
    `---
name: ${name}
description: ${description}
${extraFront}---

Instructions for ${name}
`,
    "utf8",
  );
}

describe("loadSkills", () => {
  it("applies precedence: workspace over bundled", async () => {
    const workspace = await tmpDir("hfq-ws-");
    const bundled = await tmpDir("hfq-bundled-");
    await writeSkill(path.join(workspace, "skills"), "shared-name", "from workspace");
    await writeSkill(bundled, "shared-name", "from bundled");
    await writeSkill(bundled, "only-bundled", "bundled only");

    const skills = await loadSkills({
      workspacePath: workspace,
      bundledDir: bundled,
    });

    const shared = skills.find((s) => s.name === "shared-name");
    const only = skills.find((s) => s.name === "only-bundled");
    expect(shared?.description).toBe("from workspace");
    expect(shared?.source).toBe("workspace");
    expect(only?.source).toBe("bundled");
  });

  it("marks os-gated skills ineligible on mismatch", async () => {
    const bundled = await tmpDir("hfq-gate-");
    const wrongOs = process.platform === "win32" ? "darwin" : "win32";
    await writeSkill(
      bundled,
      "os-locked",
      "wrong os",
      `metadata:\n  openclaw:\n    os: ["${wrongOs}"]\n`,
    );

    const skills = await loadSkills({ bundledDir: bundled });
    const skill = skills.find((s) => s.name === "os-locked");
    expect(skill?.eligible).toBe(false);
    expect(skill?.ineligibleReason).toMatch(/os gate/);
  });

  it("builds a compact skill index for prompts", async () => {
    const bundled = await tmpDir("hfq-idx-");
    await writeSkill(bundled, "alpha", "Alpha skill");
    const skills = await loadSkills({ bundledDir: bundled });
    const index = skillsPromptIndex(skills);
    expect(index).toContain("alpha:");
    expect(index).toContain("Alpha skill");
  });
});
