"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog, MessageDialog } from "@/components/ui/confirm-dialog";

/**
 * Void/restore payment. Updates deleted_at (trigger adjusts amount_paid if present).
 * Also adjusts student_fees client-side as a safety net if the DB trigger is missing.
 */
export function PaymentActions({
  paymentId,
  deletedAt,
  amount,
  studentName,
  studentFeeId,
}: {
  paymentId: string;
  deletedAt?: string | null;
  amount?: number;
  studentName?: string;
  studentFeeId?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const isVoided = Boolean(deletedAt);

  const adjustFee = async (delta: number) => {
    if (!studentFeeId || !delta) return;
    const { data: fee } = await supabase
      .from("student_fees")
      .select("id, amount, amount_paid")
      .eq("id", studentFeeId)
      .maybeSingle();
    if (!fee) return;
    const nextPaid = Math.max(0, Number(fee.amount_paid || 0) + delta);
    const total = Number(fee.amount || 0);
    const status =
      nextPaid >= total && total > 0
        ? "paid"
        : nextPaid > 0
          ? "partial"
          : "pending";
    await supabase
      .from("student_fees")
      .update({
        amount_paid: nextPaid,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", studentFeeId);
  };

  const handleVoid = async () => {
    setLoading(true);
    const amt = Number(amount || 0);

    // Load fee id if not passed
    let feeId = studentFeeId;
    if (!feeId) {
      const { data: pay } = await supabase
        .from("payments")
        .select("student_fee_id, amount")
        .eq("id", paymentId)
        .maybeSingle();
      feeId = pay?.student_fee_id || null;
      if (!amt && pay?.amount) {
        /* use DB amount */
      }
    }

    const { error } = await supabase
      .from("payments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", paymentId);

    if (error) {
      setLoading(false);
      setConfirmVoid(false);
      setErrorMsg(error.message);
      return;
    }

    // Safety net only if trigger did not change amount_paid
    if (feeId) {
      const voidAmt = Number(amt || 0);
      const { data: feeNow } = await supabase
        .from("student_fees")
        .select("amount_paid")
        .eq("id", feeId)
        .maybeSingle();
      // If paid total unchanged after void, apply client adjustment
      // (when trigger is missing). Skip if trigger already ran.
      const paidNow = Number(feeNow?.amount_paid || 0);
      // We can't know before easily after update; compare expected
      // Re-fetch payment amount and check if paid decreased
      if (voidAmt > 0) {
        const { data: feeAgain } = await supabase
          .from("student_fees")
          .select("amount_paid")
          .eq("id", feeId)
          .maybeSingle();
        // If still looks like full amount wasn't reduced, force adjust
        // Heuristic: try adjust; if trigger already ran, we need before snapshot
      }
    }

    // Capture before paid, void already done — use simpler approach:
    // always try adjustFee only when trigger missing by reading payment list sum
    if (feeId && Number(amt || 0) > 0) {
      const { data: activePays } = await supabase
        .from("payments")
        .select("amount")
        .eq("student_fee_id", feeId)
        .is("deleted_at", null);
      const sumPaid = (activePays || []).reduce(
        (s, x) => s + Number(x.amount || 0),
        0
      );
      const { data: feeRow } = await supabase
        .from("student_fees")
        .select("amount, amount_paid")
        .eq("id", feeId)
        .maybeSingle();
      if (feeRow && Math.abs(Number(feeRow.amount_paid || 0) - sumPaid) > 0.5) {
        const total = Number(feeRow.amount || 0);
        const status =
          sumPaid >= total && total > 0
            ? "paid"
            : sumPaid > 0
              ? "partial"
              : "pending";
        await supabase
          .from("student_fees")
          .update({
            amount_paid: sumPaid,
            status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", feeId);
      }
    }

    setLoading(false);
    setConfirmVoid(false);
    router.refresh();
  };

  const handleRestore = async () => {
    setLoading(true);
    let feeId = studentFeeId;
    let restoreAmt = Number(amount || 0);
    const { data: pay } = await supabase
      .from("payments")
      .select("student_fee_id, amount")
      .eq("id", paymentId)
      .maybeSingle();
    if (!feeId) feeId = pay?.student_fee_id || null;
    if (!restoreAmt) restoreAmt = Number(pay?.amount || 0);

    const { error } = await supabase
      .from("payments")
      .update({ deleted_at: null })
      .eq("id", paymentId);

    if (error) {
      setLoading(false);
      setConfirmRestore(false);
      setErrorMsg(error.message);
      return;
    }

    if (feeId) {
      const { data: activePays } = await supabase
        .from("payments")
        .select("amount")
        .eq("student_fee_id", feeId)
        .is("deleted_at", null);
      const sumPaid = (activePays || []).reduce(
        (s, x) => s + Number(x.amount || 0),
        0
      );
      const { data: feeRow } = await supabase
        .from("student_fees")
        .select("amount, amount_paid")
        .eq("id", feeId)
        .maybeSingle();
      if (feeRow && Math.abs(Number(feeRow.amount_paid || 0) - sumPaid) > 0.5) {
        const total = Number(feeRow.amount || 0);
        const status =
          sumPaid >= total && total > 0
            ? "paid"
            : sumPaid > 0
              ? "partial"
              : "pending";
        await supabase
          .from("student_fees")
          .update({
            amount_paid: sumPaid,
            status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", feeId);
      }
    }

    setLoading(false);
    setConfirmRestore(false);
    router.refresh();
  };

  return (
    <>
      {isVoided ? (
        <button
          type="button"
          onClick={() => setConfirmRestore(true)}
          disabled={loading}
          className="text-sm text-brand-green font-medium hover:underline disabled:opacity-50"
        >
          Restore
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmVoid(true)}
          disabled={loading}
          className="text-sm text-red-600 font-medium hover:underline disabled:opacity-50"
        >
          Void
        </button>
      )}

      <ConfirmDialog
        open={confirmVoid}
        title="Void this payment?"
        message={
          `This removes the payment from the student’s paid total and increases the outstanding balance.\n\n` +
          (studentName ? `Student: ${studentName}\n` : "") +
          (amount != null
            ? `Amount: ₦${Number(amount).toLocaleString()}\n\n`
            : "\n") +
          `Use this when school fees were recorded twice by mistake. You can restore it later from the Voided list.`
        }
        confirmLabel="Void payment"
        cancelLabel="Keep payment"
        variant="danger"
        loading={loading}
        onConfirm={handleVoid}
        onCancel={() => setConfirmVoid(false)}
      />

      <ConfirmDialog
        open={confirmRestore}
        title="Restore this payment?"
        message="The amount will be added back to the student’s paid total and the outstanding balance will decrease."
        confirmLabel="Restore payment"
        cancelLabel="Cancel"
        variant="success"
        loading={loading}
        onConfirm={handleRestore}
        onCancel={() => setConfirmRestore(false)}
      />

      <MessageDialog
        open={!!errorMsg}
        title="Something went wrong"
        message={errorMsg || ""}
        onClose={() => setErrorMsg(null)}
      />
    </>
  );
}
