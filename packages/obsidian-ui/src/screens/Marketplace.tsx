import { PageHeader } from "@/components/shell/DesktopWindow";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Input";
import { Tag } from "@/components/ui/Badge";

const PLUGINS = [
  {
    name: "Skill Pack: Frontend",
    desc: "React, Tailwind, and design-system agent skills.",
    version: "1.2.0",
    rating: "4.9",
    category: "Skills",
  },
  {
    name: "Git Timeline",
    desc: "Visual commit graph and conflict resolver.",
    version: "0.8.1",
    rating: "4.6",
    category: "Devtools",
  },
  {
    name: "PTY Terminal Plus",
    desc: "Multi-tab terminal with process status chips.",
    version: "1.0.0",
    rating: "4.8",
    category: "Terminal",
  },
  {
    name: "Policy Guard",
    desc: "Workspace path escape denial + approval UX.",
    version: "1.0.3",
    rating: "4.7",
    category: "Security",
  },
];

export function MarketplaceScreen() {
  return (
    <div>
      <PageHeader
        title="Marketplace"
        description="Plugins, skills, and extensions for HFQ Code"
        actions={<SearchInput className="w-64" placeholder="Search marketplace…" />}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {["All", "Skills", "Devtools", "Terminal", "Security"].map((c) => (
          <Tag key={c} className={c === "All" ? "border-hfq-brand-cyan text-hfq-brand-cyan" : ""}>
            {c}
          </Tag>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        {PLUGINS.map((p) => (
          <Card key={p.name} elevated className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="m-0 text-[15px] font-semibold">{p.name}</h3>
                <p className="mt-1 text-[12px] text-hfq-text-muted">{p.desc}</p>
              </div>
              <Badge tone="cyan">v{p.version}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] text-hfq-text-disabled">
                <Tag>{p.category}</Tag>
                <span>★ {p.rating}</span>
              </div>
              <Button variant="primary" size="sm">
                Install
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
