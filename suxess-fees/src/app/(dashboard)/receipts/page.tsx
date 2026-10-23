import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ReceiptView } from "@/components/receipts/receipt-view";
import { PaymentActions } from "@/components/receipts/payment-actions";
import Link from "next/link";
import { getCurrentProfile, campusFilter } from "@/lib/auth";
import { ExportReceipts } from "@/components/receipts/export-receipts";

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ receipt?: string; show?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const campusId = campusFilter(profile);
  const showVoided = params.show === "voided";

  let query = supabase
    .from("payments")
    .select(
      `*, students!inner(full_name, admission_number, class_name, parent_name, parent_phone, campus_id, campuses(name, short_name)),
       student_fees(session, term, amount, amount_paid, balance, fee_types(name))`
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (showVoided) {
    query = query.not("deleted_at", "is", null);
  } else {
    query = query.is("deleted_at", null);
  }
  if (campusId) {
    query = query.eq("students.campus_id", campusId);
  }

  const { data: payments } = await query;

  const selected = params.receipt
    ? payments?.find((p: any) => p.receipt_number === params.receipt)
    : null;

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Receipts</h1>
          <p className="text-gray-500 mt-1">
            View, print, void, or restore payment receipts
            {profile?.campuses?.short_name
              ? ` · ${profile.campuses.short_name}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <ExportReceipts payments={payments || []} />
          <Link
            href="/receipts"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              !showVoided
                ? "bg-brand-green text-white border-brand-green"
                : "bg-white text-gray-700 border-gray-300"
            }`}
          >
            Active
          </Link>
          <Link
            href="/receipts?show=voided"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              showVoided
                ? "bg-red-600 text-white border-red-600"
                : "bg-white text-gray-700 border-gray-300"
            }`}
          >
            Voided
          </Link>
        </div>
      </div>

      {selected && (
        <div className="mb-6">
          <ReceiptView payment={selected} />
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-6 py-3 font-medium">Receipt No</th>
                <th className="text-left px-6 py-3 font-medium">Student</th>
                <th className="text-left px-6 py-3 font-medium">Amount</th>
                <th className="text-left px-6 py-3 font-medium">Date</th>
                <th className="text-left px-6 py-3 font-medium">Method</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
                <th className="text-left px-6 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments && payments.length > 0 ? (
                payments.map((p: any) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-gray-50 ${
                      p.deleted_at ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-6 py-3 font-medium">{p.receipt_number}</td>
                    <td className="px-6 py-3">
                      {p.students?.full_name}
                      <div className="text-xs text-gray-400">
                        {p.students?.admission_number}
                      </div>
                    </td>
                    <td className="px-6 py-3 font-semibold text-green-700">
                      {formatCurrency(Number(p.amount || 0))}
                    </td>
                    <td className="px-6 py-3">{formatDate(p.payment_date)}</td>
                    <td className="px-6 py-3 capitalize">{p.payment_method}</td>
                    <td className="px-6 py-3">
                      {p.deleted_at ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Voided
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <a
                          href={`/receipts?receipt=${p.receipt_number}${
                            showVoided ? "&show=voided" : ""
                          }`}
                          className="text-brand-green font-medium hover:underline"
                        >
                          View
                        </a>
                        <PaymentActions
                          paymentId={p.id}
                          deletedAt={p.deleted_at}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    {showVoided ? "No voided payments" : "No receipts yet"}
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
