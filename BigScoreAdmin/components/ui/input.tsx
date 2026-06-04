import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helperText, error, icon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-label text-text-secondary"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-tertiary">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              "w-full rounded-lg border border-border-default bg-bg-tertiary px-4 py-2.5 text-body text-text-primary placeholder:text-text-disabled transition-colors duration-200",
              "focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-border-error focus:border-border-error focus:ring-border-error",
              icon && "pl-10",
              className
            )}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            {...props}
          />
        </div>
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="text-caption text-text-tertiary">
            {helperText}
          </p>
        )}
        {error && (
          <p id={`${inputId}-error`} className="text-caption text-accent-red">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
export type { InputProps };
