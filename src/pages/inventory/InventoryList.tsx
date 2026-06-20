import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Package,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Clock,
  TrendingUp,
  Layers,
  BookmarkCheck,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Tabular,
  Empty,
} from "@/components/ui/Table";
import { BatchTable } from "@/components/reagent/BatchTable";
import {
  HazardBadge,
  WarningBadge,
  KpiCard,
} from "@/components/reagent/ReagentBadges";
import { useBatchStore } from "@/store/useBatchStore";
import { groupInventoryByReagent } from "@/utils/fifo";
import {
  fmt,
  currency,
  withComma,
  getWarningLevel,
  warningColorMap,
} from "@/utils/date";
import { cn } from "@/lib/utils";
import type { ReagentBatch, ReagentCategory } from "@/types";

const categories: ReagentCategory[] = [
  "普通试剂",
  "有机试剂",
  "无机试剂",
  "生化试剂",
  "标准品",
  "危化品",
];

const InventoryList: React.FC = () => {
  const navigate = useNavigate();
  const batches = useBatchStore((s) => s.batches);
  const [searchText, setSearchText] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [expandedCodes, setExpandedCodes] = React.useState<Set<string>>(
    new Set()
  );

  const grouped = React.useMemo(
    () => groupInventoryByReagent(batches),
    [batches]
  );

  const filtered = React.useMemo(() => {
    return grouped.filter((g) => {
      if (categoryFilter !== "all" && g.category !== categoryFilter) return false;
      if (searchText) {
        const kw = searchText.toLowerCase();
        return (
          g.reagentName.toLowerCase().includes(kw) ||
          g.reagentCode.toLowerCase().includes(kw) ||
          (g.casNo?.toLowerCase().includes(kw) ?? false)
        );
      }
      return true;
    });
  }, [grouped, searchText, categoryFilter]);

  const stats = React.useMemo(() => {
    let totalReagents = grouped.length;
    let totalBatches = 0;
    let totalQty = 0;
    let totalValue = 0;
    let warningCount = 0;
    grouped.forEach((g) => {
      totalBatches += g.batchCount;
      totalQty += g.totalQty;
      totalValue += g.totalValue;
      warningCount += g.warningBatches > 0 ? 1 : 0;
    });
    return { totalReagents, totalBatches, totalQty, totalValue, warningCount };
  }, [grouped]);

  const alertStats = React.useMemo(() => {
    let lowStockBatches = 0;
    let highFrozenBatches = 0;
    let bothBatches = 0;
    let totalBlockedValue = 0;
    let affectedReagents = new Set<string>();
    for (const b of batches) {
      if (b.isLocked) continue;
      const availableQty = Math.max(0, b.remainingQty - (b.frozenQty || 0));
      const frozenQty = b.frozenQty || 0;
      const availableRatio = b.quantity > 0 ? availableQty / b.quantity : 0;
      const frozenRatio = b.remainingQty > 0 ? frozenQty / b.remainingQty : 0;
      const ls = availableRatio < 0.2;
      const hf = frozenRatio > 0.7;
      if (ls) lowStockBatches++;
      if (hf) highFrozenBatches++;
      if (ls && hf) bothBatches++;
      if (ls || hf) {
        totalBlockedValue += frozenQty * b.unitPrice;
        affectedReagents.add(b.reagentCode);
      }
    }
    return {
      lowStockBatches,
      highFrozenBatches,
      bothBatches,
      total: lowStockBatches + highFrozenBatches - bothBatches,
      totalBlockedValue,
      affectedReagents: affectedReagents.size,
    };
  }, [batches]);

  const toggleExpand = (code: string) => {
    setExpandedCodes((prev) => {
      const n = new Set(prev);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  };

  const batchesForCode = React.useCallback(
    (code: string) => {
      return batches
        .filter((b) => b.reagentCode === code)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    },
    [batches]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="库存总览(FIFO)"
        subtitle="按试剂维度聚合库存，支持FIFO先进先出策略。点击试剂行可展开查看各批次详情。"
        icon={<Package className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/inventory/alert">
              <Button
                variant={alertStats.total > 0 ? "warning" : "outline"}
                size="md"
                leftIcon={<ShieldAlert className="h-4 w-4" />}
              >
                占用预警
                {alertStats.total > 0 && (
                  <Badge tone="danger" size="sm" className="ml-1 !h-4 !px-1.5 !text-[10px]">
                    {alertStats.total}
                  </Badge>
                )}
              </Button>
            </Link>
            <Link to="/inventory/warning">
              <Button variant="outline" size="md" leftIcon={<AlertTriangle className="h-4 w-4" />}>
                临期预警
              </Button>
            </Link>
            <Link to="/inventory/expired">
              <Button variant="danger" size="md" leftIcon={<Clock className="h-4 w-4" />}>
                过期管理
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="试剂种类"
          value={stats.totalReagents}
          suffix="种"
          tone="brand"
          icon={<Layers className="h-5 w-5" />}
          sub={`共 ${stats.totalBatches} 个批次`}
        />
        <KpiCard
          label="总库存量"
          value={withComma(stats.totalQty)}
          tone="success"
          icon={<Package className="h-5 w-5" />}
          sub={currency(stats.totalValue) + " 库存总金额"}
        />
        <KpiCard
          label="库存总金额"
          value={currency(stats.totalValue).replace("¥", "")}
          suffix="元"
          tone="warning"
          icon={<TrendingUp className="h-5 w-5" />}
          sub="实时估值"
        />
        <KpiCard
          label="预警试剂"
          value={stats.warningCount}
          suffix="种"
          tone="danger"
          icon={<AlertTriangle className="h-5 w-5" />}
          sub="含临期或过期批次"
          onClick={() => navigate("/inventory/warning")}
        />
        <KpiCard
          label="占用预警"
          value={
            <span className={cn(alertStats.total > 0 ? "text-warning-red" : "text-success-600")}>
              {alertStats.total}
            </span>
          }
          suffix="批"
          tone={alertStats.total > 0 ? "danger" : "success"}
          icon={<BookmarkCheck className="h-5 w-5" />}
          sub={
            alertStats.total > 0
              ? `冻结 ${currency(alertStats.totalBlockedValue)}`
              : "库存健康"
          }
          onClick={() => navigate("/inventory/alert")}
        />
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div className="flex flex-1 items-center gap-3">
              <div className="flex-1 max-w-sm">
                <Input
                  placeholder="搜索试剂名称 / 编码 / CAS号"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  leading={<Search className="h-4 w-4" />}
                />
              </div>
              <div className="w-44">
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  options={[
                    { label: "全部类别", value: "all" },
                    ...categories.map((c) => ({ label: c, value: c })),
                  ]}
                />
              </div>
              <Button
                variant="ghost"
                size="md"
                leftIcon={<Filter className="h-4 w-4" />}
                onClick={() => {
                  setSearchText("");
                  setCategoryFilter("all");
                }}
              >
                重置
              </Button>
            </div>
            <div className="text-xs text-ink-500">
              共 <span className="font-semibold text-ink-800">{filtered.length}</span> 种试剂
            </div>
          </div>

          {filtered.length === 0 ? (
            <Empty text="未找到匹配的试剂" />
          ) : (
            <Table>
              <Tabular>
                <THead sticky>
                  <TR hoverable={false}>
                    <TH className="w-10" />
                    <TH>试剂 / 编码</TH>
                    <TH>类别</TH>
                    <TH>危化</TH>
                    <TH className="text-right">批次数量</TH>
                    <TH className="text-right">总库存</TH>
                    <TH className="text-right">总金额</TH>
                    <TH>最近效期</TH>
                    <TH>预警批次</TH>
                  </TR>
                </THead>
                <TBody>
                  {filtered.map((g) => {
                    const wl = g.nearestExpiry
                      ? getWarningLevel(g.nearestExpiry, false)
                      : null;
                    const isExpanded = expandedCodes.has(g.reagentCode);
                    const codeBatches = batchesForCode(g.reagentCode);
                    return (
                      <React.Fragment key={g.reagentCode}>
                        <TR
                          className={cn(
                            "cursor-pointer",
                            g.warningBatches > 0 && !isExpanded && "bg-amber-50/30"
                          )}
                          onClick={() => toggleExpand(g.reagentCode)}
                        >
                          <TD>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-ink-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-ink-500" />
                            )}
                          </TD>
                          <TD>
                            <div className="flex items-start gap-2.5">
                              <div
                                className={cn(
                                  "h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold",
                                  g.hazardLevel !== "无"
                                    ? "bg-gradient-to-br from-violet-100 to-violet-50 text-hazard-500"
                                    : "bg-gradient-to-br from-brand-50 to-brand-100/50 text-brand-600"
                                )}
                              >
                                {g.reagentName.slice(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-ink-900">
                                  {g.reagentName}
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  <span className="text-[11px] font-mono-tabular text-ink-500">
                                    {g.reagentCode}
                                  </span>
                                  {g.casNo && (
                                    <>
                                      <span className="text-ink-200">·</span>
                                      <span className="text-[11px] text-ink-500">
                                        CAS {g.casNo}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TD>
                          <TD>
                            <Badge tone="brand" size="sm">
                              {g.category}
                            </Badge>
                          </TD>
                          <TD>
                            <HazardBadge level={g.hazardLevel} />
                          </TD>
                          <TD className="text-right">
                            <span className="font-mono-tabular text-sm font-semibold text-ink-800">
                              {g.batchCount}
                            </span>
                            <span className="text-xs text-ink-400 ml-1">批</span>
                          </TD>
                          <TD className="text-right">
                            <span className="font-mono-tabular text-sm font-semibold text-ink-800">
                              {withComma(g.totalQty)}
                            </span>
                            <span className="text-xs text-ink-400 ml-1">
                              {g.unit}
                            </span>
                          </TD>
                          <TD className="text-right">
                            <span className="font-mono-tabular text-sm font-semibold text-ink-800">
                              {currency(g.totalValue)}
                            </span>
                          </TD>
                          <TD>
                            {g.nearestExpiry ? (
                              <div className="flex flex-col gap-1">
                                <span className="font-mono-tabular text-xs text-ink-800">
                                  {fmt(g.nearestExpiry)}
                                </span>
                                {wl && (
                                  <WarningBadge
                                    expiryDate={g.nearestExpiry}
                                    isLocked={wl.level === "expired"}
                                  />
                                )}
                              </div>
                            ) : (
                              <span className="text-ink-400">-</span>
                            )}
                          </TD>
                          <TD>
                            {g.warningBatches > 0 ? (
                              <Badge
                                tone={
                                  wl?.level === "expired"
                                    ? "danger"
                                    : wl?.level === "warning7"
                                    ? "danger"
                                    : wl?.level === "warning30"
                                    ? "orange"
                                    : "warning"
                                }
                                size="sm"
                                dot
                              >
                                {g.warningBatches} 个批次
                              </Badge>
                            ) : (
                              <Badge tone="success" size="sm" dot>
                                正常
                              </Badge>
                            )}
                          </TD>
                        </TR>
                        {isExpanded && (
                          <TR hoverable={false}>
                            <TD colSpan={9} className="!py-0 !bg-ink-50/50">
                              <div className="p-4">
                                <div className="mb-3 flex items-center justify-between">
                                  <div className="text-xs font-medium text-ink-600 flex items-center gap-2">
                                    <Layers className="h-3.5 w-3.5" />
                                    批次列表（按FIFO优先级排序，最早效期在前）
                                  </div>
                                  <span className="text-[11px] text-ink-400">
                                    共 {codeBatches.length} 个批次
                                  </span>
                                </div>
                                <BatchTable
                                  batches={codeBatches}
                                  showFifo
                                />
                              </div>
                            </TD>
                          </TR>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TBody>
              </Tabular>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default InventoryList;
