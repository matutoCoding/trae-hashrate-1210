import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "warning" | "outline" | "success";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantCls: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 shadow-[0_4px_12px_rgba(15,76,129,0.25)] hover:shadow-[0_6px_18px_rgba(15,76,129,0.32)]",
  secondary: "bg-ink-100 text-ink-800 hover:bg-ink-200",
  ghost: "text-ink-700 hover:bg-ink-100",
  danger: "bg-warning-red text-white hover:bg-red-600",
  warning: "bg-warning-orange text-white hover:bg-orange-600 shadow-[0_4px_12px_rgba(255,107,53,0.3)]",
  outline: "border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 hover:border-ink-300",
  success: "bg-success-500 text-white hover:bg-success-600",
};

const sizeCls: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "h-9 px-4 text-sm gap-2 rounded-md",
  lg: "h-11 px-5 text-sm gap-2 rounded-lg2",
  icon: "h-9 w-9 rounded-md",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading,
      leftIcon,
      rightIcon,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all active:scale-[0.98]",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none",
        variantCls[variant],
        sizeCls[size],
        className
      )}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent animate-spin" />
      )}
      {!loading && leftIcon}
      {children}
      {rightIcon}
    </button>
  )
);
Button.displayName = "Button";
