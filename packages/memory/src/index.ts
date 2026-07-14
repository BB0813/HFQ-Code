/**
 * Local file-backed memory brain (Phase-2).
 * User + project scopes; BM25-ish ranking; stable interface for agent / future sidecar.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

export type MemoryScope = "user" | "project";

export interface MemoryHit {
  id: string;
  text: string;
  score: number;
  source?: string;
  updatedAt?: string;
  scope?: MemoryScope;
  pinned?: boolean;
}

export interface MemoryDoc {
  id: string;
  text: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  scope?: MemoryScope;
  pinned?: boolean;
}

export interface MemoryBrain {
  upsert(doc: {
    id?: string;
    text: string;
    source?: string;
    tags?: string[];
    scope?: MemoryScope;
    pinned?: boolean;
  }): Promise<string>;
  search(query: string, limit?: number, opts?: { scope?: MemoryScope | "all" }): Promise<MemoryHit[]>;
  list(limit?: number, opts?: { scope?: MemoryScope | "all" }): Promise<MemoryDoc[]>;
  remove(id: string, scope?: MemoryScope): Promise<boolean>;
}

export function createNoopMemory(): MemoryBrain {
  return {
    async upsert() {
      return "noop";
    },
    async search() {
      return [];
    },
    async list() {
      return [];
    },
    async remove() {
      return false;
    },
  };
}

interface StoreFile {
  version: 1 | 2;
  docs: MemoryDoc[];
}

async function readStore(filePath: string): Promise<StoreFile> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    if (!parsed || !Array.isArray(parsed.docs)) return { version: 2, docs: [] };
    return { version: 2, docs: parsed.docs };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { version: 2, docs: [] };
    throw err;
  }
}

async function writeStore(filePath: string, store: StoreFile): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify({ version: 2, docs: store.docs }, null, 2)}\n`, "utf8");
}

function tokenize(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/** BM25-ish score over a small in-memory corpus (k1=1.2, b=0.75). */
function scoreBm25(query: string, docs: MemoryDoc[], doc: MemoryDoc): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const body = doc.text.toLowerCase();
  if (body.includes(q)) {
    return 12 + Math.min(q.length, 24) * 0.08 + (doc.pinned ? 1.5 : 0);
  }

  const qTokens = tokenize(q);
  if (!qTokens.length) return 0;

  const N = Math.max(docs.length, 1);
  const avgdl =
    docs.reduce((acc, d) => acc + Math.max(tokenize(d.text).length, 1), 0) / N || 1;
  const dl = Math.max(tokenize(body).length, 1);
  const tfMap = new Map<string, number>();
  for (const t of tokenize(body)) tfMap.set(t, (tfMap.get(t) || 0) + 1);

  const k1 = 1.2;
  const b = 0.75;
  let score = 0;
  for (const term of qTokens) {
    const df = docs.filter((d) => tokenize(d.text).includes(term)).length || 0;
    if (!df) continue;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    const tf = tfMap.get(term) || 0;
    if (!tf) continue;
    const denom = tf + k1 * (1 - b + b * (dl / avgdl));
    score += idf * ((tf * (k1 + 1)) / denom);
  }
  if (doc.pinned) score += 0.35;
  return score;
}

function scoreDoc(query: string, doc: MemoryDoc, corpus: MemoryDoc[]): number {
  return scoreBm25(query, corpus, doc);
}

export function projectScopeKey(workspacePath: string): string {
  const resolved = path.resolve(workspacePath || ".");
  return createHash("sha256").update(resolved.toLowerCase()).digest("hex").slice(0, 16);
}

/**
 * Legacy single-file memory under dir/notes.json (Beta).
 */
export function createFileMemory(opts: {
  dir: string;
  fileName?: string;
  maxDocs?: number;
  defaultScope?: MemoryScope;
}): MemoryBrain {
  const filePath = path.join(opts.dir, opts.fileName ?? "notes.json");
  const maxDocs = opts.maxDocs ?? 500;
  const defaultScope = opts.defaultScope ?? "user";

  return {
    async upsert(doc) {
      const store = await readStore(filePath);
      const now = new Date().toISOString();
      const text = String(doc.text || "").trim();
      if (!text) throw new Error("memory text required");

      const id = doc.id?.trim() || randomUUID();
      const idx = store.docs.findIndex((d) => d.id === id);
      const next: MemoryDoc = {
        id,
        text: text.slice(0, 8_000),
        source: doc.source,
        tags: doc.tags,
        scope: doc.scope ?? defaultScope,
        pinned: Boolean(doc.pinned),
        createdAt: idx >= 0 ? store.docs[idx]!.createdAt : now,
        updatedAt: now,
      };
      if (idx >= 0) store.docs[idx] = next;
      else store.docs.unshift(next);

      // pinned first, then recency
      store.docs.sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
        return a.updatedAt < b.updatedAt ? 1 : -1;
      });
      if (store.docs.length > maxDocs) store.docs.length = maxDocs;
      await writeStore(filePath, store);
      return id;
    },

    async search(query, limit = 8, searchOpts) {
      const store = await readStore(filePath);
      let docs = store.docs;
      const scope = searchOpts?.scope ?? "all";
      if (scope !== "all") docs = docs.filter((d) => (d.scope ?? defaultScope) === scope);
      const ranked = docs
        .map((d) => ({
          id: d.id,
          text: d.text,
          source: d.source,
          updatedAt: d.updatedAt,
          scope: d.scope ?? defaultScope,
          pinned: d.pinned,
          score: scoreDoc(query, d, docs),
        }))
        .filter((h) => h.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(1, Math.min(limit, 50)));
      return ranked;
    },

    async list(limit = 50, listOpts) {
      const store = await readStore(filePath);
      let docs = store.docs;
      const scope = listOpts?.scope ?? "all";
      if (scope !== "all") docs = docs.filter((d) => (d.scope ?? defaultScope) === scope);
      return docs.slice(0, Math.max(1, Math.min(limit, 200)));
    },

    async remove(id, scope) {
      const store = await readStore(filePath);
      const before = store.docs.length;
      store.docs = store.docs.filter((d) => {
        if (d.id !== id) return true;
        if (scope && (d.scope ?? defaultScope) !== scope) return true;
        return false;
      });
      if (store.docs.length === before) return false;
      await writeStore(filePath, store);
      return true;
    },
  };
}

/**
 * Phase-2 scoped memory: user/notes.json + projects/<hash>/notes.json
 * Merges legacy root notes.json into user on first access.
 */
export function createScopedMemory(opts: {
  rootDir: string;
  workspacePath?: string;
  maxDocsPerScope?: number;
}): MemoryBrain {
  const maxDocs = opts.maxDocsPerScope ?? 500;
  const userDir = path.join(opts.rootDir, "user");
  const userBrain = createFileMemory({
    dir: userDir,
    fileName: "notes.json",
    maxDocs,
    defaultScope: "user",
  });

  let projectBrain: MemoryBrain | null = null;
  let projectKey: string | null = null;
  if (opts.workspacePath) {
    projectKey = projectScopeKey(opts.workspacePath);
    projectBrain = createFileMemory({
      dir: path.join(opts.rootDir, "projects", projectKey),
      fileName: "notes.json",
      maxDocs,
      defaultScope: "project",
    });
  }

  let migrated = false;
  async function migrateLegacy(): Promise<void> {
    if (migrated) return;
    migrated = true;
    const legacyPath = path.join(opts.rootDir, "notes.json");
    try {
      const raw = await fs.readFile(legacyPath, "utf8");
      const parsed = JSON.parse(raw) as StoreFile;
      if (!Array.isArray(parsed.docs) || !parsed.docs.length) return;
      for (const d of parsed.docs) {
        await userBrain.upsert({
          id: d.id,
          text: d.text,
          source: d.source ?? "legacy",
          tags: d.tags,
          scope: "user",
          pinned: d.pinned,
        });
      }
      await fs.rename(legacyPath, path.join(opts.rootDir, "notes.legacy.json")).catch(async () => {
        await fs.rm(legacyPath, { force: true });
      });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        /* keep going */
      }
    }
  }

  return {
    async upsert(doc) {
      await migrateLegacy();
      const scope = doc.scope ?? (projectBrain ? "project" : "user");
      if (scope === "project") {
        if (!projectBrain) throw new Error("project memory requires workspacePath");
        return projectBrain.upsert({ ...doc, scope: "project" });
      }
      return userBrain.upsert({ ...doc, scope: "user" });
    },

    async search(query, limit = 8, searchOpts) {
      await migrateLegacy();
      const scope = searchOpts?.scope ?? "all";
      if (scope === "user") return userBrain.search(query, limit, { scope: "user" });
      if (scope === "project") {
        if (!projectBrain) return [];
        return projectBrain.search(query, limit, { scope: "project" });
      }
      const half = Math.max(1, Math.ceil(limit / 2));
      const [userHits, projectHits] = await Promise.all([
        userBrain.search(query, half, { scope: "user" }),
        projectBrain ? projectBrain.search(query, half, { scope: "project" }) : Promise.resolve([]),
      ]);
      return [...userHits, ...projectHits]
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(1, Math.min(limit, 50)));
    },

    async list(limit = 50, listOpts) {
      await migrateLegacy();
      const scope = listOpts?.scope ?? "all";
      if (scope === "user") return userBrain.list(limit, { scope: "user" });
      if (scope === "project") {
        if (!projectBrain) return [];
        return projectBrain.list(limit, { scope: "project" });
      }
      const [u, p] = await Promise.all([
        userBrain.list(limit, { scope: "user" }),
        projectBrain ? projectBrain.list(limit, { scope: "project" }) : Promise.resolve([]),
      ]);
      return [...u, ...p]
        .sort((a, b) => {
          if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
          return a.updatedAt < b.updatedAt ? 1 : -1;
        })
        .slice(0, Math.max(1, Math.min(limit, 200)));
    },

    async remove(id, scope) {
      await migrateLegacy();
      if (scope === "project") {
        if (!projectBrain) return false;
        return projectBrain.remove(id, "project");
      }
      if (scope === "user") return userBrain.remove(id, "user");
      const a = await userBrain.remove(id, "user");
      const b = projectBrain ? await projectBrain.remove(id, "project") : false;
      return a || b;
    },
  };
}

/** Format top hits for system-prompt injection. */
export function formatMemoryForPrompt(hits: MemoryHit[], maxChars = 2_000): string {
  if (!hits.length) return "";
  const lines = hits.map((h, i) => {
    const src = h.source ? ` (${h.source})` : "";
    const sc = h.scope ? ` [${h.scope}]` : "";
    return `${i + 1}. ${h.text.slice(0, 400)}${src}${sc}`;
  });
  let body = lines.join("\n");
  if (body.length > maxChars) body = `${body.slice(0, maxChars)}\n…`;
  return `## Memory notes\n${body}`;
}
