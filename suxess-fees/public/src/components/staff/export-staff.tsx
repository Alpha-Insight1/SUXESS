"use client";

import { ExportButton } from "@/components/ui/export-button";
import { downloadCsv, todayStamp } from "@/lib/export-csv";

export function ExportStaff({ staff }: { staff: any[] }) {
  const handleExport = () => {
    downloadCsv(
      `suxess-staff-${todayStamp()}.csv`,
      ["Name", "Campus", "Role", "Phone", "Monthly Salary", "Status", "Start Date"],
      staff.map((s: any) => {
        const campuses = Array.isArray(s.campuses) ? s.campuses[0] : s.campuses;
        return [
          s.full_name,
          campuses?.short_name || campuses?.name,
          s.role,
          s.phone,
          s.salary,
          s.status,
          s.start_date,
        ];
      })
    );
  };

  return (
    <ExportButton
      onClick={handleExport}
      label="Export Excel"
      disabled={!staff.length}
    />
  );
}
