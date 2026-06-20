import { useMemo } from "react";
import type { ReagentBatch, Requisition } from "@/types";
import { buildRouteContext, matchApprovalRoute } from "@/utils/router";
import type { ApprovalRouteRule } from "@/types";

export const useRouteMatcher = (
  requisition: Pick<Requisition, "totalAmount" | "items"> | null,
  batches: ReagentBatch[],
  rules: ApprovalRouteRule[]
) => {
  return useMemo(() => {
    if (!requisition || requisition.items.length === 0) return null;
    const ctx = buildRouteContext(requisition, batches);
    return { rule: matchApprovalRoute(ctx, rules), ctx };
  }, [requisition, batches, rules]);
};
