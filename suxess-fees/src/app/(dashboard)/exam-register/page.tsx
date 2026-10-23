import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getCurrentProfile, campusFilter, isAdmin } from "@/lib/auth";
import { MarkRegisteredButton } from "@/components/exam-register/mark-registered-button";
import Link from "next/link";

/** Fee types that are exam registration (not school tuition). */
function isExamRegistrationFee(name?: string | null) {
  if (!name) return false;
  const n = name.toLowerCase();
  return (
    n.includes("jamb") ||
    n.includes("waec") ||
    n.includes("ssce") ||
    n.includes("neco") ||
    n.includes("gce") ||
    n.includes("nabteb") ||
    (n.includes("exam") &&
      (n.includes("regist") || n.includes("form") || n.includes("pin")))
  );
}

export default async function ExamRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ exam?: string; status?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const lockedCampus = campusFilter(profile);
  const admin = isAdmin(profile);

  let query = supabase
    .from("student_fees")
    .select(
      `id, amount, amount_paid, balance, status, session, term,
       board_registered, board_registered_at,
       fee_types(id, name),
       students!inner(
         id, full_name, admission_number, class_name,
         parent_name, parent_phone, campus_id, status,
         campuses(short_name, name)
       )`
    )
    .eq("students.status", "active")
    .order("created_at", { ascending: false });

  if (lockedCampus) {
    query = query.eq("students.campus_id", lockedCampus);
  }

  const { data: fees } = await query;

  // Only exam registration fee types (JAMB, WAEC, etc.)
  let list = (fees || []).filter((f: any) => {
    const ft = Array.isArray(f.fee_types) ? f.fee_types[0] : f.fee_types;
    return isExamRegistrationFee(ft?.name);
  });

  if (params.exam) {
    list = list.filter((f: any) => {
      const ft = Array.isArray(f.fee_types) ? f.fee_types[0] : f.fee_types;
      return (
        String(ft?.name || "").toLowerCase() === params.exam!.toLowerCase()
      );
    });
  }

  if (params.status === "pending") {
    // Paid (or partial) but not yet board-registered
    list = list.filter(
      (f: any) => Number(f.amount_paid) > 0 && !f.board_registered
    );
  } else if (params.status === "unpaid") {
    list = list.filter((f: any) => Number(f.amount_paid) <= 0);
  } else if (params.status === "done") {
    list = list.filter((f: any) => f.board_registered);
  }

  const allExam = (fees || []).filter((f: any) => {
    const ft = Array.isArray(f.fee_types) ? f.fee_types[0] : f.fee_types;
    return isExamRegistrationFee(ft?.name);
  });

  const unpaid = allExam.filter((f: any) => Number(f.amount_paid) <= 0).length;
  const paidPending = allExam.filter(
    (f: any) => Number(f.amount_paid) > 0 && !f.board_registered
  ).length;
  const boardDone = allExam.filter((f: any) => f.board_registered).length;

  const examTypes = new Map<string, number>();
  for (const f of allExam) {
    const ft = Array.isArray(f.fee_types) ? f.fee_types[0] : f.fee_types;
    const name = ft?.name || "Exam fee";
    examTypes.set(name, (examTypes.get(name) || 0) + 1);
  }
  const examFilters = Array.from(examTypes.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  function campusLabel(s: any) {
    const c = Array.isArray(s?.campuses) ? s.campuses[0] : s?.campuses;
    return c?.short_name || c?.name || "—";
  }

  function payStatus(f: any) {
    const paid = Number(f.amount_paid || 0);
    const amount = Number(f.amount || 0);
    if (paid <= 0) return { label: "Not paid", className: "text-red-600" };
    if (paid < amount)
      return { label: "Part paid", className: "text-amber-700" };
    return { label: "Fully paid", className: "text-green-700" };
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Exam registration (fees)
        </h1>
        <p className="text-gray-500 mt-1">
          Students who paid (or owe) JAMB / WAEC / SSCE registration fees.
          After payment, mark them when registration on the exam board is done.
          {!admin && profile?.campuses?.short_name
            ? ` · ${profile.campuses.short_name}`
            : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700">Exam fee not paid</p>
          <p className="text-2xl font-bold text-red-800">{unpaid}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800">Paid — await board reg.</p>
          <p className="text-2xl font-bold text-amber-900">{paidPending}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-800">Registered on board</p>
          <p className="text-2xl font-bold text-green-900">{boardDone}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href="/exam-register"
          className={`px-3 py-1.5 rounded-lg text-sm border ${
            !params.exam && !params.status
              ? "bg-brand-green text-white border-brand-green"
              : "bg-white text-gray-700 border-gray-200"
          }`}
        >
          All
        </Link>
        <Link
          href="/exam-register?status=unpaid"
          className={`px-3 py-1.5 rounded-lg text-sm border ${
            params.status === "unpaid"
              ? "bg-red-600 text-white border-red-600"
              : "bg-white text-gray-700 border-gray-200"
          }`}
        >
          Not paid
        </Link>
        <Link
          href="/exam-register?status=pending"
          className={`px-3 py-1.5 rounded-lg text-sm border ${
            params.status === "pending"
              ? "bg-amber-600 text-white border-amber-600"
              : "bg-white text-gray-700 border-gray-200"
          }`}
        >
          Paid · pending board
        </Link>
        <Link
          href="/exam-register?status=done"
          className={`px-3 py-1.5 rounded-lg text-sm border ${
            params.status === "done"
              ? "bg-green-700 text-white border-green-700"
              : "bg-white text-gray-700 border-gray-200"
          }`}
        >
          Board registered
        </Link>
        {examFilters.map(([name, count]) => (
          <Link
            key={name}
            href={`/exam-register?exam=${encodeURIComponent(name)}`}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              params.exam === name
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-700 border-gray-200"
            }`}
          >
            {name} ({count})
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Student</th>
                {admin && (
                  <th className="text-left px-4 py-3 font-medium">Campus</th>
                )}
                <th className="text-left px-4 py-3 font-medium">Exam fee</th>
                <th className="text-left px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Payment</th>
                <th className="text-left px-4 py-3 font-medium">Board</th>
                <th className="text-left px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.length > 0 ? (
                list.map((f: any) => {
                  const st = Array.isArray(f.students)
                    ? f.students[0]
                    : f.students;
                  const ft = Array.isArray(f.fee_types)
                    ? f.fee_types[0]
                    : f.fee_types;
                  const ps = payStatus(f);
                  return (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {st?.full_name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {st?.admission_number}
                          {st?.parent_phone ? ` · ${st.parent_phone}` : ""}
                        </div>
                      </td>
                      {admin && (
                        <td className="px-4 py-3">{campusLabel(st)}</td>
                      )}
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800">
                          {ft?.name || "Exam fee"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>{formatCurrency(Number(f.amount || 0))}</div>
                        <div className="text-xs text-gray-400">
                          Paid {formatCurrency(Number(f.amount_paid || 0))}
                        </div>
                      </td>
                      <td className={`px-4 py-3 font-medium ${ps.className}`}>
                        {ps.label}
                      </td>
                      <td className="px-4 py-3">
                        {f.board_registered ? (
                          <span className="text-green-700 font-medium">
                            Done
                            {f.board_registered_at && (
                              <span className="block text-xs text-gray-400 font-normal">
                                {String(f.board_registered_at).slice(0, 10)}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-amber-700">Not yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {Number(f.amount_paid) > 0 ? (
                          <MarkRegisteredButton
                            feeId={f.id}
                            registered={!!f.board_registered}
                          />
                        ) : (
                          <Link
                            href={`/payments?student=${st?.id}`}
                            className="text-brand-green text-xs font-medium hover:underline"
                          >
                            Record payment
                          </Link>
                        )}
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
                    No exam registration fees found. Create fee types named e.g.{" "}
                    <strong>JAMB Registration</strong>,{" "}
                    <strong>WAEC Registration</strong>, then record the fee /
                    payment for the student.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-sm text-gray-500 bg-gray-50 border rounded-xl p-4">
        <p className="font-medium text-gray-700 mb-2">How to use</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            In fee types, use names like <strong>JAMB Registration</strong>,{" "}
            <strong>WAEC Registration</strong>, <strong>SSCE Form</strong>,{" "}
            <strong>NECO</strong> (so the app recognises them).
          </li>
          <li>
            Record the exam fee for the student (and payment when they pay).
          </li>
          <li>
            They appear here. After you register them on the JAMB/WAEC portal,
            click <strong>Mark board registered</strong>.
          </li>
        </ol>
      </div>
    </div>
  );
}
