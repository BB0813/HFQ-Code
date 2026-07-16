import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app-store";

export function PermissionDialog() {
  const permission = useAppStore((s) => s.permission);
  const resolvePermission = useAppStore((s) => s.resolvePermission);

  const open = !!permission?.requestId;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && void resolvePermission(false)}>
      <DialogContent className="max-w-md gap-3 border-border/80 bg-[hsl(240_8%_6%)] p-4 shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[13px]">权限请求</DialogTitle>
              <DialogDescription className="mt-0.5">
                {permission?.toolName
                  ? `工具：${permission.toolName}`
                  : "Agent 请求执行操作"}
              </DialogDescription>
            </div>
            {permission?.toolName && (
              <Badge variant="outline" className="shrink-0 font-mono font-normal">
                {permission.toolName}
              </Badge>
            )}
          </div>
        </DialogHeader>
        <div className="selectable max-h-52 overflow-auto rounded-lg border border-border/70 bg-black/30 p-2.5 text-xs leading-relaxed">
          <p className="whitespace-pre-wrap text-foreground/90">
            {permission?.description || "需要你确认是否允许本次工具调用。"}
          </p>
          {permission?.risk && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              风险等级：{String(permission.risk)}
            </p>
          )}
          {permission?.args != null && (
            <pre className="mt-2 overflow-auto rounded-md border border-white/[0.04] bg-black/40 p-2 font-mono text-xs text-muted-foreground">
              {typeof permission.args === "string"
                ? permission.args
                : JSON.stringify(permission.args, null, 2)}
            </pre>
          )}
        </div>
        <DialogFooter className="gap-1.5 sm:gap-1.5">
          <Button
            variant="outline"
            size="sm"
           
            onClick={() => void resolvePermission(false)}
          >
            拒绝
          </Button>
          <Button
            variant="secondary"
            size="sm"
           
            onClick={() => void resolvePermission(true, true)}
            title="本会话内同类操作自动允许 (allow_session)"
          >
            本会话允许
          </Button>
          <Button size="sm" onClick={() => void resolvePermission(true)}>
            允许一次
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
