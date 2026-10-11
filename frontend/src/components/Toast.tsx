import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info } from "lucide-react";

export type ToastKind = "success" | "error" | "info";

export interface ToastState {
  id: number;
  kind: ToastKind;
  message: string;
}

export function ToastStack({ toasts, dismiss }: { toasts: ToastState[]; dismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-80 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto flex cursor-pointer items-start gap-2.5 rounded-xl border bg-white p-3 text-sm shadow-lg ${
              t.kind === "success"
                ? "border-emerald-200"
                : t.kind === "error"
                  ? "border-red-200"
                  : "border-slate-200"
            }`}
          >
            {t.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : t.kind === "error" ? (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            )}
            <span className="text-slate-700">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}