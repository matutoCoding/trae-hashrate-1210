import * as React from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Send,
  User,
  Building2,
  FileText,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Circle,
  ChevronDown,
  Sparkles,
  QrCode,
} from "lucide-react";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Tabular,
} from "@/components/ui/Table";
import { HazardBadge, WarningBadge } from "@/components/reagent/ReagentBadges";
import { useCurrentUser } from "@/store/useAuthStore";
import { useBatchStore } from "@/store/useBatchStore";
import { useApprovalStore } from "@/store/useApprovalStore";
import { useRequisitionStore } from "@/store/useRequisitionStore";
import { useFifo } from "@/hooks/useFifo";
import { useRouteMatcher } from "@/hooks/useRouteMatcher";
import type { RequisitionItem, ReagentBatch, ApprovalNode } from "@/types";
import { fmt, currency, withComma, getWarningLevel, uid } from "@/utils/date";
import { cn } from "@/lib/utils";

interface ReagentRow {
  id: string;
  reagentCode: string;
  requiredQty: number;
}

const RequisitionNew: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get("draft");

  const user = useCurrentUser();
  const { batches } = useBatchStore();
  const { rules } = useApprovalStore();
  const { createRequisition, submitApproval, findById } = useRequisitionStore();
  const toast = useToast();

  const [purpose, setPurpose] = React.useState("");
  const [purposeError, setPurposeError] = React.useState("");
  const [rows, setRows] = React.useState<ReagentRow[]>([
    { id: "row_" + uid().slice(0, 6), reagentCode: "", requiredQty: 0 },
  ]);
  const [expandedRow, setExpandedRow] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const reagentOptions = React.useMemo(() => {
    const map = new Map<string, { code: string; name: string; hazard: string }>();
    const today = new Date().toISOString().slice(0, 10);
    batches
      .filter((b) => !b.isLocked && (b.remainingQty - (b.frozenQty || 0)) > 0 && b.inspectionPassed && b.expiryDate >= today)
      .forEach((b) => {
        if (!map.has(b.reagentCode)) {
          map.set(b.reagentCode, {
            code: b.reagentCode,
            name: b.reagentName,
            hazard: b.hazardLevel,
          });
        }
      });
    return Array.from(map.values());
  }, [batches]);

  React.useEffect(() => {
    if (draftId) {
      const draft = findById(draftId);
      if (draft && draft.approvalStatus === "draft") {
        setPurpose(draft.purpose);
        const grouped = new Map<string, number>();
        draft.items.forEach((it) => {
          grouped.set(it.reagentCode, (grouped.get(it.reagentCode) || 0) + it.quantity);
        });
        const newRows: ReagentRow[] = Array.from(grouped.entries()).map(([code, qty]) => ({
          id: "row_" + uid().slice(0, 6),
          reagentCode: code,
          requiredQty: qty,
        }));
        if (newRows.length > 0) setRows(newRows);
      } else if (draft && draft.approvalStatus === "returned") {
        setPurpose(draft.purpose);
        const grouped = new Map<string, number>();
        draft.items.forEach((it) => {
          grouped.set(it.reagentCode, (grouped.get(it.reagentCode) || 0) + it.quantity);
        });
        const newRows: ReagentRow[] = Array.from(grouped.entries()).map(([code, qty]) => ({
          id: "row_" + uid().slice(0, 6),
          reagentCode: code,
          requiredQty: qty,
        }));
        if (newRows.length > 0) setRows(newRows);
      }
    }
  }, [draftId, findById]);

  const rowFifoResults = React.useMemo(() => {
    const map = new Map<string, ReturnType<typeof useFifo>>();
    rows.forEach((row) => {
      if (row.reagentCode && row.requiredQty > 0) {
        const result = (() => {
          const today = new Date().toISOString().slice(0, 10);
          const candidates = batches
            .filter(
              (b) =>
                b.reagentCode === row.reagentCode &&
                (b.remainingQty - (b.frozenQty || 0)) > 0 &&
                !b.isLocked &&
                b.inspectionPassed &&
                b.expiryDate >= today
            )
            .sort((a, b) => {
              const cmp = a.expiryDate.localeCompare(b.expiryDate);
              if (cmp !== 0) return cmp;
              return a.arrivalDate.localeCompare(b.arrivalDate);
            });

          const resultItems: (RequisitionItem & { allocatedQty: number })[] = [];
          let accumulated = 0;
          let totalAvailable = 0;

          candidates.forEach((b) => {
            totalAvailable += b.remainingQty - (b.frozenQty || 0);
          });

          for (const b of candidates) {
            if (accumulated >= row.requiredQty) break;
            const remainNeed = row.requiredQty - accumulated;
            const available = b.remainingQty - (b.frozenQty || 0);
            const allocate = Math.min(remainNeed, available);
            resultItems.push({
              id: "fi_" + uid().slice(0, 6),
              batchId: b.id,
              reagentCode: b.reagentCode,
              reagentName: b.reagentName,
              batchNo: b.batchNo,
              expiryDate: b.expiryDate,
              quantity: allocate,
              unit: b.unit,
              unitPrice: b.unitPrice,
              subtotal: +(allocate * b.unitPrice).toFixed(2),
              isFifoRecommended: accumulated === 0,
              allocatedQty: allocate,
            });
            accumulated += allocate;
          }
          return {
            items: resultItems,
            totalAvailable,
            sufficient: accumulated >= row.requiredQty,
            shortage: Math.max(0, row.requiredQty - accumulated),
          };
        })();
        map.set(row.id, result);
      }
    });
    return map;
  }, [rows, batches]);

  const allItems: RequisitionItem[] = React.useMemo(() => {
    const items: RequisitionItem[] = [];
    rows.forEach((row) => {
      const result = rowFifoResults.get(row.id);
      if (result) {
        result.items.forEach((it) => {
          items.push({
            id: it.id,
            batchId: it.batchId,
            reagentCode: it.reagentCode,
            reagentName: it.reagentName,
            batchNo: it.batchNo,
            expiryDate: it.expiryDate,
            quantity: it.quantity,
            unit: it.unit,
            unitPrice: it.unitPrice,
            subtotal: it.subtotal,
            isFifoRecommended: it.isFifoRecommended,
          });
        });
      }
    });
    return items;
  }, [rows, rowFifoResults]);

  const totalQty = React.useMemo(
    () => allItems.reduce((sum, it) => sum + it.quantity, 0),
    [allItems]
  );
  const totalAmount = React.useMemo(
    () => +allItems.reduce((sum, it) => sum + it.subtotal, 0).toFixed(2),
    [allItems]
  );

  const hasHazard = React.useMemo(() => {
    return allItems.some((it) => {
      const bat = batches.find((b) => b.id === it.batchId);
      return bat && bat.hazardLevel !== "无";
    });
  }, [allItems, batches]);

  const routeMatch = useRouteMatcher(
    allItems.length > 0 ? { totalAmount, items: allItems } : null,
    batches,
    rules
  );

  const workflowNodes = React.useMemo(() => {
    if (!routeMatch?.rule?.workflow) return [];
    return routeMatch.rule.workflow.nodes.filter(
      (n) => n.type === "start" || n.type === "approve" || n.type === "end"
    );
  }, [routeMatch]);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { id: "row_" + uid().slice(0, 6), reagentCode: "", requiredQty: 0 },
    ]);
  };

  const removeRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (expandedRow === id) setExpandedRow(null);
  };

  const updateRow = (id: string, patch: Partial<ReagentRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const validateForm = (): boolean => {
    let ok = true;
    if (!purpose.trim()) {
      setPurposeError("请填写用途说明");
      ok = false;
    } else if (purpose.trim().length < 5) {
      setPurposeError("用途说明至少5个字符");
      ok = false;
    } else {
      setPurposeError("");
    }

    const validRows = rows.filter((r) => r.reagentCode && r.requiredQty > 0);
    if (validRows.length === 0) {
      toast.error("请添加试剂", "至少选择一种试剂并填写需求数量");
      ok = false;
    }

    for (const row of validRows) {
      const fifo = rowFifoResults.get(row.id);
      if (fifo && !fifo.sufficient) {
        const opt = reagentOptions.find((o) => o.code === row.reagentCode);
        toast.error(
          "库存不足",
          `${opt?.name || row.reagentCode} 需求 ${row.requiredQty}，库存仅 ${fifo.totalAvailable}`
        );
        ok = false;
      }
    }

    return ok;
  };

  const handleSaveDraft = async () => {
    if (!user) return;
    if (!validateForm()) return;
    setSaving(true);
    try {
      const data = {
        applicantId: user.id,
        applicantName: user.realName,
        department: user.department,
        purpose: purpose.trim(),
        items: allItems,
        totalAmount,
        status: "draft" as const,
      };
      const req = createRequisition(data);
      toast.success("草稿已保存", `单号 ${req.id}`);
      navigate("/requisition");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!validateForm()) return;
    if (!routeMatch?.rule) {
      toast.error("无法匹配审批流", "请检查申请内容");
      return;
    }
    setSubmitting(true);
    try {
      const data = {
        applicantId: user.id,
        applicantName: user.realName,
        department: user.department,
        purpose: purpose.trim(),
        items: allItems,
        totalAmount,
        status: "draft" as const,
      };
      const req = createRequisition(data);
      const firstApproveNode = routeMatch.rule.workflow.nodes.find(
        (n) => n.type === "approve"
      );
      submitApproval(
        req.id,
        routeMatch.rule.id,
        routeMatch.rule.name,
        firstApproveNode?.id || ""
      );
      toast.success("已提交审批", `单号 ${req.id}，进入${routeMatch.rule.name}`);
      navigate("/requisition");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/requisition">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-ink-900">新建领用申请</h1>
            <p className="text-xs text-ink-500 mt-0.5">
              填写领用信息 → 系统自动匹配审批流 → 提交审批
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-brand-500" />
                <CardTitle>申请人信息</CardTitle>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">申请人</label>
                  <div className="flex items-center gap-2.5 h-9 px-3 rounded-md border border-ink-200 bg-ink-50">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
                      {user?.realName?.[0] || "U"}
                    </div>
                    <span className="text-sm text-ink-800 font-medium">{user?.realName}</span>
                  </div>
                </div>
                <div>
                  <label className="label">所属部门</label>
                  <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-ink-200 bg-ink-50">
                    <Building2 className="h-4 w-4 text-ink-400" />
                    <span className="text-sm text-ink-800">{user?.department}</span>
                  </div>
                </div>
                <div>
                  <label className="label">申请日期</label>
                  <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-ink-200 bg-ink-50">
                    <FileText className="h-4 w-4 text-ink-400" />
                    <span className="text-sm font-mono-tabular text-ink-800">
                      {fmt(new Date())}
                    </span>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-500" />
                <CardTitle>用途说明</CardTitle>
                <Badge tone="danger" size="sm">必填</Badge>
              </div>
            </CardHeader>
            <CardBody>
              <Textarea
                placeholder="请详细描述领用用途，包括实验项目、检测内容等信息（至少5个字符）"
                value={purpose}
                onChange={(e) => {
                  setPurpose(e.target.value);
                  if (purposeError) setPurposeError("");
                }}
                error={purposeError}
                rows={4}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-500" />
                  <CardTitle>试剂选择</CardTitle>
                  <Badge tone="brand" size="sm">
                    FIFO 自动推荐
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                  onClick={addRow}
                >
                  添加行
                </Button>
              </div>
            </CardHeader>
            <CardBody className="!p-0">
              <Table>
                <Tabular>
                  <THead sticky>
                    <TR hoverable={false}>
                      <TH className="w-10"></TH>
                      <TH className="w-[280px]">试剂</TH>
                      <TH className="w-[140px]">需求数量</TH>
                      <TH>库存状态 / FIFO 推荐批次</TH>
                      <TH className="w-[120px]">小计金额</TH>
                      <TH className="w-16 text-right">操作</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {rows.map((row) => {
                      const opt = reagentOptions.find((o) => o.code === row.reagentCode);
                      const fifo = rowFifoResults.get(row.id);
                      const rowTotal = fifo
                        ? fifo.items.reduce((s, it) => s + it.subtotal, 0)
                        : 0;
                      const isExpanded = expandedRow === row.id;
                      const unit = opt
                        ? batches.find((b) => b.reagentCode === opt.code)?.unit
                        : "";

                      return (
                        <React.Fragment key={row.id}>
                          <TR>
                            <TD>
                              <button
                                onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                                className="h-7 w-7 rounded-md flex items-center justify-center text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition"
                                disabled={!fifo || fifo.items.length === 0}
                              >
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 transition-transform",
                                    isExpanded && "rotate-180"
                                  )}
                                />
                              </button>
                            </TD>
                            <TD>
                              <Select
                                value={row.reagentCode}
                                onChange={(e) => updateRow(row.id, { reagentCode: e.target.value })}
                                options={[
                                  { label: "请选择试剂", value: "", disabled: true },
                                  ...reagentOptions.map((o) => ({
                                    label: `${o.code} ${o.name}${o.hazard !== "无" ? " ⚠" : ""}`,
                                    value: o.code,
                                  })),
                                ]}
                              />
                              {opt && opt.hazard !== "无" && (
                                <div className="mt-1.5">
                                  <HazardBadge level={opt.hazard as any} />
                                </div>
                              )}
                            </TD>
                            <TD>
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                trailing={unit && <span className="text-xs text-ink-400">{unit}</span>}
                                value={row.requiredQty || ""}
                                onChange={(e) =>
                                  updateRow(row.id, {
                                    requiredQty: Number(e.target.value) || 0,
                                  })
                                }
                                placeholder="0"
                              />
                              {fifo && (
                                <div className="mt-1.5 flex items-center gap-2">
                                  {fifo.sufficient ? (
                                    <Badge tone="success" size="sm" dot>
                                      库存充足
                                    </Badge>
                                  ) : (
                                    <Badge tone="danger" size="sm" dot>
                                      缺{fifo.shortage}{unit}
                                    </Badge>
                                  )}
                                  <span className="text-[11px] text-ink-400">
                                    可用 {withComma(fifo.totalAvailable)}
                                  </span>
                                </div>
                              )}
                            </TD>
                            <TD>
                              {fifo && fifo.items.length > 0 ? (
                                <div className="space-y-1.5">
                                  {fifo.items.slice(0, isExpanded ? undefined : 1).map((it, idx) => {
                                    const bat = batches.find((b) => b.id === it.batchId);
                                    const wl = bat ? getWarningLevel(bat.expiryDate, bat.isLocked) : null;
                                    return (
                                      <div
                                        key={it.id}
                                        className={cn(
                                          "flex items-center gap-2 p-2 rounded-lg border text-xs",
                                          idx === 0
                                            ? "bg-emerald-50/60 border-emerald-200"
                                            : "bg-ink-50 border-ink-100"
                                        )}
                                      >
                                        {idx === 0 && (
                                          <div className="flex items-center gap-1 shrink-0">
                                            <span className="h-2 w-2 rounded-full bg-success-500 animate-pulse shadow-[0_0_0_3px_rgba(42,157,143,0.15)]" />
                                            <span className="text-[10px] font-semibold text-success-600">
                                              FIFO
                                            </span>
                                          </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono-tabular text-ink-800">
                                              {it.batchNo}
                                            </span>
                                            {wl && <WarningBadge expiryDate={it.expiryDate} />}
                                          </div>
                                          <div className="mt-0.5 text-[11px] text-ink-500">
                                            {fmt(it.expiryDate)} · 分配 {it.quantity}
                                            {it.unit} · 单价{currency(it.unitPrice)}
                                          </div>
                                        </div>
                                        <span className="font-mono-tabular font-semibold text-ink-800 shrink-0">
                                          {currency(it.subtotal)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                  {fifo.items.length > 1 && !isExpanded && (
                                    <button
                                      onClick={() => setExpandedRow(row.id)}
                                      className="text-[11px] text-brand-600 hover:text-brand-700 font-medium"
                                    >
                                      展开全部 {fifo.items.length} 个批次 →
                                    </button>
                                  )}
                                </div>
                              ) : row.reagentCode && row.requiredQty > 0 ? (
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                  无可用库存
                                </div>
                              ) : (
                                <span className="text-xs text-ink-400">选择试剂并填写数量后显示</span>
                              )}
                            </TD>
                            <TD>
                              <span
                                className={cn(
                                  "font-mono-tabular font-semibold text-sm",
                                  rowTotal > 0 ? "text-ink-800" : "text-ink-300"
                                )}
                              >
                                {currency(rowTotal)}
                              </span>
                            </TD>
                            <TD className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeRow(row.id)}
                                disabled={rows.length <= 1}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-ink-400 hover:text-warning-red" />
                              </Button>
                            </TD>
                          </TR>
                        </React.Fragment>
                      );
                    })}
                  </TBody>
                </Tabular>
              </Table>
            </CardBody>
          </Card>

          <Card className="sticky bottom-0 shadow-lg border-ink-200">
            <CardBody className="!py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-xs text-ink-500">明细项数：</span>
                  <Badge tone="brand" size="sm">
                    {allItems.length} 项
                  </Badge>
                </div>
                <div>
                  <span className="text-xs text-ink-500">总数量：</span>
                  <span className="font-mono-tabular font-semibold text-ink-800">
                    {withComma(totalQty)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-ink-500">申请总金额：</span>
                  <span className="font-mono-tabular text-xl font-bold text-brand-600">
                    {currency(totalAmount)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  leftIcon={<Save className="h-4 w-4" />}
                  onClick={handleSaveDraft}
                  loading={saving}
                  disabled={submitting}
                >
                  保存草稿
                </Button>
                <Button
                  variant="primary"
                  leftIcon={<Send className="h-4 w-4" />}
                  onClick={handleSubmit}
                  loading={submitting}
                  disabled={saving}
                >
                  提交审批
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="w-[340px] shrink-0 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-500" />
                <CardTitle>明细汇总</CardTitle>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-br from-brand-50 to-brand-100/40 border border-brand-100">
                <div>
                  <p className="text-[11px] text-brand-700 font-medium">总数量</p>
                  <p className="mt-0.5 text-xl font-bold font-mono-tabular text-brand-700">
                    {withComma(totalQty)}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-white/80 flex items-center justify-center text-brand-500">
                  <QrCode className="h-5 w-5" />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100/40 border border-emerald-100">
                <div>
                  <p className="text-[11px] text-emerald-700 font-medium">总金额</p>
                  <p className="mt-0.5 text-xl font-bold font-mono-tabular text-emerald-700">
                    {currency(totalAmount)}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-white/80 flex items-center justify-center text-success-500">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
              <div className="pt-2 border-t border-ink-100 space-y-1.5">
                {reagentOptions
                  .filter((o) => rows.some((r) => r.reagentCode === o.code))
                  .map((opt) => {
                    const row = rows.find((r) => r.reagentCode === opt.code);
                    const fifo = row ? rowFifoResults.get(row.id) : null;
                    const qty = fifo ? fifo.items.reduce((s, it) => s + it.quantity, 0) : 0;
                    return (
                      <div key={opt.code} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-ink-700 truncate max-w-[140px]">
                            {opt.name}
                          </span>
                          {opt.hazard !== "无" && (
                            <HazardBadge level={opt.hazard as any} size="sm" />
                          )}
                        </div>
                        <span className="font-mono-tabular text-ink-800 font-medium">
                          {withComma(qty)}
                          {batches.find((b) => b.reagentCode === opt.code)?.unit}
                        </span>
                      </div>
                    );
                  })}
                {allItems.length === 0 && (
                  <p className="text-xs text-ink-400 py-2 text-center italic">
                    暂无试剂明细
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-500" />
                <CardTitle>路由匹配预览</CardTitle>
              </div>
            </CardHeader>
            <CardBody>
              {routeMatch?.rule ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-brand-50/60 border border-brand-100">
                    <p className="text-[11px] text-brand-600 font-medium mb-1">匹配规则</p>
                    <p className="text-sm font-semibold text-brand-800">
                      {routeMatch.rule.name}
                    </p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {routeMatch.rule.conditions.map((c) => (
                        <Badge key={c.id} tone="brand" size="sm">
                          {c.field} {c.operator} {String(c.value)}
                        </Badge>
                      ))}
                      {routeMatch.rule.conditions.length === 0 && (
                        <Badge tone="default" size="sm">默认兜底</Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] text-ink-500 font-medium mb-3">审批流程图</p>
                    <div className="space-y-1">
                      {workflowNodes.map((node, idx) => {
                        const isStart = node.type === "start";
                        const isEnd = node.type === "end";
                        const isApprove = node.type === "approve";
                        return (
                          <React.Fragment key={node.id}>
                            <div className="flex items-center gap-2.5">
                              <div
                                className={cn(
                                  "h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold",
                                  isStart && "bg-ink-800 text-white",
                                  isEnd && "bg-success-500 text-white",
                                  isApprove && "bg-brand-500 text-white"
                                )}
                              >
                                {isStart ? (
                                  <Circle className="h-3 w-3" />
                                ) : isEnd ? (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                ) : (
                                  idx
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-ink-800">{node.label}</p>
                                {isApprove && node.assigneeRoles && (
                                  <p className="text-[10px] text-ink-400 mt-0.5">
                                    角色：{node.assigneeRoles.join("、")}
                                  </p>
                                )}
                                {isApprove && node.assigneeUserIds && node.assigneeUserIds.length > 0 && (
                                  <p className="text-[10px] text-ink-400 mt-0.5">
                                    指定审批人
                                  </p>
                                )}
                                {isApprove && (
                                  <div className="mt-1">
                                    <Badge
                                      tone={node.approvalMode === "and_sign" ? "warning" : "default"}
                                      size="sm"
                                    >
                                      {node.approvalMode === "and_sign" ? "会签" : "或签"}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </div>
                            {idx < workflowNodes.length - 1 && (
                              <div className="ml-3 flex items-center gap-0.5 h-4">
                                <div className="w-px h-full bg-ink-200 ml-[13px]" />
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <div className="h-12 w-12 mx-auto rounded-full bg-ink-100 flex items-center justify-center text-ink-300">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-xs text-ink-500">
                    请选择试剂并填写数量
                    <br />
                    系统将自动匹配审批分支
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          {hasHazard && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-hazard-500" />
                  <CardTitle>危化品资质提示</CardTitle>
                </div>
              </CardHeader>
              <CardBody>
                <div className="p-3 rounded-lg bg-violet-50 border border-violet-200 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-hazard-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-violet-800">
                        本次申请包含危化试剂
                      </p>
                      <p className="text-[11px] text-violet-600 mt-1 leading-4">
                        请确保操作人员持有有效的危化品操作资质，并严格按照安全规范执行领用和使用流程。
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-violet-200/60 space-y-1.5">
                    {Array.from(
                      new Set(
                        allItems
                          .map((it) => batches.find((b) => b.id === it.batchId))
                          .filter((b): b is ReagentBatch => !!b && b.hazardLevel !== "无")
                          .map((b) => b.hazardLevel)
                      )
                    ).map((level) => (
                      <div key={level} className="flex items-center justify-between text-xs">
                        <HazardBadge level={level as any} />
                        <Badge tone="hazard" size="sm">需专项审批</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequisitionNew;
