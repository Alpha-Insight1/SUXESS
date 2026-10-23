"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, X } from "lucide-react";

type Campus = { id: string; name: string; short_name?: string | null };

export function TeacherPayForm({
  campuses,
  lockedCampusId,
}: {
  campuses: Campus[];
  lockedCampusId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    teacher_name: "",
    period_taught: "",
    amount: "",
    payment_method: "cash",
    payment_date: new Date().toISOString().slice(0, 10),
    campus_id: lockedCampusId || campuses[0]?.id || "",
    notes: "",
  });
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.teacher_name.trim() || !form.period_taught.trim() || amount < 0) {
      alert("Teacher name, period taught, and amount are required.");
      return;
    }
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("teacher_payments").insert({
      teacher_name: form.teacher_name.trim(),
      period_taught: form.period_taught.trim(),
      amount,
      payment_method: form.payment_method,
      payment_date: form.payment_date,
      campus_id: lockedCampusId || form.campus_id,
      notes: form.notes || null,
      recorded_by: userData.user?.id || null,
    });
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    setOpen(false);
    setForm({
      teacher_name: "",
      period_taught: "",
      amount: "",
      payment_method: "cash",
      payment_date: new Date().toISOString().slice(0, 10),
      campus_id: lockedCampusId || campuses[0]?.id || "",
      notes: "",
    });
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-brand-green hover:bg-brand-dark text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
      >
        <Plus className="w-4 h-4" />
        Record teacher pay
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Pay teacher (daily)</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Period taught *
                </label>
                <input
                  required
                  placeholder="e.g. 1st period Maths, Morning session"
                  value={form.period_taught}
                  onChange={(e) =>
                    setForm({ ...form, period_taught: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Amount (₦) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    required
                    value={form.amount}
                    onChange={(e) =>
                      setForm({ ...form, amount: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Payment method *
                  </label>
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
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={form.payment_date}
                  onChange={(e) =>
                    setForm({ ...form, payment_date: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              {!lockedCampusId && (
                <div>
                  <label className="block text-sm font-medium mb-1">Campus</label>
                  <select
                    value={form.campus_id}
                    onChange={(e) =>
                      setForm({ ...form, campus_id: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.short_name || c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                {loading ? "Saving…" : "Save payment"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
