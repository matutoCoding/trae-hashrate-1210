import * as React from "react";
import { Link } from "react-router-dom";
import {
  Lock,
  Unlock,
  Trash2,
  Printer,
  Search,
  Filter,
  AlertOctagon,
  CalendarX,
  DollarSign,
  Archive,
  Eye,
  FileCheck,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, CardTitle, CardSubTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Input";
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
  KpiCard,
} from "@/components/reagent/ReagentBadges";
import { useBatchStore } from "@/store/useBatchStore";
import {
  fmt,
  currency,
  withComma,
  getWarningLevel,
  remainingDays,
} from "@/utils/date";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import type { ReagentBatch, HazardLevel } from "@/types";

const hazardOptions: Array<{ label: string; value: string }> = [
  { label: "全部危化等级", value: "all" },
  { label: "普通", value: "无" },
  { label: "易燃", value: "易燃" },
  { label: "易爆", value: "易爆" },
  { label: "有毒", value: "有毒" },
  { label: "腐蚀性", value: "腐蚀性" },
  { label: "易制毒", value: "易制毒" },
  { label: "易制爆", value: "易制爆" },
];

const ExpiredList: React.FC = () => {
  const toast = useToast();
  const batches = useBatchStore((s) => s.batches);
  const unlockBatch = useBatchStore((s) => s.unlockBatch);
  const updateBatch = useBatchStore((s) => s.updateBatch);

  const [searchText, setSearchText] = React.useState("");
  const [hazardFilter, setHazardFilter] = React.useState<string>("all");
  const [reasonFilter, setReasonFilter] = React.useState<string>("all");

  const [unlockModalOpen, setUnlockModalOpen] = React.useState(false);
  const [destroyModalOpen, setDestroyModalOpen] = React.useState(false);
  const [currentBatch, setCurrentBatch] = React.useState<ReagentBatch | null>(null);
  const [actionRemark, setActionRemark] = React.useState("");
  const [reviewerName, setReviewerName] = React.useState("");

  const expiredBatches = React.useMemo(() => {
    return batches
      .filter((b) => {
        if (b.remainingQty <= 0) return false;
        const days = remainingDays(b.expiryDate);
        return b.isLocked || days <= 0;
      })
      .sort((a, b) => {
        const daysA = remainingDays(a.expiryDate);
        const daysB = remainingDays(b.expiryDate);
        if (daysA !== daysB) return daysA - daysB;
        return a.expiryDate.localeCompare(b.expiryDate);
      });
  }, [batches]);

  const filtered = React.useMemo(() => {
    return expiredBatches.filter((b) => {
      if (hazardFilter !== "all" && b.hazardLevel !== hazardFilter) return false;
      if (reasonFilter !== "all") {
        const reason = b.lockReason || "";
        if (reasonFilter === "expired" && !reason.includes("过期")) return false;
        if (reasonFilter === "manual" && !reason.includes("人工")) return false;
        if (reasonFilter === "quality" && !reason.includes("质量")) return false;
      }
      if (searchText) {
        const kw = searchText.toLowerCase();
        return (
          b.reagentName.toLowerCase().includes(kw) ||
          b.reagentCode.toLowerCase().includes(kw) ||
          b.batchNo.toLowerCase().includes(kw) ||
          (b.lockReason?.toLowerCase().includes(kw) ?? false)
        );
      }
      return true;
    });
  }, [expiredBatches, searchText, hazardFilter, reasonFilter]);

  const stats = React.useMemo(() => {
    let systemLocked = 0;
    let manualLocked = 0;
    let totalQty = 0;
    let totalValue = 0;
    expiredBatches.forEach((b) => {
      const reason = b.lockReason || "";
      if (reason.includes("人工")) manualLocked++;
      else systemLocked++;
      totalQty += b.remainingQty;
      totalValue += b.remainingQty * b.unitPrice;
    });
    return {
      total: expiredBatches.length,
      systemLocked,
      manualLocked,
      totalQty,
      totalValue,
    };
  }, [expiredBatches]);

  const expiredDays = (b: ReagentBatch) => {
    const days = remainingDays(b.expiryDate);
    return days <= 0 ? Math.abs(days) : 0;
  };

  const openUnlockModal = (b: ReagentBatch) => {
    setCurrentBatch(b);
    setActionRemark("");
    setReviewerName("");
    setUnlockModalOpen(true);
  };

  const openDestroyModal = (b: ReagentBatch) => {
    setCurrentBatch(b);
    setActionRemark("");
    setDestroyModalOpen(true);
  };

  const handleUnlock = () => {
    if (!currentBatch) return;
    if (!reviewerName.trim()) {
      toast.error("请填写复核人姓名", "人工解锁需要实名复核");
      return;
    }
    unlockBatch(currentBatch.id);
    updateBatch(currentBatch.id, {
      inspectionRemark: `[人工解锁] 复核人:${reviewerName} ${actionRemark || ""} ${new Date().toLocaleDateString()}`,
    });
    toast.success(
      "批次已解锁",
      `${currentBatch.reagentName} (${currentBatch.batchNo}) 已由 ${reviewerName} 复核解锁`
    );
    setUnlockModalOpen(false);
    setCurrentBatch(null);
  };

  const handleDestroy = () => {
    if (!currentBatch) return;
    updateBatch(currentBatch.id, {
      isLocked: true,
      lockReason: `申请销毁：${actionRemark || "过期报废"}`,
      inspectionRemark: `[待销毁] ${actionRemark || "过期报废"} ${new Date().toLocaleDateString()}`,
    });
    toast.success(
      "销毁申请已提交",
      `请在危化品管理中跟踪 ${currentBatch.reagentName} 的销毁审批流程`
    );
    setDestroyModalOpen(false);
    setCurrentBatch(null);
  };

  const handlePrint = (b: ReagentBatch) => {
    const wl = getWarningLevel(b.expiryDate, b.isLocked);
    const content = `
╔══════════════════════════════════════════╗
║          试剂销毁申请单                    ║
╠══════════════════════════════════════════╣
║  单据编号: DS-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${b.batchNo.slice(-4)}   ║
║  打印时间: ${fmt(new Date(), 'yyyy-MM-dd HH:mm')}                    ║
╠══════════════════════════════════════════╣
║  试剂名称: ${b.reagentName.padEnd(30)}║
║  试剂编码: ${b.reagentCode.padEnd(30)}║
║  批次号:   ${b.batchNo.padEnd(30)}║
║  CAS号:    ${(b.casNo || '-').padEnd(30)}║
║  类  别:   ${b.category.padEnd(30)}║
║  危化等级: ${b.hazardLevel.padEnd(30)}║
╠══════════════════════════════════════════╣
║  生产厂家: ${(b.manufacturer || '-').padEnd(30)}║
║  生产批号: ${b.batchNo.padEnd(30)}║
║  生产日期: ${fmt(b.productionDate).padEnd(30)}║
║  有效日期: ${fmt(b.expiryDate).padEnd(30)}║
║  过期天数: ${String(expiredDays(b)).padEnd(30)}║
╠══════════════════════════════════════════╣
║  销毁原因: ${(b.lockReason || '已过有效期').padEnd(30)}║
║  剩余数量: ${String(b.remainingQty).padEnd(10)} ${b.unit.padEnd(18)}║
║  库存金额: ${currency(b.remainingQty * b.unitPrice).padEnd(30)}║
╠══════════════════════════════════════════╣
║  保管员: __________    安全员: _________║
║                                          ║
║  主任审批: _________   日期: ___________║
╚══════════════════════════════════════════╝
    `.trim();
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(
        `<pre style="font-family:Consolas,monospace;font-size:12px;line-height:1.6;padding:20px">${content}</pre>`
      );
      w.document.close();
      setTimeout(() => w.print(), 200);
    }
    toast.success("销毁单已发送打印");
  };

  const getReasonTone = (reason?: string) => {
    if (!reason) return "default" as const;
    if (reason.includes("过期")) return "danger" as const;
    if (reason.includes("人工")) return "warning" as const;
    if (reason.includes("销毁")) return "hazard" as const;
    return "default" as const;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="过期锁定管理"
        subtitle="管理已过期或被锁定的试剂批次，支持人工复核解锁、申请销毁和打印销毁单。"
        icon={<Lock className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/inventory">
              <Button variant="outline" size="md">
                返回库存
              </Button>
            </Link>
            <Link to="/inventory/warning">
              <Button variant="primary" size="md" leftIcon={<AlertOctagon className="h-4 w-4" />}>
                临期预警
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="锁定批次总计"
          value={stats.total}
          suffix="批"
          tone="danger"
          icon={<Lock className="h-5 w-5" />}
          sub="已过期或人工锁定"
        />
        <KpiCard
          label="系统自动锁定"
          value={stats.systemLocked}
          suffix="批"
          tone="warning"
          icon={<CalendarX className="h-5 w-5" />}
          sub="超过有效期自动锁定"
        />
        <KpiCard
          label="人工锁定"
          value={stats.manualLocked}
          suffix="批"
          tone="hazard"
          icon={<ShieldCheck className="h-5 w-5" />}
          sub="质量问题/待复核"
        />
        <KpiCard
          label="涉及数量"
          value={withComma(stats.totalQty)}
          tone="warning"
          icon={<Archive className="h-5 w-5" />}
          sub="待处理库存总量"
        />
        <KpiCard
          label="涉及金额"
          value={currency(stats.totalValue).replace("¥", "")}
          suffix="元"
          tone="danger"
          icon={<DollarSign className="h-5 w-5" />}
          sub="潜在报废损失"
        />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-rose-500" />
              过期 / 锁定批次列表
            </CardTitle>
            <CardSubTitle>
              已过期批次禁止出库。人工解锁需经双人复核，审批留痕。
            </CardSubTitle>
          </div>
          <div className="text-xs text-ink-500">
            共 <span className="font-semibold text-ink-800">{filtered.length}</span> 条记录
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="flex-1 max-w-sm">
                <Input
                  placeholder="搜索试剂/编码/批号/锁定原因"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  leading={<Search className="h-4 w-4" />}
                />
              </div>
              <div className="w-44">
                <Select
                  value={hazardFilter}
                  onChange={(e) => setHazardFilter(e.target.value)}
                  options={hazardOptions}
                />
              </div>
              <div className="w-44">
                <Select
                  value={reasonFilter}
                  onChange={(e) => setReasonFilter(e.target.value)}
                  options={[
                    { label: "全部原因", value: "all" },
                    { label: "过期自动锁定", value: "expired" },
                    { label: "人工锁定", value: "manual" },
                    { label: "待销毁", value: "quality" },
                  ]}
                />
              </div>
              <Button
                variant="ghost"
                size="md"
                leftIcon={<Filter className="h-4 w-4" />}
                onClick={() => {
                  setSearchText("");
                  setHazardFilter("all");
                  setReasonFilter("all");
                }}
              >
                重置
              </Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <Empty text="没有匹配的锁定批次" icon={<ShieldCheck className="h-6 w-6" />} />
          ) : (
            <Table>
              <Tabular>
                <THead sticky>
                  <TR hoverable={false}>
                    <TH>试剂 / 批次</TH>
                    <TH>类别</TH>
                    <TH>危化</TH>
                    <TH>效期信息</TH>
                    <TH className="text-right">过期天数</TH>
                    <TH>锁定原因</TH>
                    <TH className="text-right">剩余量</TH>
                    <TH className="text-right">金额</TH>
                    <TH className="text-right">操作</TH>
                  </TR>
                </THead>
                <TBody>
                  {filtered.map((b) => {
                    const wl = getWarningLevel(b.expiryDate, b.isLocked);
                    const exDays = expiredDays(b);
                    return (
                      <TR key={b.id} tone="danger">
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
                        <TD className="text-right">
                          {exDays > 0 ? (
                            <div className="inline-flex flex-col items-end">
                              <span className="font-mono-tabular text-sm font-bold text-warning-red">
                                {exDays}
                              </span>
                              <span className="text-[10px] text-warning-red/80">天</span>
                            </div>
                          ) : (
                            <Badge tone="warning" size="sm">
                              未过期
                            </Badge>
                          )}
                        </TD>
                        <TD>
                          <Badge tone={getReasonTone(b.lockReason)} size="sm" dot>
                            <Lock className="h-3 w-3 mr-0.5" />
                            {(b.lockReason || "系统锁定").slice(0, 12)}
                            {(b.lockReason || "").length > 12 ? "..." : ""}
                          </Badge>
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
                          <span className="font-mono-tabular text-sm font-semibold text-rose-700">
                            {currency(b.remainingQty * b.unitPrice)}
                          </span>
                        </TD>
                        <TD>
                          <div className="flex items-center justify-end gap-1">
                            <Link to={`/batch/${b.id}`}>
                              <Button variant="ghost" size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />}>
                                详情
                              </Button>
                            </Link>
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<Unlock className="h-3.5 w-3.5" />}
                              onClick={() => openUnlockModal(b)}
                            >
                              解锁
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                              onClick={() => openDestroyModal(b)}
                            >
                              销毁
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<Printer className="h-3.5 w-3.5" />}
                              onClick={() => handlePrint(b)}
                            >
                              打印
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
        open={unlockModalOpen}
        onClose={() => setUnlockModalOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <Unlock className="h-5 w-5 text-success-500" />
            人工复核解锁
          </span>
        }
        subtitle="解锁后该批次将可正常出库。请务必确认试剂质量仍然合格，并填写实名复核信息。"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setUnlockModalOpen(false)}>
              取消
            </Button>
            <Button variant="success" onClick={handleUnlock}>
              <FileCheck className="h-4 w-4 mr-1" />
              确认解锁
            </Button>
          </>
        }
      >
        {currentBatch && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] text-emerald-600 font-medium">试剂名称</div>
                  <div className="font-semibold text-emerald-900">{currentBatch.reagentName}</div>
                </div>
                <div>
                  <div className="text-[11px] text-emerald-600 font-medium">批次号</div>
                  <div className="font-mono-tabular text-emerald-900">{currentBatch.batchNo}</div>
                </div>
                <div>
                  <div className="text-[11px] text-emerald-600 font-medium">效期至</div>
                  <div className="font-mono-tabular text-emerald-900">{fmt(currentBatch.expiryDate)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-emerald-600 font-medium">剩余量</div>
                  <div className="font-mono-tabular text-emerald-900">
                    {withComma(currentBatch.remainingQty)} {currentBatch.unit}
                  </div>
                </div>
              </div>
              {currentBatch.lockReason && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <div className="text-[11px] text-emerald-600 font-medium mb-1">当前锁定原因</div>
                  <div className="text-sm text-emerald-800">{currentBatch.lockReason}</div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">
                  复核人姓名 <span className="text-warning-red">*</span>
                </label>
                <Input
                  placeholder="请输入复核人真实姓名（实名留痕）"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                />
              </div>
              <Textarea
                label="复核说明"
                placeholder="请说明质量复检结论、使用限制条件、延期依据等"
                value={actionRemark}
                onChange={(e) => setActionRemark(e.target.value)}
              />
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 flex items-start gap-2">
              <AlertOctagon className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800 leading-5">
                <strong>安全提示：</strong>
                对于已过有效期的试剂，解锁可能带来实验数据失真和安全风险。
                建议优先考虑非关键实验使用，并加强使用前的性状检查。
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={destroyModalOpen}
        onClose={() => setDestroyModalOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-warning-red" />
            申请销毁
          </span>
        }
        subtitle="提交销毁申请后，批次将保持锁定状态，等待危化品管理审批和实际销毁执行。"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDestroyModalOpen(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleDestroy}>
              <Trash2 className="h-4 w-4 mr-1" />
              确认申请销毁
            </Button>
          </>
        }
      >
        {currentBatch && (
          <div className="space-y-4">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
              <div className="text-xs font-medium text-rose-800 mb-2">待销毁批次信息</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] text-rose-600">试剂</div>
                  <div className="font-semibold text-rose-900">{currentBatch.reagentName}</div>
                </div>
                <div>
                  <div className="text-[11px] text-rose-600">批次号</div>
                  <div className="font-mono-tabular text-rose-900">{currentBatch.batchNo}</div>
                </div>
                <div>
                  <div className="text-[11px] text-rose-600">危化等级</div>
                  <div>{currentBatch.hazardLevel}</div>
                </div>
                <div>
                  <div className="text-[11px] text-rose-600">过期天数</div>
                  <div className="font-semibold text-rose-900">{expiredDays(currentBatch)} 天</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-rose-200 flex justify-between">
                <div>
                  <div className="text-[11px] text-rose-600">销毁数量</div>
                  <div className="font-mono-tabular font-semibold text-rose-900">
                    {withComma(currentBatch.remainingQty)} {currentBatch.unit}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-rose-600">销毁金额</div>
                  <div className="font-mono-tabular font-bold text-warning-red">
                    {currency(currentBatch.remainingQty * currentBatch.unitPrice)}
                  </div>
                </div>
              </div>
            </div>

            <Textarea
              label="销毁原因说明"
              placeholder="请详细说明销毁原因（过期、质量问题、项目终止等）"
              value={actionRemark}
              onChange={(e) => setActionRemark(e.target.value)}
            />

            <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 flex items-start gap-2">
              <AlertOctagon className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
              <div className="text-xs text-rose-800 leading-5">
                <strong>合规提示：</strong>
                危化品销毁需遵循《危险化学品安全管理条例》，
                由有资质的机构处理，并保留完整的销毁记录和签字凭证。
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExpiredList;
