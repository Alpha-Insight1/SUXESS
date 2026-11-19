"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ClipboardCheck, Loader2 } from "lucide-react";

export type ClassRow = {
  class_name: string;
  enrolled: number;
};

type Props = {
  campusId: string;
  campusName: string;
  today: string;
  /** Main (Suxess School) = per-class form; tutorial = single total */
  perClass: boolean;
  classes: ClassRow[];
  existingPresent: number | null;
  existingNotes: string | null;
  existingBreakdown: Record<string, number> | null;
  totalEnrolled: number;
};

export function AttendanceForm({
  campusId,
  campusName,
  today,
  perClass,
  classes,
  existingPresent,
  existingNotes,
  existingBreakdown,
  totalEnrolled,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const initialBreakdown = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of classes) {
      const prev = existingBreakdown?.[c.class_name];
      map[c.class_name] = prev != null ? String(prev) : "";
    }
    return map;
  }, [classes, existingBreakdown]);

  const [present, setPresent] = useState(
    existingPresent != null ? String(existingPresent) : ""
  );
  const [breakdown, setBreakdown] =
    useState<Record<string, string>>(initialBreakdown);
  const [notes, setNotes] = useState(existingNotes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const classTotal = useMemo(() => {
    if (!perClass) return 0;
    return Object.values(breakdown).reduce((sum, v) => {
      const n = parseInt(v, 10);
      return sum + (isNaN(n) || n < 0 ? 0 : n);
    }, 0);
  }, [breakdown, perClass]);

  function setClassCount(className: string, value: string) {
    setBreakdown((prev) => ({ ...prev, [className]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);

    let presentCount = 0;
    let classBreakdown: Record<string, number> | null = null;

    if (perClass) {
      classBreakdown = {};
      for (const c of classes) {
        const raw = breakdown[c.class_name] ?? "";
        if (raw === "") {
          classBreakdown[c.class_name] = 0;
          continue;
        }
        const n = parseInt(raw, 10);
        if (isNaN(n) || n < 0) {
          setError(`Invalid number for ${c.class_name}. Use 0 or more.`);
          return;
        }
        classBreakdown[c.class_name] = n;
        presentCount += n;
      }
      if (classes.length === 0) {
        setError("No classes found for this campus. Add students first.");
        return;
      }
    } else {
      const n = parseInt(present, 10);
      if (isNaN(n) || n < 0) {
        setError("Enter a valid number of students present (0 or more).");
        return;
      }
      presentCount = n;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload: Record<string, unknown> = {
        campus_id: campusId,
        attendance_date: today,
        present_count: presentCount,
        total_enrolled: totalEnrolled > 0 ? totalEnrolled : null,
        notes: notes.trim() || null,
        recorded_by: user?.id || null,
        updated_at: new Date().toISOString(),
        class_breakdown: perClass ? classBreakdown : null,
      };

      const { error: upsertError } = await supabase
        .from("daily_attendance")
        .upsert(payload, { onConflict: "campus_id,attendance_date" });

      if (upsertError) {
        setError(upsertError.message);
        return;
      }
      setOk(true);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-4 max-w-2xl"
    >
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-brand-green/10 text-brand-green">
          <ClipboardCheck className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900">Daily attendance</h2>
          <p className="text-sm text-gray-500">
            {campusName} · {today}
          </p>
          {perClass ? (
            <p className="text-xs text-brand-green mt-1 font-medium">
              Suxess School (Main) — enter present count per class
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-1">
              Tutorial centre — enter total students present today
            </p>
          )}
        </div>
      </div>

      {perClass ? (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Class</th>
                  <th className="text-right px-3 py-2 font-medium">Enrolled</th>
                  <th className="text-right px-3 py-2 font-medium">
                    Present today
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {classes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-3 py-4 text-center text-gray-400"
                    >
                      No active students / classes found.
                    </td>
                  </tr>
                ) : (
                  classes.map((c) => (
                    <tr key={c.class_name}>
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {c.class_name}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">
                        {c.enrolled}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={breakdown[c.class_name] ?? ""}
                          onChange={(e) =>
                            setClassCount(c.class_name, e.target.value)
                          }
                          placeholder="0"
                          className="w-20 sm:w-24 text-right rounded-lg border border-gray-300 px-2 py-1.5 font-semibold focus:ring-2 focus:ring-brand-green focus:border-brand-green"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {classes.length > 0 && (
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td className="px-3 py-2 font-bold text-gray-900">Total</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-600">
                      {totalEnrolled ||
                        classes.reduce((s, c) => s + c.enrolled, 0)}
                    </td>
                    <td className="px-3 py-2 text-right text-lg font-bold text-brand-green">
                      {classTotal}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-xs text-gray-500">
            Leave a class blank or 0 if none were present. Total is saved for the
            director dashboard.
          </p>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Number of students present today
          </label>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={present}
            onChange={(e) => setPresent(e.target.value)}
            placeholder="e.g. 42"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-lg font-semibold focus:ring-2 focus:ring-brand-green focus:border-brand-green"
            required
          />
          {totalEnrolled > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Active students on record: {totalEnrolled}
            </p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. Half-day, exam day, rain…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-green focus:border-brand-green"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {ok && (
        <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
          Attendance saved. Director can see it on the dashboard.
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-brand-green text-white font-semibold hover:bg-brand-dark disabled:opacity-60"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Saving…
          </>
        ) : existingPresent != null ? (
          "Update attendance"
        ) : (
          "Save attendance"
        )}
      </button>
    </form>
  );
}
