import type {
  ReagentBatch,
  ApprovalRouteRule,
  Requisition,
  SystemUser,
  HazardQualification,
  OutboundRecord,
  RequisitionItem,
  ApprovalRecord,
} from "@/types";
import { daysFromNow, todayISO, uid } from "../date";

export const mockUsers: SystemUser[] = [
  { id: "u_admin", username: "admin", realName: "系统管理员", department: "信息中心", roles: ["admin"], isActive: true },
  { id: "u_keeper", username: "keeper", realName: "李保管", department: "试剂库", roles: ["keeper"], isActive: true },
  { id: "u_tester1", username: "tester1", realName: "王检测", department: "理化检测室", roles: ["tester"], isActive: true },
  { id: "u_tester2", username: "tester2", realName: "张实验", department: "微生物室", roles: ["tester"], isActive: true },
  { id: "u_dept", username: "dept", realName: "陈主任", department: "理化检测室", roles: ["approver", "director"], isActive: true },
  { id: "u_safety", username: "safety", realName: "赵安全", department: "安全办", roles: ["safety_officer", "approver"], isActive: true },
  { id: "u_lab", username: "lab", realName: "孙主任", department: "中心实验室", roles: ["approver", "director"], isActive: true },
];

export const mockBatches: ReagentBatch[] = (() => {
  const base = [
    { code: "RG-001", name: "无水乙醇",     cat: "有机试剂" as const,   unit: "mL",  price: 85,   hazard: "易燃" as const,     cas: "64-17-5",     manu: "国药集团化学试剂有限公司" },
    { code: "RG-002", name: "乙腈(色谱纯)", cat: "有机试剂" as const,   unit: "mL",  price: 320,  hazard: "易燃" as const,     cas: "75-05-8",      manu: "默克生命科学" },
    { code: "RG-003", name: "盐酸 37%",     cat: "无机试剂" as const,   unit: "mL",  price: 45,   hazard: "腐蚀性" as const,   cas: "7647-01-0",    manu: "西陇科学股份有限公司" },
    { code: "RG-004", name: "氢氧化钠",     cat: "无机试剂" as const,   unit: "g",   price: 28,   hazard: "腐蚀性" as const,   cas: "1310-73-2",    manu: "阿拉丁试剂" },
    { code: "RG-005", name: "氯化钠(基准)", cat: "标准品" as const,     unit: "g",   price: 180,  hazard: "无" as const,       cas: "7647-14-5",    manu: "中国计量科学研究院" },
    { code: "RG-006", name: "黄曲霉毒素B1", cat: "生化试剂" as const,   unit: "mg",  price: 8500, hazard: "有毒" as const,     cas: "1162-65-8",    manu: "Sigma-Aldrich" },
    { code: "RG-007", name: "丙酮",         cat: "有机试剂" as const,   unit: "mL",  price: 120,  hazard: "易燃" as const,     cas: "67-64-1",      manu: "国药集团" },
    { code: "RG-008", name: "高锰酸钾",     cat: "无机试剂" as const,   unit: "g",   price: 65,   hazard: "易制爆" as const,   cas: "7722-64-7",    manu: "天津科密欧" },
    { code: "RG-009", name: "三氯甲烷",     cat: "有机试剂" as const,   unit: "mL",  price: 240,  hazard: "有毒" as const,     cas: "67-66-3",      manu: "上海安谱" },
    { code: "RG-010", name: "磷酸二氢钾",   cat: "无机试剂" as const,   unit: "g",   price: 52,   hazard: "无" as const,       cas: "7778-77-0",    manu: "国药集团" },
    { code: "RG-011", name: "硫酸 98%",     cat: "危化品" as const,     unit: "mL",  price: 78,   hazard: "腐蚀性" as const,   cas: "7664-93-9",    manu: "西陇科学" },
    { code: "RG-012", name: "甲苯",         cat: "危化品" as const,     unit: "mL",  price: 195,  hazard: "易制毒" as const,   cas: "108-88-3",     manu: "国药集团" },
    { code: "RG-013", name: "甲醇",         cat: "有机试剂" as const,   unit: "mL",  price: 165,  hazard: "有毒" as const,     cas: "67-56-1",      manu: "默克" },
    { code: "RG-014", name: "酚酞指示剂",   cat: "普通试剂" as const,   unit: "g",   price: 36,   hazard: "无" as const,       cas: "77-09-8",      manu: "阿拉丁" },
    { code: "RG-015", name: "醋酸乙酯",     cat: "有机试剂" as const,   unit: "mL",  price: 110,  hazard: "易燃" as const,     cas: "141-78-6",     manu: "国药集团" },
  ];

  const result: ReagentBatch[] = [];
  const expiryOffsets = [
    420, 300, 180, 120, 75, 45, 20, 5, -12,
  ];

  base.forEach((r, idx) => {
    const numBatches = idx % 3 === 0 ? 3 : 2;
    for (let b = 0; b < numBatches; b++) {
      const offIndex = (idx * 2 + b) % expiryOffsets.length;
      const expiry = daysFromNow(expiryOffsets[offIndex]);
      const prod = daysFromNow(expiryOffsets[offIndex] - 365);
      const totalQty = [500, 1000, 250, 2000, 100, 25][idx % 6];
      const remain = Math.max(
        0,
        totalQty - [0, 80, 200, 350, 40][b % 5]
      );
      const isExpired = expiryOffsets[offIndex] <= 0;
      const batchNo = `B${202500 + idx * 17 + b * 3}-${String.fromCharCode(65 + b)}`;
      result.push({
        id: "bat_" + uid().slice(0, 8),
        reagentCode: r.code,
        reagentName: r.name,
        category: r.cat,
        casNo: r.cas,
        batchNo,
        manufacturer: r.manu,
        productionDate: prod,
        expiryDate: expiry,
        quantity: totalQty,
        unit: r.unit,
        unitPrice: r.price,
        hazardLevel: r.hazard,
        hazardCodes: r.hazard !== "无" ? ["H225", "H315"] : undefined,
        storageCondition: idx % 4 === 0 ? "2-8℃冷藏" : idx % 3 === 0 ? "避光干燥" : "常温密封",
        isLocked: isExpired,
        lockReason: isExpired ? "已过有效期，自动锁定" : undefined,
        inspectionPassed: true,
        inspectionRemark: "QC验收合格，外观/包装/COA检查通过",
        arrivalDate: daysFromNow(-10 - b * 3),
        operatorId: "u_keeper",
        createdAt: todayISO(),
        remainingQty: remain,
        frozenQty: 0,
      });
    }
  });

  return result;
})();

export const mockQuals: HazardQualification[] = [
  {
    id: "q1", type: "易制毒备案", certificateNo: "SD-YZD-2024-0088",
    holder: "中心实验室", issueDate: "2024-03-15", expiryDate: daysFromNow(260),
    issuingAuthority: "市公安局禁毒支队", status: "valid",
  },
  {
    id: "q2", type: "易制爆备案", certificateNo: "SD-YZB-2024-0126",
    holder: "试剂库", issueDate: "2024-05-08", expiryDate: daysFromNow(320),
    issuingAuthority: "市公安局治安支队", status: "valid",
  },
  {
    id: "q3", type: "人员操作证", certificateNo: "HAZ-OP-2023-0542",
    holder: "李保管", issueDate: "2023-11-20", expiryDate: daysFromNow(150),
    issuingAuthority: "应急管理局培训中心", status: "expiring",
  },
  {
    id: "q4", type: "人员操作证", certificateNo: "HAZ-OP-2022-0318",
    holder: "王检测", issueDate: "2022-09-10", expiryDate: daysFromNow(-20),
    issuingAuthority: "应急管理局培训中心", status: "expired",
  },
];

const defaultWorkflow = (
  level: "simple" | "middle" | "complex"
) => {
  if (level === "simple") {
    return {
      id: "wf_simple",
      name: "一级审批(部门负责人)",
      nodes: [
        { id: "n_start", type: "start" as const, label: "申请提交", approvalMode: "or_sign" as const, position: { x: 60, y: 140 } },
        { id: "n_dept", type: "approve" as const, label: "部门负责人审批", assigneeRoles: ["director"], approvalMode: "or_sign" as const, timeoutHours: 48, timeoutAction: "notify_admin" as const, position: { x: 300, y: 140 } },
        { id: "n_end", type: "end" as const, label: "审批通过", approvalMode: "or_sign" as const, position: { x: 580, y: 140 } },
      ],
      edges: [
        { id: "e1", source: "n_start", target: "n_dept" },
        { id: "e2", source: "n_dept", target: "n_end" },
      ],
    };
  }
  if (level === "middle") {
    return {
      id: "wf_middle",
      name: "二级审批(部门→实验室主任)",
      nodes: [
        { id: "n_start", type: "start" as const, label: "申请提交", approvalMode: "or_sign" as const, position: { x: 40, y: 140 } },
        { id: "n_dept", type: "approve" as const, label: "部门负责人", assigneeRoles: ["director"], approvalMode: "or_sign" as const, position: { x: 220, y: 140 } },
        { id: "n_lab", type: "approve" as const, label: "实验室主任", assigneeUserIds: ["u_lab"], approvalMode: "or_sign" as const, position: { x: 440, y: 140 } },
        { id: "n_end", type: "end" as const, label: "审批通过", approvalMode: "or_sign" as const, position: { x: 660, y: 140 } },
      ],
      edges: [
        { id: "e1", source: "n_start", target: "n_dept" },
        { id: "e2", source: "n_dept", target: "n_lab" },
        { id: "e3", source: "n_lab", target: "n_end" },
      ],
    };
  }
  return {
    id: "wf_complex",
    name: "三级会签(危化品专项)",
    nodes: [
      { id: "n_start", type: "start" as const, label: "申请提交", approvalMode: "or_sign" as const, position: { x: 20, y: 140 } },
      { id: "n_dept", type: "approve" as const, label: "部门负责人", assigneeRoles: ["director"], approvalMode: "or_sign" as const, position: { x: 180, y: 140 } },
      { id: "n_safe", type: "approve" as const, label: "安全管理员", assigneeRoles: ["safety_officer"], approvalMode: "and_sign" as const, position: { x: 380, y: 140 } },
      { id: "n_lab", type: "approve" as const, label: "实验室主任", assigneeUserIds: ["u_lab"], approvalMode: "and_sign" as const, position: { x: 580, y: 140 } },
      { id: "n_end", type: "end" as const, label: "审批通过", approvalMode: "or_sign" as const, position: { x: 780, y: 140 } },
    ],
    edges: [
      { id: "e1", source: "n_start", target: "n_dept" },
      { id: "e2", source: "n_dept", target: "n_safe" },
      { id: "e3", source: "n_safe", target: "n_lab" },
      { id: "e4", source: "n_lab", target: "n_end" },
    ],
  };
};

export const mockRouteRules: ApprovalRouteRule[] = [
  {
    id: "rule_hazard",
    name: "危化品三级会签审批",
    priority: 1,
    enabled: true,
    conditions: [
      { id: "c1", field: "hazardLevel", operator: "ne", value: "无" },
    ],
    conditionLogic: "OR",
    workflow: defaultWorkflow("complex"),
    createdBy: "u_admin",
    updatedAt: todayISO(),
    version: 1,
  },
  {
    id: "rule_amount_high",
    name: "高金额(>5000)普通试剂二级审批",
    priority: 2,
    enabled: true,
    conditions: [
      { id: "c6", field: "totalAmount", operator: "gt", value: 5000 },
      { id: "c7", field: "hazardLevel", operator: "eq", value: "无" },
    ],
    conditionLogic: "AND",
    workflow: defaultWorkflow("middle"),
    createdBy: "u_admin",
    updatedAt: todayISO(),
    version: 1,
  },
  {
    id: "rule_amount_mid",
    name: "金额500-5000普通试剂二级审批",
    priority: 3,
    enabled: true,
    conditions: [
      { id: "c2", field: "totalAmount", operator: "gt", value: 500 },
      { id: "c3", field: "totalAmount", operator: "lte", value: 5000 },
      { id: "c8", field: "hazardLevel", operator: "eq", value: "无" },
    ],
    conditionLogic: "AND",
    workflow: defaultWorkflow("middle"),
    createdBy: "u_admin",
    updatedAt: todayISO(),
    version: 1,
  },
  {
    id: "rule_amount_low",
    name: "普通试剂≤500元一级审批",
    priority: 4,
    enabled: true,
    conditions: [
      { id: "c4", field: "totalAmount", operator: "lte", value: 500 },
      { id: "c5", field: "hazardLevel", operator: "eq", value: "无" },
    ],
    conditionLogic: "AND",
    workflow: defaultWorkflow("simple"),
    createdBy: "u_admin",
    updatedAt: todayISO(),
    version: 1,
  },
  {
    id: "rule_default",
    name: "默认审批流(兜底)",
    priority: 99,
    enabled: true,
    conditions: [],
    conditionLogic: "AND",
    workflow: defaultWorkflow("simple"),
    createdBy: "u_admin",
    updatedAt: todayISO(),
    version: 1,
  },
];

export const mockRequisitions: Requisition[] = (() => {
  const reqBatches = mockBatches.filter((b) => !b.isLocked && b.remainingQty > 0).slice(0, 24);
  const data: Requisition[] = [];
  const statuses: Array<Requisition["approvalStatus"]> = [
    "pending", "pending", "approved", "rejected", "pending", "approved",
    "outbound_completed", "returned",
  ];
  for (let i = 0; i < 8; i++) {
    const itemCount = i % 3 + 1;
    const items: RequisitionItem[] = [];
    let total = 0;
    for (let j = 0; j < itemCount; j++) {
      const bat = reqBatches[(i * 3 + j) % reqBatches.length];
      const qty = Math.max(10, Math.floor(bat.remainingQty * (0.15 + j * 0.1)));
      const sub = +(qty * bat.unitPrice).toFixed(2);
      total += sub;
      items.push({
        id: "ri_" + uid().slice(0, 6),
        batchId: bat.id,
        reagentCode: bat.reagentCode,
        reagentName: bat.reagentName,
        batchNo: bat.batchNo,
        expiryDate: bat.expiryDate,
        quantity: qty,
        unit: bat.unit,
        unitPrice: bat.unitPrice,
        subtotal: sub,
        isFifoRecommended: j === 0,
      });
    }
    const matched =
      total > 5000 ? mockRouteRules[0] : total > 500 ? mockRouteRules[1] : mockRouteRules[2];
    const status = statuses[i];
    const history: ApprovalRecord[] = [];
    if (status !== "draft") {
      const wfNodes = matched.workflow.nodes.filter((n) => n.type === "approve");
      let stopIdx = wfNodes.length;
      if (status === "pending") stopIdx = i % wfNodes.length;
      if (status === "rejected") stopIdx = 1;
      if (status === "returned") stopIdx = Math.min(2, wfNodes.length);
      for (let k = 0; k < stopIdx; k++) {
        const n = wfNodes[k];
        const act =
          status === "rejected" && k === stopIdx - 1
            ? "reject"
            : status === "returned" && k === stopIdx - 1
            ? "return"
            : "approve";
        history.push({
          id: "ar_" + uid().slice(0, 6),
          requisitionId: "",
          nodeId: n.id,
          nodeLabel: n.label,
          approverId: ["u_dept", "u_safety", "u_lab"][k % 3],
          approverName: ["陈主任", "赵安全", "孙主任"][k % 3],
          action: act,
          opinion:
            act === "approve" ? "同意，按规范使用" : act === "reject" ? "数量不合理，请核实" : "补充用途说明",
          timestamp: daysFromNow(-(i + 1)) + " 10:" + (12 + k * 7) + ":00",
          durationMinutes: 45 + k * 30,
        });
      }
    }
    const reqId = `RL20250${String(i + 1).padStart(3, "0")}`;
    history.forEach((h) => (h.requisitionId = reqId));
    data.push({
      id: reqId,
      applicantId: i % 2 === 0 ? "u_tester1" : "u_tester2",
      applicantName: i % 2 === 0 ? "王检测" : "张实验",
      department: i % 2 === 0 ? "理化检测室" : "微生物室",
      purpose: [
        "土壤重金属检测前处理",
        "食品添加剂检测实验",
        "水质VOC检测",
        "微生物培养基配制",
        "农残GC-MS分析",
      ][i % 5],
      items,
      totalAmount: +total.toFixed(2),
      matchedRouteId: matched.id,
      matchedRouteName: matched.name,
      approvalStatus: status,
      currentNodeId:
        status === "pending"
          ? matched.workflow.nodes.filter((n) => n.type === "approve")[
              history.length % matched.workflow.nodes.filter((n) => n.type === "approve").length
            ]?.id
          : undefined,
      approvalHistory: history,
      createdAt: daysFromNow(-i * 2 - 1) + " 09:25:00",
    });
  }
  return data;
})();

export const mockOutbounds: OutboundRecord[] = mockRequisitions
  .filter((r) => r.approvalStatus === "outbound_completed")
  .map((r, idx) => ({
    id: `OB20250${String(idx + 1).padStart(3, "0")}`,
    requisitionId: r.id,
    operatorId: "u_keeper",
    operatorName: "李保管",
    items: r.items.map((it) => ({
      batchId: it.batchId,
      quantity: it.quantity,
      remainingAfter: Math.max(0, (mockBatches.find((b) => b.id === it.batchId)?.remainingQty ?? 0) - it.quantity),
    })),
    outboundTime: daysFromNow(-idx - 1) + " 14:30:00",
  }));
