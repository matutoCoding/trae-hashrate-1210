import { create } from "zustand";
import type { ApprovalRouteRule } from "@/types";
import { loadLS, saveLS } from "@/utils/storage";
import { mockRouteRules } from "@/utils/mock/data";
import { nowISO, uid } from "@/utils/date";

interface ApprovalState {
  rules: ApprovalRouteRule[];
  initialized: boolean;
  init: () => void;
  addRule: (data: Omit<ApprovalRouteRule, "id" | "version" | "updatedAt" | "createdBy"> & { createdBy: string }) => ApprovalRouteRule;
  updateRule: (id: string, patch: Partial<ApprovalRouteRule>) => void;
  deleteRule: (id: string) => void;
  reorder: (orderedIds: string[]) => void;
  toggleEnabled: (id: string) => void;
}

export const useApprovalStore = create<ApprovalState>((set, get) => ({
  rules: [],
  initialized: false,

  init: () => {
    if (get().initialized) return;
    const data = loadLS<ApprovalRouteRule[]>("approval_rules", []);
    if (!data.length) {
      set({ rules: mockRouteRules, initialized: true });
      saveLS("approval_rules", mockRouteRules);
      return;
    }
    const hasHighAmountRule = data.some((r) => r.id === "rule_amount_high");
    let rules = data;
    if (!hasHighAmountRule) {
      const highRule = mockRouteRules.find((r) => r.id === "rule_amount_high");
      if (highRule) {
        rules = [highRule, ...data.map((r) => {
          if (r.id === "rule_hazard") return r;
          return { ...r, priority: r.priority + 1 };
        })];
      }
      saveLS("approval_rules", rules);
    }
    set({ rules, initialized: true });
  },

  addRule: (data) => {
    const nr: ApprovalRouteRule = {
      ...data,
      id: "rule_" + uid().slice(0, 6),
      version: 1,
      updatedAt: nowISO(),
    };
    const list = [...get().rules, nr];
    set({ rules: list });
    saveLS("approval_rules", list);
    return nr;
  },

  updateRule: (id, patch) => {
    const list = get().rules.map((r) =>
      r.id === id
        ? { ...r, ...patch, version: r.version + 1, updatedAt: nowISO() }
        : r
    );
    set({ rules: list });
    saveLS("approval_rules", list);
  },

  deleteRule: (id) => {
    const list = get().rules.filter((r) => r.id !== id);
    set({ rules: list });
    saveLS("approval_rules", list);
  },

  reorder: (orderedIds) => {
    const map = new Map(get().rules.map((r) => [r.id, r]));
    const list = orderedIds
      .map((id, idx) => {
        const r = map.get(id);
        if (!r) return null;
        return { ...r, priority: idx + 1, updatedAt: nowISO() };
      })
      .filter(Boolean) as ApprovalRouteRule[];
    for (const r of get().rules) {
      if (!orderedIds.includes(r.id)) list.push(r);
    }
    set({ rules: list });
    saveLS("approval_rules", list);
  },

  toggleEnabled: (id) => {
    const r = get().rules.find((x) => x.id === id);
    if (r) get().updateRule(id, { enabled: !r.enabled });
  },
}));
