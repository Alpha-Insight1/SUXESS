"use client";

import { ExportButton } from "@/components/ui/export-button";
import { downloadCsv, todayStamp } from "@/lib/export-csv";

export function ExportExpenses({ expenses }: { expenses: any[] }) {
  const handleExport = () => {
    downloadCsv(
      `suxess-expenses-${todayStamp()}.csv`,
      ["Date", "Campus", "Category", "Description", "Amount", "Method", "Notes"],
      expenses.map((e: any) => {
        const campuses = Array.isArray(e.campuses) ? e.campuses[0] : e.campuses;
        return [
          e.expense_date,
          campuses?.short_name || campuses?.name,
          e.category,
          e.description,
          e.amount,
          e.payment_method,
          e.notes,
        ];
      })
    );
  };

  return (
    <ExportButton
      onClick={handleExport}
      label="Export Excel"
      disabled={!expenses.length}
    />
  );
}
