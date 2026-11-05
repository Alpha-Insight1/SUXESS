"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export function EndScholarshipButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const end = async () => {
    if (!confirm("End this scholarship?")) return;
    setLoading(true);
    const { error } = await supabase
      .from("scholarships")
      .update({ status: "ended", updated_at: new Date().toISOString() })
      .eq("id", id);
    setLoading(false);
    if (error) alert(error.message);
    else router.refresh();
  };

  return (
    <button
      type="button"
      disabled={loading}
      onClick={end}
      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
    >
      End
    </button>
  );
}
