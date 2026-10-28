"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, X, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Campus = { id: string; name: string; short_name?: string | null };
type TeacherRow = { name: string; amount: string };

export function PrivateLessonForm({
  campuses,
  lockedCampusId,
}: {
  campuses: Campus[];
  lockedCampusId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<TeacherRow[]>([
    { name: "", amount: "" },
  ]);
  const [form, setForm] = useState({
    parent_name: "",
    parent_phone: "",
    student_name: "",
    amount_paid: "",
    lesson_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    notes: "",
    campus_id: lockedCampusId || campuses[0]?.id || "",
  });
  const router = useRouter();
  const supabase = createClient();

  const paid = Number(form.amount_paid || 0);
  const teacherTotal = teachers.reduce(
    (s, t) => s + (Number(t.amount) || 0),
    0
  );
  const profit = paid - teacherTotal;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.parent_name.trim()) {
      alert("Parent name is required.");
      return;
    }
    const cleanTeachers = teachers
      .map((t) => ({
        name: t.name.trim(),
        amount: Number(t.amount) || 0,
      }))
      .filter((t) => t.name);
    if (cleanTeachers.length === 0) {
      alert("Add at least one teacher and their pay.");
      return;
    }
    if (paid < 0) {
      alert("Amount paid cannot be negative.");
      return;
    }
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const teacherSum = cleanTeachers.reduce((s, t) => s + t.amount, 0);
    const { error } = await supabase.from("private_lessons").insert({
      parent_name: form.parent_name.trim(),
      parent_phone: form.parent_phone || null,
      student_name: form.student_name || null,
      amount_paid: paid,
      teacher_name: cleanTeachers.map((t) => t.name).join(", "),
      teacher_amount: teacherSum,
      teachers: cleanTeachers,
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
    setTeachers([{ name: "", amount: "" }]);
    setForm({
      parent_name: "",
      parent_phone: "",
      student_name: "",
      amount_paid: "",
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
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
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
                    Amount paid by parent *
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
                <label className="block text-sm font-medium mb-1">
                  Due date (next payment / end)
                </label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) =>
                    setForm({ ...form, due_date: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    Teachers (can add more than one)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setTeachers([...teachers, { name: "", amount: "" }])
                    }
                    className="text-xs text-brand-green font-medium hover:underline"
                  >
                    + Add teacher
                  </button>
                </div>
                {teachers.map((t, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <input
                      required
                      value={t.name}
                      onChange={(e) => {
                        const next = [...teachers];
                        next[i] = { ...next[i], name: e.target.value };
                        setTeachers(next);
                      }}
                      placeholder="Teacher name"
                      className="flex-1 border rounded-lg px-2 py-1.5 text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      required
                      value={t.amount}
                      onChange={(e) => {
                        const next = [...teachers];
                        next[i] = { ...next[i], amount: e.target.value };
                        setTeachers(next);
                      }}
                      placeholder="Pay ₦"
                      className="w-24 border rounded-lg px-2 py-1.5 text-sm"
                    />
                    {teachers.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setTeachers(teachers.filter((_, j) => j !== i))
                        }
                        className="p-1.5 text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <p className="text-xs text-gray-500">
                  Total to teachers: {formatCurrency(teacherTotal)}
                </p>
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
