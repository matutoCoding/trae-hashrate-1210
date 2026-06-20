import * as React from "react";
import {
  Boxes,
  Beaker,
  AlertTriangle,
  Bell,
  PackagePlus,
  FilePlus,
  AlertOctagon,
  ClipboardCheck,
  ArrowUpRightFromSquare,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardSubTitle, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Tabular,
} from "@/components/ui/Table";
import { BatchTable } from "@/components/reagent/BatchTable";
import {
  KpiCard,
  WarningBadge,
  HazardBadge,
  ProgressBar,
} from "@/components/reagent/ReagentBadges";
import { useBatchStore } from "@/store/useBatchStore";
import { useRequisitionStore } from "@/store/useRequisitionStore";
import {
  fmt,
  getWarningLevel,
  currency,
  withComma,
  warningColorMap,
} from "@/utils/date";
import type { ReagentBatch, HazardLevel, WarningLevel } from "@/types";
import { cn } from "@/lib/utils";

const HAZARD_LEVELS: HazardLevel[] = [
  "无",
  "易燃",
  "易爆",
  "有毒",
  "腐蚀性",
  "易制毒",
  "易制爆",
];

const HAZARD_COLORS: Record<HazardLevel, string> = {
  无: "#94A3B8",
  易燃: "#F97316",
  易爆: "#EF4444",
  有毒: "#8B5CF6",
  腐蚀性: "#F59E0B",
  易制毒: "#DC2626",
  易制爆: "#B91C1C",
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { batches } = useBatchStore();
  const { requisitions } = useRequisitionStore();

  const totalBatches = batches.length;

  const totalValue = React.useMemo(() => {
    return batches.reduce(
      (sum, b) => sum + b.remainingQty * b.unitPrice,
      0
    );
  }, [batches]);

  const warningStats = React.useMemo(() => {
    const stats = {
      warning90: 0,
      warning30: 0,
      warning7: 0,
      expired: 0,
    };
    batches.forEach((b) => {
      const wl = getWarningLevel(b.expiryDate, b.isLocked);
      if (wl.level === "warning90") stats.warning90++;
      else if (wl.level === "warning30") stats.warning30++;
      else if (wl.level === "warning7") stats.warning7++;
      else if (wl.level === "expired") stats.expired++;
    });
    return stats;
  }, [batches]);

  const pendingCount = React.useMemo(() => {
    return requisitions.filter((r) => r.approvalStatus === "pending").length;
  }, [requisitions]);

  const monthlyData = React.useMemo(() => {
    const months: { name: string; inbound: number; outbound: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = fmt(d.toISOString(), "yyyy-MM");
      const monthLabel = fmt(d.toISOString(), "M月");
      const inbound = batches
        .filter((b) => b.arrivalDate.startsWith(monthKey))
        .reduce((s, b) => s + b.quantity, 0);
      const outbound = requisitions
        .filter(
          (r) =>
            r.approvalStatus === "outbound_completed" &&
            r.createdAt.startsWith(monthKey)
        )
        .reduce(
          (s, r) => s + r.items.reduce((si, it) => si + it.quantity, 0),
          0
        );
      months.push({ name: monthLabel, inbound, outbound });
    }
    return months;
  }, [batches, requisitions]);

  const hazardPieData = React.useMemo(() => {
    const counts: Record<HazardLevel, number> = {
      无: 0,
      易燃: 0,
      易爆: 0,
      有毒: 0,
      腐蚀性: 0,
      易制毒: 0,
      易制爆: 0,
    };
    batches.forEach((b) => {
      counts[b.hazardLevel]++;
    });
    return HAZARD_LEVELS.map((lvl) => ({
      name: lvl === "无" ? "普通" : lvl,
      value: counts[lvl],
      level: lvl,
    })).filter((d) => d.value > 0);
  }, [batches]);

  const expiringTop5 = React.useMemo(() => {
    return [...batches]
      .filter((b) => !b.isLocked)
      .map((b) => ({
        ...b,
        wl: getWarningLevel(b.expiryDate, b.isLocked),
      }))
      .filter(
        (x) =>
          x.wl.level === "warning90" ||
          x.wl.level === "warning30" ||
          x.wl.level === "warning7" ||
          x.wl.level === "expired"
      )
      .sort((a, b) => a.wl.days - b.wl.days)
      .slice(0, 5);
  }, [batches]);

  const myTodoApprovals = React.useMemo(() => {
    return requisitions
      .filter((r) => r.approvalStatus === "pending")
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 3);
  }, [requisitions]);

  const recentBatches = React.useMemo(() => {
    return [...batches]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 5);
  }, [batches]);

  const quickEntries = [
    {
      label: "入库登记",
      icon: <PackagePlus className="h-5 w-5" />,
      tone: "from-brand-50 to-brand-100/40 text-brand-600",
      path: "/batch/new",
    },
    {
      label: "新建申请",
      icon: <FilePlus className="h-5 w-5" />,
      tone: "from-emerald-50 to-emerald-100/40 text-success-600",
      path: "/requisition/new",
    },
    {
      label: "预警中心",
      icon: <AlertOctagon className="h-5 w-5" />,
      tone: "from-amber-50 to-amber-100/40 text-amber-600",
      path: "/inventory/warning",
    },
    {
      label: "审批台",
      icon: <ClipboardCheck className="h-5 w-5" />,
      tone: "from-rose-50 to-rose-100/40 text-rose-600",
      path: "/approval/todo",
    },
    {
      label: "出库确认",
      icon: <ArrowUpRightFromSquare className="h-5 w-5" />,
      tone: "from-sky-50 to-sky-100/40 text-sky-600",
      path: "/requisition",
    },
    {
      label: "危化管理",
      icon: <ShieldAlert className="h-5 w-5" />,
      tone: "from-violet-50 to-violet-100/40 text-hazard-500",
      path: "/hazard",
    },
  ];

  const renderRemainingProgress = (batch: ReagentBatch) => {
    const wl = getWarningLevel(batch.expiryDate, batch.isLocked);
    const totalShelfDays = 365;
    const remainingPct = Math.max(
      0,
      Math.min(100, (wl.days / totalShelfDays) * 100)
    );
    const tone: WarningLevel =
      wl.level === "normal" ? "normal" :
      wl.level === "warning90" ? "warning90" :
      wl.level === "warning30" ? "warning30" :
      wl.level === "warning7" ? "warning7" : "expired";
    const c = warningColorMap[tone];
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-1">
          <span
            className={cn(
              "text-[11px] font-medium font-mono-tabular",
              c.text
            )}
          >
            {wl.days > 0 ? `剩余 ${wl.days} 天` : wl.label}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-ink-100 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", c.bar)}
            style={{ width: `${remainingPct}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="总试剂批次"
          value={withComma(totalBatches)}
          icon={<Boxes className="h-5 w-5" />}
          tone="brand"
          suffix="批"
          sub={`覆盖 ${new Set(batches.map((b) => b.reagentCode)).size} 种试剂`}
        />
        <KpiCard
          label="库存总价值"
          value={currency(totalValue)}
          icon={<Beaker className="h-5 w-5" />}
          tone="success"
          sub={`库存总量 ${withComma(
            batches.reduce((s, b) => s + b.remainingQty, 0)
          )} 单位`}
        />
        <KpiCard
          label="临期预警"
          value={
            <span className="flex items-baseline gap-1">
              <span className="text-rose-600">{warningStats.warning7}</span>
              <span className="text-xs text-ink-400">/</span>
              <span className="text-orange-600">{warningStats.warning30}</span>
              <span className="text-xs text-ink-400">/</span>
              <span className="text-amber-600">{warningStats.warning90}</span>
            </span>
          }
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="warning"
          suffix={warningStats.expired > 0 ? `+${warningStats.expired}过期` : undefined}
          sub="7天/30天/90天临期"
          onClick={() => navigate("/inventory/warning")}
        />
        <KpiCard
          label="待审批"
          value={withComma(pendingCount)}
          icon={<Bell className="h-5 w-5" />}
          tone="danger"
          suffix="条"
          sub="等待处理的申请单"
          onClick={() => navigate("/approval/todo")}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 flex flex-col gap-5">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>月度出入库趋势</CardTitle>
                <CardSubTitle>近6个月入库量与出库量对比</CardSubTitle>
              </div>
            </CardHeader>
            <CardBody>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3F72B0" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3F72B0" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2A9D8F" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2A9D8F" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748B", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748B", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="inbound"
                      name="入库量"
                      stroke="#3F72B0"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorInbound)"
                    />
                    <Area
                      type="monotone"
                      dataKey="outbound"
                      name="出库量"
                      stroke="#2A9D8F"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorOutbound)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>危化品分类占比</CardTitle>
                <CardSubTitle>按危险等级统计批次分布</CardSubTitle>
              </div>
            </CardHeader>
            <CardBody>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={hazardPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {hazardPieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={HAZARD_COLORS[entry.level]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        fontSize: 12,
                      }}
                      formatter={(value: number, name: string) => [
                        `${value} 批`,
                        name,
                      ]}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>临期预警 TOP5</CardTitle>
                <CardSubTitle>按到期日期最近排序</CardSubTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
                onClick={() => navigate("/inventory/warning")}
              >
                全部
              </Button>
            </CardHeader>
            <CardBody className="py-2">
              {expiringTop5.length === 0 ? (
                <div className="py-10 text-center text-sm text-ink-400">
                  暂无临期批次
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-ink-100">
                  {expiringTop5.map((b) => (
                    <div
                      key={b.id}
                      className="py-3 cursor-pointer hover:bg-ink-50/60 -mx-5 px-5 transition"
                      onClick={() => navigate(`/batch/${b.id}`)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-ink-900 truncate">
                              {b.reagentName}
                            </span>
                            <HazardBadge level={b.hazardLevel} size="sm" />
                          </div>
                          <div className="mt-0.5 text-[11px] font-mono-tabular text-ink-500">
                            {b.batchNo}
                          </div>
                        </div>
                        <WarningBadge
                          expiryDate={b.expiryDate}
                          isLocked={b.isLocked}
                          size="sm"
                        />
                      </div>
                      {renderRemainingProgress(b)}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>我的待办审批</CardTitle>
                <CardSubTitle>最近3条待处理申请</CardSubTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
                onClick={() => navigate("/approval/todo")}
              >
                全部
              </Button>
            </CardHeader>
            <CardBody className="py-2">
              {myTodoApprovals.length === 0 ? (
                <div className="py-10 text-center text-sm text-ink-400">
                  暂无待办审批
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-ink-100">
                  {myTodoApprovals.map((r) => (
                    <div
                      key={r.id}
                      className="py-3 cursor-pointer hover:bg-ink-50/60 -mx-5 px-5 transition"
                      onClick={() => navigate("/approval/todo")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-ink-900 font-mono-tabular">
                              {r.id}
                            </span>
                            <Badge tone="warning" size="sm" dot>
                              待审批
                            </Badge>
                          </div>
                          <div className="mt-1 text-xs text-ink-700 truncate">
                            {r.applicantName} · {r.department}
                          </div>
                          <div className="mt-0.5 text-[11px] text-ink-500 truncate">
                            {r.purpose}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold text-ink-800 font-mono-tabular">
                            {currency(r.totalAmount)}
                          </div>
                          <div className="mt-0.5 text-[11px] text-ink-500">
                            {r.items.length}项试剂
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>快捷入口</CardTitle>
            <CardSubTitle>常用功能快速访问</CardSubTitle>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickEntries.map((entry) => (
              <button
                key={entry.label}
                onClick={() => navigate(entry.path)}
                className="card card-hover p-4 flex flex-col items-center gap-2.5 text-center transition"
              >
                <div
                  className={cn(
                    "h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-inner",
                    entry.tone
                  )}
                >
                  {entry.icon}
                </div>
                <span className="text-sm font-medium text-ink-800">
                  {entry.label}
                </span>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>最近入库批次</CardTitle>
            <CardSubTitle>最新5条入库记录</CardSubTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
            onClick={() => navigate("/inventory")}
          >
            查看全部
          </Button>
        </CardHeader>
        <CardBody className="pt-0 px-0 pb-0">
          <div className="px-5 pt-3">
            <BatchTable batches={recentBatches} showFifo={false} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default Dashboard;
