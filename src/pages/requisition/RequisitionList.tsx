import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Calendar,
  SlidersHorizontal,
  Eye,
  Trash2,
  Edit3,
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle, Tabs } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
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
import { PageHeader } from "@/components/layout/AppShell";
import { useRequisitionStore } from "@/store/useRequisitionStore";
import type { ApprovalStatus, Requisition } from "@/types";
import { fmtDateTime, currency, withComma } from "@/utils/date";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/store/useAuthStore";

const STATUS_TABS: Array<{
  id: string;
  label: string;
  status?: ApprovalStatus;
  tone: any;
}> = [
  { id: "all", label: "全部", tone: "ink" },
  { id: "draft", label: "草稿", status: "draft", tone: "default" },
  { id: "pending", label: "审批中", status: "pending", tone: "brand" },
  { id: "approved", label: "已通过", status: "approved", tone: "success" },
  { id: "rejected", label: "已驳回", status: "rejected", tone: "danger" },
  { id: "returned", label: "已退回", status: "returned", tone: "orange" },
  { id: "outbound_completed", label: "已出库", status: "outbound_completed", tone: "success" },
];

const statusBadgeMap: Record<ApprovalStatus, { tone: any; label: string; dot: boolean }> = {
  draft: { tone: "default", label: "草稿", dot: false },
  pending: { tone: "brand", label: "审批中", dot: true },
  approved: { tone: "success", label: "已通过", dot: true },
  rejected: { tone: "danger", label: "已驳回", dot: true },
  returned: { tone: "orange", label: "已退回", dot: true },
  outbound_completed: { tone: "success", label: "已出库", dot: false },
};

const PAGE_SIZE = 10;

const RequisitionList: React.FC = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { requisitions } = useRequisitionStore();
  const toast = useToast();

  const [activeTab, setActiveTab] = React.useState("all");
  const [keyword, setKeyword] = React.useState("");
  const [applicantFilter, setApplicantFilter] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState("");
  const [routeFilter, setRouteFilter] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [deleteModal, setDeleteModal] = React.useState<Requisition | null>(null);

  const counts = React.useMemo(() => {
    const map: Record<string, number> = { all: requisitions.length };
    for (const r of requisitions) {
      map[r.approvalStatus] = (map[r.approvalStatus] || 0) + 1;
    }
    return map;
  }, [requisitions]);

  const departments = React.useMemo(() => {
    const set = new Set(requisitions.map((r) => r.department));
    return Array.from(set);
  }, [requisitions]);

  const routeNames = React.useMemo(() => {
    const set = new Set(requisitions.map((r) => r.matchedRouteName).filter(Boolean));
    return Array.from(set) as string[];
  }, [requisitions]);

  const filtered = React.useMemo(() => {
    return requisitions.filter((r) => {
      if (activeTab !== "all" && r.approvalStatus !== activeTab) return false;
      if (keyword) {
        const kw = keyword.toLowerCase();
        if (!r.id.toLowerCase().includes(kw)) return false;
      }
      if (applicantFilter && r.applicantName !== applicantFilter) return false;
      if (deptFilter && r.department !== deptFilter) return false;
      if (routeFilter && r.matchedRouteName !== routeFilter) return false;
      if (dateFrom && r.createdAt < dateFrom) return false;
      if (dateTo && r.createdAt > dateTo + " 23:59:59") return false;
      return true;
    });
  }, [requisitions, activeTab, keyword, applicantFilter, deptFilter, routeFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageData = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  React.useEffect(() => {
    setPage(1);
  }, [activeTab, keyword, applicantFilter, deptFilter, routeFilter, dateFrom, dateTo]);

  const handleDelete = () => {
    if (!deleteModal) return;
    const list = requisitions.filter((r) => r.id !== deleteModal.id);
    useRequisitionStore.setState({ requisitions: list });
    localStorage.setItem("requisitions", JSON.stringify(list));
    toast.success("删除成功", `草稿 ${deleteModal.id} 已删除`);
    setDeleteModal(null);
  };

  const handleContinue = (r: Requisition) => {
    navigate(`/requisition/new?draft=${r.id}`);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<FileText className="h-5 w-5" />}
        title="领用申请记录"
        subtitle="查看和管理所有领用申请单的状态与流转"
        actions={
          <Link to="/requisition/new">
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
              新建申请
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <Tabs
            items={STATUS_TABS.map((t) => ({
              id: t.id,
              label: (
                <Badge tone={t.tone} size="sm" dot={t.id !== "all" && t.id !== "draft" && t.id !== "outbound_completed"}>
                  {t.label}
                </Badge>
              ),
              count: counts[t.id] || 0,
            }))}
            value={activeTab}
            onChange={setActiveTab}
          />
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-brand-500" />
            <CardTitle>筛选条件</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <Input
              placeholder="申请单号"
              leading={<Search className="h-4 w-4" />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Select
              value={applicantFilter}
              onChange={(e) => setApplicantFilter(e.target.value)}
              options={[
                { label: "全部申请人", value: "" },
                ...Array.from(new Set(requisitions.map((r) => r.applicantName))).map((n) => ({
                  label: n,
                  value: n,
                })),
              ]}
            />
            <Select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              options={[
                { label: "全部部门", value: "" },
                ...departments.map((d) => ({ label: d, value: d })),
              ]}
            />
            <Select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              options={[
                { label: "全部审批流", value: "" },
                ...routeNames.map((r) => ({ label: r, value: r })),
              ]}
            />
            <Input
              type="date"
              leading={<Calendar className="h-4 w-4" />}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="开始日期"
            />
            <Input
              type="date"
              leading={<Calendar className="h-4 w-4" />}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="结束日期"
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>申请列表</CardTitle>
            <span className="text-xs text-ink-400">共 {withComma(filtered.length)} 条</span>
          </div>
        </CardHeader>
        <CardBody className="!p-0">
          {filtered.length === 0 ? (
            <Table>
              <Tabular>
                <THead>
                  <TR hoverable={false}>
                    <TH>单号</TH>
                    <TH>申请人</TH>
                    <TH>部门</TH>
                    <TH>用途</TH>
                    <TH>明细</TH>
                    <TH>总金额</TH>
                    <TH>审批分支</TH>
                    <TH>状态</TH>
                    <TH>创建时间</TH>
                    <TH className="text-right">操作</TH>
                  </TR>
                </THead>
              </Tabular>
              <Empty text="暂无申请记录" icon={<FileText className="h-6 w-6" />} />
            </Table>
          ) : (
            <Table>
              <Tabular>
                <THead sticky>
                  <TR hoverable={false}>
                    <TH>单号</TH>
                    <TH>申请人</TH>
                    <TH>部门</TH>
                    <TH>用途</TH>
                    <TH>明细</TH>
                    <TH>总金额</TH>
                    <TH>审批分支</TH>
                    <TH>状态</TH>
                    <TH>创建时间</TH>
                    <TH className="text-right">操作</TH>
                  </TR>
                </THead>
                <TBody>
                  {pageData.map((r) => {
                    const badge = statusBadgeMap[r.approvalStatus];
                    return (
                      <TR key={r.id}>
                        <TD>
                          <span className="font-mono-tabular text-sm font-semibold text-brand-600">
                            {r.id}
                          </span>
                        </TD>
                        <TD>
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-[11px] font-semibold">
                              {r.applicantName[0]}
                            </div>
                            <span className="text-sm text-ink-800">{r.applicantName}</span>
                          </div>
                        </TD>
                        <TD>
                          <span className="text-xs text-ink-600">{r.department}</span>
                        </TD>
                        <TD>
                          <span className="text-xs text-ink-700 max-w-[200px] truncate block" title={r.purpose}>
                            {r.purpose}
                          </span>
                        </TD>
                        <TD>
                          <Badge tone="brand" size="sm">
                            {r.items.length} 项
                          </Badge>
                        </TD>
                        <TD>
                          <span className="font-mono-tabular text-sm font-semibold text-ink-800">
                            {currency(r.totalAmount)}
                          </span>
                        </TD>
                        <TD>
                          <span className="text-xs text-ink-600 max-w-[180px] truncate block" title={r.matchedRouteName}>
                            {r.matchedRouteName || "-"}
                          </span>
                        </TD>
                        <TD>
                          <Badge tone={badge.tone} size="sm" dot={badge.dot}>
                            {badge.label}
                          </Badge>
                        </TD>
                        <TD>
                          <span className="text-xs font-mono-tabular text-ink-600">
                            {fmtDateTime(r.createdAt)}
                          </span>
                        </TD>
                        <TD>
                          <div className="flex items-center justify-end gap-1">
                            <Link to={`/requisition/${r.id}`}>
                              <Button variant="ghost" size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />}>
                                查看
                              </Button>
                            </Link>
                            {r.approvalStatus === "draft" && r.applicantId === user?.id && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  leftIcon={<Edit3 className="h-3.5 w-3.5" />}
                                  onClick={() => handleContinue(r)}
                                >
                                  继续
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  leftIcon={<Trash2 className="h-3.5 w-3.5 text-warning-red" />}
                                  onClick={() => setDeleteModal(r)}
                                >
                                  删除
                                </Button>
                              </>
                            )}
                            {r.approvalStatus === "returned" && r.applicantId === user?.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                leftIcon={<Edit3 className="h-3.5 w-3.5" />}
                                onClick={() => handleContinue(r)}
                              >
                                修改重提
                              </Button>
                            )}
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Tabular>
            </Table>
          )}
        </CardBody>
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-ink-100">
            <div className="text-xs text-ink-500">
              第 {currentPage} / {totalPages} 页，共 {withComma(filtered.length)} 条
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
                disabled={currentPage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <div className="flex items-center gap-1 px-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pNum: number;
                  if (totalPages <= 5) {
                    pNum = i + 1;
                  } else if (currentPage <= 3) {
                    pNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pNum = totalPages - 4 + i;
                  } else {
                    pNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={cn(
                        "h-8 w-8 rounded-md text-xs font-medium transition",
                        pNum === currentPage
                          ? "bg-brand-500 text-white shadow-sm"
                          : "text-ink-600 hover:bg-ink-100"
                      )}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
                disabled={currentPage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="删除草稿"
        subtitle="此操作不可撤销"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteModal(null)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              确认删除
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-rose-50 flex items-center justify-center text-warning-red">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="text-sm text-ink-700 leading-5">
            <p className="font-medium text-ink-900 mb-1">
              确定要删除草稿 {deleteModal?.id} 吗？
            </p>
            <p className="text-ink-500">删除后该申请记录将无法恢复，请确认操作。</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RequisitionList;
