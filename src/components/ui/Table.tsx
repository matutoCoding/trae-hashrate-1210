import * as React from "react";
import { cn } from "@/lib/utils";

export const Table: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn(
      "relative rounded-lg2 border border-ink-100 bg-white overflow-hidden",
      className
    )}
    {...props}
  >
    <div className="overflow-x-auto">{children}</div>
  </div>
);

interface THeadProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  sticky?: boolean;
}
export const THead: React.FC<THeadProps> = ({ sticky, className, ...props }) => (
  <thead
    className={cn(
      "bg-ink-50/80 text-ink-600",
      sticky && "sticky top-0 z-10 backdrop-blur",
      className
    )}
    {...props}
  />
);

export const TBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = (props) => (
  <tbody {...props} className="divide-y divide-ink-100 text-ink-700" />
);

export const TR: React.FC<
  React.HTMLAttributes<HTMLTableRowElement> & { hoverable?: boolean; selected?: boolean; tone?: "danger" | "warn" | "highlight" }
> = ({ hoverable = true, selected, tone, className, ...props }) => (
  <tr
    className={cn(
      "transition-colors",
      hoverable && "hover:bg-brand-50/40",
      selected && "bg-brand-50",
      tone === "danger" && "bg-red-50/70 hover:bg-red-50",
      tone === "warn" && "bg-orange-50/60 hover:bg-orange-50",
      tone === "highlight" && "bg-emerald-50/70 hover:bg-emerald-50",
      className
    )}
    {...props}
  />
);

export const TH: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({
  className,
  ...props
}) => (
  <th
    className={cn(
      "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap",
      className
    )}
    {...props}
  />
);

export const TD: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  className,
  ...props
}) => (
  <td
    className={cn(
      "px-4 py-3 text-sm align-middle whitespace-nowrap",
      className
    )}
    {...props}
  />
);

interface TabularTableProps extends React.HTMLAttributes<HTMLTableElement> {}
export const Tabular: React.FC<TabularTableProps> = ({ className, ...props }) => (
  <table className={cn("w-full border-collapse", className)} {...props} />
);

export const Empty: React.FC<{ text?: string; icon?: React.ReactNode }> = ({
  text = "暂无数据",
  icon,
}) => (
  <div className="py-16 flex flex-col items-center gap-3 text-ink-400">
    <div className="h-14 w-14 rounded-full bg-ink-50 flex items-center justify-center text-ink-300">
      {icon}
    </div>
    <p className="text-sm">{text}</p>
  </div>
);
