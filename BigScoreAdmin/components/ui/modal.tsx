"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnOverlay?: boolean;
  variant?: "default" | "danger";
}

const sizeClasses: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  closeOnOverlay = true,
  variant = "default",
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay p-4"
      onClick={(e) => {
        if (closeOnOverlay && e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      aria-describedby={description ? "modal-description" : undefined}
    >
      <div
        className={cn(
          "w-full rounded-xl border border-border-default bg-bg-secondary shadow-xl",
          sizeClasses[size],
          variant === "danger" && "border-border-error"
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between border-b border-border-muted px-6 py-4">
            <div className="flex flex-col gap-1">
              {title && (
                <h2
                  id="modal-title"
                  className={cn(
                    "text-h3",
                    variant === "danger" ? "text-accent-red" : "text-text-primary"
                  )}
                >
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-description" className="text-body-sm text-text-tertiary">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-text-tertiary transition-colors hover:text-text-primary"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

export { Modal };
export type { ModalProps };
