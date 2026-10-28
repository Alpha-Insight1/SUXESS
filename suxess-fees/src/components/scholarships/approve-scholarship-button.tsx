"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

/**
 * Director only: approve pending scholarship.
 * Subtracts prior fees paid from school income via an expense offset.
 */
export function ApproveScholarshipButton({
  scholarship,
  studentName,
}: {
  scholarship: {
    id: string;
    session: string;
    term: string;
    coverage: string;
    amount_covered?: number | null;
    prior_fees_paid?: number | null;
    campus_id?: string | null;
    student_id: string;
  };
  studentName: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const offset = Number(
    scholarship.prior_fees_paid || scholarship.amount_covered || 0
  );

  const approve = async () => {
    if (
      !confirm(
        `Approve scholarship for ${studentName}?\n\n` +
          `This will subtract ${formatCurrency(offset)} from school income ` +
          `(scholarship offset for ${scholarship.session} · ${scholarship.term}).`
      )
    ) {
      return;
    }
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();

    // Record income reduction as expense so cashflow / monthly stats reflect it
    if (offset > 0) {
      const campusId = scholarship.campus_id;
      let cid = campusId;
      if (!cid) {
        const { data: st } = await supabase
          .from("students")
          .select("campus_id")
          .eq("id", scholarship.student_id)
          .maybeSingle();
        cid = st?.campus_id || null;
      }
      if (cid) {
        const { error: expErr } = await supabase.from("expenses").insert({
          campus_id: cid,
          expense_date: new Date().toISOString().slice(0, 10),
          category: "Scholarship",
          description: `Scholarship offset · ${studentName} · ${scholarship.session} · ${scholarship.term}`,
          amount: offset,
          payment_method: "other",
          notes: `Auto from scholarship approval ${scholarship.id}`,
        });
        if (expErr) {
          setLoading(false);
          alert("Could not record income offset: " + expErr.message);
          return;
        }
      }
    }

    const { error } = await supabase
      .from("scholarships")
      .update({
        status: "active",
        approved_at: new Date().toISOString(),
        approved_by: userData.user?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scholarship.id);

    if (error) {
      setLoading(false);
      alert(error.message);
      return;
    }

    // Mark related notifications read
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("related_scholarship_id", scholarship.id);

    setLoading(false);
    router.refresh();
  };

  const reject = async () => {
    if (!confirm("Cancel this pending scholarship?")) return;
    setLoading(true);
    const { error } = await supabase
      .from("scholarships")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", scholarship.id);
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("related_scholarship_id", scholarship.id);
    setLoading(false);
    if (error) alert(error.message);
    else router.refresh();
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={loading}
        onClick={approve}
        className="text-xs font-semibold px-2.5 py-1 rounded-md bg-brand-green text-white hover:bg-brand-dark disabled:opacity-50"
      >
        Approve (−{formatCurrency(offset)})
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={reject}
        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
