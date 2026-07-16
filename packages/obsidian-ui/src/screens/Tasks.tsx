import { AITaskCard } from "@/components/ai";
import { PageHeader } from "@/components/shell/DesktopWindow";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Timeline, TimelineItem } from "@/components/ui/Timeline";
import { ProgressBar } from "@/components/ui/Progress";

export function TasksScreen() {
  return (
    <div>
      <PageHeader
        title="Autonomous Tasks"
        description="Queue, progress, and execution timeline"
      />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <AITaskCard
            title="Optimize database queries"
            step={2}
            total={4}
            state="executing"
            detail="Analyzing N+1 paths in session-api"
          />
          <AITaskCard
            title="Skill package validation"
            step={4}
            total={4}
            state="completed"
            detail="All remote skill packages checksum OK"
          />
          <AITaskCard
            title="Generate release notes 1.0.10"
            step={0}
            total={3}
            state="idle"
            detail="Queued behind optimize-db"
          />
        </div>
        <Card>
          <SectionTitle>Execution timeline</SectionTitle>
          <Timeline>
            <TimelineItem tone="ok" title="Task claimed" meta="optimize-db · 00:00" />
            <TimelineItem tone="cyan" title="Indexed SQL call sites" meta="step 1/4 · 00:42" />
            <TimelineItem tone="violet" title="Drafting rewrite plan" meta="step 2/4 · live" />
            <TimelineItem title="Write patches + tests" meta="pending" />
          </Timeline>
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-[11px] text-hfq-text-disabled">
              <span>Queue throughput</span>
              <span>50%</span>
            </div>
            <ProgressBar value={50} tone="cyan" />
          </div>
        </Card>
      </div>
    </div>
  );
}
