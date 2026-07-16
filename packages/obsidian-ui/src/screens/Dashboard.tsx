import { AICommandBar } from "@/components/ai";
import { Badge } from "@/components/ui/Badge";
import { Card, ListRow, ProjectCard, SectionTitle } from "@/components/ui/Card";
import { Timeline, TimelineItem } from "@/components/ui/Timeline";
import { IconBot, IconReview, IconTasks } from "@/icons";
import type { NavId } from "@/components/shell/Sidebar";

export function DashboardScreen({ onNavigate }: { onNavigate: (id: NavId) => void }) {
  return (
    <div>
      <div className="mb-[18px]">
        <h1 className="m-0 text-h1 tracking-tight">Good evening, Developer</h1>
        <p className="mt-1.5 text-hfq-text-muted">
          Project Beta is healthy. 3 AI suggestions ready · last deploy 14m ago
        </p>
      </div>

      <AICommandBar onRunAgent={() => onNavigate("agent")} onSubmit={() => onNavigate("chat")} />

      <div className="mb-4 grid grid-cols-3 gap-3.5">
        <ProjectCard
          title="Project Beta"
          path="D:\work\project-beta"
          status="Running"
          statusTone="ok"
          running
          metrics={[
            { label: "Build", value: "98%", sub: "1.4s" },
            { label: "Tests", value: "245", sub: "passed" },
            { label: "AI", value: "12", sub: "suggestions" },
          ]}
        />
        <ProjectCard
          title="HFQ Core"
          path="packages/agent-core"
          status="Synced"
          statusTone="cyan"
          metrics={[
            { label: "Coverage", value: "87%", sub: "+2.1%" },
            { label: "Open PR", value: "4", sub: "review" },
            { label: "Tasks", value: "2", sub: "active" },
          ]}
        />
        <ProjectCard
          title="Desktop Shell"
          path="apps/desktop"
          status="Dirty"
          statusTone="warn"
          metrics={[
            { label: "Changes", value: "18", sub: "files" },
            { label: "Branch", value: "main", sub: "ahead 2" },
            { label: "Lint", value: "0", sub: "errors" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <Card>
          <SectionTitle>Recent activity</SectionTitle>
          <Timeline>
            <TimelineItem
              tone="violet"
              title="AI refactored authentication"
              meta="Agent · auth/session.ts · 12 min ago"
            />
            <TimelineItem
              tone="ok"
              title="Fixed API rate-limit issue"
              meta="You · providers/http.ts · 41 min ago"
            />
            <TimelineItem
              title="Created unit tests for policy engine"
              meta="Agent · packages/policy · 2h ago"
            />
            <TimelineItem
              tone="ok"
              title="Deploy preview ready"
              meta="CI · release:check green · 3h ago"
            />
          </Timeline>
        </Card>

        <Card>
          <SectionTitle>Resume work</SectionTitle>
          <ListRow
            onClick={() => onNavigate("agent")}
            icon={<IconBot size={16} className="text-hfq-brand-purple" />}
            title="Harden login flow"
            subtitle="Agent mid-plan · 3 file changes pending"
            trailing={<Badge tone="violet">Planning</Badge>}
          />
          <ListRow
            onClick={() => onNavigate("review")}
            icon={<IconReview size={16} className="text-hfq-brand-cyan" />}
            title="PR #184 review"
            subtitle="AI found 3 potential improvements"
            trailing={<Badge tone="cyan">Review</Badge>}
          />
          <ListRow
            onClick={() => onNavigate("tasks")}
            icon={<IconTasks size={16} className="text-hfq-success" />}
            title="Optimize database queries"
            subtitle="Autonomous task · executing step 2/4"
            trailing={<Badge tone="ok">Live</Badge>}
          />
        </Card>
      </div>
    </div>
  );
}
