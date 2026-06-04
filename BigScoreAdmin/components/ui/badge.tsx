import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "live"
  | "scheduled"
  | "finished"
  | "draft"
  | "published"
  | "disabled"
  | "error"
  | "gold"
  | "blue"
  | "green"
  | "red"
  | "orange"
  | "purple"
  | "default";

const variantClasses: Record<BadgeVariant, string> = {
  live: "bg-status-live/15 text-status-live",
  scheduled: "bg-status-scheduled/15 text-status-scheduled",
  finished: "bg-status-finished/15 text-status-finished",
  draft: "bg-status-draft/15 text-status-draft",
  published: "bg-accent-green/15 text-accent-green",
  disabled: "bg-status-disabled/15 text-status-disabled",
  error: "bg-accent-red/15 text-accent-red",
  gold: "bg-accent-gold/15 text-accent-gold",
  blue: "bg-accent-blue/15 text-accent-blue",
  green: "bg-accent-green/15 text-accent-green",
  red: "bg-accent-red/15 text-accent-red",
  orange: "bg-accent-orange/15 text-accent-orange",
  purple: "bg-accent-purple/15 text-accent-purple",
  default: "bg-bg-tertiary text-text-secondary",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-label",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge };
export type { BadgeProps, BadgeVariant };
