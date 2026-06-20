import * as React from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Package,
  ClipboardCheck,
  CalendarClock,
  FileCheck2,
  AlertTriangle,
  Save,
  Home,
} from "lucide-react";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle, Tabs } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useBatchStore } from "@/store/useBatchStore";
import { useToast } from "@/components/ui/Toast";
import { HazardBadge, WarningBadge } from "@/components/reagent/ReagentBadges";
import { todayISO, currency, fmt, daysFromNow } from "@/utils/date";
import type { ReagentCategory, HazardLevel } from "@/types";

const TAB_STEPS = [
  { id: "arrival", label: "到货登记", icon: Package },
  { id: "qc", label: "QC验收", icon: ClipboardCheck },
  { id: "expiry", label: "批号效期", icon: CalendarClock },
  { id: "confirm", label: "确认提交", icon: FileCheck2 },
];

const categoryOptions = [
  { label: "请选择类别", value: "", disabled: true },
  { label: "普通试剂", value: "普通试剂" },
  { label: "有机试剂", value: "有机试剂" },
  { label: "无机试剂", value: "无机试剂" },
  { label: "生化试剂", value: "生化试剂" },
  { label: "标准品", value: "标准品" },
  { label: "危化品", value: "危化品" },
];

const hazardOptions = [
  { label: "请选择危化等级", value: "", disabled: true },
  { label: "无", value: "无" },
  { label: "易燃", value: "易燃" },
  { label: "易爆", value: "易爆" },
  { label: "有毒", value: "有毒" },
  { label: "腐蚀性", value: "腐蚀性" },
  { label: "易制毒", value: "易制毒" },
  { label: "易制爆", value: "易制爆" },
];

const unitOptions = [
  { label: "请选择单位", value: "", disabled: true },
  { label: "瓶", value: "瓶" },
  { label: "袋", value: "袋" },
  { label: "盒", value: "盒" },
  { label: "g", value: "g" },
  { label: "kg", value: "kg" },
  { label: "mL", value: "mL" },
  { label: "L", value: "L" },
  { label: "支", value: "支" },
  { label: "桶", value: "桶" },
];

const inspectionOptions = [
  { label: "验收合格", value: "true" },
  { label: "验收不合格", value: "false" },
];

interface ArrivalForm {
  reagentCode: string;
  reagentName: string;
  category: ReagentCategory | "";
  casNo: string;
  manufacturer: string;
  arrivalDate: string;
  quantity: number | "";
  unit: string;
  unitPrice: number | "";
}

interface QcForm {
  inspectionPassed: boolean;
  inspectionRemark: string;
}

interface ExpiryForm {
  batchNo: string;
  productionDate: string;
  expiryDate: string;
  hazardLevel: HazardLevel | "";
  hazardCodes: string;
  storageCondition: string;
}

const BatchNew: React.FC = () => {
  const navigate = useNavigate();
  const { addBatch } = useBatchStore();
  const toast = useToast();
  const [step, setStep] = React.useState("arrival");
  const [submitting, setSubmitting] = React.useState(false);

  const currentIdx = TAB_STEPS.findIndex((t) => t.id === step);

  const arrivalForm = useForm<ArrivalForm>({
    mode: "onChange",
    defaultValues: {
      reagentCode: "",
      reagentName: "",
      category: "",
      casNo: "",
      manufacturer: "",
      arrivalDate: todayISO(),
      quantity: "",
      unit: "",
      unitPrice: "",
    },
  });

  const qcForm = useForm<QcForm>({
    mode: "onChange",
    defaultValues: {
      inspectionPassed: true,
      inspectionRemark: "",
    },
  });

  const expiryForm = useForm<ExpiryForm>({
    mode: "onChange",
    defaultValues: {
      batchNo: "",
      productionDate: todayISO(),
      expiryDate: daysFromNow(365),
      hazardLevel: "",
      hazardCodes: "",
      storageCondition: "阴凉干燥处，密封保存",
    },
  });

  const goNext = async () => {
    let ok = false;
    if (step === "arrival") {
      ok = await arrivalForm.trigger();
    } else if (step === "qc") {
      ok = await qcForm.trigger();
    } else if (step === "expiry") {
      ok = await expiryForm.trigger();
    }
    if (ok && currentIdx < TAB_STEPS.length - 1) {
      setStep(TAB_STEPS[currentIdx + 1].id);
    }
  };

  const goPrev = () => {
    if (currentIdx > 0) {
      setStep(TAB_STEPS[currentIdx - 1].id);
    }
  };

  const handleSubmit = async () => {
    const valid =
      (await arrivalForm.trigger()) &&
      (await qcForm.trigger()) &&
      (await expiryForm.trigger());
    if (!valid) {
      toast.error("请检查表单", "部分必填项尚未填写");
      return;
    }
    setSubmitting(true);
    try {
      const a = arrivalForm.getValues();
      const q = qcForm.getValues();
      const e = expiryForm.getValues();
      addBatch({
        reagentCode: a.reagentCode.trim(),
        reagentName: a.reagentName.trim(),
        category: a.category as ReagentCategory,
        casNo: a.casNo.trim() || undefined,
        batchNo: e.batchNo.trim(),
        manufacturer: a.manufacturer.trim(),
        productionDate: e.productionDate,
        expiryDate: e.expiryDate,
        quantity: Number(a.quantity),
        unit: a.unit,
        unitPrice: Number(a.unitPrice),
        hazardLevel: e.hazardLevel as HazardLevel,
        hazardCodes: e.hazardCodes.trim()
          ? e.hazardCodes.split(/[,，\s]+/).filter(Boolean)
          : undefined,
        storageCondition: e.storageCondition.trim() || undefined,
        isLocked: false,
        inspectionPassed: q.inspectionPassed,
        inspectionRemark: q.inspectionRemark.trim() || undefined,
        arrivalDate: a.arrivalDate,
        operatorId: "user_default",
      });
      toast.success("入库成功", `${a.reagentName} 批次 ${e.batchNo} 已入库`);
      navigate("/batch");
    } catch (err: any) {
      toast.error("提交失败", err?.message || "请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const aValues = arrivalForm.watch();
  const qValues = qcForm.watch();
  const eValues = expiryForm.watch();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/batch">
            <Button variant="ghost" size="icon" leftIcon={<ArrowLeft className="h-4 w-4" />} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-ink-900">新增试剂入库</h1>
            <p className="text-xs text-ink-500 mt-0.5">
              到货登记 → QC验收 → 批号效期 → 确认提交
            </p>
          </div>
        </div>
        <Link to="/">
          <Button variant="ghost" size="sm" leftIcon={<Home className="h-4 w-4" />}>
            返回首页
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <Tabs
            items={TAB_STEPS.map((t, i) => ({
              id: t.id,
              label: (
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-bold ${
                      i <= currentIdx
                        ? "bg-brand-500 text-white"
                        : "bg-ink-200 text-ink-600"
                    }`}
                  >
                    {i < currentIdx ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </div>
              ),
            }))}
            value={step}
            onChange={setStep}
          />
        </CardHeader>
        <CardBody>
          {step === "arrival" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
              <Input
                label="试剂编码 *"
                placeholder="如：RG-2024-001"
                {...arrivalForm.register("reagentCode", {
                  required: "请输入试剂编码",
                  minLength: { value: 2, message: "至少2个字符" },
                })}
                error={arrivalForm.formState.errors.reagentCode?.message}
              />
              <Input
                label="试剂名称 *"
                placeholder="如：无水乙醇"
                {...arrivalForm.register("reagentName", {
                  required: "请输入试剂名称",
                  minLength: { value: 2, message: "至少2个字符" },
                })}
                error={arrivalForm.formState.errors.reagentName?.message}
              />
              <Select
                label="试剂类别 *"
                options={categoryOptions}
                {...arrivalForm.register("category", {
                  required: "请选择类别",
                } as any)}
                error={arrivalForm.formState.errors.category?.message}
              />
              <Input
                label="CAS号"
                placeholder="如：64-17-5"
                {...arrivalForm.register("casNo")}
              />
              <Input
                label="生产厂家 *"
                placeholder="如：国药集团化学试剂有限公司"
                {...arrivalForm.register("manufacturer", {
                  required: "请输入生产厂家",
                  minLength: { value: 2, message: "至少2个字符" },
                })}
                error={arrivalForm.formState.errors.manufacturer?.message}
              />
              <Input
                label="到货日期 *"
                type="date"
                {...arrivalForm.register("arrivalDate", {
                  required: "请选择到货日期",
                })}
                error={arrivalForm.formState.errors.arrivalDate?.message}
              />
              <Input
                label="入库数量 *"
                type="number"
                min={0}
                step="any"
                placeholder="如：100"
                {...arrivalForm.register("quantity", {
                  required: "请输入数量",
                  valueAsNumber: true,
                  min: { value: 0.0001, message: "数量必须大于0" },
                } as any)}
                error={arrivalForm.formState.errors.quantity?.message}
              />
              <Select
                label="计量单位 *"
                options={unitOptions}
                {...arrivalForm.register("unit", {
                  required: "请选择单位",
                } as any)}
                error={arrivalForm.formState.errors.unit?.message}
              />
              <Input
                label="单价 (¥) *"
                type="number"
                min={0}
                step="0.01"
                placeholder="如：120.00"
                {...arrivalForm.register("unitPrice", {
                  required: "请输入单价",
                  valueAsNumber: true,
                  min: { value: 0, message: "单价不能为负数" },
                } as any)}
                error={arrivalForm.formState.errors.unitPrice?.message}
              />
              <div className="self-end pb-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-ink-500">预估总金额：</span>
                  <span className="text-lg font-bold font-mono-tabular text-brand-600">
                    {currency(
                      Number(aValues.quantity || 0) * Number(aValues.unitPrice || 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {step === "qc" && (
            <div className="space-y-4 max-w-3xl">
              <div className="p-4 rounded-lg bg-brand-50/50 border border-brand-100 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" />
                <div className="text-xs text-brand-800 leading-5">
                  <p className="font-semibold mb-1">QC验收说明</p>
                  <p>
                    请根据实际质检结果填写。验收不合格的批次仍可入库，但后续将自动标记为不可出库状态，需管理员手动处理。
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="验收结果 *"
                  options={inspectionOptions}
                  value={qValues.inspectionPassed ? "true" : "false"}
                  onChange={(e) =>
                    qcForm.setValue("inspectionPassed", e.target.value === "true", {
                      shouldValidate: true,
                    })
                  }
                />
                <div className="flex items-end">
                  {qValues.inspectionPassed ? (
                    <Badge tone="success" size="md" dot>
                      <Check className="h-3 w-3 mr-0.5" />
                      验收合格，可正常入库
                    </Badge>
                  ) : (
                    <Badge tone="danger" size="md" dot>
                      <AlertTriangle className="h-3 w-3 mr-0.5" />
                      不合格，入库后将锁定
                    </Badge>
                  )}
                </div>
              </div>
              <Textarea
                label="验收备注"
                placeholder="请填写验收过程中的注意事项、检测结果说明等（选填）"
                {...qcForm.register("inspectionRemark", {
                  maxLength: { value: 500, message: "备注不能超过500字" },
                })}
                error={qcForm.formState.errors.inspectionRemark?.message}
              />
              <div className="p-4 rounded-lg bg-ink-50 border border-ink-100 space-y-2">
                <p className="text-xs font-semibold text-ink-700">关联到货信息</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-ink-500">试剂名：</span>
                    <span className="text-ink-800 font-medium">
                      {aValues.reagentName || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-500">编码：</span>
                    <span className="font-mono-tabular text-ink-800">
                      {aValues.reagentCode || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-500">厂家：</span>
                    <span className="text-ink-800 truncate">
                      {aValues.manufacturer || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-500">到货日期：</span>
                    <span className="font-mono-tabular text-ink-800">
                      {aValues.arrivalDate || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "expiry" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
              <Input
                label="批次号 *"
                placeholder="如：20240615-A01"
                {...expiryForm.register("batchNo", {
                  required: "请输入批次号",
                  minLength: { value: 3, message: "至少3个字符" },
                })}
                error={expiryForm.formState.errors.batchNo?.message}
              />
              <div />
              <Input
                label="生产日期 *"
                type="date"
                {...expiryForm.register("productionDate", {
                  required: "请选择生产日期",
                })}
                error={expiryForm.formState.errors.productionDate?.message}
              />
              <Input
                label="有效期至 *"
                type="date"
                {...expiryForm.register("expiryDate", {
                  required: "请选择有效期",
                  validate: (v) =>
                    v > eValues.productionDate || "有效期必须晚于生产日期",
                })}
                error={expiryForm.formState.errors.expiryDate?.message}
              />
              <Select
                label="危化等级 *"
                options={hazardOptions}
                {...expiryForm.register("hazardLevel", {
                  required: "请选择危化等级",
                } as any)}
                error={expiryForm.formState.errors.hazardLevel?.message}
              />
              <div className="flex items-end">
                {eValues.hazardLevel && (
                  <HazardBadge level={eValues.hazardLevel as HazardLevel} size="md" />
                )}
                {eValues.expiryDate && eValues.productionDate && eValues.expiryDate > eValues.productionDate && (
                  <div className="ml-3">
                    <WarningBadge expiryDate={eValues.expiryDate} size="md" />
                  </div>
                )}
              </div>
              <Input
                label="Hazard Codes (H编码)"
                placeholder="多个用逗号分隔，如：H225,H319"
                {...expiryForm.register("hazardCodes")}
              />
              <div className="md:col-span-2">
                <Textarea
                  label="存储条件"
                  placeholder="如：2-8℃冷藏、避光保存等"
                  {...expiryForm.register("storageCondition")}
                />
              </div>
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-5 max-w-5xl">
              <div className="p-4 rounded-lg bg-success-50 border border-success-200 flex items-start gap-3">
                <FileCheck2 className="h-5 w-5 text-success-600 shrink-0 mt-0.5" />
                <div className="text-xs text-success-800 leading-5">
                  <p className="font-semibold mb-1">请确认以下入库信息</p>
                  <p>
                    提交后数据将写入库存台账。如发现有误，请点击上方步骤标签返回修改。
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="!text-xs">
                      <Package className="h-3.5 w-3.5 inline mr-1 text-brand-500" />
                      到货登记
                    </CardTitle>
                  </CardHeader>
                  <CardBody className="!py-4 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-ink-500">试剂编码</span>
                      <span className="font-mono-tabular text-ink-800">
                        {aValues.reagentCode}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-500">试剂名称</span>
                      <span className="text-ink-800 font-medium">
                        {aValues.reagentName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-500">类别</span>
                      <Badge tone="brand" size="sm">{aValues.category}</Badge>
                    </div>
                    {aValues.casNo && (
                      <div className="flex justify-between">
                        <span className="text-ink-500">CAS号</span>
                        <span className="font-mono-tabular text-ink-800">
                          {aValues.casNo}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-ink-500">厂家</span>
                      <span className="text-ink-800 text-right max-w-[60%] truncate">
                        {aValues.manufacturer}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-500">到货日期</span>
                      <span className="font-mono-tabular text-ink-800">
                        {fmt(aValues.arrivalDate)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-ink-100 flex justify-between">
                      <span className="text-ink-500">数量/单位</span>
                      <span className="text-ink-800 font-medium">
                        {aValues.quantity} {aValues.unit}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-500">单价</span>
                      <span className="font-mono-tabular text-ink-800">
                        {currency(Number(aValues.unitPrice || 0))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-500">总金额</span>
                      <span className="font-mono-tabular font-bold text-brand-600">
                        {currency(
                          Number(aValues.quantity || 0) * Number(aValues.unitPrice || 0)
                        )}
                      </span>
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="!text-xs">
                      <ClipboardCheck className="h-3.5 w-3.5 inline mr-1 text-success-600" />
                      QC验收
                    </CardTitle>
                  </CardHeader>
                  <CardBody className="!py-4 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">验收结果</span>
                      {qValues.inspectionPassed ? (
                        <Badge tone="success" size="sm" dot>
                          验收合格
                        </Badge>
                      ) : (
                        <Badge tone="danger" size="sm" dot>
                          验收不合格
                        </Badge>
                      )}
                    </div>
                    {qValues.inspectionRemark ? (
                      <div className="pt-2 border-t border-ink-100">
                        <p className="text-ink-500 mb-1">验收备注</p>
                        <p className="text-ink-700 leading-5 whitespace-pre-wrap">
                          {qValues.inspectionRemark}
                        </p>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-ink-100">
                        <p className="text-ink-400 italic">无验收备注</p>
                      </div>
                    )}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="!text-xs">
                      <CalendarClock className="h-3.5 w-3.5 inline mr-1 text-warning-yellow" />
                      批号效期
                    </CardTitle>
                  </CardHeader>
                  <CardBody className="!py-4 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-ink-500">批次号</span>
                      <span className="font-mono-tabular text-ink-800">
                        {eValues.batchNo}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-500">生产日期</span>
                      <span className="font-mono-tabular text-ink-800">
                        {fmt(eValues.productionDate)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">有效期至</span>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-mono-tabular text-ink-800">
                          {fmt(eValues.expiryDate)}
                        </span>
                        <WarningBadge expiryDate={eValues.expiryDate} />
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">危化等级</span>
                      <HazardBadge level={eValues.hazardLevel as HazardLevel} />
                    </div>
                    {eValues.hazardCodes && (
                      <div className="pt-2 border-t border-ink-100 flex justify-between">
                        <span className="text-ink-500">H编码</span>
                        <span className="font-mono-tabular text-ink-800 text-right max-w-[60%]">
                          {eValues.hazardCodes}
                        </span>
                      </div>
                    )}
                    {eValues.storageCondition && (
                      <div className="pt-2 border-t border-ink-100">
                        <p className="text-ink-500 mb-1">存储条件</p>
                        <p className="text-ink-700 leading-5">
                          {eValues.storageCondition}
                        </p>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            </div>
          )}
        </CardBody>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-ink-100 bg-ink-50/60 rounded-b-lg2">
          <Button
            variant="ghost"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            onClick={goPrev}
            disabled={currentIdx === 0}
          >
            上一步
          </Button>
          {currentIdx < TAB_STEPS.length - 1 ? (
            <Button
              variant="primary"
              rightIcon={<ArrowRight className="h-4 w-4" />}
              onClick={goNext}
            >
              下一步
            </Button>
          ) : (
            <Button
              variant="success"
              leftIcon={<Save className="h-4 w-4" />}
              loading={submitting}
              onClick={handleSubmit}
            >
              确认入库
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default BatchNew;
