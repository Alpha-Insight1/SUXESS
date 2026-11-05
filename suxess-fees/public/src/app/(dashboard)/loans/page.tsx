import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getCurrentProfile, campusFilter, isAdmin } from "@/lib/auth";
import { LoanForm } from "@/components/loans/loan-form";
import { LoanActions } from "@/components/loans/loan-actions";

export default async function LoansPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const lockedCampus = campusFilter(profile);
  const admin = isAdmin(profile);

  let staffQuery = supabase
    .from("staff")
    .select("id, full_name, campus_id, salary, status")
    .eq("status", "active")
    .order("full_name");
  if (lockedCampus) staffQuery = staffQuery.eq("campus_id", lockedCampus);

  let loansQuery = supabase
    .from("staff_loans")
    .select(
      `id, principal, monthly_deduction, amount_remaining, reason, start_date, status, notes,
       staff(id, full_name, salary, campuses(short_name, name))`
    )
    .order("created_at", { ascending: false });
  if (lockedCampus) loansQuery = loansQuery.eq("campus_id", lockedCampus);

  const [{ data: staff }, { data: loans, error }] = await Promise.all([
    staffQuery,
    loansQuery,
  ]);

  const list = loans || [];
  const active = list.filter((l: any) => l.status === "active");
  const totalOutstanding = active.reduce(
    (s: number, l: any) => s + Number(l.amount_remaining || 0),
    0
  );
  const totalMonthly = active.reduce(
    (s: number, l: any) => s + Number(l.monthly_deduction || 0),
    0
  );

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher loans</h1>
          <p className="text-gray-500 mt-1">
            Record loans and monthly salary deductions
            {!admin && profile?.campuses?.short_name
              ? ` · ${profile.campuses.short_name}`
              : ""}
          </p>
        </div>
        <LoanForm
          staff={(staff || []).map((s: any) => ({
            id: s.id,
            full_name: s.full_name,
            campus_id: s.campus_id,
            salary: s.salary,
          }))}
          lockedCampusId={lockedCampus}
        />
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-3">
          {error.message}. Run <code>migration-staff-loans.sql</code> in
          Supabase if the table is missing.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Active loans outstanding</p>
          <p className="text-2xl font-bold text-red-700">
            {formatCurrency(totalOutstanding)}
          </p>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total monthly deductions</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(totalMonthly)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Staff</th>
                <th className="text-left px-4 py-3 font-medium">Loan</th>
                <th className="text-left px-4 py-3 font-medium">
                  Monthly deduct
                </th>
                <th className="text-left px-4 py-3 font-medium">Remaining</th>
                <th className="text-left px-4 py-3 font-medium">Reason</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.length > 0 ? (
                list.map((l: any) => {
                  const st = Array.isArray(l.staff) ? l.staff[0] : l.staff;
                  return (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        {st?.full_name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {formatCurrency(Number(l.principal || 0))}
                      </td>
                      <td className="px-4 py-3 text-red-700 font-semibold">
                        −{formatCurrency(Number(l.monthly_deduction || 0))}
                      </td>
                      <td className="px-4 py-3">
                        {formatCurrency(Number(l.amount_remaining || 0))}
                      </td>
                      <td className="px-4 py-3">{l.reason || "Loan"}</td>
                      <td className="px-4 py-3 capitalize">{l.status}</td>
                      <td className="px-4 py-3">
                        <LoanActions
                          loanId={l.id}
                          status={l.status}
                          amountRemaining={Number(l.amount_remaining || 0)}
                          monthlyDeduction={Number(l.monthly_deduction || 0)}
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    No loans recorded yet.
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
