import type { SVGProps } from "react";
import { cn } from "@/lib/cn";

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(props: IconProps) {
  const { size = 16, className, ...rest } = props;
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    className: cn("shrink-0", className),
    ...rest,
  };
}

export function IconLayout(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

export function IconFolder(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
    </svg>
  );
}

export function IconGit(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <circle cx="6" cy="18" r="2" />
      <path d="M6 8v8M6 12h8a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function IconBot(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M12 2v4M9 14h.01M15 14h.01M9 18h6" />
    </svg>
  );
}

export function IconMsg(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function IconReview(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16l4-3 4 3 4-3 4 3V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

export function IconTasks(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

export function IconCode(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
    </svg>
  );
}

export function IconTerm(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9l3 3-3 3M12 15h5" />
    </svg>
  );
}

export function IconBug(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M8 8a4 4 0 0 1 8 0v1H8V8z" />
      <rect x="7" y="9" width="10" height="10" rx="2" />
      <path d="M7 13H3M21 13h-4M12 9v10M9 4l-2-2M15 4l2-2M7 19l-2 2M17 19l2 2" />
    </svg>
  );
}

export function IconPlug(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 22v-5M9 8V2M15 8V2M7 8h10v4a5 5 0 0 1-10 0V8z" />
    </svg>
  );
}

export function IconStore(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 9l1-5h16l1 5M3 9v11h18V9M3 9h18" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

export function IconSettings(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

export function IconUser(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function IconSearch(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function IconBell(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function IconSpark(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
    </svg>
  );
}

export function IconFile(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

export function IconChev(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconRepo(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 4h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function IconPalette(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 22a10 10 0 1 1 10-10c0 2.2-1.8 3-3 3h-1.5a2.5 2.5 0 0 0 0 5H12z" />
      <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" />
      <circle cx="16.5" cy="10.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconLoader(p: IconProps) {
  return (
    <svg {...base(p)} className={cn("animate-hfq-spin", p.className)}>
      <path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round" />
    </svg>
  );
}

export function IconClose(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
