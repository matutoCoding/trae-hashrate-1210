import * as React from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Building2,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Send,
  Edit3,
  Check,
  X,
  Users,
  QrCode,
  Signature,
  Package,
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  Save,
  ShieldCheck,
} from "lucide-react";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle, CardSubTitle, Tabs } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
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
import type { ApprovalStatus, Requisition, ApprovalNode } from "@/types";
import { fmt, fmtDateTime, currency, withComma, getWarningLevel } from "@/utils/date";
import { cn } from "@/lib/utils";

const statusBadgeMap: Record<ApprovalStatus, { tone: any; label: string; dot: boolean }> = {
  draft: { tone: "default", label: "草稿", dot: false },
  pending: { tone: "brand", label: "审批中", dot: true },
  approved: { tone: "success", label: "已通过", dot: true },
  rejected: { tone: "danger", label: "已驳回", dot: true },
  returned: { tone: "orange", label: "已退回", dot: true },
  outbound_completed: { tone: "success", label: "已出库", dot: false },
};

const actionBadgeMap: Record<string, { tone: any; label: string; icon: any }> = {
  approve: { tone: "success", label: "同意", icon: CheckCircle2 },
  reject: { tone: "danger", label: "驳回", icon: XCircle },
  return: { tone: "orange", label: "退回", icon: RotateCcw },
  delegate: { tone: "brand", label: "转办", icon: Users },
  auto: { tone: "default", label: "自动", icon: Clock },
};

const RequisitionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { batches, deductAndReleaseFrozen } = useBatchStore();
  const { rules } = useApprovalStore();
  const { findById, addApprovalRecord, addOutbound, outbounds } = useRequisitionStore();
  const toast = useToast();

  const [tab, setTab] = React.useState("items");
  const [approveModal, setApproveModal] = React.useState(false);
  const [rejectModal, setRejectModal] = React.useState(false);
  const [delegateModal, setDelegateModal] = React.useState(false);
  const [approveOpinion, setApproveOpinion] = React.useState("");
  const [rejectOpinion, setRejectOpinion] = React.useState("");
  const [delegateUserId, setDelegateUserId] = React.useState("");
  const [receiverSignature, setReceiverSignature] = React.useState("");
  const [signatureError, setSignatureError] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);
  const [acting, setActing] = React.useState(false);

  const req = id ? findById(id) : undefined;
  const outbound = outbounds.find((o) => o.requisitionId === id);

  const matchedRule = React.useMemo(() => {
    if (!req?.matchedRouteId) {
      const ctx = {
        totalAmount: req?.totalAmount,
        hazardLevel: (() => {
          if (!req) return "无";
          let maxHazard = "无";
          const hazardRank: Record<string, number> = {
            无: 0, 易燃: 1, 腐蚀性: 2, 有毒: 3, 易爆: 4, 易制毒: 5, 易制爆: 6,
          };
          for (const it of req.items) {
            const bat = batches.find((b) => b.id === it.batchId);
            if (bat && hazardRank[bat.hazardLevel] > (hazardRank[maxHazard] || 0)) {
              maxHazard = bat.hazardLevel;
            }
          }
          return maxHazard;
        })(),
      };
      return rules.find((r) => r.enabled) || rules[0];
    }
    return rules.find((r) => r.id === req.matchedRouteId);
  }, [req, rules, batches]);

  const workflowNodes = React.useMemo(() => {
    if (!matchedRule?.workflow) return [];
    return matchedRule.workflow.nodes.filter(
      (n) => n.type === "start" || n.type === "approve" || n.type === "end"
    );
  }, [matchedRule]);

  const resubmitCount = req?.resubmitInfo?.resubmitCount || 0;
  const resubmitHistory = req?.resubmitInfo?.history || [];

  const approveNodes = React.useMemo(() => {
    if (!matchedRule?.workflow) return [] as ApprovalNode[];
    return matchedRule.workflow.nodes.filter((n) => n.type === "approve");
  }, [matchedRule]);

  const approvedNodeIds = React.useMemo(() => {
    if (!req) return new Set<string>();
    return new Set(
      req.approvalHistory
        .filter((h) => h.action === "approve")
        .map((h) => h.nodeId)
    );
  }, [req]);

  const currentNodeIndex = React.useMemo(() => {
    if (!req || req.approvalStatus !== "pending") return -1;
    for (let i = 0; i < approveNodes.length; i++) {
      if (!approvedNodeIds.has(approveNodes[i].id)) return i;
    }
    return approveNodes.length;
  }, [req, approveNodes, approvedNodeIds]);

  const currentNode = currentNodeIndex >= 0 && currentNodeIndex < approveNodes.length
    ? approveNodes[currentNodeIndex]
    : null;

  const isApprover = React.useMemo(() => {
    if (!user || !currentNode || !req) return false;
    const delegatedTo = req.nodeDelegations?.[currentNode.id];
    if (delegatedTo) return delegatedTo === user.id;
    if (currentNode.assigneeUserIds?.includes(user.id)) return true;
    if (currentNode.assigneeRoles?.some((r) => user.roles.includes(r as any))) return true;
    return false;
  }, [user, currentNode, req]);

  const getNodeState = (node: ApprovalNode, idx: number): "done" | "current" | "pending" => {
    if (!req) return "pending";
    if (node.type === "start") return "done";
    if (node.type === "end") {
      if (req.approvalStatus === "approved" || req.approvalStatus === "outbound_completed") return "done";
      return "pending";
    }
    if (approvedNodeIds.has(node.id)) return "done";
    const approveIdx = approveNodes.findIndex((n) => n.id === node.id);
    if (approveIdx === currentNodeIndex) return "current";
    return "pending";
  };

  const handleApprove = async () => {
    if (!req || !currentNode || !user) return;
    setActing(true);
    try {
      const nextIdx = approveNodes.findIndex((n) => n.id === currentNode.id) + 1;
      const nextNode = nextIdx < approveNodes.length ? approveNodes[nextIdx] : null;
      const finalStatus: ApprovalStatus = nextNode ? "pending" : "approved";
      addApprovalRecord(
        req.id,
        {
          nodeId: currentNode.id,
          nodeLabel: currentNode.label,
          approverId: user.id,
          approverName: user.realName,
          action: "approve",
          opinion: approveOpinion.trim() || undefined,
        },
        nextNode ? nextNode.id : null,
        finalStatus
      );
      toast.success("审批通过", `${currentNode.label} - ${user.realName}`);
      setApproveModal(false);
      setApproveOpinion("");
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!req || !currentNode || !user) return;
    if (!rejectOpinion.trim()) {
      toast.error("请填写驳回意见");
      return;
    }
    setActing(true);
    try {
      addApprovalRecord(
        req.id,
        {
          nodeId: currentNode.id,
          nodeLabel: currentNode.label,
          approverId: user.id,
          approverName: user.realName,
          action: "reject",
          opinion: rejectOpinion.trim(),
        },
        null,
        "rejected"
      );
      toast.success("已驳回申请");
      setRejectModal(false);
      setRejectOpinion("");
    } finally {
      setActing(false);
    }
  };

  const handleReturn = async () => {
    if (!req || !currentNode || !user) return;
    if (!rejectOpinion.trim()) {
      toast.error("请填写退回意见");
      return;
    }
    setActing(true);
    try {
      addApprovalRecord(
        req.id,
        {
          nodeId: currentNode.id,
          nodeLabel: currentNode.label,
          approverId: user.id,
          approverName: user.realName,
          action: "return",
          opinion: rejectOpinion.trim(),
        },
        null,
        "returned"
      );
      toast.success("已退回申请人修改");
      setRejectModal(false);
      setRejectOpinion("");
    } finally {
      setActing(false);
    }
  };

  const handleDelegate = async () => {
    if (!req || !currentNode || !user) return;
    if (!delegateUserId.trim()) {
      toast.error("请选择转办人");
      return;
    }
    const userLabel = (() => {
      if (delegateUserId === "u_dept") return "陈主任";
      if (delegateUserId === "u_safety") return "赵安全";
      if (delegateUserId === "u_lab") return "孙主任";
      return delegateUserId;
    })();
    setActing(true);
    try {
      addApprovalRecord(
        req.id,
        {
          nodeId: currentNode.id,
          nodeLabel: currentNode.label,
          approverId: user.id,
          approverName: user.realName,
          action: "delegate",
          opinion: `转办给 ${userLabel} 处理`,
          delegatedToUserId: delegateUserId,
          delegatedToUserName: userLabel,
        },
        currentNode.id,
        "pending"
      );
      toast.success("已转办", `已通知 ${userLabel} 处理`);
      setDelegateModal(false);
      setDelegateUserId("");
    } finally {
      setActing(false);
    }
  };

  const handleOutboundConfirm = async () => {
    if (!req || !user) return;
    if (!receiverSignature.trim()) {
      setSignatureError("请输入领用人签字");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const issues: string[] = [];
    for (const it of req.items) {
      const bat = batches.find((b) => b.id === it.batchId);
      if (!bat) {
        issues.push(`「${it.reagentName} ${it.batchNo}」批次不存在或已被删除`);
        continue;
      }
      if (bat.isLocked) {
        issues.push(
          `「${it.reagentName} ${it.batchNo}」已被锁定（${bat.lockReason || "禁止出库"}）`
        );
      }
      if (bat.expiryDate < today) {
        issues.push(`「${it.reagentName} ${it.batchNo}」已过有效期（${bat.expiryDate}）`);
      }
      if (bat.remainingQty < it.quantity) {
        issues.push(
          `「${it.reagentName} ${it.batchNo}」库存不足（需${it.quantity}${it.unit}，余${bat.remainingQty}${it.unit}）`
        );
      }
    }
    if (issues.length > 0) {
      toast.error(
        "出库校验失败",
        issues.map((m) => "· " + m).join("\n")
      );
      return;
    }
    setConfirming(true);
    try {
      const items = req.items.map((it) => {
        const bat = batches.find((b) => b.id === it.batchId);
        return {
          batchId: it.batchId,
          quantity: it.quantity,
          remainingAfter: Math.max(0, (bat?.remainingQty || 0) - it.quantity),
        };
      });
      addOutbound({
        requisitionId: req.id,
        operatorId: user.id,
        operatorName: user.realName,
        items,
        receiverSignature: receiverSignature.trim(),
      });
      toast.success("出库确认完成", `共出库 ${req.items.length} 项试剂`);
    } finally {
      setConfirming(false);
    }
  };

  if (!req) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/requisition">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-ink-900">申请不存在</h1>
            <p className="text-xs text-ink-500 mt-0.5">请返回列表选择其他申请</p>
          </div>
        </div>
        <Card>
          <CardBody className="py-16 text-center">
            <div className="h-16 w-16 mx-auto rounded-full bg-ink-100 flex items-center justify-center text-ink-300">
              <FileText className="h-8 w-8" />
            </div>
            <p className="mt-4 text-ink-500">未找到该申请记录</p>
            <Link to="/requisition" className="mt-4 inline-block">
              <Button variant="primary" size="sm">
                返回列表
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const statusBadge = statusBadgeMap[req.approvalStatus];

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
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-ink-900">
                申请单号：
                <span className="font-mono-tabular text-brand-600">{req.id}</span>
              </h1>
              <Badge tone={statusBadge.tone} size="md" dot={statusBadge.dot}>
                {statusBadge.label}
              </Badge>
            </div>
            <p className="text-xs text-ink-500 mt-0.5">
              创建于 {fmtDateTime(req.createdAt)} · 匹配规则：{req.matchedRouteName || "默认"}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-brand-50 flex items-center justify-center text-brand-500">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-ink-500 font-medium">申请人</p>
                <p className="text-sm font-semibold text-ink-900 truncate">{req.applicantName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-50 flex items-center justify-center text-success-500">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-ink-500 font-medium">所属部门</p>
                <p className="text-sm font-semibold text-ink-900 truncate">{req.department}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-50 flex items-center justify-center text-warning-yellow">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-ink-500 font-medium">创建时间</p>
                <p className="text-sm font-mono-tabular text-ink-900">{fmtDateTime(req.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-violet-50 flex items-center justify-center text-hazard-500">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-ink-500 font-medium">总金额</p>
                <p className="text-sm font-mono-tabular font-bold text-ink-900">
                  {currency(req.totalAmount)}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-ink-100">
            <p className="text-[11px] text-ink-500 font-medium mb-1.5">用途说明</p>
            <p className="text-sm text-ink-800 leading-6 bg-ink-50/60 rounded-lg px-4 py-3 border border-ink-100">
              {req.purpose}
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <Tabs
                items={[
                  { id: "items", label: <span className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" />申请明细</span>, count: req.items.length },
                  { id: "approval", label: <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />审批时间线</span>, count: req.approvalHistory.length },
                  { id: "resubmit", label: <span className="flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5" />重提追溯</span>, count: resubmitCount },
                ]}
                value={tab}
                onChange={setTab}
              />
            </CardHeader>
            <CardBody className={tab !== "items" ? "!p-0 hidden" : "!p-0"}>
              {tab === "items" && (
                <Table>
                  <Tabular>
                    <THead sticky>
                      <TR hoverable={false}>
                        <TH className="w-12">FIFO</TH>
                        <TH>批次号</TH>
                        <TH>试剂信息</TH>
                        <TH>危化等级</TH>
                        <TH>效期</TH>
                        <TH className="text-right">数量</TH>
                        <TH className="text-right">单价</TH>
                        <TH className="text-right">金额</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {req.items.map((it) => {
                        const bat = batches.find((b) => b.id === it.batchId);
                        const wl = bat ? getWarningLevel(bat.expiryDate, bat.isLocked) : null;
                        return (
                          <TR key={it.id}>
                            <TD>
                              {it.isFifoRecommended ? (
                                <div className="flex items-center gap-1">
                                  <span className="h-2 w-2 rounded-full bg-success-500 animate-pulse shadow-[0_0_0_3px_rgba(42,157,143,0.15)]" />
                                  <span className="text-[11px] font-semibold text-success-600">推荐</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-ink-400">补充</span>
                              )}
                            </TD>
                            <TD>
                              <span className="font-mono-tabular text-sm font-medium text-ink-800">
                                {it.batchNo}
                              </span>
                            </TD>
                            <TD>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-ink-900 truncate max-w-[200px]">
                                  {it.reagentName}
                                </p>
                                <p className="text-[11px] font-mono-tabular text-ink-500 mt-0.5">
                                  {it.reagentCode}
                                </p>
                              </div>
                            </TD>
                            <TD>
                              {bat ? (
                                <HazardBadge level={bat.hazardLevel} />
                              ) : (
                                <Badge tone="default" size="sm">普通</Badge>
                              )}
                            </TD>
                            <TD>
                              <div className="flex flex-col gap-1">
                                <span className="font-mono-tabular text-xs text-ink-800">
                                  {fmt(it.expiryDate)}
                                </span>
                                {bat && <WarningBadge expiryDate={bat.expiryDate} isLocked={bat.isLocked} />}
                              </div>
                            </TD>
                            <TD className="text-right">
                              <span className="font-mono-tabular text-sm font-medium text-ink-800">
                                {withComma(it.quantity)}
                                <span className="text-ink-400 font-normal ml-1 text-[11px]">{it.unit}</span>
                              </span>
                            </TD>
                            <TD className="text-right">
                              <span className="font-mono-tabular text-xs text-ink-600">
                                {currency(it.unitPrice)}
                              </span>
                            </TD>
                            <TD className="text-right">
                              <span className="font-mono-tabular text-sm font-semibold text-brand-600">
                                {currency(it.subtotal)}
                              </span>
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Tabular>
                </Table>
              )}
            </CardBody>
            {tab === "approval" && (
              <CardBody className={tab !== "approval" ? "hidden" : ""}>
                {req.approvalHistory.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="h-14 w-14 mx-auto rounded-full bg-ink-100 flex items-center justify-center text-ink-300">
                      <Clock className="h-7 w-7" />
                    </div>
                    <p className="mt-3 text-sm text-ink-500">暂无审批记录</p>
                    {req.approvalStatus === "pending" && (
                      <p className="mt-1 text-xs text-ink-400">等待审批人处理...</p>
                    )}
                  </div>
                ) : (
                  <div className="px-2">
                    <div className="flex flex-nowrap overflow-x-auto gap-4 py-1 px-1">
                      {workflowNodes.map((node, idx) => {
                        const state = getNodeState(node, idx);
                        const records = req.approvalHistory.filter((h) => h.nodeId === node.id);
                        const handlerRecord = records.find((r) => r.action === "approve");
                        const delegateRecords = records.filter((r) => r.action === "delegate");
                        const firstRecord = records[0];
                        const isCurrentNode = req.approvalStatus === "pending" && state === "current";
                        const entryTime = (() => {
                          if (firstRecord) return firstRecord.timestamp;
                          if (req.nodeEntryTimes?.[node.id]) return req.nodeEntryTimes[node.id];
                          if (isCurrentNode) {
                            const lastHist = req.approvalHistory[req.approvalHistory.length - 1];
                            return lastHist ? lastHist.timestamp : req.createdAt;
                          }
                          return undefined;
                        })();
                        const delegatedTo = req.nodeDelegations?.[node.id];
                        const delegatedUser = delegatedTo
                          ? (() => {
                              if (delegatedTo === "u_dept") return "陈主任";
                              if (delegatedTo === "u_safety") return "赵安全";
                              if (delegatedTo === "u_lab") return "孙主任";
                              return delegatedTo;
                            })()
                          : undefined;
                        const displayHandler = handlerRecord
                          ? handlerRecord.approverName
                          : delegatedUser
                          ? delegatedUser + "（转办）"
                          : node.assigneeUserIds?.length
                          ? "指定审批人"
                          : node.assigneeRoles?.join("/") || "待分配";
                        const timeoutHours = (node as any).timeoutHours || 24;
                        const now = Date.now();
                        const entryMs = entryTime ? new Date(entryTime).getTime() : now;
                        const elapsedMs = now - entryMs;
                        const elapsedMinutes = Math.floor(elapsedMs / 60000);
                        const elapsedHours = Math.floor(elapsedMinutes / 60);
                        const elapsedMinPart = elapsedMinutes % 60;
                        const remainingMinutes = Math.floor(timeoutHours * 60) - elapsedMinutes;
                        const remainingHours = Math.floor(Math.max(0, remainingMinutes) / 60);
                        const remainingMinPart = Math.max(0, remainingMinutes) % 60;
                        const isOvertime = remainingMinutes < 0;
                        const isWarning = !isOvertime && remainingMinutes < 60;
                        const timeColor = isOvertime
                          ? "text-warning-red"
                          : isWarning
                          ? "text-amber-600"
                          : "text-brand-600";
                        const waitLabel = handlerRecord
                          ? `用时 ${handlerRecord.durationMinutes || 0} 分钟`
                          : isOvertime
                          ? `已超时 ${Math.abs(Math.floor(remainingMinutes / 60))}h${Math.abs(remainingMinutes % 60)}m`
                          : remainingHours > 0
                          ? `已等待 ${elapsedHours}h${elapsedMinPart}m · 剩余${remainingHours}h${remainingMinPart}m`
                          : `已等待 ${elapsedMinPart} 分钟 · 剩余${remainingMinPart} 分钟`;

                        return (
                          <div key={node.id} className="min-w-[280px] shrink-0">
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className={cn(
                                  "h-7 w-7 shrink-0 rounded-full border-2 flex items-center justify-center text-[11px] font-bold",
                                  {
                                    "bg-success-500 border-success-500 text-white": state === "done",
                                    "bg-brand-500 border-brand-500 text-white animate-pulse": state === "current",
                                    "bg-white border-ink-200 text-ink-400": state === "pending",
                                  }
                                )}
                              >
                                {node.type === "start" ? <Check className="h-3.5 w-3.5" /> : node.type === "end" ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx}
                              </div>
                              <p className="text-sm font-semibold text-ink-900">{node.label}</p>
                            </div>
                            <div
                              className={cn(
                                "p-3 rounded-xl border space-y-2",
                                {
                                  "bg-success-50/60 border-success-200": state === "done",
                                  "bg-brand-50/60 border-brand-200 animate-pulse-slow": state === "current",
                                  "bg-ink-50/50 border-ink-100": state === "pending",
                                }
                              )}
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-ink-800">{displayHandler}</span>
                                {isCurrentNode && isApprover && (
                                  <Badge tone="brand" size="sm" dot>
                                    您为审批人
                                  </Badge>
                                )}
                                {delegatedUser && !handlerRecord && (
                                  <Badge tone="warning" size="sm">
                                    已转办
                                  </Badge>
                                )}
                              </div>
                              {entryTime && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge tone="default" size="sm" className="!py-0">
                                    <Clock className="h-2.5 w-2.5 mr-0.5" />
                                    进入 {fmtDateTime(entryTime).slice(5, 16)}
                                  </Badge>
                                  <Badge
                                    tone={isOvertime ? "danger" : isWarning ? "warning" : "brand"}
                                    size="sm"
                                    className="!py-0"
                                  >
                                    <span className={cn("font-mono-tabular text-[10px]", timeColor)}>
                                      {waitLabel}
                                    </span>
                                  </Badge>
                                </div>
                              )}
                              {delegateRecords.length > 0 && (
                                <div className="space-y-1 pt-1 border-t border-dashed border-ink-200">
                                  {delegateRecords.map((d) => (
                                    <div key={d.id} className="flex items-center gap-1.5 text-[11px] text-ink-500">
                                      <Users className="h-3 w-3 text-amber-500" />
                                      <span className="font-medium text-amber-700">
                                        {d.approverName} → {d.delegatedToUserName}
                                      </span>
                                      <span className="font-mono-tabular text-ink-400 ml-1">
                                        {fmtDateTime(d.timestamp).slice(5, 16)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {records.map((h) => {
                                if (h.action === "delegate") return null;
                                const action = actionBadgeMap[h.action] || actionBadgeMap.auto;
                                const ActionIcon = action.icon;
                                return (
                                  <div key={h.id} className="pt-2 border-t border-ink-100/60">
                                    <div className="flex items-center gap-1.5">
                                      <ActionIcon className="h-3 w-3 text-ink-400" />
                                      <span className="text-xs font-medium text-ink-600">
                                        {h.approverName}
                                      </span>
                                      <Badge tone={action.tone} size="sm" className="!py-0">
                                        {action.label}
                                      </Badge>
                                      <span className="text-[10px] font-mono-tabular text-ink-400 ml-auto">
                                        {fmtDateTime(h.timestamp).slice(5, 16)}
                                      </span>
                                    </div>
                                    {h.opinion && (
                                      <p className="mt-1.5 text-[11px] text-ink-600 leading-5 bg-ink-50 rounded-md px-2 py-1.5 border border-ink-100/50">
                                        {h.opinion}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                              {isCurrentNode && (
                                <div className="pt-2 border-t border-dashed border-brand-300/50">
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="h-3 w-3 text-brand-500 animate-pulse" />
                                    <span className="text-xs font-medium text-brand-700">
                                      等待处理...
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {req.approvalHistory.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-ink-100">
                        <p className="text-[10px] text-ink-400 font-semibold mb-2">操作流水</p>
                        <div className="relative pl-6">
                          <div className="absolute left-2.5 top-1.5 bottom-1.5 w-px bg-ink-200" />
                          {req.approvalHistory.map((h, idx) => {
                            const action = actionBadgeMap[h.action] || actionBadgeMap.auto;
                            const ActionIcon = action.icon;
                            const isLast = idx === req.approvalHistory.length - 1;
                            return (
                              <div key={h.id} className={cn("relative pb-4", isLast && "pb-0")}>
                                <div
                                  className={cn(
                                    "absolute -left-4.5 h-5 w-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm",
                                    h.action === "approve" && "bg-success-500 text-white",
                                    h.action === "reject" && "bg-warning-red text-white",
                                    h.action === "return" && "bg-warning-orange text-white",
                                    h.action === "delegate" && "bg-brand-500 text-white",
                                    h.action === "auto" && "bg-ink-400 text-white"
                                  )}
                                >
                                  <ActionIcon className="h-2.5 w-2.5" />
                                </div>
                                <div className="p-2.5 rounded-lg border border-ink-100 bg-white">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs font-semibold text-ink-900">
                                          {h.approverName}
                                        </span>
                                        <Badge tone={action.tone} size="sm" className="!py-0">
                                          <ActionIcon className="h-2.5 w-2.5 mr-0.5" />
                                          {action.label}
                                        </Badge>
                                        <span className="text-[10px] text-ink-500 font-medium">
                                          {h.nodeLabel}
                                        </span>
                                        {h.delegatedToUserName && (
                                          <span className="text-[10px] font-medium text-amber-700">
                                            → {h.delegatedToUserName}
                                          </span>
                                        )}
                                      </div>
                                      {h.opinion && (
                                        <p className="mt-1.5 text-[11px] text-ink-600 leading-5 bg-ink-50/80 rounded-md px-2 py-1.5">
                                          {h.opinion}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-[10px] font-mono-tabular text-ink-500">
                                        {fmtDateTime(h.timestamp).slice(5, 16)}
                                      </p>
                                      {h.durationMinutes > 0 && (
                                        <p className="text-[9px] text-ink-400 mt-0.5">
                                          节点耗时 {h.durationMinutes}m
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardBody>
            )}
            {tab === "resubmit" && (
              <CardBody>
                {resubmitHistory.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="h-14 w-14 mx-auto rounded-full bg-ink-100 flex items-center justify-center text-ink-300">
                      <RotateCcw className="h-7 w-7" />
                    </div>
                    <p className="mt-3 text-sm text-ink-500">暂无重提记录</p>
                    <p className="mt-1 text-xs text-ink-400">退回修改后重新提交的记录将在此处展示</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {[...resubmitHistory].reverse().map((entry, idx) => {
                      const prevBatchMap = new Map<string, number>();
                      const newBatchMap = new Map<string, number>();
                      entry.previousItems.forEach((it) => {
                        prevBatchMap.set(it.batchId, (prevBatchMap.get(it.batchId) || 0) + it.quantity);
                      });
                      entry.newItems.forEach((it) => {
                        newBatchMap.set(it.batchId, (newBatchMap.get(it.batchId) || 0) + it.quantity);
                      });
                      const allBatchIds = new Set([...prevBatchMap.keys(), ...newBatchMap.keys()]);
                      const batchDiffs = Array.from(allBatchIds).map((bid) => {
                        const bat = batches.find((b) => b.id === bid);
                        const prev = prevBatchMap.get(bid) || 0;
                        const now = newBatchMap.get(bid) || 0;
                        return {
                          batchId: bid,
                          batchNo: bat?.batchNo || bid,
                          reagentName: bat?.reagentName || "-",
                          prev,
                          now,
                          diff: now - prev,
                          unit: bat?.unit || "",
                        };
                      });

                      return (
                        <Card key={idx} className="border-amber-200 bg-amber-50/40">
                          <CardHeader>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                                <RotateCcw className="h-4 w-4" />
                              </div>
                              <div>
                                <CardTitle>第 {resubmitHistory.length - idx} 次重提</CardTitle>
                                <CardSubTitle>
                                  由 {entry.returnedByUserName} 于 {fmtDateTime(entry.returnedAt).slice(5, 16)} 退回，
                                  申请人于 {fmtDateTime(entry.resubmittedAt).slice(5, 16)} 重新提交
                                </CardSubTitle>
                              </div>
                            </div>
                          </CardHeader>
                          <CardBody className="space-y-3">
                            {entry.returnOpinion && (
                              <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                                <p className="text-[11px] font-semibold text-orange-700 mb-1">
                                  退回意见
                                </p>
                                <p className="text-sm text-orange-800 leading-5">
                                  {entry.returnOpinion}
                                </p>
                              </div>
                            )}
                            <div>
                              <p className="text-[11px] font-semibold text-ink-500 mb-2">
                                批次冻结对比（重提前 → 重提后）
                              </p>
                              <div className="rounded-lg border border-ink-200 overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-ink-50 text-ink-600 text-[11px]">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-semibold">批次号</th>
                                      <th className="px-3 py-2 text-left font-semibold">试剂</th>
                                      <th className="px-3 py-2 text-right font-semibold">重提前</th>
                                      <th className="px-3 py-2 text-right font-semibold">重提后</th>
                                      <th className="px-3 py-2 text-right font-semibold">变动</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-ink-100">
                                    {batchDiffs.map((bd) => (
                                      <tr key={bd.batchId}>
                                        <td className="px-3 py-2 font-mono-tabular text-xs text-ink-700">
                                          {bd.batchNo}
                                        </td>
                                        <td className="px-3 py-2 text-xs truncate max-w-[180px]">
                                          {bd.reagentName}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono-tabular text-xs">
                                          {withComma(bd.prev)} {bd.unit}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono-tabular text-xs font-semibold text-ink-800">
                                          {withComma(bd.now)} {bd.unit}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono-tabular text-xs">
                                          <span
                                            className={cn(
                                              "font-semibold",
                                              bd.diff > 0
                                                ? "text-success-600"
                                                : bd.diff < 0
                                                ? "text-warning-red"
                                                : "text-ink-500"
                                            )}
                                          >
                                            {bd.diff > 0 ? "+" : ""}
                                            {withComma(bd.diff)} {bd.unit}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            )}
          </Card>

          {req.approvalStatus === "approved" && !outbound && user?.roles.includes("keeper") && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-success-500" />
                  <CardTitle>出库确认</CardTitle>
                  <Badge tone="success" size="sm" dot>
                    待出库
                  </Badge>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="label">出库二维码</label>
                    <div className="aspect-square rounded-xl border-2 border-dashed border-ink-200 bg-white flex items-center justify-center">
                      <div className="text-center">
                        <QrCode className="h-20 w-20 mx-auto text-ink-300" />
                        <p className="mt-3 text-xs font-mono-tabular text-ink-500">{req.id}</p>
                        <p className="text-[11px] text-ink-400 mt-1">扫码确认</p>
                      </div>
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <label className="label">FIFO 批次确认</label>
                      <div className="rounded-xl border border-ink-100 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-ink-50 text-ink-600 text-xs">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">批次</th>
                              <th className="px-3 py-2 text-left font-semibold">试剂</th>
                              <th className="px-3 py-2 text-left font-semibold">效期</th>
                              <th className="px-3 py-2 text-right font-semibold">数量</th>
                              <th className="px-3 py-2 text-right font-semibold">剩余</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ink-100">
                            {req.items.map((it) => {
                              const bat = batches.find((b) => b.id === it.batchId);
                              return (
                                <tr key={it.id}>
                                  <td className="px-3 py-2 font-mono-tabular text-xs">{it.batchNo}</td>
                                  <td className="px-3 py-2 text-xs truncate max-w-[140px]">{it.reagentName}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono-tabular text-xs">{fmt(it.expiryDate)}</span>
                                      {bat && it.isFifoRecommended && (
                                        <Badge tone="success" size="sm">FIFO</Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono-tabular font-medium text-ink-800">
                                    {withComma(it.quantity)}{it.unit}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <span className="font-mono-tabular text-xs text-ink-500">
                                      {bat ? withComma(Math.max(0, bat.remainingQty - it.quantity)) : "-"}
                                      {it.unit}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div>
                      <label className="label">
                        领用人签字 <span className="text-warning-red">*</span>
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input
                            placeholder="请领用人签字确认（输入姓名）"
                            leading={<Signature className="h-4 w-4 text-ink-400" />}
                            value={receiverSignature}
                            onChange={(e) => {
                              setReceiverSignature(e.target.value);
                              if (signatureError) setSignatureError("");
                            }}
                            error={signatureError}
                          />
                        </div>
                        <Button
                          variant="success"
                          size="lg"
                          leftIcon={<Check className="h-4 w-4" />}
                          onClick={handleOutboundConfirm}
                          loading={confirming}
                        >
                          确认出库
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {outbound && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success-500" />
                  <CardTitle>出库完成</CardTitle>
                  <Badge tone="success" size="sm" dot>
                    已出库
                  </Badge>
                </div>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[11px] text-ink-500 font-medium">出库单号</p>
                    <p className="mt-1 text-sm font-mono-tabular font-semibold text-brand-600">
                      {outbound.id}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-ink-500 font-medium">出库时间</p>
                    <p className="mt-1 text-sm font-mono-tabular text-ink-900">
                      {fmtDateTime(outbound.outboundTime)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-ink-500 font-medium">保管员</p>
                    <p className="mt-1 text-sm font-semibold text-ink-900">
                      {outbound.operatorName}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-ink-500 font-medium">领用人签字</p>
                    <p className="mt-1 text-sm font-semibold text-ink-900">
                      {outbound.receiverSignature || "-"}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="w-[300px] shrink-0">
          <Card className="sticky top-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand-500" />
                <CardTitle>审批流程图</CardTitle>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-1">
                {workflowNodes.map((node, idx) => {
                  const state = getNodeState(node, idx);
                  const stateColor = {
                    done: "bg-success-500 border-success-500 text-white",
                    current: "bg-brand-500 border-brand-500 text-white animate-pulse",
                    pending: "bg-white border-ink-200 text-ink-400",
                  }[state];
                  const lineColor = {
                    done: "bg-success-300",
                    current: "bg-brand-200",
                    pending: "bg-ink-200",
                  }[state === "done" ? "done" : state === "current" ? "current" : "pending"];
                  const cardBg = {
                    done: "bg-success-50 border-success-200",
                    current: "bg-brand-50 border-brand-200",
                    pending: "bg-ink-50/50 border-ink-100",
                  }[state];
                  const textColor = {
                    done: "text-success-800",
                    current: "text-brand-800",
                    pending: "text-ink-600",
                  }[state];

                  return (
                    <React.Fragment key={node.id}>
                      <div className="flex items-start gap-2.5">
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              "h-7 w-7 shrink-0 rounded-full border-2 flex items-center justify-center text-[11px] font-bold",
                              stateColor
                            )}
                          >
                            {node.type === "start" ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : node.type === "end" ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              idx
                            )}
                          </div>
                          {idx < workflowNodes.length - 1 && (
                            <div className={cn("w-px flex-1 min-h-[32px]", lineColor)} />
                          )}
                        </div>
                        <div
                          className={cn(
                            "flex-1 min-w-0 p-2.5 rounded-lg border mb-1",
                            cardBg
                          )}
                        >
                          <p className={cn("text-xs font-semibold", textColor)}>
                            {node.label}
                          </p>
                          {node.type === "approve" && (
                            <>
                              <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                                {node.assigneeRoles?.map((r) => (
                                  <Badge key={r} tone="default" size="sm" className="!py-0">
                                    {r}
                                  </Badge>
                                ))}
                                {node.approvalMode && (
                                  <Badge
                                    tone={node.approvalMode === "and_sign" ? "warning" : "ink"}
                                    size="sm"
                                    className="!py-0"
                                  >
                                    {node.approvalMode === "and_sign" ? "会签" : "或签"}
                                  </Badge>
                                )}
                              </div>
                              {state === "current" && isApprover && (
                                <div className="mt-1.5 pt-1.5 border-t border-brand-200/60">
                                  <span className="text-[10px] font-medium text-brand-600 flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                                    等待您审批
                                  </span>
                                </div>
                              )}
                              {state === "done" && (
                                <div className="mt-1.5 pt-1.5 border-t border-success-200/60">
                                  <span className="text-[10px] font-medium text-success-600 flex items-center gap-1">
                                    <Check className="h-3 w-3" />
                                    {req.approvalHistory.find((h) => h.nodeId === node.id && h.action === "approve")?.approverName || "已通过"}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {(req.approvalStatus === "pending" && isApprover) ||
      req.approvalStatus === "returned" ||
      (req.approvalStatus === "approved" && !outbound && !user?.roles.includes("keeper")) ? (
        <Card className="sticky bottom-0 shadow-lg border-ink-200">
          <CardBody className="!py-3.5 flex items-center justify-between">
            <div className="text-xs text-ink-500">
              {req.approvalStatus === "pending" && isApprover && "您当前为此申请的审批人，请尽快处理"}
              {req.approvalStatus === "returned" && "申请已被退回，请修改后重新提交"}
              {req.approvalStatus === "approved" && !outbound && !user?.roles.includes("keeper") && "审批已通过，等待保管员出库确认"}
            </div>
            <div className="flex items-center gap-2">
              {req.approvalStatus === "pending" && isApprover && (
                <>
                  <Button
                    variant="ghost"
                    leftIcon={<Users className="h-4 w-4" />}
                    onClick={() => setDelegateModal(true)}
                    disabled={acting}
                  >
                    转办
                  </Button>
                  <Button
                    variant="outline"
                    leftIcon={<RotateCcw className="h-4 w-4" />}
                    onClick={() => {
                      setRejectOpinion("");
                      setRejectModal(true);
                      (setRejectModal as any)._mode = "return";
                    }}
                    disabled={acting}
                  >
                    退回修改
                  </Button>
                  <Button
                    variant="danger"
                    leftIcon={<XCircle className="h-4 w-4" />}
                    onClick={() => {
                      setRejectOpinion("");
                      setRejectModal(true);
                      (setRejectModal as any)._mode = "reject";
                    }}
                    disabled={acting}
                  >
                    驳回
                  </Button>
                  <Button
                    variant="success"
                    leftIcon={<CheckCircle2 className="h-4 w-4" />}
                    onClick={() => setApproveModal(true)}
                    disabled={acting}
                  >
                    同意
                  </Button>
                </>
              )}
              {req.approvalStatus === "returned" && req.applicantId === user?.id && (
                <Button
                  variant="primary"
                  leftIcon={<Edit3 className="h-4 w-4" />}
                  onClick={() => navigate(`/requisition/new?draft=${req.id}`)}
                >
                  修改并重新提交
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Modal
        open={approveModal}
        onClose={() => !acting && setApproveModal(false)}
        title="同意审批"
        subtitle={`节点：${currentNode?.label || ""}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setApproveModal(false)} disabled={acting}>
              取消
            </Button>
            <Button variant="success" onClick={handleApprove} loading={acting} leftIcon={<Check className="h-4 w-4" />}>
              确认同意
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-success-50 border border-success-200">
            <div className="h-10 w-10 shrink-0 rounded-full bg-success-100 flex items-center justify-center text-success-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="text-sm text-success-800">
              <p className="font-semibold">确认通过此申请？</p>
              <p className="text-xs opacity-80 mt-0.5">通过后将进入下一审批节点</p>
            </div>
          </div>
          <Textarea
            label="审批意见（选填）"
            placeholder="请输入审批意见..."
            value={approveOpinion}
            onChange={(e) => setApproveOpinion(e.target.value)}
            rows={4}
          />
        </div>
      </Modal>

      <Modal
        open={rejectModal}
        onClose={() => !acting && setRejectModal(false)}
        title={((setRejectModal as any)._mode === "return" ? "退回修改" : "驳回申请")}
        subtitle={`节点：${currentNode?.label || ""}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectModal(false)} disabled={acting}>
              取消
            </Button>
            <Button
              variant={(setRejectModal as any)._mode === "return" ? "warning" : "danger"}
              onClick={(setRejectModal as any)._mode === "return" ? handleReturn : handleReject}
              loading={acting}
              leftIcon={(setRejectModal as any)._mode === "return" ? <RotateCcw className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            >
              {(setRejectModal as any)._mode === "return" ? "确认退回" : "确认驳回"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-lg border",
            (setRejectModal as any)._mode === "return"
              ? "bg-orange-50 border-orange-200"
              : "bg-rose-50 border-rose-200"
          )}>
            <div className={cn(
              "h-10 w-10 shrink-0 rounded-full flex items-center justify-center",
              (setRejectModal as any)._mode === "return"
                ? "bg-orange-100 text-warning-orange"
                : "bg-rose-100 text-warning-red"
            )}>
              {(setRejectModal as any)._mode === "return" ? (
                <RotateCcw className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
            </div>
            <div className={cn(
              "text-sm",
              (setRejectModal as any)._mode === "return" ? "text-orange-800" : "text-rose-800"
            )}>
              <p className="font-semibold">
                {(setRejectModal as any)._mode === "return"
                  ? "确认退回给申请人修改？"
                  : "确认驳回此申请？"}
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                {(setRejectModal as any)._mode === "return"
                  ? "申请人可修改后重新提交"
                  : "驳回后此申请将终止"}
              </p>
            </div>
          </div>
          <Textarea
            label={((setRejectModal as any)._mode === "return" ? "退回意见" : "驳回意见") + " *"}
            placeholder="请填写意见说明..."
            value={rejectOpinion}
            onChange={(e) => setRejectOpinion(e.target.value)}
            rows={4}
            error={rejectOpinion.trim() === "" ? "请填写意见" : ""}
          />
        </div>
      </Modal>

      <Modal
        open={delegateModal}
        onClose={() => setDelegateModal(false)}
        title="转办审批"
        subtitle="将此审批任务转交给他人处理"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDelegateModal(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={handleDelegate} leftIcon={<Send className="h-4 w-4" />}>
              确认转办
            </Button>
          </>
        }
      >
        <Select
          label="选择转办人"
          value={delegateUserId}
          onChange={(e) => setDelegateUserId(e.target.value)}
          options={[
            { label: "请选择转办人", value: "", disabled: true },
            { label: "陈主任 - 部门主任", value: "u_dept" },
            { label: "赵安全 - 安全管理员", value: "u_safety" },
            { label: "孙主任 - 实验室主任", value: "u_lab" },
          ]}
        />
      </Modal>
    </div>
  );
};

export default RequisitionDetail;
