import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type BadgeTone =
  | "default"
  | "brand"
  | "success"
  | "warning"
  | "orange"
  | "danger"
  | "hazard"
  | "ink";

const toneMap: Record<BadgeTone, string> = {
  default: "bg-ink-100 text-ink-700 border-ink-200",
  brand: "bg-brand-50 text-brand-600 border-brand-100",
  success: "bg-emerald-50 text-success-600 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  hazard: "bg-violet-50 text-hazard-500 border-violet-200",
  ink: "bg-ink-800 text-white border-ink-700",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: "sm" | "md";
  dot?: boolean;
  closable?: boolean;
  onClose?: () => void;
}

export const Badge: React.FC<BadgeProps> = ({
  tone = "default",
  size = "sm",
  dot,
  closable,
  onClose,
  className,
  children,
  ...props
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 border rounded-full font-medium",
      size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      toneMap[tone],
      className
    )}
    {...props}
  >
    {dot && (
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "success" && "bg-success-500",
          tone === "warning" && "bg-warning-yellow",
          tone === "orange" && "bg-warning-orange",
          tone === "danger" && "bg-warning-red",
          tone === "hazard" && "bg-hazard-500",
          tone === "default" && "bg-ink-400",
          tone === "brand" && "bg-brand-500",
          tone === "ink" && "bg-white",
          !["success", "warning", "orange", "danger", "hazard", "default", "brand", "ink"].includes(tone) && "bg-ink-400"
        )}
      />
    )}
    {children}
    {closable && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose?.();
        }}
        className="-mr-1 ml-0.5 rounded-full p-0.5 hover:bg-black/10"
      >
        <X className="h-3 w-3" />
      </button>
    )}
  </span>
);
