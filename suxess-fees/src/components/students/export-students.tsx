"use client";

import { ExportButton } from "@/components/ui/export-button";
import { downloadCsv, todayStamp } from "@/lib/export-csv";

export function ExportStudents({ students }: { students: any[] }) {
  const handleExport = () => {
    downloadCsv(
      `suxess-students-${todayStamp()}.csv`,
      [
        "Admission No",
        "Full Name",
        "Class",
        "Campus",
        "Parent Name",
        "Parent Phone",
        "Parent Email",
        "Exam Preparing For",
        "Status",
      ],
      students.map((s: any) => {
        const campuses = Array.isArray(s.campuses) ? s.campuses[0] : s.campuses;
        return [
          s.admission_number,
          s.full_name,
          s.class_name,
          campuses?.short_name || campuses?.name,
          s.parent_name,
          s.parent_phone,
          s.parent_email,
          s.exam_preparing_for,
          s.status,
        ];
      })
    );
  };

  return (
    <ExportButton
      onClick={handleExport}
      label="Export Excel"
      disabled={!students.length}
    />
  );
}
