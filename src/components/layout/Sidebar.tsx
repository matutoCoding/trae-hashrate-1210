import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  Package,
  AlertTriangle,
  Workflow,
  FileCheck2,
  ClipboardList,
  ShieldAlert,
  ChevronRight,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRequisitionStore } from "@/store/useRequisitionStore";
import { useBatchStore } from "@/store/useBatchStore";
import { getWarningLevel } from "@/utils/date";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  children?: Array<Omit<NavItem, "icon" | "children"> & { icon?: React.ReactNode }>;
}

export const Sidebar: React.FC = () => {
  const { pathname } = useLocation();
  const { requisitions, initialized: rInit } = useRequisitionStore();
  const { batches, initialized: bInit } = useBatchStore();

  const pendingCount = React.useMemo(
    () => (rInit ? requisitions.filter((r) => r.approvalStatus === "pending").length : 0),
    [requisitions, rInit]
  );

  const warningCount = React.useMemo(() => {
    if (!bInit) return 0;
    return batches.filter((b) => {
      const wl = getWarningLevel(b.expiryDate, b.isLocked);
      return wl.level !== "normal" && wl.level !== "expired" && b.remainingQty > 0;
    }).length;
  }, [batches, bInit]);

  const expiredCount = React.useMemo(() => {
    if (!bInit) return 0;
    return batches.filter((b) => b.isLocked && getWarningLevel(b.expiryDate, true).level === "expired").length;
  }, [batches, bInit]);

  const nav: NavItem[] = React.useMemo(
    () => [
      { to: "/", label: "工作台", icon: <LayoutDashboard className="h-4.5 w-4.5" /> },
      {
        to: "/batch",
        label: "试剂批次",
        icon: <Boxes className="h-4.5 w-4.5" />,
        children: [
          { to: "/batch", label: "批次列表" },
          { to: "/batch/new", label: "到货验收入库" },
        ],
      },
      {
        to: "/inventory",
        label: "效期出库",
        icon: <Package className="h-4.5 w-4.5" />,
        badge: warningCount,
        children: [
          { to: "/inventory", label: "库存总览(FIFO)" },
          { to: "/inventory/warning", label: "临期预警中心", badge: warningCount },
          { to: "/inventory/expired", label: "过期锁定管理", badge: expiredCount },
        ],
      },
      {
        to: "/approval",
        label: "分支审批",
        icon: <Workflow className="h-4.5 w-4.5" />,
        badge: pendingCount,
        children: [
          { to: "/approval/todo", label: "审批工作台", badge: pendingCount, icon: <FileCheck2 className="h-4 w-4" /> },
          { to: "/approval/config", label: "条件路由配置", icon: <ClipboardList className="h-4 w-4" /> },
          { to: "/approval/flow", label: "审批流设计器", icon: <Workflow className="h-4 w-4" /> },
        ],
      },
      {
        to: "/requisition",
        label: "领用登记",
        icon: <ClipboardList className="h-4.5 w-4.5" />,
        children: [
          { to: "/requisition", label: "申请记录" },
          { to: "/requisition/new", label: "新建领用申请", icon: <FileCheck2 className="h-4 w-4" /> },
        ],
      },
      {
        to: "/hazard",
        label: "危化品管理",
        icon: <ShieldAlert className="h-4.5 w-4.5" />,
      },
    ],
    [pendingCount, warningCount, expiredCount]
  );

  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => {
    const m: Record<string, boolean> = {};
    nav.forEach((n) => {
      if (n.children?.some((c) => pathname.startsWith(c.to) || pathname === c.to)) m[n.to] = true;
    });
    setExpanded(m);
  }, [pathname]);

  return (
    <aside className="w-[236px] shrink-0 h-full bg-white border-r border-ink-100 flex flex-col">
      <div className="h-16 px-5 flex items-center gap-2.5 border-b border-ink-100 shrink-0">
        <div className="h-9 w-9 rounded-lg2 bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-[0_6px_16px_rgba(15,76,129,0.3)]">
          <FlaskConical className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold text-ink-900 tracking-tight">
            试剂管理系统
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">Lab Reagent · LIMS</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {nav.map((item) => {
          const hasChildren = !!item.children?.length;
          const open = expanded[item.to];
          const isParentActive =
            hasChildren && item.children!.some((c) => pathname === c.to);
          return (
            <div key={item.to}>
              {!hasChildren ? (
                <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn("nav-link", isActive && "nav-link-active")
                  }
                >
                  <span className="flex items-center justify-center w-5">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span className="h-4 min-w-[16px] px-1 rounded-full bg-warning-red text-white text-[10px] font-bold flex items-center justify-center shadow">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  ) : null}
                </NavLink>
              ) : (
                <>
                  <button
                    onClick={() =>
                      setExpanded((e) => ({ ...e, [item.to]: !e[item.to] }))
                    }
                    className={cn(
                      "nav-link w-full",
                      isParentActive && !open && "bg-brand-50 text-brand-600 hover:bg-brand-50"
                    )}
                  >
                    <span className="flex items-center justify-center w-5">{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge ? (
                      <span className="h-4 min-w-[16px] px-1 rounded-full bg-warning-red text-white text-[10px] font-bold flex items-center justify-center shadow">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    ) : null}
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 text-ink-400 transition-transform",
                        open && "rotate-90"
                      )}
                    />
                  </button>
                  {open && (
                    <div className="mt-1 ml-5 pl-3 border-l border-ink-100 space-y-0.5">
                      {item.children!.map((c) => (
                        <NavLink
                          key={c.to}
                          to={c.to}
                          className={({ isActive }) =>
                            cn(
                              "nav-link !py-1.5 !text-[13px]",
                              isActive && "nav-link-active"
                            )
                          }
                        >
                          {c.icon ? (
                            <span className="flex items-center justify-center w-4">{c.icon}</span>
                          ) : (
                            <span className="w-4" />
                          )}
                          <span className="flex-1">{c.label}</span>
                          {c.badge ? (
                            <span className="h-4 min-w-[16px] px-1 rounded-full bg-warning-red text-white text-[10px] font-bold flex items-center justify-center shadow">
                              {c.badge > 99 ? "99+" : c.badge}
                            </span>
                          ) : null}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-ink-100 shrink-0">
        <div className="rounded-lg2 p-3 bg-gradient-to-br from-brand-50 to-white border border-brand-100">
          <div className="flex items-center gap-2 text-xs font-medium text-brand-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            规范提示
          </div>
          <p className="mt-1.5 text-[11px] leading-5 text-ink-600">
            出库严格执行 FIFO 先进先出原则，临期试剂优先使用，过期批次禁止领用。
          </p>
        </div>
      </div>
    </aside>
  );
};
