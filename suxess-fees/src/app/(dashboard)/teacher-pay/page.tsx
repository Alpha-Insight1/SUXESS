import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getCurrentProfile, campusFilter, isAdmin } from "@/lib/auth";
import { TeacherPayForm } from "@/components/teacher-pay/teacher-pay-form";

export default async function TeacherPayPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const lockedCampus = campusFilter(profile);
  const admin = isAdmin(profile);

  let campusesQuery = supabase
    .from("campuses")
    .select("id, name, short_name")
    .eq("is_active", true);
  if (lockedCampus) campusesQuery = campusesQuery.eq("id", lockedCampus);

  let payQuery = supabase
    .from("teacher_payments")
    .select(
      "id, teacher_name, period_taught, amount, payment_method, payment_date, notes, campuses(short_name, name)"
    )
    .order("payment_date", { ascending: false })
    .limit(200);
  if (lockedCampus) payQuery = payQuery.eq("campus_id", lockedCampus);

  const [{ data: campuses }, { data: payments }] = await Promise.all([
    campusesQuery,
    payQuery,
  ]);

  const list = payments || [];
  const today = new Date().toISOString().slice(0, 10);
  const todayTotal = list
    .filter((p: any) => p.payment_date === today)
    .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Teacher daily pay
          </h1>
          <p className="text-gray-500 mt-1">
            Record cash or transfer payments to teachers (period taught) — for
            Arepo & Ofada tutorial centres
            {!admin && profile?.campuses?.short_name
              ? ` · ${profile.campuses.short_name}`
              : ""}
          </p>
        </div>
        <TeacherPayForm
          campuses={campuses || []}
          lockedCampusId={lockedCampus}
        />
      </div>

      <div className="mb-6 bg-white border rounded-xl p-4 shadow-sm inline-block">
        <p className="text-sm text-gray-500">Paid to teachers today</p>
        <p className="text-2xl font-bold text-gray-900">
          {formatCurrency(todayTotal)}
        </p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Teacher</th>
                <th className="text-left px-4 py-3 font-medium">Period taught</th>
                <th className="text-left px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Method</th>
                {admin && (
                  <th className="text-left px-4 py-3 font-medium">Campus</th>
                )}
                <th className="text-left px-4 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.length > 0 ? (
                list.map((p: any) => {
                  const c = Array.isArray(p.campuses)
                    ? p.campuses[0]
                    : p.campuses;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{p.payment_date}</td>
                      <td className="px-4 py-3 font-medium">
                        {p.teacher_name}
                      </td>
                      <td className="px-4 py-3">{p.period_taught}</td>
                      <td className="px-4 py-3 font-semibold">
                        {formatCurrency(Number(p.amount || 0))}
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {p.payment_method}
                      </td>
                      {admin && (
                        <td className="px-4 py-3">
                          {c?.short_name || c?.name || "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 text-gray-500">
                        {p.notes || "—"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={admin ? 7 : 6}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    No teacher payments recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
