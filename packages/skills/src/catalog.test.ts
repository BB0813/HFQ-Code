import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import * as tar from "tar";
import {
  annotateInstalled,
  assertSafePackageUrl,
  curatedCatalog,
  findSkillRoot,
  installSkillFromDir,
  installSkillFromPackage,
  isSafeArchiveEntryPath,
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

  it("validates package URLs and archive paths", () => {
    expect(assertSafePackageUrl("https://example.com/a.zip").ok).toBe(true);
    expect(assertSafePackageUrl("http://example.com/a.zip").ok).toBe(false);
    expect(assertSafePackageUrl("https://localhost/a.zip").ok).toBe(false);
    expect(assertSafePackageUrl("https://127.0.0.1/a.zip").ok).toBe(false);
    expect(assertSafePackageUrl("https://user:pass@example.com/a.zip").ok).toBe(false);

    expect(isSafeArchiveEntryPath("skill/SKILL.md")).toBe(true);
    expect(isSafeArchiveEntryPath("../escape")).toBe(false);
    expect(isSafeArchiveEntryPath("/abs")).toBe(false);
    expect(isSafeArchiveEntryPath("C:/windows")).toBe(false);
    expect(isSafeArchiveEntryPath("foo/../../etc/passwd")).toBe(false);
  });

  it("finds nested SKILL.md roots", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-skill-root-"));
    temps.push(root);
    const nested = path.join(root, "pkg", "hello-skill");
    await fs.mkdir(nested, { recursive: true });
    await fs.writeFile(
      path.join(nested, "SKILL.md"),
      `---\nname: nested-skill\ndescription: Nested\n---\n\n# Nested\n`,
      "utf8",
    );
    const found = await findSkillRoot(root);
    expect(found).toBe(nested);
  });

  it("installs from a local tar.gz via installSkillFromPackage download hook", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-skill-pkg-"));
    temps.push(root);
    const packDir = path.join(root, "pack", "remote-demo");
    const user = path.join(root, "user-skills");
    await fs.mkdir(packDir, { recursive: true });
    await fs.writeFile(
      path.join(packDir, "SKILL.md"),
      `---\nname: remote-demo\ndescription: From package\n---\n\n# Remote demo\n`,
      "utf8",
    );
    await fs.writeFile(path.join(packDir, "extra.txt"), "payload", "utf8");

    const tgz = path.join(root, "remote-demo.tar.gz");
    await tar.c({ gzip: true, file: tgz, cwd: path.join(root, "pack") }, ["remote-demo"]);
    const body = await fs.readFile(tgz);
    const sha = createHash("sha256").update(body).digest("hex");

    const badSha = await installSkillFromPackage({
      packageUrl: "https://example.com/remote-demo.tar.gz",
      userSkillsDir: user,
      expectedSha256: "0".repeat(64),
      download: async ({ destFile, expectedSha256 }) => {
        await fs.copyFile(tgz, destFile);
        const got = createHash("sha256").update(await fs.readFile(destFile)).digest("hex");
        if (expectedSha256 && expectedSha256 !== got) {
          throw Object.assign(new Error(`SHA-256 mismatch`), { code: "checksum" as const });
        }
        return { bytes: body.length, sha256: got };
      },
    });
    expect(badSha.ok).toBe(false);
    expect(badSha.code).toBe("checksum");

    const res = await installSkillFromPackage({
      packageUrl: "https://example.com/remote-demo.tar.gz",
      userSkillsDir: user,
      expectedSha256: sha,
      download: async ({ destFile }) => {
        await fs.copyFile(tgz, destFile);
        return { bytes: body.length, sha256: sha };
      },
    });
    expect(res.ok).toBe(true);
    expect(res.name).toBe("remote-demo");
    expect(await fs.readFile(path.join(user, "remote-demo", "extra.txt"), "utf8")).toBe("payload");

    const again = await installSkillFromPackage({
      packageUrl: "https://example.com/remote-demo.tar.gz",
      userSkillsDir: user,
      download: async ({ destFile }) => {
        await fs.copyFile(tgz, destFile);
        return { bytes: body.length, sha256: sha };
      },
    });
    expect(again.ok).toBe(false);
    expect(again.code).toBe("already_exists");
  });

  it("rejects path-escape entries in zip-like layout via isSafeArchiveEntryPath", () => {
    // extractZipSafe uses the same helper; unit-level assert is enough without crafting zip bytes.
    expect(isSafeArchiveEntryPath("ok/SKILL.md")).toBe(true);
    expect(isSafeArchiveEntryPath("..\\windows\\system32")).toBe(false);
  });
});
