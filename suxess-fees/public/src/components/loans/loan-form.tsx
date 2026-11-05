"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, X } from "lucide-react";

type StaffOpt = {
  id: string;
  full_name: string;
  campus_id?: string | null;
  salary?: number | null;
};

export function LoanForm({
  staff,
  lockedCampusId,
}: {
  staff: StaffOpt[];
  lockedCampusId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    staff_id: staff[0]?.id || "",
    principal: "",
    monthly_deduction: "",
    reason: "Loan",
    start_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const router = useRouter();
  const supabase = createClient();

  const selected = staff.find((s) => s.id === form.staff_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const principal = Number(form.principal);
    const monthly = Number(form.monthly_deduction);
    if (!form.staff_id || principal <= 0 || monthly <= 0) {
      alert("Select staff and enter valid loan and monthly deduction amounts.");
      return;
    }
    if (monthly > principal) {
      alert("Monthly deduction cannot be greater than the loan amount.");
      return;
    }
    setLoading(true);
    const st = staff.find((s) => s.id === form.staff_id);
    const { error } = await supabase.from("staff_loans").insert({
      staff_id: form.staff_id,
      campus_id: lockedCampusId || st?.campus_id || null,
      principal,
      monthly_deduction: monthly,
      amount_remaining: principal,
      reason: form.reason.trim() || "Loan",
      start_date: form.start_date,
      status: "active",
      notes: form.notes || null,
    });
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    setOpen(false);
    setForm({
      staff_id: staff[0]?.id || "",
      principal: "",
      monthly_deduction: "",
      reason: "Loan",
      start_date: new Date().toISOString().slice(0, 10),
      notes: "",
    });
    router.refresh();
  };

  if (staff.length === 0) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Add staff first under Staff & Salaries before recording a loan.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-brand-green hover:bg-brand-dark text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
      >
        <Plus className="w-4 h-4" />
        Record loan
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Record staff loan</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Staff *</label>
                <select
                  required
                  value={form.staff_id}
                  onChange={(e) =>
                    setForm({ ...form, staff_id: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                      {s.salary != null
                        ? ` · salary ₦${Number(s.salary).toLocaleString()}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Loan amount (₦) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={form.principal}
                  onChange={(e) =>
                    setForm({ ...form, principal: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Deduct from salary each month (₦) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={form.monthly_deduction}
                  onChange={(e) =>
                    setForm({ ...form, monthly_deduction: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
                {selected && Number(form.monthly_deduction) > Number(selected.salary || 0) && (
                  <p className="text-xs text-amber-700 mt-1">
                    Warning: deduction is higher than listed salary.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Reason (shown on salary)
                </label>
                <input
                  value={form.reason}
                  onChange={(e) =>
                    setForm({ ...form, reason: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Loan"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Start date
                </label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({ ...form, start_date: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-green text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {loading ? "Saving…" : "Save loan"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
