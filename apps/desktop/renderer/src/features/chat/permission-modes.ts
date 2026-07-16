export type PermissionModeId =
  | "confirm_before_change"
  | "auto_edit"
  | "plan"
  | "full_access";

export interface PermissionModeMeta {
  id: PermissionModeId;
  label: string;
  short: string;
  hint: string;
  warn?: boolean;
}

/** Mirrors legacy PERMISSION_MODES + main.cjs MODES. */
export const PERMISSION_MODES: PermissionModeMeta[] = [
  {
    id: "confirm_before_change",
    label: "变更前确认",
    short: "确认",
    hint: "写入、补丁、Shell、网络等变更前询问",
  },
  {
    id: "auto_edit",
    label: "自动编辑",
    short: "自动编辑",
    hint: "自动允许写文件/补丁；Shell 与网络仍询问",
  },
  {
    id: "plan",
    label: "计划模式",
    short: "计划",
    hint: "只读规划；禁止写文件、补丁与 Shell",
  },
  {
    id: "full_access",
    label: "完全访问",
    short: "完全访问",
    hint: "全部放行（含危险 Shell）· 真·YOLO",
    warn: true,
  },
];

export function normalizePermissionMode(raw: unknown): PermissionModeId {
  const id = String(raw ?? "").trim();
  if (PERMISSION_MODES.some((m) => m.id === id)) return id as PermissionModeId;
  return "confirm_before_change";
}

export function permissionModeMeta(mode: unknown): PermissionModeMeta {
  const id = normalizePermissionMode(mode);
  return PERMISSION_MODES.find((m) => m.id === id) ?? PERMISSION_MODES[0];
}
