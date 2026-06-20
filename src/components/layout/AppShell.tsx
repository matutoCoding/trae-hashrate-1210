import * as React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Link, useLocation } from "react-router-dom";
import {
  Bell,
  Search,
  ChevronRight,
  Home,
  User,
  LogOut,
  Settings,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useCurrentUser, useAuthStore } from "@/store/useAuthStore";
import { useRequisitionStore } from "@/store/useRequisitionStore";

const titleMap: Record<string, { title: string; parent?: { to: string; label: string } }> = {
  "/": { title: "工作台仪表盘" },
  "/batch": { title: "批次列表", parent: { to: "/batch", label: "试剂批次" } },
  "/batch/new": { title: "到货验收入库", parent: { to: "/batch", label: "试剂批次" } },
  "/inventory": { title: "库存总览(FIFO)", parent: { to: "/inventory", label: "效期出库" } },
  "/inventory/warning": { title: "临期预警中心", parent: { to: "/inventory", label: "效期出库" } },
  "/inventory/expired": { title: "过期锁定管理", parent: { to: "/inventory", label: "效期出库" } },
  "/approval/todo": { title: "审批工作台", parent: { to: "/approval/todo", label: "分支审批" } },
  "/approval/config": { title: "条件路由配置", parent: { to: "/approval/todo", label: "分支审批" } },
  "/approval/flow": { title: "审批流设计器", parent: { to: "/approval/todo", label: "分支审批" } },
  "/requisition": { title: "申请记录", parent: { to: "/requisition", label: "领用登记" } },
  "/requisition/new": { title: "新建领用申请", parent: { to: "/requisition", label: "领用登记" } },
  "/hazard": { title: "危化品管理" },
};

export const Breadcrumb: React.FC = () => {
  const { pathname } = useLocation();
  const meta = titleMap[pathname] ?? { title: "页面" };
  return (
    <nav className="flex items-center gap-1.5 text-xs text-ink-500">
      <Link to="/" className="flex items-center gap-1 hover:text-brand-600 transition">
        <Home className="h-3.5 w-3.5" />
        首页
      </Link>
      {meta.parent && (
        <>
          <ChevronRight className="h-3 w-3 text-ink-300" />
          <Link to={meta.parent.to} className="hover:text-brand-600 transition">
            {meta.parent.label}
          </Link>
        </>
      )}
      <ChevronRight className="h-3 w-3 text-ink-300" />
      <span className="text-ink-700 font-medium">{meta.title}</span>
    </nav>
  );
};

export const Topbar: React.FC = () => {
  const user = useCurrentUser();
  const { users, setCurrentUser } = useAuthStore();
  const { requisitions } = useRequisitionStore();
  const pending = requisitions.filter((r) => r.approvalStatus === "pending").length;
  const [menuOpen, setMenuOpen] = React.useState(false);

  const roleName: Record<string, string> = {
    admin: "系统管理员",
    keeper: "试剂保管员",
    tester: "检测人员",
    approver: "审批人",
    safety_officer: "安全管理员",
    director: "部门主任",
  };

  return (
    <header className="h-16 shrink-0 bg-white/80 backdrop-blur border-b border-ink-100 px-6 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <Breadcrumb />
        <h1 className="mt-0.5 text-[15px] font-semibold text-ink-900 truncate">
          {titleMap[useLocation().pathname]?.title ?? "试剂出入库管理"}
        </h1>
      </div>

      <div className="relative hidden md:block w-[260px]">
        <Search className="h-4 w-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          placeholder="搜索试剂名称/编码/批号..."
          className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-ink-200 bg-ink-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition"
        />
      </div>

      <button className="relative h-9 w-9 rounded-lg border border-ink-200 bg-white flex items-center justify-center text-ink-600 hover:text-brand-600 hover:border-brand-200 transition">
        <Bell className="h-4 w-4" />
        {pending > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-warning-red text-white text-[10px] font-bold flex items-center justify-center">
            {pending}
          </span>
        )}
      </button>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2.5 h-9 pl-1 pr-3 rounded-lg border border-ink-200 bg-white hover:border-brand-200 transition"
        >
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-semibold">
            {user?.realName?.[0] ?? "U"}
          </div>
          <div className="text-left leading-tight">
            <div className="text-xs font-medium text-ink-900">{user?.realName}</div>
            <div className="text-[10px] text-ink-500">
              {user?.roles.map((r) => roleName[r]).filter(Boolean).join("·")}
            </div>
          </div>
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-10 z-20 w-56 rounded-xl bg-white border border-ink-100 shadow-xl py-1.5 animate-fade-in-up">
              <div className="px-3 py-2 border-b border-ink-100">
                <div className="text-xs font-semibold text-ink-900">
                  切换身份(模拟)
                </div>
              </div>
              <div className="py-1 max-h-48 overflow-y-auto">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setCurrentUser(u.id);
                      setMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center gap-2 text-xs hover:bg-brand-50 transition ${
                      u.id === user?.id ? "bg-brand-50 text-brand-700" : "text-ink-700"
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                    <span className="flex-1 truncate">{u.realName}</span>
                    <Badge tone="ink" size="sm" className="!px-1.5 !py-0 text-[10px]">
                      {u.roles[0] && roleName[u.roles[0]]}
                    </Badge>
                  </button>
                ))}
              </div>
              <div className="border-t border-ink-100 pt-1 mt-1">
                <button className="w-full px-3 py-2 text-left flex items-center gap-2 text-xs text-ink-600 hover:bg-ink-50 transition">
                  <Settings className="h-3.5 w-3.5" /> 系统设置
                </button>
                <button className="w-full px-3 py-2 text-left flex items-center gap-2 text-xs text-ink-600 hover:bg-ink-50 transition">
                  <HelpCircle className="h-3.5 w-3.5" /> 使用帮助
                </button>
                <button className="w-full px-3 py-2 text-left flex items-center gap-2 text-xs text-warning-red hover:bg-red-50 transition">
                  <LogOut className="h-3.5 w-3.5" /> 退出登录
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ title, subtitle, actions, icon }) => (
  <div className="flex items-start justify-between gap-4 mb-5">
    <div className="flex items-start gap-3">
      {icon && (
        <div className="h-11 w-11 shrink-0 rounded-xl bg-white border border-ink-100 shadow-card flex items-center justify-center text-brand-500">
          {icon}
        </div>
      )}
      <div>
        <h2 className="text-xl font-semibold text-ink-900 leading-7 tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-ink-500 leading-5">{subtitle}</p>
        )}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="h-full w-full flex bg-[#f5f7fb]">
    <Sidebar />
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  </div>
);
