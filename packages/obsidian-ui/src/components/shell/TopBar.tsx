import type { ReactNode } from "react";
import { IconBell, IconChev, IconSearch, IconSpark } from "@/icons";
import { IconButton } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";

export function TopBar({
  workspace = "Project Beta",
  userInitials = "BP",
  userName = "Binbim",
  onCommandSearch,
  onAi,
  onNotifications,
  notificationDot,
  className,
}: {
  workspace?: string;
  userInitials?: string;
  userName?: string;
  onCommandSearch?: () => void;
  onAi?: () => void;
  onNotifications?: () => void;
  notificationDot?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "grid h-topbar select-none grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-hfq-border bg-gradient-to-b from-[#0f141c] to-hfq-bg-secondary px-3 pl-3.5",
        className,
      )}
    >
      <div className="flex min-w-[168px] items-center gap-2.5">
        <div className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-gradient-to-br from-hfq-brand-cyan to-cyan-700 text-[12px] font-extrabold tracking-tight text-[var(--hfq-cyan-ink)] shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_6px_16px_rgba(34,211,238,0.18)]">
          H
        </div>
        <div className="flex flex-col leading-tight">
          <strong className="text-[13px] font-semibold tracking-tight">HFQ Code</strong>
          <span className="text-[10px] uppercase tracking-[0.04em] text-hfq-text-disabled">
            v1.0 Obsidian
          </span>
        </div>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-2 rounded-md border border-hfq-border bg-hfq-bg-surface px-2.5 text-hfq-text-secondary transition-colors hover:border-hfq-border-strong hover:bg-hfq-bg-elevated"
          title="Workspace"
        >
          <span className="h-[7px] w-[7px] rounded-full bg-hfq-success shadow-[0_0_0_3px_var(--hfq-success-soft)]" />
          <span className="text-[13px]">{workspace}</span>
          <IconChev size={14} className="text-hfq-text-disabled" />
        </button>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onCommandSearch}
          className="flex h-[34px] w-[min(440px,100%)] items-center gap-2 rounded-[9px] border border-hfq-border bg-black/30 px-3 text-hfq-text-muted transition-colors hover:border-[rgba(34,211,238,0.35)] hover:bg-black/40 hover:text-hfq-text-secondary"
          title="Command palette"
        >
          <IconSearch size={14} />
          <span className="text-[13px]">Search files, commands, AI…</span>
          <kbd className="ml-auto rounded-[5px] border border-hfq-border bg-hfq-bg-surface px-1.5 py-0.5 font-mono text-[10px] text-hfq-text-disabled">
            Ctrl K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <IconButton ai onClick={onAi} title="AI Agent">
          <IconSpark size={16} />
        </IconButton>
        <IconButton badge={notificationDot} onClick={onNotifications} title="Notifications">
          <IconBell size={16} />
        </IconButton>
        <Avatar initials={userInitials} title={userName} className="ml-1" />
        <WindowControls />
      </div>
    </header>
  );
}

export function WindowControls() {
  return (
    <div className="ml-2 flex items-center gap-0.5 border-l border-hfq-border pl-2">
      <WinBtn title="Minimize">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M1 5h8" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </WinBtn>
      <WinBtn title="Maximize">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </WinBtn>
      <WinBtn title="Close" danger>
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </WinBtn>
    </div>
  );
}

function WinBtn({
  children,
  title,
  danger,
}: {
  children: ReactNode;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      className={cn(
        "grid h-7 w-9 place-items-center rounded-md text-hfq-text-muted hover:bg-hfq-bg-elevated hover:text-hfq-text-primary",
        danger && "hover:bg-rose-600 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
