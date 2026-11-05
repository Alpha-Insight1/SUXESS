"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Pencil, X } from "lucide-react";

const EXAM_OPTIONS = [
  "JAMB / UTME",
  "WAEC",
  "NECO",
  "GCE",
  "Common Entrance",
  "BECE",
  "Post-UTME",
  "Other",
];

type Student = {
  id: string;
  full_name: string;
  class_name: string;
  parent_name?: string | null;
  parent_phone?: string | null;
  parent_email?: string | null;
  exam_preparing_for?: string | null;
  address?: string | null;
  department?: string | null;
  status?: string;
};

export function EditStudentButton({ student }: { student: Student }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const initialExams = (student.exam_preparing_for || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const [selectedExams, setSelectedExams] = useState<string[]>(initialExams);
  const [form, setForm] = useState({
    full_name: student.full_name || "",
    class_name: student.class_name || "",
    parent_name: student.parent_name || "",
    parent_phone: student.parent_phone || "",
    parent_email: student.parent_email || "",
    address: student.address || "",
    department: student.department || "",
    status: student.status || "active",
  });
  const router = useRouter();
  const supabase = createClient();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      alert("Student name is required");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("students")
      .update({
        full_name: form.full_name.trim(),
        class_name: form.class_name.trim() || "—",
        parent_name: form.parent_name || null,
        parent_phone: form.parent_phone || null,
        parent_email: form.parent_email || null,
        address: form.address || null,
        department: form.department || null,
        exam_preparing_for: selectedExams.length
          ? selectedExams.join(", ")
          : null,
        status: form.status,
      })
      .eq("id", student.id);
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-brand-green font-medium hover:underline inline-flex items-center gap-1"
      >
        <Pencil className="w-3.5 h-3.5" />
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">Edit student</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Full name *</label>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Class / level</label>
                <input
                  value={form.class_name}
                  onChange={(e) => setForm({ ...form, class_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. Science, Arts, Commercial"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Parent name</label>
                <input
                  value={form.parent_name}
                  onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Parent phone</label>
                <input
                  value={form.parent_phone}
                  onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Parent email</label>
                <input
                  type="email"
                  value={form.parent_email}
                  onChange={(e) => setForm({ ...form, parent_email: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Exam preparing for
                </label>
                <div className="border rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto">
                  {EXAM_OPTIONS.map((exam) => {
                    const checked = selectedExams.includes(exam);
                    return (
                      <label key={exam} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedExams((prev) =>
                              checked
                                ? prev.filter((x) => x !== exam)
                                : [...prev, exam]
                            )
                          }
                        />
                        {exam}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
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
