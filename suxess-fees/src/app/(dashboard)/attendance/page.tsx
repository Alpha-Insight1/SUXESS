import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, campusFilter, isAdmin } from "@/lib/auth";
import { AttendanceForm } from "@/components/attendance/attendance-form";
import { redirect } from "next/navigation";
import Link from "next/link";
import { fetchActiveCardStudents, lagosToday } from "@/lib/active-students";

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isTutorialLabel(short?: string | null, name?: string | null) {
  const L = `${short || ""} ${name || ""}`.toLowerCase();
  return (
    L.includes("arepo") ||
    L.includes("ofada") ||
    L.includes("mowe") ||
    L.includes("tutorial")
  );
}

function isMainLabel(short?: string | null, name?: string | null) {
  if (isTutorialLabel(short, name)) return false;
  const L = `${short || ""} ${name || ""}`.toLowerCase();
  return L.includes("main") || L.includes("school") || L.includes("suxess");
}

export default async function AttendancePage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const admin = isAdmin(profile);
  const campusId = campusFilter(profile);
  const today = isoToday();

  if (!admin && !profile.campus_id) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900">Daily attendance</h1>
        <p className="text-gray-500 mt-2">
          Your account is not linked to a campus. Ask the director to assign a
          campus to your profile.
        </p>
      </div>
    );
  }

  const targetCampusId = profile.campus_id || (campusId && campusId !== "00000000-0000-0000-0000-000000000000" ? campusId : null);

  let campusName =
    profile.campuses?.short_name || profile.campuses?.name || "Your campus";
  let campusShort = profile.campuses?.short_name || null;
  let campusFullName = profile.campuses?.name || null;
  let totalEnrolled = 0;
  let existing: {
    present_count: number;
    notes: string | null;
    class_breakdown: Record<string, number> | null;
  } | null = null;
  let classRows: { class_name: string; enrolled: number }[] = [];

  if (targetCampusId) {
    const { data: camp } = await supabase
      .from("campuses")
      .select("id, name, short_name")
      .eq("id", targetCampusId)
      .maybeSingle();
    if (camp) {
      campusName = camp.short_name || camp.name;
      campusShort = camp.short_name;
      campusFullName = camp.name;
    }

    let { data: students } = await supabase
      .from("students")
      .select("id, class_name")
      .eq("status", "active")
      .eq("campus_id", targetCampusId);

    // Tutorial centres: only students whose card is still valid count as enrolled
    if (isTutorialLabel(campusShort, campusFullName)) {
      const cards = await fetchActiveCardStudents(
        supabase,
        lagosToday(),
        targetCampusId
      );
      students = (students || []).filter((s: any) => cards.has(String(s.id)));
    }

    const classMap = new Map<string, number>();
    for (const s of students || []) {
      const cn = String(s.class_name || "Unassigned").trim() || "Unassigned";
      classMap.set(cn, (classMap.get(cn) || 0) + 1);
    }
    classRows = Array.from(classMap.entries())
      .map(([class_name, enrolled]) => ({ class_name, enrolled }))
      .sort((a, b) => a.class_name.localeCompare(b.class_name));
    totalEnrolled = classRows.reduce((s, c) => s + c.enrolled, 0);

    const { data: row } = await supabase
      .from("daily_attendance")
      .select("present_count, notes, class_breakdown")
      .eq("campus_id", targetCampusId)
      .eq("attendance_date", today)
      .maybeSingle();
    if (row) {
      existing = {
        present_count: row.present_count,
        notes: row.notes,
        class_breakdown:
          row.class_breakdown && typeof row.class_breakdown === "object"
            ? (row.class_breakdown as Record<string, number>)
            : null,
      };
    }
  }

  // Admin without campus: overview of all branches
  if (admin && !targetCampusId) {
    const { data: campuses } = await supabase
      .from("campuses")
      .select("id, name, short_name")
      .eq("is_active", true)
      .order("name");

    const { data: todayRows } = await supabase
      .from("daily_attendance")
      .select(
        "campus_id, present_count, total_enrolled, notes, class_breakdown, attendance_date"
      )
      .eq("attendance_date", today);

    const byCampus = new Map((todayRows || []).map((r) => [r.campus_id, r]));

    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900">Daily attendance</h1>
        <p className="text-gray-500 mt-1 mb-6">
          Today ({today}) — present counts submitted by secretaries.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(campuses || []).map((c) => {
            const row = byCampus.get(c.id);
            const main = isMainLabel(c.short_name, c.name);
            const breakdown =
              row?.class_breakdown &&
              typeof row.class_breakdown === "object"
                ? (row.class_breakdown as Record<string, number>)
                : null;
            return (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
              >
                <p className="font-semibold text-gray-900">
                  {c.short_name || c.name}
                  {main && (
                    <span className="ml-2 text-[10px] uppercase font-bold text-brand-green">
                      Main · per class
                    </span>
                  )}
                </p>
                {row ? (
                  <>
                    <p className="text-3xl font-bold text-brand-green mt-2">
                      {row.present_count}
                    </p>
                    <p className="text-xs text-gray-500">
                      present
                      {row.total_enrolled != null
                        ? ` · ${row.total_enrolled} enrolled`
                        : ""}
                    </p>
                    {breakdown && Object.keys(breakdown).length > 0 && (
                      <ul className="mt-2 text-xs text-gray-600 space-y-0.5 border-t pt-2">
                        {Object.entries(breakdown)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([cls, n]) => (
                            <li key={cls} className="flex justify-between gap-2">
                              <span>{cls}</span>
                              <span className="font-semibold">{n}</span>
                            </li>
                          ))}
                      </ul>
                    )}
                    {row.notes && (
                      <p className="text-xs text-gray-600 mt-1">{row.notes}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-amber-700 mt-2">
                    Not submitted yet today
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-sm text-gray-500 mt-6">
          <Link href="/" className="text-brand-green font-medium">
            ← Back to dashboard
          </Link>
        </p>
      </div>
    );
  }

  if (!targetCampusId) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Daily attendance</h1>
        <p className="text-gray-500 mt-2">No campus assigned.</p>
      </div>
    );
  }

  // Per-class only for Main / Suxess School secretaries — NOT Arepo / Ofada
  const perClass =
    !isTutorialLabel(campusShort, campusFullName) &&
    isMainLabel(campusShort, campusFullName);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Daily attendance</h1>
        <p className="text-gray-500 mt-1">
          {perClass
            ? "Record present students for each class. The director sees totals and class breakdown on the dashboard."
            : "Record how many students were present today. The director sees this on the dashboard for every branch."}
        </p>
      </div>
      <AttendanceForm
        campusId={targetCampusId}
        campusName={campusName}
        today={today}
        perClass={perClass}
        classes={classRows}
        existingPresent={existing?.present_count ?? null}
        existingNotes={existing?.notes ?? null}
        existingBreakdown={existing?.class_breakdown ?? null}
        totalEnrolled={totalEnrolled}
      />
      <p className="text-sm text-gray-500 mt-6">
        <Link href="/" className="text-brand-green font-medium">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
