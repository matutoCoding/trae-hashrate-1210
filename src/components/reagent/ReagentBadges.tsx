import * as React from "react";
import { warningColorMap, getWarningLevel } from "@/utils/date";
import { cn } from "@/lib/utils";
import type { ReagentBatch, HazardLevel, WarningLevel } from "@/types";
import { Badge } from "@/components/ui/Badge";

const hazardToneMap: Record<HazardLevel, { tone: any; icon?: string }> = {
  无: { tone: "default" },
  易燃: { tone: "orange" },
  易爆: { tone: "danger" },
  有毒: { tone: "hazard" },
  腐蚀性: { tone: "warning" },
  易制毒: { tone: "danger" },
  易制爆: { tone: "danger" },
};

export const HazardBadge: React.FC<{ level: HazardLevel; size?: "sm" | "md" }> = ({
  level,
  size = "sm",
}) => {
  if (level === "无") return <Badge tone="default" size={size}>普通</Badge>;
  const conf = hazardToneMap[level];
  return <Badge tone={conf.tone} size={size} dot>{level}</Badge>;
};

interface WarningBadgeProps {
  expiryDate: string;
  isLocked?: boolean;
  showDays?: boolean;
  size?: "sm" | "md";
}
export const WarningBadge: React.FC<WarningBadgeProps> = ({
  expiryDate,
  isLocked,
  showDays = true,
  size = "sm",
}) => {
  const wl = getWarningLevel(expiryDate, isLocked);
  const toneMap: Record<WarningLevel, any> = {
    normal: "success",
    warning90: "warning",
    warning30: "orange",
    warning7: "danger",
    expired: "danger",
  };
  return (
    <Badge tone={toneMap[wl.level]} size={size} dot>
      {showDays ? wl.label : wl.level === "normal" ? "正常" : wl.level === "expired" ? "过期" : "临期"}
    </Badge>
  );
};

interface ProgressBarProps {
  value: number;
  max: number;
  tone?: keyof typeof warningColorMap;
  className?: string;
  showLabel?: boolean;
}
export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max,
  tone = "normal",
  className,
  showLabel,
}) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const c = warningColorMap[tone] ?? warningColorMap.normal;
  return (
    <div className={cn("w-full", className)}>
      <div className="h-1.5 w-full rounded-full bg-ink-100 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", c.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 flex justify-between text-[10px] text-ink-500">
          <span className="font-mono-tabular">{value.toLocaleString()}</span>
          <span className="font-mono-tabular">/ {max.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
};

export const BatchRemainingBar: React.FC<{ batch: ReagentBatch }> = ({ batch }) => {
  const wl = getWarningLevel(batch.expiryDate, batch.isLocked);
  return (
    <ProgressBar
      value={batch.remainingQty}
      max={batch.quantity}
      tone={batch.isLocked ? "expired" : wl.level}
      showLabel
    />
  );
};

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  trend?: number;
  icon?: React.ReactNode;
  tone?: "brand" | "success" | "warning" | "danger" | "hazard";
  suffix?: string;
  sub?: string;
  onClick?: () => void;
}
const toneBg: Record<string, string> = {
  brand: "from-brand-50 to-brand-100/40 text-brand-600",
  success: "from-emerald-50 to-emerald-100/40 text-success-600",
  warning: "from-amber-50 to-amber-100/40 text-amber-600",
  danger: "from-rose-50 to-rose-100/40 text-rose-600",
  hazard: "from-violet-50 to-violet-100/40 text-hazard-500",
};

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  trend,
  icon,
  tone = "brand",
  suffix,
  sub,
  onClick,
}) => (
  <div
    onClick={onClick}
    className={cn(
      "card card-hover p-4 relative overflow-hidden stagger-[&>*]",
      onClick && "cursor-pointer"
    )}
  >
    <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br opacity-40 blur-xl pointer-events-none"
      style={{ background: tone === "brand" ? "radial-gradient(circle,#3F72B0,transparent 70%)" : tone === "success" ? "radial-gradient(circle,#2A9D8F,transparent 70%)" : tone === "warning" ? "radial-gradient(circle,#FFC107,transparent 70%)" : tone === "danger" ? "radial-gradient(circle,#E63946,transparent 70%)" : "radial-gradient(circle,#6A4C93,transparent 70%)" }}
    />
    <div className="flex items-start justify-between relative">
      <div>
        <div className="text-xs text-ink-500 font-medium">{label}</div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-2xl font-bold text-ink-900 font-mono-tabular tracking-tight">
            {value}
          </span>
          {suffix && <span className="text-xs text-ink-500">{suffix}</span>}
        </div>
        {sub && <p className="mt-1 text-[11px] text-ink-500">{sub}</p>}
        {trend != null && (
          <div className={cn(
            "mt-2 inline-flex items-center gap-1 text-[11px] font-medium",
            trend >= 0 ? "text-success-600" : "text-warning-red"
          )}>
            <span>{trend >= 0 ? "▲" : "▼"}</span>
            <span>{Math.abs(trend)}% 较上周</span>
          </div>
        )}
      </div>
      <div className={cn(
        "h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-inner",
        toneBg[tone]
      )}>
        {icon}
      </div>
    </div>
  </div>
);
