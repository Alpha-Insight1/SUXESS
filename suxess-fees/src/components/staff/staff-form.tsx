"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { X, Plus } from "lucide-react";

type Campus = { id: string; name: string; short_name?: string | null };

export function StaffForm({
  campuses,
  lockedCampusId,
}: {
  campuses: Campus[];
  lockedCampusId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    campus_id: lockedCampusId || campuses[0]?.id || "",
    full_name: "",
    role: "",
    phone: "",
    salary: "",
    start_date: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.campus_id || !form.full_name || !form.salary) return;
    setLoading(true);

    const { error } = await supabase.from("staff").insert({
      campus_id: form.campus_id,
      full_name: form.full_name,
      role: form.role || null,
      phone: form.phone || null,
      salary: Number(form.salary),
      start_date: form.start_date || null,
      notes: form.notes || null,
      status: "active",
    });

    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }

    setOpen(false);
    setForm({
      campus_id: campuses[0]?.id || "",
      full_name: "",
      role: "",
      phone: "",
      salary: "",
      start_date: "",
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
        Add Staff
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Add Staff Member</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Campus *</label>
                <select
                  required
                  value={form.campus_id}
                  onChange={(e) =>
                    setForm({ ...form, campus_id: e.target.value })
                  }
                  disabled={Boolean(lockedCampusId)}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green disabled:bg-gray-100"
                >
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.short_name || c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Full Name *
                </label>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) =>
                    setForm({ ...form, full_name: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <input
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder="e.g. Teacher, Accountant"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Monthly Salary (₦) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1"
                    value={form.salary}
                    onChange={(e) =>
                      setForm({ ...form, salary: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm({ ...form, start_date: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-green hover:bg-brand-dark text-white font-medium py-2.5 rounded-lg transition disabled:opacity-60"
              >
                {loading ? "Saving…" : "Add Staff"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
