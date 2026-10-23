"use client";

import { ExportButton } from "@/components/ui/export-button";
import { downloadCsv, todayStamp } from "@/lib/export-csv";

export function ExportReceipts({ payments }: { payments: any[] }) {
  const handleExport = () => {
    downloadCsv(
      `suxess-receipts-${todayStamp()}.csv`,
      [
        "Receipt No",
        "Student",
        "Admission No",
        "Class",
        "Amount",
        "Date",
        "Method",
        "Fee Type",
        "Session",
        "Term",
        "Status",
        "Notes",
      ],
      payments.map((p: any) => {
        const students = Array.isArray(p.students) ? p.students[0] : p.students;
        const studentFees = Array.isArray(p.student_fees)
          ? p.student_fees[0]
          : p.student_fees;
        const feeTypes = Array.isArray(studentFees?.fee_types)
          ? studentFees?.fee_types[0]
          : studentFees?.fee_types;
        return [
          p.receipt_number,
          students?.full_name,
          students?.admission_number,
          students?.class_name,
          p.amount,
          p.payment_date,
          p.payment_method,
          feeTypes?.name,
          studentFees?.session,
          studentFees?.term,
          p.deleted_at ? "Voided" : "Active",
          p.notes,
        ];
      })
    );
  };

  return (
    <ExportButton
      onClick={handleExport}
      label="Export Excel"
      disabled={!payments.length}
    />
  );
}
