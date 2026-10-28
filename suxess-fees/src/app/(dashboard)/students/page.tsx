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
  searchParams: Promise<{
    campus?: string;
    q?: string;
    status?: string;
    class?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const lockedCampus = campusFilter(profile);
  const admin = isAdmin(profile);

  const activeCampus = lockedCampus || params.campus || undefined;
  const statusFilter = params.status || "active";
  const classFilter = params.class?.trim() || "";

  let query = supabase
    .from("students")
    .select(
      "id, admission_number, full_name, class_name, parent_name, parent_phone, parent_email, exam_preparing_for, address, department, status, campus_id, created_at, campuses(name, short_name)"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (activeCampus) query = query.eq("campus_id", activeCampus);
  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }
  if (classFilter) query = query.ilike("class_name", classFilter);
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

  let classesQuery = supabase
    .from("students")
    .select("class_name")
    .not("class_name", "is", null)
    .limit(1000);
  if (activeCampus) classesQuery = classesQuery.eq("campus_id", activeCampus);

  const [{ data: students }, { data: campuses }, { data: classRows }] =
    await Promise.all([query, campusesQuery, classesQuery]);

  const classSet = new Set<string>();
  for (const r of classRows || []) {
    const c = String(r.class_name || "").trim();
    if (c && c !== "—") classSet.add(c);
  }
  const classList = Array.from(classSet).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  function buildHref(opts: {
    status?: string;
    className?: string | null;
    clearClass?: boolean;
  }) {
    const p = new URLSearchParams();
    const st = opts.status ?? statusFilter;
    if (st && st !== "active") p.set("status", st);
    const cl = opts.clearClass
      ? ""
      : opts.className !== undefined
        ? opts.className || ""
        : classFilter;
    if (cl) p.set("class", cl);
    if (admin && params.campus) p.set("campus", params.campus);
    if (params.q) p.set("q", params.q);
    const qs = p.toString();
    return qs ? `/students?${qs}` : "/students";
  }

  const statusTabs = [
    { id: "active", label: "Active" },
    { id: "graduated", label: "Graduated" },
    { id: "withdrawn", label: "Withdrawn" },
    { id: "inactive", label: "Inactive" },
    { id: "all", label: "All" },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-500 mt-1">
            {admin
              ? "Manage students across all campuses"
              : `Students at ${profile?.campuses?.short_name || "your campus"}`}
            <span className="text-gray-400"> · active by default</span>
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
        status={statusFilter}
        className={classFilter}
      />

      <div className="flex flex-wrap gap-2 mb-3">
        {statusTabs.map((tab) => (
          <Link
            key={tab.id}
            href={buildHref({ status: tab.id })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              statusFilter === tab.id
                ? "bg-brand-green text-white border-brand-green"
                : "bg-white text-gray-700 border-gray-300 hover:border-brand-green"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {classList.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Link
            href={buildHref({ clearClass: true })}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              !classFilter
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-300"
            }`}
          >
            All classes
          </Link>
          {classList.map((c) => (
            <Link
              key={c}
              href={buildHref({ className: c })}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                classFilter.toLowerCase() === c.toLowerCase()
                  ? "bg-brand-green text-white border-brand-green"
                  : "bg-white text-gray-600 border-gray-300 hover:border-brand-green"
              }`}
            >
              {c}
            </Link>
          ))}
        </div>
      )}

      {admin && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Link
            href={buildHref({})}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
              !params.campus
                ? "bg-brand-green text-white border-brand-green"
                : "bg-white text-gray-700 border-gray-300"
            }`}
          >
            All campuses
          </Link>
          {(campuses || []).map((c: any) => {
            const p = new URLSearchParams();
            p.set("campus", c.id);
            if (statusFilter !== "active") p.set("status", statusFilter);
            if (classFilter) p.set("class", classFilter);
            if (params.q) p.set("q", params.q);
            return (
              <Link
                key={c.id}
                href={`/students?${p.toString()}`}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                  params.campus === c.id
                    ? "bg-brand-green text-white border-brand-green"
                    : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                {c.short_name || c.name}
              </Link>
            );
          })}
        </div>
      )}

      <p className="text-sm text-gray-500 mb-3">
        Showing {students?.length || 0} student
        {(students?.length || 0) === 1 ? "" : "s"}
        {statusFilter !== "all" ? ` · ${statusFilter}` : ""}
        {classFilter ? ` · ${classFilter}` : ""}
        {params.q ? ` · “${params.q}”` : ""}
      </p>

      <StudentsTable students={students || []} />
    </div>
  );
}
