import type { ReagentBatch, RequisitionItem } from "@/types";
import { getWarningLevel, uid } from "@/utils/date";

export interface FifoResult {
  items: (RequisitionItem & { allocatedQty: number })[];
  totalAvailable: number;
  sufficient: boolean;
  shortage: number;
}

export const calculateFifoBatches = (
  allBatches: ReagentBatch[],
  reagentCode: string,
  requiredQty: number
): FifoResult => {
  const candidates = allBatches
    .filter(
      (b) =>
        b.reagentCode === reagentCode &&
        b.remainingQty > 0 &&
        !b.isLocked &&
        b.inspectionPassed
    )
    .sort((a, b) => {
      const cmp = a.expiryDate.localeCompare(b.expiryDate);
      if (cmp !== 0) return cmp;
      return a.arrivalDate.localeCompare(b.arrivalDate);
    });

  const result: FifoResult["items"] = [];
  let accumulated = 0;
  let totalAvailable = 0;

  candidates.forEach((b) => {
    totalAvailable += b.remainingQty;
  });

  for (const b of candidates) {
    if (accumulated >= requiredQty) break;
    const remainNeed = requiredQty - accumulated;
    const allocate = Math.min(remainNeed, b.remainingQty);
    const wl = getWarningLevel(b.expiryDate, b.isLocked);
    result.push({
      id: "fi_" + uid().slice(0, 6),
      batchId: b.id,
      reagentCode: b.reagentCode,
      reagentName: b.reagentName,
      batchNo: b.batchNo,
      expiryDate: b.expiryDate,
      quantity: allocate,
      unit: b.unit,
      unitPrice: b.unitPrice,
      subtotal: +(allocate * b.unitPrice).toFixed(2),
      isFifoRecommended: accumulated === 0,
      allocatedQty: allocate,
    });
    accumulated += allocate;
  }

  return {
    items: result,
    totalAvailable,
    sufficient: accumulated >= requiredQty,
    shortage: Math.max(0, requiredQty - accumulated),
  };
};

export const groupInventoryByReagent = (batches: ReagentBatch[]) => {
  const map = new Map<
    string,
    {
      reagentCode: string;
      reagentName: string;
      category: ReagentBatch["category"];
      hazardLevel: ReagentBatch["hazardLevel"];
      casNo?: string;
      unit: string;
      totalQty: number;
      totalValue: number;
      batchCount: number;
      warningBatches: number;
      nearestExpiry?: string;
    }
  >();
  for (const b of batches) {
    const key = b.reagentCode;
    const cur = map.get(key) || {
      reagentCode: b.reagentCode,
      reagentName: b.reagentName,
      category: b.category,
      hazardLevel: b.hazardLevel,
      casNo: b.casNo,
      unit: b.unit,
      totalQty: 0,
      totalValue: 0,
      batchCount: 0,
      warningBatches: 0,
      nearestExpiry: undefined as string | undefined,
    };
    cur.totalQty += b.remainingQty;
    cur.totalValue += b.remainingQty * b.unitPrice;
    cur.batchCount += 1;
    const wl = getWarningLevel(b.expiryDate, b.isLocked);
    if (wl.level !== "normal") cur.warningBatches += 1;
    if (!cur.nearestExpiry || b.expiryDate < cur.nearestExpiry)
      cur.nearestExpiry = b.expiryDate;
    map.set(key, cur);
  }
  return Array.from(map.values());
};
