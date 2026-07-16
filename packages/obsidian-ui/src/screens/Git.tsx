import { BranchSelector, ChangeFile, CommitCard, PullRequestCard } from "@/components/git";
import { PageHeader } from "@/components/shell/DesktopWindow";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AIDiffViewer } from "@/components/ai";

export function GitScreen() {
  return (
    <div>
      <PageHeader
        title="Git Center"
        description="Branches, commits, and working tree"
        actions={
          <>
            <BranchSelector branch="main" branches={["main", "feat/pty", "release/1.0.10"]} />
            <Button variant="primary" size="sm">
              Commit
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-[1fr_1fr] gap-4">
        <Card>
          <SectionTitle>Changes</SectionTitle>
          <ChangeFile path="apps/desktop/renderer/app.js" status="M" />
          <ChangeFile path="packages/agent-core/src/loop.ts" status="M" />
          <ChangeFile path="packages/obsidian-ui/src/styles.css" status="A" />
          <ChangeFile path="docs/UI-REDESIGN.md" status="M" />
        </Card>
        <div className="space-y-3">
          <CommitCard
            hash="8bb6649"
            message="release: HFQ Code 1.0.9 remote skill packages"
            author="Binbim_ProMax"
            time="2h ago"
          />
          <PullRequestCard
            number={184}
            title="UI architecture migration R1"
            author="Binbim"
            status="open"
          />
        </div>
      </div>
      <div className="mt-4">
        <AIDiffViewer
          file="packages/agent-core/src/loop.ts"
          lines={[
            { type: "ctx", text: "if (tool.needsApproval) {" },
            { type: "add", text: "  const decision = await policy.evaluate(tool);" },
            { type: "add", text: "  if (decision === 'deny') return deny(tool);" },
            { type: "ctx", text: "  await requestPermission(tool);" },
            { type: "ctx", text: "}" },
          ]}
        />
      </div>
    </div>
  );
}
