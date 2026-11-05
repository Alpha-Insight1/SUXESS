"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Trash2, X } from "lucide-react";

export function TeacherPayActions({
  row,
}: {
  row: {
    id: string;
    teacher_name: string;
    period_taught: string;
    amount: number;
    payment_method: string;
    payment_date: string;
    notes?: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    teacher_name: row.teacher_name,
    period_taught: row.period_taught,
    amount: String(row.amount),
    payment_method: row.payment_method || "cash",
    payment_date: String(row.payment_date || "").slice(0, 10),
    notes: row.notes || "",
  });
  const router = useRouter();
  const supabase = createClient();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.teacher_name.trim() || !form.period_taught.trim() || amount < 0) {
      alert("Teacher name, period, and amount are required.");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("teacher_payments")
      .update({
        teacher_name: form.teacher_name.trim(),
        period_taught: form.period_taught.trim(),
        amount,
        payment_method: form.payment_method,
        payment_date: form.payment_date,
        notes: form.notes || null,
      })
      .eq("id", row.id);
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    setOpen(false);
    router.refresh();
  };

  const remove = async () => {
    if (
      !confirm(
        `Delete payment for ${row.teacher_name} (${row.amount})? This cannot be undone.`
      )
    ) {
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("teacher_payments")
      .delete()
      .eq("id", row.id);
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-brand-green text-xs font-medium hover:underline inline-flex items-center gap-0.5"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={loading}
          className="text-red-600 text-xs font-medium hover:underline inline-flex items-center gap-0.5 disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold">Edit teacher pay</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Teacher name *
                </label>
                <input
                  required
                  value={form.teacher_name}
                  onChange={(e) =>
                    setForm({ ...form, teacher_name: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Period taught *
                </label>
                <input
                  required
                  value={form.period_taught}
                  onChange={(e) =>
                    setForm({ ...form, period_taught: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. Morning, 8am–12pm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Amount (₦) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={form.amount}
                  onChange={(e) =>
                    setForm({ ...form, amount: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={form.payment_date}
                  onChange={(e) =>
                    setForm({ ...form, payment_date: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Method</label>
                <select
                  value={form.payment_method}
                  onChange={(e) =>
                    setForm({ ...form, payment_method: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="transfer">Transfer</option>
                  <option value="pos">POS</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <input
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-green text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {loading ? "Saving…" : "Save changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
