import { create } from "zustand";
import type { ReagentBatch } from "@/types";
import { loadLS, saveLS } from "@/utils/storage";
import { mockBatches } from "@/utils/mock/data";
import { getWarningLevel, nowISO, todayISO, uid } from "@/utils/date";

interface BatchState {
  batches: ReagentBatch[];
  initialized: boolean;
  init: () => void;
  addBatch: (data: Omit<ReagentBatch, "id" | "createdAt" | "remainingQty">) => ReagentBatch;
  updateBatch: (id: string, patch: Partial<ReagentBatch>) => void;
  lockBatch: (id: string, reason: string) => void;
  unlockBatch: (id: string) => void;
  decrementRemaining: (items: Array<{ batchId: string; quantity: number }>) => void;
  scanAndLockExpired: () => number;
}

export const useBatchStore = create<BatchState>((set, get) => ({
  batches: [],
  initialized: false,

  init: () => {
    if (get().initialized) return;
    const data = loadLS<ReagentBatch[]>("batches", []);
    const batches = data.length ? data : mockBatches;
    set({ batches, initialized: true });
    if (data.length === 0) saveLS("batches", mockBatches);
    setTimeout(() => get().scanAndLockExpired(), 300);
  },

  addBatch: (data) => {
    const today = todayISO();
    const isExpired = data.expiryDate < today;
    const autoLocked = isExpired || !data.inspectionPassed;
    const nb: ReagentBatch = {
      ...data,
      id: "bat_" + uid().slice(0, 8),
      createdAt: nowISO(),
      remainingQty: data.quantity,
      isLocked: autoLocked,
      lockReason: autoLocked
        ? isExpired
          ? "入库时已过有效期，自动锁定"
          : "QC验收不合格，自动锁定"
        : undefined,
    };
    const list = [nb, ...get().batches];
    set({ batches: list });
    saveLS("batches", list);
    return nb;
  },

  updateBatch: (id, patch) => {
    const list = get().batches.map((b) =>
      b.id === id ? { ...b, ...patch } : b
    );
    set({ batches: list });
    saveLS("batches", list);
  },

  lockBatch: (id, reason) => get().updateBatch(id, { isLocked: true, lockReason: reason }),
  unlockBatch: (id) => get().updateBatch(id, { isLocked: false, lockReason: undefined }),

  decrementRemaining: (items) => {
    const list = get().batches.map((b) => {
      const it = items.find((x) => x.batchId === b.id);
      if (!it) return b;
      return { ...b, remainingQty: Math.max(0, b.remainingQty - it.quantity) };
    });
    set({ batches: list });
    saveLS("batches", list);
  },

  scanAndLockExpired: () => {
    const today = todayISO();
    let locked = 0;
    const list = get().batches.map((b) => {
      const wl = getWarningLevel(b.expiryDate, b.isLocked);
      if (wl.level === "expired" && !b.isLocked && b.expiryDate < today) {
        locked++;
        return { ...b, isLocked: true, lockReason: "已过有效期，系统自动锁定" };
      }
      return b;
    });
    if (locked > 0) {
      set({ batches: list });
      saveLS("batches", list);
    }
    return locked;
  },
}));
