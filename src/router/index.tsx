import * as React from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import Dashboard from "@/pages/Dashboard";
import BatchList from "@/pages/batch/BatchList";
import BatchNew from "@/pages/batch/BatchNew";
import BatchDetail from "@/pages/batch/BatchDetail";
import InventoryList from "@/pages/inventory/InventoryList";
import WarningCenter from "@/pages/inventory/WarningCenter";
import ExpiredList from "@/pages/inventory/ExpiredList";
import ApprovalTodo from "@/pages/approval/ApprovalTodo";
import ApprovalConfig from "@/pages/approval/ApprovalConfig";
import ApprovalFlow from "@/pages/approval/ApprovalFlow";
import RequisitionList from "@/pages/requisition/RequisitionList";
import RequisitionNew from "@/pages/requisition/RequisitionNew";
import RequisitionDetail from "@/pages/requisition/RequisitionDetail";
import HazardPage from "@/pages/hazard/HazardPage";
import { useAuthStore } from "@/store/useAuthStore";
import { useBatchStore } from "@/store/useBatchStore";
import { useApprovalStore } from "@/store/useApprovalStore";
import { useRequisitionStore } from "@/store/useRequisitionStore";

const Bootstrap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initAuth = useAuthStore((s) => s.init);
  const initBatch = useBatchStore((s) => s.init);
  const initAppr = useApprovalStore((s) => s.init);
  const initReq = useRequisitionStore((s) => s.init);
  React.useEffect(() => {
    initAuth();
    initBatch();
    initAppr();
    initReq();
  }, [initAuth, initBatch, initAppr, initReq]);
  return <>{children}</>;
};

export const AppRouter: React.FC = () => (
  <BrowserRouter>
    <ToastProvider>
      <Bootstrap>
        <AppShell>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/batch" element={<BatchList />} />
            <Route path="/batch/new" element={<BatchNew />} />
            <Route path="/batch/:id" element={<BatchDetail />} />
            <Route path="/inventory" element={<InventoryList />} />
            <Route path="/inventory/warning" element={<WarningCenter />} />
            <Route path="/inventory/expired" element={<ExpiredList />} />
            <Route path="/approval/todo" element={<ApprovalTodo />} />
            <Route path="/approval/config" element={<ApprovalConfig />} />
            <Route path="/approval/flow" element={<ApprovalFlow />} />
            <Route path="/requisition" element={<RequisitionList />} />
            <Route path="/requisition/new" element={<RequisitionNew />} />
            <Route path="/requisition/:id" element={<RequisitionDetail />} />
            <Route path="/hazard" element={<HazardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </Bootstrap>
    </ToastProvider>
  </BrowserRouter>
);
