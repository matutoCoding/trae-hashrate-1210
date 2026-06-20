import { create } from "zustand";
import type { Requisition, ApprovalRecord, OutboundRecord, RequisitionItem } from "@/types";
import { loadLS, saveLS } from "@/utils/storage";
import { mockRequisitions, mockOutbounds } from "@/utils/mock/data";
import { getWarningLevel, nowISO, uid } from "@/utils/date";
import type { ApprovalStatus } from "@/types";
import { useBatchStore } from "@/store/useBatchStore";

interface ReqState {
  requisitions: Requisition[];
  outbounds: OutboundRecord[];
  initialized: boolean;
  init: () => void;
  createRequisition: (data: Omit<Requisition, "id" | "approvalHistory" | "approvalStatus" | "createdAt"> & {
    status?: ApprovalStatus;
  }) => Requisition;
  submitApproval: (id: string, routeId: string, routeName: string, firstNodeId: string) => void;
  addApprovalRecord: (
    reqId: string,
    record: Omit<ApprovalRecord, "id" | "requisitionId" | "timestamp" | "durationMinutes">,
    advanceNode: string | null,
    finalStatus: ApprovalStatus
  ) => void;
  resubmitApproval: (
    id: string,
    routeId: string,
    routeName: string,
    firstNodeId: string,
    newItems: RequisitionItem[],
    newTotalAmount: number
  ) => void;
  setCurrentNode: (id: string, nodeId: string | undefined) => void;
  addOutbound: (data: Omit<OutboundRecord, "id" | "outboundTime">) => OutboundRecord;
  findById: (id: string) => Requisition | undefined;
}

export const useRequisitionStore = create<ReqState>((set, get) => ({
  requisitions: [],
  outbounds: [],
  initialized: false,

  init: () => {
    if (get().initialized) return;
    const reqs = loadLS<Requisition[]>("requisitions", []);
    const outs = loadLS<OutboundRecord[]>("outbounds", []);

    const migrated = reqs.length
      ? reqs.map((r) => {
          const migrated = { ...r };
          migrated.nodeEntryTimes = migrated.nodeEntryTimes || {};
          migrated.nodeDelegations = migrated.nodeDelegations || {};
          migrated.resubmitInfo = migrated.resubmitInfo || undefined;

          if (
            migrated.approvalStatus === "pending" &&
            migrated.currentNodeId &&
            !migrated.nodeEntryTimes[migrated.currentNodeId]
          ) {
            const lastHist = migrated.approvalHistory[migrated.approvalHistory.length - 1];
            const inferTime = lastHist ? lastHist.timestamp : migrated.createdAt;
            migrated.nodeEntryTimes[migrated.currentNodeId] = inferTime;
          }

          if (
            migrated.approvalStatus === "pending" &&
            migrated.matchedRouteId &&
            migrated.approvalHistory.length > 0
          ) {
            for (const h of migrated.approvalHistory) {
              if (h.action === "approve" && !migrated.nodeEntryTimes[h.nodeId]) {
                const idx = migrated.approvalHistory.findIndex((x) => x.id === h.id);
                const prev = idx > 0 ? migrated.approvalHistory[idx - 1] : null;
                migrated.nodeEntryTimes[h.nodeId] = prev ? prev.timestamp : migrated.createdAt;
              }
            }
          }

          return migrated;
        })
      : mockRequisitions.map((r) => ({
          ...r,
          nodeEntryTimes: r.nodeEntryTimes || {},
          nodeDelegations: r.nodeDelegations || {},
          resubmitInfo: r.resubmitInfo || undefined,
        }));

    set({
      requisitions: migrated,
      outbounds: outs.length ? outs : mockOutbounds,
      initialized: true,
    });
    if (reqs.length === 0) saveLS("requisitions", migrated);
    if (outs.length === 0) saveLS("outbounds", mockOutbounds);
  },

  findById: (id) => get().requisitions.find((r) => r.id === id),

  createRequisition: (data) => {
    const id = (() => {
      const month = new Date().toISOString().slice(0, 7).replace("-", "");
      const seq = get().requisitions.length + 1;
      return `RL${month}${String(seq).padStart(3, "0")}`;
    })();
    const nr: Requisition = {
      ...data,
      id,
      approvalStatus: data.status ?? "draft",
      approvalHistory: [],
      createdAt: nowISO(),
      items: data.items as RequisitionItem[],
    };
    const list = [nr, ...get().requisitions];
    set({ requisitions: list });
    saveLS("requisitions", list);
    return nr;
  },

  submitApproval: (id, routeId, routeName, firstNodeId) => {
    const now = nowISO();
    const list = get().requisitions.map((r) =>
      r.id === id
        ? {
            ...r,
            matchedRouteId: routeId,
            matchedRouteName: routeName,
            approvalStatus: "pending" as const,
            currentNodeId: firstNodeId,
            nodeEntryTimes: { ...(r.nodeEntryTimes || {}), [firstNodeId]: now },
            nodeDelegations: r.nodeDelegations || {},
          }
        : r
    );
    set({ requisitions: list });
    saveLS("requisitions", list);
    const req = list.find((r) => r.id === id);
    if (req) {
      useBatchStore.getState().freezeQty(
        req.items.map((it) => ({ batchId: it.batchId, quantity: it.quantity }))
      );
    }
  },

  addApprovalRecord: (reqId, record, advanceNode, finalStatus) => {
    const now = nowISO();
    const nowTs = new Date(now).getTime();
    const ar: ApprovalRecord = {
      ...record,
      id: "ar_" + uid().slice(0, 6),
      requisitionId: reqId,
      timestamp: now,
      durationMinutes: 0,
    };
    const list = get().requisitions.map((r) => {
      if (r.id !== reqId) return r;
      let entryTimes = { ...(r.nodeEntryTimes || {}) };
      if (advanceNode && !entryTimes[advanceNode]) {
        entryTimes[advanceNode] = now;
      }
      // duration calculation for the just-finished node
      if (record.nodeId && entryTimes[record.nodeId]) {
        const startTs = new Date(entryTimes[record.nodeId]).getTime();
        ar.durationMinutes = Math.max(0, Math.round((nowTs - startTs) / 60000));
      }
      let delegations = { ...(r.nodeDelegations || {}) };
      if (record.action === "delegate" && record.delegatedToUserId && record.nodeId) {
        delegations[record.nodeId] = record.delegatedToUserId;
      }
      return {
        ...r,
        approvalHistory: [...r.approvalHistory, ar],
        approvalStatus: finalStatus,
        currentNodeId: advanceNode ?? undefined,
        nodeEntryTimes: entryTimes,
        nodeDelegations: delegations,
      };
    });
    set({ requisitions: list });
    saveLS("requisitions", list);
    if (finalStatus === "rejected" || finalStatus === "returned") {
      const req = list.find((r) => r.id === reqId);
      if (req) {
        useBatchStore.getState().releaseFrozen(
          req.items.map((it) => ({ batchId: it.batchId, quantity: it.quantity }))
        );
      }
    }
  },

  resubmitApproval: (id, routeId, routeName, firstNodeId, newItems, newTotalAmount) => {
    const now = nowISO();
    let req = get().requisitions.find((r) => r.id === id);
    if (!req) return;
    // 1) release old frozen
    const previousItems = [...req.items];
    useBatchStore.getState().releaseFrozen(
      previousItems.map((it) => ({ batchId: it.batchId, quantity: it.quantity }))
    );
    // 收集退回信息
    const returnRecord = [...req.approvalHistory].reverse().find((h) => h.action === "return");
    const resubmitHistoryEntry = returnRecord
      ? {
          returnedAt: returnRecord.timestamp,
          returnedBy: returnRecord.approverId,
          returnedByUserName: returnRecord.approverName,
          returnOpinion: returnRecord.opinion || "",
          resubmittedAt: now,
          previousItems,
          newItems,
        }
      : null;
    // 2) clear history / reset state
    const list = get().requisitions.map((r) => {
      if (r.id !== id) return r;
      const newInfo = r.resubmitInfo || { resubmitCount: 0, history: [] };
      if (resubmitHistoryEntry) newInfo.history.push(resubmitHistoryEntry);
      newInfo.resubmitCount = newInfo.history.length;
      return {
        ...r,
        items: newItems,
        totalAmount: newTotalAmount,
        matchedRouteId: routeId,
        matchedRouteName: routeName,
        approvalStatus: "pending" as const,
        currentNodeId: firstNodeId,
        nodeEntryTimes: { [firstNodeId]: now },
        nodeDelegations: {},
        resubmitInfo: newInfo,
      };
    });
    set({ requisitions: list });
    saveLS("requisitions", list);
    const req2 = list.find((r) => r.id === id);
    if (req2) {
      useBatchStore.getState().freezeQty(
        req2.items.map((it) => ({ batchId: it.batchId, quantity: it.quantity }))
      );
    }
  },

  setCurrentNode: (id, nodeId) => {
    const list = get().requisitions.map((r) =>
      r.id === id ? { ...r, currentNodeId: nodeId } : r
    );
    set({ requisitions: list });
    saveLS("requisitions", list);
  },

  addOutbound: (data) => {
    const id = (() => {
      const month = new Date().toISOString().slice(0, 7).replace("-", "");
      const seq = get().outbounds.length + 1;
      return `OB${month}${String(seq).padStart(3, "0")}`;
    })();
    const ob: OutboundRecord = { ...data, id, outboundTime: nowISO() };
    const outs = [ob, ...get().outbounds];
    set({ outbounds: outs });
    saveLS("outbounds", outs);
    useBatchStore.getState().deductAndReleaseFrozen(
      data.items.map((it) => ({ batchId: it.batchId, quantity: it.quantity }))
    );
    const reqs = get().requisitions.map((r) =>
      r.id === data.requisitionId ? { ...r, approvalStatus: "outbound_completed" as const } : r
    );
    set({ requisitions: reqs });
    saveLS("requisitions", reqs);
    return ob;
  },
}));

export const countPendingByUser = (userId: string) => {
  const { requisitions } = useRequisitionStore.getState();
  return requisitions.filter(
    (r) => r.approvalStatus === "pending" && r.currentNodeId
  ).length;
};
