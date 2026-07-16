import { create } from "zustand";
import { asList, getHfq, hasHfq, type AvailableShell, type PtySessionInfo } from "@/lib/hfq";

interface TerminalState {
  shells: AvailableShell[];
  preferred: string;
  sessions: PtySessionInfo[];
  activeId: string | null;
  bootstrapped: boolean;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  create: (opts?: { shell?: string; label?: string }) => Promise<PtySessionInfo | null>;
  kill: (id: string) => Promise<void>;
  setActive: (id: string | null) => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  shells: [],
  preferred: "",
  sessions: [],
  activeId: null,
  bootstrapped: false,

  bootstrap: async () => {
    if (!hasHfq() || get().bootstrapped) return;
    const hfq = getHfq();
    try {
      const shellsRes = await hfq.ptyShells();
      set({
        shells: shellsRes?.shells ?? [],
        preferred: shellsRes?.preferred ?? "",
        bootstrapped: true,
      });
    } catch {
      set({ bootstrapped: true });
    }
    await get().refresh();
  },

  refresh: async () => {
    if (!hasHfq()) return;
    const raw = await getHfq().ptyList();
    const sessions = asList<PtySessionInfo>(raw, ["sessions", "items"]);
    const { activeId } = get();
    set({
      sessions,
      activeId: activeId && sessions.some((s) => s.id === activeId) ? activeId : sessions[0]?.id ?? null,
    });
  },

  create: async (opts) => {
    if (!hasHfq()) return null;
    const info = await getHfq().ptyCreate({
      cols: 120,
      rows: 30,
      shell: opts?.shell ?? null,
      label: opts?.label,
    });
    await get().refresh();
    if (info?.id) set({ activeId: info.id });
    return info;
  },

  kill: async (id) => {
    if (!hasHfq()) return;
    await getHfq().ptyKill({ id });
    await get().refresh();
  },

  setActive: (id) => set({ activeId: id }),
}));
