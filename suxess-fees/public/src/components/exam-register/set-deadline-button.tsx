"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SetDeadlineButton({
  feeId,
  current,
}: {
  feeId: string;
  current?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(current || "");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const save = async () => {
    if (!date) {
      alert("Pick a date");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("student_fees")
      .update({
        board_deadline: date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", feeId);
    setLoading(false);
    if (error) alert(error.message);
    else {
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs text-brand-green font-medium hover:underline"
      >
        {current ? "Edit deadline" : "Set deadline"}
      </button>
      {open && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-2 py-1 text-xs"
          />
          <button
            type="button"
            disabled={loading}
            onClick={save}
            className="text-xs bg-brand-green text-white px-2 py-1 rounded disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
