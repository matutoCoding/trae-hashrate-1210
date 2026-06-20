import * as React from "react";
import {
  Route,
  Plus,
  Trash2,
  GripVertical,
  Play,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  Save,
  AlertCircle,
  Users,
  UserCheck,
  Shield,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, CardTitle, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useApprovalStore } from "@/store/useApprovalStore";
import { useAuthStore, useCurrentUser } from "@/store/useAuthStore";
import { matchApprovalRoute, buildRouteContext } from "@/utils/router";
import type { ApprovalRouteRule, RouteCondition, HazardLevel, ReagentCategory } from "@/types";
import { uid, fmtDateTime } from "@/utils/date";
import { cn } from "@/lib/utils";

const Switch: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}> = ({ checked, onChange, disabled, size = "md" }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      "relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors",
      "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      size === "sm" ? "h-4 w-7" : "h-5 w-9",
      checked ? "bg-brand-500" : "bg-ink-200"
    )}
  >
    <span
      className={cn(
        "pointer-events-none inline-block rounded-full bg-white shadow transition-transform duration-200",
        size === "sm" ? "h-3 w-3" : "h-4 w-4",
        checked
          ? size === "sm"
            ? "translate-x-3.5"
            : "translate-x-[18px]"
          : "translate-x-0.5"
      )}
    />
  </button>
);

const fieldOptions = [
  { value: "category", label: "试剂类型" },
  { value: "hazardLevel", label: "危化等级" },
  { value: "totalAmount", label: "总金额" },
];

const operatorOptions: Record<string, Array<{ value: string; label: string }>> = {
  category: [
    { value: "eq", label: "等于" },
    { value: "ne", label: "不等于" },
    { value: "in", label: "属于" },
  ],
  hazardLevel: [
    { value: "eq", label: "等于" },
    { value: "ne", label: "不等于" },
    { value: "in", label: "属于" },
  ],
  totalAmount: [
    { value: "gt", label: "大于 >" },
    { value: "gte", label: "大于等于 ≥" },
    { value: "lt", label: "小于 <" },
    { value: "lte", label: "小于等于 ≤" },
    { value: "eq", label: "等于 =" },
    { value: "ne", label: "不等于 ≠" },
  ],
};

const categoryOptions: Array<{ value: ReagentCategory; label: string }> = [
  { value: "普通试剂", label: "普通试剂" },
  { value: "有机试剂", label: "有机试剂" },
  { value: "无机试剂", label: "无机试剂" },
  { value: "生化试剂", label: "生化试剂" },
  { value: "标准品", label: "标准品" },
  { value: "危化品", label: "危化品" },
];

const hazardOptions: Array<{ value: HazardLevel; label: string }> = [
  { value: "无", label: "无(普通)" },
  { value: "易燃", label: "易燃" },
  { value: "易爆", label: "易爆" },
  { value: "有毒", label: "有毒" },
  { value: "腐蚀性", label: "腐蚀性" },
  { value: "易制毒", label: "易制毒" },
  { value: "易制爆", label: "易制爆" },
];

const hazardRank: Record<string, number> = {
  无: 0, 易燃: 1, 腐蚀性: 2, 有毒: 3, 易爆: 4, 易制毒: 5, 易制爆: 6,
};

function getDefaultValue(field: RouteCondition["field"]): any {
  if (field === "totalAmount") return 0;
  if (field === "category") return "普通试剂";
  if (field === "hazardLevel") return "无";
  return "";
}

export default function ApprovalConfig() {
  const nav = useNavigate();
  const toast = useToast();
  const { rules, init, addRule, updateRule, deleteRule, toggleEnabled, reorder } = useApprovalStore();
  const curUser = useCurrentUser();

  const [selectedId, setSelectedId] = useStateEmpty();
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  const [testAmount, setTestAmount] = React.useState("1000");
  const [testHazard, setTestHazard] = useStateHazard();
  const [testCategory, setTestCategory] = useStateCategory();
  const [testResult, setTestResult] = React.useState<ApprovalRouteRule | null>(null);

  React.useEffect(() => {
    init();
  }, [init]);

  const sortedRules = React.useMemo(
    () => [...rules].sort((a, b) => a.priority - b.priority),
    [rules]
  );

  React.useEffect(() => {
    if (!selectedId && sortedRules.length > 0) {
      setSelectedId(sortedRules[0].id);
    }
  }, [sortedRules, selectedId]);

  const selectedRule = sortedRules.find((r) => r.id === selectedId) ?? null;

  const handleCreateRule = () => {
    const userId = curUser?.id ?? "u_admin";
    const nr = addRule({
      name: "新审批规则",
      priority: sortedRules.length + 1,
      enabled: true,
      conditions: [],
      conditionLogic: "AND",
      workflow: {
        id: "wf_" + uid().slice(0, 6),
        name: "默认工作流",
        nodes: [
          { id: "n_start", type: "start", label: "申请提交", approvalMode: "or_sign", position: { x: 60, y: 140 } },
          { id: "n_dept", type: "approve", label: "部门负责人审批", assigneeRoles: ["director"], approvalMode: "or_sign", position: { x: 300, y: 140 } },
          { id: "n_end", type: "end", label: "审批通过", approvalMode: "or_sign", position: { x: 580, y: 140 } },
        ],
        edges: [
          { id: "e1", source: "n_start", target: "n_dept" },
          { id: "e2", source: "n_dept", target: "n_end" },
        ],
      },
      createdBy: userId,
    });
    setSelectedId(nr.id);
    toast.success("规则已创建", "请配置条件和审批节点");
  };

  const handleUpdate = (patch: Partial<ApprovalRouteRule>) => {
    if (!selectedRule) return;
    updateRule(selectedRule.id, patch);
  };

  const handleAddCondition = () => {
    if (!selectedRule) return;
    const nc: RouteCondition = {
      id: "c_" + uid().slice(0, 6),
      field: "totalAmount",
      operator: "gt",
      value: 0,
    };
    handleUpdate({ conditions: [...selectedRule.conditions, nc] });
  };

  const handleRemoveCondition = (cid: string) => {
    if (!selectedRule) return;
    handleUpdate({ conditions: selectedRule.conditions.filter((c) => c.id !== cid) });
  };

  const handleChangeCondition = (cid: string, patch: Partial<RouteCondition>) => {
    if (!selectedRule) return;
    const list = selectedRule.conditions.map((c) => {
      if (c.id !== cid) return c;
      const merged: RouteCondition = { ...c, ...patch };
      if (patch.field && patch.field !== c.field) {
        merged.value = getDefaultValue(patch.field);
        const firstOp = operatorOptions[patch.field]?.[0]?.value;
        if (firstOp) merged.operator = firstOp as any;
      }
      return merged;
    });
    handleUpdate({ conditions: list });
  };

  const handleDeleteRule = () => {
    if (!selectedRule) return;
    if (!confirm(`确定删除规则「${selectedRule.name}」吗？`)) return;
    deleteRule(selectedRule.id);
    setSelectedId("");
    toast.success("规则已删除");
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(idx);
  };

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndex == null || dragIndex === idx) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newOrder = [...sortedRules];
    const [item] = newOrder.splice(dragIndex, 1);
    newOrder.splice(idx, 0, item);
    reorder(newOrder.map((r) => r.id));
    setDragIndex(null);
    setDragOverIndex(null);
    toast.success("优先级已调整", "规则匹配顺序已更新");
  };

  const handleRunTest = () => {
    const ctx = {
      totalAmount: Number(testAmount) || 0,
      hazardLevel: testHazard,
      category: (testCategory || "普通试剂") as any,
    };
    const matched = matchApprovalRoute(ctx, sortedRules);
    setTestResult(matched ?? null);
    if (matched) {
      toast.success("匹配成功", `命中规则：${matched.name}`);
    } else {
      toast.error("匹配失败", "未命中任何规则");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="条件路由配置"
        subtitle="按优先级匹配规则，动态选择审批流；拖拽左侧列表调整优先级"
        icon={<Route className="h-6 w-6" />}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => nav("/approval/todo")}>
              返回工作台
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={handleCreateRule}>
              新建规则
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-13rem)] min-h-[620px]">
        <Card className="col-span-3 flex flex-col overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-brand-500" />
                规则列表
              </CardTitle>
              <p className="text-xs text-ink-500 mt-0.5">拖拽调整匹配优先级</p>
            </div>
          </CardHeader>
          <CardBody className="!p-2 flex-1 overflow-y-auto">
            <div className="space-y-2">
              {sortedRules.map((rule, idx) => (
                <div
                  key={rule.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  onClick={() => setSelectedId(rule.id)}
                  className={cn(
                    "group relative rounded-lg border p-3 cursor-pointer transition-all",
                    "hover:border-brand-300 hover:shadow-sm",
                    selectedId === rule.id
                      ? "border-brand-400 bg-brand-50/50 shadow-[0_0_0_3px_rgba(63,114,176,0.12)]"
                      : "border-ink-200 bg-white",
                    dragOverIndex === idx && dragIndex !== idx && "border-brand-400 -translate-y-0.5",
                    dragIndex === idx && "opacity-50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 mt-0.5 cursor-grab active:cursor-grabbing text-ink-300 group-hover:text-ink-500 transition-colors">
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone={rule.priority <= 3 ? "brand" : "default"} size="sm">
                          P{rule.priority}
                        </Badge>
                        <Switch
                          size="sm"
                          checked={rule.enabled}
                          onChange={() => toggleEnabled(rule.id)}
                        />
                      </div>
                      <div className="mt-2 text-sm font-medium text-ink-900 truncate">
                        {rule.name}
                      </div>
                      <div className="mt-1 text-xs text-ink-500">
                        条件 {rule.conditions.length} · 节点{" "}
                        {rule.workflow.nodes.filter((n) => n.type === "approve").length} 级
                      </div>
                      <div className="mt-1 text-[10px] text-ink-400">
                        更新于 {fmtDateTime(rule.updatedAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {sortedRules.length === 0 && (
                <div className="py-12 text-center text-xs text-ink-400">
                  暂无规则，点击右上角新建
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <Card className="col-span-6 flex flex-col overflow-hidden">
          {selectedRule ? (
            <>
              <CardHeader>
                <div>
                  <CardTitle>规则编辑</CardTitle>
                  <p className="text-xs text-ink-500 mt-0.5">
                    编辑规则条件、逻辑及审批节点配置
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-warning-red hover:text-warning-red hover:bg-red-50"
                  leftIcon={<Trash2 className="h-4 w-4" />}
                  onClick={handleDeleteRule}
                >
                  删除
                </Button>
              </CardHeader>
              <CardBody className="!p-5 flex-1 overflow-y-auto space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="规则名称"
                    value={selectedRule.name}
                    onChange={(e) => handleUpdate({ name: e.target.value })}
                    placeholder="请输入规则名称"
                  />
                  <Input
                    label="优先级(数字越小越先匹配)"
                    type="number"
                    value={selectedRule.priority}
                    onChange={(e) =>
                      handleUpdate({ priority: Number(e.target.value) || 99 })
                    }
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h4 className="text-sm font-semibold text-ink-900">条件组</h4>
                      <div className="flex items-center rounded-lg bg-ink-100 p-0.5">
                        <button
                          onClick={() => handleUpdate({ conditionLogic: "AND" })}
                          className={cn(
                            "px-3 py-1 rounded-md text-xs font-medium transition-all",
                            selectedRule.conditionLogic === "AND"
                              ? "bg-white text-brand-600 shadow-sm"
                              : "text-ink-600 hover:text-ink-900"
                          )}
                        >
                          全部满足 (AND)
                        </button>
                        <button
                          onClick={() => handleUpdate({ conditionLogic: "OR" })}
                          className={cn(
                            "px-3 py-1 rounded-md text-xs font-medium transition-all",
                            selectedRule.conditionLogic === "OR"
                              ? "bg-white text-brand-600 shadow-sm"
                              : "text-ink-600 hover:text-ink-900"
                          )}
                        >
                          任一满足 (OR)
                        </button>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Plus className="h-3.5 w-3.5" />}
                      onClick={handleAddCondition}
                    >
                      添加条件
                    </Button>
                  </div>

                  {selectedRule.conditions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-ink-200 py-10 text-center text-xs text-ink-400">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 text-ink-300" />
                      <p>未配置条件，此规则将作为兜底规则匹配所有申请</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedRule.conditions.map((c, ci) => (
                        <div
                          key={c.id}
                          className="card p-4 relative"
                        >
                          {ci < selectedRule.conditions.length - 1 && (
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 rounded bg-ink-100 text-[10px] font-bold text-ink-600 border border-ink-200">
                              {selectedRule.conditionLogic}
                            </div>
                          )}
                          <div className="grid grid-cols-12 gap-3 items-end">
                            <div className="col-span-1 text-center">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-brand-600 text-xs font-bold">
                                {ci + 1}
                              </span>
                            </div>
                            <div className="col-span-4">
                              <Select
                                label="条件字段"
                                options={fieldOptions}
                                value={c.field}
                                onChange={(e) =>
                                  handleChangeCondition(c.id, {
                                    field: e.target.value as RouteCondition["field"],
                                  })
                                }
                              />
                            </div>
                            <div className="col-span-3">
                              <Select
                                label="操作符"
                                options={operatorOptions[c.field] ?? []}
                                value={c.operator}
                                onChange={(e) =>
                                  handleChangeCondition(c.id, {
                                    operator: e.target.value as RouteCondition["operator"],
                                  })
                                }
                              />
                            </div>
                            <div className="col-span-3">
                              {c.field === "totalAmount" ? (
                                <Input
                                  label="取值(元)"
                                  type="number"
                                  value={c.value}
                                  onChange={(e) =>
                                    handleChangeCondition(c.id, {
                                      value: Number(e.target.value) || 0,
                                    })
                                  }
                                />
                              ) : c.field === "hazardLevel" ? (
                                <Select
                                  label="危化等级"
                                  options={hazardOptions.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                  }))}
                                  value={c.value}
                                  onChange={(e) =>
                                    handleChangeCondition(c.id, { value: e.target.value })
                                  }
                                />
                              ) : (
                                <Select
                                  label="试剂类型"
                                  options={categoryOptions.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                  }))}
                                  value={c.value}
                                  onChange={(e) =>
                                    handleChangeCondition(c.id, { value: e.target.value })
                                  }
                                />
                              )}
                            </div>
                            <div className="col-span-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-ink-400 hover:text-warning-red hover:bg-red-50 !w-8 !h-8"
                                onClick={() => handleRemoveCondition(c.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-ink-900 mb-3">审批节点列表</h4>
                  <div className="relative">
                    <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
                      {selectedRule.workflow.nodes.map((node, ni) => {
                        const isApprove = node.type === "approve";
                        const isFirst = ni === 0;
                        const isLast = ni === selectedRule.workflow.nodes.length - 1;
                        return (
                          <React.Fragment key={node.id}>
                            <div
                              className={cn(
                                "shrink-0 min-w-[160px] rounded-lg border p-3 relative",
                                node.type === "start" &&
                                  "border-emerald-200 bg-emerald-50/50",
                                node.type === "end" &&
                                  "border-brand-200 bg-brand-50/50",
                                isApprove && "border-ink-200 bg-white",
                                node.type === "condition" &&
                                  "border-amber-200 bg-amber-50/50"
                              )}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <Badge
                                  tone={
                                    node.type === "start"
                                      ? "success"
                                      : node.type === "end"
                                      ? "brand"
                                      : "default"
                                  }
                                  size="sm"
                                >
                                  {node.type === "start"
                                    ? "开始"
                                    : node.type === "end"
                                    ? "结束"
                                    : node.type === "condition"
                                    ? "条件"
                                    : `节点${ni}`}
                                </Badge>
                                {isApprove && (
                                  <Badge
                                    tone={
                                      node.approvalMode === "and_sign" ? "hazard" : "brand"
                                    }
                                    size="sm"
                                  >
                                    {node.approvalMode === "and_sign" ? "会签" : "或签"}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm font-medium text-ink-900 mb-2">
                                {node.label}
                              </div>
                              {isApprove && (
                                <div className="space-y-1 text-[11px] text-ink-500">
                                  {node.assigneeRoles?.length && (
                                    <div className="flex items-center gap-1">
                                      <Shield className="h-3 w-3" />
                                      角色:{" "}
                                      {node.assigneeRoles
                                        .map(
                                          (r) =>
                                            ({
                                              admin: "管理员",
                                              keeper: "保管员",
                                              approver: "审批人",
                                              director: "部门主任",
                                              safety_officer: "安全员",
                                            }[r] ?? r)
                                        )
                                        .join("/")}
                                    </div>
                                  )}
                                  {node.assigneeUserIds?.length && (
                                    <div className="flex items-center gap-1">
                                      <UserCheck className="h-3 w-3" />
                                      人员:{" "}
                                      {node.assigneeUserIds
                                        .map(
                                          (uid) =>
                                            useAuthStore
                                              .getState()
                                              .users.find((u) => u.id === uid)?.realName ?? uid
                                        )
                                        .join("/")}
                                    </div>
                                  )}
                                  {node.timeoutHours && (
                                    <div className="text-ink-400">
                                      超时: {node.timeoutHours}h ·{" "}
                                      {node.timeoutAction === "auto_pass"
                                        ? "自动通过"
                                        : node.timeoutAction === "auto_reject"
                                        ? "自动驳回"
                                        : "通知管理员"}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            {!isLast && (
                              <div className="shrink-0 flex items-center px-1">
                                <div className="h-px w-6 bg-ink-300 relative">
                                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-6 border-transparent border-l-ink-300" />
                                </div>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => nav(`/approval/flow?ruleId=${selectedRule.id}`)}
                      leftIcon={<Route className="h-3.5 w-3.5" />}
                    >
                      打开流程设计器编辑
                    </Button>
                  </div>
                </div>
              </CardBody>
            </>
          ) : (
            <CardBody className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Route className="h-12 w-12 mx-auto text-ink-300 mb-3" />
                <p className="text-sm text-ink-500">选择左侧规则进行编辑，或新建规则</p>
              </div>
            </CardBody>
          )}
        </Card>

        <Card className="col-span-3 flex flex-col overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-4 w-4 text-brand-500" />
                规则测试
              </CardTitle>
              <p className="text-xs text-ink-500 mt-0.5">输入模拟申请参数，验证路由匹配</p>
            </div>
          </CardHeader>
          <CardBody className="!p-5 flex-1 overflow-y-auto space-y-4">
            <Input
              label="申请总金额(元)"
              type="number"
              value={testAmount}
              onChange={(e) => setTestAmount(e.target.value)}
              placeholder="例如: 5000"
            />
            <Select
              label="最高危化等级"
              options={hazardOptions.map((o) => ({ value: o.value, label: o.label }))}
              value={testHazard}
              onChange={(e) => setTestHazard(e.target.value as HazardLevel)}
            />
            <Select
              label="试剂类型"
              options={[
                { value: "", label: "不指定" },
                ...categoryOptions.map((o) => ({ value: o.value, label: o.label })),
              ]}
              value={testCategory}
              onChange={(e) => setTestCategory(e.target.value as ReagentCategory)}
            />
            <Button
              variant="primary"
              className="w-full"
              leftIcon={<Play className="h-4 w-4" />}
              onClick={handleRunTest}
            >
              执行匹配测试
            </Button>

            {testResult && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 animate-fade-in-up">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-success-600" />
                  <span className="text-sm font-semibold text-emerald-800">
                    匹配成功
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-500">命中规则:</span>
                    <Badge tone="brand" size="sm">
                      P{testResult.priority}
                    </Badge>
                  </div>
                  <div className="font-medium text-ink-900">{testResult.name}</div>
                  <div className="flex justify-between pt-2 border-t border-emerald-100">
                    <span className="text-ink-500">条件数:</span>
                    <span className="text-ink-700">{testResult.conditions.length} 个</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-500">审批节点:</span>
                    <span className="text-ink-700">
                      {testResult.workflow.nodes.filter((n) => n.type === "approve").length} 级
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-500">审批流:</span>
                    <span className="text-ink-700 truncate max-w-[140px]" title={testResult.workflow.name}>
                      {testResult.workflow.name}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {testResult === null && testAmount && (
              <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-warning-red" />
                  <span className="text-sm font-semibold text-rose-800">
                    未匹配到规则
                  </span>
                </div>
                <p className="mt-1 text-xs text-rose-600">
                  请检查是否启用了兜底规则(无任何条件的规则)
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-ink-100 mt-auto">
              <h5 className="text-xs font-semibold text-ink-700 mb-2">匹配优先级说明</h5>
              <ul className="space-y-1 text-[11px] text-ink-500 leading-relaxed">
                <li>• 按优先级 P1 → P99 依次尝试匹配</li>
                <li>• 仅在启用的规则中匹配</li>
                <li>• 第一条满足条件的规则即命中</li>
                <li>• 建议保留一条无条件规则作为兜底</li>
              </ul>
            </div>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}

function useStateEmpty() {
  return React.useState("");
}

function useStateHazard() {
  return React.useState<HazardLevel>("无");
}

function useStateCategory() {
  return React.useState<ReagentCategory | "">("普通试剂");
}
