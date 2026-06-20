import * as React from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  Users,
  Eye,
  Package,
  BookmarkCheck,
  ShieldAlert,
  Filter,
  Search,
  ChevronRight,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardSubTitle, CardBody, Tabs } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Input";
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
import { PageHeader } from "@/components/layout/AppShell";
import { useBatchStore } from "@/store/useBatchStore";
import { useRequisitionStore } from "@/store/useRequisitionStore";
import { useApprovalStore } from "@/store/useApprovalStore";
import { useCurrentUser } from "@/store/useAuthStore";
import type { ReagentBatch } from "@/types";
import { fmt, fmtDateTime, currency, withComma, getWarningLevel } from "@/utils/date";
import { cn } from "@/lib/utils";

const SAFETY_STOCK_PCT = 0.2;
const HIGH_FROZEN_RATIO = 0.7;

type AlertType = "low_stock" | "high_frozen" | "both";

interface AlertBatch {
  batch: ReagentBatch;
  type: AlertType;
  availableQty: number;
  frozenQty: number;
  frozenRatio: number;
  availableRatio: number;
  affectedReqs: Array<{
    reqId: string;
    applicant: string;
    purpose: string;
    status: string;
    statusLabel: string;
    qty: number;
    currentNode?: string;
    createdAt: string;
  }>;
  totalAffectedQty: number;
}

const InventoryAlert: React.FC = () => {
  const user = useCurrentUser();
  const { batches } = useBatchStore();
  const { requisitions } = useRequisitionStore();
  const { rules } = useApprovalStore();

  const [filter, setFilter] = React.useState<"all" | AlertType>("all");
  const [keyword, setKeyword] = React.useState("");
  const [expandedBatchId, setExpandedBatchId] = React.useState<string | null>(null);

  const alertBatches = React.useMemo(() => {
    const list: AlertBatch[] = [];
    for (const b of batches) {
      if (b.isLocked) continue;
      const availableQty = Math.max(0, b.remainingQty - (b.frozenQty || 0));
      const frozenQty = b.frozenQty || 0;
      const availableRatio = b.quantity > 0 ? availableQty / b.quantity : 0;
      const frozenRatio = b.remainingQty > 0 ? frozenQty / b.remainingQty : 0;

      const lowStock = availableRatio < SAFETY_STOCK_PCT;
      const highFrozen = frozenRatio > HIGH_FROZEN_RATIO;
      if (!lowStock && !highFrozen) continue;

      const affectedReqs: AlertBatch["affectedReqs"] = [];
      const byReq = new Map<string, number>();
      for (const req of requisitions) {
        if (req.approvalStatus !== "pending" && req.approvalStatus !== "approved") continue;
        let qtyForBatch = 0;
        for (const it of req.items) {
          if (it.batchId === b.id) qtyForBatch += it.quantity;
        }
        if (qtyForBatch > 0) {
          byReq.set(req.id, (byReq.get(req.id) || 0) + qtyForBatch);
        }
      }
      for (const [reqId, qty] of byReq) {
        const req = requisitions.find((r) => r.id === reqId);
        if (!req) continue;
        const curNode = req.currentNodeId
          ? rules.find((r: any) => r.id === req.matchedRouteId)?.workflow.nodes.find(
              (n: any) => n.id === req.currentNodeId
            )?.label
          : undefined;
        affectedReqs.push({
          reqId,
          applicant: req.applicantName,
          purpose: req.purpose,
          status: req.approvalStatus,
          statusLabel:
            req.approvalStatus === "pending"
              ? "审批中"
              : req.approvalStatus === "approved"
              ? "待出库"
              : req.approvalStatus,
          qty,
          currentNode: curNode,
          createdAt: req.createdAt,
        });
      }

      list.push({
        batch: b,
        type: lowStock && highFrozen ? "both" : lowStock ? "low_stock" : "high_frozen",
        availableQty,
        frozenQty,
        frozenRatio,
        availableRatio,
        affectedReqs: affectedReqs.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
        totalAffectedQty: affectedReqs.reduce((s, a) => s + a.qty, 0),
      });
    }
    return list.sort((a, b) => {
      const aScore = a.type === "both" ? 0 : a.type === "low_stock" ? 1 : 2;
      const bScore = b.type === "both" ? 0 : b.type === "low_stock" ? 1 : 2;
      if (aScore !== bScore) return aScore - bScore;
      return a.availableRatio - b.availableRatio;
    });
  }, [batches, requisitions, rules]);

  const filtered = React.useMemo(() => {
    return alertBatches.filter((ab) => {
      if (filter !== "all" && ab.type !== filter && ab.type !== "both") return false;
      if (keyword) {
        const kw = keyword.toLowerCase();
        if (
          !ab.batch.reagentName.toLowerCase().includes(kw) &&
          !ab.batch.batchNo.toLowerCase().includes(kw) &&
          !ab.batch.reagentCode.toLowerCase().includes(kw)
        )
          return false;
      }
      return true;
    });
  }, [alertBatches, filter, keyword]);

  const stats = React.useMemo(() => {
    const all = alertBatches.length;
    const lowStock = alertBatches.filter((b) => b.type === "low_stock" || b.type === "both").length;
    const highFrozen = alertBatches.filter((b) => b.type === "high_frozen" || b.type === "both").length;
    const both = alertBatches.filter((b) => b.type === "both").length;
    const totalBlockedValue = alertBatches.reduce((s, b) => s + b.frozenQty * b.batch.unitPrice, 0);
    const totalAtRiskValue = alertBatches.reduce(
      (s, b) => s + Math.max(0, (SAFETY_STOCK_PCT * b.batch.quantity - b.availableQty)) * b.batch.unitPrice,
      0
    );
    return { all, lowStock, highFrozen, both, totalBlockedValue, totalAtRiskValue };
  }, [alertBatches]);

  const typeLabelMap: Record<AlertType | "all", string> = {
    all: "全部预警",
    low_stock: "库存不足",
    high_frozen: "冻结过高",
    both: "双重预警",
  };

  const typeToneMap: Record<AlertType, any> = {
    low_stock: "warning",
    high_frozen: "brand",
    both: "danger",
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<ShieldAlert className="h-5 w-5" />}
        title="库存占用预警"
        subtitle="可用量低于安全线或冻结占比过高的批次一览"
        actions={
          <Link to="/inventory">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              返回库存总览
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="border-warning-yellow/30 bg-amber-50/50">
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] text-amber-700 font-medium">库存不足</p>
                <p className="mt-1 text-xl font-bold text-amber-800 font-mono-tabular">
                  {stats.lowStock}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-brand-200 bg-brand-50/50">
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700">
                <BookmarkCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] text-brand-700 font-medium">冻结过高</p>
                <p className="mt-1 text-xl font-bold text-brand-800 font-mono-tabular">
                  {stats.highFrozen}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-warning-red/30 bg-rose-50/50">
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-rose-100 flex items-center justify-center text-warning-red">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] text-rose-700 font-medium">双重预警</p>
                <p className="mt-1 text-xl font-bold text-warning-red font-mono-tabular">
                  {stats.both}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-ink-200">
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-ink-100 flex items-center justify-center text-ink-600">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] text-ink-500 font-medium">冻结占用金额</p>
                <p className="mt-1 text-xl font-bold text-ink-900 font-mono-tabular">
                  {currency(stats.totalBlockedValue)}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-warning-yellow/30 bg-amber-50/30">
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] text-amber-700 font-medium">缺货风险敞口</p>
                <p className="mt-1 text-xl font-bold text-amber-800 font-mono-tabular">
                  {currency(stats.totalAtRiskValue)}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-orange" />
              <CardTitle>预警批次列表</CardTitle>
              <CardSubTitle>
                安全线 = 入库量的 20%，高冻结阈值 = 当前库存的 70%
              </CardSubTitle>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Tabs
                value={filter}
                onChange={(v) => setFilter(v as any)}
                items={[
                  { id: "all", label: `全部(${stats.all})` },
                  { id: "low_stock", label: `库存不足(${stats.lowStock})` },
                  { id: "high_frozen", label: `冻结过高(${stats.highFrozen})` },
                  { id: "both", label: `双重预警(${stats.both})` },
                ]}
              />
              <Input
                placeholder="搜索试剂/批次..."
                leading={<Search className="h-4 w-4" />}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-48"
              />
            </div>
          </div>
        </CardHeader>
        <CardBody className="!p-0">
          {filtered.length === 0 ? (
            <Empty
              text="没有符合条件的预警批次"
              icon={<ShieldAlert className="h-6 w-6" />}
            />
          ) : (
            <Table>
              <Tabular>
                <THead sticky>
                  <TR hoverable={false}>
                    <TH className="w-10"></TH>
                    <TH>试剂</TH>
                    <TH>批次号</TH>
                    <TH>预警类型</TH>
                    <TH className="text-right">入库总量</TH>
                    <TH className="text-right">当前库存</TH>
                    <TH className="text-right">冻结量</TH>
                    <TH className="text-right">可用量</TH>
                    <TH className="text-right">可用率</TH>
                    <TH className="text-right">冻结占比</TH>
                    <TH>效期</TH>
                    <TH className="text-right">关联申请</TH>
                  </TR>
                </THead>
                <TBody>
                  {filtered.map((ab) => {
                    const expanded = expandedBatchId === ab.batch.id;
                    const wl = getWarningLevel(ab.batch.expiryDate, ab.batch.isLocked);
                    return (
                      <React.Fragment key={ab.batch.id}>
                        <TR
                          tone={
                            ab.type === "both"
                              ? "danger"
                              : ab.type === "low_stock"
                              ? "warn"
                              : "highlight"
                          }
                        >
                          <TD>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="!h-6 !w-6"
                              onClick={() =>
                                setExpandedBatchId(expanded ? null : ab.batch.id)
                              }
                            >
                              <ChevronRight
                                className={cn(
                                  "h-3.5 w-3.5 transition-transform",
                                  expanded && "rotate-90"
                                )}
                              />
                            </Button>
                          </TD>
                          <TD>
                            <Link
                              to={`/batch/${ab.batch.id}`}
                              className="text-brand-600 hover:underline font-medium text-sm"
                            >
                              {ab.batch.reagentName}
                            </Link>
                            <p className="text-[10px] font-mono-tabular text-ink-400 mt-0.5">
                              {ab.batch.reagentCode}
                            </p>
                          </TD>
                          <TD>
                            <span className="font-mono-tabular text-xs text-ink-700">
                              {ab.batch.batchNo}
                            </span>
                          </TD>
                          <TD>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {ab.type === "both" ? (
                                <>
                                  <Badge tone="danger" size="sm" dot>
                                    库存不足
                                  </Badge>
                                  <Badge tone="brand" size="sm" dot>
                                    冻结过高
                                  </Badge>
                                </>
                              ) : (
                                <Badge tone={typeToneMap[ab.type]} size="sm" dot>
                                  {typeLabelMap[ab.type]}
                                </Badge>
                              )}
                            </div>
                          </TD>
                          <TD className="text-right font-mono-tabular text-xs text-ink-600">
                            {withComma(ab.batch.quantity)} {ab.batch.unit}
                          </TD>
                          <TD className="text-right font-mono-tabular text-xs text-ink-800">
                            {withComma(ab.batch.remainingQty)} {ab.batch.unit}
                          </TD>
                          <TD className="text-right font-mono-tabular text-xs text-brand-700 font-semibold">
                            {withComma(ab.frozenQty)} {ab.batch.unit}
                          </TD>
                          <TD className="text-right font-mono-tabular text-xs font-semibold">
                            <span
                              className={cn(
                                ab.availableRatio < 0.1
                                  ? "text-warning-red"
                                  : ab.availableRatio < 0.2
                                  ? "text-amber-600"
                                  : "text-success-600"
                              )}
                            >
                              {withComma(ab.availableQty)} {ab.batch.unit}
                            </span>
                          </TD>
                          <TD className="text-right">
                            <div className="inline-flex flex-col items-end gap-0.5">
                              <span
                                className={cn(
                                  "text-xs font-mono-tabular font-semibold",
                                  ab.availableRatio < 0.1
                                    ? "text-warning-red"
                                    : ab.availableRatio < 0.2
                                    ? "text-amber-600"
                                    : "text-success-600"
                                )}
                              >
                                {Math.round(ab.availableRatio * 100)}%
                              </span>
                              <div className="w-16 h-1.5 rounded-full bg-ink-100 overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    ab.availableRatio < 0.1
                                      ? "bg-warning-red"
                                      : ab.availableRatio < 0.2
                                      ? "bg-amber-500"
                                      : "bg-success-500"
                                  )}
                                  style={{ width: `${Math.max(0, ab.availableRatio * 100)}%` }}
                                />
                              </div>
                            </div>
                          </TD>
                          <TD className="text-right">
                            <div className="inline-flex flex-col items-end gap-0.5">
                              <span
                                className={cn(
                                  "text-xs font-mono-tabular font-semibold",
                                  ab.frozenRatio > 0.8
                                    ? "text-warning-red"
                                    : ab.frozenRatio > 0.7
                                    ? "text-brand-600"
                                    : "text-ink-500"
                                )}
                              >
                                {Math.round(ab.frozenRatio * 100)}%
                              </span>
                              <div className="w-16 h-1.5 rounded-full bg-ink-100 overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    ab.frozenRatio > 0.8
                                      ? "bg-warning-red"
                                      : ab.frozenRatio > 0.7
                                      ? "bg-brand-500"
                                      : "bg-ink-300"
                                  )}
                                  style={{ width: `${Math.min(100, ab.frozenRatio * 100)}%` }}
                                />
                              </div>
                            </div>
                          </TD>
                          <TD>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono-tabular text-xs text-ink-700">
                                {fmt(ab.batch.expiryDate)}
                              </span>
                              <Badge
                                tone={
                                  wl.level === "normal"
                                    ? "success"
                                    : wl.level === "expired"
                                    ? "danger"
                                    : "warning"
                                }
                                size="sm"
                                className="!py-0"
                              >
                                {wl.label}
                              </Badge>
                            </div>
                          </TD>
                          <TD className="text-right">
                            {ab.affectedReqs.length > 0 ? (
                              <Badge tone="brand" size="sm">
                                {ab.affectedReqs.length} 单 · {withComma(ab.totalAffectedQty)} {ab.batch.unit}
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-ink-400">-</span>
                            )}
                          </TD>
                        </TR>
                        {expanded && (
                          <TR tone="warn">
                            <TD colSpan={12} className="!py-0 !px-0">
                              <div className="bg-ink-50/60 px-4 py-3 border-y border-ink-100">
                                {ab.affectedReqs.length === 0 ? (
                                  <p className="text-xs text-ink-500">
                                    该批次暂未被申请单占用
                                  </p>
                                ) : (
                                  <>
                                    <p className="text-[10px] text-ink-500 font-semibold mb-2">
                                      相关申请单（占用 {ab.totalAffectedQty} {ab.batch.unit}）
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {ab.affectedReqs.map((ar) => (
                                        <div
                                          key={ar.reqId}
                                          className="p-2.5 rounded-lg bg-white border border-ink-200"
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <Link
                                              to={`/requisition/${ar.reqId}`}
                                              className="text-xs font-mono-tabular font-semibold text-brand-600 hover:underline flex items-center gap-1"
                                            >
                                              <Eye className="h-3 w-3" />
                                              {ar.reqId}
                                            </Link>
                                            <Badge
                                              tone={
                                                ar.status === "approved"
                                                  ? "success"
                                                  : "warning"
                                              }
                                              size="sm"
                                              dot
                                            >
                                              {ar.statusLabel}
                                            </Badge>
                                          </div>
                                          <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-ink-500">
                                            <span className="truncate">
                                              {ar.applicant} ·{" "}
                                              <span className="text-ink-400">
                                                {ar.currentNode || "待出库"}
                                              </span>
                                            </span>
                                            <span className="font-mono-tabular font-semibold text-ink-700 shrink-0">
                                              {withComma(ar.qty)} {ab.batch.unit}
                                            </span>
                                          </div>
                                          <p
                                            className="mt-1 text-[10px] text-ink-500 truncate"
                                            title={ar.purpose}
                                          >
                                            {ar.purpose}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
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

export default InventoryAlert;
