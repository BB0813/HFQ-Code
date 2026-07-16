import { useState } from "react";
import { PageHeader } from "@/components/shell/DesktopWindow";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge, Tag } from "@/components/ui/Badge";
import { Card, MetricCard, SectionTitle } from "@/components/ui/Card";
import { Field, Input, SearchInput, Textarea } from "@/components/ui/Input";
import { Checkbox, SegmentControl, Switch } from "@/components/ui/Switch";
import { ProgressBar, Skeleton } from "@/components/ui/Progress";
import { colors, spacing, radius, typography } from "@/tokens";
import { IconSpark } from "@/icons";

export function DesignSystemScreen() {
  const [seg, setSeg] = useState<"a" | "b" | "c">("a");
  const [on, setOn] = useState(true);

  return (
    <div>
      <PageHeader
        title="Obsidian Intelligence System"
        description="Tokens · primitives · AI components — production handoff"
      />

      <SectionTitle>Colors</SectionTitle>
      <div className="mb-6 grid grid-cols-5 gap-2">
        {Object.entries(colors.background).map(([k, v]) => (
          <Swatch key={k} name={`bg.${k}`} hex={v} />
        ))}
        {Object.entries(colors.brand).map(([k, v]) => (
          <Swatch key={k} name={`brand.${k}`} hex={v} />
        ))}
        {Object.entries(colors.status).map(([k, v]) => (
          <Swatch key={k} name={k} hex={v} />
        ))}
      </div>

      <SectionTitle>Typography</SectionTitle>
      <Card className="mb-6 space-y-2">
        <div className="text-display">Display 32 / 700</div>
        <div className="text-h1">H1 24 / 700</div>
        <div className="text-h2">H2 20 / 600</div>
        <div className="text-h3">H3 16 / 600</div>
        <div className="text-body">Body 14 / 400 — Inter</div>
        <div className="text-small text-hfq-text-muted">Small 12 / 400</div>
        <div className="font-mono text-code text-hfq-brand-cyan">Code 13 Mono — JetBrains Mono</div>
        <div className="text-[11px] text-hfq-text-disabled">{typography.fontFamily.sans}</div>
      </Card>

      <SectionTitle>Spacing · Radius</SectionTitle>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        {Object.entries(spacing).map(([k, v]) => (
          <div key={k} className="text-center">
            <div className="bg-hfq-brand-cyan/40" style={{ width: v, height: v }} />
            <div className="mt-1 font-mono text-[10px] text-hfq-text-disabled">{k}</div>
          </div>
        ))}
        {Object.entries(radius).map(([k, v]) => (
          <div
            key={k}
            className="grid h-12 w-12 place-items-center border border-hfq-border bg-hfq-bg-surface font-mono text-[10px] text-hfq-text-muted"
            style={{ borderRadius: v }}
          >
            {k}
          </div>
        ))}
      </div>

      <SectionTitle>Buttons</SectionTitle>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="ai" leftIcon={<IconSpark size={14} />}>
          AI
        </Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
        <IconButton ai>
          <IconSpark size={16} />
        </IconButton>
      </div>

      <SectionTitle>Inputs · Controls</SectionTitle>
      <div className="mb-6 grid grid-cols-2 gap-4">
        <Field label="Text input">
          <Input placeholder="Workspace path" />
        </Field>
        <Field label="Search">
          <SearchInput />
        </Field>
        <Field label="Textarea">
          <Textarea placeholder="Notes…" />
        </Field>
        <div className="space-y-3">
          <Switch checked={on} onChange={setOn} label="Agent auto-run" />
          <Checkbox checked label="Remember choice" />
          <SegmentControl
            value={seg}
            onChange={setSeg}
            options={[
              { value: "a", label: "Default" },
              { value: "b", label: "Focus" },
              { value: "c", label: "Error" },
            ]}
          />
          <ProgressBar value={72} />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>

      <SectionTitle>Badges · Metrics</SectionTitle>
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge>Default</Badge>
        <Badge tone="ok">Success</Badge>
        <Badge tone="warn">Warning</Badge>
        <Badge tone="cyan">Cyan</Badge>
        <Badge tone="violet">Violet</Badge>
        <Badge tone="danger">Error</Badge>
        <Tag>skill</Tag>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Components" value="100+" sub="catalog" />
        <MetricCard label="Screens" value="15" sub="templates" />
        <MetricCard label="Tokens" value="48" sub="CSS vars" />
        <MetricCard label="Desktop" value="1440" sub="×900" />
      </div>
    </div>
  );
}

function Swatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-hfq-border">
      <div className="h-12" style={{ background: hex }} />
      <div className="bg-hfq-bg-secondary px-2 py-1.5">
        <div className="truncate text-[11px] text-hfq-text-secondary">{name}</div>
        <div className="font-mono text-[10px] text-hfq-text-disabled">{hex}</div>
      </div>
    </div>
  );
}
