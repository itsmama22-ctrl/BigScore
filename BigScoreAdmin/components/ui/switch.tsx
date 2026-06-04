"use client";

import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

function Switch({
  className,
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  id,
  ...props
}: SwitchProps) {
  const switchId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label || "Toggle"}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200",
          "focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2 focus:ring-offset-bg-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-accent-green" : "bg-status-disabled"
        )}
        {...props}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <label
              htmlFor={switchId}
              className={cn(
                "text-body font-medium",
                disabled ? "text-text-disabled" : "text-text-primary"
              )}
            >
              {label}
            </label>
          )}
          {description && (
            <span className="text-caption text-text-tertiary">{description}</span>
          )}
        </div>
      )}
    </div>
  );
}

export { Switch };
export type { SwitchProps };
