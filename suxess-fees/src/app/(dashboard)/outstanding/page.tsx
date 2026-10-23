import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { getCurrentProfile, campusFilter, isAdmin } from "@/lib/auth";
import { ExportOutstanding } from "@/components/outstanding/export-outstanding";

export default async function OutstandingPage({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const campusLbl = `${profile?.campuses?.short_name || ""} ${profile?.campuses?.name || ""}`.toLowerCase();
  const isTut =
    campusLbl.includes("arepo") ||
    campusLbl.includes("ofada") ||
    campusLbl.includes("mowe");
  if (profile?.role === "secretary" && isTut) {
    redirect("/");
  }
  const lockedCampus = campusFilter(profile);
  const admin = isAdmin(profile);
  const activeCampus = lockedCampus || params.campus || undefined;

  let feesQuery = supabase
    .from("student_fees")
    .select(
      `id, balance, status, session, term, amount, amount_paid,
       students!inner(id, full_name, admission_number, class_name, parent_name, parent_phone, campus_id, campuses(short_name)),
       fee_types(name)`
    )
    .gt("balance", 0)
    .order("balance", { ascending: false });

  if (activeCampus) {
    feesQuery = feesQuery.eq("students.campus_id", activeCampus);
  }

  let campusesQuery = supabase
    .from("campuses")
    .select("id, name, short_name")
    .eq("is_active", true);
  if (lockedCampus) campusesQuery = campusesQuery.eq("id", lockedCampus);

  const [{ data: fees }, { data: campuses }] = await Promise.all([
    feesQuery,
    campusesQuery,
  ]);

  // Outstanding is Main school only — never Arepo / Ofada tutorial fees
  function isMainCampusRow(f: any) {
    const st = Array.isArray(f.students) ? f.students[0] : f.students;
    const c = Array.isArray(st?.campuses) ? st?.campuses[0] : st?.campuses;
    const label = `${c?.short_name || ""} ${c?.name || ""}`.toLowerCase();
    if (label.includes("arepo") || label.includes("ofada") || label.includes("mowe")) {
      return false;
    }
    return true;
  }

  const filtered = (fees || []).filter(isMainCampusRow);

  // Campus filter chips: only Main (non-tutorial)
  const mainCampuses = (campuses || []).filter((c: any) => {
    const label = `${c.short_name || ""} ${c.name || ""}`.toLowerCase();
    return !(
      label.includes("arepo") ||
      label.includes("ofada") ||
      label.includes("mowe")
    );
  });
  const totalOutstanding = filtered.reduce(
    (sum: number, f: any) => sum + Number(f.balance || 0),
    0
  );

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Outstanding Balances</h1>
          <p className="text-gray-500 mt-1">
            {admin
              ? "Main campus school fees only (not tutorial centres)"
              : `Outstanding at ${profile?.campuses?.short_name || "your campus"}`}
          </p>
        </div>
        <ExportOutstanding fees={filtered as any[]} />
      </div>

      {admin && mainCampuses.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6">
          <Link
            href="/outstanding"
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
              href={`/outstanding?campus=${c.id}`}
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

      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center justify-between">
        <span className="text-red-800 font-medium">Total Outstanding</span>
        <span className="text-2xl font-bold text-red-700">
          {formatCurrency(totalOutstanding)}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Student</th>
                <th className="text-left px-4 py-3 font-medium">Parent</th>
                <th className="text-left px-4 py-3 font-medium">Parent Phone</th>
                <th className="text-left px-4 py-3 font-medium">Fee Type</th>
                <th className="text-left px-4 py-3 font-medium">Fee Amount</th>
                <th className="text-left px-4 py-3 font-medium">Amount Paid</th>
                <th className="text-left px-4 py-3 font-medium">Session</th>
                <th className="text-left px-4 py-3 font-medium">Term</th>
                <th className="text-left px-4 py-3 font-medium">Outstanding</th>
                <th className="text-left px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length > 0 ? (
                filtered.map((f: any) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{f.students?.full_name}</div>
                      <div className="text-xs text-gray-400">
                        {f.students?.admission_number}
                        {f.students?.class_name
                          ? ` · ${f.students.class_name}`
                          : ""}
                        {f.students?.campuses?.short_name
                          ? ` · ${f.students.campuses.short_name}`
                          : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {f.students?.parent_name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {f.students?.parent_phone ? (
                        <a
                          href={`https://wa.me/234${String(
                            f.students.parent_phone
                          )
                            .replace(/^0/, "")
                            .replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:underline"
                        >
                          {f.students.parent_phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">{f.fee_types?.name || "—"}</td>
                    <td className="px-4 py-3">
                      {formatCurrency(Number(f.amount || 0))}
                    </td>
                    <td className="px-4 py-3">
                      {formatCurrency(Number(f.amount_paid || 0))}
                    </td>
                    <td className="px-4 py-3">{f.session || "—"}</td>
                    <td className="px-4 py-3">{f.term || "—"}</td>
                    <td className="px-4 py-3 font-semibold text-red-600">
                      {formatCurrency(Number(f.balance || 0))}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/payments?student=${f.students?.id}`}
                        className="text-brand-green font-medium hover:underline"
                      >
                        Collect
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    No outstanding balances
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
