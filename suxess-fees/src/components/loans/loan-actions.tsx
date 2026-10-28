"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoanActions({
  loanId,
  status,
  amountRemaining,
  monthlyDeduction,
}: {
  loanId: string;
  status: string;
  amountRemaining: number;
  monthlyDeduction: number;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const applyMonth = async () => {
    if (status !== "active") return;
    if (
      !confirm(
        `Apply this month's deduction of ₦${monthlyDeduction.toLocaleString()}? Remaining will reduce.`
      )
    ) {
      return;
    }
    setLoading(true);
    const next = Math.max(0, amountRemaining - monthlyDeduction);
    const { error } = await supabase
      .from("staff_loans")
      .update({
        amount_remaining: next,
        status: next <= 0 ? "completed" : "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", loanId);
    setLoading(false);
    if (error) alert(error.message);
    else router.refresh();
  };

  const cancel = async () => {
    if (!confirm("Cancel this loan? It will no longer deduct from salary."))
      return;
    setLoading(true);
    const { error } = await supabase
      .from("staff_loans")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", loanId);
    setLoading(false);
    if (error) alert(error.message);
    else router.refresh();
  };

  if (status !== "active") {
    return (
      <span className="text-xs text-gray-400 capitalize">{status}</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={loading}
        onClick={applyMonth}
        className="text-xs px-2 py-1 rounded bg-brand-green text-white hover:bg-brand-dark disabled:opacity-50"
      >
        Apply this month
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={cancel}
        className="text-xs px-2 py-1 rounded border text-gray-600 hover:bg-gray-50 disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
