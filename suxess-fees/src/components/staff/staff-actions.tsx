"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function StaffActions({
  staffId,
  status,
  currentSalary,
}: {
  staffId: string;
  status: string;
  currentSalary: number;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const toggleStatus = async () => {
    const next = status === "active" ? "inactive" : "active";
    if (!confirm(`Mark this staff as ${next}?`)) return;
    setLoading(true);
    const { error } = await supabase
      .from("staff")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", staffId);
    setLoading(false);
    if (error) alert(error.message);
    else router.refresh();
  };

  const updateSalary = async () => {
    const input = prompt("New monthly salary (₦)", String(currentSalary));
    if (input === null) return;
    const salary = Number(input);
    if (isNaN(salary) || salary < 0) {
      alert("Enter a valid amount");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("staff")
      .update({ salary, updated_at: new Date().toISOString() })
      .eq("id", staffId);
    setLoading(false);
    if (error) alert(error.message);
    else router.refresh();
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={updateSalary}
        disabled={loading}
        className="text-sm text-brand-green font-medium hover:underline disabled:opacity-50"
      >
        Edit salary
      </button>
      <button
        type="button"
        onClick={toggleStatus}
        disabled={loading}
        className={`text-sm font-medium hover:underline disabled:opacity-50 ${
          status === "active" ? "text-red-600" : "text-green-600"
        }`}
      >
        {status === "active" ? "Deactivate" : "Activate"}
      </button>
    </div>
  );
}
