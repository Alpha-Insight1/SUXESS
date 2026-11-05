import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { StaffForm } from "@/components/staff/staff-form";
import { StaffActions } from "@/components/staff/staff-actions";
import Link from "next/link";
import { getCurrentProfile, campusFilter, isAdmin } from "@/lib/auth";
import { ExportStaff } from "@/components/staff/export-staff";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const lockedCampus = campusFilter(profile);
  const admin = isAdmin(profile);
  const activeCampus = lockedCampus || params.campus || undefined;

  let campusesQuery = supabase
    .from("campuses")
    .select("id, name, short_name")
    .eq("is_active", true)
    .order("name");
  if (lockedCampus) campusesQuery = campusesQuery.eq("id", lockedCampus);

  let query = supabase
    .from("staff")
    .select("*, campuses(short_name, name)")
    .order("full_name");
  if (activeCampus) query = query.eq("campus_id", activeCampus);

  let loansQuery = supabase
    .from("staff_loans")
    .select("staff_id, monthly_deduction, amount_remaining, reason, status")
    .eq("status", "active");
  if (activeCampus) loansQuery = loansQuery.eq("campus_id", activeCampus);

  const [{ data: campuses }, { data: staff }, loansRes] = await Promise.all([
    campusesQuery,
    query,
    loansQuery,
  ]);

  const loans = loansRes.data || [];
  const deductionByStaff = new Map<
    string,
    { total: number; reasons: string[] }
  >();
  for (const l of loans) {
    const id = l.staff_id as string;
    const cur = deductionByStaff.get(id) || { total: 0, reasons: [] };
    cur.total += Number(l.monthly_deduction || 0);
    const r = String(l.reason || "Loan");
    if (!cur.reasons.includes(r)) cur.reasons.push(r);
    deductionByStaff.set(id, cur);
  }

  const activeStaff = staff?.filter((s: any) => s.status === "active") || [];
  const totalGross = activeStaff.reduce(
    (sum: number, s: any) => sum + Number(s.salary || 0),
    0
  );
  const totalDeductions = activeStaff.reduce((sum: number, s: any) => {
    return sum + (deductionByStaff.get(s.id)?.total || 0);
  }, 0);
  const totalNet = totalGross - totalDeductions;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff & Salaries</h1>
          <p className="text-gray-500 mt-1">
            {admin
              ? "Gross salary, loan deductions and net pay per campus"
              : `Staff at ${profile?.campuses?.short_name || "your campus"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/loans"
            className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
          >
            Teacher loans
          </Link>
          <ExportStaff staff={staff || []} />
          <StaffForm
            campuses={campuses || []}
            lockedCampusId={lockedCampus || undefined}
          />
        </div>
      </div>

      {admin && (
        <div className="flex flex-wrap gap-3 mb-4">
          <Link
            href="/staff"
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
              !params.campus
                ? "bg-brand-green text-white border-brand-green"
                : "bg-white text-gray-700 border-gray-300"
            }`}
          >
            All
          </Link>
          {campuses?.map((c: any) => (
            <Link
              key={c.id}
              href={`/staff?campus=${c.id}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                params.campus === c.id
                  ? "bg-brand-green text-white border-brand-green"
                  : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              {c.short_name || c.name}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Active staff</p>
          <p className="text-2xl font-bold text-gray-900">{activeStaff.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Gross payroll</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(totalGross)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Net after loans</p>
          <p className="text-2xl font-bold text-green-800">
            {formatCurrency(totalNet)}
          </p>
          {totalDeductions > 0 && (
            <p className="text-xs text-red-600 mt-1">
              Deductions −{formatCurrency(totalDeductions)}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Campus</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium">Gross salary</th>
                <th className="text-left px-4 py-3 font-medium">Deduction</th>
                <th className="text-left px-4 py-3 font-medium">Net pay</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff && staff.length > 0 ? (
                staff.map((s: any) => {
                  const gross = Number(s.salary || 0);
                  const ded = deductionByStaff.get(s.id);
                  const deduct = ded?.total || 0;
                  const net = Math.max(0, gross - deduct);
                  const camp = Array.isArray(s.campuses)
                    ? s.campuses[0]
                    : s.campuses;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{s.full_name}</td>
                      <td className="px-4 py-3">
                        {camp?.short_name || camp?.name || "—"}
                      </td>
                      <td className="px-4 py-3">{s.role || "—"}</td>
                      <td className="px-4 py-3">
                        {formatCurrency(gross)}
                      </td>
                      <td className="px-4 py-3">
                        {deduct > 0 ? (
                          <div>
                            <span className="font-semibold text-red-700">
                              −{formatCurrency(deduct)}
                            </span>
                            <span className="block text-xs text-gray-500 mt-0.5">
                              {ded?.reasons.join(", ") || "Loan"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-green-800">
                        {formatCurrency(net)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            s.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StaffActions
                          staffId={s.id}
                          status={s.status || "active"}
                          currentSalary={gross}
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    No staff added yet
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
