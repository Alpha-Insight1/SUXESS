"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Campus = { id: string; name: string; short_name?: string | null };

export function PrivateLessonForm({
  campuses,
  lockedCampusId,
}: {
  campuses: Campus[];
  lockedCampusId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    parent_name: "",
    parent_phone: "",
    student_name: "",
    amount_paid: "",
    teacher_name: "",
    teacher_amount: "",
    lesson_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    notes: "",
    campus_id: lockedCampusId || campuses[0]?.id || "",
  });
  const router = useRouter();
  const supabase = createClient();

  const paid = Number(form.amount_paid || 0);
  const teacherPay = Number(form.teacher_amount || 0);
  const profit = paid - teacherPay;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.parent_name.trim() || !form.teacher_name.trim()) {
      alert("Parent name and teacher name are required.");
      return;
    }
    if (paid < 0 || teacherPay < 0) {
      alert("Amounts cannot be negative.");
      return;
    }
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("private_lessons").insert({
      parent_name: form.parent_name.trim(),
      parent_phone: form.parent_phone || null,
      student_name: form.student_name || null,
      amount_paid: paid,
      teacher_name: form.teacher_name.trim(),
      teacher_amount: teacherPay,
      lesson_date: form.lesson_date,
      due_date: form.due_date || null,
      notes: form.notes || null,
      campus_id: form.campus_id || null,
      created_by: userData.user?.id || null,
    });
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    setOpen(false);
    setForm({
      parent_name: "",
      parent_phone: "",
      student_name: "",
      amount_paid: "",
      teacher_name: "",
      teacher_amount: "",
      lesson_date: new Date().toISOString().slice(0, 10),
      due_date: "",
      notes: "",
      campus_id: lockedCampusId || campuses[0]?.id || "",
    });
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-brand-dark"
      >
        <Plus className="w-4 h-4" />
        Record private lesson
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">Private lesson</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              {!lockedCampusId && campuses.length > 0 && (
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
                <label className="block text-sm font-medium mb-1">
                  Parent name *
                </label>
                <input
                  required
                  value={form.parent_name}
                  onChange={(e) =>
                    setForm({ ...form, parent_name: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Parent phone
                </label>
                <input
                  value={form.parent_phone}
                  onChange={(e) =>
                    setForm({ ...form, parent_phone: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Student name (optional)
                </label>
                <input
                  value={form.student_name}
                  onChange={(e) =>
                    setForm({ ...form, student_name: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Amount paid *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={form.amount_paid}
                    onChange={(e) =>
                      setForm({ ...form, amount_paid: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={form.lesson_date}
                    onChange={(e) =>
                      setForm({ ...form, lesson_date: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Due date</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) =>
                    setForm({ ...form, due_date: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Teacher *
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
                  Amount to teacher *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={form.teacher_amount}
                  onChange={(e) =>
                    setForm({ ...form, teacher_amount: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-sm">
                School profit:{" "}
                <span className="font-bold text-green-800">
                  {formatCurrency(profit)}
                </span>
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
                {loading ? "Saving…" : "Save"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
