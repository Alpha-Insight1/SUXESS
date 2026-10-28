import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCurrentProfile, campusFilter, isAdmin } from "@/lib/auth";
import { PrivateLessonForm } from "@/components/private-lessons/private-lesson-form";

export default async function PrivateLessonsPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const lockedCampus = campusFilter(profile);
  const admin = isAdmin(profile);

  let campusesQuery = supabase
    .from("campuses")
    .select("id, name, short_name")
    .eq("is_active", true);
  if (lockedCampus) campusesQuery = campusesQuery.eq("id", lockedCampus);

  let lessonsQuery = supabase
    .from("private_lessons")
    .select(
      "id, parent_name, parent_phone, student_name, amount_paid, teacher_name, teacher_amount, teachers, lesson_date, due_date, notes, campuses(short_name, name)"
    )
    .order("lesson_date", { ascending: false })
    .limit(200);
  if (lockedCampus) lessonsQuery = lessonsQuery.eq("campus_id", lockedCampus);

  const [{ data: campuses }, { data: lessons, error }] = await Promise.all([
    campusesQuery,
    lessonsQuery,
  ]);

  const list = lessons || [];
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";

  const profitOf = (r: any) =>
    Number(r.amount_paid || 0) - Number(r.teacher_amount || 0);

  const todayProfit = list
    .filter((r) => r.lesson_date === today)
    .reduce((s, r) => s + profitOf(r), 0);
  const monthProfit = list
    .filter((r) => r.lesson_date >= monthStart)
    .reduce((s, r) => s + profitOf(r), 0);
  const dueTodayList = list.filter((r) => r.due_date === today);
  const monthPaid = list
    .filter((r) => r.lesson_date >= monthStart)
    .reduce((s, r) => s + Number(r.amount_paid || 0), 0);

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Private lessons</h1>
          <p className="text-gray-500 mt-1">
            Parent payment, teacher fee, and school profit
            {!admin && profile?.campuses?.short_name
              ? ` · ${profile.campuses.short_name}`
              : ""}
          </p>
        </div>
        <PrivateLessonForm
          campuses={campuses || []}
          lockedCampusId={lockedCampus}
        />
      </div>

      {dueTodayList.length > 0 && (
        <div className="mb-4 bg-amber-50 border-2 border-amber-300 text-amber-950 rounded-xl p-4">
          <p className="font-bold text-sm">
            Private lessons due today ({dueTodayList.length})
          </p>
          <ul className="mt-2 text-sm space-y-1">
            {dueTodayList.map((r: any) => (
              <li key={r.id}>
                <span className="font-medium">{r.parent_name}</span>
                {r.student_name ? ` · ${r.student_name}` : ""}
                {" · "}
                {r.teacher_name}
                {" · paid "}
                {formatCurrency(Number(r.amount_paid || 0))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-3">
          {error.message}. Run{" "}
          <code className="text-xs">migration-private-lessons.sql</code> in
          Supabase SQL Editor.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Profit today</p>
          <p className="text-2xl font-bold text-green-700">
            {formatCurrency(todayProfit)}
          </p>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Profit this month</p>
          <p className="text-2xl font-bold text-green-700">
            {formatCurrency(monthProfit)}
          </p>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Parent fees this month</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(monthPaid)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Parent</th>
                <th className="text-left px-3 py-2 font-medium">Teacher</th>
                <th className="text-right px-3 py-2 font-medium">Paid</th>
                <th className="text-right px-3 py-2 font-medium">Teacher pay</th>
                <th className="text-right px-3 py-2 font-medium">Profit</th>
                <th className="text-left px-3 py-2 font-medium">Due</th>
                {admin && (
                  <th className="text-left px-3 py-2 font-medium">Campus</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.length === 0 ? (
                <tr>
                  <td
                    colSpan={admin ? 8 : 7}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No private lessons recorded yet
                  </td>
                </tr>
              ) : (
                list.map((r: any) => {
                  const c = Array.isArray(r.campuses)
                    ? r.campuses[0]
                    : r.campuses;
                  const profit = profitOf(r);
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        {formatDate(r.lesson_date)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.parent_name}</div>
                        <div className="text-xs text-gray-400">
                          {r.student_name || r.parent_phone || ""}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                      {Array.isArray(r.teachers) && r.teachers.length > 0 ? (
                        <ul className="text-xs space-y-0.5">
                          {r.teachers.map((t: any, i: number) => (
                            <li key={i}>
                              {t.name}: {formatCurrency(Number(t.amount || 0))}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        r.teacher_name
                      )}
                    </td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(Number(r.amount_paid || 0))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(Number(r.teacher_amount || 0))}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-bold ${
                          profit >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {formatCurrency(profit)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.due_date || "—"}
                      </td>
                      {admin && (
                        <td className="px-3 py-2">
                          {c?.short_name || c?.name || "—"}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
