import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ExpenseForm } from "@/components/expenses/expense-form";
import Link from "next/link";
import { getCurrentProfile, campusFilter, isAdmin } from "@/lib/auth";
import { ExportExpenses } from "@/components/expenses/export-expenses";

export default async function ExpensesPage({
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
    .from("expenses")
    .select("*, campuses(short_name, name)")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (activeCampus) query = query.eq("campus_id", activeCampus);

  const [{ data: campuses }, { data: expenses }] = await Promise.all([
    campusesQuery,
    query,
  ]);

  const total =
    expenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branch Expenses</h1>
          <p className="text-gray-500 mt-1">
            {admin
              ? "Record daily expenses for each campus"
              : `Expenses for ${profile?.campuses?.short_name || "your campus"}`}
          </p>
        </div>
        <ExportExpenses expenses={expenses || []} />
      </div>

      <div className="mb-8">
        <ExpenseForm
          campuses={campuses || []}
          lockedCampusId={lockedCampus || undefined}
        />
      </div>

      {admin && (
        <div className="flex flex-wrap gap-3 mb-4">
          <Link
            href="/expenses"
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
              href={`/expenses?campus=${c.id}`}
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

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex justify-between items-center">
        <span className="text-amber-900 font-medium">Total (shown list)</span>
        <span className="text-xl font-bold text-amber-900">
          {formatCurrency(total)}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Campus</th>
                <th className="text-left px-4 py-3 font-medium">Category</th>
                <th className="text-left px-4 py-3 font-medium">Description</th>
                <th className="text-left px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenses && expenses.length > 0 ? (
                expenses.map((e: any) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{formatDate(e.expense_date)}</td>
                    <td className="px-4 py-3">
                      {e.campuses?.short_name || e.campuses?.name || "—"}
                    </td>
                    <td className="px-4 py-3">{e.category}</td>
                    <td className="px-4 py-3">
                      {e.description}
                      {e.notes && (
                        <div className="text-xs text-gray-400">{e.notes}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-red-600">
                      {formatCurrency(Number(e.amount || 0))}
                    </td>
                    <td className="px-4 py-3 capitalize">{e.payment_method}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    No expenses recorded yet
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
