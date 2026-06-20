import * as React from "react";
import { cn } from "@/lib/utils";

export const Card: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }
> = ({ hover, className, ...props }) => (
  <div
    className={cn(
      "card",
      hover && "card-hover",
      className
    )}
    {...props}
  />
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      "flex items-start justify-between gap-4 px-5 py-4 border-b border-ink-100",
      className
    )}
    {...props}
  />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...props
}) => (
  <h3
    className={cn("text-sm font-semibold text-ink-900 leading-6", className)}
    {...props}
  >
    {children}
  </h3>
);

export const CardSubTitle: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  ...props
}) => <p className={cn("text-xs text-ink-500 mt-0.5", className)} {...props} />;

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn("p-5", className)} {...props} />;

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      "px-5 py-3.5 border-t border-ink-100 bg-ink-50/60 rounded-b-lg2",
      className
    )}
    {...props}
  />
);

type TabsProps = {
  items: Array<{ id: string; label: React.ReactNode; count?: number }>;
  value: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: "solid" | "line";
};

export const Tabs: React.FC<TabsProps> = ({
  items,
  value,
  onChange,
  className,
  variant = "line",
}) => (
  <div
    className={cn(
      "flex items-center gap-1",
      variant === "line" ? "border-b border-ink-200 -mb-px" : "p-1 bg-ink-100 rounded-lg",
      className
    )}
  >
    {items.map((it) => {
      const active = value === it.id;
      return (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          className={cn(
            "group relative inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition",
            variant === "line"
              ? cn(
                  "text-ink-500 hover:text-ink-800",
                  active && "text-brand-600",
                  "before:absolute before:left-3 before:right-3 before:-bottom-px before:h-0.5 before:bg-brand-500 before:rounded-full before:scale-x-0 before:transition-transform",
                  active && "before:scale-x-100"
                )
              : cn(
                  "rounded-md text-ink-600 hover:text-ink-900",
                  active && "bg-white text-brand-600 shadow-sm"
                )
          )}
        >
          {it.label}
          {it.count != null && (
            <span
              className={cn(
                "inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[11px] font-medium",
                active ? "bg-brand-500 text-white" : "bg-ink-200 text-ink-700"
              )}
            >
              {it.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);
