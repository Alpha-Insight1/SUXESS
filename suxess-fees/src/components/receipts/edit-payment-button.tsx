"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Pencil, X } from "lucide-react";

export function EditPaymentButton({
  paymentId,
  studentFeeId,
  amount,
  paymentDate,
  paymentMethod,
  notes,
  deletedAt,
}: {
  paymentId: string;
  studentFeeId?: string | null;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  notes?: string | null;
  deletedAt?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    amount: String(amount),
    payment_date: String(paymentDate || "").slice(0, 10),
    payment_method: paymentMethod || "cash",
    notes: notes || "",
  });
  const router = useRouter();
  const supabase = createClient();

  if (deletedAt) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const newAmount = Number(form.amount);
    if (!newAmount || newAmount <= 0) {
      alert("Amount must be greater than 0");
      return;
    }
    if (!form.payment_date) {
      alert("Payment date is required");
      return;
    }
    if (
      !confirm(
        "Save changes to this payment? Student balance will be updated."
      )
    ) {
      return;
    }
    setLoading(true);
    const delta = newAmount - Number(amount);

    const { error } = await supabase
      .from("payments")
      .update({
        amount: newAmount,
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        notes: form.notes || null,
      })
      .eq("id", paymentId);

    if (error) {
      setLoading(false);
      alert(error.message);
      return;
    }

    // Adjust fee paid total when amount changed (no DB trigger on amount update)
    if (studentFeeId && delta !== 0) {
      const { data: fee } = await supabase
        .from("student_fees")
        .select("amount, amount_paid")
        .eq("id", studentFeeId)
        .maybeSingle();
      if (fee) {
        const nextPaid = Math.max(0, Number(fee.amount_paid || 0) + delta);
        const feeAmt = Number(fee.amount || 0);
        let status = "pending";
        if (nextPaid >= feeAmt && feeAmt > 0) status = "paid";
        else if (nextPaid > 0) status = "partial";
        await supabase
          .from("student_fees")
          .update({
            amount_paid: nextPaid,
            status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", studentFeeId);
      }
    }

    setLoading(false);
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-sm text-brand-green font-medium hover:underline"
      >
        <Pencil className="w-3.5 h-3.5" />
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold">Edit payment</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={save} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Amount paid (₦) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={form.amount}
                  onChange={(e) =>
                    setForm({ ...form, amount: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Payment date *
                </label>
                <input
                  type="date"
                  required
                  value={form.payment_date}
                  onChange={(e) =>
                    setForm({ ...form, payment_date: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Method</label>
                <select
                  value={form.payment_method}
                  onChange={(e) =>
                    setForm({ ...form, payment_method: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="transfer">Transfer</option>
                  <option value="pos">POS</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <input
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <p className="text-xs text-gray-500">
                Changing the amount updates the student&apos;s paid total and
                balance. Card expiry is not auto-recalculated — re-record or
                adjust if needed.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-green text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {loading ? "Saving…" : "Save changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
