import type { SkillRecord } from "@hfq/shared";

export interface SkillMatchOptions {
  /** Max skills to return (default 2). */
  limit?: number;
  /** Prefer these skill names (e.g. coding profile skillIds). */
  preferNames?: string[];
  /** Minimum score to include (default 1). */
  minScore?: number;
}

export interface SkillMatch {
  skill: SkillRecord;
  score: number;
  reasons: string[];
}

function tokenize(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff_./-]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/**
 * Progressive skill match: rank eligible skills by user text + optional preferred names.
 * Used to inject top-K skill **bodies** under the always-present name/description index.
 */
export function matchSkills(
  query: string,
  skills: SkillRecord[],
  opts: SkillMatchOptions = {},
): SkillMatch[] {
  const limit = Math.max(0, Math.min(opts.limit ?? 2, 8));
  if (limit === 0) return [];
  const minScore = opts.minScore ?? 1;
  const prefer = new Set((opts.preferNames ?? []).map((n) => n.trim().toLowerCase()).filter(Boolean));
  const q = String(query || "").trim().toLowerCase();
  const qTokens = tokenize(q);
  const eligible = skills.filter((s) => s.enabled && s.eligible);

  const scored: SkillMatch[] = [];
  for (const skill of eligible) {
    const name = skill.name.toLowerCase();
    const desc = skill.description.toLowerCase();
    const bodyHead = skill.body.slice(0, 1_200).toLowerCase();
    let score = 0;
    const reasons: string[] = [];

    if (prefer.has(name)) {
      score += 8;
      reasons.push("profile");
    }
    if (q && (q.includes(name) || name.includes(q))) {
      score += 10;
      reasons.push("name");
    }
    // bare `$skill` / “使用技能 foo”
    if (q && new RegExp(`(?:使用技能|skill)\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(q)) {
      score += 14;
      reasons.push("explicit");
    }

    for (const tok of qTokens) {
      if (name === tok || name.includes(tok)) {
        score += 4;
        reasons.push(`name:${tok}`);
      } else if (desc.includes(tok)) {
        score += 2;
        reasons.push(`desc:${tok}`);
      } else if (bodyHead.includes(tok)) {
        score += 1;
      }
    }

    // Chinese / English soft triggers from description keywords
    if (q && desc) {
      const descTokens = tokenize(desc).slice(0, 24);
      let overlap = 0;
      for (const t of descTokens) {
        if (qTokens.includes(t) || q.includes(t)) overlap += 1;
      }
      if (overlap >= 2) {
        score += overlap;
        reasons.push(`overlap:${overlap}`);
      }
    }

    if (score >= minScore) {
      scored.push({ skill, score, reasons: [...new Set(reasons)].slice(0, 6) });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name));
  return scored.slice(0, limit);
}

/**
 * Format matched skill bodies for system prompt injection (progressive detail under the index).
 */
export function formatMatchedSkillBodies(
  matches: SkillMatch[],
  maxChars = 6_000,
): string {
  if (!matches.length) return "";
  const parts: string[] = ["## Matched skill details", "Full instructions for skills most relevant to the latest user request:"];
  let used = parts.join("\n").length;
  for (const m of matches) {
    const body = m.skill.body.trim();
    if (!body) continue;
    const header = `\n### skill: ${m.skill.name}\n`;
    const room = maxChars - used - header.length - 20;
    if (room < 200) break;
    const slice = body.length > room ? `${body.slice(0, room)}\n…` : body;
    parts.push(header + slice);
    used += header.length + slice.length;
  }
  return parts.join("\n");
}
