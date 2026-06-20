import * as React from "react";
import {
  Workflow,
  Save,
  Undo2,
  Redo2,
  Play,
  Circle,
  Square,
  Diamond,
  ChevronDown,
  Plus,
  Trash2,
  Shield,
  UserCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useApprovalStore } from "@/store/useApprovalStore";
import { useAuthStore } from "@/store/useAuthStore";
import { matchApprovalRoute } from "@/utils/router";
import type {
  ApprovalWorkflow,
  ApprovalNode,
  WorkflowEdge,
  HazardLevel,
} from "@/types";
import { uid, currency } from "@/utils/date";
import { cn } from "@/lib/utils";

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
      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200",
      "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      checked ? "bg-brand-500" : "bg-ink-200"
    )}
  >
    <span
      className={cn(
        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200",
        checked ? "translate-x-[18px]" : "translate-x-0.5"
      )}
    />
  </button>
);

type HistoryState = {
  nodes: ApprovalNode[];
  edges: WorkflowEdge[];
};

interface NodeDragState {
  id: string;
  offsetX: number;
  offsetY: number;
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 64;
const NODE_RADIUS = 28;

function getNodeCenter(node: ApprovalNode) {
  const x = node.position?.x ?? 100;
  const y = node.position?.y ?? 100;
  if (node.type === "start" || node.type === "end") {
    return { x: x + NODE_RADIUS, y: y + NODE_RADIUS };
  }
  if (node.type === "condition") {
    return { x: x + 60, y: y + 40 };
  }
  return { x: x + NODE_WIDTH / 2, y: y + NODE_HEIGHT / 2 };
}

function bezierPath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = Math.max(40, Math.abs(to.x - from.x) * 0.5);
  const x1 = from.x + dx;
  const x2 = to.x - dx;
  return `M ${from.x} ${from.y} C ${x1} ${from.y}, ${x2} ${to.y}, ${to.x} ${to.y}`;
}

export default function ApprovalFlow() {
  const nav = useNavigate();
  const toast = useToast();
  const [sp] = useSearchParams();
  const ruleIdParam = sp.get("ruleId");

  const { rules, init, updateRule } = useApprovalStore();
  const { users } = useAuthStore();

  const [selectedRuleId, setSelectedRuleId] = useStateEmpty();
  const [selectedNodeId, setSelectedNodeId] = useStateEmpty();

  const [nodes, setNodes] = React.useState<ApprovalNode[]>([]);
  const [edges, setEdges] = React.useState<WorkflowEdge[]>([]);

  const [history, setHistory] = React.useState<HistoryState[]>([]);
  const [historyIdx, setHistoryIdx] = React.useState(-1);

  const [dragState, setDragState] = React.useState<NodeDragState | null>(null);
  const canvasRef = React.useRef<HTMLDivElement>(null);

  const [simAmount, setSimAmount] = React.useState("2000");
  const [simHazard, setSimHazard] = React.useState<HazardLevel>("无");
  const [simRunning, setSimRunning] = useStateFalse();
  const [simPath, setSimPath] = React.useState<string[]>([]);
  const [simStep, setSimStep] = React.useState(-1);

  React.useEffect(() => {
    init();
  }, [init]);

  React.useEffect(() => {
    if (rules.length > 0 && !selectedRuleId) {
      const rid = ruleIdParam && rules.find((r) => r.id === ruleIdParam)
        ? ruleIdParam
        : rules[0].id;
      setSelectedRuleId(rid);
    }
  }, [rules, selectedRuleId, ruleIdParam]);

  React.useEffect(() => {
    const rule = rules.find((r) => r.id === selectedRuleId);
    if (rule) {
      setNodes(rule.workflow.nodes);
      setEdges(rule.workflow.edges);
      setHistory([{ nodes: rule.workflow.nodes, edges: rule.workflow.edges }]);
      setHistoryIdx(0);
      setSelectedNodeId("");
    }
  }, [selectedRuleId]);

  const pushHistory = (ns: ApprovalNode[], es: WorkflowEdge[]) => {
    const next = history.slice(0, historyIdx + 1);
    next.push({ nodes: ns, edges: es });
    setHistory(next);
    setHistoryIdx(next.length - 1);
  };

  const undo = () => {
    if (historyIdx <= 0) return;
    const ni = historyIdx - 1;
    setHistoryIdx(ni);
    setNodes(history[ni].nodes);
    setEdges(history[ni].edges);
  };

  const redo = () => {
    if (historyIdx >= history.length - 1) return;
    const ni = historyIdx + 1;
    setHistoryIdx(ni);
    setNodes(history[ni].nodes);
    setEdges(history[ni].edges);
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  const addNode = (type: ApprovalNode["type"]) => {
    const maxX = nodes.reduce(
      (m, n) => Math.max(m, (n.position?.x ?? 0) + (type === "condition" ? 120 : NODE_WIDTH)),
      0
    );
    const baseY = 140;
    const nn: ApprovalNode = {
      id: "n_" + uid().slice(0, 6),
      type,
      label:
        type === "start"
          ? "申请提交"
          : type === "end"
          ? "审批通过"
          : type === "condition"
          ? "条件判断"
          : `审批节点${nodes.filter((n) => n.type === "approve").length + 1}`,
      approvalMode: "or_sign",
      position: { x: maxX + 80, y: baseY },
      assigneeRoles: type === "approve" ? ["approver"] : undefined,
      timeoutHours: type === "approve" ? 48 : undefined,
      timeoutAction: type === "approve" ? "notify_admin" : undefined,
    };
    const newNodes = [...nodes, nn];
    setNodes(newNodes);
    pushHistory(newNodes, edges);
    setSelectedNodeId(nn.id);
  };

  const updateNode = (id: string, patch: Partial<ApprovalNode>) => {
    const ns = nodes.map((n) => (n.id === id ? { ...n, ...patch } : n));
    setNodes(ns);
    pushHistory(ns, edges);
  };

  const removeNode = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return;
    if (n.type === "start" || n.type === "end") {
      toast.error("不能删除", "起始和结束节点不可删除");
      return;
    }
    const ns = nodes.filter((x) => x.id !== id);
    const es = edges.filter((e) => e.source !== id && e.target !== id);
    setNodes(ns);
    setEdges(es);
    pushHistory(ns, es);
    if (selectedNodeId === id) setSelectedNodeId("");
  };

  const addEdge = () => {
    const ns = [...nodes].sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0));
    if (ns.length < 2) return;
    const sourceCandidates = ns.filter(
      (s) => !edges.some((e) => e.source === s.id && !e.conditionLabel)
    );
    if (sourceCandidates.length < 2) return;
    const source = sourceCandidates[sourceCandidates.length - 2];
    const target = ns[ns.indexOf(source) + 1];
    if (!source || !target) return;
    if (edges.some((e) => e.source === source.id && e.target === target.id)) return;
    const ne: WorkflowEdge = {
      id: "e_" + uid().slice(0, 6),
      source: source.id,
      target: target.id,
    };
    const es = [...edges, ne];
    setEdges(es);
    pushHistory(nodes, es);
  };

  const removeEdge = (id: string) => {
    const es = edges.filter((e) => e.id !== id);
    setEdges(es);
    pushHistory(nodes, es);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent, node: ApprovalNode) => {
    if (e.button !== 0) return;
    setSelectedNodeId(node.id);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragState({
      id: node.id,
      offsetX: e.clientX - rect.left - (node.position?.x ?? 0),
      offsetY: e.clientY - rect.top - (node.position?.y ?? 0),
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!dragState || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = Math.max(0, e.clientX - rect.left - dragState.offsetX);
    const ny = Math.max(0, e.clientY - rect.top - dragState.offsetY);
    const ns = nodes.map((n) =>
      n.id === dragState.id
        ? { ...n, position: { x: nx, y: ny } }
        : n
    );
    setNodes(ns);
  };

  const handleCanvasMouseUp = () => {
    if (dragState) {
      pushHistory(nodes, edges);
      setDragState(null);
    }
  };

  const saveWorkflow = () => {
    const rule = rules.find((r) => r.id === selectedRuleId);
    if (!rule) return;
    const startNode = nodes.find((n) => n.type === "start");
    const endNode = nodes.find((n) => n.type === "end");
    if (!startNode || !endNode) {
      toast.error("保存失败", "必须包含开始和结束节点");
      return;
    }
    const wf: ApprovalWorkflow = {
      ...rule.workflow,
      nodes,
      edges,
    };
    updateRule(rule.id, { workflow: wf });
    toast.success("保存成功", `规则「${rule.name}」工作流已更新`);
  };

  const startSimulation = () => {
    const ctx = {
      totalAmount: Number(simAmount) || 0,
      hazardLevel: simHazard,
    };
    const matched = matchApprovalRoute(ctx, rules);
    if (!matched || matched.id !== selectedRuleId) {
      toast.error("模拟失败", `当前规则未命中(实际匹配: ${matched?.name ?? "无"})`);
      return;
    }
    const startNode = nodes.find((n) => n.type === "start");
    const endNode = nodes.find((n) => n.type === "end");
    if (!startNode || !endNode) return;

    const sortedByX = [...nodes].sort(
      (a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0)
    );
    const path = sortedByX.map((n) => n.id);

    setSimPath(path);
    setSimStep(-1);
    setSimRunning(true);

    path.forEach((_, idx) => {
      setTimeout(() => {
        setSimStep(idx);
        if (idx === path.length - 1) {
          setTimeout(() => {
            setSimRunning(false);
            toast.success("模拟完成", "流程成功走完所有节点");
          }, 600);
        }
      }, (idx + 1) * 700);
    });
  };

  const ruleOptions = rules.map((r) => ({ value: r.id, label: r.name }));

  return (
    <AppShell>
      <PageHeader
        title="审批流设计器"
        subtitle="可视化配置审批节点、连线和属性，支持模拟运行"
        icon={<Workflow className="h-6 w-6" />}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => nav("/approval/config")}>
              返回配置
            </Button>
          </div>
        }
      />

      <Card className="mb-4">
        <CardBody className="!py-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500">规则选择:</span>
            <Select
              className="!w-72"
              options={ruleOptions}
              value={selectedRuleId}
              onChange={(e) => {
                setSelectedRuleId(e.target.value);
                setSimPath([]);
                setSimStep(-1);
              }}
            />
          </div>

          <div className="h-6 w-px bg-ink-200" />

          <div className="flex items-center gap-1">
            <span className="text-xs text-ink-500 mr-1">添加节点:</span>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Circle className="h-3.5 w-3.5 text-success-500" />}
              onClick={() => addNode("start")}
              disabled={nodes.some((n) => n.type === "start")}
            >
              开始
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Square className="h-3.5 w-3.5 text-brand-500" />}
              onClick={() => addNode("approve")}
            >
              审批
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Diamond className="h-3.5 w-3.5 text-amber-500" />}
              onClick={() => addNode("condition")}
            >
              条件
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Circle className="h-3.5 w-3.5 text-brand-500" />}
              onClick={() => addNode("end")}
              disabled={nodes.some((n) => n.type === "end")}
            >
              结束
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowRight className="h-3.5 w-3.5" />}
              onClick={addEdge}
            >
              添加连线
            </Button>
          </div>

          <div className="h-6 w-px bg-ink-200" />

          <Button
            variant="outline"
            size="sm"
            leftIcon={<Undo2 className="h-4 w-4" />}
            onClick={undo}
            disabled={historyIdx <= 0}
          >
            撤销
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Redo2 className="h-4 w-4" />}
            onClick={redo}
            disabled={historyIdx >= history.length - 1}
          >
            重做
          </Button>

          <div className="flex-1" />

          <Button
            variant="success"
            size="sm"
            leftIcon={<Play className="h-4 w-4" />}
            onClick={startSimulation}
            disabled={simRunning}
          >
            模拟运行
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Save className="h-4 w-4" />}
            onClick={saveWorkflow}
          >
            保存
          </Button>
        </CardBody>
      </Card>

      <div className="grid grid-cols-12 gap-4 mb-4" style={{ height: 500 }}>
        <Card className="col-span-9 flex flex-col overflow-hidden">
          <CardHeader className="!py-3">
            <CardTitle className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-brand-500" />
              流程画布
              <span className="text-xs font-normal text-ink-500 ml-1">
                (拖拽节点调整位置，点击选中编辑)
              </span>
            </CardTitle>
          </CardHeader>
          <div
            ref={canvasRef}
            className="flex-1 relative overflow-auto bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]"
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedNodeId("");
            }}
          >
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ minWidth: "1200px", minHeight: "500px" }}
            >
              <defs>
                <marker
                  id="arrow-default"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                </marker>
                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#3F72B0" />
                </marker>
              </defs>
              {edges.map((edge) => {
                const source = nodes.find((n) => n.id === edge.source);
                const target = nodes.find((n) => n.id === edge.target);
                if (!source || !target) return null;
                const from = getNodeCenter(source);
                const to = getNodeCenter(target);
                const active =
                  simPath.length > 0 &&
                  (() => {
                    const si = simPath.indexOf(edge.source);
                    const ti = simPath.indexOf(edge.target);
                    return si >= 0 && ti >= 0 && simStep >= ti;
                  })();
                const midX = (from.x + to.x) / 2;
                const midY = (from.y + to.y) / 2 - 10;
                return (
                  <g key={edge.id}>
                    <path
                      d={bezierPath(from, to)}
                      fill="none"
                      stroke={active ? "#3F72B0" : "#cbd5e1"}
                      strokeWidth={active ? 2.5 : 1.8}
                      markerEnd={active ? "url(#arrow-active)" : "url(#arrow-default)"}
                      className={cn("transition-all duration-500", active && "drop-shadow-[0_0_4px_rgba(63,114,176,0.5)]")}
                    />
                    {edge.conditionLabel && (
                      <text
                        x={midX}
                        y={midY}
                        textAnchor="middle"
                        className={cn(
                          "text-[10px] font-medium transition-all",
                          active ? "fill-brand-600" : "fill-ink-500"
                        )}
                      >
                        <tspan className="px-2 py-0.5 rounded bg-white/80 border border-ink-200">
                          {edge.conditionLabel}
                        </tspan>
                      </text>
                    )}
                    {!edge.conditionLabel && (
                      <g
                        className="cursor-pointer pointer-events-auto opacity-0 hover:opacity-100 transition-opacity"
                        onClick={() => removeEdge(edge.id)}
                      >
                        <circle cx={midX} cy={midY} r="10" fill="white" stroke="#cbd5e1" />
                        <text
                          x={midX}
                          y={midY + 3}
                          textAnchor="middle"
                          className="text-[10px] fill-warning-red font-bold"
                        >
                          ×
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {nodes.map((node) => {
              const selected = selectedNodeId === node.id;
              const simActive = simPath.includes(node.id) && simStep >= simPath.indexOf(node.id);
              const simCurrent = simPath[simStep] === node.id;
              const px = node.position?.x ?? 0;
              const py = node.position?.y ?? 0;

              if (node.type === "start" || node.type === "end") {
                const cx = px + NODE_RADIUS;
                const cy = py + NODE_RADIUS;
                return (
                  <div
                    key={node.id}
                    onMouseDown={(e) => handleCanvasMouseDown(e, node)}
                    className={cn(
                      "absolute cursor-move select-none rounded-full transition-all duration-300",
                      "flex items-center justify-center text-[11px] font-medium",
                      "border-2 shadow-md",
                      node.type === "start"
                        ? simActive
                          ? "bg-emerald-100 border-emerald-500 text-emerald-800"
                          : "bg-emerald-50 border-emerald-300 text-emerald-700"
                        : simActive
                        ? "bg-brand-100 border-brand-500 text-brand-800"
                        : "bg-brand-50 border-brand-300 text-brand-700",
                      selected && "ring-4 ring-brand-200 z-20",
                      simCurrent && "scale-110 z-30 shadow-lg",
                      dragState?.id === node.id && "opacity-80"
                    )}
                    style={{
                      left: px,
                      top: py,
                      width: NODE_RADIUS * 2,
                      height: NODE_RADIUS * 2,
                    }}
                  >
                    {node.label}
                  </div>
                );
              }

              if (node.type === "condition") {
                return (
                  <div
                    key={node.id}
                    onMouseDown={(e) => handleCanvasMouseDown(e, node)}
                    className={cn(
                      "absolute cursor-move select-none transition-all duration-300",
                      "rotate-45 border-2 shadow-md",
                      simActive
                        ? "bg-amber-100 border-amber-500 text-amber-800"
                        : "bg-amber-50 border-amber-300 text-amber-700",
                      selected && "ring-4 ring-brand-200 z-20",
                      simCurrent && "scale-110 z-30 shadow-lg"
                    )}
                    style={{
                      left: px,
                      top: py,
                      width: 80,
                      height: 80,
                    }}
                  >
                    <div className="w-full h-full flex items-center justify-center -rotate-45">
                      <span className="text-[10px] font-medium text-center leading-tight">
                        {node.label}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleCanvasMouseDown(e, node)}
                  className={cn(
                    "absolute cursor-move select-none rounded-lg border-2 shadow-md transition-all duration-300 p-2.5",
                    simActive
                      ? "bg-white border-brand-500 text-ink-900"
                      : "bg-white border-ink-200 text-ink-900",
                    selected && "ring-4 ring-brand-200 z-20 border-brand-400",
                    simCurrent && "scale-105 z-30 shadow-xl border-brand-500",
                    dragState?.id === node.id && "opacity-80"
                  )}
                  style={{
                    left: px,
                    top: py,
                    width: NODE_WIDTH,
                    minHeight: NODE_HEIGHT,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge
                      tone={node.approvalMode === "and_sign" ? "hazard" : "brand"}
                      size="sm"
                    >
                      {node.approvalMode === "and_sign" ? "会签" : "或签"}
                    </Badge>
                    {simCurrent && (
                      <span className="inline-flex h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
                    )}
                  </div>
                  <div className="text-xs font-semibold text-ink-900 leading-tight">
                    {node.label}
                  </div>
                  {(node.assigneeRoles?.length || node.assigneeUserIds?.length) && (
                    <div className="mt-1 text-[10px] text-ink-500 truncate">
                      {node.assigneeRoles?.map(
                        (r) =>
                          ({
                            admin: "管理员",
                            keeper: "保管员",
                            approver: "审批人",
                            director: "主任",
                            safety_officer: "安全员",
                          }[r] ?? r)
                      ).join("、") ||
                        node.assigneeUserIds
                          ?.map(
                            (uid) =>
                              users.find((u) => u.id === uid)?.realName ?? uid
                          )
                          .join("、")}
                    </div>
                  )}
                </div>
              );
            })}

            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Workflow className="h-12 w-12 mx-auto text-ink-300 mb-3" />
                  <p className="text-sm text-ink-500">选择规则后可编辑流程，或添加节点开始设计</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="col-span-3 flex flex-col overflow-hidden">
          <CardHeader className="!py-3">
            <CardTitle className="flex items-center gap-2">
              <Square className="h-4 w-4 text-brand-500" />
              节点属性
            </CardTitle>
          </CardHeader>
          <CardBody className="flex-1 overflow-y-auto space-y-4">
            {selectedNode ? (
              <>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        selectedNode.type === "start"
                          ? "success"
                          : selectedNode.type === "end"
                          ? "brand"
                          : selectedNode.type === "condition"
                          ? "warning"
                          : "default"
                      }
                      size="md"
                    >
                      {selectedNode.type === "start"
                        ? "开始节点"
                        : selectedNode.type === "end"
                        ? "结束节点"
                        : selectedNode.type === "condition"
                        ? "条件节点"
                        : "审批节点"}
                    </Badge>
                    <span className="font-mono text-[10px] text-ink-400">
                      {selectedNode.id}
                    </span>
                  </div>
                </div>

                <Input
                  label="节点名称"
                  value={selectedNode.label}
                  onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                />

                {selectedNode.type === "approve" && (
                  <>
                    <div>
                      <label className="label flex items-center justify-between">
                        <span>审批模式</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() =>
                            updateNode(selectedNode.id, { approvalMode: "or_sign" })
                          }
                          className={cn(
                            "rounded-lg border p-2.5 text-left transition-all",
                            selectedNode.approvalMode === "or_sign"
                              ? "border-brand-400 bg-brand-50 shadow-[0_0_0_3px_rgba(63,114,176,0.1)]"
                              : "border-ink-200 hover:border-ink-300"
                          )}
                        >
                          <div className="text-xs font-semibold text-ink-900">或签</div>
                          <div className="text-[10px] text-ink-500 mt-0.5">
                            任一审批人通过即可
                          </div>
                        </button>
                        <button
                          onClick={() =>
                            updateNode(selectedNode.id, { approvalMode: "and_sign" })
                          }
                          className={cn(
                            "rounded-lg border p-2.5 text-left transition-all",
                            selectedNode.approvalMode === "and_sign"
                              ? "border-hazard-400 bg-violet-50 shadow-[0_0_0_3px_rgba(106,76,147,0.1)]"
                              : "border-ink-200 hover:border-ink-300"
                          )}
                        >
                          <div className="text-xs font-semibold text-ink-900">会签</div>
                          <div className="text-[10px] text-ink-500 mt-0.5">
                            所有审批人都需通过
                          </div>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="label flex items-center gap-1">
                        <Shield className="h-3.5 w-3.5 text-ink-400" />
                        审批角色
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {["admin", "keeper", "approver", "director", "safety_officer"].map(
                          (role) => {
                            const has = selectedNode.assigneeRoles?.includes(role as any);
                            return (
                              <button
                                key={role}
                                onClick={() => {
                                  const list = [...(selectedNode.assigneeRoles ?? [])];
                                  if (has) {
                                    updateNode(selectedNode.id, {
                                      assigneeRoles: list.filter((r) => r !== role),
                                    });
                                  } else {
                                    list.push(role as any);
                                    updateNode(selectedNode.id, { assigneeRoles: list });
                                  }
                                }}
                                className={cn(
                                  "px-2 py-1 rounded-md text-[11px] font-medium transition-all border",
                                  has
                                    ? "bg-brand-500 text-white border-brand-500"
                                    : "bg-white text-ink-600 border-ink-200 hover:border-brand-300"
                                )}
                              >
                                {
                                  {
                                    admin: "管理员",
                                    keeper: "保管员",
                                    approver: "审批人",
                                    director: "部门主任",
                                    safety_officer: "安全员",
                                  }[role]
                                }
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="label flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5 text-ink-400" />
                        指定审批人(覆盖角色)
                      </label>
                      <Select
                        options={[
                          { value: "", label: "不指定(按角色匹配)" },
                          ...users
                            .filter((u) =>
                              u.roles.some(
                                (r) =>
                                  r === "approver" ||
                                  r === "director" ||
                                  r === "safety_officer" ||
                                  r === "admin"
                              )
                            )
                            .map((u) => ({
                              value: u.id,
                              label: `${u.realName} · ${u.department}`,
                            })),
                        ]}
                        value={selectedNode.assigneeUserIds?.[0] ?? ""}
                        onChange={(e) =>
                          updateNode(selectedNode.id, {
                            assigneeUserIds: e.target.value ? [e.target.value] : undefined,
                          })
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="超时时长(小时)"
                        type="number"
                        value={selectedNode.timeoutHours ?? ""}
                        onChange={(e) =>
                          updateNode(selectedNode.id, {
                            timeoutHours: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                      />
                      <Select
                        label="超时动作"
                        options={[
                          { value: "", label: "无动作" },
                          { value: "notify_admin", label: "通知管理员" },
                          { value: "auto_pass", label: "自动通过" },
                          { value: "auto_reject", label: "自动驳回" },
                        ]}
                        value={selectedNode.timeoutAction ?? ""}
                        onChange={(e) =>
                          updateNode(selectedNode.id, {
                            timeoutAction: (e.target.value as any) || undefined,
                          })
                        }
                      />
                    </div>
                  </>
                )}

                <div className="pt-2 border-t border-ink-100">
                  <div className="text-[11px] text-ink-500 mb-2">
                    位置: X {Math.round(selectedNode.position?.x ?? 0)} / Y{" "}
                    {Math.round(selectedNode.position?.y ?? 0)}
                  </div>
                  {(selectedNode.type === "approve" ||
                    selectedNode.type === "condition") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-warning-red hover:text-warning-red hover:bg-red-50"
                      leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => removeNode(selectedNode.id)}
                    >
                      删除节点
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <div className="h-14 w-14 rounded-full bg-ink-100 flex items-center justify-center mb-3 text-ink-400">
                  <AlertTriangle className="h-7 w-7" />
                </div>
                <p className="text-sm text-ink-600 font-medium">未选中节点</p>
                <p className="mt-1 text-xs text-ink-400">
                  点击画布中的节点查看和编辑属性
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="!py-3">
          <CardTitle className="flex items-center gap-2">
            <Play className="h-4 w-4 text-brand-500" />
            模拟运行面板
            <span className="text-xs font-normal text-ink-500 ml-1">
              (输入参数，沿流程高亮经过的节点)
            </span>
            {simRunning && (
              <Badge tone="brand" size="sm" className="ml-2 animate-pulse">
                运行中...
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardBody className="!py-4 flex flex-wrap items-end gap-4">
          <div className="w-48">
            <Input
              label="模拟总金额(元)"
              type="number"
              value={simAmount}
              onChange={(e) => setSimAmount(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Select
              label="最高危化等级"
              options={[
                { value: "无", label: "无(普通)" },
                { value: "易燃", label: "易燃" },
                { value: "易爆", label: "易爆" },
                { value: "有毒", label: "有毒" },
                { value: "腐蚀性", label: "腐蚀性" },
                { value: "易制毒", label: "易制毒" },
                { value: "易制爆", label: "易制爆" },
              ]}
              value={simHazard}
              onChange={(e) => setSimHazard(e.target.value as HazardLevel)}
            />
          </div>
          <div>
            <Button
              variant="success"
              leftIcon={<Play className="h-4 w-4" />}
              onClick={startSimulation}
              disabled={simRunning}
            >
              开始模拟
            </Button>
          </div>

          <div className="h-8 w-px bg-ink-200 mx-2" />

          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="text-xs text-ink-500 shrink-0">模拟参数:</div>
            <div className="flex items-center gap-3 shrink-0">
              <Badge tone="brand" size="sm">
                金额 {currency(Number(simAmount) || 0)}
              </Badge>
              <Badge tone={simHazard === "无" ? "default" : "hazard"} size="sm">
                危化: {simHazard}
              </Badge>
            </div>

            {simPath.length > 0 && (
              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto">
                <div className="text-xs text-ink-500 shrink-0">运行路径:</div>
                <div className="flex items-center gap-1">
                  {simPath.map((nid, idx) => {
                    const n = nodes.find((x) => x.id === nid);
                    const passed = simStep >= idx;
                    const current = simStep === idx;
                    return (
                      <React.Fragment key={nid}>
                        <div
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all shrink-0",
                            passed
                              ? current
                                ? "bg-brand-500 text-white shadow-md animate-pulse"
                                : "bg-emerald-100 text-emerald-800"
                              : "bg-ink-100 text-ink-400"
                          )}
                        >
                          {passed && !current && (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          {n?.label ?? nid}
                        </div>
                        {idx < simPath.length - 1 && (
                          <ArrowRight
                            className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              simStep > idx ? "text-emerald-500" : "text-ink-300"
                            )}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </AppShell>
  );
}

function useStateEmpty() {
  return React.useState("");
}

function useStateFalse() {
  return React.useState(false);
}
