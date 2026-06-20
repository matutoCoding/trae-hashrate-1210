import * as React from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Lock,
  Unlock,
  Printer,
  Home,
  FlaskConical,
  Calendar,
  Factory,
  Hash,
  ShieldAlert,
  Package,
  Thermometer,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  History,
  ArrowDownToLine,
  ArrowUpFromLine,
  User,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle, CardSubTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useBatchStore } from "@/store/useBatchStore";
import { useToast } from "@/components/ui/Toast";
import {
  HazardBadge,
  WarningBadge,
  BatchRemainingBar,
} from "@/components/reagent/ReagentBadges";
import {
  fmt,
  fmtDateTime,
  getWarningLevel,
  warningColorMap,
  currency,
  withComma,
} from "@/utils/date";
import { cn } from "@/lib/utils";
import type { ReagentBatch } from "@/types";

interface TimelineEvent {
  id: string;
  time: string;
  type: "inbound" | "outbound" | "lock" | "unlock" | "qc" | "edit" | "create";
  title: string;
  detail?: string;
  operator?: string;
}

const genMockTimeline = (batch: ReagentBatch): TimelineEvent[] => {
  const events: TimelineEvent[] = [];
  events.push({
    id: "evt_create",
    time: batch.createdAt,
    type: "create",
    title: "批次入库登记",
    detail: `入库 ${batch.quantity} ${batch.unit}，单价 ${currency(batch.unitPrice)}`,
    operator: "张库管",
  });
  events.push({
    id: "evt_qc",
    time: batch.createdAt,
    type: "qc",
    title: batch.inspectionPassed ? "QC验收通过" : "QC验收未通过",
    detail: batch.inspectionRemark || (batch.inspectionPassed ? "各项指标合格" : "详见验收报告"),
    operator: "李质检",
  });
  if (batch.isLocked) {
    events.push({
      id: "evt_lock",
      time: batch.lockReason?.includes("系统") ? batch.createdAt : batch.createdAt,
      type: "lock",
      title: "批次锁定",
      detail: batch.lockReason || "人工锁定",
      operator: batch.lockReason?.includes("系统") ? "系统" : "王安全",
    });
  }
  const usedQty = batch.quantity - batch.remainingQty;
  if (usedQty > 0) {
    const times = 2;
    const perTime = Math.floor(usedQty / times);
    for (let i = 0; i < times; i++) {
      const q = i === times - 1 ? usedQty - perTime * (times - 1) : perTime;
      if (q <= 0) continue;
      events.push({
        id: `evt_out_${i}`,
        time: batch.createdAt,
        type: "outbound",
        title: `试剂出库`,
        detail: `出库 ${q} ${batch.unit}，用于实验项目 PRJ-${1000 + i}`,
        operator: ["赵研究员", "钱实验员"][i % 2],
      });
    }
  }
  return events.sort((a, b) => (a.time < b.time ? 1 : -1));
};

const iconMap = {
  create: <Package className="h-3.5 w-3.5" />,
  inbound: <ArrowDownToLine className="h-3.5 w-3.5" />,
  outbound: <ArrowUpFromLine className="h-3.5 w-3.5" />,
  lock: <Lock className="h-3.5 w-3.5" />,
  unlock: <Unlock className="h-3.5 w-3.5" />,
  qc: <ShieldAlert className="h-3.5 w-3.5" />,
  edit: <Pencil className="h-3.5 w-3.5" />,
};

const toneMap: Record<string, string> = {
  create: "bg-brand-100 text-brand-600 border-brand-200",
  inbound: "bg-success-100 text-success-600 border-success-200",
  outbound: "bg-violet-100 text-hazard-500 border-violet-200",
  lock: "bg-rose-100 text-warning-red border-rose-200",
  unlock: "bg-emerald-100 text-success-600 border-emerald-200",
  qc: "bg-amber-100 text-amber-700 border-amber-200",
  edit: "bg-ink-100 text-ink-600 border-ink-200",
};

const BatchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { batches, updateBatch, lockBatch, unlockBatch } = useBatchStore();
  const toast = useToast();
  const batch = batches.find((b) => b.id === id);

  const [lockModalOpen, setLockModalOpen] = React.useState(false);
  const [lockReason, setLockReason] = React.useState("");
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    storageCondition: "",
    hazardCodes: "",
  });

  React.useEffect(() => {
    if (batch) {
      setEditForm({
        storageCondition: batch.storageCondition || "",
        hazardCodes: (batch.hazardCodes || []).join(", "),
      });
    }
  }, [batch]);

  if (!batch) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/batch">
            <Button variant="ghost" size="icon" leftIcon={<ArrowLeft className="h-4 w-4" />} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-ink-900">批次详情</h1>
            <p className="text-xs text-ink-500 mt-0.5">未找到该批次信息</p>
          </div>
        </div>
        <Card>
          <CardBody className="py-20 flex flex-col items-center gap-3">
            <div className="h-16 w-16 rounded-full bg-ink-50 flex items-center justify-center text-ink-300">
              <FileText className="h-8 w-8" />
            </div>
            <p className="text-sm text-ink-500">批次不存在或已被删除</p>
            <Link to="/batch">
              <Button variant="primary" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>
                返回列表
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const wl = getWarningLevel(batch.expiryDate, batch.isLocked);
  const timeline = genMockTimeline(batch);
  const remainingPct = Math.round((batch.remainingQty / batch.quantity) * 100);

  const handleLock = () => {
    if (!lockReason.trim()) {
      toast.error("请填写锁定原因");
      return;
    }
    lockBatch(batch.id, lockReason.trim());
    toast.success("批次已锁定", lockReason);
    setLockModalOpen(false);
    setLockReason("");
  };

  const handleUnlock = () => {
    unlockBatch(batch.id);
    toast.success("批次已解锁");
  };

  const handleEdit = () => {
    updateBatch(batch.id, {
      storageCondition: editForm.storageCondition.trim() || undefined,
      hazardCodes: editForm.hazardCodes.trim()
        ? editForm.hazardCodes.split(/[,，\s]+/).filter(Boolean)
        : undefined,
    });
    toast.success("修改已保存");
    setEditModalOpen(false);
  };

  const handlePrint = () => {
    toast.success("条码打印任务已提交", `批次号 ${batch.batchNo}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/batch">
            <Button variant="ghost" size="icon" leftIcon={<ArrowLeft className="h-4 w-4" />} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-ink-900">{batch.reagentName}</h1>
              <Badge tone="brand" size="sm">{batch.category}</Badge>
              <HazardBadge level={batch.hazardLevel} />
              <WarningBadge expiryDate={batch.expiryDate} isLocked={batch.isLocked} />
              {batch.isLocked ? (
                <Badge tone="danger" size="sm" dot>
                  <Lock className="h-3 w-3 mr-0.5" />
                  {batch.lockReason?.slice(0, 10) || "已锁定"}
                </Badge>
              ) : batch.inspectionPassed ? (
                <Badge tone="success" size="sm" dot>验收合格</Badge>
              ) : (
                <Badge tone="warning" size="sm" dot>待验收</Badge>
              )}
            </div>
            <p className="text-xs text-ink-500 mt-0.5">
              <span className="font-mono-tabular">{batch.reagentCode}</span>
              {batch.casNo && (
                <>
                  <span className="mx-1.5">·</span>
                  CAS {batch.casNo}
                </>
              )}
              <span className="mx-1.5">·</span>
              批次 <span className="font-mono-tabular">{batch.batchNo}</span>
            </p>
          </div>
        </div>
        <Link to="/">
          <Button variant="ghost" size="sm" leftIcon={<Home className="h-4 w-4" />}>
            返回首页
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center text-brand-600">
                <FlaskConical className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>基本信息</CardTitle>
                <CardSubTitle>试剂档案与批次溯源</CardSubTitle>
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-br from-ink-50 to-white border border-ink-100">
              <div className={cn(
                "h-12 w-12 shrink-0 rounded-xl flex items-center justify-center text-sm font-bold shadow-inner",
                batch.hazardLevel !== "无"
                  ? "bg-gradient-to-br from-violet-100 to-violet-50 text-hazard-500"
                  : "bg-gradient-to-br from-brand-50 to-brand-100/50 text-brand-600"
              )}>
                {batch.reagentName.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink-900 truncate">{batch.reagentName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge tone="brand" size="sm">{batch.category}</Badge>
                  <HazardBadge level={batch.hazardLevel} />
                </div>
              </div>
            </div>

            <dl className="space-y-3 text-xs">
              <div className="flex items-start gap-3">
                <dt className="w-20 shrink-0 flex items-center gap-1 text-ink-500">
                  <Hash className="h-3 w-3" />试剂编码
                </dt>
                <dd className="flex-1 font-mono-tabular text-ink-800">{batch.reagentCode}</dd>
              </div>
              {batch.casNo && (
                <div className="flex items-start gap-3">
                  <dt className="w-20 shrink-0 flex items-center gap-1 text-ink-500">
                    <FileText className="h-3 w-3" />CAS号
                  </dt>
                  <dd className="flex-1 font-mono-tabular text-ink-800">{batch.casNo}</dd>
                </div>
              )}
              <div className="flex items-start gap-3">
                <dt className="w-20 shrink-0 flex items-center gap-1 text-ink-500">
                  <Factory className="h-3 w-3" />生产厂家
                </dt>
                <dd className="flex-1 text-ink-800 leading-5">{batch.manufacturer}</dd>
              </div>
              <div className="flex items-start gap-3">
                <dt className="w-20 shrink-0 flex items-center gap-1 text-ink-500">
                  <Package className="h-3 w-3" />批次号
                </dt>
                <dd className="flex-1 font-mono-tabular text-ink-800">{batch.batchNo}</dd>
              </div>
            </dl>

            <div className="pt-3 border-t border-ink-100">
              <p className="text-xs font-semibold text-ink-700 mb-3 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />关键日期
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-ink-50 text-center">
                  <p className="text-[10px] text-ink-500">生产日期</p>
                  <p className="mt-1 font-mono-tabular text-xs font-semibold text-ink-800">
                    {fmt(batch.productionDate, "MM/dd")}
                  </p>
                  <p className="text-[10px] text-ink-400">
                    {fmt(batch.productionDate, "yyyy")}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-brand-50/60 text-center border border-brand-100">
                  <p className="text-[10px] text-brand-600 font-medium">入库日期</p>
                  <p className="mt-1 font-mono-tabular text-xs font-semibold text-brand-700">
                    {fmt(batch.arrivalDate, "MM/dd")}
                  </p>
                  <p className="text-[10px] text-brand-500/70">
                    {fmt(batch.arrivalDate, "yyyy")}
                  </p>
                </div>
                <div className={cn(
                  "p-2.5 rounded-lg text-center border",
                  warningColorMap[wl.level].bg,
                  warningColorMap[wl.level].border
                )}>
                  <p className={cn("text-[10px] font-medium", warningColorMap[wl.level].text)}>
                    有效期至
                  </p>
                  <p className={cn(
                    "mt-1 font-mono-tabular text-xs font-semibold",
                    warningColorMap[wl.level].text
                  )}>
                    {fmt(batch.expiryDate, "MM/dd")}
                  </p>
                  <p className={cn("text-[10px]", warningColorMap[wl.level].text, "opacity-70")}>
                    {fmt(batch.expiryDate, "yyyy")}
                  </p>
                </div>
              </div>
            </div>

            {batch.hazardCodes && batch.hazardCodes.length > 0 && (
              <div className="pt-3 border-t border-ink-100">
                <p className="text-xs font-semibold text-ink-700 mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" />Hazard Codes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {batch.hazardCodes.map((h) => (
                    <Badge key={h} tone="hazard" size="sm">{h}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-success-50 to-emerald-100 flex items-center justify-center text-success-600">
                <Package className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>库存与效期</CardTitle>
                <CardSubTitle>实时库存状态与效期预警</CardSubTitle>
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-gradient-to-br from-brand-50/80 to-white border border-brand-100">
                <p className="text-[10px] text-ink-500">入库总量</p>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-bold text-ink-900 font-mono-tabular">
                    {withComma(batch.quantity)}
                  </span>
                  <span className="text-xs text-ink-500">{batch.unit}</span>
                </p>
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-success-50/80 to-white border border-success-200">
                <p className="text-[10px] text-ink-500">当前库存</p>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-bold text-success-700 font-mono-tabular">
                    {withComma(batch.remainingQty)}
                  </span>
                  <span className="text-xs text-ink-500">{batch.unit}</span>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-600 font-medium">库存消耗进度</span>
                <div className="flex items-baseline gap-1">
                  <span className={cn(
                    "font-mono-tabular font-bold",
                    remainingPct <= 20 ? "text-warning-red" : remainingPct <= 50 ? "text-amber-600" : "text-success-600"
                  )}>
                    {remainingPct}%
                  </span>
                </div>
              </div>
              <BatchRemainingBar batch={batch} />
              <div className="flex justify-between text-[11px] text-ink-400 font-mono-tabular">
                <span>已消耗 {withComma(batch.quantity - batch.remainingQty)} {batch.unit}</span>
                <span>总额度 {withComma(batch.quantity)} {batch.unit}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-ink-50">
                <p className="text-[10px] text-ink-500">库存金额</p>
                <p className="mt-1 font-mono-tabular text-base font-bold text-ink-900">
                  {currency(batch.remainingQty * batch.unitPrice)}
                </p>
                <p className="text-[10px] text-ink-400 mt-0.5">
                  单价 {currency(batch.unitPrice)}
                </p>
              </div>
              <div className="space-y-2">
                <div className={cn(
                  "p-2.5 rounded-lg flex items-center justify-between",
                  warningColorMap[wl.level].bg,
                  warningColorMap[wl.level].border,
                  "border"
                )}>
                  <div className="flex items-center gap-2">
                    <Clock className={cn("h-4 w-4", warningColorMap[wl.level].text)} />
                    <div>
                      <p className={cn("text-[10px] font-medium", warningColorMap[wl.level].text)}>
                        效期预警
                      </p>
                      <p className={cn("text-xs font-bold", warningColorMap[wl.level].text)}>
                        {wl.label}
                      </p>
                    </div>
                  </div>
                  {wl.level === "normal" ? (
                    <CheckCircle2 className="h-5 w-5 text-success-500" />
                  ) : wl.level === "expired" ? (
                    <XCircle className="h-5 w-5 text-warning-red" />
                  ) : (
                    <AlertTriangle className={cn("h-5 w-5", warningColorMap[wl.level].text)} />
                  )}
                </div>
                <div className="h-1.5 w-full rounded-full bg-ink-100 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      warningColorMap[wl.level].bar
                    )}
                    style={{
                      width: `${Math.max(5, Math.min(100, 100 - (wl.days / 365) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {batch.storageCondition && (
              <div className="p-3 rounded-lg bg-gradient-to-br from-amber-50 to-white border border-amber-100">
                <div className="flex items-start gap-2.5">
                  <div className="h-7 w-7 shrink-0 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                    <Thermometer className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-amber-800">存储条件</p>
                    <p className="mt-1 text-xs text-amber-700 leading-5">
                      {batch.storageCondition}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!batch.inspectionPassed && (
              <div className="p-3 rounded-lg bg-warning-red/5 border border-warning-red/20">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-warning-red shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-warning-red">验收未通过</p>
                    {batch.inspectionRemark && (
                      <p className="mt-1 text-xs text-warning-red/80 leading-5">
                        {batch.inspectionRemark}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-50 to-violet-100 flex items-center justify-center text-hazard-500">
                <History className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>操作日志</CardTitle>
                <CardSubTitle>出入库历史与变更记录</CardSubTitle>
              </div>
              <Badge tone="ink" size="sm">{timeline.length}</Badge>
            </div>
          </CardHeader>
          <CardBody className="!px-3">
            <div className="relative">
              <div className="absolute left-[22px] top-2 bottom-2 w-px bg-gradient-to-b from-ink-200 via-ink-100 to-transparent" />
              <ul className="space-y-4 relative">
                {timeline.map((evt, idx) => (
                  <li key={evt.id} className="relative pl-12">
                    <div
                      className={cn(
                        "absolute left-3 top-0 h-8 w-8 rounded-full border-2 flex items-center justify-center z-10 bg-white",
                        toneMap[evt.type]
                      )}
                    >
                      {iconMap[evt.type]}
                    </div>
                    <div className={cn(
                      "p-3 rounded-lg border bg-white transition",
                      idx === 0 ? "border-brand-200 bg-brand-50/30 shadow-sm" : "border-ink-100 hover:border-ink-200"
                    )}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-ink-800">{evt.title}</p>
                        {idx === 0 && (
                          <Badge tone="brand" size="sm">最新</Badge>
                        )}
                      </div>
                      {evt.detail && (
                        <p className="mt-1 text-xs text-ink-600 leading-5">{evt.detail}</p>
                      )}
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1 text-ink-400">
                          <User className="h-3 w-3" />
                          <span>{evt.operator || "系统"}</span>
                        </div>
                        <div className="flex items-center gap-1 text-ink-400 font-mono-tabular">
                          <Clock className="h-3 w-3" />
                          <span>{fmtDateTime(evt.time)}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="!py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <Clock className="h-3.5 w-3.5" />
            创建于 <span className="font-mono-tabular text-ink-700">{fmtDateTime(batch.createdAt)}</span>
            <span className="mx-1.5 text-ink-200">|</span>
            操作员 <span className="text-ink-700">{batch.operatorId}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Pencil className="h-3.5 w-3.5" />}
              onClick={() => setEditModalOpen(true)}
            >
              编辑信息
            </Button>
            {batch.isLocked ? (
              <Button
                variant="success"
                size="sm"
                leftIcon={<Unlock className="h-3.5 w-3.5" />}
                onClick={handleUnlock}
              >
                解锁批次
              </Button>
            ) : (
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Lock className="h-3.5 w-3.5" />}
                onClick={() => setLockModalOpen(true)}
              >
                锁定批次
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Printer className="h-3.5 w-3.5" />}
              onClick={handlePrint}
            >
              打印条码
            </Button>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={lockModalOpen}
        onClose={() => setLockModalOpen(false)}
        title="锁定批次"
        subtitle="批次锁定后将无法出库，请谨慎操作"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLockModalOpen(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleLock} leftIcon={<Lock className="h-4 w-4" />}>
              确认锁定
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-warning-red shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800 leading-5">
              <p className="font-semibold">锁定影响</p>
              <p className="mt-0.5">
                锁定后该批次在库存列表中将被标记，新建申领单时将无法选择此批次。
              </p>
            </div>
          </div>
          <Textarea
            label="锁定原因 *"
            placeholder="请填写锁定原因，如：质量复检、召回、盘点异常等"
            value={lockReason}
            onChange={(e) => setLockReason(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-ink-50">
              <p className="text-ink-500">试剂</p>
              <p className="font-medium text-ink-800 mt-0.5">{batch.reagentName}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-ink-50">
              <p className="text-ink-500">批次号</p>
              <p className="font-mono-tabular text-ink-800 mt-0.5">{batch.batchNo}</p>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="编辑批次信息"
        subtitle="修改存储条件与 Hazard Codes"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditModalOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={handleEdit} leftIcon={<CheckCircle2 className="h-4 w-4" />}>
              保存修改
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Textarea
            label="存储条件"
            placeholder="如：2-8℃冷藏、避光、密封、干燥保存等"
            value={editForm.storageCondition}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, storageCondition: e.target.value }))
            }
          />
          <Input
            label="Hazard Codes (H编码)"
            placeholder="多个用逗号分隔，如：H225, H319, H336"
            value={editForm.hazardCodes}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, hazardCodes: e.target.value }))
            }
          />
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-ink-50">
              <p className="text-ink-500">试剂编码</p>
              <p className="font-mono-tabular text-ink-800 mt-0.5">{batch.reagentCode}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-ink-50">
              <p className="text-ink-500">批次号</p>
              <p className="font-mono-tabular text-ink-800 mt-0.5">{batch.batchNo}</p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BatchDetail;
