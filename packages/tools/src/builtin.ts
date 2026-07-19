import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import type { ToolDefinition } from "@hfq/shared";
import {
  gitCommit,
  gitDiff,
  gitShow,
  gitStatus,
  sanitizedChildEnv,
} from "./git-ops.js";
import { resolveWorkspacePath } from "./workspace.js";

export const builtinToolDefs: ToolDefinition[] = [
  {
    name: "read_file",
    description: "Read a UTF-8 text file under the workspace",
    risk: "low",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        maxBytes: { type: "number" },
      },
      required: ["path"],
    },
  },
  {
    name: "read_document",
    description:
      "Read a workspace document as plain text. Supports text files, .docx (OOXML extract), and best-effort .pdf text. Prefer this over shell for pdf/docx/表格. Path must stay inside the workspace.",
    risk: "low",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative path" },
        maxChars: {
          type: "number",
          description: "Max characters of extracted text (default 50000)",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "list_dir",
    description: "List directory entries under the workspace",
    risk: "low",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write a UTF-8 text file under the workspace (create/overwrite)",
    risk: "medium",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "grep",
    description:
      "Search text files under the workspace for a regex or literal pattern. Returns matching lines with paths.",
    risk: "low",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex pattern (JS)" },
        path: {
          type: "string",
          description: "Relative directory or file to search (default: .)",
        },
        caseInsensitive: { type: "boolean" },
        maxMatches: { type: "number", description: "Cap matches (default 50)" },
        maxFileBytes: { type: "number" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "apply_patch",
    description:
      "Apply a multi-file patch under the workspace. Use V4A-style text: *** Begin Patch / *** Add File: path / *** Update File: path / *** Delete File: path / *** End Patch. Update hunks use @@ headers and -/+ lines with optional context.",
    risk: "medium",
    inputSchema: {
      type: "object",
      properties: {
        patch: {
          type: "string",
          description: "Full patch body including Begin/End markers",
        },
      },
      required: ["patch"],
    },
  },
  {
    name: "shell",
    description: "Run a shell command in the workspace directory",
    risk: "high",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string" },
        timeoutMs: { type: "number" },
      },
      required: ["command"],
    },
  },
  {
    name: "network_fetch",
    description:
      "HTTP(S) request for docs/APIs. Only http/https. Returns status, headers subset, and text body (capped).",
    risk: "medium",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        method: { type: "string", description: "GET (default) or POST/HEAD" },
        headers: {
          type: "object",
          description: "Optional request headers (string values)",
        },
        body: { type: "string", description: "Request body for POST" },
        timeoutMs: { type: "number" },
        maxBytes: { type: "number", description: "Response body cap (default 200k)" },
      },
      required: ["url"],
    },
  },
  {
    name: "git_status",
    description:
      "Read-only git status for the workspace (branch, dirty files, optional short log). Does not mutate the repo.",
    risk: "low",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Optional relative pathspec under the workspace (default: whole repo)",
        },
        includeLog: {
          type: "boolean",
          description: "Include last few commits (default true)",
        },
        maxEntries: {
          type: "number",
          description: "Cap changed-file rows (default 200)",
        },
        timeoutMs: { type: "number" },
      },
    },
  },
  {
    name: "memory_search",
    description:
      "Search local HFQ Code memory notes (user/project facts stored on this machine).",
    risk: "low",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
        scope: {
          type: "string",
          description: "user | project | all (default all)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "memory_save",
    description:
      "Save a short note into local HFQ Code memory for future sessions (durable on this machine).",
    risk: "medium",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        source: { type: "string", description: "Optional label, e.g. user / project" },
        id: { type: "string", description: "Optional id to update an existing note" },
        scope: {
          type: "string",
          description: "user | project (default project when workspace known)",
        },
        pinned: { type: "boolean" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags for retrieval",
        },
        links: {
          type: "array",
          items: { type: "string" },
          description: "Optional linked note ids, paths, or session refs",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "git_diff",
    description:
      "Read-only git diff for the workspace (unstaged by default). Does not mutate the repo.",
    risk: "low",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Optional pathspec" },
        staged: { type: "boolean", description: "If true, show --cached diff" },
        maxBytes: { type: "number" },
        timeoutMs: { type: "number" },
      },
    },
  },
  {
    name: "git_show",
    description:
      "Read-only git show for a commit/object (default HEAD). Does not mutate the repo.",
    risk: "low",
    inputSchema: {
      type: "object",
      properties: {
        object: {
          type: "string",
          description: "Commit-ish or object (default HEAD). No shell metacharacters.",
        },
        path: { type: "string", description: "Optional path inside the object (object:path)" },
        maxBytes: { type: "number" },
        timeoutMs: { type: "number" },
      },
    },
  },
  {
    name: "git_commit",
    description:
      "Stage optional paths and create a git commit with the given message. High risk — never force-push, never --amend. Prefer staging only intended files.",
    risk: "high",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Commit message (required)" },
        paths: {
          type: "array",
          description:
            "Optional relative paths to git add before commit. Empty = commit currently staged index only.",
          items: { type: "string" },
        },
        timeoutMs: { type: "number" },
      },
      required: ["message"],
    },
  },
  {
    name: "spawn_subagent",
    description:
      "Spawn a child agent with a focused goal (explore/edit/shell profile). Returns a summary for the parent. Prefer explore for research-only.",
    risk: "medium",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string" },
        profile: {
          type: "string",
          description: "explore | edit | shell (default explore)",
        },
      },
      required: ["goal"],
    },
  },
];

export type ToolHandler = (
  workspaceRoot: string,
  input: Record<string, unknown>,
) => Promise<unknown>;

async function readFileTool(workspaceRoot: string, input: Record<string, unknown>) {
  const rel = String(input.path ?? "");
  const maxBytes = Number(input.maxBytes ?? 200_000);
  const full = resolveWorkspacePath(workspaceRoot, rel);
  const buf = await fs.readFile(full);
  const slice = buf.subarray(0, maxBytes);
  return {
    path: rel,
    content: slice.toString("utf8"),
    truncated: buf.length > maxBytes,
    bytes: buf.length,
  };
}

const TEXT_DOC_EXT = new Set([
  ".md",
  ".txt",
  ".json",
  ".jsonl",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".html",
  ".htm",
  ".xml",
  ".yml",
  ".yaml",
  ".toml",
  ".ini",
  ".csv",
  ".tsv",
  ".log",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".kt",
  ".swift",
  ".rb",
  ".php",
  ".sql",
  ".sh",
  ".ps1",
  ".bat",
  ".cmd",
  ".gitignore",
  ".env",
  ".svg",
]);

function stripXmlTags(xml: string): string {
  return xml
    .replace(/<w:tab\b[^/]*\/>/gi, "\t")
    .replace(/<w:br\b[^/]*\/>/gi, "\n")
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Minimal ZIP local-file reader (store + deflate) for docx/xlsx OOXML. */
async function readZipEntry(buf: Buffer, entryName: string): Promise<Buffer | null> {
  const zlib = await import("node:zlib");
  const { promisify } = await import("node:util");
  const inflateRaw = promisify(zlib.inflateRaw);
  let offset = 0;
  const target = entryName.replace(/^\/+/, "");
  while (offset + 30 <= buf.length) {
    if (buf.readUInt32LE(offset) !== 0x04034b50) break;
    const method = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const uncompSize = buf.readUInt32LE(offset + 22);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buf.subarray(nameStart, nameStart + nameLen).toString("utf8");
    const dataStart = nameStart + nameLen + extraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > buf.length) break;
    if (name === target || name.endsWith("/" + target)) {
      const payload = buf.subarray(dataStart, dataEnd);
      if (method === 0) return Buffer.from(payload);
      if (method === 8) {
        const out = await inflateRaw(payload);
        return Buffer.isBuffer(out) ? out : Buffer.from(out);
      }
      return null;
    }
    offset = dataEnd;
    // Skip data descriptor if present is hard without flags; local headers usually enough for docx.
    void uncompSize;
  }
  return null;
}

function extractPdfText(buf: Buffer, maxChars: number): { text: string; ok: boolean; warning?: string } {
  const raw = buf.toString("latin1");
  const chunks: string[] = [];
  // Very small pure-JS extractor: pull printable runs from parentheses in content streams.
  const re = /\((?:\\.|[^\\)])*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    let s = m[0].slice(1, -1);
    s = s
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\")
      .replace(/\\(\d{1,3})/g, (_, oct: string) =>
        String.fromCharCode(parseInt(oct, 8) & 0xff),
      );
    // Keep mostly printable.
    s = s.replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]/g, "");
    if (s.trim()) chunks.push(s);
    if (chunks.join("").length > maxChars * 2) break;
  }
  let text = chunks.join(" ").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) {
    return {
      text: "",
      ok: false,
      warning: "Could not extract text from this PDF (may be scanned/image-only or compressed streams).",
    };
  }
  const truncated = text.length > maxChars;
  if (truncated) text = text.slice(0, maxChars);
  return { text, ok: true, warning: truncated ? "truncated" : undefined };
}

async function readDocumentTool(workspaceRoot: string, input: Record<string, unknown>) {
  const rel = String(input.path ?? "").trim();
  if (!rel) throw new Error("path required");
  const maxChars = Math.min(
    Math.max(Number(input.maxChars ?? 50_000) || 50_000, 1_000),
    200_000,
  );
  // Path escape rejected by resolveWorkspacePath.
  const full = resolveWorkspacePath(workspaceRoot, rel);
  const ext = path.extname(full).toLowerCase();
  const base = path.basename(full).toLowerCase();

  if (ext === ".docx") {
    const buf = await fs.readFile(full);
    const xmlBuf = await readZipEntry(buf, "word/document.xml");
    if (!xmlBuf) {
      return {
        ok: false,
        path: rel,
        format: "docx",
        error: "Invalid or unsupported docx (missing word/document.xml)",
      };
    }
    let text = stripXmlTags(xmlBuf.toString("utf8"));
    const truncated = text.length > maxChars;
    if (truncated) text = text.slice(0, maxChars);
    return {
      ok: true,
      path: rel,
      format: "docx",
      content: text,
      chars: text.length,
      truncated,
    };
  }

  if (ext === ".pdf") {
    const buf = await fs.readFile(full);
    const extracted = extractPdfText(buf, maxChars);
    if (!extracted.ok) {
      return {
        ok: false,
        path: rel,
        format: "pdf",
        error: extracted.warning || "pdf text extraction failed",
      };
    }
    return {
      ok: true,
      path: rel,
      format: "pdf",
      content: extracted.text,
      chars: extracted.text.length,
      truncated: Boolean(extracted.warning),
      warning: extracted.warning,
    };
  }

  if (ext === ".xlsx" || ext === ".xls") {
    return {
      ok: false,
      path: rel,
      format: ext.slice(1),
      error:
        "xlsx/xls preview not supported in this build; export CSV or open as text. (unsupported spreadsheet)",
    };
  }

  // Text / unknown: try UTF-8 read (same as read_file spirit).
  if (TEXT_DOC_EXT.has(ext) || !ext || base === "dockerfile" || base === "makefile") {
    const buf = await fs.readFile(full);
    let content = buf.toString("utf8");
    // Reject obvious binary.
    if (content.includes("\u0000")) {
      return {
        ok: false,
        path: rel,
        format: ext.slice(1) || "bin",
        error: "Binary file; use a specialized reader",
      };
    }
    const truncated = content.length > maxChars;
    if (truncated) content = content.slice(0, maxChars);
    return {
      ok: true,
      path: rel,
      format: ext.slice(1) || "text",
      content,
      chars: content.length,
      truncated,
    };
  }

  // Fallback attempt UTF-8 for unknown extensions.
  try {
    const buf = await fs.readFile(full);
    let content = buf.toString("utf8");
    if (content.includes("\u0000")) {
      return {
        ok: false,
        path: rel,
        format: ext.slice(1) || "unknown",
        error: `Unsupported document type "${ext || "unknown"}" (binary)`,
      };
    }
    const truncated = content.length > maxChars;
    if (truncated) content = content.slice(0, maxChars);
    return {
      ok: true,
      path: rel,
      format: ext.slice(1) || "text",
      content,
      chars: content.length,
      truncated,
    };
  } catch (err) {
    return {
      ok: false,
      path: rel,
      format: ext.slice(1) || "unknown",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function listDirTool(workspaceRoot: string, input: Record<string, unknown>) {
  const rel = String(input.path ?? ".");
  const full = resolveWorkspacePath(workspaceRoot, rel);
  const entries = await fs.readdir(full, { withFileTypes: true });
  return {
    path: rel,
    entries: entries.map((e) => ({
      name: e.name,
      type: e.isDirectory() ? "dir" : e.isFile() ? "file" : "other",
    })),
  };
}

async function writeFileTool(workspaceRoot: string, input: Record<string, unknown>) {
  const rel = String(input.path ?? "");
  const content = String(input.content ?? "");
  const full = resolveWorkspacePath(workspaceRoot, rel);
  let previous: string | null = null;
  let existed = false;
  try {
    previous = await fs.readFile(full, "utf8");
    existed = true;
  } catch {
    previous = null;
  }
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf8");
  return {
    path: rel,
    bytes: Buffer.byteLength(content, "utf8"),
    kind: existed ? ("modify" as const) : ("create" as const),
    previous,
    content,
  };
}

function runShell(
  workspaceRoot: string,
  command: string,
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === "win32";
    const child = spawn(isWin ? "cmd.exe" : "bash", isWin ? ["/d", "/s", "/c", command] : ["-lc", command], {
      cwd: workspaceRoot,
      env: sanitizedChildEnv(),
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    const max = 500_000;

    child.stdout.on("data", (d: Buffer) => {
      if (stdout.length < max) stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d: Buffer) => {
      if (stderr.length < max) stderr += d.toString("utf8");
    });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`shell timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function shellTool(workspaceRoot: string, input: Record<string, unknown>) {
  const command = String(input.command ?? "");
  const timeoutMs = Number(input.timeoutMs ?? 60_000);
  if (!command.trim()) throw new Error("empty command");
  return runShell(workspaceRoot, command, timeoutMs);
}

async function gitStatusTool(workspaceRoot: string, input: Record<string, unknown>) {
  return gitStatus(workspaceRoot, input);
}

const GREP_SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage",
  ".hfq",
  ".turbo",
  "out",
]);

function isProbablyBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

async function walkFiles(
  root: string,
  dir: string,
  out: string[],
  maxFiles: number,
): Promise<void> {
  if (out.length >= maxFiles) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (out.length >= maxFiles) return;
    if (ent.name === "." || ent.name === "..") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (GREP_SKIP_DIRS.has(ent.name)) continue;
      await walkFiles(root, full, out, maxFiles);
    } else if (ent.isFile()) {
      out.push(full);
    }
  }
}

async function grepTool(workspaceRoot: string, input: Record<string, unknown>) {
  const pattern = String(input.pattern ?? "");
  if (!pattern) throw new Error("pattern required");
  const rel = String(input.path ?? ".");
  const caseInsensitive = Boolean(input.caseInsensitive);
  const maxMatches = Math.min(Math.max(Number(input.maxMatches ?? 50), 1), 200);
  const maxFileBytes = Math.min(Math.max(Number(input.maxFileBytes ?? 200_000), 1024), 1_000_000);
  const maxFiles = 2000;

  let re: RegExp;
  try {
    re = new RegExp(pattern, caseInsensitive ? "i" : "");
  } catch (err) {
    throw new Error(`invalid regex: ${err instanceof Error ? err.message : String(err)}`);
  }

  const start = resolveWorkspacePath(workspaceRoot, rel);
  const files: string[] = [];
  const st = await fs.stat(start);
  if (st.isFile()) files.push(start);
  else await walkFiles(workspaceRoot, start, files, maxFiles);

  type Match = { path: string; line: number; text: string };
  const matches: Match[] = [];
  let filesScanned = 0;
  let truncated = false;

  for (const full of files) {
    if (matches.length >= maxMatches) {
      truncated = true;
      break;
    }
    let buf: Buffer;
    try {
      buf = await fs.readFile(full);
    } catch {
      continue;
    }
    if (buf.length > maxFileBytes) continue;
    if (isProbablyBinary(buf)) continue;
    filesScanned++;
    const text = buf.toString("utf8");
    const lines = text.split(/\r?\n/);
    const relPath = path.relative(workspaceRoot, full).split(path.sep).join("/");
    for (let i = 0; i < lines.length; i++) {
      if (matches.length >= maxMatches) {
        truncated = true;
        break;
      }
      const line = lines[i] ?? "";
      if (re.test(line)) {
        matches.push({
          path: relPath,
          line: i + 1,
          text: line.length > 400 ? `${line.slice(0, 400)}…` : line,
        });
      }
    }
  }

  return {
    pattern,
    path: rel,
    matches,
    matchCount: matches.length,
    filesScanned,
    truncated,
  };
}

type PatchOp =
  | { kind: "add"; path: string; content: string }
  | { kind: "delete"; path: string }
  | { kind: "update"; path: string; hunks: string[][] };

function normalizeRelPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.?\//, "").trim();
}

function parseApplyPatch(patchText: string): PatchOp[] {
  const raw = patchText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");
  const ops: PatchOp[] = [];
  let i = 0;

  // Optional outer markers
  while (i < lines.length && !lines[i]!.startsWith("*** ")) i++;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.startsWith("*** End Patch")) {
      i++;
      break;
    }
    if (line.startsWith("*** Begin Patch")) {
      i++;
      continue;
    }

    const addMatch = line.match(/^\*\*\* Add File:\s*(.+)\s*$/);
    if (addMatch) {
      const filePath = normalizeRelPath(addMatch[1] ?? "");
      i++;
      const body: string[] = [];
      while (i < lines.length) {
        const l = lines[i] ?? "";
        if (l.startsWith("*** ")) break;
        if (l.startsWith("+")) body.push(l.slice(1));
        else if (l.startsWith("\\")) {
          /* ignore "\ No newline" */
        } else if (l === "") body.push("");
        else body.push(l.startsWith(" ") ? l.slice(1) : l);
        i++;
      }
      ops.push({ kind: "add", path: filePath, content: body.join("\n") });
      continue;
    }

    const delMatch = line.match(/^\*\*\* Delete File:\s*(.+)\s*$/);
    if (delMatch) {
      ops.push({ kind: "delete", path: normalizeRelPath(delMatch[1] ?? "") });
      i++;
      continue;
    }

    const updMatch = line.match(/^\*\*\* Update File:\s*(.+)\s*$/);
    if (updMatch) {
      const filePath = normalizeRelPath(updMatch[1] ?? "");
      i++;
      // optional move line
      if ((lines[i] ?? "").startsWith("*** Move to:")) i++;
      const hunks: string[][] = [];
      let current: string[] | null = null;
      while (i < lines.length) {
        const l = lines[i] ?? "";
        if (l.startsWith("*** ")) break;
        if (l.startsWith("@@")) {
          if (current) hunks.push(current);
          current = [l];
          i++;
          continue;
        }
        if (!current) {
          // bare update without @@ — treat remaining as one hunk
          current = ["@@"];
        }
        current.push(l);
        i++;
      }
      if (current) hunks.push(current);
      ops.push({ kind: "update", path: filePath, hunks });
      continue;
    }

    i++;
  }

  if (!ops.length) {
    throw new Error(
      "empty or invalid patch; expected *** Begin Patch with Add/Update/Delete File sections",
    );
  }
  return ops;
}

function applyHunksToContent(original: string, hunks: string[][]): string {
  const fileLines = original.replace(/\r\n/g, "\n").split("\n");
  // Drop trailing empty from split if original ended without newline? keep as-is
  let cursor = 0;
  const out: string[] = [];

  for (const hunk of hunks) {
    const body = hunk[0]?.startsWith("@@") ? hunk.slice(1) : hunk;
    // Find context start among remaining file lines
    const oldLines: Array<{ tag: string; text: string }> = [];
    for (const raw of body) {
      if (raw.startsWith("\\")) continue;
      if (raw.startsWith("+")) continue;
      if (raw.startsWith("-")) oldLines.push({ tag: "-", text: raw.slice(1) });
      else if (raw.startsWith(" ")) oldLines.push({ tag: " ", text: raw.slice(1) });
      else if (raw.startsWith("@@")) continue;
      else oldLines.push({ tag: " ", text: raw });
    }

    let foundAt = -1;
    if (oldLines.length === 0) {
      foundAt = cursor;
    } else {
      const firstCtx = oldLines.map((l) => l.text);
      for (let pos = cursor; pos <= fileLines.length; pos++) {
        let ok = true;
        for (let j = 0; j < firstCtx.length; j++) {
          if ((fileLines[pos + j] ?? "") !== firstCtx[j]) {
            ok = false;
            break;
          }
        }
        if (ok) {
          foundAt = pos;
          break;
        }
      }
      if (foundAt < 0) {
        // fuzzy: search whole file
        for (let pos = 0; pos <= fileLines.length; pos++) {
          let ok = true;
          for (let j = 0; j < firstCtx.length; j++) {
            if ((fileLines[pos + j] ?? "") !== firstCtx[j]) {
              ok = false;
              break;
            }
          }
          if (ok) {
            foundAt = pos;
            break;
          }
        }
      }
    }
    if (foundAt < 0) {
      const preview = oldLines
        .slice(0, 3)
        .map((l) => l.text)
        .join("\\n");
      throw new Error(`hunk context not found near line ${cursor + 1}: ${preview}`);
    }

    // copy unchanged region
    while (cursor < foundAt) {
      out.push(fileLines[cursor] ?? "");
      cursor++;
    }

    // apply hunk body
    for (const raw of body) {
      if (raw.startsWith("\\") || raw.startsWith("@@")) continue;
      if (raw.startsWith("+")) {
        out.push(raw.slice(1));
      } else if (raw.startsWith("-")) {
        cursor++;
      } else if (raw.startsWith(" ")) {
        out.push(raw.slice(1));
        cursor++;
      } else {
        out.push(raw);
        cursor++;
      }
    }
  }

  while (cursor < fileLines.length) {
    out.push(fileLines[cursor] ?? "");
    cursor++;
  }
  return out.join("\n");
}

export type PatchFileChange = {
  path: string;
  kind: "create" | "modify" | "delete";
  previous: string | null;
  content: string | null;
};

async function applyPatchTool(workspaceRoot: string, input: Record<string, unknown>) {
  const patch = String(input.patch ?? "");
  if (!patch.trim()) throw new Error("patch required");
  const ops = parseApplyPatch(patch);
  const changes: PatchFileChange[] = [];

  for (const op of ops) {
    const full = resolveWorkspacePath(workspaceRoot, op.path);
    if (op.kind === "add") {
      let previous: string | null = null;
      try {
        previous = await fs.readFile(full, "utf8");
      } catch {
        previous = null;
      }
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, op.content, "utf8");
      changes.push({
        path: op.path,
        kind: previous === null ? "create" : "modify",
        previous,
        content: op.content,
      });
    } else if (op.kind === "delete") {
      let previous: string | null = null;
      try {
        previous = await fs.readFile(full, "utf8");
      } catch {
        throw new Error(`delete failed, file not found: ${op.path}`);
      }
      await fs.rm(full, { force: true });
      changes.push({
        path: op.path,
        kind: "delete",
        previous,
        content: null,
      });
    } else {
      let previous: string;
      try {
        previous = await fs.readFile(full, "utf8");
      } catch {
        throw new Error(`update failed, file not found: ${op.path}`);
      }
      const next = applyHunksToContent(previous, op.hunks);
      await fs.writeFile(full, next, "utf8");
      changes.push({
        path: op.path,
        kind: "modify",
        previous,
        content: next,
      });
    }
  }

  return {
    ok: true,
    changeCount: changes.length,
    changes,
  };
}

/** Hostnames / literals that must never be fetched (cloud metadata / SSRF). */
function isBlockedFetchHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    h === "metadata.google.internal" ||
    h === "metadata" ||
    h.endsWith(".metadata.google.internal")
  ) {
    return true;
  }
  // AWS / Azure / GCP link-local metadata
  if (h === "169.254.169.254" || h === "169.254.169.253" || h === "fd00:ec2::254") {
    return true;
  }
  // IPv4 link-local 169.254.0.0/16 (metadata often lives here)
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 169 && b === 254) return true;
  }
  return false;
}

function assertSafeFetchUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`invalid url: ${raw}`);
  }
  const protocol = url.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error(`only http/https allowed, got ${url.protocol}`);
  }
  if (!url.hostname) throw new Error("url hostname required");
  // Block obvious local file / metadata tricks via credentials-only hosts
  if (url.username || url.password) {
    throw new Error("url credentials not allowed");
  }
  if (isBlockedFetchHost(url.hostname)) {
    throw new Error(`url host blocked (metadata/SSRF): ${url.hostname}`);
  }
  return url;
}

async function networkFetchTool(_workspaceRoot: string, input: Record<string, unknown>) {
  const url = assertSafeFetchUrl(String(input.url ?? ""));
  const method = String(input.method ?? "GET").toUpperCase();
  if (!["GET", "POST", "HEAD"].includes(method)) {
    throw new Error(`method not allowed: ${method}`);
  }
  const timeoutMs = Math.min(Math.max(Number(input.timeoutMs ?? 20_000), 1000), 120_000);
  const maxBytes = Math.min(Math.max(Number(input.maxBytes ?? 200_000), 1024), 1_000_000);

  const headers: Record<string, string> = {
    "user-agent": "HFQ-Code/0.1 network_fetch",
    accept: "text/*, application/json, application/*+json, */*",
  };
  if (input.headers && typeof input.headers === "object" && !Array.isArray(input.headers)) {
    for (const [k, v] of Object.entries(input.headers as Record<string, unknown>)) {
      const key = String(k).toLowerCase();
      if (!key || key === "host" || key === "content-length") continue;
      if (key === "authorization" || key.startsWith("x-api")) {
        // Allow but do not echo later
        headers[key] = String(v ?? "");
      } else {
        headers[key] = String(v ?? "");
      }
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const init: RequestInit = {
      method,
      headers,
      signal: controller.signal,
      redirect: "follow",
    };
    if (method === "POST" && input.body != null) {
      init.body = String(input.body);
      if (!headers["content-type"]) headers["content-type"] = "application/json; charset=utf-8";
    }
    const res = await fetch(url.toString(), init);
    const headerOut: Record<string, string> = {};
    for (const name of ["content-type", "content-length", "date", "server", "cache-control"]) {
      const v = res.headers.get(name);
      if (v) headerOut[name] = v;
    }

    if (method === "HEAD") {
      return {
        url: res.url || url.toString(),
        status: res.status,
        ok: res.ok,
        headers: headerOut,
        body: "",
        bytes: 0,
        truncated: false,
      };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const slice = buf.subarray(0, maxBytes);
    const truncated = buf.length > maxBytes;
    // Prefer utf8 text; binary becomes base64 note
    let body: string;
    let encoding: "utf8" | "base64-preview" = "utf8";
    if (isProbablyBinary(slice)) {
      encoding = "base64-preview";
      body = slice.subarray(0, Math.min(slice.length, 4096)).toString("base64");
    } else {
      body = slice.toString("utf8");
    }

    return {
      url: res.url || url.toString(),
      status: res.status,
      ok: res.ok,
      headers: headerOut,
      encoding,
      body,
      bytes: buf.length,
      truncated,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`network_fetch timeout after ${timeoutMs}ms`);
    }
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    clearTimeout(timer);
  }
}

function hfqMemoryDir(): string {
  const override = process.env.HFQ_DATA_DIR?.trim();
  if (override) return path.join(path.resolve(override), "memory");
  if (process.platform === "win32") {
    const base = process.env.APPDATA ?? path.join(process.env.USERPROFILE || "", "AppData", "Roaming");
    return path.join(base, "HFQ-Code", "memory");
  }
  return path.join(process.env.HOME || process.env.USERPROFILE || ".", ".config", "hfq-code", "memory");
}

async function getScopedBrain(workspaceRoot: string) {
  const { createScopedMemory } = await import("@hfq/memory");
  return createScopedMemory({
    rootDir: hfqMemoryDir(),
    workspacePath: workspaceRoot || undefined,
  });
}

async function memorySearchTool(workspaceRoot: string, input: Record<string, unknown>) {
  const query = String(input.query ?? "").trim();
  if (!query) throw new Error("query required");
  const limit = Math.min(Math.max(Number(input.limit ?? 8) || 8, 1), 30);
  const scopeRaw = String(input.scope ?? "all").toLowerCase();
  const scope =
    scopeRaw === "user" || scopeRaw === "project" || scopeRaw === "all" ? scopeRaw : "all";
  const brain = await getScopedBrain(workspaceRoot);
  const hits = await brain.search(query, limit, { scope });
  return { query, scope, hits, count: hits.length };
}

async function memorySaveTool(workspaceRoot: string, input: Record<string, unknown>) {
  const text = String(input.text ?? "").trim();
  if (!text) throw new Error("text required");
  const scopeRaw = String(input.scope ?? "project").toLowerCase();
  const scope = scopeRaw === "user" ? "user" : "project";
  const tags = Array.isArray(input.tags)
    ? input.tags.map((t) => String(t ?? "").trim()).filter(Boolean).slice(0, 24)
    : undefined;
  const links = Array.isArray(input.links)
    ? input.links.map((l) => String(l ?? "").trim()).filter(Boolean).slice(0, 32)
    : undefined;
  const brain = await getScopedBrain(workspaceRoot);
  const id = await brain.upsert({
    id: input.id != null ? String(input.id) : undefined,
    text,
    source: input.source != null ? String(input.source) : "agent",
    scope,
    pinned: Boolean(input.pinned),
    tags,
    links,
  });
  return { id, saved: true, scope, tags, links, updatedAt: new Date().toISOString() };
}

async function gitDiffTool(workspaceRoot: string, input: Record<string, unknown>) {
  return gitDiff(workspaceRoot, input);
}

async function gitShowTool(workspaceRoot: string, input: Record<string, unknown>) {
  return gitShow(workspaceRoot, input);
}

async function gitCommitTool(workspaceRoot: string, input: Record<string, unknown>) {
  return gitCommit(workspaceRoot, input);
}

async function spawnSubagentTool(_workspaceRoot: string, _input: Record<string, unknown>) {
  // Handled by AgentSession when onSpawnSubagent is wired; hub may still list the def.
  throw new Error("spawn_subagent must be executed by the agent runtime, not the tool hub alone");
}

export const builtinHandlers: Record<string, ToolHandler> = {
  read_file: readFileTool,
  read_document: readDocumentTool,
  list_dir: listDirTool,
  write_file: writeFileTool,
  grep: grepTool,
  apply_patch: applyPatchTool,
  shell: shellTool,
  network_fetch: networkFetchTool,
  git_status: gitStatusTool,
  git_diff: gitDiffTool,
  git_show: gitShowTool,
  git_commit: gitCommitTool,
  memory_search: memorySearchTool,
  memory_save: memorySaveTool,
  spawn_subagent: spawnSubagentTool,
};
