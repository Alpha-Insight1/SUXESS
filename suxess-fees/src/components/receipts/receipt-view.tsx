"use client";

import Image from "next/image";
import { formatCurrency, formatDate } from "@/lib/utils";

type ReceiptPayment = {
  receipt_number?: string;
  payment_date?: string;
  amount?: number;
  payment_method?: string;
  notes?: string | null;
  deleted_at?: string | null;
  students?: {
    full_name?: string;
    admission_number?: string;
    class_name?: string;
    parent_name?: string | null;
    parent_phone?: string | null;
    campuses?: { name?: string; short_name?: string } | null;
  } | null;
  student_fees?: {
    session?: string;
    term?: string;
    amount?: number;
    amount_paid?: number;
    balance?: number;
    fee_types?: { name?: string } | null;
  } | null;
};

export function ReceiptView({ payment }: { payment: ReceiptPayment }) {
  const feeAmount = Number(payment.student_fees?.amount || 0);
  const amountPaidOnFee = Number(payment.student_fees?.amount_paid || 0);
  const balance = Number(payment.student_fees?.balance || 0);
  const thisPayment = Number(payment.amount || 0);
  const pct =
    feeAmount > 0
      ? Math.min(100, Math.round((amountPaidOnFee / feeAmount) * 100))
      : 0;
  const isVoided = Boolean(payment.deleted_at);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 print:shadow-none print:border-0">
      <div className="print:block" id="receipt-print">
        {isVoided && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-2 rounded-lg print:hidden">
            This payment has been voided
          </div>
        )}

        <div className="flex items-center gap-4 mb-6">
          <Image
            src="/logo.png"
            alt="Suxess Schools"
            width={64}
            height={64}
            className="rounded-full"
          />
          <div>
            <h2 className="text-xl font-bold text-brand-green">
              Suxess Schools
            </h2>
            <p className="text-xs text-gray-500">
              {payment.students?.campuses?.name ||
                payment.students?.campuses?.short_name ||
                "Main · Arepo · Ofada Mowe"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Discipline • Disciple
            </p>
          </div>
        </div>

        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-wider text-gray-400">
            Official Receipt
          </p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            {payment.receipt_number}
          </p>
          {isVoided && (
            <p className="text-red-600 text-sm font-semibold mt-1">VOIDED</p>
          )}
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Date</span>
            <span className="font-medium">
              {payment.payment_date ? formatDate(payment.payment_date) : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Student</span>
            <span className="font-medium">{payment.students?.full_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Admission No</span>
            <span>{payment.students?.admission_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Class</span>
            <span>{payment.students?.class_name}</span>
          </div>
          {payment.students?.parent_name && (
            <div className="flex justify-between">
              <span className="text-gray-500">Parent</span>
              <span>{payment.students.parent_name}</span>
            </div>
          )}
          {payment.students?.parent_phone && (
            <div className="flex justify-between">
              <span className="text-gray-500">Parent Phone</span>
              <span>{payment.students.parent_phone}</span>
            </div>
          )}
          {payment.student_fees && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-500">Fee Type</span>
                <span>{payment.student_fees?.fee_types?.name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Session / Term</span>
                <span>
                  {payment.student_fees?.session} · {payment.student_fees?.term}
                </span>
              </div>
            </>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Payment Method</span>
            <span className="capitalize">{payment.payment_method}</span>
          </div>

          <div className="border-t pt-4 mt-4 flex justify-between items-center">
            <span className="text-gray-500 font-medium">Amount Paid</span>
            <span
              className={`text-2xl font-bold ${
                isVoided ? "text-gray-400 line-through" : "text-brand-green"
              }`}
            >
              {formatCurrency(thisPayment)}
            </span>
          </div>

          {/* Partial payment clarity */}
          {payment.student_fees && feeAmount > 0 && !isVoided && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Fee payment progress
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Fee amount</span>
                <span className="font-medium">{formatCurrency(feeAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount paid so far</span>
                <span className="font-medium text-green-700">
                  {formatCurrency(amountPaidOnFee)}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-gray-600 font-medium">
                  Balance remaining
                </span>
                <span
                  className={`font-bold ${
                    balance > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {formatCurrency(balance)}
                  {balance === 0 ? " (Fully paid)" : ""}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
                <div
                  className={`h-full rounded-full ${
                    balance === 0 ? "bg-green-500" : "bg-brand-green"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">{pct}% of fee paid</p>
            </div>
          )}
        </div>

        {payment.notes && (
          <p className="mt-4 text-xs text-gray-400 border-t pt-3">
            Note: {payment.notes}
          </p>
        )}

        <div className="mt-8 pt-4 border-t text-center text-xs text-gray-400">
          <p>Thank you for your payment.</p>
          <p className="mt-1">Suxess Schools • Arepo • Ofada Mowe</p>
        </div>
      </div>

      <div className="mt-4 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="w-full sm:w-auto px-4 py-2 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition"
        >
          Print Receipt
        </button>
      </div>
    </div>
  );
}
