/**
 * Data tools the admin AI can call against live Supabase data.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function campusLabel(c: any): string {
  if (!c) return "";
  const row = Array.isArray(c) ? c[0] : c;
  return `${row?.short_name || ""} ${row?.name || ""}`.trim();
}

function matchCampus(
  label: string,
  filter?: string | null
): boolean {
  if (!filter || filter === "all") return true;
  const L = label.toLowerCase();
  const f = filter.toLowerCase();
  if (f === "arepo") return L.includes("arepo");
  if (f === "ofada" || f === "mowe" || f === "ofada_mowe")
    return L.includes("ofada") || L.includes("mowe");
  if (f === "main" || f === "school")
    return (
      (L.includes("main") || L.includes("school")) &&
      !L.includes("arepo") &&
      !L.includes("ofada") &&
      !L.includes("mowe") &&
      !L.includes("tutorial")
    );
  if (f === "tutorial")
    return (
      L.includes("arepo") ||
      L.includes("ofada") ||
      L.includes("mowe") ||
      L.includes("tutorial")
    );
  return L.includes(f);
}

function isExamFee(name?: string | null) {
  const n = String(name || "").toLowerCase();
  return (
    n.includes("jamb") ||
    n.includes("waec") ||
    n.includes("neco") ||
    n.includes("gce") ||
    n.includes("bece") ||
    n.includes("nabteb") ||
    (n.includes("exam") &&
      (n.includes("regist") || n.includes("form") || n.includes("pin")))
  );
}

export const AI_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "get_card_renewals",
      description:
        "Card / tutorial membership renewals. Returns how many students have valid cards, due today, expired recently, or older expired — optionally filtered by branch (arepo, ofada, main, tutorial, all).",
      parameters: {
        type: "object",
        properties: {
          campus: {
            type: "string",
            description:
              "Branch filter: arepo | ofada | main | tutorial | all",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_student_counts",
      description:
        "Count active students, optionally by campus and/or class or exam preparing for.",
      parameters: {
        type: "object",
        properties: {
          campus: {
            type: "string",
            description: "arepo | ofada | main | tutorial | all",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_attendance_today",
      description:
        "Today's daily attendance present counts submitted by secretaries for each campus, including class breakdown for Main when available.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_payments_summary",
      description:
        "Fee payments received today and this month (amount and count). Optional campus filter.",
      parameters: {
        type: "object",
        properties: {
          campus: {
            type: "string",
            description: "arepo | ofada | main | tutorial | all",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_outstanding_summary",
      description:
        "Students with outstanding fee balances (mainly school fees). Optional campus filter.",
      parameters: {
        type: "object",
        properties: {
          campus: {
            type: "string",
            description: "arepo | ofada | main | tutorial | all",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_exam_registration",
      description:
        "Exam registration fees: how many paid, pending board registration, overdue deadlines.",
      parameters: {
        type: "object",
        properties: {
          campus: {
            type: "string",
            description: "arepo | ofada | main | tutorial | all",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_campuses",
      description: "List all active campuses/branches with ids and names.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_expenses_summary",
      description: "Expenses total today and this month, optional campus.",
      parameters: {
        type: "object",
        properties: {
          campus: { type: "string" },
        },
      },
    },
  },
];

type ToolArgs = Record<string, unknown>;

export async function runSchoolTool(
  supabase: SupabaseClient,
  name: string,
  args: ToolArgs
): Promise<unknown> {
  const campus = (args.campus as string) || "all";
  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";
  const threeDaysAgo = addDays(today, -3);

  switch (name) {
    case "get_campuses": {
      const { data, error } = await supabase
        .from("campuses")
        .select("id, name, short_name, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) return { error: error.message };
      return { campuses: data || [] };
    }

    case "get_student_counts": {
      const { data, error } = await supabase
        .from("students")
        .select(
          "id, class_name, exam_preparing_for, campus_id, status, campuses(short_name, name)"
        )
        .eq("status", "active");
      if (error) return { error: error.message };
      const rows = (data || []).filter((s: any) =>
        matchCampus(campusLabel(s.campuses), campus)
      );
      const byCampus: Record<string, number> = {};
      const byClass: Record<string, number> = {};
      for (const s of rows as any[]) {
        const cl = campusLabel(s.campuses) || "Unknown";
        byCampus[cl] = (byCampus[cl] || 0) + 1;
        const cn = String(s.class_name || "Unassigned");
        byClass[cn] = (byClass[cn] || 0) + 1;
      }
      return {
        total_active: rows.length,
        filter: campus,
        by_campus: byCampus,
        by_class: byClass,
      };
    }

    case "get_card_renewals": {
      const { data, error } = await supabase
        .from("student_fees")
        .select(
          `id, amount, amount_paid, valid_until, status,
           fee_types(name),
           students!inner(id, full_name, status, campus_id, campuses(short_name, name))`
        )
        .not("valid_until", "is", null)
        .eq("students.status", "active");
      if (error) return { error: error.message };

      // One row per student (latest valid_until), exclude exam fees
      const byStudent = new Map<string, any>();
      for (const r of data || []) {
        const ft = Array.isArray(r.fee_types) ? r.fee_types[0] : r.fee_types;
        if (isExamFee(ft?.name)) continue;
        const st = Array.isArray(r.students) ? r.students[0] : r.students;
        if (!matchCampus(campusLabel(st?.campuses), campus)) continue;
        const sid = st?.id;
        if (!sid) continue;
        const prev = byStudent.get(sid);
        if (!prev || String(r.valid_until) > String(prev.valid_until)) {
          byStudent.set(sid, r);
        }
      }
      const list = Array.from(byStudent.values());

      const stillValid = list.filter(
        (r) => r.valid_until && r.valid_until > today
      );
      const dueToday = list.filter(
        (r) => r.valid_until && r.valid_until === today
      );
      const expiredRecent = list.filter(
        (r) =>
          r.valid_until &&
          r.valid_until < today &&
          r.valid_until >= threeDaysAgo
      );
      const expiredOlder = list.filter(
        (r) => r.valid_until && r.valid_until < threeDaysAgo
      );

      // Branch split for tutorial centres
      function branchOf(r: any) {
        const st = Array.isArray(r.students) ? r.students[0] : r.students;
        return campusLabel(st?.campuses) || "Unknown";
      }
      const byBranch: Record<
        string,
        { valid: number; due_today: number; expired_3d: number; older: number }
      > = {};
      for (const r of list) {
        const b = branchOf(r);
        if (!byBranch[b])
          byBranch[b] = {
            valid: 0,
            due_today: 0,
            expired_3d: 0,
            older: 0,
          };
        if (r.valid_until > today) byBranch[b].valid += 1;
        else if (r.valid_until === today) byBranch[b].due_today += 1;
        else if (r.valid_until >= threeDaysAgo) byBranch[b].expired_3d += 1;
        else byBranch[b].older += 1;
      }

      return {
        filter: campus,
        as_of: today,
        note: "Card = tutorial membership / monthly card validity (not exam fees). 'Still valid' means the student has renewed and card is current.",
        totals: {
          still_valid_cards: stillValid.length,
          due_today: dueToday.length,
          expired_last_3_days: expiredRecent.length,
          older_expired: expiredOlder.length,
          students_with_card_records: list.length,
        },
        by_branch: byBranch,
      };
    }

    case "get_attendance_today": {
      const { data: campuses } = await supabase
        .from("campuses")
        .select("id, name, short_name")
        .eq("is_active", true);
      const { data: rows, error } = await supabase
        .from("daily_attendance")
        .select(
          "campus_id, present_count, total_enrolled, notes, class_breakdown"
        )
        .eq("attendance_date", today);
      if (error) return { error: error.message };
      const map = new Map((rows || []).map((r) => [r.campus_id, r]));
      return {
        date: today,
        branches: (campuses || []).map((c) => {
          const row = map.get(c.id);
          return {
            campus: c.short_name || c.name,
            present: row?.present_count ?? null,
            enrolled: row?.total_enrolled ?? null,
            submitted: !!row,
            class_breakdown: row?.class_breakdown || null,
            notes: row?.notes || null,
          };
        }),
      };
    }

    case "get_payments_summary": {
      const { data: pays, error } = await supabase
        .from("payments")
        .select(
          "amount, payment_date, students!inner(campus_id, campuses(short_name, name))"
        )
        .is("deleted_at", null)
        .gte("payment_date", monthStart);
      if (error) return { error: error.message };
      const filtered = (pays || []).filter((p: any) =>
        matchCampus(campusLabel(p.students?.campuses || p.students), campus)
      );
      let todayAmt = 0;
      let todayN = 0;
      let monthAmt = 0;
      let monthN = 0;
      const byBranchMonth: Record<string, number> = {};
      for (const p of filtered as any[]) {
        const a = Number(p.amount || 0);
        monthAmt += a;
        monthN += 1;
        const b =
          campusLabel(
            Array.isArray(p.students)
              ? p.students[0]?.campuses
              : p.students?.campuses
          ) || "Unknown";
        byBranchMonth[b] = (byBranchMonth[b] || 0) + a;
        if (String(p.payment_date).slice(0, 10) === today) {
          todayAmt += a;
          todayN += 1;
        }
      }
      return {
        filter: campus,
        today: { count: todayN, amount_ngn: todayAmt },
        this_month: { count: monthN, amount_ngn: monthAmt },
        this_month_by_branch: byBranchMonth,
      };
    }

    case "get_outstanding_summary": {
      const { data, error } = await supabase
        .from("student_fees")
        .select(
          "balance, amount, amount_paid, fee_types(name), students!inner(full_name, status, campuses(short_name, name))"
        )
        .gt("balance", 0)
        .eq("students.status", "active");
      if (error) return { error: error.message };
      const rows = (data || []).filter((r: any) => {
        const st = Array.isArray(r.students) ? r.students[0] : r.students;
        return matchCampus(campusLabel(st?.campuses), campus);
      });
      let total = 0;
      const byCampus: Record<string, { count: number; balance: number }> = {};
      for (const r of rows as any[]) {
        const bal = Number(r.balance || 0);
        total += bal;
        const st = Array.isArray(r.students) ? r.students[0] : r.students;
        const b = campusLabel(st?.campuses) || "Unknown";
        if (!byCampus[b]) byCampus[b] = { count: 0, balance: 0 };
        byCampus[b].count += 1;
        byCampus[b].balance += bal;
      }
      return {
        filter: campus,
        fee_rows_with_balance: rows.length,
        total_outstanding_ngn: total,
        by_campus: byCampus,
      };
    }

    case "get_exam_registration": {
      const { data, error } = await supabase
        .from("student_fees")
        .select(
          "amount_paid, board_registered, board_deadline, fee_types(name), students!inner(full_name, status, campuses(short_name, name))"
        )
        .eq("students.status", "active");
      if (error) return { error: error.message };
      const exams = (data || []).filter((r: any) => {
        const ft = Array.isArray(r.fee_types) ? r.fee_types[0] : r.fee_types;
        if (!isExamFee(ft?.name)) return false;
        const st = Array.isArray(r.students) ? r.students[0] : r.students;
        return matchCampus(campusLabel(st?.campuses), campus);
      });
      const paid = exams.filter((r: any) => Number(r.amount_paid) > 0);
      const pendingBoard = paid.filter((r: any) => !r.board_registered);
      const overdue = pendingBoard.filter(
        (r: any) => r.board_deadline && String(r.board_deadline) <= today
      );
      return {
        filter: campus,
        exam_fee_records: exams.length,
        paid: paid.length,
        pending_board_registration: pendingBoard.length,
        overdue_deadlines: overdue.length,
      };
    }

    case "get_expenses_summary": {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, expense_date, campus_id, campuses(short_name, name)")
        .gte("expense_date", monthStart);
      if (error) return { error: error.message };
      const rows = (data || []).filter((e: any) =>
        matchCampus(campusLabel(e.campuses), campus)
      );
      let todayAmt = 0;
      let monthAmt = 0;
      for (const e of rows as any[]) {
        const a = Number(e.amount || 0);
        monthAmt += a;
        if (String(e.expense_date).slice(0, 10) === today) todayAmt += a;
      }
      return {
        filter: campus,
        today_ngn: todayAmt,
        this_month_ngn: monthAmt,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/** Simple keyword router when no LLM API key is configured */
export function detectToolsFromQuestion(q: string): { name: string; args: ToolArgs }[] {
  const L = q.toLowerCase();
  const tools: { name: string; args: ToolArgs }[] = [];
  let campus = "all";
  if (L.includes("arepo")) campus = "arepo";
  else if (L.includes("ofada") || L.includes("mowe")) campus = "ofada";
  else if (L.includes("main") && !L.includes("remain")) campus = "main";
  else if (L.includes("tutorial")) campus = "tutorial";

  if (
    L.includes("renew") ||
    L.includes("card") ||
    L.includes("valid") ||
    L.includes("expir")
  ) {
    tools.push({ name: "get_card_renewals", args: { campus } });
  }
  if (
    L.includes("attend") ||
    L.includes("present") ||
    (L.includes("how many") && L.includes("today") && L.includes("student"))
  ) {
    tools.push({ name: "get_attendance_today", args: {} });
  }
  if (
    L.includes("payment") ||
    L.includes("paid") ||
    L.includes("income") ||
    L.includes("money in") ||
    L.includes("collected")
  ) {
    tools.push({ name: "get_payments_summary", args: { campus } });
  }
  if (
    L.includes("outstanding") ||
    L.includes("debt") ||
    L.includes("balance") ||
    L.includes("owe")
  ) {
    tools.push({ name: "get_outstanding_summary", args: { campus } });
  }
  if (L.includes("exam") || L.includes("jamb") || L.includes("waec")) {
    tools.push({ name: "get_exam_registration", args: { campus } });
  }
  if (
    L.includes("expense") ||
    L.includes("spend") ||
    L.includes("money out")
  ) {
    tools.push({ name: "get_expenses_summary", args: { campus } });
  }
  if (
    L.includes("how many student") ||
    L.includes("student count") ||
    L.includes("enrol") ||
    L.includes("active student") ||
    (L.includes("student") && !tools.length)
  ) {
    tools.push({ name: "get_student_counts", args: { campus } });
  }
  if (!tools.length) {
    tools.push({ name: "get_card_renewals", args: { campus } });
    tools.push({ name: "get_student_counts", args: { campus } });
    tools.push({ name: "get_attendance_today", args: {} });
    tools.push({ name: "get_payments_summary", args: { campus: "all" } });
  }
  return tools;
}

export function formatToolResultsForAnswer(
  question: string,
  results: { tool: string; data: unknown }[]
): string {
  const parts: string[] = [];
  for (const r of results) {
    if (r.tool === "get_card_renewals") {
      const d = r.data as any;
      if (d?.error) {
        parts.push(`Card renewals error: ${d.error}`);
        continue;
      }
      const t = d.totals || {};
      parts.push(
        `Card renewals (${d.filter || "all"}, as of ${d.as_of}):\n` +
          `• Still valid (renewed & current): ${t.still_valid_cards}\n` +
          `• Due today: ${t.due_today}\n` +
          `• Expired in last 3 days: ${t.expired_last_3_days}\n` +
          `• Older expired: ${t.older_expired}`
      );
      if (d.by_branch) {
        const lines = Object.entries(d.by_branch as Record<string, any>).map(
          ([name, v]) =>
            `  – ${name}: valid ${v.valid}, due today ${v.due_today}, expired 3d ${v.expired_3d}`
        );
        if (lines.length) parts.push("By branch:\n" + lines.join("\n"));
      }
    } else if (r.tool === "get_student_counts") {
      const d = r.data as any;
      parts.push(
        `Active students (${d.filter}): ${d.total_active}` +
          (d.by_campus
            ? "\n" +
              Object.entries(d.by_campus)
                .map(([k, v]) => `  – ${k}: ${v}`)
                .join("\n")
            : "")
      );
    } else if (r.tool === "get_attendance_today") {
      const d = r.data as any;
      const lines = (d.branches || []).map((b: any) =>
        b.submitted
          ? `  – ${b.campus}: ${b.present} present` +
            (b.enrolled != null ? ` / ${b.enrolled} enrolled` : "")
          : `  – ${b.campus}: not submitted yet`
      );
      parts.push(`Attendance today (${d.date}):\n` + lines.join("\n"));
    } else if (r.tool === "get_payments_summary") {
      const d = r.data as any;
      const fmt = (n: number) =>
        new Intl.NumberFormat("en-NG", {
          style: "currency",
          currency: "NGN",
          maximumFractionDigits: 0,
        }).format(n || 0);
      parts.push(
        `Payments (${d.filter}):\n` +
          `• Today: ${d.today?.count || 0} payments, ${fmt(d.today?.amount_ngn || 0)}\n` +
          `• This month: ${d.this_month?.count || 0} payments, ${fmt(d.this_month?.amount_ngn || 0)}`
      );
    } else if (r.tool === "get_outstanding_summary") {
      const d = r.data as any;
      const fmt = (n: number) =>
        new Intl.NumberFormat("en-NG", {
          style: "currency",
          currency: "NGN",
          maximumFractionDigits: 0,
        }).format(n || 0);
      parts.push(
        `Outstanding (${d.filter}): ${d.fee_rows_with_balance} fee rows, total ${fmt(d.total_outstanding_ngn || 0)}`
      );
    } else if (r.tool === "get_exam_registration") {
      const d = r.data as any;
      parts.push(
        `Exam registration (${d.filter}): paid ${d.paid}, pending board ${d.pending_board_registration}, overdue deadlines ${d.overdue_deadlines}`
      );
    } else if (r.tool === "get_expenses_summary") {
      const d = r.data as any;
      const fmt = (n: number) =>
        new Intl.NumberFormat("en-NG", {
          style: "currency",
          currency: "NGN",
          maximumFractionDigits: 0,
        }).format(n || 0);
      parts.push(
        `Expenses (${d.filter}): today ${fmt(d.today_ngn || 0)}, this month ${fmt(d.this_month_ngn || 0)}`
      );
    } else {
      parts.push(`${r.tool}: ${JSON.stringify(r.data)}`);
    }
  }
  if (!parts.length) {
    return "I could not find matching school data for that question.";
  }
  return parts.join("\n\n");
}
