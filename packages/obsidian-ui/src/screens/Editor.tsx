import { useState } from "react";
import {
  Breadcrumb,
  CodeBlock,
  EditorTabs,
  FileTree,
  type FileNode,
} from "@/components/editor";
import { TerminalWindow } from "@/components/terminal";

const TREE: FileNode[] = [
  {
    id: "apps",
    name: "apps",
    type: "folder",
    children: [
      {
        id: "desktop",
        name: "desktop",
        type: "folder",
        children: [
          { id: "app-js", name: "app.js", type: "file" },
          { id: "main-cjs", name: "main.cjs", type: "file" },
        ],
      },
    ],
  },
  {
    id: "packages",
    name: "packages",
    type: "folder",
    children: [
      { id: "agent-core", name: "agent-core", type: "folder", children: [
        { id: "loop-ts", name: "loop.ts", type: "file" },
        { id: "history-ts", name: "history.ts", type: "file" },
      ]},
    ],
  },
];

const CODE = `export async function runAgentLoop(ctx: AgentContext) {
  for (const step of ctx.plan) {
    const result = await executeTool(step);
    if (result.kind === "deny") break;
    await appendHistory(ctx.sessionId, result);
  }
  return ctx.history;
}`;

export function EditorScreen() {
  const [tab, setTab] = useState("loop-ts");
  const [file, setFile] = useState("loop-ts");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)]">
        <div className="overflow-auto border-r border-hfq-border bg-hfq-bg-secondary">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-hfq-text-disabled">
            Explorer
          </div>
          <FileTree items={TREE} activeId={file} onSelect={setFile} />
        </div>
        <div className="flex min-h-0 min-w-0 flex-col">
          <EditorTabs
            tabs={[
              { id: "loop-ts", name: "loop.ts", dirty: true },
              { id: "history-ts", name: "history.ts" },
              { id: "app-js", name: "app.js" },
            ]}
            activeId={tab}
            onSelect={setTab}
          />
          <Breadcrumb parts={["packages", "agent-core", "src", "loop.ts"]} />
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <CodeBlock code={CODE} language="typescript" />
          </div>
          <div className="h-[200px] border-t border-hfq-border">
            <TerminalWindow
              state="success"
              lines={[
                { kind: "cmd", text: "pnpm test packages/agent-core" },
                { kind: "out", text: " ✓ loop.spec.ts (12)" },
                { kind: "out", text: " ✓ history.spec.ts (8)" },
                { kind: "out", text: "Tests  20 passed (20)" },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
