import * as React from "react";
import { Check, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
}

interface Ctx {
  show: (t: Omit<ToastItem, "id" | "duration"> & { duration?: number }) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
}

const ToastCtx = React.createContext<Ctx | null>(null);

const iconMap = {
  success: <Check className="h-4 w-4" />,
  error: <X className="h-4 w-4" />,
  warning: <AlertCircle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
};
const toneMap = {
  success: "bg-emerald-50 border-emerald-200 text-emerald-800 [&>svg]:text-success-500",
  error: "bg-rose-50 border-rose-200 text-rose-800 [&>svg]:text-warning-red",
  warning: "bg-amber-50 border-amber-200 text-amber-800 [&>svg]:text-warning-yellow",
  info: "bg-brand-50 border-brand-100 text-brand-800 [&>svg]:text-brand-500",
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const dismiss = (id: string) =>
    setItems((arr) => arr.filter((x) => x.id !== id));

  const show: Ctx["show"] = (t) => {
    const id = Math.random().toString(36).slice(2, 9);
    const item: ToastItem = { id, duration: 3000, ...t };
    setItems((arr) => [...arr, item]);
    setTimeout(() => dismiss(id), item.duration);
  };

  const ctx: Ctx = {
    show,
    success: (title, message) => show({ type: "success", title, message }),
    error: (title, message) => show({ type: "error", title, message }),
  };

  return (
    <ToastCtx.Provider value={ctx}>
      {children}
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 w-[360px] pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto border rounded-lg shadow-lg px-4 py-3 flex gap-3 items-start animate-fade-in-up",
              toneMap[t.type]
            )}
          >
            <div className="mt-0.5 shrink-0">{iconMap[t.type]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-5">{t.title}</p>
              {t.message && (
                <p className="mt-0.5 text-xs opacity-80 leading-5">{t.message}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="!h-6 !w-6 -mr-1 -mt-0.5 text-current/70"
              onClick={() => dismiss(t.id)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};

export const useToast = () => {
  const ctx = React.useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
};
