import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  CheckSquare,
  Square,
  CalendarClock,
  Trash2,
  ArrowRightCircle,
  FileText,
  Hourglass,
  Flame,
} from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, CardTitle, CardSubTitle, Tabs } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
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
import {
  HazardBadge,
  WarningBadge,
  ProgressBar,
  KpiCard,
} from "@/components/reagent/ReagentBadges";
import { useBatchStore } from "@/store/useBatchStore";
import {
  fmt,
  currency,
  withComma,
  getWarningLevel,
  warningColorMap,
  remainingDays,
  todayISO,
} from "@/utils/date";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import type { ReagentBatch, WarningLevel } from "@/types";

type TabId = "all" | "warning90" | "warning30" | "warning7";

const MAX_WARNING_DAYS = 90;

const WarningCenter: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const batches = useBatchStore((s) => s.batches);
  const updateBatch = useBatchStore((s) => s.updateBatch);

  const [activeTab, setActiveTab] = React.useState<TabId>("all");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [priorityModalOpen, setPriorityModalOpen] = React.useState(false);
  const [extendModalOpen, setExtendModalOpen] = React.useState(false);
  const [destroyModalOpen, setDestroyModalOpen] = React.useState(false);
  const [actionRemark, setActionRemark] = React.useState("");
  const [extendDays, setExtendDays] = React.useState("30");

  const warningBatches = React.useMemo(() => {
    return batches
      .filter((b) => {
        if (b.remainingQty <= 0) return false;
        const wl = getWarningLevel(b.expiryDate, b.isLocked);
        return wl.level !== "normal";
      })
      .sort((a, b) => {
        const wlA = getWarningLevel(a.expiryDate, a.isLocked);
        const wlB = getWarningLevel(b.expiryDate, b.isLocked);
        const order: Record<WarningLevel, number> = {
          expired: 0,
          warning7: 1,
          warning30: 2,
          warning90: 3,
          normal: 4,
        };
        if (order[wlA.level] !== order[wlB.level]) {
          return order[wlA.level] - order[wlB.level];
        }
        return a.expiryDate.localeCompare(b.expiryDate);
      });
  }, [batches]);

  const tabCounts = React.useMemo(() => {
    const counts: Record<TabId, number> = { all: 0, warning90: 0, warning30: 0, warning7: 0 };
    warningBatches.forEach((b) => {
      counts.all++;
      const wl = getWarningLevel(b.expiryDate, b.isLocked);
      if (wl.level === "warning90" || wl.level === "warning30" || wl.level === "warning7" || wl.level === "expired") {
        counts.warning90++;
      }
      if (wl.level === "warning30" || wl.level === "warning7" || wl.level === "expired") {
        counts.warning30++;
      }
      if (wl.level === "warning7" || wl.level === "expired") {
        counts.warning7++;
      }
    });
    return counts;
  }, [warningBatches]);

  const filteredBatches = React.useMemo(() => {
    if (activeTab === "all") return warningBatches;
    return warningBatches.filter((b) => {
      const days = remainingDays(b.expiryDate);
      if (activeTab === "warning90") return days <= 90;
      if (activeTab === "warning30") return days <= 30;
      if (activeTab === "warning7") return days <= 7;
      return true;
    });
  }, [warningBatches, activeTab]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredBatches.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredBatches.map((b) => b.id)));
    }
  };

  const selectedBatches = React.useMemo(
    () => warningBatches.filter((b) => selectedIds.has(b.id)),
    [warningBatches, selectedIds]
  );

  const handleMarkPriority = () => {
    selectedIds.forEach((id) => {
      updateBatch(id, { inspectionRemark: `[优先使用] ${actionRemark || new Date().toLocaleDateString()}` });
    });
    toast.success(
      `已标记 ${selectedIds.size} 个批次优先使用`,
      actionRemark || "将在领用申请中优先推荐"
    );
    setPriorityModalOpen(false);
    setActionRemark("");
    setSelectedIds(new Set());
  };

  const handleExtendExpiry = () => {
    const days = parseInt(extendDays) || 30;
    selectedIds.forEach((id) => {
      const batch = batches.find((b) => b.id === id);
      if (batch) {
        const newExpiry = new Date(batch.expiryDate);
        newExpiry.setDate(newExpiry.getDate() + days);
        const iso = newExpiry.toISOString().slice(0, 10);
        updateBatch(id, {
          expiryDate: iso,
          inspectionRemark: `[延期${days}天] ${actionRemark || "质量复检合格"} ${new Date().toLocaleDateString()}`,
        });
      }
    });
    toast.success(
      `已为 ${selectedIds.size} 个批次申请延期`,
      `延长 ${days} 天，请等待审批`
    );
    setExtendModalOpen(false);
    setActionRemark("");
    setExtendDays("30");
    setSelectedIds(new Set());
  };

  const handleCreateDestroy = () => {
    toast.success(
      `已生成 ${selectedIds.size} 个批次的销毁单`,
      actionRemark || "请在危化品管理中跟踪销毁流程"
    );
    setDestroyModalOpen(false);
    setActionRemark("");
    setSelectedIds(new Set());
  };

  const stats = React.useMemo(() => {
    let critical = 0, high = 0, medium = 0, expired = 0;
    let totalValue = 0;
    warningBatches.forEach((b) => {
      const wl = getWarningLevel(b.expiryDate, b.isLocked);
      if (wl.level === "expired" || b.isLocked) expired++;
      else if (wl.level === "warning7") critical++;
      else if (wl.level === "warning30") high++;
      else medium++;
      totalValue += b.remainingQty * b.unitPrice;
    });
    return { critical, high, medium, expired, totalValue, total: warningBatches.length };
  }, [warningBatches]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="临期预警中心"
        subtitle="集中管理所有临期和过期批次，支持批量处理和快速响应。"
        icon={<AlertTriangle className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/inventory">
              <Button variant="outline" size="md">
                返回库存
              </Button>
            </Link>
            <Link to="/inventory/expired">
              <Button variant="danger" size="md" leftIcon={<Trash2 className="h-4 w-4" />}>
                过期锁定管理
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard
          label="预警总批次"
          value={stats.total}
          suffix="批"
          tone="warning"
          icon={<AlertTriangle className="h-5 w-5" />}
          sub={currency(stats.totalValue) + " 涉及金额"}
        />
        <KpiCard
          label="已过期"
          value={stats.expired}
          suffix="批"
          tone="danger"
          icon={<Trash2 className="h-5 w-5" />}
          sub="已自动锁定"
          onClick={() => navigate("/inventory/expired")}
        />
        <KpiCard
          label="7天内临期"
          value={stats.critical}
          suffix="批"
          tone="danger"
          icon={<Hourglass className="h-5 w-5" />}
          sub="紧急处理"
        />
        <KpiCard
          label="30天内临期"
          value={stats.high}
          suffix="批"
          tone="warning"
          icon={<Flame className="h-5 w-5" />}
          sub="优先使用"
        />
        <KpiCard
          label="90天内临期"
          value={stats.medium}
          suffix="批"
          tone="brand"
          icon={<CalendarClock className="h-5 w-5" />}
          sub="关注跟踪"
        />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-yellow" />
              预警批次列表
            </CardTitle>
            <CardSubTitle>
              按严重程度排序，红色为最高优先级。勾选后可批量操作。
            </CardSubTitle>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 ? (
              <>
                <Badge tone="brand" size="md">
                  已选 {selectedIds.size} 项
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<ArrowRightCircle className="h-3.5 w-3.5" />}
                  onClick={() => setPriorityModalOpen(true)}
                >
                  优先使用
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<CalendarClock className="h-3.5 w-3.5" />}
                  onClick={() => setExtendModalOpen(true)}
                >
                  申请延期
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<FileText className="h-3.5 w-3.5" />}
                  onClick={() => setDestroyModalOpen(true)}
                >
                  生成销毁单
                </Button>
              </>
            ) : (
              <Badge tone="default" size="md">
                选择批次以进行批量操作
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardBody>
          <div className="mb-4">
            <Tabs
              value={activeTab}
              onChange={(v) => {
                setActiveTab(v as TabId);
                setSelectedIds(new Set());
              }}
              items={[
                { id: "all", label: "全部预警", count: tabCounts.all },
                { id: "warning90", label: "90天内", count: tabCounts.warning90 },
                { id: "warning30", label: "30天内", count: tabCounts.warning30 },
                { id: "warning7", label: "7天内", count: tabCounts.warning7 },
              ]}
            />
          </div>

          {filteredBatches.length === 0 ? (
            <Empty text="当前分类下暂无预警批次" icon={<CheckSquare className="h-6 w-6" />} />
          ) : (
            <Table>
              <Tabular>
                <THead sticky>
                  <TR hoverable={false}>
                    <TH className="w-10">
                      <button onClick={toggleSelectAll}>
                        {selectedIds.size === filteredBatches.length && filteredBatches.length > 0 ? (
                          <CheckSquare className="h-4 w-4 text-brand-600" />
                        ) : (
                          <Square className="h-4 w-4 text-ink-400" />
                        )}
                      </button>
                    </TH>
                    <TH>试剂 / 批次</TH>
                    <TH>类别</TH>
                    <TH>危化</TH>
                    <TH>效期信息</TH>
                    <TH className="w-56">倒计时进度</TH>
                    <TH className="text-right">剩余量</TH>
                    <TH className="text-right">金额</TH>
                    <TH className="text-right">处理操作</TH>
                  </TR>
                </THead>
                <TBody>
                  {filteredBatches.map((b) => {
                    const wl = getWarningLevel(b.expiryDate, b.isLocked);
                    const days = Math.max(0, remainingDays(b.expiryDate));
                    const isSelected = selectedIds.has(b.id);
                    const colors = warningColorMap[wl.level];
                    const rowTone =
                      wl.level === "expired" || b.isLocked
                        ? "danger"
                        : wl.level === "warning7"
                        ? "warn"
                        : undefined;
                    return (
                      <TR key={b.id} tone={rowTone}>
                        <TD>
                          <button onClick={() => toggleSelect(b.id)}>
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-brand-600" />
                            ) : (
                              <Square className="h-4 w-4 text-ink-400" />
                            )}
                          </button>
                        </TD>
                        <TD>
                          <div className="flex items-start gap-2.5">
                            <div
                              className={cn(
                                "h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold",
                                b.hazardLevel !== "无"
                                  ? "bg-gradient-to-br from-violet-100 to-violet-50 text-hazard-500"
                                  : "bg-gradient-to-br from-brand-50 to-brand-100/50 text-brand-600"
                              )}
                            >
                              {b.reagentName.slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <Link
                                to={`/batch/${b.id}`}
                                className="text-sm font-semibold text-ink-900 hover:text-brand-600 transition"
                              >
                                {b.reagentName}
                              </Link>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <span className="text-[11px] font-mono-tabular text-ink-500">
                                  {b.reagentCode}
                                </span>
                                <span className="text-ink-200">·</span>
                                <span className="text-[11px] font-mono-tabular text-ink-600">
                                  {b.batchNo}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TD>
                        <TD>
                          <Badge tone="brand" size="sm">
                            {b.category}
                          </Badge>
                        </TD>
                        <TD>
                          <HazardBadge level={b.hazardLevel} />
                        </TD>
                        <TD>
                          <div className="flex flex-col gap-1">
                            <span className="font-mono-tabular text-xs text-ink-800">
                              {fmt(b.expiryDate)}
                            </span>
                            <WarningBadge
                              expiryDate={b.expiryDate}
                              isLocked={b.isLocked}
                            />
                          </div>
                        </TD>
                        <TD>
                          <div className={cn("rounded-lg px-3 py-2", colors.bg, colors.border, "border")}>
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className={cn("font-medium flex items-center gap-1", colors.text)}>
                                <Clock className="h-3 w-3" />
                                {wl.label}
                              </span>
                              <span className="font-mono-tabular font-semibold text-ink-700">
                                {b.isLocked ? "∞" : `${days}天`}
                              </span>
                            </div>
                            <ProgressBar
                              value={b.isLocked ? 0 : Math.max(0, MAX_WARNING_DAYS - days)}
                              max={MAX_WARNING_DAYS}
                              tone={wl.level}
                            />
                          </div>
                        </TD>
                        <TD className="text-right">
                          <span className="font-mono-tabular text-sm font-semibold text-ink-800">
                            {withComma(b.remainingQty)}
                          </span>
                          <span className="text-xs text-ink-400 ml-1">{b.unit}</span>
                          <div className="text-[11px] text-ink-400 mt-0.5">
                            入库 {withComma(b.quantity)} {b.unit}
                          </div>
                        </TD>
                        <TD className="text-right">
                          <span className="font-mono-tabular text-sm font-semibold text-ink-800">
                            {currency(b.remainingQty * b.unitPrice)}
                          </span>
                        </TD>
                        <TD>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<ArrowRightCircle className="h-3.5 w-3.5" />}
                              onClick={() => {
                                setSelectedIds(new Set([b.id]));
                                setPriorityModalOpen(true);
                              }}
                            >
                              优先
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<CalendarClock className="h-3.5 w-3.5" />}
                              onClick={() => {
                                setSelectedIds(new Set([b.id]));
                                setExtendModalOpen(true);
                              }}
                            >
                              延期
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<FileText className="h-3.5 w-3.5" />}
                              onClick={() => {
                                setSelectedIds(new Set([b.id]));
                                setDestroyModalOpen(true);
                              }}
                            >
                              销毁
                            </Button>
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Tabular>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal
        open={priorityModalOpen}
        onClose={() => setPriorityModalOpen(false)}
        title="标记优先使用"
        subtitle={`将为 ${selectedIds.size} 个批次标记为优先使用，领用申请时会优先推荐。`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPriorityModalOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={handleMarkPriority}>
              确认标记
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
            <div className="text-xs font-medium text-emerald-800 mb-1">影响批次</div>
            <div className="text-sm text-emerald-700">
              {selectedBatches.map((b) => `${b.reagentName} (${b.batchNo})`).join("、")}
            </div>
          </div>
          <Textarea
            label="备注说明（可选）"
            placeholder="例如：项目紧急需求、库存周转策略等"
            value={actionRemark}
            onChange={(e) => setActionRemark(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={extendModalOpen}
        onClose={() => setExtendModalOpen(false)}
        title="申请效期延期"
        subtitle={`将为 ${selectedIds.size} 个批次提交效期延期申请，需经过质量复检和审批。`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setExtendModalOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={handleExtendExpiry}>
              提交申请
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <div className="text-xs font-medium text-amber-800 mb-1">影响批次</div>
            <div className="text-sm text-amber-700">
              {selectedBatches.map((b) => `${b.reagentName} (${b.batchNo})`).join("、")}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">延长天数</label>
              <select
                className="w-full px-3 py-2 text-sm rounded-md border border-ink-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition"
                value={extendDays}
                onChange={(e) => setExtendDays(e.target.value)}
              >
                <option value="7">7 天</option>
                <option value="15">15 天</option>
                <option value="30">30 天</option>
                <option value="60">60 天</option>
                <option value="90">90 天</option>
              </select>
            </div>
            <div>
              <label className="label">原效期 ~ 新效期（预览）</label>
              <div className="text-sm text-ink-600 py-2">
                {selectedBatches[0]
                  ? `${fmt(selectedBatches[0].expiryDate)} → ${fmt(
                      (() => {
                        const d = new Date(selectedBatches[0].expiryDate);
                        d.setDate(d.getDate() + parseInt(extendDays));
                        return d.toISOString().slice(0, 10);
                      })()
                    )}`
                  : "-"}
              </div>
            </div>
          </div>
          <Textarea
            label="延期原因（必填）"
            placeholder="请详细说明质量复检结果、稳定性数据等依据"
            value={actionRemark}
            onChange={(e) => setActionRemark(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={destroyModalOpen}
        onClose={() => setDestroyModalOpen(false)}
        title="生成销毁单"
        subtitle={`将为 ${selectedIds.size} 个批次生成销毁申请单，按危化品管理规范执行销毁流程。`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDestroyModalOpen(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleCreateDestroy}>
              确认生成销毁单
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-4">
            <div className="text-xs font-medium text-rose-800 mb-2 flex items-center gap-1">
              <Trash2 className="h-3.5 w-3.5" />
              待销毁批次清单
            </div>
            <div className="space-y-1">
              {selectedBatches.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between text-sm text-rose-700"
                >
                  <span>
                    {b.reagentName} ({b.batchNo})
                  </span>
                  <span className="font-mono-tabular">
                    {withComma(b.remainingQty)} {b.unit} ·{" "}
                    {currency(b.remainingQty * b.unitPrice)}
                  </span>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-rose-200 flex justify-between text-sm font-semibold text-rose-800">
                <span>合计金额</span>
                <span>
                  {currency(
                    selectedBatches.reduce(
                      (sum, b) => sum + b.remainingQty * b.unitPrice,
                      0
                    )
                  )}
                </span>
              </div>
            </div>
          </div>
          <Textarea
            label="销毁原因"
            placeholder="例如：已过有效期、质量不合格、项目终止等"
            value={actionRemark}
            onChange={(e) => setActionRemark(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};

export default WarningCenter;
