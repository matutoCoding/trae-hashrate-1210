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

  const counts = React.useMemo(() => {
    const uid = currentUser?.id ?? "";
    return {
      todo: requisitions.filter(
        (r) => r.approvalStatus === "pending" && r.currentNodeId
      ).length,
      done: requisitions.filter((r) =>
        r.approvalHistory.some((h) => h.approverId === uid)
      ).length,
      mine: requisitions.filter((r) => r.applicantId === uid).length,
      all: requisitions.length,
    };
  }, [requisitions, currentUser]);

  const filtered = React.useMemo(() => {
    const uid = currentUser?.id ?? "";
    let list = requisitions;
    if (activeTab === "todo") {
      list = list.filter((r) => r.approvalStatus === "pending" && r.currentNodeId);
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
  }, [requisitions, activeTab, filterStatus, filterApplicant, searchText, currentUser]);

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
      addApprovalRecord(
        req.id,
        {
          nodeId: req.currentNodeId ?? "",
          nodeLabel: currentNodeLabel(req),
          approverId,
          approverName,
          action: "delegate",
          opinion: `转办给:${delegateUserId ? useAuthStore.getState().users.find((u) => u.id === delegateUserId)?.realName : ""} ${opinion}`,
        },
        req.currentNodeId ?? null,
        "pending"
      );
      toast.success("转办成功", `申请单 ${req.id} 已转办`);
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
                            {req.approvalStatus === "pending" && activeTab === "todo" && (
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
            {selectedReq?.approvalStatus === "pending" && activeTab === "todo" && (
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
