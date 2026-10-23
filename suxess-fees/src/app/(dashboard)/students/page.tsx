import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { StudentsTable } from "@/components/students/students-table";
import { AddStudentButton } from "@/components/students/add-student-button";
import { StudentSearch } from "@/components/students/student-search";
import { ExportStudents } from "@/components/students/export-students";
import { getCurrentProfile, campusFilter, isAdmin } from "@/lib/auth";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const lockedCampus = campusFilter(profile);
  const admin = isAdmin(profile);

  const activeCampus = lockedCampus || params.campus || undefined;

  // Only columns the table needs (faster than select *)
  let query = supabase
    .from("students")
    .select(
      "id, admission_number, full_name, class_name, parent_name, parent_phone, parent_email, exam_preparing_for, status, campus_id, campuses(name, short_name)"
    )
    .order("full_name")
    .limit(500);

  if (activeCampus) {
    query = query.eq("campus_id", activeCampus);
  }
  if (params.q) {
    const q = params.q.trim().replace(/%/g, "");
    if (q) {
      query = query.or(
        `full_name.ilike.%${q}%,admission_number.ilike.%${q}%,parent_phone.ilike.%${q}%,parent_name.ilike.%${q}%`
      );
    }
  }

  let campusesQuery = supabase
    .from("campuses")
    .select("id, name, short_name")
    .eq("is_active", true);
  if (lockedCampus) campusesQuery = campusesQuery.eq("id", lockedCampus);

  const [{ data: students }, { data: campuses }] = await Promise.all([
    query,
    campusesQuery,
  ]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-500 mt-1">
            {admin
              ? "Manage students across all campuses"
              : `Students at ${profile?.campuses?.short_name || "your campus"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportStudents students={students || []} />
          <AddStudentButton campuses={campuses || []} />
        </div>
      </div>

      <StudentSearch
        initialQuery={params.q || ""}
        campusId={admin ? params.campus : lockedCampus || undefined}
      />

      {admin && (
        <div className="flex flex-wrap gap-3 mb-6">
          <Link
            href={
              params.q
                ? `/students?q=${encodeURIComponent(params.q)}`
                : "/students"
            }
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
              !params.campus
                ? "bg-brand-green text-white border-brand-green"
                : "bg-white text-gray-700 border-gray-300 hover:border-brand-green"
            }`}
          >
            All Campuses
          </Link>
          {campuses?.map((c: any) => (
            <Link
              key={c.id}
              href={
                params.q
                  ? `/students?campus=${c.id}&q=${encodeURIComponent(params.q)}`
                  : `/students?campus=${c.id}`
              }
              className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                params.campus === c.id
                  ? "bg-brand-green text-white border-brand-green"
                  : "bg-white text-gray-700 border-gray-300 hover:border-brand-green"
              }`}
            >
              {c.short_name || c.name}
            </Link>
          ))}
        </div>
      )}

      {params.q && (
        <p className="text-sm text-gray-500 mb-3">
          Search results for “{params.q}” — {students?.length || 0} found
        </p>
      )}

      <StudentsTable students={students || []} />
    </div>
  );
}
