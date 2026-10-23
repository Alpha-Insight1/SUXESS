"use client";

import { ExportButton } from "@/components/ui/export-button";
import { downloadCsv, todayStamp } from "@/lib/export-csv";

export function ExportOutstanding({ fees }: { fees: any[] }) {
  const handleExport = () => {
    downloadCsv(
      `suxess-outstanding-${todayStamp()}.csv`,
      [
        "Student",
        "Admission No",
        "Class",
        "Campus",
        "Parent Name",
        "Parent Phone",
        "Fee Type",
        "Fee Amount",
        "Amount Paid",
        "Outstanding",
        "Session",
        "Term",
      ],
      fees.map((f: any) => {
        const students = Array.isArray(f.students) ? f.students[0] : f.students;
        const feeTypes = Array.isArray(f.fee_types) ? f.fee_types[0] : f.fee_types;
        const campuses = Array.isArray(students?.campuses)
          ? students?.campuses[0]
          : students?.campuses;
        return [
          students?.full_name,
          students?.admission_number,
          students?.class_name,
          campuses?.short_name,
          students?.parent_name,
          students?.parent_phone,
          feeTypes?.name,
          f.amount,
          f.amount_paid,
          f.balance,
          f.session,
          f.term,
        ];
      })
    );
  };

  return (
    <ExportButton
      onClick={handleExport}
      label="Export Excel"
      disabled={!fees.length}
    />
  );
}
