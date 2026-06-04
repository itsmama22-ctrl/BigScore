import { type VariantProps, cva } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-body font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2 focus:ring-offset-bg-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-button-primary-bg text-button-primary-text hover:bg-button-primary-hover",
        secondary:
          "bg-button-secondary-bg text-button-secondary-text hover:bg-button-secondary-hover",
        danger:
          "bg-button-danger-bg text-button-danger-text hover:bg-button-danger-hover",
        ghost:
          "bg-button-ghost-bg text-button-ghost-text hover:bg-button-ghost-hover",
        outline:
          "border border-border-default text-text-secondary hover:bg-bg-tertiary hover:text-text-primary",
      },
      size: {
        sm: "h-8 px-3 text-body-sm",
        md: "h-10 px-5",
        lg: "h-12 px-6 text-body-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
export type { ButtonProps };
