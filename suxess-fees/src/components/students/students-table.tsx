"use client";

import Link from "next/link";

type StudentRow = {
  id: string;
  admission_number: string;
  full_name: string;
  class_name: string;
  parent_phone?: string | null;
  exam_preparing_for?: string | null;
  status?: string;
  campuses?:
    | { short_name?: string | null; name?: string | null }
    | { short_name?: string | null; name?: string | null }[]
    | null;
};

function getCampusLabel(campuses: StudentRow["campuses"]) {
  if (!campuses) return "—";
  if (Array.isArray(campuses)) {
    return campuses[0]?.short_name || campuses[0]?.name || "—";
  }
  return campuses.short_name || campuses.name || "—";
}

export function StudentsTable({ students }: { students: StudentRow[] }) {
  if (students.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
        No students found. Add your first student to get started.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-6 py-3 font-medium">Adm. No</th>
              <th className="text-left px-6 py-3 font-medium">Name</th>
              <th className="text-left px-6 py-3 font-medium">Class</th>
              <th className="text-left px-6 py-3 font-medium">Campus</th>
              <th className="text-left px-6 py-3 font-medium">Parent Phone</th>
              <th className="text-left px-6 py-3 font-medium">Exam</th>
              <th className="text-left px-6 py-3 font-medium">Status</th>
              <th className="text-left px-6 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 font-medium">{s.admission_number}</td>
                <td className="px-6 py-3">{s.full_name}</td>
                <td className="px-6 py-3">{s.class_name}</td>
                <td className="px-6 py-3">{getCampusLabel(s.campuses)}</td>
                <td className="px-6 py-3">{s.parent_phone || "—"}</td>
                <td className="px-6 py-3">{s.exam_preparing_for || "—"}</td>
                <td className="px-6 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {s.status || "active"}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <Link
                    href={`/payments?student=${s.id}`}
                    className="text-brand-green hover:underline font-medium"
                  >
                    Pay
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
