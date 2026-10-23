"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type CampusOption = {
  id: string;
  name: string;
  short_name?: string | null;
};

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

function isTutorialCampus(c?: CampusOption | null) {
  if (!c) return false;
  const s = `${c.short_name || ""} ${c.name || ""}`.toLowerCase();
  return s.includes("arepo") || s.includes("ofada") || s.includes("mowe");
}

function campusPrefix(c?: CampusOption | null) {
  if (!c) return "STU";
  const raw = (c.short_name || c.name || "STU").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return raw.slice(0, 8) || "STU";
}

/** Next number for this campus: PREFIX-001, PREFIX-002, ... */
async function nextAdmissionNumber(
  supabase: ReturnType<typeof createClient>,
  campusId: string,
  campus: CampusOption | undefined
): Promise<string> {
  const prefix = campusPrefix(campus);
  const { data } = await supabase
    .from("students")
    .select("admission_number")
    .eq("campus_id", campusId)
    .like("admission_number", `${prefix}-%`);

  let max = 0;
  for (const row of data || []) {
    const m = String(row.admission_number || "").match(/-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max + 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
}

export function AddStudentButton({ campuses }: { campuses: CampusOption[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    class_name: "",
    campus_id: campuses[0]?.id || "",
    parent_name: "",
    parent_phone: "",
    parent_email: "",
    exam_preparing_for: "",
  });
  const router = useRouter();
  const supabase = createClient();

  const selectedCampus = useMemo(
    () => campuses.find((c) => c.id === form.campus_id),
    [campuses, form.campus_id]
  );
  const showExam = isTutorialCampus(selectedCampus);
  const previewPrefix = campusPrefix(selectedCampus);

  const reset = () =>
    setForm({
      full_name: "",
      class_name: "",
      campus_id: campuses[0]?.id || "",
      parent_name: "",
      parent_phone: "",
      parent_email: "",
      exam_preparing_for: "",
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.campus_id) {
      alert("Select a campus");
      return;
    }
    setLoading(true);

    let admission_number: string;
    try {
      admission_number = await nextAdmissionNumber(
        supabase,
        form.campus_id,
        selectedCampus
      );
    } catch {
      setLoading(false);
      alert("Could not generate student number. Try again.");
      return;
    }

    const payload: Record<string, unknown> = {
      admission_number,
      full_name: form.full_name,
      class_name: form.class_name || (showExam ? "Tutorial" : "—"),
      campus_id: form.campus_id || null,
      parent_name: form.parent_name || null,
      parent_phone: form.parent_phone || null,
      parent_email: form.parent_email || null,
      exam_preparing_for: showExam ? form.exam_preparing_for || null : null,
    };

    const { error } = await supabase.from("students").insert(payload);

    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }

    setOpen(false);
    reset();
    router.refresh();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-brand-green hover:bg-brand-dark text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
      >
        <Plus className="w-4 h-4" />
        Add student
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Register student</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-900">
                Student number will be assigned automatically:{" "}
                <strong>{previewPrefix}-001</strong>,{" "}
                <strong>{previewPrefix}-002</strong>, … for this branch
              </div>

              {campuses.length > 1 && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Campus *
                  </label>
                  <select
                    required
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
                  Full name *
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

              {!showExam && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Class *
                  </label>
                  <input
                    required
                    value={form.class_name}
                    onChange={(e) =>
                      setForm({ ...form, class_name: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. SS1, Primary 3"
                  />
                </div>
              )}

              {showExam && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Exam preparing for
                  </label>
                  <select
                    value={form.exam_preparing_for}
                    onChange={(e) =>
                      setForm({ ...form, exam_preparing_for: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Select exam…</option>
                    {EXAM_OPTIONS.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Parent name
                </label>
                <input
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
                  Parent email
                </label>
                <input
                  type="email"
                  value={form.parent_email}
                  onChange={(e) =>
                    setForm({ ...form, parent_email: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-green text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {loading ? "Saving…" : "Register student"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
