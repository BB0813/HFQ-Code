import { useMemo, useState } from "react";
import {
  DesktopStage,
  DesktopWindow,
  MainPane,
  Page,
  WindowBody,
} from "@/components/shell/DesktopWindow";
import { TopBar } from "@/components/shell/TopBar";
import { Sidebar, StatusBar, type NavId } from "@/components/shell/Sidebar";
import { CommandPalette } from "@/components/overlay";
import { DashboardScreen } from "@/screens/Dashboard";
import { AgentScreen } from "@/screens/Agent";
import { ChatScreen } from "@/screens/Chat";
import { EditorScreen } from "@/screens/Editor";
import { TasksScreen } from "@/screens/Tasks";
import { GitScreen } from "@/screens/Git";
import { SettingsScreen } from "@/screens/Settings";
import { MarketplaceScreen } from "@/screens/Marketplace";
import { DesignSystemScreen } from "@/screens/DesignSystem";
import {
  AccountScreen,
  DebuggerScreen,
  NotificationsScreen,
  PluginsScreen,
  ProjectsScreen,
  ReposScreen,
  ReviewScreen,
  SearchScreen,
  TerminalScreen,
} from "@/screens/misc";

const COMMANDS: { id: NavId; label: string; hint?: string }[] = [
  { id: "dashboard", label: "Go to Dashboard", hint: "g d" },
  { id: "agent", label: "Open AI Agent", hint: "g a" },
  { id: "chat", label: "Open AI Chat", hint: "g c" },
  { id: "editor", label: "Open Editor", hint: "g e" },
  { id: "terminal", label: "Open Terminal", hint: "g t" },
  { id: "git", label: "Open Git Center", hint: "g g" },
  { id: "settings", label: "Open Settings", hint: "g ," },
  { id: "design", label: "Design System gallery", hint: "g s" },
  { id: "marketplace", label: "Marketplace", hint: "g m" },
];

export default function App() {
  const [nav, setNav] = useState<NavId>("dashboard");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(q));
  }, [query]);

  const navigate = (id: NavId) => {
    setNav(id);
    setPaletteOpen(false);
    setQuery("");
  };

  const padded = !["editor", "terminal"].includes(nav);

  return (
    <DesktopStage>
      <DesktopWindow variant="normal">
        <TopBar
          notificationDot
          onCommandSearch={() => setPaletteOpen(true)}
          onAi={() => navigate("agent")}
          onNotifications={() => navigate("notifications")}
        />
        <WindowBody>
          <Sidebar active={nav} onNavigate={navigate} />
          <MainPane>
            <Page active={nav === "dashboard"} pad={padded}>
              <DashboardScreen onNavigate={navigate} />
            </Page>
            <Page active={nav === "projects"}>
              <ProjectsScreen />
            </Page>
            <Page active={nav === "files"}>
              <ReposScreen />
            </Page>
            <Page active={nav === "agent"} pad>
              <AgentScreen />
            </Page>
            <Page active={nav === "chat"} pad>
              <ChatScreen />
            </Page>
            <Page active={nav === "review"}>
              <ReviewScreen />
            </Page>
            <Page active={nav === "tasks"}>
              <TasksScreen />
            </Page>
            <Page active={nav === "editor"} pad={false}>
              <EditorScreen />
            </Page>
            <Page active={nav === "terminal"} pad>
              <TerminalScreen />
            </Page>
            <Page active={nav === "git"}>
              <GitScreen />
            </Page>
            <Page active={nav === "debugger"}>
              <DebuggerScreen />
            </Page>
            <Page active={nav === "plugins"}>
              <PluginsScreen />
            </Page>
            <Page active={nav === "marketplace"}>
              <MarketplaceScreen />
            </Page>
            <Page active={nav === "design"}>
              <DesignSystemScreen />
            </Page>
            <Page active={nav === "settings"}>
              <SettingsScreen />
            </Page>
            <Page active={nav === "account"}>
              <AccountScreen />
            </Page>
            <Page active={nav === "search"}>
              <SearchScreen />
            </Page>
            <Page active={nav === "notifications"}>
              <NotificationsScreen />
            </Page>
          </MainPane>
        </WindowBody>
        <StatusBar
          items={[
            { label: "main", tone: "cyan" },
            { label: "0 errors", tone: "ok" },
            { label: nav },
            { label: "UTF-8" },
          ]}
        />
      </DesktopWindow>

      <CommandPalette
        open={paletteOpen}
        query={query}
        onQueryChange={setQuery}
        items={filtered}
        onSelect={(id) => navigate(id as NavId)}
        onClose={() => setPaletteOpen(false)}
      />
    </DesktopStage>
  );
}
