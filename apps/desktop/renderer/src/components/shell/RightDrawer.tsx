import { X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useUiStore, type DrawerTab } from "@/store/ui-store";
import { ChangesPanel } from "@/features/changes/ChangesPanel";
import { TerminalPanel } from "@/features/terminal/TerminalPanel";
import { TasksPanel } from "@/features/tasks/TasksPanel";

const TAB_LABEL: Record<DrawerTab, string> = {
  changes: "改动",
  terminal: "终端",
  tasks: "任务",
};

export function RightDrawer() {
  const open = useUiStore((s) => s.drawerOpen);
  const tab = useUiStore((s) => s.drawerTab);
  const drawerWidth = useUiStore((s) => s.drawerWidth);
  const setDrawerTab = useUiStore((s) => s.setDrawerTab);
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen);

  if (!open) return null;

  return (
    <aside
      className="dock-pane dock-split flex shrink-0 flex-col border-l"
      style={{ width: drawerWidth }}
    >
      <Tabs
        value={tab}
        onValueChange={(v) => setDrawerTab(v as DrawerTab)}
        className="flex h-full flex-col"
      >
        <div className="dock-pane-header gap-2">
          <TabsList className="grid h-9 flex-1 grid-cols-3 rounded-lg bg-white/[0.04] p-0.5">
            {(Object.keys(TAB_LABEL) as DrawerTab[]).map((id) => (
              <TabsTrigger
                key={id}
                value={id}
                className="cursor-pointer rounded-md text-sm data-[state=active]:bg-workbench/15 data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:ring-1 data-[state=active]:ring-workbench/30"
              >
                {TAB_LABEL[id]}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button
            size="icon-sm"
            variant="ghost"
            className="shrink-0"
            title="关闭面板 (Ctrl+J)"
            aria-label="关闭检视面板"
            onClick={() => setDrawerOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <TabsContent
          value="changes"
          className="m-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
        >
          <ChangesPanel compact />
        </TabsContent>
        <TabsContent
          value="terminal"
          className="m-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
        >
          <TerminalPanel />
        </TabsContent>
        <TabsContent
          value="tasks"
          className="m-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
        >
          <TasksPanel compact />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
