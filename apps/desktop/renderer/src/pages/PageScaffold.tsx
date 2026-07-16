import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function PageScaffold({
  title,
  description,
  actions,
  children,
  className,
  scroll = true,
  /** When true, skip the in-page title block (shell header already shows it). */
  hideTitle = false,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  scroll?: boolean;
  hideTitle?: boolean;
}) {
  const body = (
    <div className={cn("mx-auto max-w-5xl px-6 py-5", className)}>
      {!hideTitle ? (
        <div className="mb-5 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold tracking-tight">{title}</h1>
            {description && (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-balance">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      ) : (
        (description || actions) && (
          <div className="mb-4 flex items-center gap-3">
            {description && (
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground text-balance">
                {description}
              </p>
            )}
            {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        )
      )}
      {children}
    </div>
  );

  if (!scroll) return <div className="h-full overflow-hidden">{body}</div>;
  return <ScrollArea className="h-full">{body}</ScrollArea>;
}
