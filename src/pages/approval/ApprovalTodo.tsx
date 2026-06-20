import * as React from "react";
import {
  ClipboardCheck,
  Search,
  Calendar,
  UserCircle,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  Forward,
  ChevronDown,
  FileText,
  AlertTriangle,
  Clock,
  Users,
  CircleDot,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Card, CardBody, Tabs } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Table, THead, TBody, TR, TH, TD, Tabular, Empty } from "@/components/ui/Table";
import { HazardBadge, KpiCard } from "@/components/reagent/ReagentBadges";
import { useRequisitionStore } from "@/store/useRequisitionStore";
import { useCurrentUser, useAuthStore } from "@/store/useAuthStore";
import { useApprovalStore } from "@/store/useApprovalStore";
import type { Requisition, ApprovalStatus } from "@/types";
import { currency, fmtDateTime } from "@/utils/date";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/Input";

type TabId = "todo" | "done" | "mine" | "all";

const statusTone: Record<ApprovalStatus, any> = {
  draft: "default",
  pending: "warning",
  approved: "success",
  rejected: "danger",
  returned: "orange",
  outbound_completed: "brand",
};

const statusLabel: Record<ApprovalStatus, string> = {
  draft: "草稿",
  pending: "审批中",
  approved: "已通过",
  rejected: "已驳回",
  returned: "已退回",
  outbound_completed: "已出库",
};

const getMaxHazard = (req: Requisition) => {
  const hazardRank: Record<string, number> = {
    无: 0, 易燃: 1, 腐蚀性: 2, 有毒: 3, 易爆: 4, 易制毒: 5, 易制爆: 6,
  };
  let max: any = "无";
  for (const it of req.items) {
    const batch = useRequisitionStore.getState();
  }
  return max;
};

const getHazardFromRoute = (req: Requisition) => {
  if (req.matchedRouteId === "rule_hazard") {
    if (req.totalAmount > 5000) return "易爆";
    return "易燃";
  }
  return "无";
};

const Switch: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
      "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      checked ? "bg-brand-500" : "bg-ink-200"
    )}
  >
    <span
      className={cn(
        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
        checked ? "translate-x-[18px]" : "translate-x-0.5"
      )}
    />
  </button>
);

export default function ApprovalTodo() {
  const nav = useNavigate();
  const toast = useToast();
  const currentUser = useCurrentUser();
  const { requisitions, addApprovalRecord } = useRequisitionStore();
  const { rules } = useApprovalStore();

  const [activeTab, setActiveTab] = React.useState<TabId>("todo");
  const [filterStatus, setFilterStatus] = useStateLike("all");
  const [filterApplicant, setFilterApplicant] = useStateLike("all");
  const [filterDate, setFilterDate] = useStateLike("all");
  const [searchText, setSearchText] = React.useState("");

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedReq, setSelectedReq] = useStateNullReq();
  const [actionModal, setActionModal] = useStateLike<null | {
    type: "approve" | "reject" | "delegate";
    req: Requisition;
  }>(null);
  const [opinion, setOpinion] = React.useState("");
  const [delegateUserId, setDelegateUserId] = React.useState("");

  useApprovalStore();
  useRequisitionStore();

  const allApplicants = Array.from(
    new Map(requisitions.map((r) => [r.applicantId, r.applicantName])).entries()
  );

  const userCanApprove = (req: Requisition): boolean => {
    if (!currentUser || !req.currentNodeId || req.approvalStatus !== "pending") return false;
    const rule = rules.find((r) => r.id === req.matchedRouteId);
    const node = rule?.workflow.nodes.find((n) => n.id === req.currentNodeId);
    if (!node) return false;
    const delegatedTo = req.nodeDelegations?.[req.currentNodeId];
    if (delegatedTo) {
      return delegatedTo === currentUser.id;
    }
    if (node.assigneeUserIds?.includes(currentUser.id)) return true;
    if (node.assigneeRoles?.some((r) => currentUser.roles.includes(r as any))) return true;
    return false;
  };

  const counts = React.useMemo(() => {
    const uid = currentUser?.id ?? "";
    return {
      todo: requisitions.filter(
        (r) => r.approvalStatus === "pending" && r.currentNodeId && userCanApprove(r)
      ).length,
      done: requisitions.filter((r) =>
        r.approvalHistory.some((h) => h.approverId === uid)
      ).length,
      mine: requisitions.filter((r) => r.applicantId === uid).length,
      all: requisitions.length,
    };
  }, [requisitions, currentUser, rules]);

  const filtered = React.useMemo(() => {
    const uid = currentUser?.id ?? "";
    let list = requisitions;
    if (activeTab === "todo") {
      list = list.filter(
        (r) => r.approvalStatus === "pending" && r.currentNodeId && userCanApprove(r)
      );
    } else if (activeTab === "done") {
      list = list.filter((r) =>
        r.approvalHistory.some((h) => h.approverId === uid)
      );
    } else if (activeTab === "mine") {
      list = list.filter((r) => r.applicantId === uid);
    }
    if (filterStatus !== "all") {
      list = list.filter((r) => r.approvalStatus === filterStatus);
    }
    if (filterApplicant !== "all") {
      list = list.filter((r) => r.applicantId === filterApplicant);
    }
    if (searchText) {
      const s = searchText.toLowerCase();
      list = list.filter(
        (r) =>
          r.id.toLowerCase().includes(s) ||
          r.applicantName.toLowerCase().includes(s) ||
          r.purpose.toLowerCase().includes(s)
      );
    }
    return list;
  }, [requisitions, activeTab, filterStatus, filterApplicant, searchText, currentUser, rules]);

  const currentNodeLabel = (req: Requisition) => {
    if (!req.currentNodeId) return "-";
    const rule = rules.find((r) => r.id === req.matchedRouteId);
    const node = rule?.workflow.nodes.find((n) => n.id === req.currentNodeId);
    return node?.label ?? "-";
  };

  const openDetail = (req: Requisition) => {
    setSelectedReq(req);
    setDetailOpen(true);
  };

  const openAction = (type: "approve" | "reject" | "delegate", req: Requisition) => {
    setActionModal({ type, req });
    setOpinion("");
    setDelegateUserId("");
  };

  const handleConfirm = () => {
    if (!actionModal) return;
    const { type, req } = actionModal;
    if (!userCanApprove(req)) {
      toast.error("无审批权限", "当前登录用户不是该审批节点的处理人");
      setActionModal(null);
      return;
    }
    const approverName = currentUser?.realName ?? "系统";
    const approverId = currentUser?.id ?? "";
    const rule = rules.find((r) => r.id === req.matchedRouteId);
    const approveNodes = rule?.workflow.nodes.filter((n) => n.type === "approve") ?? [];
    const currentNodeIdx = approveNodes.findIndex((n) => n.id === req.currentNodeId);

    if (type === "approve") {
      const nextNode = approveNodes[currentNodeIdx + 1];
      const finalStatus: ApprovalStatus = nextNode ? "pending" : "approved";
      addApprovalRecord(
        req.id,
        {
          nodeId: req.currentNodeId ?? "",
          nodeLabel: currentNodeLabel(req),
          approverId,
          approverName,
          action: "approve",
          opinion: opinion || "同意",
        },
        nextNode?.id ?? null,
        finalStatus
      );
      toast.success("审批通过", `申请单 ${req.id} 已同意`);
    } else if (type === "reject") {
      addApprovalRecord(
        req.id,
        {
          nodeId: req.currentNodeId ?? "",
          nodeLabel: currentNodeLabel(req),
          approverId,
          approverName,
          action: "reject",
          opinion: opinion || "驳回",
        },
        null,
        "rejected"
      );
      toast.success("已驳回", `申请单 ${req.id} 已驳回`);
    } else {
      const targetUser = useAuthStore.getState().users.find((u) => u.id === delegateUserId);
      const targetName = targetUser?.realName ?? delegateUserId;
      addApprovalRecord(
        req.id,
        {
          nodeId: req.currentNodeId ?? "",
          nodeLabel: currentNodeLabel(req),
          approverId,
          approverName,
          delegatedToUserId: delegateUserId,
          delegatedToUserName: targetName,
          action: "delegate",
          opinion: opinion || `转办给 ${targetName}`,
        },
        req.currentNodeId ?? null,
        "pending"
      );
      toast.success("转办成功", `申请单 ${req.id} 已转办给 ${targetName}`);
    }
    setActionModal(null);
  };

  return (
    <AppShell>
      <PageHeader
        title="审批工作台"
        subtitle="管理待办审批、已办记录及我发起的申请"
        icon={<ClipboardCheck className="h-6 w-6" />}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Filter className="h-4 w-4" />}
              onClick={() => nav("/approval/config")}
            >
              路由配置
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileText className="h-4 w-4" />}
              onClick={() => nav("/approval/flow")}
            >
              流程设计
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
        <KpiCard
          label="待我审批"
          value={counts.todo}
          tone="warning"
          icon={<AlertTriangle className="h-5 w-5" />}
          suffix="单"
          onClick={() => setActiveTab("todo")}
        />
        <KpiCard
          label="我已审批"
          value={counts.done}
          tone="success"
          icon={<CheckCircle2 className="h-5 w-5" />}
          suffix="单"
          onClick={() => setActiveTab("done")}
        />
        <KpiCard
          label="我发起的"
          value={counts.mine}
          tone="brand"
          icon={<FileText className="h-5 w-5" />}
          suffix="单"
          onClick={() => setActiveTab("mine")}
        />
        <KpiCard
          label="申请总数"
          value={counts.all}
          tone="hazard"
          icon={<ClipboardCheck className="h-5 w-5" />}
          suffix="单"
          onClick={() => setActiveTab("all")}
        />
      </div>

      <Card>
        <div className="px-5 pt-4">
          <Tabs
            value={activeTab}
            onChange={(v) => setActiveTab(v as TabId)}
            items={[
              { id: "todo", label: "待我审批", count: counts.todo },
              { id: "done", label: "我已审批", count: counts.done },
              { id: "mine", label: "我发起的", count: counts.mine },
              { id: "all", label: "全部", count: counts.all },
            ]}
          />
        </div>

        <div className="px-5 py-4 flex flex-wrap items-center gap-3 border-b border-ink-100 mt-2">
          <Input
            className="!w-64"
            placeholder="搜索单号/申请人/用途"
            leading={<Search className="h-4 w-4" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select
            className="!w-36"
            options={[
              { value: "all", label: "全部状态" },
              { value: "pending", label: "审批中" },
              { value: "approved", label: "已通过" },
              { value: "rejected", label: "已驳回" },
              { value: "returned", label: "已退回" },
              { value: "outbound_completed", label: "已出库" },
            ]}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          <Select
            className="!w-36"
            options={[
              { value: "all", label: "全部申请人" },
              ...allApplicants.map(([v, l]) => ({ value: v, label: l })),
            ]}
            value={filterApplicant}
            onChange={(e) => setFilterApplicant(e.target.value)}
          />
          <Select
            className="!w-40"
            options={[
              { value: "all", label: "全部时间" },
              { value: "today", label: "今天" },
              { value: "week", label: "近7天" },
              { value: "month", label: "近30天" },
            ]}
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
          <div className="flex-1" />
          <span className="text-xs text-ink-500">
            共 <span className="font-semibold text-ink-800">{filtered.length}</span> 条记录
          </span>
        </div>

        <CardBody className="!p-0">
          {filtered.length === 0 ? (
            <Empty text="暂无申请记录" icon={<FileText className="h-8 w-8" />} />
          ) : (
            <Table>
              <Tabular>
                <THead>
                  <TR hoverable={false}>
                    <TH>申请单号</TH>
                    <TH>申请人/部门</TH>
                    <TH>用途说明</TH>
                    <TH>总金额</TH>
                    <TH>危化等级</TH>
                    <TH>当前节点</TH>
                    <TH>状态</TH>
                    <TH>提交时间</TH>
                    <TH className="text-right">操作</TH>
                  </TR>
                </THead>
                <TBody>
                  {filtered.map((req) => {
                    const hazard = getHazardFromRoute(req);
                    return (
                      <TR key={req.id}>
                        <TD>
                          <span className="font-mono font-semibold text-brand-600">
                            {req.id}
                          </span>
                        </TD>
                        <TD>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-semibold">
                              {req.applicantName[0]}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-ink-900">
                                {req.applicantName}
                              </div>
                              <div className="text-xs text-ink-500">{req.department}</div>
                            </div>
                          </div>
                        </TD>
                        <TD>
                          <div className="max-w-[240px] truncate text-sm">{req.purpose}</div>
                        </TD>
                        <TD>
                          <span className="font-mono-tabular font-semibold text-ink-900">
                            {currency(req.totalAmount)}
                          </span>
                        </TD>
                        <TD>
                          <HazardBadge level={hazard} />
                        </TD>
                        <TD>
                          <span className="text-sm text-ink-700">{currentNodeLabel(req)}</span>
                        </TD>
                        <TD>
                          <Badge tone={statusTone[req.approvalStatus]} dot>
                            {statusLabel[req.approvalStatus]}
                          </Badge>
                        </TD>
                        <TD>
                          <span className="text-sm text-ink-500">
                            {fmtDateTime(req.createdAt)}
                          </span>
                        </TD>
                        <TD className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<Eye className="h-3.5 w-3.5" />}
                              onClick={() => openDetail(req)}
                            >
                              详情
                            </Button>
                            {req.approvalStatus === "pending" && activeTab === "todo" && userCanApprove(req) && (
                              <>
                                <Button
                                  variant="success"
                                  size="sm"
                                  leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                                  onClick={() => openAction("approve", req)}
                                >
                                  同意
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  leftIcon={<XCircle className="h-3.5 w-3.5" />}
                                  onClick={() => openAction("reject", req)}
                                >
                                  驳回
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  leftIcon={<Forward className="h-3.5 w-3.5" />}
                                  onClick={() => openAction("delegate", req)}
                                >
                                  转办
                                </Button>
                              </>
                            )}
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
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={`申请单详情 - ${selectedReq?.id ?? ""}`}
        subtitle={`${selectedReq?.applicantName ?? ""} · ${selectedReq?.department ?? ""}`}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              关闭
            </Button>
            {selectedReq?.approvalStatus === "pending" && activeTab === "todo" && userCanApprove(selectedReq) && (
              <>
                <Button
                  variant="danger"
                  leftIcon={<XCircle className="h-4 w-4" />}
                  onClick={() => {
                    setDetailOpen(false);
                    openAction("reject", selectedReq);
                  }}
                >
                  驳回
                </Button>
                <Button
                  variant="success"
                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                  onClick={() => {
                    setDetailOpen(false);
                    openAction("approve", selectedReq);
                  }}
                >
                  同意
                </Button>
              </>
            )}
          </>
        }
      >
        {selectedReq && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-ink-500">申请单号</div>
                <div className="mt-1 font-mono font-semibold text-brand-600">{selectedReq.id}</div>
              </div>
              <div>
                <div className="text-xs text-ink-500">审批状态</div>
                <div className="mt-1">
                  <Badge tone={statusTone[selectedReq.approvalStatus]} size="md" dot>
                    {statusLabel[selectedReq.approvalStatus]}
                  </Badge>
                </div>
              </div>
              <div>
                <div className="text-xs text-ink-500">申请人</div>
                <div className="mt-1 text-sm text-ink-900">{selectedReq.applicantName}</div>
              </div>
              <div>
                <div className="text-xs text-ink-500">所属部门</div>
                <div className="mt-1 text-sm text-ink-900">{selectedReq.department}</div>
              </div>
              <div>
                <div className="text-xs text-ink-500">用途说明</div>
                <div className="mt-1 text-sm text-ink-900">{selectedReq.purpose}</div>
              </div>
              <div>
                <div className="text-xs text-ink-500">匹配路由</div>
                <div className="mt-1 text-sm text-ink-900">
                  {selectedReq.matchedRouteName ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-ink-500">总金额</div>
                <div className="mt-1 font-mono-tabular font-bold text-lg text-ink-900">
                  {currency(selectedReq.totalAmount)}
                </div>
              </div>
              <div>
                <div className="text-xs text-ink-500">提交时间</div>
                <div className="mt-1 text-sm text-ink-900">
                  {fmtDateTime(selectedReq.createdAt)}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-ink-900 mb-3">试剂明细</h4>
              <Table>
                <Tabular>
                  <THead>
                    <TR hoverable={false}>
                      <TH>试剂编码</TH>
                      <TH>试剂名称</TH>
                      <TH>批号</TH>
                      <TH>效期</TH>
                      <TH className="text-right">数量</TH>
                      <TH className="text-right">单价</TH>
                      <TH className="text-right">小计</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {selectedReq.items.map((it) => (
                      <TR key={it.id}>
                        <TD className="font-mono text-xs">{it.reagentCode}</TD>
                        <TD>{it.reagentName}</TD>
                        <TD className="font-mono text-xs">{it.batchNo}</TD>
                        <TD className="text-xs">{it.expiryDate}</TD>
                        <TD className="text-right font-mono-tabular">
                          {it.quantity} {it.unit}
                        </TD>
                        <TD className="text-right font-mono-tabular">{currency(it.unitPrice)}</TD>
                        <TD className="text-right font-mono-tabular font-semibold">
                          {currency(it.subtotal)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Tabular>
              </Table>
            </div>

            {selectedReq.approvalHistory.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-ink-900 mb-3">审批历史</h4>
                <div className="relative pl-6 space-y-4">
                  <div className="absolute left-[11px] top-1 bottom-1 w-px bg-ink-200" />
                  {selectedReq.approvalHistory.map((h) => (
                    <div key={h.id} className="relative">
                      <div
                        className={cn(
                          "absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-white",
                          h.action === "approve"
                            ? "bg-success-500"
                            : h.action === "reject"
                            ? "bg-warning-red"
                            : h.action === "return"
                            ? "bg-warning-orange"
                            : "bg-brand-500"
                        )}
                      />
                      <div className="card p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-ink-900">
                              {h.approverName}
                            </span>
                            <Badge
                              tone={
                                h.action === "approve"
                                  ? "success"
                                  : h.action === "reject"
                                  ? "danger"
                                  : "orange"
                              }
                              size="sm"
                            >
                              {h.action === "approve"
                                ? "同意"
                                : h.action === "reject"
                                ? "驳回"
                                : h.action === "return"
                                ? "退回"
                                : "转办"}
                            </Badge>
                            <span className="text-xs text-ink-500">{h.nodeLabel}</span>
                          </div>
                          <span className="text-xs text-ink-500">{h.timestamp}</span>
                        </div>
                        {h.opinion && (
                          <p className="mt-2 text-sm text-ink-600 pl-1">{h.opinion}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(() => {
              const rule = rules.find((r) => r.id === selectedReq.matchedRouteId);
              if (!rule?.workflow) return null;
              const approveNodes = rule.workflow.nodes.filter(
                (n) => n.type === "approve"
              );
              const approvedIds = new Set(
                selectedReq.approvalHistory
                  .filter((h) => h.action === "approve")
                  .map((h) => h.nodeId)
              );
              const delegateRecordsByNode = new Map<string, typeof selectedReq.approvalHistory>();
              selectedReq.approvalHistory
                .filter((h) => h.action === "delegate")
                .forEach((h) => {
                  const arr = delegateRecordsByNode.get(h.nodeId) || [];
                  arr.push(h);
                  delegateRecordsByNode.set(h.nodeId, arr);
                });
              const fmtDur = (mins: number) => {
                if (mins < 60) return `${mins}分钟`;
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                return m > 0 ? `${h}h${m}m` : `${h}小时`;
              };
              const fmtDurFromNow = (entryISO: string) => {
                const mins = Math.max(
                  1,
                  Math.round((Date.now() - new Date(entryISO).getTime()) / 60000)
                );
                return fmtDur(mins);
              };
              return (
                <div>
                  <h4 className="text-sm font-semibold text-ink-900 mb-3">
                    审批流轨迹
                  </h4>
                  <div className="flex items-start gap-0 overflow-x-auto pb-2">
                    {rule.workflow.nodes
                      .filter(
                        (n) =>
                          n.type === "start" ||
                          n.type === "approve" ||
                          n.type === "end"
                      )
                      .map((node, idx, arr) => {
                        const isStart = node.type === "start";
                        const isEnd = node.type === "end";
                        const isDone =
                          isStart ||
                          isEnd ||
                          approvedIds.has(node.id);
                        const isCurrent =
                          !isStart &&
                          !isEnd &&
                          node.id === selectedReq.currentNodeId &&
                          selectedReq.approvalStatus === "pending";
                        const handlerRecord = selectedReq.approvalHistory.find(
                          (h) => h.nodeId === node.id && h.action === "approve"
                        );
                        const delegates = delegateRecordsByNode.get(node.id) || [];
                        const latestDelegate = delegates.length > 0 ? delegates[delegates.length - 1] : null;
                        const currentHandler = (() => {
                          if (handlerRecord) return handlerRecord.approverName;
                          if (isCurrent) {
                            const delegatedToId = selectedReq.nodeDelegations?.[node.id];
                            if (delegatedToId) {
                              return useAuthStore
                                .getState()
                                .users.find((u) => u.id === delegatedToId)?.realName ?? delegatedToId;
                            }
                            if (node.assigneeUserIds?.length) {
                              return node.assigneeUserIds
                                .map(
                                  (uid) =>
                                    useAuthStore
                                      .getState()
                                      .users.find((u) => u.id === uid)?.realName ?? uid
                                )
                                .join("、");
                            }
                            if (node.assigneeRoles?.length) {
                              return node.assigneeRoles
                                .map((r) =>
                                  useAuthStore
                                    .getState()
                                    .users.filter((u) => u.roles.includes(r as any))
                                    .map((u) => u.realName)
                                    .join("、")
                                )
                                .join("、");
                            }
                            return "-";
                          }
                          return undefined;
                        })();
                        const entryTime = isStart
                          ? selectedReq.createdAt
                          : selectedReq.nodeEntryTimes?.[node.id];
                        const timeoutHrs = node.timeoutHours;
                        let timeInfoLabel: string | undefined;
                        let timeInfoTone: string = "text-ink-400";
                        if (handlerRecord && entryTime) {
                          timeInfoLabel = `用时 ${fmtDur(handlerRecord.durationMinutes)}`;
                        } else if (isCurrent && entryTime) {
                          const elapsedMin = Math.max(
                            1,
                            Math.round((Date.now() - new Date(entryTime).getTime()) / 60000)
                          );
                          const waitedStr = `已等待 ${fmtDur(elapsedMin)}`;
                          if (timeoutHrs) {
                            const timeoutMin = timeoutHrs * 60;
                            const remain = timeoutMin - elapsedMin;
                            if (remain > 0) {
                              timeInfoLabel = `${waitedStr} · 剩余${fmtDur(remain)}`;
                              timeInfoTone = remain < 60 ? "text-amber-600" : "text-brand-500";
                            } else {
                              timeInfoLabel = `${waitedStr} · 已超时${fmtDur(Math.abs(remain))}`;
                              timeInfoTone = "text-warning-red";
                            }
                          } else {
                            timeInfoLabel = waitedStr;
                            timeInfoTone = "text-brand-500";
                          }
                        } else if (!isStart && !isEnd) {
                          if (timeoutHrs) {
                            timeInfoLabel = `SLA ${timeoutHrs}h`;
                          }
                        }
                        const entryLabel = entryTime
                          ? `进入 ${fmtDateTime(entryTime).slice(0, 16)}`
                          : undefined;
                        return (
                          <React.Fragment key={node.id}>
                            <div className="flex flex-col items-center flex-shrink-0" style={{ minWidth: 104 }}>
                              <div
                                className={cn(
                                  "flex items-center justify-center rounded-full border-2 transition-all",
                                  isStart
                                    ? "h-8 w-8 border-success-500 bg-success-50 text-success-500"
                                    : isEnd
                                    ? "h-8 w-8 border-ink-300 bg-ink-50 text-ink-400"
                                    : isDone
                                    ? "h-8 w-8 border-success-500 bg-success-500 text-white"
                                    : isCurrent
                                    ? "h-8 w-8 border-brand-500 bg-brand-500 text-white animate-pulse shadow-[0_0_0_4px_rgba(15,76,129,0.15)]"
                                    : "h-8 w-8 border-ink-200 bg-white text-ink-400"
                                )}
                              >
                                {isDone && !isStart && !isEnd ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : isCurrent ? (
                                  <CircleDot className="h-4 w-4" />
                                ) : isStart ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                  <span className="text-[11px] font-bold">
                                    {approveNodes.findIndex(
                                      (n) => n.id === node.id
                                    ) + 1}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1.5 text-center w-full">
                                <div
                                  className={cn(
                                    "text-[11px] font-semibold leading-tight",
                                    isCurrent
                                      ? "text-brand-600"
                                      : isDone
                                      ? "text-success-600"
                                      : "text-ink-400"
                                  )}
                                >
                                  {node.label}
                                </div>
                                {currentHandler && (
                                  <div
                                    className={cn(
                                      "text-[10px] mt-0.5",
                                      isCurrent ? "text-ink-600 font-medium" : "text-ink-500"
                                    )}
                                  >
                                    {currentHandler}
                                  </div>
                                )}
                                {delegates.length > 0 && (
                                  <div className="space-y-0.5 mt-1">
                                    {delegates.map((d) => (
                                      <div key={d.id} className="text-[9px] text-brand-500 flex items-center justify-center gap-0.5">
                                        <Forward className="h-2.5 w-2.5" />
                                        {d.approverName}→{d.delegatedToUserName}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {entryLabel && (
                                  <div className="text-[9px] text-ink-400 mt-1">{entryLabel}</div>
                                )}
                                {timeInfoLabel && (
                                  <div className={cn("text-[9px] mt-0.5 font-medium", timeInfoTone)}>
                                    <Clock className="h-2 w-2 inline mr-0.5 -translate-y-[1px]" />
                                    {timeInfoLabel}
                                  </div>
                                )}
                              </div>
                            </div>
                            {idx < arr.length - 1 && (
                              <div
                                className={cn(
                                  "flex-1 h-0.5 mt-4 mx-1 rounded flex-shrink-0",
                                  "w-8",
                                  isDone ? "bg-success-300" : "bg-ink-200"
                                )}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </Modal>

      <Modal
        open={!!actionModal}
        onClose={() => setActionModal(null)}
        title={
          actionModal?.type === "approve"
            ? "审批同意"
            : actionModal?.type === "reject"
            ? "审批驳回"
            : "转办审批"
        }
        subtitle={actionModal ? `申请单号：${actionModal.req.id}` : ""}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setActionModal(null)}>
              取消
            </Button>
            <Button
              variant={
                actionModal?.type === "approve"
                  ? "success"
                  : actionModal?.type === "reject"
                  ? "danger"
                  : "primary"
              }
              onClick={handleConfirm}
            >
              确认
              {actionModal?.type === "approve"
                ? "同意"
                : actionModal?.type === "reject"
                ? "驳回"
                : "转办"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {actionModal?.type === "delegate" && (
            <Select
              label="转办给"
              options={[
                { value: "", label: "请选择审批人" },
                ...useAuthStore
                  .getState()
                  .users.filter((u) => u.roles.some((r) => r === "approver" || r === "director"))
                  .map((u) => ({ value: u.id, label: `${u.realName} · ${u.department}` })),
              ]}
              value={delegateUserId}
              onChange={(e) => setDelegateUserId(e.target.value)}
            />
          )}
          <Textarea
            label={
              actionModal?.type === "approve"
                ? "审批意见(选填)"
                : actionModal?.type === "reject"
                ? "驳回原因(必填)"
                : "转办说明(选填)"
            }
            placeholder={
              actionModal?.type === "approve"
                ? "请输入审批意见..."
                : actionModal?.type === "reject"
                ? "请说明驳回原因..."
                : "请输入转办说明..."
            }
            value={opinion}
            onChange={(e) => setOpinion(e.target.value)}
          />
        </div>
      </Modal>
    </AppShell>
  );
}

function useStateLike<T>(initial: T) {
  return React.useState<T>(initial);
}

function useStateNullReq() {
  return React.useState<Requisition | null>(null);
}
