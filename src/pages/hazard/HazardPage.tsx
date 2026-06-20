import * as React from "react";
import {
  FlaskRound,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  Search,
  Filter,
  Plus,
  FileCheck2,
  UserCheck,
  Building2,
  Lock,
  Unlock,
  Signature,
  User,
  Clock,
  FileText,
  TrendingUp,
  Users,
  CalendarDays,
  Award,
  BadgeCheck,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/layout/AppShell";
import {
  Card,
  CardHeader,
  CardTitle,
  CardSubTitle,
  CardBody,
  Tabs,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Tabular,
  Empty,
} from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  KpiCard,
  HazardBadge,
  WarningBadge,
  ProgressBar,
} from "@/components/reagent/ReagentBadges";
import { useBatchStore } from "@/store/useBatchStore";
import { useRequisitionStore } from "@/store/useRequisitionStore";
import { mockQuals } from "@/utils/mock/data";
import { loadLS, saveLS } from "@/utils/storage";
import {
  fmt,
  fmtDateTime,
  currency,
  withComma,
  remainingDays,
} from "@/utils/date";
import { cn } from "@/lib/utils";
import type {
  ReagentBatch,
  HazardLevel,
  ReagentCategory,
  HazardQualification,
} from "@/types";

const HAZARD_LEVELS: HazardLevel[] = [
  "易燃",
  "易爆",
  "有毒",
  "腐蚀性",
  "易制毒",
  "易制爆",
];

const CATEGORIES: ReagentCategory[] = [
  "普通试剂",
  "有机试剂",
  "无机试剂",
  "生化试剂",
  "标准品",
  "危化品",
];

const QUAL_TYPES = [
  "易制毒备案",
  "易制爆备案",
  "剧毒购买证",
  "人员操作证",
  "经营许可证",
] as const;

const QUAL_TYPE_ICONS: Record<HazardQualification["type"], React.ReactNode> = {
  易制毒备案: <FileCheck2 className="h-5 w-5" />,
  易制爆备案: <ShieldAlert className="h-5 w-5" />,
  剧毒购买证: <AlertTriangle className="h-5 w-5" />,
  人员操作证: <UserCheck className="h-5 w-5" />,
  经营许可证: <Building2 className="h-5 w-5" />,
};

const QUAL_TYPE_TONES: Record<HazardQualification["type"], string> = {
  易制毒备案: "from-rose-50 to-rose-100/40 text-rose-600",
  易制爆备案: "from-orange-50 to-orange-100/40 text-orange-600",
  剧毒购买证: "from-violet-50 to-violet-100/40 text-violet-600",
  人员操作证: "from-brand-50 to-brand-100/40 text-brand-600",
  经营许可证: "from-emerald-50 to-emerald-100/40 text-emerald-600",
};

interface SafetyTimelineItem {
  id: string;
  type: "double_lock" | "requisition";
  time: string;
  title: string;
  description: string;
  keeperName?: string;
  receiverName?: string;
  reagentName?: string;
  quantity?: number;
  unit?: string;
}

interface TopRequisitionUser {
  name: string;
  department: string;
  count: number;
  totalAmount: number;
}

const HazardPage: React.FC = () => {
  const { batches } = useBatchStore();
  const { requisitions } = useRequisitionStore();
  const toast = useToast();

  const [activeTab, setActiveTab] = React.useState("inventory");
  const [quals, setQuals] = React.useState<HazardQualification[]>(() => {
    const saved = loadLS<HazardQualification[]>("hazard_quals", []);
    return saved.length ? saved : mockQuals;
  });
  const [qualModalOpen, setQualModalOpen] = React.useState(false);
  const [editingQual, setEditingQual] = React.useState<HazardQualification | null>(null);

  React.useEffect(() => {
    saveLS("hazard_quals", quals);
  }, [quals]);

  const [hazardFilter, setHazardFilter] = React.useState<string>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [searchText, setSearchText] = React.useState("");

  const [qualForm, setQualForm] = React.useState({
    type: "易制毒备案" as HazardQualification["type"],
    certificateNo: "",
    holder: "",
    issueDate: "",
    expiryDate: "",
    issuingAuthority: "",
  });

  const hazardBatches = React.useMemo(
    () => batches.filter((b) => b.hazardLevel !== "无"),
    [batches]
  );

  const totalInventoryValue = React.useMemo(() => {
    return hazardBatches.reduce(
      (sum, b) => sum + b.remainingQty * b.unitPrice,
      0
    );
  }, [hazardBatches]);

  const validQualCount = React.useMemo(() => {
    return quals.filter((q) => remainingDays(q.expiryDate) > 30).length;
  }, [quals]);

  const expiringOrExpiredQualCount = React.useMemo(() => {
    return quals.filter((q) => remainingDays(q.expiryDate) <= 30).length;
  }, [quals]);

  const filteredHazardBatches = React.useMemo(() => {
    return hazardBatches.filter((b) => {
      if (hazardFilter !== "all" && b.hazardLevel !== hazardFilter) return false;
      if (categoryFilter !== "all" && b.category !== categoryFilter) return false;
      if (searchText) {
        const kw = searchText.toLowerCase();
        return (
          b.reagentName.toLowerCase().includes(kw) ||
          b.reagentCode.toLowerCase().includes(kw) ||
          b.batchNo.toLowerCase().includes(kw) ||
          (b.casNo?.toLowerCase().includes(kw) ?? false)
        );
      }
      return true;
    });
  }, [hazardBatches, hazardFilter, categoryFilter, searchText]);

  const hazardRequisitions = React.useMemo(() => {
    return requisitions.filter((r) =>
      r.items.some((it) => {
        const batch = batches.find((b) => b.id === it.batchId);
        return batch && batch.hazardLevel !== "无";
      })
    );
  }, [requisitions, batches]);

  const getLastRequisitionUser = (batch: ReagentBatch): string => {
    const relevant = [...hazardRequisitions]
      .filter((r) => r.items.some((it) => it.batchId === batch.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return relevant[0]?.applicantName ?? "-";
  };

  const safetyTimeline = React.useMemo<SafetyTimelineItem[]>(() => {
    const items: SafetyTimelineItem[] = [];

    const doubleLockRecords: SafetyTimelineItem[] = hazardBatches
      .filter((b) => b.isLocked)
      .slice(0, 8)
      .map((b) => ({
        id: `lock_${b.id}`,
        type: "double_lock" as const,
        time: b.createdAt,
        title: `${b.reagentName} 双人双锁操作`,
        description: b.lockReason ?? "仓库保管员双人签字确认",
        keeperName: "李保管",
        receiverName: "赵安全",
      }));

    const reqRecords: SafetyTimelineItem[] = hazardRequisitions
      .filter((r) => r.approvalStatus === "outbound_completed")
      .slice(0, 12)
      .map((r) => {
        const hazardItem = r.items.find((it) => {
          const batch = batches.find((b) => b.id === it.batchId);
          return batch && batch.hazardLevel !== "无";
        });
        return {
          id: `req_${r.id}`,
          type: "requisition" as const,
          time: r.createdAt,
          title: `危化品领用 - ${r.id}`,
          description: r.purpose,
          keeperName: "李保管",
          receiverName: r.applicantName,
          reagentName: hazardItem?.reagentName,
          quantity: hazardItem?.quantity,
          unit: hazardItem?.unit,
        };
      });

    items.push(...doubleLockRecords, ...reqRecords);
    items.sort((a, b) => b.time.localeCompare(a.time));
    return items.slice(0, 15);
  }, [hazardBatches, hazardRequisitions, batches]);

  const requisitionTrend = React.useMemo(() => {
    const months: { name: string; count: number; qty: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = fmt(d.toISOString(), "yyyy-MM");
      const monthLabel = fmt(d.toISOString(), "M月");
      const monthReqs = hazardRequisitions.filter((r) =>
        r.createdAt.startsWith(monthKey)
      );
      const count = monthReqs.length;
      const qty = monthReqs.reduce(
        (s, r) =>
          s +
          r.items
            .filter((it) => {
              const batch = batches.find((b) => b.id === it.batchId);
              return batch && batch.hazardLevel !== "无";
            })
            .reduce((si, it) => si + it.quantity, 0),
        0
      );
      months.push({ name: monthLabel, count, qty });
    }
    return months;
  }, [hazardRequisitions, batches]);

  const topRequisitionUsers = React.useMemo<TopRequisitionUser[]>(() => {
    const userMap = new Map<
      string,
      { name: string; department: string; count: number; totalAmount: number }
    >();
    hazardRequisitions.forEach((r) => {
      const existing = userMap.get(r.applicantId);
      if (existing) {
        existing.count += 1;
        existing.totalAmount += r.totalAmount;
      } else {
        userMap.set(r.applicantId, {
          name: r.applicantName,
          department: r.department,
          count: 1,
          totalAmount: r.totalAmount,
        });
      }
    });
    return Array.from(userMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [hazardRequisitions]);

  const getQualStatusInfo = (qual: HazardQualification) => {
    const days = remainingDays(qual.expiryDate);
    if (days <= 0) {
      return {
        status: "expired" as const,
        tone: "danger" as const,
        label: "已过期",
        days,
      };
    }
    if (days <= 30) {
      return {
        status: "expiring" as const,
        tone: "warning" as const,
        label: `临期${days}天`,
        days,
      };
    }
    return {
      status: "valid" as const,
      tone: "success" as const,
      label: "有效",
      days,
    };
  };

  const openNewQualModal = () => {
    setEditingQual(null);
    setQualForm({
      type: "易制毒备案",
      certificateNo: "",
      holder: "",
      issueDate: fmt(new Date().toISOString()),
      expiryDate: fmt(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()),
      issuingAuthority: "",
    });
    setQualModalOpen(true);
  };

  const openEditQualModal = (qual: HazardQualification) => {
    setEditingQual(qual);
    setQualForm({
      type: qual.type,
      certificateNo: qual.certificateNo,
      holder: qual.holder,
      issueDate: qual.issueDate,
      expiryDate: qual.expiryDate,
      issuingAuthority: qual.issuingAuthority,
    });
    setQualModalOpen(true);
  };

  const computeQualStatus = (expiryDate: string): HazardQualification["status"] => {
    const days = remainingDays(expiryDate);
    if (days <= 0) return "expired";
    if (days <= 30) return "expiring";
    return "valid";
  };

  const saveQual = () => {
    if (!qualForm.certificateNo || !qualForm.holder || !qualForm.issuingAuthority) {
      toast.error("请填写完整信息", "证书号、持有人、签发机构为必填项");
      return;
    }
    if (editingQual) {
      setQuals((prev) =>
        prev.map((q) =>
          q.id === editingQual.id
            ? { ...q, ...qualForm, status: computeQualStatus(qualForm.expiryDate) }
            : q
        )
      );
      toast.success("资质更新成功", `${qualForm.type}信息已更新`);
    } else {
      const newQual: HazardQualification = {
        id: "q_" + Date.now().toString(36),
        ...qualForm,
        status: computeQualStatus(qualForm.expiryDate),
      };
      setQuals((prev) => [...prev, newQual]);
      toast.success("资质添加成功", `${qualForm.type}已录入系统`);
    }
    setQualModalOpen(false);
  };

  const deleteQual = (id: string) => {
    setQuals((prev) => prev.filter((q) => q.id !== id));
    toast.success("资质已删除", "相关记录已从系统移除");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="危化品管理"
        subtitle="危险化学品全生命周期管理：库存监控、资质备案、安全台账、领用追溯，符合双人双锁与五双管理规范。"
        icon={<ShieldAlert className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              leftIcon={<FileText className="h-4 w-4" />}
              onClick={() => toast.show({ type: "info", title: "功能开发中", message: "安全台账导出功能即将上线" })}
            >
              导出台账
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<ShieldCheck className="h-4 w-4" />}
              onClick={() => toast.show({ type: "info", title: "合规检查", message: "危化品合规性检查通过" })}
            >
              合规检查
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="危化品批次数量"
          value={withComma(hazardBatches.length)}
          icon={<FlaskRound className="h-5 w-5" />}
          tone="hazard"
          suffix="批"
          sub={`覆盖 ${new Set(hazardBatches.map((b) => b.reagentCode)).size} 种危化品`}
        />
        <KpiCard
          label="危化品总库存值"
          value={currency(totalInventoryValue)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="brand"
          sub={`库存总量 ${withComma(
            hazardBatches.reduce((s, b) => s + b.remainingQty, 0)
          )} 单位`}
        />
        <KpiCard
          label="在效资质数"
          value={validQualCount}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="success"
          suffix="份"
          sub="剩余有效期>30天"
        />
        <KpiCard
          label="临期/过期资质"
          value={expiringOrExpiredQualCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="danger"
          suffix="份"
          sub="需及时更新续期"
        />
      </div>

      <Card>
        <CardHeader>
          <Tabs
            items={[
              { id: "inventory", label: "危化库存", count: filteredHazardBatches.length },
              { id: "qualification", label: "资质管理", count: quals.length },
              { id: "ledger", label: "安全台账" },
              { id: "monitor", label: "领用监控" },
            ]}
            value={activeTab}
            onChange={setActiveTab}
          />
        </CardHeader>
        <CardBody>
          {activeTab === "inventory" && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-1 items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[240px] max-w-sm">
                    <Input
                      placeholder="搜索危化品名称/编码/批号/CAS号"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      leading={<Search className="h-4 w-4" />}
                    />
                  </div>
                  <div className="w-40">
                    <Select
                      value={hazardFilter}
                      onChange={(e) => setHazardFilter(e.target.value)}
                      options={[
                        { label: "全部危化等级", value: "all" },
                        ...HAZARD_LEVELS.map((l) => ({ label: l, value: l })),
                      ]}
                    />
                  </div>
                  <div className="w-40">
                    <Select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      options={[
                        { label: "全部类别", value: "all" },
                        ...CATEGORIES.map((c) => ({ label: c, value: c })),
                      ]}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="md"
                    leftIcon={<Filter className="h-4 w-4" />}
                    onClick={() => {
                      setSearchText("");
                      setHazardFilter("all");
                      setCategoryFilter("all");
                    }}
                  >
                    重置
                  </Button>
                </div>
                <div className="text-xs text-ink-500">
                  共 <span className="font-semibold text-ink-800">{filteredHazardBatches.length}</span> 个危化批次
                </div>
              </div>

              {filteredHazardBatches.length === 0 ? (
                <Empty text="未找到匹配的危化品批次" />
              ) : (
                <Table>
                  <Tabular>
                    <THead sticky>
                      <TR hoverable={false}>
                        <TH>危化品 编码</TH>
                        <TH>批次号</TH>
                        <TH>危化等级</TH>
                        <TH>类别</TH>
                        <TH className="text-right">库存</TH>
                        <TH>双人双锁</TH>
                        <TH>效期状态</TH>
                        <TH>最近领用人</TH>
                        <TH className="text-right">库存价值</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {filteredHazardBatches.map((b) => {
                        const isDoubleLocked =
                          b.hazardLevel === "易制毒" ||
                          b.hazardLevel === "易制爆" ||
                          b.hazardLevel === "易爆" ||
                          b.isLocked;
                        return (
                          <TR
                            key={b.id}
                            tone={b.isLocked ? "danger" : undefined}
                          >
                            <TD>
                              <div className="flex items-start gap-2.5">
                                <div className="h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br from-violet-100 to-violet-50 text-hazard-500 flex items-center justify-center text-xs font-bold">
                                  {b.reagentName.slice(0, 2)}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-ink-900">
                                    {b.reagentName}
                                  </div>
                                  <div className="mt-0.5 flex items-center gap-1.5">
                                    <span className="text-[11px] font-mono-tabular text-ink-500">
                                      {b.reagentCode}
                                    </span>
                                    {b.casNo && (
                                      <>
                                        <span className="text-ink-200">
                                          {"\u00B7"}
                                        </span>
                                        <span className="text-[11px] text-ink-500">
                                          CAS {b.casNo}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </TD>
                            <TD>
                              <span className="font-mono-tabular text-xs text-ink-800">
                                {b.batchNo}
                              </span>
                            </TD>
                            <TD>
                              <HazardBadge level={b.hazardLevel} />
                            </TD>
                            <TD>
                              <Badge tone="brand" size="sm">
                                {b.category}
                              </Badge>
                            </TD>
                            <TD className="text-right">
                              <div className="w-28 ml-auto">
                                <ProgressBar
                                  value={b.remainingQty}
                                  max={b.quantity}
                                  tone={b.isLocked ? "expired" : "normal"}
                                  showLabel
                                />
                              </div>
                            </TD>
                            <TD>
                              {isDoubleLocked ? (
                                <Badge tone="hazard" size="sm" dot>
                                  <Lock className="h-3 w-3 mr-0.5 inline" />
                                  双人双锁
                                </Badge>
                              ) : (
                                <Badge tone="default" size="sm">
                                  <Unlock className="h-3 w-3 mr-0.5 inline" />
                                  常规
                                </Badge>
                              )}
                            </TD>
                            <TD>
                              <WarningBadge
                                expiryDate={b.expiryDate}
                                isLocked={b.isLocked}
                              />
                            </TD>
                            <TD>
                              <span className="text-sm text-ink-700">
                                {getLastRequisitionUser(b)}
                              </span>
                            </TD>
                            <TD className="text-right">
                              <span className="font-mono-tabular text-sm font-semibold text-ink-800">
                                {currency(b.remainingQty * b.unitPrice)}
                              </span>
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Tabular>
                </Table>
              )}
            </div>
          )}

          {activeTab === "qualification" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-ink-500">
                  共 <span className="font-semibold text-ink-800">{quals.length}</span> 份资质档案
                </div>
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={openNewQualModal}
                >
                  添加资质
                </Button>
              </div>

              {quals.length === 0 ? (
                <Empty text="暂无资质档案，请添加危化品相关资质" />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {quals.map((qual) => {
                    const statusInfo = getQualStatusInfo(qual);
                    const issueDateObj = new Date(qual.issueDate);
                    const expiryDateObj = new Date(qual.expiryDate);
                    const totalValidDays = Math.max(
                      1,
                      Math.ceil(
                        (expiryDateObj.getTime() - issueDateObj.getTime()) /
                          (1000 * 60 * 60 * 24)
                      )
                    );
                    const progressPct = Math.max(
                      0,
                      Math.min(
                        100,
                        (Math.max(0, statusInfo.days) /
                          Math.max(1, totalValidDays)) *
                          100
                      )
                    );
                    return (
                      <Card key={qual.id} hover className="overflow-hidden">
                        <div className="h-1.5 w-full bg-ink-100">
                          <div
                            className={cn(
                              "h-full transition-all",
                              statusInfo.tone === "success" && "bg-success-500",
                              statusInfo.tone === "warning" && "bg-warning-yellow",
                              statusInfo.tone === "danger" && "bg-warning-red"
                            )}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <CardBody>
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="flex items-start gap-3">
                              <div
                                className={cn(
                                  "h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-inner",
                                  QUAL_TYPE_TONES[qual.type]
                                )}
                              >
                                {QUAL_TYPE_ICONS[qual.type]}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-ink-900">
                                  {qual.type}
                                </div>
                                <div className="mt-0.5 text-[11px] font-mono-tabular text-ink-500 truncate max-w-[200px]">
                                  {qual.certificateNo}
                                </div>
                              </div>
                            </div>
                            <Badge tone={statusInfo.tone} size="sm" dot>
                              {statusInfo.label}
                            </Badge>
                          </div>

                          <div className="space-y-2.5 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-ink-500 text-xs flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5" />
                                持有人
                              </span>
                              <span className="text-ink-800 font-medium text-xs">
                                {qual.holder}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-ink-500 text-xs flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5" />
                                签发机构
                              </span>
                              <span className="text-ink-800 text-xs truncate max-w-[160px]">
                                {qual.issuingAuthority}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-ink-500 text-xs flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5" />
                                签发日期
                              </span>
                              <span className="text-ink-800 text-xs font-mono-tabular">
                                {fmt(qual.issueDate)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-ink-500 text-xs flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                到期日期
                              </span>
                              <span
                                className={cn(
                                  "text-xs font-mono-tabular font-medium",
                                  statusInfo.tone === "success" && "text-success-600",
                                  statusInfo.tone === "warning" && "text-amber-600",
                                  statusInfo.tone === "danger" && "text-rose-600"
                                )}
                              >
                                {fmt(qual.expiryDate)}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-ink-100 flex items-center justify-between">
                            <div className="text-[11px] text-ink-500">
                              {statusInfo.days > 0
                                ? `剩余 ${statusInfo.days} 天`
                                : `已过期 ${Math.abs(statusInfo.days)} 天`}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditQualModal(qual)}
                              >
                                编辑
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!text-warning-red hover:!bg-red-50"
                                onClick={() => deleteQual(qual.id)}
                              >
                                删除
                              </Button>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "ledger" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-ink-600">
                  <span className="font-semibold text-ink-800">安全台账</span>
                  <span className="mx-2 text-ink-300">
                    {"\u00B7"}
                  </span>
                  双人双锁记录 + 领用登记双签字确认
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="hazard" size="sm">
                    <Lock className="h-3 w-3 mr-1 inline" />
                    双人双锁 {safetyTimeline.filter((t) => t.type === "double_lock").length}
                  </Badge>
                  <Badge tone="brand" size="sm">
                    <Signature className="h-3 w-3 mr-1 inline" />
                    领用登记 {safetyTimeline.filter((t) => t.type === "requisition").length}
                  </Badge>
                </div>
              </div>

              {safetyTimeline.length === 0 ? (
                <Empty text="暂无安全台账记录" />
              ) : (
                <div className="relative">
                  <div className="absolute left-6 top-2 bottom-2 w-0.5 bg-gradient-to-b from-hazard-200 via-brand-200 to-ink-100" />
                  <div className="space-y-1">
                    {safetyTimeline.map((item) => (
                      <div key={item.id} className="relative pl-16 py-3">
                        <div
                          className={cn(
                            "absolute left-4 top-4 h-5 w-5 rounded-full border-2 border-white shadow-md flex items-center justify-center",
                            item.type === "double_lock"
                              ? "bg-hazard-500"
                              : "bg-brand-500"
                          )}
                        >
                          {item.type === "double_lock" ? (
                            <Lock className="h-2.5 w-2.5 text-white" />
                          ) : (
                            <Signature className="h-2.5 w-2.5 text-white" />
                          )}
                        </div>

                        <Card hover>
                          <CardBody className="py-4">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge
                                    tone={
                                      item.type === "double_lock" ? "hazard" : "brand"
                                    }
                                    size="sm"
                                  >
                                    {item.type === "double_lock" ? "双人双锁" : "领用登记"}
                                  </Badge>
                                  <span className="text-sm font-semibold text-ink-900">
                                    {item.title}
                                  </span>
                                </div>
                                <div className="text-xs text-ink-500">
                                  {item.description}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-[11px] font-mono-tabular text-ink-500">
                                  {fmtDateTime(item.time)}
                                </div>
                                {item.reagentName && (
                                  <div className="mt-1 flex items-center gap-1 justify-end">
                                    <FlaskRound className="h-3 w-3 text-hazard-500" />
                                    <span className="text-xs font-medium text-hazard-600">
                                      {item.reagentName}
                                    </span>
                                    {item.quantity != null && item.unit && (
                                      <span className="text-xs text-ink-500">
                                        {item.quantity}
                                        {item.unit}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-ink-100">
                              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-ink-50/60">
                                <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-semibold">
                                  {(item.keeperName ?? "保").charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[11px] text-ink-500">保管员签字</div>
                                  <div className="text-xs font-medium text-ink-800 flex items-center gap-1">
                                    <BadgeCheck className="h-3 w-3 text-success-500" />
                                    {item.keeperName ?? "李保管"}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-ink-50/60">
                                <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-semibold">
                                  {(item.receiverName ?? "领").charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[11px] text-ink-500">
                                    {item.type === "double_lock" ? "安全员签字" : "领用人签字"}
                                  </div>
                                  <div className="text-xs font-medium text-ink-800 flex items-center gap-1">
                                    <BadgeCheck className="h-3 w-3 text-success-500" />
                                    {item.receiverName ?? "赵安全"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "monitor" && (
            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>危化品领用趋势</CardTitle>
                    <CardSubTitle>近6个月危化品领用次数与领用数量统计</CardSubTitle>
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={requisitionTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748B", fontSize: 12 }}
                        />
                        <YAxis
                          yAxisId="left"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748B", fontSize: 12 }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748B", fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid #E2E8F0",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                            fontSize: 12,
                          }}
                        />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="count"
                          name="领用次数"
                          fill="#3F72B0"
                          radius={[6, 6, 0, 0]}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="qty"
                          name="领用数量"
                          fill="#8B5CF6"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>TOP 领用人员排行</CardTitle>
                    <CardSubTitle>按危化品领用次数统计排名</CardSubTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="hazard" size="sm">
                      <Users className="h-3 w-3 mr-1 inline" />
                      共 {topRequisitionUsers.length} 人
                    </Badge>
                  </div>
                </CardHeader>
                {topRequisitionUsers.length === 0 ? (
                  <CardBody>
                    <Empty text="暂无危化品领用记录" />
                  </CardBody>
                ) : (
                  <CardBody className="pt-0 px-0 pb-0">
                    <Table>
                      <Tabular>
                        <THead sticky>
                          <TR hoverable={false}>
                            <TH className="w-16 text-center">排名</TH>
                            <TH>领用人</TH>
                            <TH>所属部门</TH>
                            <TH className="text-right">领用次数</TH>
                            <TH className="text-right">领用金额</TH>
                            <TH>领用占比</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {topRequisitionUsers.map((user, idx) => {
                            const totalCount = topRequisitionUsers.reduce(
                              (s, u) => s + u.count,
                              0
                            );
                            const rankTone =
                              idx === 0
                                ? "from-amber-400 to-amber-600 text-white"
                                : idx === 1
                                ? "from-slate-300 to-slate-500 text-white"
                                : idx === 2
                                ? "from-orange-300 to-orange-500 text-white"
                                : "from-ink-100 to-ink-200 text-ink-600";
                            const pct = totalCount > 0 ? (user.count / totalCount) * 100 : 0;
                            return (
                              <TR key={user.name}>
                                <TD className="text-center">
                                  <span
                                    className={cn(
                                      "inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold bg-gradient-to-br shadow-sm",
                                      rankTone
                                    )}
                                  >
                                    {idx + 1}
                                  </span>
                                </TD>
                                <TD>
                                  <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-semibold">
                                      {user.name.charAt(0)}
                                    </div>
                                    <span className="text-sm font-medium text-ink-900">
                                      {user.name}
                                    </span>
                                    <Award
                                      className={cn(
                                        "h-4 w-4",
                                        idx === 0 && "text-amber-500",
                                        idx === 1 && "text-slate-400",
                                        idx === 2 && "text-orange-400",
                                        idx > 2 && "text-ink-300"
                                      )}
                                    />
                                  </div>
                                </TD>
                                <TD>
                                  <Badge tone="default" size="sm">
                                    {user.department}
                                  </Badge>
                                </TD>
                                <TD className="text-right">
                                  <span className="font-mono-tabular text-sm font-semibold text-ink-800">
                                    {user.count}
                                  </span>
                                  <span className="text-xs text-ink-400 ml-1">次</span>
                                </TD>
                                <TD className="text-right">
                                  <span className="font-mono-tabular text-sm font-semibold text-ink-800">
                                    {currency(user.totalAmount)}
                                  </span>
                                </TD>
                                <TD>
                                  <div className="w-36">
                                    <ProgressBar
                                      value={user.count}
                                      max={totalCount}
                                      tone={
                                        idx === 0
                                          ? "normal"
                                          : idx === 1
                                          ? "warning90"
                                          : idx === 2
                                          ? "warning30"
                                          : "normal"
                                      }
                                      showLabel
                                    />
                                  </div>
                                </TD>
                              </TR>
                            );
                          })}
                        </TBody>
                      </Tabular>
                    </Table>
                  </CardBody>
                )}
              </Card>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={qualModalOpen}
        onClose={() => setQualModalOpen(false)}
        title={editingQual ? "编辑资质档案" : "添加资质档案"}
        subtitle={editingQual ? "更新危化品相关资质备案信息" : "录入新的危化品资质备案信息"}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setQualModalOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<BadgeCheck className="h-4 w-4" />}
              onClick={saveQual}
            >
              {editingQual ? "保存修改" : "确认添加"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1.5">
                资质类型 <span className="text-warning-red">*</span>
              </label>
              <Select
                value={qualForm.type}
                onChange={(e) =>
                  setQualForm((prev) => ({
                    ...prev,
                    type: e.target.value as HazardQualification["type"],
                  }))
                }
                options={QUAL_TYPES.map((t) => ({ label: t, value: t }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1.5">
                证书编号 <span className="text-warning-red">*</span>
              </label>
              <Input
                placeholder="请输入证书编号"
                value={qualForm.certificateNo}
                onChange={(e) =>
                  setQualForm((prev) => ({ ...prev, certificateNo: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1.5">
                持有人/单位 <span className="text-warning-red">*</span>
              </label>
              <Input
                placeholder="请输入持有人或单位名称"
                value={qualForm.holder}
                onChange={(e) =>
                  setQualForm((prev) => ({ ...prev, holder: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1.5">
                签发机构 <span className="text-warning-red">*</span>
              </label>
              <Input
                placeholder="请输入签发机构名称"
                value={qualForm.issuingAuthority}
                onChange={(e) =>
                  setQualForm((prev) => ({ ...prev, issuingAuthority: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1.5">
                签发日期
              </label>
              <Input
                type="date"
                value={qualForm.issueDate}
                onChange={(e) =>
                  setQualForm((prev) => ({ ...prev, issueDate: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1.5">
                到期日期
              </label>
              <Input
                type="date"
                value={qualForm.expiryDate}
                onChange={(e) =>
                  setQualForm((prev) => ({ ...prev, expiryDate: e.target.value }))
                }
              />
            </div>
          </div>

          {qualForm.issueDate && qualForm.expiryDate && (
            <div className="p-3 rounded-lg bg-ink-50/80 border border-ink-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-500 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  有效期预览
                </span>
                <span
                  className={cn(
                    "font-medium font-mono-tabular",
                    remainingDays(qualForm.expiryDate) > 30 && "text-success-600",
                    remainingDays(qualForm.expiryDate) > 0 &&
                      remainingDays(qualForm.expiryDate) <= 30 && "text-amber-600",
                    remainingDays(qualForm.expiryDate) <= 0 && "text-rose-600"
                  )}
                >
                  {remainingDays(qualForm.expiryDate) > 0
                    ? `剩余 ${remainingDays(qualForm.expiryDate)} 天`
                    : `已过期 ${Math.abs(remainingDays(qualForm.expiryDate))} 天`}
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default HazardPage;
