import { useMemo } from "react";
import type { ReagentBatch } from "@/types";
import { calculateFifoBatches } from "@/utils/fifo";

export const useFifo = (
  allBatches: ReagentBatch[],
  reagentCode: string | undefined,
  requiredQty: number
) => {
  return useMemo(() => {
    if (!reagentCode || requiredQty <= 0)
      return { items: [], totalAvailable: 0, sufficient: false, shortage: requiredQty };
    return calculateFifoBatches(allBatches, reagentCode, requiredQty);
  }, [allBatches, reagentCode, requiredQty]);
};
