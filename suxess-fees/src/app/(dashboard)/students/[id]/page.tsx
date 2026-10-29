import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCurrentProfile, campusFilter, isAdmin } from "@/lib/auth";
import { RecordPaymentForm } from "@/components/payments/record-payment-form";
import { EditStudentButton } from "@/components/students/edit-student-button";
import { StudentStatusActions } from "@/components/students/student-status-actions";
import { ArrowLeft } from "lucide-react";
import { RemoveFeeButton } from "@/components/students/remove-fee-button";

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const campusId = campusFilter(profile);
  const admin = isAdmin(profile);

  const { data: student } = await supabase
    .from("students")
    .select(
      `id, admission_number, full_name, class_name, parent_name, parent_phone,
       parent_email, exam_preparing_for, address, department, status, campus_id, created_at,
       campuses(name, short_name)`
    )
    .eq("id", id)
    .maybeSingle();

  if (!student) notFound();

  if (campusId && student.campus_id !== campusId) {
    redirect("/students");
  }

  const [{ data: fees }, { data: payments }, { data: feeTypes }, { data: scholarships }] =
    await Promise.all([
      supabase
        .from("student_fees")
        .select(
          "id, amount, amount_paid, balance, status, session, term, valid_until, board_deadline, board_registered, fee_types(name)"
        )
        .eq("student_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select(
          "id, amount, payment_date, payment_method, receipt_number, deleted_at, notes, student_fee_id"
        )
        .eq("student_id", id)
        .order("payment_date", { ascending: false })
        .limit(50),
      supabase.from("fee_types").select("id, name").order("name"),
      supabase
        .from("scholarships")
        .select("id, session, term, coverage, amount_covered, reason, status")
        .eq("student_id", id)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
    ]);

  const outstanding = (fees || []).filter((f) => Number(f.balance || 0) > 0);
  const totalOwed = outstanding.reduce(
    (s, f) => s + Number(f.balance || 0),
    0
  );
  const totalPaid = (payments || [])
    .filter((p) => !p.deleted_at)
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  const camp = Array.isArray(student.campuses)
    ? student.campuses[0]
    : student.campuses;
  const campusLabel = camp?.short_name || camp?.name || "—";

  const studentOption = [
    {
      id: student.id,
      full_name: student.full_name,
      admission_number: student.admission_number,
      class_name: student.class_name,
      parent_name: student.parent_name,
      parent_phone: student.parent_phone,
      parent_email: student.parent_email,
      campuses: student.campuses,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/students"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-brand-green"
        >
          <ArrowLeft className="w-4 h-4" />
          All students
        </Link>
      </div>

      {(scholarships || []).length > 0 && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
          <p className="text-sm font-bold text-blue-950">
            Scholarship student
          </p>
          <ul className="mt-2 space-y-1 text-sm text-blue-900">
            {(scholarships || []).map((s: any) => (
              <li key={s.id}>
                <span className="font-medium">
                  {s.session} · {s.term}
                </span>
                {" — "}
                {s.coverage === "full" ? "Full school fees" : "Partial"}
                {s.coverage === "partial" && Number(s.amount_covered || 0) > 0
                  ? ` (${formatCurrency(Number(s.amount_covered))})`
                  : ""}
                {s.reason ? (
                  <span className="block text-xs text-blue-800 mt-0.5">
                    Note: {s.reason}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-xs text-blue-700 mt-2">
            Do not charge full school fees for covered term(s) unless directed
            by the director.
          </p>
        </div>
      )}

      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">
              Student profile
            </p>
            <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
              {student.full_name}
            </h1>
            <p className="text-gray-500 mt-1">
              {student.admission_number}
              <span className="mx-1.5">·</span>
              {campusLabel}
              {student.class_name ? (
                <>
                  <span className="mx-1.5">·</span>
                  {student.class_name}
                </>
              ) : null}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  student.status === "active"
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {student.status || "active"}
              </span>
              {student.department && (
                <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800">
                  {student.department}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-stretch sm:items-end gap-2">
            <EditStudentButton student={student as any} />
            <StudentStatusActions
              studentId={student.id}
              currentStatus={student.status}
              studentName={student.full_name}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-5 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase">Parent</p>
            <p className="font-medium text-gray-900 mt-0.5">
              {student.parent_name || "—"}
            </p>
            <p className="text-sm text-gray-500">{student.parent_phone || "—"}</p>
            {student.parent_email && (
              <p className="text-sm text-gray-500">{student.parent_email}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">Address</p>
            <p className="font-medium text-gray-900 mt-0.5">
              {student.address || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">Exam preparing</p>
            <p className="font-medium text-gray-900 mt-0.5">
              {student.exam_preparing_for || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">Balances</p>
            <p className="font-bold text-red-700 mt-0.5">
              {formatCurrency(totalOwed)} outstanding
            </p>
            <p className="text-sm text-green-700">
              {formatCurrency(totalPaid)} collected (listed)
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Record payment */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Record payment
          </h2>
          <RecordPaymentForm
            students={studentOption as any}
            feeTypes={feeTypes || []}
            preselectedStudentId={student.id}
            outstandingFees={(outstanding as any) || []}
            lockStudent
          />
        </div>

        {/* Fees overview */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-900">Fees & balances</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-500 bg-white">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Fee</th>
                    <th className="text-right px-4 py-2 font-medium">Paid</th>
                    <th className="text-right px-4 py-2 font-medium">Balance</th>
                    <th className="text-left px-4 py-2 font-medium">Notes</th>
                    <th className="text-left px-4 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(fees || []).length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-gray-400"
                      >
                        No fees yet — record a payment to create one
                      </td>
                    </tr>
                  ) : (
                    (fees || []).map((f: any) => {
                      const ft = Array.isArray(f.fee_types)
                        ? f.fee_types[0]
                        : f.fee_types;
                      return (
                        <tr key={f.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <div className="font-medium">
                              {ft?.name || "Fee"}
                            </div>
                            <div className="text-xs text-gray-400">
                              {f.session}
                              {f.term && f.term !== "Monthly"
                                ? ` · ${f.term}`
                                : ""}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right text-green-700">
                            {formatCurrency(Number(f.amount_paid || 0))}
                            <div className="text-xs text-gray-400">
                              of {formatCurrency(Number(f.amount || 0))}
                            </div>
                          </td>
                          <td
                            className={`px-4 py-2 text-right font-semibold ${
                              Number(f.balance || 0) > 0
                                ? "text-red-600"
                                : "text-green-700"
                            }`}
                          >
                            {formatCurrency(Number(f.balance || 0))}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-500">
                            {f.valid_until && (
                              <div>Card until {f.valid_until}</div>
                            )}
                            {f.board_deadline && (
                              <div>Exam DL {f.board_deadline}</div>
                            )}
                            {f.board_registered && (
                              <div className="text-green-700">Board done</div>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <RemoveFeeButton
                              feeId={f.id}
                              feeLabel={`${ft?.name || "Fee"} · ${f.session}${
                                f.term && f.term !== "Monthly"
                                  ? " · " + f.term
                                  : ""
                              }`}
                              amountPaid={Number(f.amount_paid || 0)}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50 flex justify-between items-center">
              <h2 className="font-semibold text-gray-900">Payment history</h2>
              <Link
                href="/receipts"
                className="text-xs text-brand-green font-medium hover:underline"
              >
                All receipts
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Date</th>
                    <th className="text-left px-4 py-2 font-medium">Receipt</th>
                    <th className="text-right px-4 py-2 font-medium">Amount</th>
                    <th className="text-left px-4 py-2 font-medium">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(payments || []).length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-gray-400"
                      >
                        No payments yet
                      </td>
                    </tr>
                  ) : (
                    (payments || []).map((p: any) => (
                      <tr
                        key={p.id}
                        className={`hover:bg-gray-50 ${
                          p.deleted_at ? "opacity-50" : ""
                        }`}
                      >
                        <td className="px-4 py-2">
                          {formatDate(p.payment_date)}
                        </td>
                        <td className="px-4 py-2">
                          <Link
                            href={`/receipts?receipt=${p.receipt_number}`}
                            className="text-brand-green font-medium hover:underline"
                          >
                            {p.receipt_number}
                          </Link>
                          {p.deleted_at && (
                            <span className="ml-1 text-xs text-red-600">
                              voided
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {formatCurrency(Number(p.amount || 0))}
                        </td>
                        <td className="px-4 py-2 capitalize text-gray-600">
                          {p.payment_method}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
