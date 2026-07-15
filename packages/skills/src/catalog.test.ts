import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  annotateInstalled,
  curatedCatalog,
  installSkillFromDir,
  mergeCatalog,
  parseRemoteCatalogJson,
  readSkillPreview,
} from "./catalog.js";

const temps: string[] = [];

afterEach(async () => {
  await Promise.all(temps.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

describe("skill catalog scaffold", () => {
  it("exposes curated items", () => {
    const items = curatedCatalog();
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.every((i) => i.name && i.description)).toBe(true);
  });

  it("parses remote JSON shapes", () => {
    const a = parseRemoteCatalogJson({
      skills: [{ id: "x", name: "x-skill", description: "demo", tags: ["a"] }],
    });
    expect(a).toHaveLength(1);
    expect(a[0]?.name).toBe("x-skill");

    const b = parseRemoteCatalogJson([{ name: "bad name!", description: "nope" }]);
    expect(b).toHaveLength(0);
  });

  it("merges and annotates installed", () => {
    const merged = mergeCatalog(curatedCatalog(), [
      {
        id: "hello-workspace",
        name: "hello-workspace",
        description: "remote override",
        origin: "remote",
      },
    ]);
    const hw = merged.find((i) => i.id === "hello-workspace");
    expect(hw?.origin).toBe("remote");
    expect(hw?.description).toBe("remote override");

    const annotated = annotateInstalled(merged, ["hello-workspace"]);
    expect(annotated.find((i) => i.name === "hello-workspace")?.installed).toBe(true);
  });

  it("installs a local skill folder into user skills dir", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-skill-"));
    temps.push(root);
    const src = path.join(root, "src-skill");
    const user = path.join(root, "user-skills");
    await fs.mkdir(src, { recursive: true });
    await fs.writeFile(
      path.join(src, "SKILL.md"),
      `---\nname: demo-install\ndescription: Demo skill install\n---\n\n# Demo\n`,
      "utf8",
    );
    await fs.writeFile(path.join(src, "notes.txt"), "keep me", "utf8");

    const res = await installSkillFromDir({ sourceDir: src, userSkillsDir: user });
    expect(res.ok).toBe(true);
    expect(res.name).toBe("demo-install");
    const body = await fs.readFile(path.join(user, "demo-install", "SKILL.md"), "utf8");
    expect(body).toContain("demo-install");
    expect(await fs.readFile(path.join(user, "demo-install", "notes.txt"), "utf8")).toBe(
      "keep me",
    );

    const again = await installSkillFromDir({ sourceDir: src, userSkillsDir: user });
    expect(again.ok).toBe(false);
    expect(again.code).toBe("already_exists");
    expect(again.error).toMatch(/already installed/);
    expect(again.sourceDir).toBeTruthy();

    const overwrite = await installSkillFromDir({
      sourceDir: again.sourceDir || src,
      userSkillsDir: user,
      overwrite: true,
    });
    expect(overwrite.ok).toBe(true);

    const empty = path.join(root, "empty");
    await fs.mkdir(empty, { recursive: true });
    const bad = await installSkillFromDir({
      sourceDir: empty,
      userSkillsDir: user,
    });
    expect(bad.ok).toBe(false);
    expect(bad.code).toBe("invalid");

    const preview = await readSkillPreview({
      skillDir: path.join(user, "demo-install"),
      allowedRoots: [user],
    });
    expect(preview.ok).toBe(true);
    expect(preview.name).toBe("demo-install");
    expect(preview.body).toContain("Demo");

    const denied = await readSkillPreview({
      skillDir: path.join(user, "demo-install"),
      allowedRoots: [path.join(root, "other")],
    });
    expect(denied.ok).toBe(false);
  });
});
