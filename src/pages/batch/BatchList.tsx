import * as React from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Plus,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { BatchTable } from "@/components/reagent/BatchTable";
import { useBatchStore } from "@/store/useBatchStore";
import { useToast } from "@/components/ui/Toast";
import { getWarningLevel, withComma } from "@/utils/date";
import type { ReagentCategory, HazardLevel, ReagentBatch } from "@/types";

const categoryOptions = [
  { label: "全部类别", value: "" },
  { label: "普通试剂", value: "普通试剂" },
  { label: "有机试剂", value: "有机试剂" },
  { label: "无机试剂", value: "无机试剂" },
  { label: "生化试剂", value: "生化试剂" },
  { label: "标准品", value: "标准品" },
  { label: "危化品", value: "危化品" },
];

const hazardOptions = [
  { label: "全部危化等级", value: "" },
  { label: "无", value: "无" },
  { label: "易燃", value: "易燃" },
  { label: "易爆", value: "易爆" },
  { label: "有毒", value: "有毒" },
  { label: "腐蚀性", value: "腐蚀性" },
  { label: "易制毒", value: "易制毒" },
  { label: "易制爆", value: "易制爆" },
];

const expiryOptions = [
  { label: "全部效期", value: "" },
  { label: "正常", value: "normal" },
  { label: "90天内", value: "warning90" },
  { label: "30天内", value: "warning30" },
  { label: "7天内", value: "warning7" },
  { label: "已过期", value: "expired" },
];

const inspectionOptions = [
  { label: "全部验收状态", value: "" },
  { label: "验收合格", value: "passed" },
  { label: "待验收", value: "pending" },
  { label: "已锁定", value: "locked" },
];

const PAGE_SIZE = 10;

const BatchList: React.FC = () => {
  const { batches, scanAndLockExpired, init } = useBatchStore();
  const toast = useToast();

  const [keyword, setKeyword] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [hazard, setHazard] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const [inspection, setInspection] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [refreshing, setRefreshing] = React.useState(false);

  const filtered = React.useMemo(() => {
    return batches.filter((b) => {
      if (keyword) {
        const kw = keyword.toLowerCase();
        const match =
          b.reagentName.toLowerCase().includes(kw) ||
          b.reagentCode.toLowerCase().includes(kw) ||
          b.batchNo.toLowerCase().includes(kw) ||
          (b.casNo || "").toLowerCase().includes(kw) ||
          b.manufacturer.toLowerCase().includes(kw);
        if (!match) return false;
      }
      if (category && b.category !== (category as ReagentCategory)) return false;
      if (hazard && b.hazardLevel !== (hazard as HazardLevel)) return false;
      if (expiry) {
        const wl = getWarningLevel(b.expiryDate, b.isLocked);
        if (wl.level !== expiry) return false;
      }
      if (inspection) {
        if (inspection === "passed" && !(b.inspectionPassed && !b.isLocked)) return false;
        if (inspection === "pending" && !(!b.inspectionPassed && !b.isLocked)) return false;
        if (inspection === "locked" && !b.isLocked) return false;
      }
      return true;
    });
  }, [batches, keyword, category, hazard, expiry, inspection]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageData = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  React.useEffect(() => {
    setPage(1);
  }, [keyword, category, hazard, expiry, inspection]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 500));
    init();
    const locked = scanAndLockExpired();
    if (locked > 0) {
      toast.success("刷新完成", `自动锁定 ${locked} 个过期批次`);
    } else {
      toast.success("刷新完成");
    }
    setRefreshing(false);
  };

  const handleExport = () => {
    const header = [
      "试剂编码",
      "试剂名称",
      "CAS号",
      "类别",
      "危化等级",
      "批号",
      "生产厂家",
      "生产日期",
      "有效期至",
      "到货日期",
      "入库数量",
      "剩余数量",
      "单位",
      "单价",
      "库存金额",
      "验收状态",
    ];
    const rows = filtered.map((b: ReagentBatch) => [
      b.reagentCode,
      b.reagentName,
      b.casNo || "",
      b.category,
      b.hazardLevel,
      b.batchNo,
      b.manufacturer,
      b.productionDate,
      b.expiryDate,
      b.arrivalDate,
      b.quantity,
      b.remainingQty,
      b.unit,
      b.unitPrice,
      (b.remainingQty * b.unitPrice).toFixed(2),
      b.isLocked ? "已锁定" : b.inspectionPassed ? "验收合格" : "待验收",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `试剂批次_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("导出成功", `共导出 ${filtered.length} 条记录`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-brand-500" />
            <CardTitle>筛选条件</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            <Input
              placeholder="搜索试剂名/编码/CAS/批号/厂家"
              leading={<Search className="h-4 w-4" />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={categoryOptions}
            />
            <Select
              value={hazard}
              onChange={(e) => setHazard(e.target.value)}
              options={hazardOptions}
            />
            <Select
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              options={expiryOptions}
            />
            <Select
              value={inspection}
              onChange={(e) => setInspection(e.target.value)}
              options={inspectionOptions}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>试剂批次列表</CardTitle>
            <span className="text-xs text-ink-400">
              共 {withComma(filtered.length)} 条
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/batch/new">
              <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
                新增入库
              </Button>
            </Link>
            <Button
              variant="outline"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={handleExport}
              disabled={filtered.length === 0}
            >
              导出
            </Button>
            <Button
              variant="outline"
              leftIcon={<RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />}
              onClick={handleRefresh}
            >
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardBody className="!p-0">
          <BatchTable batches={pageData} />
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
                      className={`h-8 w-8 rounded-md text-xs font-medium transition ${
                        pNum === currentPage
                          ? "bg-brand-500 text-white shadow-sm"
                          : "text-ink-600 hover:bg-ink-100"
                      }`}
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
    </div>
  );
};

export default BatchList;
