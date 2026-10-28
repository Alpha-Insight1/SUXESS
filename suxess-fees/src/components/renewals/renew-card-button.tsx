"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addDaysToDate, formatCurrency } from "@/lib/utils";
import {
  formatMoneyInput,
  parseMoneyInput,
  MoneyInput,
} from "@/components/ui/money-input";

type Unit = "days" | "weeks" | "months";

function suggestedAmount(feeAmount: number, qty: number, unit: Unit) {
  if (!feeAmount || feeAmount <= 0 || !qty || qty <= 0) return 0;
  const perDay = feeAmount / 30;
  if (unit === "days") return Math.round(perDay * qty);
  if (unit === "weeks") return Math.round(perDay * 7 * qty);
  return Math.round(feeAmount * qty);
}

function daysFromUnit(qty: number, unit: Unit) {
  const n = Math.max(1, Math.floor(qty) || 1);
  if (unit === "days") return n;
  if (unit === "weeks") return n * 7;
  return n * 30;
}

export function RenewCardButton({
  feeId,
  studentId,
  studentName,
  feeAmount,
  amountPaidSoFar,
}: {
  feeId: string;
  studentId: string;
  studentName: string;
  feeAmount: number;
  amountPaidSoFar: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState<Unit>("days");
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [method, setMethod] = useState("cash");
  const [fromDate, setFromDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const router = useRouter();
  const supabase = createClient();

  // Suggest amount only until the secretary edits it (so ₦1,500 is allowed)
  useEffect(() => {
    if (!open || amountTouched) return;
    const n = Number(qty) || 1;
    const sug = suggestedAmount(feeAmount, n, unit);
    if (sug > 0) setAmount(formatMoneyInput(String(sug)));
    else if (!amount) setAmount("");
  }, [open, qty, unit, feeAmount, amountTouched]); // eslint-disable-line react-hooks/exhaustive-deps

  const openModal = () => {
    setAmountTouched(false);
    setQty("1");
    setUnit("days");
    setFromDate(new Date().toISOString().slice(0, 10));
    setMethod("cash");
    const sug = suggestedAmount(feeAmount, 1, "days");
    setAmount(sug > 0 ? formatMoneyInput(String(sug)) : "");
    setOpen(true);
  };

  const save = async () => {
    const paid = parseMoneyInput(amount);
    if (!paid || paid <= 0) {
      alert("Enter the amount the parent paid (e.g. 1,500).");
      return;
    }
    if (!studentId) {
      alert("Missing student. Open the student profile and try again.");
      return;
    }
    const n = Number(qty) || 1;
    if (n <= 0) {
      alert("Enter how long the card should last.");
      return;
    }
    setLoading(true);
    const start = fromDate || new Date().toISOString().slice(0, 10);
    const days = daysFromUnit(n, unit);
    const until = addDaysToDate(start, days);

    const unitLabel =
      unit === "days" ? "day" : unit === "weeks" ? "week" : "month";
    const note = `Card renewal · ${n} ${unitLabel}${n > 1 ? "s" : ""} · until ${until}`;

    const { error: payErr } = await supabase.from("payments").insert({
      student_id: studentId,
      student_fee_id: feeId,
      amount: paid,
      payment_method: method,
      payment_date: start,
      notes: note,
    });

    if (payErr) {
      setLoading(false);
      alert(payErr.message);
      return;
    }

    const { error } = await supabase
      .from("student_fees")
      .update({
        valid_until: until,
        updated_at: new Date().toISOString(),
      })
      .eq("id", feeId);

    setLoading(false);
    if (error) {
      alert(
        "Payment saved, but card date failed: " +
          error.message +
          ". Check Card Renewals again."
      );
      router.refresh();
      return;
    }
    setOpen(false);
    router.refresh();
  };

  const perDay =
    feeAmount > 0 ? Math.round((feeAmount / 30) * 100) / 100 : 0;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-xs font-semibold text-white bg-brand-green hover:bg-brand-dark px-2.5 py-1 rounded-md"
      >
        Renew + pay
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">Renew card & record payment</h2>
            <p className="text-sm text-gray-600">
              {studentName}
              {feeAmount > 0 && (
                <span className="block text-xs text-gray-500 mt-0.5">
                  Monthly fee {formatCurrency(feeAmount)}
                  {perDay > 0 && (
                    <> · guide ~{formatCurrency(perDay)}/day</>
                  )}
                  <br />
                  Paid so far {formatCurrency(amountPaidSoFar)}
                </span>
              )}
            </p>

            <div>
              <label className="block text-sm font-medium mb-1">
                Card length *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-20 border rounded-lg px-2 py-2 text-sm"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as Unit)}
                  className="flex-1 border rounded-lg px-2 py-2 text-sm"
                >
                  <option value="days">Day(s)</option>
                  <option value="weeks">Week(s)</option>
                  <option value="months">Month(s)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Amount paid now (₦) *
              </label>
              <MoneyInput
                value={amount}
                onValueChange={(display) => {
                  setAmountTouched(true);
                  setAmount(display);
                }}
                required
                placeholder="e.g. 1,500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Type any amount — e.g. <strong>1,500</strong> for one day. The
                suggested figure is only a guide; you can change it.
              </p>
              <button
                type="button"
                className="text-xs text-brand-green font-medium mt-1 hover:underline"
                onClick={() => {
                  setAmountTouched(false);
                  const n = Number(qty) || 1;
                  const sug = suggestedAmount(feeAmount, n, unit);
                  setAmount(sug > 0 ? formatMoneyInput(String(sug)) : "");
                }}
              >
                Reset to suggested amount
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Payment date *
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="cash">Cash</option>
                <option value="transfer">Transfer</option>
                <option value="pos">POS</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                disabled={loading}
                onClick={save}
                className="w-full bg-brand-green text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {loading ? "Saving…" : "Record pay & renew card"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-gray-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
