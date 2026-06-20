import { format, differenceInCalendarDays, addDays, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { WarningLevel } from "@/types";

export const fmt = (d: string | Date, pattern = "yyyy-MM-dd") => {
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, pattern, { locale: zhCN });
};

export const fmtDateTime = (d: string | Date) => fmt(d, "yyyy-MM-dd HH:mm");

export const remainingDays = (expiryDate: string, fromDate: Date = new Date()) =>
  differenceInCalendarDays(parseISO(expiryDate), fromDate);

export const getWarningLevel = (
  expiryDate: string,
  isLocked = false
): { level: WarningLevel; days: number; label: string } => {
  const days = remainingDays(expiryDate);
  if (isLocked || days <= 0)
    return { level: "expired", days, label: days <= 0 ? `已过期${-days}天` : "已锁定" };
  if (days <= 7) return { level: "warning7", days, label: `临期${days}天` };
  if (days <= 30) return { level: "warning30", days, label: `临期${days}天` };
  if (days <= 90) return { level: "warning90", days, label: `效期${days}天` };
  return { level: "normal", days, label: `效期${days}天` };
};

export const warningColorMap: Record<WarningLevel, { text: string; bg: string; border: string; bar: string }> = {
  normal:    { text: "text-success-600",    bg: "bg-emerald-50",    border: "border-emerald-200",   bar: "bg-success-500" },
  warning90: { text: "text-amber-700",      bg: "bg-amber-50",      border: "border-amber-200",     bar: "bg-warning-yellow" },
  warning30: { text: "text-orange-700",     bg: "bg-orange-50",     border: "border-orange-200",    bar: "bg-warning-orange" },
  warning7:  { text: "text-rose-700",       bg: "bg-rose-50",       border: "border-rose-200",      bar: "bg-warning-red" },
  expired:   { text: "text-red-700",        bg: "bg-red-50",        border: "border-red-200",       bar: "bg-red-500" },
};

export const uid = (prefix = "") =>
  prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export const todayISO = () => format(new Date(), "yyyy-MM-dd");
export const nowISO = () => format(new Date(), "yyyy-MM-dd HH:mm:ss");

export const genSerialNo = (prefix: string, seq: number) => {
  const d = format(new Date(), "yyyyMM");
  return `${prefix}${d}${String(seq).padStart(3, "0")}`;
};

export const daysFromNow = (days: number) => format(addDays(new Date(), days), "yyyy-MM-dd");

export const currency = (n: number) =>
  "¥" + (n || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const withComma = (n: number, digits = 0) =>
  (n || 0).toLocaleString("zh-CN", { maximumFractionDigits: digits });
