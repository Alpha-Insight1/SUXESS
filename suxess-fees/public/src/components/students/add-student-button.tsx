"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { MessageDialog } from "@/components/ui/confirm-dialog";

type CampusOption = {
  id: string;
  name: string;
  short_name?: string | null;
};

type ExistingStudent = {
  id: string;
  full_name: string;
  admission_number: string;
  class_name?: string | null;
  campus_id?: string | null;
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

const SCHOOL_CLASSES = [
  "Nursery 1",
  "Nursery 2",
  "KG 1",
  "KG 2",
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
  "JSS 1",
  "JSS 2",
  "JSS 3",
  "SS 1",
  "SS 2",
  "SS 3",
];

function isTutorialCampus(c?: CampusOption | null) {
  if (!c) return false;
  const s = `${c.short_name || ""} ${c.name || ""}`.toLowerCase();
  return s.includes("arepo") || s.includes("ofada") || s.includes("mowe");
}

export function AddStudentButton({ campuses }: { campuses: CampusOption[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [existing, setExisting] = useState<ExistingStudent[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [classMode, setClassMode] = useState<"pick" | "type">("pick");
  const defaultCampusId = campuses[0]?.id || "";
  const [form, setForm] = useState({
    campus_id: defaultCampusId,
    full_name: "",
    class_name: "",
    parent_name: "",
    parent_phone: "",
    parent_email: "",
    exam_preparing_for: "",
    address: "",
    department: "",
  });
  const router = useRouter();
  const supabase = createClient();

  const selectedCampus = campuses.find((c) => c.id === form.campus_id);
  const showExam = isTutorialCampus(selectedCampus);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("students")
        .select("id, full_name, admission_number, class_name, campus_id")
        .order("full_name")
        .limit(2000);
      setExisting((data as ExistingStudent[]) || []);
    })();
  }, [open, supabase]);

  const nameMatches = useMemo(() => {
    const q = form.full_name.trim().toLowerCase();
    if (q.length < 2) return [];
    return existing
      .filter((s) => s.full_name?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [form.full_name, existing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.campus_id || !form.full_name.trim()) {
      alert("Campus and student name are required.");
      return;
    }
    setLoading(true);

    // Auto admission number per campus (e.g. SUXESSAR-027)
    const campus = campuses.find((c) => c.id === form.campus_id);
    const prefix = (
      campus?.short_name ||
      campus?.name?.replace(/\s+/g, "").slice(0, 8) ||
      "SUXESS"
    )
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 12);

    const { data: existingNums } = await supabase
      .from("students")
      .select("admission_number")
      .eq("campus_id", form.campus_id)
      .ilike("admission_number", `${prefix}-%`);

    let maxN = 0;
    for (const row of existingNums || []) {
      const m = String(row.admission_number || "").match(/-(\d+)$/);
      if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
    }
    const admission_number = `${prefix}-${String(maxN + 1).padStart(3, "0")}`;

    const payload: any = {
      campus_id: form.campus_id,
      admission_number,
      full_name: form.full_name.trim(),
      class_name: form.class_name || (showExam ? "Tutorial" : "—"),
      parent_name: form.parent_name || null,
      parent_phone: form.parent_phone || null,
      parent_email: form.parent_email || null,
      exam_preparing_for: showExam
        ? selectedExams.length
          ? selectedExams.join(", ")
          : null
        : null,
      address: form.address || null,
      department: form.department || null,
      status: "active",
    };

    const { error } = await supabase.from("students").insert(payload);
    setLoading(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setForm({
      campus_id: defaultCampusId,
      full_name: "",
      class_name: "",
      parent_name: "",
      parent_phone: "",
      parent_email: "",
      exam_preparing_for: "",
      address: "",
      department: "",
    });
    setSelectedExams([]);
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition"
      >
        <Plus className="w-4 h-4" />
        Add student
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">Register student</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                  placeholder="Student full name"
                  autoComplete="off"
                />
                {nameMatches.length > 0 && (
                  <div className="mt-2 border border-amber-200 bg-amber-50 rounded-lg p-2 text-sm">
                    <p className="text-xs font-medium text-amber-900 mb-1">
                      Similar names already registered — open profile instead
                      of creating a duplicate:
                    </p>
                    <ul className="space-y-1">
                      {nameMatches.map((s) => (
                        <li key={s.id}>
                          <Link
                            href={`/students/${s.id}`}
                            className="text-brand-green font-medium hover:underline"
                            onClick={() => setOpen(false)}
                          >
                            {s.full_name}
                          </Link>
                          <span className="text-gray-500 text-xs ml-1">
                            ({s.admission_number}
                            {s.class_name ? ` · ${s.class_name}` : ""})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {!showExam && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Class *
                  </label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setClassMode("pick")}
                      className={`text-xs px-2 py-1 rounded border ${
                        classMode === "pick"
                          ? "bg-brand-green text-white border-brand-green"
                          : "bg-white text-gray-600"
                      }`}
                    >
                      Pick list
                    </button>
                    <button
                      type="button"
                      onClick={() => setClassMode("type")}
                      className={`text-xs px-2 py-1 rounded border ${
                        classMode === "type"
                          ? "bg-brand-green text-white border-brand-green"
                          : "bg-white text-gray-600"
                      }`}
                    >
                      Type class
                    </button>
                  </div>
                  {classMode === "pick" ? (
                    <select
                      required
                      value={form.class_name}
                      onChange={(e) =>
                        setForm({ ...form, class_name: e.target.value })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Select class…</option>
                      {SCHOOL_CLASSES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required
                      value={form.class_name}
                      onChange={(e) =>
                        setForm({ ...form, class_name: e.target.value })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="e.g. SS2 Science, Creche"
                    />
                  )}
                </div>
              )}

              {showExam && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Exam preparing for (select all that apply)
                  </label>
                  <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                    {EXAM_OPTIONS.map((exam) => {
                      const checked = selectedExams.includes(exam);
                      return (
                        <label
                          key={exam}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedExams((prev) =>
                                checked
                                  ? prev.filter((x) => x !== exam)
                                  : [...prev, exam]
                              );
                            }}
                          />
                          {exam}
                        </label>
                      );
                    })}
                  </div>
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
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              {!showExam && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Department
                  </label>
                  <input
                    value={form.department}
                    onChange={(e) =>
                      setForm({ ...form, department: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. Science, Arts"
                  />
                </div>
              )}

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
      <MessageDialog
        open={!!errorMsg}
        title="Could not register student"
        message={errorMsg || ""}
        onClose={() => setErrorMsg(null)}
      />
    </>
  );
}
