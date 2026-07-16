import { useState } from "react";
import { PageHeader } from "@/components/shell/DesktopWindow";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { SegmentControl, Switch } from "@/components/ui/Switch";
import { AIModelSelector } from "@/components/ai";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const SECTIONS = ["General", "Theme", "AI", "Editor", "Terminal", "Updates"] as const;

export function SettingsScreen() {
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("General");
  const [theme, setTheme] = useState<"obsidian" | "midnight" | "contrast">("obsidian");
  const [telemetry, setTelemetry] = useState(false);
  const [model, setModel] = useState("gpt-4.1-mini");

  return (
    <div>
      <PageHeader title="Settings" description="Preferences for HFQ Code desktop" />
      <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-4">
        <Card className="h-fit space-y-0.5 p-2">
          {SECTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSection(s)}
              className={cn(
                "flex h-9 w-full items-center rounded-md px-2.5 text-left text-[13px]",
                section === s
                  ? "bg-[rgba(34,211,238,0.1)] text-hfq-brand-cyan"
                  : "text-hfq-text-muted hover:bg-hfq-bg-surface",
              )}
            >
              {s}
            </button>
          ))}
        </Card>
        <Card className="space-y-5">
          {section === "General" && (
            <>
              <SectionTitle>General</SectionTitle>
              <Field label="Display name" help="Shown in title bar avatar tooltip">
                <Input defaultValue="Binbim" />
              </Field>
              <Switch checked={telemetry} onChange={setTelemetry} label="Share anonymous diagnostics" />
            </>
          )}
          {section === "Theme" && (
            <>
              <SectionTitle>Theme</SectionTitle>
              <SegmentControl
                value={theme}
                onChange={setTheme}
                options={[
                  { value: "obsidian", label: "Obsidian" },
                  { value: "midnight", label: "Midnight" },
                  { value: "contrast", label: "High contrast" },
                ]}
              />
            </>
          )}
          {section === "AI" && (
            <>
              <SectionTitle>AI</SectionTitle>
              <Field label="Default model">
                <AIModelSelector
                  models={["gpt-4.1-mini", "gpt-4.1", "claude-sonnet"]}
                  value={model}
                  onChange={setModel}
                />
              </Field>
              <Field label="API key" help="Stored locally · never committed">
                <Input type="password" placeholder="sk-…" />
              </Field>
            </>
          )}
          {(section === "Editor" || section === "Terminal" || section === "Updates") && (
            <>
              <SectionTitle>{section}</SectionTitle>
              <p className="text-[13px] text-hfq-text-muted">
                Preference rows for {section.toLowerCase()} mirror the Electron settings panels.
              </p>
              <Switch checked label={`Enable ${section.toLowerCase()} integrations`} />
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm">
              Reset
            </Button>
            <Button variant="primary" size="sm">
              Save
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
