"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, addOneMonth, addDaysToDate, isTutorialCampusName } from "@/lib/utils";
import { SmsReceiptButton } from "@/components/receipts/sms-receipt-button";

type StudentOption = {
  id: string;
  full_name: string;
  admission_number: string;
  class_name: string;
  parent_name?: string | null;
  parent_phone?: string | null;
  parent_email?: string | null;
  campuses?:
    | { short_name?: string | null; name?: string | null }
    | { short_name?: string | null; name?: string | null }[]
    | null;
};

type FeeType = { id: string; name: string };

type OutstandingFee = {
  id: string;
  amount?: number;
  amount_paid?: number;
  balance?: number;
  session?: string;
  term?: string;
  fee_type_id?: string;
  fee_types?: { name?: string } | null;
};

type PaymentSummary = {
  receipt_number: string;
  student_name: string;
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  fee_type: string;
  fee_amount: number;
  amount_paid: number;
  amount_paid_before: number;
  session: string;
  term: string;
  outstanding_balance: number;
  payment_method: string;
};

function getCampusName(
  campuses:
    | { short_name?: string | null; name?: string | null }
    | { short_name?: string | null; name?: string | null }[]
    | null
    | undefined
) {
  if (!campuses) return "";
  if (Array.isArray(campuses)) {
    return campuses[0]?.short_name ? ` • ${campuses[0].short_name}` : "";
  }
  return campuses.short_name ? ` • ${campuses.short_name}` : "";
}

function campusSearchText(campuses: StudentOption["campuses"]): string {
  if (!campuses) return "";
  const c = Array.isArray(campuses) ? campuses[0] : campuses;
  if (!c) return "";
  return `${c.short_name || ""} ${c.name || ""}`.trim();
}

function isStudentTutorial(campuses: StudentOption["campuses"]): boolean {
  const s = campusSearchText(campuses).toLowerCase();
  return s.includes("arepo") || s.includes("ofada") || s.includes("mowe");
}

/** JAMB/WAEC/NECO etc. — tracked on Exam Register, not Card Renewals */
function isExamRegistrationFeeName(name?: string | null): boolean {
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


function PaymentBreakdown({
  feeAmount,
  amountPaidSoFar,
  balance,
  label,
}: {
  feeAmount: number;
  amountPaidSoFar: number;
  balance: number;
  label?: string;
}) {
  const pct =
    feeAmount > 0
      ? Math.min(100, Math.round((amountPaidSoFar / feeAmount) * 100))
      : 0;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm space-y-3">
      {label && (
        <p className="font-medium text-amber-900 text-xs uppercase tracking-wide">
          {label}
        </p>
      )}
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-gray-600">Fee amount</span>
          <span className="font-medium">{formatCurrency(feeAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Amount paid so far</span>
          <span className="font-medium text-green-700">
            {formatCurrency(amountPaidSoFar)}
          </span>
        </div>
        <div className="flex justify-between border-t border-amber-200 pt-1.5">
          <span className="text-amber-900 font-medium">Balance remaining</span>
          <span
            className={`font-bold ${
              balance > 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            {formatCurrency(balance)}
            {balance === 0 ? " · Fully paid" : ""}
          </span>
        </div>
      </div>
      <div>
        <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              balance === 0 ? "bg-green-500" : "bg-brand-green"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">{pct}% paid</p>
      </div>
    </div>
  );
}

export function RecordPaymentForm({
  students,
  feeTypes,
  preselectedStudentId,
  outstandingFees: initialOutstanding,
}: {
  students: StudentOption[];
  feeTypes: FeeType[];
  preselectedStudentId?: string;
  outstandingFees: OutstandingFee[];
}) {
  const [studentId, setStudentId] = useState(preselectedStudentId || "");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentFeeId, setStudentFeeId] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [session, setSession] = useState("2025/2026");
  const [term, setTerm] = useState("First Term");
  const [feeTypeId, setFeeTypeId] = useState("");
  const [createNewFee, setCreateNewFee] = useState(false);
  const [outstandingFees, setOutstandingFees] =
    useState<OutstandingFee[]>(initialOutstanding);
  const [loadingFees, setLoadingFees] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.admission_number.toLowerCase().includes(q) ||
        (s.parent_phone || "").toLowerCase().includes(q) ||
        (s.parent_name || "").toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const selectedStudent = students.find((s) => s.id === studentId);
  const isTutorialStudent = isStudentTutorial(selectedStudent?.campuses);

  const displayFeeTypes = (() => {
    const examHints = ["jamb", "waec", "neco", "ssce", "gce", "nabteb", "exam"];
    const isExam = (n: string) =>
      examHints.some((h) => n.toLowerCase().includes(h));
    const list = [...feeTypes];
    if (!isTutorialStudent) return list;
    return list.sort((a, b) => {
      const ae = isExam(a.name) ? 0 : 1;
      const be = isExam(b.name) ? 0 : 1;
      if (ae !== be) return ae - be;
      return a.name.localeCompare(b.name);
    });
  })();

  const selectedFee = outstandingFees.find((f) => f.id === studentFeeId);
  const selectedFeeTypeName =
    feeTypes.find((ft) => ft.id === feeTypeId)?.name ||
    selectedFee?.fee_types?.name ||
    "—";

  useEffect(() => {
    if (!studentId) {
      setOutstandingFees([]);
      setStudentFeeId("");
      setCreateNewFee(false);
      return;
    }

    if (studentId === preselectedStudentId && initialOutstanding.length > 0) {
      setOutstandingFees(initialOutstanding);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingFees(true);
      const { data } = await supabase
        .from("student_fees")
        .select("*, fee_types(name)")
        .eq("student_id", studentId)
        .gt("balance", 0);
      if (!cancelled) {
        setOutstandingFees((data as OutstandingFee[]) || []);
        setStudentFeeId("");
        setCreateNewFee(false);
        setLoadingFees(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedFee) {
      setFeeAmount(String(selectedFee.amount ?? ""));
      setSession(selectedFee.session || "2025/2026");
      setTerm(selectedFee.term || "First Term");
      setFeeTypeId(selectedFee.fee_type_id || "");
    }
  }, [selectedFee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !amountPaid) return;

    const paid = Number(amountPaid);
    if (paid <= 0) {
      alert("Amount paid must be greater than 0");
      return;
    }

    setLoading(true);
    setSummary(null);

    let feeId = studentFeeId;
    let feeTotal = selectedFee ? Number(selectedFee.amount || 0) : 0;
    let previousPaid = selectedFee ? Number(selectedFee.amount_paid || 0) : 0;
    let feeTypeName = selectedFee?.fee_types?.name || "";
    const tutorial = isStudentTutorial(selectedStudent?.campuses);
    let feeSession = selectedFee?.session || session;
    let feeTerm = selectedFee?.term || (tutorial ? "Monthly" : term);

    if (createNewFee || (!studentFeeId && feeTypeId)) {
      const totalOwed = Number(feeAmount);
      if (!feeTypeId || !totalOwed || totalOwed <= 0) {
        alert("Please select a fee type and enter the fee amount (total owed).");
        setLoading(false);
        return;
      }

      const { data: newFee, error: feeError } = await supabase
        .from("student_fees")
        .insert({
          student_id: studentId,
          fee_type_id: feeTypeId,
          session: feeSession,
          term: tutorial ? "Monthly" : feeTerm,
          amount: totalOwed,
          amount_paid: 0,
        })
        .select("*, fee_types(name)")
        .single();

      if (feeError) {
        alert(feeError.message);
        setLoading(false);
        return;
      }

      feeId = newFee.id;
      feeTotal = totalOwed;
      previousPaid = 0;
      feeTypeName =
        newFee.fee_types?.name ||
        feeTypes.find((f) => f.id === feeTypeId)?.name ||
        "";
      feeSession = session;
      feeTerm = tutorial ? "Monthly" : term;
    }

    if (!feeId) {
      alert(
        "Please select an outstanding fee or create a new fee for this student."
      );
      setLoading(false);
      return;
    }

    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        student_id: studentId,
        student_fee_id: feeId,
        amount: paid,
        payment_method: method,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    // Tutorial tuition only (not JAMB/WAEC/NECO exam fees):
    // Full payment → 1 month card; partial → 2 weeks. Exam fees go to Exam Register.
    const fullCampus = campusSearchText(selectedStudent?.campuses);
    const feeNameForCard =
      feeTypeName ||
      selectedFeeTypeName ||
      feeTypes.find((f) => f.id === feeTypeId)?.name ||
      "";
    if (
      isTutorialCampusName(fullCampus) &&
      feeId &&
      !isExamRegistrationFeeName(feeNameForCard)
    ) {
      const payDate =
        (payment as any).payment_date ||
        new Date().toISOString().slice(0, 10);
      const totalAfter = previousPaid + paid;
      const fullyPaid = feeTotal > 0 && totalAfter >= feeTotal;
      const until = fullyPaid
        ? addOneMonth(String(payDate).slice(0, 10))
        : addDaysToDate(String(payDate).slice(0, 10), 14);
      await supabase
        .from("student_fees")
        .update({ valid_until: until, updated_at: new Date().toISOString() })
        .eq("id", feeId);
    }

    const outstandingAfter = Math.max(0, feeTotal - (previousPaid + paid));

    setSummary({
      receipt_number: payment.receipt_number,
      student_name: selectedStudent?.full_name || "—",
      parent_name: selectedStudent?.parent_name || "—",
      parent_phone: selectedStudent?.parent_phone || "—",
      parent_email: selectedStudent?.parent_email || "",
      fee_type: feeTypeName || selectedFeeTypeName,
      fee_amount: feeTotal,
      amount_paid: paid,
      amount_paid_before: previousPaid,
      session: feeSession,
      term: feeTerm,
      outstanding_balance: outstandingAfter,
      payment_method: method,
    });

    setAmountPaid("");
    setFeeAmount("");
    setNotes("");
    setStudentFeeId("");
    setCreateNewFee(false);
    setLoading(false);
    router.refresh();
  };

  const showNewFeeFields =
    createNewFee || (studentId && outstandingFees.length === 0 && !loadingFees);

  return (
    <div className="space-y-6 max-w-2xl">
      {summary && (
        <div className="bg-white rounded-xl border border-green-200 shadow-sm overflow-hidden">
          <div className="bg-green-50 border-b border-green-200 px-6 py-4">
            <p className="text-green-800 font-semibold">
              Payment recorded successfully
            </p>
            <p className="text-sm text-green-700 mt-0.5">
              Receipt No: <strong>{summary.receipt_number}</strong>
            </p>
          </div>
          <div className="p-6 space-y-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Payment Record
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Student Name</dt>
                <dd className="font-medium text-gray-900">
                  {summary.student_name}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Parent Name</dt>
                <dd className="font-medium text-gray-900">
                  {summary.parent_name}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Parent Phone</dt>
                <dd className="font-medium text-gray-900">
                  {summary.parent_phone}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Fee Type</dt>
                <dd className="font-medium text-gray-900">{summary.fee_type}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Session</dt>
                <dd className="font-medium text-gray-900">{summary.session}</dd>
              </div>
              {summary.term && summary.term !== "Monthly" && (
              <div>
                <dt className="text-gray-500">Term</dt>
                <dd className="font-medium text-gray-900">{summary.term}</dd>
              </div>
              )}
            </dl>

            <PaymentBreakdown
              label="Partial payment summary"
              feeAmount={summary.fee_amount}
              amountPaidSoFar={
                summary.amount_paid_before + summary.amount_paid
              }
              balance={summary.outstanding_balance}
            />
            <p className="text-sm text-gray-600">
              This payment:{" "}
              <strong className="text-brand-green">
                {formatCurrency(summary.amount_paid)}
              </strong>
            </p>

            

            <SmsReceiptButton
              parentPhone={summary.parent_phone}
              studentName={summary.student_name}
              parentName={summary.parent_name}
              receiptNumber={summary.receipt_number}
              amountPaid={summary.amount_paid}
              feeType={summary.fee_type}
              feeAmount={summary.fee_amount}
              outstandingBalance={summary.outstanding_balance}
              session={summary.session}
              term={summary.term}
            />

            <div className="flex flex-wrap gap-3">
              <a
                href={`/receipts?receipt=${summary.receipt_number}`}
                className="inline-flex items-center px-4 py-2 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition"
              >
                View / Print Receipt
              </a>
              <button
                type="button"
                onClick={() => setSummary(null)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Record another payment
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Student *</label>
            <input
              type="search"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Type to filter by name, admission no, or parent phone…"
              className="w-full border rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-brand-green"
            />
            <select
              required
              value={studentId}
              onChange={(e) => {
                setStudentId(e.target.value);
                setStudentFeeId("");
                setCreateNewFee(false);
                setSummary(null);
              }}
              className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-green"
              size={Math.min(6, Math.max(3, filteredStudents.length + 1))}
            >
              <option value="">Select student</option>
              {filteredStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.admission_number}) — {s.class_name}
                  {getCampusName(s.campuses)}
                  {s.parent_phone ? ` · ${s.parent_phone}` : ""}
                </option>
              ))}
            </select>
            {studentSearch && (
              <p className="text-xs text-gray-500 mt-1">
                Showing {filteredStudents.length} of {students.length} students
              </p>
            )}
            {selectedStudent && (
              <p className="mt-1.5 text-xs text-gray-500">
                Parent: {selectedStudent.parent_name || "—"}
                {selectedStudent.parent_phone
                  ? ` · ${selectedStudent.parent_phone}`
                  : ""}
              </p>
            )}
          </div>

          {studentId && loadingFees && (
            <p className="text-sm text-gray-500">Loading outstanding fees…</p>
          )}

          {studentId && outstandingFees.length > 0 && !createNewFee && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Apply to Outstanding Fee *
              </label>
              <select
                value={studentFeeId}
                onChange={(e) => setStudentFeeId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-green"
              >
                <option value="">Select outstanding fee</option>
                {outstandingFees.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.fee_types?.name} — {f.term} {f.session} (Balance:{" "}
                    {formatCurrency(Number(f.balance || 0))})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setCreateNewFee(true);
                  setStudentFeeId("");
                  setFeeAmount("");
                }}
                className="text-sm text-brand-green mt-2 hover:underline"
              >
                + Create new fee instead
              </button>
            </div>
          )}

          {showNewFeeFields && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  New fee details
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Fee Type *
                </label>
                <select
                  required={showNewFeeFields}
                  value={feeTypeId}
                  onChange={(e) => setFeeTypeId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
                >
                  <option value="">Select fee type</option>
                  {displayFeeTypes.map((ft) => (
                    <option key={ft.id} value={ft.id}>
                      {ft.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Fee Amount (₦) *
                </label>
                <input
                  type="number"
                  required={showNewFeeFields}
                  min="1"
                  step="1"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  placeholder="Total amount for this fee"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Full amount the student is expected to pay
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Session *
                </label>
                <input
                  required={showNewFeeFields}
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  placeholder="e.g. 2025/2026"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
                />
              </div>
              {!isTutorialStudent && (
                  <div>
                <label className="block text-sm font-medium mb-1">Term *</label>
                <select
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
                >
                  <option>First Term</option>
                  <option>Second Term</option>
                  <option>Third Term</option>
                </select>
              </div>
                  )}
              {createNewFee && outstandingFees.length > 0 && (
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => setCreateNewFee(false)}
                    className="text-sm text-gray-500 hover:underline"
                  >
                    ← Back to outstanding fees
                  </button>
                </div>
              )}
            </div>
          )}

          {selectedFee && !createNewFee && (
            <PaymentBreakdown
              label="Current fee status"
              feeAmount={Number(selectedFee.amount || 0)}
              amountPaidSoFar={Number(selectedFee.amount_paid || 0)}
              balance={Number(selectedFee.balance || 0)}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Amount Paying Now (₦) *
              </label>
              <input
                type="number"
                required
                min="1"
                step="1"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="How much is being paid"
                className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-green"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Payment Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-green"
              >
                <option value="cash">Cash</option>
                <option value="transfer">Transfer</option>
                <option value="pos">POS</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
              placeholder="Optional note"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-green hover:bg-brand-dark text-white font-medium py-2.5 rounded-lg transition disabled:opacity-60"
          >
            {loading ? "Recording…" : "Record Payment"}
          </button>
        </form>
      </div>
    </div>
  );
}
