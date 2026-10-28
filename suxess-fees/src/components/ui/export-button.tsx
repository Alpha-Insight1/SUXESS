"use client";

import { Download } from "lucide-react";

export function ExportButton({
  onClick,
  label = "Export Excel",
  disabled,
}: {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition disabled:opacity-50"
    >
      <Download className="w-4 h-4" />
      {label}
    </button>
  );
}
