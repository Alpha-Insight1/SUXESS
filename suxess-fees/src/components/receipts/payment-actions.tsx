"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PaymentActions({
  paymentId,
  deletedAt,
}: {
  paymentId: string;
  deletedAt?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const isVoided = Boolean(deletedAt);

  const handleVoid = async () => {
    if (
      !confirm(
        "Void this payment? The amount will be removed from the student’s paid total and the outstanding balance will increase."
      )
    ) {
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("payments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", paymentId);
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  };

  const handleRestore = async () => {
    if (
      !confirm(
        "Restore this payment? The amount will be added back to the student’s paid total."
      )
    ) {
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("payments")
      .update({ deleted_at: null })
      .eq("id", paymentId);
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  };

  if (isVoided) {
    return (
      <button
        type="button"
        onClick={handleRestore}
        disabled={loading}
        className="text-sm text-brand-green font-medium hover:underline disabled:opacity-50"
      >
        {loading ? "…" : "Restore"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleVoid}
      disabled={loading}
      className="text-sm text-red-600 font-medium hover:underline disabled:opacity-50"
    >
      {loading ? "…" : "Void"}
    </button>
  );
}
