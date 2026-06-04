import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

function Card({
  className,
  padding = "md",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border-default bg-bg-secondary shadow-sm",
        paddingClasses[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mb-4 flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-h3 text-text-primary", className)}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-body-sm text-text-tertiary", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("", className)} {...props} />;
}

function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-4 flex items-center gap-3", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
export type { CardProps };
