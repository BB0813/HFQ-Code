import YAML from "yaml";
import { SkillFrontmatterSchema, type SkillFrontmatter } from "@hfq/shared";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

export function parseSkillMarkdown(raw: string): {
  frontmatter: SkillFrontmatter;
  body: string;
} {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error("SKILL.md must start with YAML frontmatter (--- ... ---)");
  }

  const parsed = YAML.parse(match[1] ?? "") as unknown;
  const frontmatter = SkillFrontmatterSchema.parse(parsed);
  const body = (match[2] ?? "").trim();
  return { frontmatter, body };
}

export function applyBaseDir(body: string, baseDir: string): string {
  return body.replaceAll("{baseDir}", baseDir);
}
