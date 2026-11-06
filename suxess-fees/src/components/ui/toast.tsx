"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

type ToastItem = {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
};

const EVENT = "suxess-toast";

/** Show a professional in-app message (replaces browser alert). */
export function toast(
  message: string,
  options?: { kind?: ToastKind; title?: string }
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(EVENT, {
      detail: {
        message,
        kind: options?.kind || "info",
        title: options?.title,
      },
    })
  );
}

export function toastSuccess(message: string, title = "Success") {
  toast(message, { kind: "success", title });
}

export function toastError(message: string, title = "Something went wrong") {
  toast(message, { kind: "error", title });
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        message: string;
        kind: ToastKind;
        title?: string;
      };
      const id = Date.now() + Math.random();
      setItems((prev) => [
        ...prev.slice(-4),
        {
          id,
          kind: detail.kind || "info",
          title: detail.title,
          message: detail.message,
        },
      ]);
      window.setTimeout(() => remove(id), 4500);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, [remove]);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-[min(22rem,calc(100vw-2rem))]"
      aria-live="polite"
    >
      {items.map((t) => {
        const isSuccess = t.kind === "success";
        const isError = t.kind === "error";
        return (
          <div
            key={t.id}
            className={`rounded-xl border shadow-lg px-4 py-3 bg-white flex gap-3 items-start ${
              isSuccess
                ? "border-green-200"
                : isError
                  ? "border-red-200"
                  : "border-gray-200"
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isSuccess ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : isError ? (
                <AlertCircle className="w-5 h-5 text-red-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-gray-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {t.title && (
                <p
                  className={`text-sm font-semibold ${
                    isSuccess
                      ? "text-green-800"
                      : isError
                        ? "text-red-800"
                        : "text-gray-900"
                  }`}
                >
                  {t.title}
                </p>
              )}
              <p className="text-sm text-gray-600 whitespace-pre-line">
                {t.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="text-gray-400 hover:text-gray-600 p-0.5"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
