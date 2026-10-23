"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check } from "lucide-react";

export function MarkRegisteredButton({
  feeId,
  registered,
}: {
  feeId: string;
  registered: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const markRegistered = async () => {
    if (registered) return;
    if (
      !confirm(
        "Confirm this student has been registered on the exam board (JAMB/WAEC/etc.)?"
      )
    ) {
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("student_fees")
      .update({
        board_registered: true,
        board_registered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", feeId);
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  };

  const undo = async () => {
    if (!confirm("Mark as not yet registered on the board?")) return;
    setLoading(true);
    const { error } = await supabase
      .from("student_fees")
      .update({
        board_registered: false,
        board_registered_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", feeId);
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  };

  if (registered) {
    return (
      <button
        type="button"
        onClick={undo}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 transition disabled:opacity-60"
        title="Click to undo"
      >
        <Check className="w-3.5 h-3.5" />
        Board registered
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={markRegistered}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-green text-white hover:bg-brand-dark transition disabled:opacity-60"
    >
      {loading ? "Saving…" : "Mark board registered"}
    </button>
  );
}
