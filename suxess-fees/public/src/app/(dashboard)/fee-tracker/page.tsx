import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { getCurrentProfile, campusFilter, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

type Status = "paid" | "partial" | "unpaid" | "scholarship";

export default async function FeeTrackerPage({
  searchParams,
}: {
  searchParams: Promise<{
    session?: string;
    term?: string;
    status?: string;
    class?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const admin = isAdmin(profile);
  const lockedCampus = campusFilter(profile);

  // Main school secretaries + admin only
  const campusLbl = `${profile?.campuses?.short_name || ""} ${
    profile?.campuses?.name || ""
  }`.toLowerCase();
  const isTutorial =
    campusLbl.includes("arepo") ||
    campusLbl.includes("ofada") ||
    campusLbl.includes("mowe");
  if (profile?.role === "secretary" && isTutorial) {
    redirect("/");
  }

  const session = (params.session || "2025/2026").trim();
  const term = (params.term || "First Term").trim();
  const statusFilter = (params.status || "all").trim();
  const classFilter = (params.class || "").trim();

  // Prefer Main campus for school tracker
  let mainCampusId = lockedCampus || undefined;
  if (admin && !mainCampusId) {
    const { data: camps } = await supabase
      .from("campuses")
      .select("id, name, short_name")
      .eq("is_active", true);
    const main = (camps || []).find((c) => {
      const L = `${c.short_name || ""} ${c.name || ""}`.toLowerCase();
      return L.includes("main") || L.includes("school");
    });
    mainCampusId = main?.id;
  }

  let studentsQ = supabase
    .from("students")
    .select(
      "id, full_name, admission_number, class_name, parent_name, parent_phone, status, campus_id, campuses(short_name, name)"
    )
    .eq("status", "active")
    .order("class_name")
    .order("full_name")
    .limit(2000);
  if (mainCampusId) studentsQ = studentsQ.eq("campus_id", mainCampusId);
  if (classFilter) studentsQ = studentsQ.ilike("class_name", classFilter);

  const { data: feeTypes } = await supabase
    .from("fee_types")
    .select("id, name");
  const schoolFeeIds = (feeTypes || [])
    .filter((ft: any) => {
      const n = String(ft.name || "").toLowerCase();
      return n.includes("school fee") || n === "school fees";
    })
    .map((ft: any) => ft.id);

  const [{ data: students }, { data: fees }, { data: scholarships }] =
    await Promise.all([
      studentsQ,
      schoolFeeIds.length
        ? supabase
            .from("student_fees")
            .select(
              "student_id, amount, amount_paid, balance, session, term, fee_type_id"
            )
            .in("fee_type_id", schoolFeeIds)
            .eq("session", session)
            .eq("term", term)
            .limit(5000)
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from("scholarships")
        .select("id, student_id, session, term, coverage, amount_covered, status")
        .eq("session", session)
        .eq("term", term)
        .eq("status", "active")
        .limit(2000),
    ]);

  const feeByStudent = new Map<string, any>();
  for (const f of fees || []) {
    const prev = feeByStudent.get(f.student_id);
    if (!prev) feeByStudent.set(f.student_id, f);
    else {
      // merge if multiple lines
      feeByStudent.set(f.student_id, {
        ...prev,
        amount: Number(prev.amount || 0) + Number(f.amount || 0),
        amount_paid: Number(prev.amount_paid || 0) + Number(f.amount_paid || 0),
        balance: Number(prev.balance || 0) + Number(f.balance || 0),
      });
    }
  }

  const scholarshipStudents = new Set(
    (scholarships || []).map((s: any) => s.student_id)
  );
  const scholarshipMeta = new Map(
    (scholarships || []).map((s: any) => [s.student_id, s])
  );

  type Row = {
    id: string;
    full_name: string;
    admission_number: string;
    class_name: string;
    parent_name?: string | null;
    parent_phone?: string | null;
    status: Status;
    amount: number;
    amount_paid: number;
    balance: number;
    scholarship?: any;
  };

  const rows: Row[] = (students || []).map((s: any) => {
    const onScholarship = scholarshipStudents.has(s.id);
    const fee = feeByStudent.get(s.id);
    const amount = Number(fee?.amount || 0);
    const amount_paid = Number(fee?.amount_paid || 0);
    const balance = fee
      ? Number(fee.balance || 0)
      : onScholarship
        ? 0
        : -1; // -1 = no fee recorded

    let status: Status = "unpaid";
    if (onScholarship) status = "scholarship";
    else if (!fee || amount_paid <= 0) status = "unpaid";
    else if (balance <= 0) status = "paid";
    else status = "partial";

    return {
      id: s.id,
      full_name: s.full_name,
      admission_number: s.admission_number,
      class_name: s.class_name || "—",
      parent_name: s.parent_name,
      parent_phone: s.parent_phone,
      status,
      amount: amount > 0 ? amount : 0,
      amount_paid,
      balance: balance < 0 ? 0 : balance,
      scholarship: scholarshipMeta.get(s.id),
    };
  });

  const counts = {
    paid: rows.filter((r) => r.status === "paid").length,
    partial: rows.filter((r) => r.status === "partial").length,
    unpaid: rows.filter((r) => r.status === "unpaid").length,
    scholarship: rows.filter((r) => r.status === "scholarship").length,
    remaining: rows.filter(
      (r) => r.status === "unpaid" || r.status === "partial"
    ).length,
    all: rows.length,
  };

  const filtered =
    statusFilter === "all"
      ? rows
      : statusFilter === "remaining"
        ? rows.filter((r) => r.status === "unpaid" || r.status === "partial")
        : rows.filter((r) => r.status === statusFilter);

  const classSet = new Set(rows.map((r) => r.class_name).filter(Boolean));
  const classList = Array.from(classSet).sort();

  const terms = ["First Term", "Second Term", "Third Term"];
  const sessions = ["2024/2025", "2025/2026", "2026/2027"];

  function href(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    p.set("session", overrides.session ?? session);
    p.set("term", overrides.term ?? term);
    const st = overrides.status ?? statusFilter;
    if (st && st !== "all") p.set("status", st);
    const cl = overrides.class ?? classFilter;
    if (cl) p.set("class", cl);
    return `/fee-tracker?${p.toString()}`;
  }

  const statusStyle: Record<Status, string> = {
    paid: "bg-green-100 text-green-800",
    partial: "bg-amber-100 text-amber-900",
    unpaid: "bg-red-100 text-red-800",
    scholarship: "bg-blue-100 text-blue-900",
  };

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            School fees tracker
          </h1>
          <p className="text-gray-500 mt-1">
            Who has paid, partial, unpaid, or is on scholarship — by session and
            term. <strong>Others remaining</strong> = not fully paid yet
            (partial + not paid).
            {admin ? " · Main school focus" : ""}
          </p>
        </div>
        {admin && (
          <Link
            href="/scholarships"
            className="inline-flex items-center px-4 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800"
          >
            Manage scholarships
          </Link>
        )}
      </div>

      {/* Session / term */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6 space-y-3">
        <div className="flex flex-wrap gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Session</p>
            <div className="flex flex-wrap gap-2">
              {sessions.map((s) => (
                <Link
                  key={s}
                  href={href({ session: s })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                    session === s
                      ? "bg-brand-green text-white border-brand-green"
                      : "bg-white text-gray-700 border-gray-300"
                  }`}
                >
                  {s}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Term</p>
            <div className="flex flex-wrap gap-2">
              {terms.map((tm) => (
                <Link
                  key={tm}
                  href={href({ term: tm })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                    term === tm
                      ? "bg-brand-green text-white border-brand-green"
                      : "bg-white text-gray-700 border-gray-300"
                  }`}
                >
                  {tm}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Viewing{" "}
          <span className="font-semibold text-gray-900">
            {session} · {term}
          </span>
        </p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {(
          [
            ["all", "All students", counts.all, "border-gray-200"],
            ["paid", "Fully paid", counts.paid, "border-green-200"],
            ["partial", "Partial", counts.partial, "border-amber-200"],
            ["unpaid", "Not paid", counts.unpaid, "border-red-200"],
            [
              "scholarship",
              "Scholarship",
              counts.scholarship,
              "border-blue-200",
            ],
            [
              "remaining",
              "Others remaining",
              counts.remaining,
              "border-orange-300",
            ],
          ] as const
        ).map(([id, label, count, border]) => (
          <Link
            key={id}
            href={href({ status: id })}
            className={`bg-white rounded-xl border-2 p-4 shadow-sm hover:shadow transition ${border} ${
              statusFilter === id ? "ring-2 ring-brand-green" : ""
            }`}
          >
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
          </Link>
        ))}
      </div>

      {classList.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Link
            href={href({ class: "" })}
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
              href={href({ class: c })}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                classFilter === c
                  ? "bg-brand-green text-white border-brand-green"
                  : "bg-white text-gray-600 border-gray-300"
              }`}
            >
              {c}
            </Link>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Student</th>
                <th className="text-left px-4 py-3 font-medium">Class</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Fee</th>
                <th className="text-right px-4 py-3 font-medium">Paid</th>
                <th className="text-right px-4 py-3 font-medium">Balance</th>
                <th className="text-left px-4 py-3 font-medium">Parent</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No students in this view
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/students/${r.id}`}
                        className="font-medium text-gray-900 hover:text-brand-green hover:underline"
                      >
                        {r.full_name}
                      </Link>
                      <div className="text-xs text-gray-400">
                        {r.admission_number}
                      </div>
                    </td>
                    <td className="px-4 py-3">{r.class_name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusStyle[r.status]}`}
                      >
                        {r.status === "scholarship"
                          ? "Scholarship"
                          : r.status === "paid"
                            ? "Fully paid"
                            : r.status === "partial"
                              ? "Partial"
                              : "Not paid"}
                      </span>
                      {r.scholarship?.coverage && (
                        <span className="block text-[10px] text-blue-700 mt-0.5">
                          {r.scholarship.coverage} cover
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.amount > 0 ? formatCurrency(r.amount) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-green-700">
                      {r.amount_paid > 0
                        ? formatCurrency(r.amount_paid)
                        : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        r.balance > 0 ? "text-red-600" : "text-gray-500"
                      }`}
                    >
                      {r.status === "scholarship"
                        ? "—"
                        : r.balance > 0
                          ? formatCurrency(r.balance)
                          : r.status === "paid"
                            ? formatCurrency(0)
                            : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {r.parent_phone || r.parent_name || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
