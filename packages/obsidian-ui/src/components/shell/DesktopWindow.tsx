import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type WindowVariant = "normal" | "maximized" | "floating";

export function DesktopStage({ children }: { children: ReactNode }) {
  return (
    <div className="hfq-stage-bg grid min-h-screen place-items-center p-6">
      {children}
    </div>
  );
}

export function DesktopWindow({
  variant = "normal",
  children,
  className,
}: {
  variant?: WindowVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="application"
      aria-label="HFQ Code desktop"
      className={cn(
        "grid overflow-hidden border border-[var(--hfq-line-2)] bg-hfq-bg-primary shadow-float",
        "grid-rows-[var(--hfq-topbar-h)_1fr_var(--hfq-statusbar-h)]",
        variant === "normal" &&
          "h-[min(900px,calc(100vh-48px))] w-[min(1440px,100%)] rounded-lg",
        variant === "maximized" && "h-screen w-screen rounded-none",
        variant === "floating" &&
          "h-[min(820px,calc(100vh-80px))] w-[min(1280px,100%)] rounded-xl shadow-[0_32px_80px_rgba(0,0,0,0.65)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function WindowBody({
  children,
  sidebarCollapsed,
}: {
  children: ReactNode;
  sidebarCollapsed?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid min-h-0 bg-hfq-bg-primary",
        sidebarCollapsed
          ? "grid-cols-[56px_minmax(0,1fr)]"
          : "grid-cols-[var(--hfq-sidebar-w)_minmax(0,1fr)]",
      )}
    >
      {children}
    </div>
  );
}

export function MainPane({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-0 min-w-0 overflow-hidden bg-hfq-bg-primary">
      {children}
    </main>
  );
}

export function Page({
  active,
  children,
  pad = true,
}: {
  active?: boolean;
  children: ReactNode;
  pad?: boolean;
}) {
  if (!active) return null;
  return (
    <section
      className={cn(
        "flex h-full min-h-0 animate-hfq-fade-in flex-col overflow-auto",
        pad && "px-6 pb-7 pt-5",
      )}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-[18px] flex items-start justify-between gap-4">
      <div>
        <h1 className="m-0 text-h2 tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-[13px] text-hfq-text-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
