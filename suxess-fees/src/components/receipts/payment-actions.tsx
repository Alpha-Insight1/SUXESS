"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog, MessageDialog } from "@/components/ui/confirm-dialog";

export function PaymentActions({
  paymentId,
  deletedAt,
  amount,
  studentName,
}: {
  paymentId: string;
  deletedAt?: string | null;
  amount?: number;
  studentName?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const isVoided = Boolean(deletedAt);

  const handleVoid = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("payments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", paymentId);
    setLoading(false);
    setConfirmVoid(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    router.refresh();
  };

  const handleRestore = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("payments")
      .update({ deleted_at: null })
      .eq("id", paymentId);
    setLoading(false);
    setConfirmRestore(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
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
          (amount != null ? `Amount: ₦${Number(amount).toLocaleString()}\n\n` : "\n") +
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
