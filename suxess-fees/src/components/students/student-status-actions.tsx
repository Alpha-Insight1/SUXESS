"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function StudentStatusActions({
  studentId,
  currentStatus,
  studentName,
}: {
  studentId: string;
  currentStatus?: string | null;
  studentName: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const status = currentStatus || "active";

  const setStatus = async (next: string, label: string) => {
    if (
      !confirm(
        `${label} ${studentName}? They will be hidden from the default Active list but their payments and history stay in the system.`
      )
    ) {
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("students")
      .update({ status: next })
      .eq("id", studentId);
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  };

  const reactivate = async () => {
    if (!confirm(`Set ${studentName} back to Active?`)) return;
    setLoading(true);
    const { error } = await supabase
      .from("students")
      .update({ status: "active" })
      .eq("id", studentId);
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-wrap gap-2">
      {status === "active" && (
        <>
          <button
            type="button"
            disabled={loading}
            onClick={() => setStatus("graduated", "Mark as graduated")}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100 disabled:opacity-50"
          >
            Mark graduated
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => setStatus("withdrawn", "Mark as withdrawn")}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            Mark withdrawn
          </button>
        </>
      )}
      {status !== "active" && (
        <button
          type="button"
          disabled={loading}
          onClick={reactivate}
          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-green-200 bg-green-50 text-green-900 hover:bg-green-100 disabled:opacity-50"
        >
          Set active again
        </button>
      )}
    </div>
  );
}
