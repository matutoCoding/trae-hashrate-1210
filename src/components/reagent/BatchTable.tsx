import * as React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Eye, Lock, Unlock, Pencil } from "lucide-react";
import {
  Table, THead, TBody, TR, TH, TD, Tabular, Empty,
} from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { HazardBadge, WarningBadge, BatchRemainingBar } from "./ReagentBadges";
import { fmt, currency, withComma } from "@/utils/date";
import { Button } from "@/components/ui/Button";
import type { ReagentBatch } from "@/types";
import { getWarningLevel } from "@/utils/date";
import { cn } from "@/lib/utils";
import { useBatchStore } from "@/store/useBatchStore";
import { useToast } from "@/components/ui/Toast";

interface Props {
  batches: ReagentBatch[];
  showFifo?: boolean;
  actions?: (batch: ReagentBatch) => React.ReactNode;
}

export const BatchTable: React.FC<Props> = ({ batches, showFifo, actions }) => {
  const { lockBatch, unlockBatch } = useBatchStore();
  const toast = useToast();
  if (batches.length === 0) {
    return (
      <Table>
        <Tabular>
          <THead>
            <TR hoverable={false}>
              <TH>试剂信息</TH>
              <TH>批号</TH>
              <TH>类型</TH>
              <TH>危化</TH>
              <TH>厂家</TH>
              <TH>效期</TH>
              <TH>库存</TH>
              <TH>金额</TH>
              <TH>状态</TH>
              <TH>操作</TH>
            </TR>
          </THead>
        </Tabular>
        <Empty text="未找到匹配的试剂批次" />
      </Table>
    );
  }
  return (
    <Table>
      <Tabular>
        <THead sticky>
          <TR hoverable={false}>
            {showFifo && <TH className="w-10">FIFO</TH>}
            <TH>试剂信息</TH>
            <TH>批号</TH>
            <TH>类型</TH>
            <TH>危化</TH>
            <TH>生产厂家</TH>
            <TH>效期至</TH>
            <TH className="w-40">库存</TH>
            <TH>库存金额</TH>
            <TH>状态</TH>
            <TH className="text-right">操作</TH>
          </TR>
        </THead>
        <TBody>
          {batches.map((b, idx) => {
            const wl = getWarningLevel(b.expiryDate, b.isLocked);
            const rowTone =
              b.isLocked ? "danger" :
              wl.level === "warning7" ? "warn" :
              showFifo && idx === 0 ? "highlight" : undefined;
            return (
              <TR key={b.id} tone={rowTone}>
                {showFifo && (
                  <TD>
                    {idx === 0 ? (
                      <div className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-success-500 animate-pulse-dot shadow-[0_0_0_3px_rgba(42,157,143,0.15)]" />
                        <span className="text-[11px] font-semibold text-success-600">推荐</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-ink-400">#{idx + 1}</span>
                    )}
                  </TD>
                )}
                <TD>
                  <div className="flex items-start gap-2.5">
                    <div className={cn(
                      "h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold",
                      b.hazardLevel !== "无"
                        ? "bg-gradient-to-br from-violet-100 to-violet-50 text-hazard-500"
                        : "bg-gradient-to-br from-brand-50 to-brand-100/50 text-brand-600"
                    )}>
                      {b.reagentName.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <Link
                        to={`/batch/${b.id}`}
                        className="text-sm font-semibold text-ink-900 hover:text-brand-600 transition flex items-center gap-1"
                      >
                        {b.reagentName}
                        <ChevronRight className="h-3 w-3 opacity-0 -ml-1 group-hover:opacity-100 transition" />
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="text-[11px] font-mono-tabular text-ink-500">
                          {b.reagentCode}
                        </span>
                        {b.casNo && (
                          <>
                            <span className="text-ink-200">·</span>
                            <span className="text-[11px] text-ink-500">CAS {b.casNo}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </TD>
                <TD>
                  <span className="font-mono-tabular text-sm font-medium text-ink-800">
                    {b.batchNo}
                  </span>
                </TD>
                <TD>
                  <Badge tone="brand" size="sm">{b.category}</Badge>
                </TD>
                <TD>
                  <HazardBadge level={b.hazardLevel} />
                </TD>
                <TD className="text-xs text-ink-600 max-w-[180px] truncate">
                  {b.manufacturer}
                </TD>
                <TD>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono-tabular text-xs text-ink-800">
                      {fmt(b.expiryDate)}
                    </span>
                    <WarningBadge expiryDate={b.expiryDate} isLocked={b.isLocked} />
                  </div>
                </TD>
                <TD>
                  <div className="w-[180px]">
                    <div className="flex items-baseline justify-between text-xs mb-1">
                      <span className="font-mono-tabular font-semibold text-ink-900">
                        {withComma(b.remainingQty)}
                        <span className="text-ink-400 font-normal ml-0.5">{b.unit}</span>
                      </span>
                      <span className="text-ink-400">
                        {Math.round((b.remainingQty / b.quantity) * 100)}%
                      </span>
                    </div>
                    <BatchRemainingBar batch={b} />
                    <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-ink-400">冻结占用</span>
                        <span className="font-mono-tabular text-rose-600 font-semibold">
                          {withComma(b.frozenQty || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-400">可接申请</span>
                        <span className="font-mono-tabular text-emerald-600 font-semibold">
                          {withComma(Math.max(0, b.remainingQty - (b.frozenQty || 0)))}
                        </span>
                      </div>
                    </div>
                  </div>
                </TD>
                <TD>
                  <span className="font-mono-tabular text-sm font-semibold text-ink-800">
                    {currency(b.remainingQty * b.unitPrice)}
                  </span>
                </TD>
                <TD>
                  <div className="flex flex-col gap-1">
                    {b.isLocked ? (
                      <Badge tone="danger" size="sm" dot>
                        <Lock className="h-3 w-3 mr-0.5" />
                        {b.lockReason?.slice(0, 8) || "已锁定"}
                      </Badge>
                    ) : b.inspectionPassed ? (
                      <Badge tone="success" size="sm" dot>验收合格</Badge>
                    ) : (
                      <Badge tone="warning" size="sm" dot>待验收</Badge>
                    )}
                  </div>
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-1">
                    {actions ? (
                      actions(b)
                    ) : (
                      <>
                        <Link to={`/batch/${b.id}`}>
                          <Button variant="ghost" size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />}>
                            详情
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Pencil className="h-3.5 w-3.5" />}
                        >
                          编辑
                        </Button>
                        {b.isLocked ? (
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Unlock className="h-3.5 w-3.5" />}
                            onClick={() => {
                              unlockBatch(b.id);
                              toast.success("批次已解锁");
                            }}
                          >
                            解锁
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Lock className="h-3.5 w-3.5" />}
                            onClick={() => {
                              lockBatch(b.id, "人工锁定");
                              toast.success("批次已锁定");
                            }}
                          >
                            锁定
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Tabular>
    </Table>
  );
};
