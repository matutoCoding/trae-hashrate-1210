export type ReagentCategory =
  | "普通试剂"
  | "有机试剂"
  | "无机试剂"
  | "生化试剂"
  | "标准品"
  | "危化品";

export type HazardLevel =
  | "无"
  | "易燃"
  | "易爆"
  | "有毒"
  | "腐蚀性"
  | "易制毒"
  | "易制爆";

export type WarningLevel =
  | "normal"
  | "warning90"
  | "warning30"
  | "warning7"
  | "expired";

export type ApprovalStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "returned"
  | "outbound_completed";

export type ApprovalMode = "or_sign" | "and_sign";

export interface ReagentBatch {
  id: string;
  reagentCode: string;
  reagentName: string;
  category: ReagentCategory;
  casNo?: string;
  batchNo: string;
  manufacturer: string;
  productionDate: string;
  expiryDate: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  hazardLevel: HazardLevel;
  hazardCodes?: string[];
  storageCondition?: string;
  isLocked: boolean;
  lockReason?: string;
  inspectionPassed: boolean;
  inspectionRemark?: string;
  arrivalDate: string;
  operatorId: string;
  createdAt: string;
  remainingQty: number;
  frozenQty: number;
}

export interface RouteCondition {
  id: string;
  field: "category" | "hazardLevel" | "totalAmount" | "reagentCodeList";
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "not_in";
  value: any;
}

export interface ApprovalNode {
  id: string;
  type: "start" | "approve" | "condition" | "end";
  label: string;
  assigneeRoles?: string[];
  assigneeUserIds?: string[];
  approvalMode: ApprovalMode;
  timeoutHours?: number;
  timeoutAction?: "auto_pass" | "auto_reject" | "notify_admin";
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  conditionLabel?: string;
}

export interface ApprovalWorkflow {
  id: string;
  name: string;
  nodes: ApprovalNode[];
  edges: WorkflowEdge[];
}

export interface ApprovalRouteRule {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: RouteCondition[];
  conditionLogic: "AND" | "OR";
  workflow: ApprovalWorkflow;
  createdBy: string;
  updatedAt: string;
  version: number;
}

export interface RequisitionItem {
  id: string;
  batchId: string;
  reagentCode: string;
  reagentName: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
  isFifoRecommended: boolean;
}

export interface ApprovalRecord {
  id: string;
  requisitionId: string;
  nodeId: string;
  nodeLabel: string;
  approverId: string;
  approverName: string;
  delegatedToUserId?: string;
  delegatedToUserName?: string;
  action: "approve" | "reject" | "return" | "delegate" | "auto";
  opinion?: string;
  timestamp: string;
  durationMinutes: number;
}

export interface Requisition {
  id: string;
  applicantId: string;
  applicantName: string;
  department: string;
  purpose: string;
  items: RequisitionItem[];
  totalAmount: number;
  matchedRouteId?: string;
  matchedRouteName?: string;
  approvalStatus: ApprovalStatus;
  currentNodeId?: string;
  nodeDelegations?: Record<string, string>;
  nodeEntryTimes?: Record<string, string>;
  approvalHistory: ApprovalRecord[];
  hazardQualIds?: string[];
  createdAt: string;
}

export interface OutboundItem {
  batchId: string;
  quantity: number;
  remainingAfter: number;
}

export interface OutboundRecord {
  id: string;
  requisitionId: string;
  operatorId: string;
  operatorName: string;
  items: OutboundItem[];
  outboundTime: string;
  receiverSignature?: string;
  remark?: string;
}

export interface HazardQualification {
  id: string;
  type:
    | "易制毒备案"
    | "易制爆备案"
    | "剧毒购买证"
    | "人员操作证"
    | "经营许可证";
  certificateNo: string;
  holder: string;
  issueDate: string;
  expiryDate: string;
  issuingAuthority: string;
  status: "valid" | "expiring" | "expired";
}

export interface SystemUser {
  id: string;
  username: string;
  realName: string;
  email?: string;
  phone?: string;
  department: string;
  roles: Array<
    | "admin"
    | "keeper"
    | "tester"
    | "approver"
    | "safety_officer"
    | "director"
  >;
  isActive: boolean;
}

export interface RouteTestContext {
  category?: ReagentCategory;
  hazardLevel?: HazardLevel;
  totalAmount?: number;
}
