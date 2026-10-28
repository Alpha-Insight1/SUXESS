"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, X } from "lucide-react";
import { MoneyInput, parseMoneyInput } from "@/components/ui/money-input";
import { formatCurrency } from "@/lib/utils";

type Student = {
  id: string;
  full_name: string;
  admission_number: string;
  class_name?: string | null;
  campus_id?: string | null;
};

export function GrantScholarshipForm({
  students,
}: {
  students: Student[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState("");
  const [session, setSession] = useState("2025/2026");
  const [term, setTerm] = useState("First Term");
  const [coverage, setCoverage] = useState<"full" | "partial">("full");
  const [amountDisplay, setAmountDisplay] = useState("");
  const [reason, setReason] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students.slice(0, 40);
    return students
      .filter(
        (s) =>
          s.full_name?.toLowerCase().includes(q) ||
          s.admission_number?.toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [search, students]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      alert("Select a student.");
      return;
    }
    setLoading(true);
    const student = students.find((s) => s.id === studentId);
    const { data: userData } = await supabase.auth.getUser();
    const amountPartial =
      coverage === "partial" ? parseMoneyInput(amountDisplay) : 0;

    // School fees already paid for this session/term?
    const { data: feeTypes } = await supabase
      .from("fee_types")
      .select("id, name");
    const schoolIds = (feeTypes || [])
      .filter((ft: any) => {
        const n = String(ft.name || "").toLowerCase();
        return n.includes("school fee") || n === "school fees";
      })
      .map((ft: any) => ft.id);

    let priorPaid = 0;
    if (schoolIds.length > 0) {
      const { data: feeRows } = await supabase
        .from("student_fees")
        .select("amount_paid, balance")
        .eq("student_id", studentId)
        .eq("session", session)
        .eq("term", term)
        .in("fee_type_id", schoolIds);
      priorPaid = (feeRows || []).reduce(
        (s, f) => s + Number(f.amount_paid || 0),
        0
      );
    }

    const subtractAmount =
      coverage === "full"
        ? priorPaid
        : Math.min(amountPartial || 0, priorPaid || amountPartial || 0);

    // If fees already paid → pending approval (director must confirm income reduction)
    const needsApproval = priorPaid > 0;
    const status = needsApproval ? "pending_approval" : "active";

    const { data: scholarship, error } = await supabase
      .from("scholarships")
      .insert({
        student_id: studentId,
        campus_id: student?.campus_id || null,
        session,
        term,
        coverage,
        amount_covered:
          coverage === "partial" ? amountPartial : subtractAmount || 0,
        prior_fees_paid: priorPaid,
        reason: reason.trim() || null,
        status,
        granted_by: userData.user?.id || null,
      })
      .select("id")
      .single();

    if (error) {
      setLoading(false);
      alert(error.message);
      return;
    }

    if (needsApproval && scholarship?.id) {
      await supabase.from("notifications").insert({
        target_role: "admin",
        title: "Scholarship approval needed",
        body: `${student?.full_name || "Student"} already paid ${formatCurrency(priorPaid)} for ${session} · ${term}. Approving will subtract this from school income as a scholarship offset.`,
        link: "/scholarships",
        related_scholarship_id: scholarship.id,
      });
    }

    setLoading(false);
    if (needsApproval) {
      alert(
        `This student already paid ${formatCurrency(priorPaid)} for ${session} · ${term}.\n\nScholarship is pending. Only the director can approve — then that amount is subtracted from school income.`
      );
    } else {
      alert("Scholarship granted and active.");
    }
    setOpen(false);
    setStudentId("");
    setSearch("");
    setReason("");
    setAmountDisplay("");
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800"
      >
        <Plus className="w-4 h-4" />
        Grant scholarship
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">Grant scholarship</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                If this student already paid school fees for the same session and
                term, approval is required. Only the director can approve; the
                paid amount is then subtracted from school income.
              </p>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Student *
                </label>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or admission no…"
                  className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
                />
                <select
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  size={5}
                >
                  <option value="">Select student</option>
                  {filtered.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.admission_number})
                      {s.class_name ? ` · ${s.class_name}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Session *
                  </label>
                  <select
                    value={session}
                    onChange={(e) => setSession(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option>2024/2025</option>
                    <option>2025/2026</option>
                    <option>2026/2027</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Term *</label>
                  <select
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option>First Term</option>
                    <option>Second Term</option>
                    <option>Third Term</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Coverage *
                </label>
                <select
                  value={coverage}
                  onChange={(e) =>
                    setCoverage(e.target.value as "full" | "partial")
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="full">Full school fees</option>
                  <option value="partial">Partial scholarship</option>
                </select>
              </div>
              {coverage === "partial" && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Amount covered (₦)
                  </label>
                  <MoneyInput
                    value={amountDisplay}
                    onValueChange={(d) => setAmountDisplay(d)}
                    placeholder="e.g. 50,000"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. Staff child, academic excellence…"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {loading ? "Saving…" : "Submit scholarship"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
