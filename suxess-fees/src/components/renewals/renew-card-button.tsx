"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addMonths, addDaysToDate } from "@/lib/utils";

export function RenewCardButton({
  feeId,
  studentName,
}: {
  feeId: string;
  studentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [months, setMonths] = useState("1");
  const [fromDate, setFromDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const router = useRouter();
  const supabase = createClient();

  const save = async (mode: "months" | "2weeks") => {
    setLoading(true);
    const start = fromDate || new Date().toISOString().slice(0, 10);
    const until =
      mode === "2weeks"
        ? addDaysToDate(start, 14)
        : addMonths(start, Math.max(1, Number(months) || 1));

    const { error } = await supabase
      .from("student_fees")
      .update({
        valid_until: until,
        updated_at: new Date().toISOString(),
      })
      .eq("id", feeId);

    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-white bg-brand-green hover:bg-brand-dark px-2.5 py-1 rounded-md"
      >
        Renew card
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <h2 className="text-lg font-semibold">Renew card</h2>
            <p className="text-sm text-gray-600">
              {studentName} — set a new valid-until date after the parent paid.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">
                Renew from date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Full months (e.g. 1 or 3)
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => save("months")}
                className="w-full bg-brand-green text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {loading ? "Saving…" : `Renew for ${months || 1} month(s)`}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => save("2weeks")}
                className="w-full border border-amber-300 bg-amber-50 text-amber-900 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
              >
                Partial — 2 weeks only
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
