"use client";

/**
 * Professional confirm / alert modal (replaces browser alert & confirm).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading,
  onConfirm,
  onCancel,
  hideCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger" | "success";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  hideCancel?: boolean;
}) {
  if (!open) return null;

  const confirmClass =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : variant === "success"
        ? "bg-brand-green hover:bg-brand-dark text-white"
        : "bg-gray-900 hover:bg-gray-800 text-white";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 pt-5 pb-2">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="mt-2 text-sm text-gray-600 whitespace-pre-line leading-relaxed">
            {message}
          </p>
        </div>
        <div className="px-5 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 bg-gray-50 border-t">
          {!hideCancel && (
            <button
              type="button"
              disabled={loading}
              onClick={onCancel}
              className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 ${confirmClass}`}
          >
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Simple one-button message dialog */
export function MessageDialog({
  open,
  title,
  message,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title={title}
      message={message}
      confirmLabel="OK"
      hideCancel
      onConfirm={onClose}
      onCancel={onClose}
    />
  );
}
