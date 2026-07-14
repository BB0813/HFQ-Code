import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyImport, scanImportSources } from "./import-wizard.js";

const temps: string[] = [];

afterEach(async () => {
  await Promise.all(temps.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

describe("import wizard", () => {
  it("scans and copies a skill directory", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-import-"));
    temps.push(root);
    const skillSrc = path.join(root, "ext-skills", "demo-skill");
    await fs.mkdir(skillSrc, { recursive: true });
    await fs.writeFile(
      path.join(skillSrc, "SKILL.md"),
      "---\nname: demo-skill\ndescription: Demo\n---\n\n# Demo\n",
      "utf8",
    );
    const destSkills = path.join(root, "hfq-skills");
    await fs.mkdir(destSkills, { recursive: true });

    const scan = await scanImportSources({
      extraRoots: [{ label: "test", path: path.join(root, "ext-skills") }],
    });
    expect(scan.candidates.some((c) => c.name === "demo-skill")).toBe(true);
    const cand = scan.candidates.find((c) => c.name === "demo-skill")!;

    const applied = await applyImport({
      items: [{ id: cand.id, conflict: "overwrite" }],
      candidates: scan.candidates,
      skillsDestDir: destSkills,
    });
    expect(applied.copied.length).toBe(1);
    const skillMd = await fs.readFile(path.join(destSkills, "demo-skill", "SKILL.md"), "utf8");
    expect(skillMd).toMatch(/Demo/);
  });
});
