import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export function BranchSelector({
  branch,
  branches,
  onChange,
}: {
  branch: string;
  branches: string[];
  onChange?: (b: string) => void;
}) {
  return (
    <select
      value={branch}
      onChange={(e) => onChange?.(e.target.value)}
      className="h-9 rounded-md border border-hfq-border bg-hfq-bg-surface px-2.5 font-mono text-[12px] text-hfq-text-secondary outline-none"
    >
      {branches.map((b) => (
        <option key={b} value={b}>
          {b}
        </option>
      ))}
    </select>
  );
}

export function CommitCard({
  hash,
  message,
  author,
  time,
}: {
  hash: string;
  message: string;
  author: string;
  time: string;
}) {
  return (
    <Card className="py-3">
      <div className="flex items-start gap-3">
        <span className="font-mono text-[11px] text-hfq-brand-cyan">{hash}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold">{message}</div>
          <div className="mt-1 text-[11px] text-hfq-text-muted">
            {author} · {time}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ChangeFile({
  path,
  status,
}: {
  path: string;
  status: "M" | "A" | "D" | "R" | "?";
}) {
  const tone =
    status === "A" ? "ok" : status === "D" ? "danger" : status === "M" ? "warn" : "cyan";
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-hfq-bg-surface">
      <Badge tone={tone as "ok"} className="w-6 justify-center px-0 font-mono">
        {status}
      </Badge>
      <span className="truncate font-mono text-[12px] text-hfq-text-secondary">{path}</span>
    </div>
  );
}

export function PullRequestCard({
  number,
  title,
  author,
  status,
}: {
  number: number;
  title: string;
  author: string;
  status: "open" | "draft" | "merged";
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold">
            <span className="mr-2 font-mono text-hfq-text-disabled">#{number}</span>
            {title}
          </div>
          <div className="mt-1 text-[12px] text-hfq-text-muted">{author}</div>
        </div>
        <Badge
          tone={status === "open" ? "ok" : status === "merged" ? "violet" : "default"}
        >
          {status}
        </Badge>
      </div>
    </Card>
  );
}

export function DiffPanel({
  file,
  additions,
  deletions,
  className,
}: {
  file: string;
  additions: number;
  deletions: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-hfq-border bg-hfq-bg-secondary p-3", className)}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[12px] text-hfq-text-secondary">{file}</span>
        <span className="font-mono text-[11px]">
          <span className="text-hfq-success">+{additions}</span>{" "}
          <span className="text-hfq-error">-{deletions}</span>
        </span>
      </div>
    </div>
  );
}
