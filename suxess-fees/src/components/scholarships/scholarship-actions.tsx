"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toastSuccess, toastError } from "@/components/ui/toast";

export function EndScholarshipButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const end = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("scholarships")
      .update({ status: "ended", updated_at: new Date().toISOString() })
      .eq("id", id);
    setLoading(false);
    setConfirmOpen(false);
    if (error) toastError(error.message);
    else {
      toastSuccess("Scholarship ended.", "Updated");
      router.refresh();
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={loading}
        onClick={() => setConfirmOpen(true)}
        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
      >
        End
      </button>
      <ConfirmDialog
        open={confirmOpen}
        title="End scholarship?"
        message="This student will no longer be marked as on scholarship for this record."
        confirmLabel="End scholarship"
        variant="danger"
        loading={loading}
        onConfirm={end}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
