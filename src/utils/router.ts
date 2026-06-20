import type {
  ApprovalRouteRule,
  RouteCondition,
  RouteTestContext,
  Requisition,
  ApprovalWorkflow,
  ApprovalNode,
  ReagentBatch,
} from "@/types";
import { mockRouteRules } from "./mock/data";

const resolveFieldValue = (ctx: RouteTestContext, field: RouteCondition["field"]) => {
  switch (field) {
    case "category":
      return ctx.category;
    case "hazardLevel":
      return ctx.hazardLevel;
    case "totalAmount":
      return ctx.totalAmount ?? 0;
    case "reagentCodeList":
      return [];
  }
};

const evalCondition = (cond: RouteCondition, ctx: RouteTestContext): boolean => {
  const v = resolveFieldValue(ctx, cond.field);
  const cv = cond.value;
  switch (cond.operator) {
    case "eq":
      return v === cv;
    case "ne":
      return v !== cv;
    case "gt":
      return Number(v) > Number(cv);
    case "gte":
      return Number(v) >= Number(cv);
    case "lt":
      return Number(v) < Number(cv);
    case "lte":
      return Number(v) <= Number(cv);
    case "in":
      return Array.isArray(cv) && cv.includes(v);
    case "not_in":
      return Array.isArray(cv) && !cv.includes(v);
  }
  return false;
};

export const buildRouteContext = (
  req: Pick<Requisition, "totalAmount" | "items">,
  batches: ReagentBatch[]
): RouteTestContext => {
  let maxHazard: RouteTestContext["hazardLevel"] = "无";
  const hazardRank: Record<string, number> = {
    无: 0, 易燃: 1, 腐蚀性: 2, 有毒: 3, 易爆: 4, 易制毒: 5, 易制爆: 6,
  };
  for (const it of req.items) {
    const bat = batches.find((b) => b.id === it.batchId || b.reagentCode === it.reagentCode);
    if (bat && hazardRank[bat.hazardLevel] > (hazardRank[maxHazard || "无"] || 0)) {
      maxHazard = bat.hazardLevel;
    }
  }
  return {
    totalAmount: req.totalAmount,
    hazardLevel: maxHazard,
  };
};

export const matchApprovalRoute = (
  ctx: RouteTestContext,
  rules: ApprovalRouteRule[] = mockRouteRules
): ApprovalRouteRule | undefined => {
  const sorted = [...rules].filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    if (rule.conditions.length === 0) return rule;
    const results = rule.conditions.map((c) => evalCondition(c, ctx));
    const passed =
      rule.conditionLogic === "AND"
        ? results.every(Boolean)
        : results.some(Boolean);
    if (passed) return rule;
  }
  return sorted[sorted.length - 1];
};

export const getApprovalNodes = (
  workflow: ApprovalWorkflow | undefined
): ApprovalNode[] =>
  workflow?.nodes.filter((n) => n.type === "approve") ?? [];

export const getNextApprovalNode = (
  workflow: ApprovalWorkflow | undefined,
  approvedNodeIds: string[]
): ApprovalNode | undefined => {
  const approvers = getApprovalNodes(workflow);
  return approvers.find((n) => !approvedNodeIds.includes(n.id));
};
