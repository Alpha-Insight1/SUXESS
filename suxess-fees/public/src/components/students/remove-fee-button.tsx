"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog, MessageDialog } from "@/components/ui/confirm-dialog";
import { formatCurrency } from "@/lib/utils";

export function RemoveFeeButton({
  feeId,
  feeLabel,
  amountPaid,
}: {
  feeId: string;
  feeLabel: string;
  amountPaid: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const remove = async () => {
    setLoading(true);

    const { data: pays } = await supabase
      .from("payments")
      .select("id, amount, deleted_at")
      .eq("student_fee_id", feeId);

    for (const p of pays || []) {
      if (!p.deleted_at) {
        // Void active payments
        await supabase
          .from("payments")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", p.id);
      }
      // Detach so fee row can be deleted (FK)
      await supabase
        .from("payments")
        .update({ student_fee_id: null })
        .eq("id", p.id);
    }

    const { error } = await supabase
      .from("student_fees")
      .delete()
      .eq("id", feeId);

    setLoading(false);
    setOpen(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-red-600 hover:underline"
      >
        Remove fee
      </button>

      <ConfirmDialog
        open={open}
        title="Remove this fee line?"
        message={
          `${feeLabel}\n\n` +
          (amountPaid > 0
            ? `This fee has ${formatCurrency(amountPaid)} paid. Those payments will be voided (removed from school income) and the fee line deleted.\n\n`
            : `No payments on this line. It will be deleted (e.g. duplicate school fees).\n\n`) +
          `You can record the correct payment afterwards.`
        }
        confirmLabel="Remove fee"
        cancelLabel="Keep"
        variant="danger"
        loading={loading}
        onConfirm={remove}
        onCancel={() => setOpen(false)}
      />
      <MessageDialog
        open={!!errorMsg}
        title="Could not remove fee"
        message={errorMsg || ""}
        onClose={() => setErrorMsg(null)}
      />
    </>
  );
}
