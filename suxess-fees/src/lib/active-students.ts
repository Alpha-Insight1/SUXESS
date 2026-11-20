/**
 * Shared rules for "who counts as an active student".
 *
 * - Main school: a student who has paid School Fees / Tuition at least once
 *   (unchanged — handled where it is used).
 * - Tutorial centres (Arepo, Ofada Mowe): a student is ACTIVE only while their
 *   membership card is still valid, i.e. latest card `valid_until` >= today.
 *   Exam registration fees never count as a card.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Today's date (YYYY-MM-DD) in the school's timezone (Lagos), not UTC. */
export function lagosToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
}

export function isTutorialCampusLabel(
  short?: string | null,
  name?: string | null
): boolean {
  const L = `${short || ""} ${name || ""}`.toLowerCase();
  return (
    L.includes("arepo") ||
    L.includes("ofada") ||
    L.includes("mowe") ||
    L.includes("tutorial")
  );
}

export function isExamFeeName(name?: string | null): boolean {
  const n = String(name || "").toLowerCase();
  return (
    n.includes("jamb") ||
    n.includes("waec") ||
    n.includes("ssce") ||
    n.includes("neco") ||
    n.includes("gce") ||
    n.includes("bece") ||
    n.includes("nabteb") ||
    (n.includes("exam") &&
      (n.includes("regist") || n.includes("form") || n.includes("pin")))
  );
}

export type ActiveCardStudent = {
  student_id: string;
  campus_id: string | null;
  /** Latest card expiry date for this student (YYYY-MM-DD) */
  valid_until: string;
};

/**
 * Students (status = active) whose card is still valid today or later.
 * Pages through results so more than 1,000 rows never get silently cut off.
 * Optionally limited to one campus.
 */
export async function fetchActiveCardStudents(
  supabase: SupabaseClient,
  today: string,
  campusId?: string | null
): Promise<Map<string, ActiveCardStudent>> {
  const result = new Map<string, ActiveCardStudent>();
  const pageSize = 1000;

  for (let from = 0; from < 50000; from += pageSize) {
    let q = supabase
      .from("student_fees")
      .select(
        "id, student_id, valid_until, fee_types(name), students!inner(id, campus_id, status)"
      )
      .not("valid_until", "is", null)
      .gte("valid_until", today)
      .eq("students.status", "active")
      .order("id")
      .range(from, from + pageSize - 1);
    if (campusId) q = q.eq("students.campus_id", campusId);

    const { data, error } = await q;
    if (error || !data) break;

    for (const r of data as any[]) {
      const ft = Array.isArray(r.fee_types) ? r.fee_types[0] : r.fee_types;
      if (isExamFeeName(ft?.name)) continue;
      const st = Array.isArray(r.students) ? r.students[0] : r.students;
      const sid = String(r.student_id || st?.id || "");
      if (!sid) continue;
      const prev = result.get(sid);
      const vu = String(r.valid_until).slice(0, 10);
      if (!prev || vu > prev.valid_until) {
        result.set(sid, {
          student_id: sid,
          campus_id: st?.campus_id ?? null,
          valid_until: vu,
        });
      }
    }
    if (data.length < pageSize) break;
  }
  return result;
}
