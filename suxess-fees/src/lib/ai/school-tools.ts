/**
 * Data tools the admin AI ("Alpha") can call against live Supabase data.
 *
 * Alpha has READ access to every table in the app (through the signed-in
 * director's session, so database security rules still apply). It never
 * writes anything.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchActiveCardStudents,
  isExamFeeName,
  isTutorialCampusLabel,
  lagosToday,
} from "@/lib/active-students";
import { presenceOf, ONLINE_WINDOW_MS } from "@/lib/presence";

// ───────────────────────── helpers ─────────────────────────

export const NO_ACCURATE_INFO =
  "I don't have accurate information on that, so I won't guess. " +
  "I couldn't find it in the school's data. You can rephrase the question " +
  "(for example name the branch, student, or date), or check the relevant page in the app.";

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function one<T = any>(x: T | T[] | null | undefined): T | null {
  if (!x) return null;
  return Array.isArray(x) ? ((x[0] as T) ?? null) : x;
}

function campusLabel(c: any): string {
  const row = one<any>(c);
  if (!row) return "";
  return `${row.short_name || ""} ${row.name || ""}`.trim();
}

function matchCampus(label: string, filter?: string | null): boolean {
  if (!filter || filter === "all") return true;
  const L = label.toLowerCase();
  const f = filter.toLowerCase();
  if (f === "arepo") return L.includes("arepo");
  if (f === "ofada" || f === "mowe" || f === "ofada_mowe")
    return L.includes("ofada") || L.includes("mowe");
  if (f === "main" || f === "school") return !isTutorialCampusLabel(L, "");
  if (f === "tutorial") return isTutorialCampusLabel(L, "");
  return L.includes(f);
}

type PageResult = { rows: any[]; error: string | null; truncated: boolean };

/** Reads every page of a query (Supabase returns max 1,000 rows per request). */
async function fetchAllRows(
  build: (from: number, to: number) => any,
  max = 20000
): Promise<PageResult> {
  const out: any[] = [];
  const page = 1000;
  for (let from = 0; from < max; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error) return { rows: out, error: error.message, truncated: false };
    out.push(...(data || []));
    if (!data || data.length < page)
      return { rows: out, error: null, truncated: false };
  }
  return { rows: out, error: null, truncated: true };
}

function getPath(row: any, path: string): any {
  let cur = row;
  for (const part of path.split(".")) {
    if (Array.isArray(cur)) cur = cur[0];
    if (cur == null) return null;
    cur = cur[part];
  }
  if (Array.isArray(cur)) cur = cur[0];
  return cur ?? null;
}

// ───────────────────────── data model ─────────────────────────

export const DATA_MODEL: Record<string, { about: string; columns: string }> = {
  campuses: {
    about: "Branches: Main school, Arepo tutorial, Ofada Mowe tutorial.",
    columns: "id, name, short_name, address, phone, is_active, created_at",
  },
  students: {
    about:
      "Every registered student. status: active | inactive | graduated | withdrawn (as set by staff).",
    columns:
      "id, admission_number, full_name, class_name, campus_id, parent_name, parent_phone, parent_email, status, exam_preparing_for, address, department, created_at, updated_at",
  },
  fee_types: {
    about: "Kinds of fee (School Fees, Tuition (Monthly), JAMB, WAEC…).",
    columns: "id, name, description",
  },
  student_fees: {
    about:
      "One row per fee charged to a student. valid_until = tutorial card expiry. board_registered / board_deadline = exam registration tracking. balance = amount - amount_paid.",
    columns:
      "id, student_id, fee_type_id, session, term, amount, amount_paid, balance, due_date, status, valid_until, board_deadline, board_registered, board_registered_at, created_at, updated_at",
  },
  payments: {
    about:
      "Money received from parents/students. Soft-deleted rows have deleted_at set — ignore them (filter deleted_at is_null).",
    columns:
      "id, student_id, student_fee_id, amount, payment_method, payment_date, receipt_number, notes, recorded_by, deleted_at, created_at",
  },
  expenses: {
    about: "School expenses (money out).",
    columns:
      "id, campus_id, expense_date, category, description, amount, payment_method, recorded_by, notes, created_at",
  },
  staff: {
    about: "Staff members and salaries. status: active | inactive.",
    columns:
      "id, campus_id, full_name, role, phone, salary, status, start_date, notes",
  },
  staff_loans: {
    about: "Loans given to staff, repaid by monthly deduction.",
    columns:
      "id, staff_id, campus_id, principal, monthly_deduction, amount_remaining, reason, start_date, status, notes",
  },
  teacher_payments: {
    about: "Daily pay given to tutorial-centre teachers.",
    columns:
      "id, campus_id, teacher_name, period_taught, amount, payment_method, payment_date, notes",
  },
  daily_attendance: {
    about: "Attendance totals submitted each day by a secretary for a campus.",
    columns:
      "id, campus_id, attendance_date, present_count, total_enrolled, class_breakdown (json), notes, recorded_by",
  },
  private_lessons: {
    about: "Private lessons: parent payment in, teacher pay out.",
    columns:
      "id, campus_id, parent_name, parent_phone, student_name, amount_paid, teacher_name, teacher_amount, teachers (json), lesson_date, due_date, notes",
  },
  inventory_items: {
    about: "Items in stock (books, uniforms…).",
    columns:
      "id, name, category, quantity, min_stock, unit, campus_id, cost_price, selling_price, notes",
  },
  inventory_sales: {
    about: "Sales of inventory items.",
    columns:
      "id, inventory_item_id, item_name, quantity, unit_cost, unit_price, total_cost, total_price, profit, payment_method, student_id, buyer_name, campus_id, sale_date, notes",
  },
  scholarships: {
    about:
      "Scholarships granted to students. status: active | pending_approval | rejected | ended.",
    columns:
      "id, student_id, campus_id, session, term, coverage, amount_covered, reason, status, prior_fees_paid, granted_by, approved_by, approved_at, created_at",
  },
  school_buses: {
    about: "School buses and drivers.",
    columns:
      "id, name, plate_number, driver_name, driver_phone, route_name, capacity, bus_fee, is_active, notes",
  },
  student_bus_assignments: {
    about: "Which student rides which bus.",
    columns: "id, student_id, bus_id, pickup_point, status, assigned_at, notes",
  },
  profiles: {
    about:
      "App user accounts. role = admin (director) or secretary. last_seen_at = last time the user had the app open (online if within 3 minutes).",
    columns: "id, full_name, role, campus_id, last_seen_at, created_at",
  },
  notifications: {
    about: "Director notifications (e.g. scholarship awaiting approval).",
    columns:
      "id, target_role, title, body, link, related_scholarship_id, read_at, created_at",
  },
  chat_conversations: {
    about: "Message threads between the director and secretaries.",
    columns: "id, campus_id, title, created_at, updated_at",
  },
  chat_participants: {
    about: "Who is in each conversation. last_read_at = when they last opened it.",
    columns: "conversation_id, user_id, last_read_at",
  },
  chat_messages: {
    about:
      "Individual messages. A message is unread for a user if sent by someone else after their last_read_at.",
    columns:
      "id, conversation_id, sender_id, body, voice_url, voice_duration_sec, created_at",
  },
};

const TABLES = Object.keys(DATA_MODEL);

export function dataModelText(): string {
  return TABLES.map(
    (t) => `• ${t}: ${DATA_MODEL[t].about}\n    columns: ${DATA_MODEL[t].columns}`
  ).join("\n");
}

// ───────────────────────── tool definitions ─────────────────────────

const campusParam = {
  type: "string",
  description: "Branch filter: arepo | ofada | main | tutorial | all",
};

export const AI_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "get_card_renewals",
      description:
        "Tutorial membership card status: how many cards are still valid (active), expire today, expired in the last 3 days, or expired earlier — by branch. Set include_students=true to also list student names (up to 60) for expiring_today, expired_recent, expiring_next_7_days.",
      parameters: {
        type: "object",
        properties: {
          campus: campusParam,
          include_students: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_student_counts",
      description:
        "Active student counts. TUTORIAL centres (Arepo, Ofada Mowe): a student is active only while their card is still valid. MAIN school: status active (and the dashboard KPI = students who paid school fees/tuition). Also gives registered-but-card-expired counts and breakdown by class or exam.",
      parameters: { type: "object", properties: { campus: campusParam } },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_attendance_today",
      description:
        "Daily attendance submitted by secretaries for each campus (present count, enrolled, class breakdown, whether submitted). Defaults to today; pass date=YYYY-MM-DD for another day.",
      parameters: {
        type: "object",
        properties: { date: { type: "string", description: "YYYY-MM-DD" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_payments_summary",
      description:
        "Fee payments received: today, this month, and optionally a custom date range, by branch and payment method.",
      parameters: {
        type: "object",
        properties: {
          campus: campusParam,
          date_from: { type: "string", description: "YYYY-MM-DD" },
          date_to: { type: "string", description: "YYYY-MM-DD" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_outstanding_summary",
      description:
        "Students with outstanding fee balances: totals by branch and the biggest debtors (names, fee, balance).",
      parameters: { type: "object", properties: { campus: campusParam } },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_exam_registration",
      description:
        "Exam registration fees: how many paid, pending board registration, overdue deadlines, with student names.",
      parameters: { type: "object", properties: { campus: campusParam } },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_campuses",
      description: "List all campuses/branches with ids and names.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_expenses_summary",
      description:
        "Expenses today and this month (total and by category), optional campus.",
      parameters: { type: "object", properties: { campus: campusParam } },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_students",
      description:
        "Find students by name, admission number, parent name or parent phone. Returns profile, campus, class, status, card validity and their fees with balances.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Name, admission number or phone" },
          campus: campusParam,
          status: { type: "string", description: "active | inactive | all" },
          limit: { type: "number" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_student_detail",
      description:
        "Full record of ONE student: details, every fee, payments (latest 30), scholarships, bus assignment. Pass student_id (from search_students) or a name.",
      parameters: {
        type: "object",
        properties: {
          student_id: { type: "string" },
          name: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_staff_activity",
      description:
        "Which secretaries are online right now, active today, or inactive, with last-seen time, their campus, and whether their campus submitted today's attendance.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_messages_overview",
      description:
        "Director's messages: unread count, recent conversations with secretaries (unread per chat, last message preview). Pass with_name to read the latest 20 messages of one conversation.",
      parameters: {
        type: "object",
        properties: {
          with_name: { type: "string", description: "Secretary name or campus" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "describe_data_model",
      description:
        "Lists every table and column the assistant can read. Call this first when unsure which table holds something.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_table",
      description:
        "Read-only query on ANY app table (see describe_data_model). Use for anything the specialised tools do not cover: staff, salaries, loans, inventory, sales, scholarships, buses, private lessons, teacher pay, notifications, fee types, payment lists, etc. Supports filters, ordering, row limit, and server-side aggregation (sum/count/avg/min/max with optional group_by) — ALWAYS use aggregate for totals instead of adding rows yourself.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string" },
          select: {
            type: "string",
            description:
              "Columns, e.g. 'full_name, salary' or with joins 'amount, payment_date, students(full_name, campuses(short_name))'. Default '*'. Use students!inner(...) when you also filter on the joined table.",
          },
          filters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                column: { type: "string", description: "e.g. status, amount, students.status" },
                op: {
                  type: "string",
                  enum: ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is_null", "not_null"],
                },
                value: {},
              },
              required: ["column", "op"],
            },
          },
          order_by: {
            type: "object",
            properties: { column: { type: "string" }, ascending: { type: "boolean" } },
          },
          limit: { type: "number", description: "Max rows returned (default 50, max 200)" },
          count_only: { type: "boolean" },
          aggregate: {
            type: "object",
            description:
              "Server-side math over ALL matching rows (up to 20,000). group_by may use a joined path like students.campus_id.",
            properties: {
              fn: { type: "string", enum: ["sum", "count", "avg", "min", "max"] },
              column: { type: "string" },
              group_by: { type: "string" },
            },
            required: ["fn"],
          },
        },
        required: ["table"],
      },
    },
  },
];

type ToolArgs = Record<string, unknown>;

// ───────────────────────── generic query ─────────────────────────

function validSelect(sel: string): string | null {
  if (!/^[a-zA-Z0-9_,:()*!.\s]+$/.test(sel)) return "Invalid characters in select";
  const rels = sel.matchAll(/([a-zA-Z_]+)(?:![a-z]+)?\s*\(/g);
  for (const m of rels) {
    if (!TABLES.includes(m[1])) return `Unknown relation in select: ${m[1]}`;
  }
  return null;
}

const COL_RE = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;

async function queryTable(supabase: SupabaseClient, args: ToolArgs) {
  const table = String(args.table || "");
  if (!TABLES.includes(table)) {
    return { error: `Unknown table "${table}". Allowed: ${TABLES.join(", ")}` };
  }
  const select = String(args.select || "*").trim() || "*";
  const selErr = validSelect(select);
  if (selErr) return { error: selErr };

  const filters = Array.isArray(args.filters) ? (args.filters as any[]) : [];
  for (const f of filters) {
    if (!COL_RE.test(String(f?.column || ""))) {
      return { error: `Invalid filter column: ${f?.column}` };
    }
  }
  const agg = args.aggregate as
    | { fn: string; column?: string; group_by?: string }
    | undefined;
  if (agg) {
    if (agg.column && !COL_RE.test(agg.column)) return { error: "Invalid aggregate column" };
    if (agg.group_by && !COL_RE.test(agg.group_by)) return { error: "Invalid group_by" };
  }
  const ob = args.order_by as { column?: string; ascending?: boolean } | undefined;
  if (ob?.column && !COL_RE.test(ob.column)) return { error: "Invalid order_by column" };

  function apply(q: any) {
    for (const f of filters) {
      const c = String(f.column);
      switch (f.op) {
        case "eq": q = q.eq(c, f.value); break;
        case "neq": q = q.neq(c, f.value); break;
        case "gt": q = q.gt(c, f.value); break;
        case "gte": q = q.gte(c, f.value); break;
        case "lt": q = q.lt(c, f.value); break;
        case "lte": q = q.lte(c, f.value); break;
        case "like": q = q.like(c, String(f.value)); break;
        case "ilike": q = q.ilike(c, String(f.value)); break;
        case "in":
          q = q.in(
            c,
            Array.isArray(f.value)
              ? f.value
              : String(f.value ?? "").split(",").map((x: string) => x.trim())
          );
          break;
        case "is_null": q = q.is(c, null); break;
        case "not_null": q = q.not(c, "is", null); break;
        default: break;
      }
    }
    return q;
  }

  // count only
  if (args.count_only) {
    const { count, error } = await apply(
      supabase.from(table).select(select, { count: "exact", head: true })
    );
    if (error) return { error: error.message };
    return { table, count };
  }

  // aggregate over all matching rows
  if (agg) {
    const needsCol = agg.fn !== "count";
    if (needsCol && !agg.column) return { error: "aggregate.column is required" };
    const res = await fetchAllRows((a, b) => {
      let q = supabase.from(table).select(select === "*" ? "*" : select).order(
        ob?.column && !ob.column.includes(".") ? ob.column : (table === "chat_participants" ? "conversation_id" : "id")
      );
      q = apply(q);
      return q.range(a, b);
    });
    if (res.error) return { error: res.error };
    const groups = new Map<string, { n: number; sum: number; min: number; max: number }>();
    for (const row of res.rows) {
      const g = agg.group_by ? String(getPath(row, agg.group_by) ?? "null") : "all";
      const raw = agg.column ? getPath(row, agg.column) : 1;
      const v = Number(raw);
      const cur = groups.get(g) || { n: 0, sum: 0, min: Infinity, max: -Infinity };
      if (agg.fn === "count") {
        cur.n += 1;
      } else if (!Number.isNaN(v) && raw !== null) {
        cur.n += 1;
        cur.sum += v;
        cur.min = Math.min(cur.min, v);
        cur.max = Math.max(cur.max, v);
      }
      groups.set(g, cur);
    }
    const out: Record<string, number> = {};
    for (const [g, v] of groups) {
      out[g] =
        agg.fn === "count" ? v.n
        : agg.fn === "sum" ? v.sum
        : agg.fn === "avg" ? (v.n ? v.sum / v.n : 0)
        : agg.fn === "min" ? (v.n ? v.min : 0)
        : (v.n ? v.max : 0);
    }
    return {
      table,
      aggregate: agg,
      rows_scanned: res.rows.length,
      truncated: res.truncated,
      result: agg.group_by ? out : out["all"] ?? 0,
    };
  }

  // normal listing
  const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 200);
  let q = supabase.from(table).select(select, { count: "exact" });
  q = apply(q);
  if (ob?.column) q = q.order(ob.column, { ascending: ob.ascending ?? true });
  const { data, error, count } = await q.limit(limit);
  if (error) return { error: error.message };
  return {
    table,
    total_matching: count,
    returned: data?.length || 0,
    rows: data || [],
  };
}

// ───────────────────────── tool runner ─────────────────────────

export async function runSchoolTool(
  supabase: SupabaseClient,
  name: string,
  args: ToolArgs
): Promise<unknown> {
  const campus = (args.campus as string) || "all";
  const today = lagosToday();
  const monthStart = today.slice(0, 8) + "01";
  const threeDaysAgo = addDays(today, -3);

  try {
    switch (name) {
      case "describe_data_model":
        return {
          tables: DATA_MODEL,
          notes: [
            "Money is in Naira (NGN).",
            "Tutorial centres = Arepo and Ofada Mowe. Tutorial active student = card valid_until >= today.",
          ],
        };

      case "query_table":
        return await queryTable(supabase, args);

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
        const studs = await fetchAllRows((a, b) =>
          supabase
            .from("students")
            .select(
              "id, class_name, exam_preparing_for, campus_id, status, campuses(short_name, name)"
            )
            .eq("status", "active")
            .order("id")
            .range(a, b)
        );
        if (studs.error) return { error: studs.error };
        const cards = await fetchActiveCardStudents(supabase, today);

        const paid = await fetchAllRows((a, b) =>
          supabase
            .from("student_fees")
            .select(
              "student_id, amount_paid, fee_types(name), students!inner(campus_id, status, campuses(short_name, name))"
            )
            .gt("amount_paid", 0)
            .eq("students.status", "active")
            .order("id")
            .range(a, b)
        );

        const tutorialActive: Record<string, number> = {};
        const tutorialExpired: Record<string, number> = {};
        const mainRegistered: Record<string, number> = {};
        const byClass: Record<string, number> = {};
        const byExam: Record<string, number> = {};

        for (const s of studs.rows) {
          const camp = one<any>(s.campuses);
          const label = campusLabel(camp) || "Unknown";
          if (!matchCampus(label, campus)) continue;
          if (isTutorialCampusLabel(camp?.short_name, camp?.name)) {
            if (cards.has(String(s.id))) {
              tutorialActive[label] = (tutorialActive[label] || 0) + 1;
              const ex = String(s.exam_preparing_for || "Not set").trim() || "Not set";
              byExam[ex] = (byExam[ex] || 0) + 1;
            } else {
              tutorialExpired[label] = (tutorialExpired[label] || 0) + 1;
            }
          } else {
            mainRegistered[label] = (mainRegistered[label] || 0) + 1;
            const cn = String(s.class_name || "Unassigned").trim() || "Unassigned";
            byClass[cn] = (byClass[cn] || 0) + 1;
          }
        }

        const mainPaidIds = new Set<string>();
        for (const r of paid.rows) {
          const st = one<any>(r.students);
          const c = one<any>(st?.campuses);
          if (isTutorialCampusLabel(c?.short_name, c?.name)) continue;
          if (!matchCampus(campusLabel(c), campus)) continue;
          const n = String(one<any>(r.fee_types)?.name || "").toLowerCase();
          if (n.includes("school fee") || n.includes("tuition"))
            mainPaidIds.add(String(r.student_id));
        }

        const sum = (o: Record<string, number>) =>
          Object.values(o).reduce((a, b) => a + b, 0);
        const tutorialActiveTotal = sum(tutorialActive);
        const mainPaidTotal = mainPaidIds.size;

        return {
          filter: campus,
          as_of: today,
          definition:
            "Tutorial centres: active = card still valid (valid_until >= today). Main school: 'registered active' = status active; the dashboard 'Active students' KPI counts Main students who paid School Fees/Tuition at least once.",
          tutorial_active_valid_card: { total: tutorialActiveTotal, by_campus: tutorialActive },
          tutorial_registered_but_card_expired: {
            total: sum(tutorialExpired),
            by_campus: tutorialExpired,
          },
          main_registered_active: { total: sum(mainRegistered), by_campus: mainRegistered },
          main_paid_fees_active: mainPaidTotal,
          dashboard_active_students_total: tutorialActiveTotal + mainPaidTotal,
          main_by_class: byClass,
          tutorial_by_exam_preparing_for: byExam,
          truncated: studs.truncated || paid.truncated,
        };
      }

      case "get_card_renewals": {
        const rows = await fetchAllRows((a, b) =>
          supabase
            .from("student_fees")
            .select(
              `id, valid_until, fee_types(name),
               students!inner(id, full_name, status, campus_id, campuses(short_name, name))`
            )
            .not("valid_until", "is", null)
            .eq("students.status", "active")
            .order("id")
            .range(a, b)
        );
        if (rows.error) return { error: rows.error };

        const byStudent = new Map<string, any>();
        for (const r of rows.rows) {
          if (isExamFeeName(one<any>(r.fee_types)?.name)) continue;
          const st = one<any>(r.students);
          if (!matchCampus(campusLabel(st?.campuses), campus)) continue;
          if (!st?.id) continue;
          const prev = byStudent.get(st.id);
          if (!prev || String(r.valid_until) > String(prev.valid_until)) byStudent.set(st.id, r);
        }
        const list = Array.from(byStudent.values());
        const vu = (r: any) => String(r.valid_until).slice(0, 10);

        const stillValid = list.filter((r) => vu(r) >= today);
        const expiresToday = list.filter((r) => vu(r) === today);
        const expiredRecent = list.filter((r) => vu(r) < today && vu(r) >= threeDaysAgo);
        const expiredOlder = list.filter((r) => vu(r) < threeDaysAgo);
        const next7 = list.filter((r) => vu(r) > today && vu(r) <= addDays(today, 7));

        const byBranch: Record<string, any> = {};
        for (const r of list) {
          const b = campusLabel(one<any>(r.students)?.campuses) || "Unknown";
          byBranch[b] ||= { valid: 0, expires_today: 0, expired_3d: 0, older: 0 };
          const v = vu(r);
          if (v >= today) byBranch[b].valid += 1;
          if (v === today) byBranch[b].expires_today += 1;
          else if (v < today && v >= threeDaysAgo) byBranch[b].expired_3d += 1;
          else if (v < threeDaysAgo) byBranch[b].older += 1;
        }

        const names = (arr: any[]) =>
          arr.slice(0, 60).map((r) => ({
            student: one<any>(r.students)?.full_name,
            campus: campusLabel(one<any>(r.students)?.campuses),
            valid_until: vu(r),
          }));

        const out: any = {
          filter: campus,
          as_of: today,
          note: "Card = tutorial monthly membership (not exam fees). A card is ACTIVE while valid_until >= today. 'expires_today' is a subset of still_valid_cards (valid through today).",
          totals: {
            still_valid_cards: stillValid.length,
            expires_today: expiresToday.length,
            expiring_next_7_days: next7.length,
            expired_last_3_days: expiredRecent.length,
            older_expired: expiredOlder.length,
            students_with_card_records: list.length,
          },
          by_branch: byBranch,
          truncated: rows.truncated,
        };
        if (args.include_students) {
          out.expiring_today = names(expiresToday);
          out.expired_recent = names(expiredRecent);
          out.expiring_next_7_days = names(next7);
        }
        return out;
      }

      case "get_attendance_today": {
        const date = /^\d{4}-\d{2}-\d{2}$/.test(String(args.date || ""))
          ? String(args.date)
          : today;
        const { data: campuses } = await supabase
          .from("campuses")
          .select("id, name, short_name")
          .eq("is_active", true);
        let { data: rows, error } = await supabase
          .from("daily_attendance")
          .select("campus_id, present_count, total_enrolled, notes, class_breakdown")
          .eq("attendance_date", date);
        if (error) {
          const r2 = await supabase
            .from("daily_attendance")
            .select("campus_id, present_count, total_enrolled, notes")
            .eq("attendance_date", date);
          if (r2.error) return { error: r2.error.message };
          rows = r2.data as any;
        }
        const map = new Map((rows || []).map((r: any) => [r.campus_id, r]));
        return {
          date,
          branches: (campuses || []).map((c) => {
            const row: any = map.get(c.id);
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
        const from = /^\d{4}-\d{2}-\d{2}$/.test(String(args.date_from || ""))
          ? String(args.date_from)
          : null;
        const to = /^\d{4}-\d{2}-\d{2}$/.test(String(args.date_to || ""))
          ? String(args.date_to)
          : null;
        const start = from && from < monthStart ? from : monthStart;
        const pays = await fetchAllRows((a, b) =>
          supabase
            .from("payments")
            .select(
              "amount, payment_date, payment_method, students!inner(campus_id, campuses(short_name, name))"
            )
            .is("deleted_at", null)
            .gte("payment_date", start)
            .order("id")
            .range(a, b)
        );
        if (pays.error) return { error: pays.error };

        let todayAmt = 0, todayN = 0, monthAmt = 0, monthN = 0, rangeAmt = 0, rangeN = 0;
        const byBranchMonth: Record<string, number> = {};
        const byMethodMonth: Record<string, number> = {};
        const byBranchRange: Record<string, number> = {};
        for (const p of pays.rows) {
          const camp = one<any>(one<any>(p.students)?.campuses);
          const label = campusLabel(camp) || "Unknown";
          if (!matchCampus(label, campus)) continue;
          const a = Number(p.amount || 0);
          const d = String(p.payment_date).slice(0, 10);
          if (d >= monthStart) {
            monthAmt += a; monthN += 1;
            byBranchMonth[label] = (byBranchMonth[label] || 0) + a;
            const m = String(p.payment_method || "unknown");
            byMethodMonth[m] = (byMethodMonth[m] || 0) + a;
          }
          if (d === today) { todayAmt += a; todayN += 1; }
          if (from && d >= from && (!to || d <= to)) {
            rangeAmt += a; rangeN += 1;
            byBranchRange[label] = (byBranchRange[label] || 0) + a;
          }
        }
        const out: any = {
          filter: campus,
          today: { count: todayN, amount_ngn: todayAmt },
          this_month: { count: monthN, amount_ngn: monthAmt },
          this_month_by_branch: byBranchMonth,
          this_month_by_method: byMethodMonth,
          truncated: pays.truncated,
        };
        if (from) {
          out.custom_range = {
            from, to: to || "open-ended",
            count: rangeN, amount_ngn: rangeAmt, by_branch: byBranchRange,
          };
        }
        return out;
      }

      case "get_outstanding_summary": {
        const res = await fetchAllRows((a, b) =>
          supabase
            .from("student_fees")
            .select(
              "balance, fee_types(name), session, term, students!inner(full_name, status, campuses(short_name, name))"
            )
            .gt("balance", 0)
            .eq("students.status", "active")
            .order("id")
            .range(a, b)
        );
        if (res.error) return { error: res.error };
        const rows = res.rows.filter((r: any) =>
          matchCampus(campusLabel(one<any>(r.students)?.campuses), campus)
        );
        let total = 0;
        const byCampus: Record<string, { count: number; balance: number }> = {};
        for (const r of rows) {
          const bal = Number(r.balance || 0);
          total += bal;
          const b = campusLabel(one<any>(r.students)?.campuses) || "Unknown";
          byCampus[b] ||= { count: 0, balance: 0 };
          byCampus[b].count += 1;
          byCampus[b].balance += bal;
        }
        const top = [...rows]
          .sort((a, b) => Number(b.balance) - Number(a.balance))
          .slice(0, 15)
          .map((r) => ({
            student: one<any>(r.students)?.full_name,
            campus: campusLabel(one<any>(r.students)?.campuses),
            fee: one<any>(r.fee_types)?.name,
            session: r.session,
            term: r.term,
            balance_ngn: Number(r.balance),
          }));
        return {
          filter: campus,
          fee_rows_with_balance: rows.length,
          total_outstanding_ngn: total,
          by_campus: byCampus,
          biggest_balances: top,
          truncated: res.truncated,
        };
      }

      case "get_exam_registration": {
        const res = await fetchAllRows((a, b) =>
          supabase
            .from("student_fees")
            .select(
              "amount_paid, board_registered, board_deadline, fee_types(name), students!inner(full_name, status, campuses(short_name, name))"
            )
            .eq("students.status", "active")
            .order("id")
            .range(a, b)
        );
        if (res.error) return { error: res.error };
        const exams = res.rows.filter((r: any) => {
          if (!isExamFeeName(one<any>(r.fee_types)?.name)) return false;
          return matchCampus(campusLabel(one<any>(r.students)?.campuses), campus);
        });
        const paid = exams.filter((r: any) => Number(r.amount_paid) > 0);
        const pendingBoard = paid.filter((r: any) => !r.board_registered);
        const overdue = pendingBoard.filter(
          (r: any) => r.board_deadline && String(r.board_deadline) <= today
        );
        const nm = (r: any) => ({
          student: one<any>(r.students)?.full_name,
          exam: one<any>(r.fee_types)?.name,
          campus: campusLabel(one<any>(r.students)?.campuses),
          deadline: r.board_deadline,
        });
        return {
          filter: campus,
          exam_fee_records: exams.length,
          paid: paid.length,
          unpaid: exams.length - paid.length,
          pending_board_registration: pendingBoard.length,
          overdue_deadlines: overdue.length,
          overdue_list: overdue.slice(0, 30).map(nm),
          pending_list: pendingBoard.slice(0, 30).map(nm),
        };
      }

      case "get_expenses_summary": {
        const res = await fetchAllRows((a, b) =>
          supabase
            .from("expenses")
            .select("amount, expense_date, category, campus_id, campuses(short_name, name)")
            .gte("expense_date", monthStart)
            .order("id")
            .range(a, b)
        );
        if (res.error) return { error: res.error };
        const rows = res.rows.filter((e: any) =>
          matchCampus(campusLabel(e.campuses), campus)
        );
        let todayAmt = 0, monthAmt = 0;
        const byCat: Record<string, number> = {};
        for (const e of rows) {
          const a = Number(e.amount || 0);
          monthAmt += a;
          const c = String(e.category || "Uncategorised");
          byCat[c] = (byCat[c] || 0) + a;
          if (String(e.expense_date).slice(0, 10) === today) todayAmt += a;
        }
        return {
          filter: campus,
          today_ngn: todayAmt,
          this_month_ngn: monthAmt,
          this_month_by_category: byCat,
        };
      }

      case "search_students": {
        const raw = String(args.query || "").replace(/[,()%*\\]/g, " ").trim();
        if (!raw) return { error: "query is required" };
        const limit = Math.min(Math.max(Number(args.limit) || 15, 1), 40);
        let q = supabase
          .from("students")
          .select(
            "id, admission_number, full_name, class_name, parent_name, parent_phone, status, exam_preparing_for, campus_id, campuses(short_name, name)"
          )
          .or(
            `full_name.ilike.%${raw}%,admission_number.ilike.%${raw}%,parent_name.ilike.%${raw}%,parent_phone.ilike.%${raw}%`
          )
          .limit(limit * 3);
        const status = String(args.status || "all");
        if (status !== "all") q = q.eq("status", status);
        const { data, error } = await q;
        if (error) return { error: error.message };
        const students = (data || [])
          .filter((s: any) => matchCampus(campusLabel(s.campuses), campus))
          .slice(0, limit);
        if (!students.length) return { matches: [], note: "No student matched." };

        const ids = students.map((s: any) => s.id);
        const { data: fees } = await supabase
          .from("student_fees")
          .select("student_id, session, term, amount, amount_paid, balance, valid_until, fee_types(name)")
          .in("student_id", ids);
        const feesBy = new Map<string, any[]>();
        for (const f of fees || []) {
          const arr = feesBy.get((f as any).student_id) || [];
          arr.push({
            fee: one<any>((f as any).fee_types)?.name,
            session: (f as any).session,
            term: (f as any).term,
            amount: (f as any).amount,
            paid: (f as any).amount_paid,
            balance: (f as any).balance,
            valid_until: (f as any).valid_until,
          });
          feesBy.set((f as any).student_id, arr);
        }
        return {
          as_of: today,
          matches: students.map((s: any) => {
            const camp = one<any>(s.campuses);
            const tutorial = isTutorialCampusLabel(camp?.short_name, camp?.name);
            const f = feesBy.get(s.id) || [];
            const latestCard = f
              .filter((x) => x.valid_until && !isExamFeeName(x.fee))
              .map((x) => String(x.valid_until).slice(0, 10))
              .sort()
              .pop();
            return {
              id: s.id,
              name: s.full_name,
              admission_number: s.admission_number,
              campus: campusLabel(camp),
              class: s.class_name,
              exam_preparing_for: s.exam_preparing_for,
              parent: s.parent_name,
              parent_phone: s.parent_phone,
              status: s.status,
              ...(tutorial
                ? {
                    card_valid_until: latestCard || null,
                    card_active: !!latestCard && latestCard >= today,
                  }
                : {}),
              total_balance_ngn: f.reduce((a, x) => a + Number(x.balance || 0), 0),
              fees: f,
            };
          }),
        };
      }

      case "get_student_detail": {
        let id = String(args.student_id || "");
        if (!id && args.name) {
          const nm = String(args.name).replace(/[,()%*\\]/g, " ").trim();
          const { data: found } = await supabase
            .from("students")
            .select("id")
            .ilike("full_name", `%${nm}%`)
            .limit(2);
          if (!found?.length) return { error: `No student found matching "${nm}"` };
          if (found.length > 1)
            return {
              error: `More than one student matches "${nm}". Use search_students and ask which one.`,
            };
          id = found[0].id;
        }
        if (!id) return { error: "student_id or name is required" };

        const [stu, fees, pays, sch, bus] = await Promise.all([
          supabase
            .from("students")
            .select("*, campuses(short_name, name)")
            .eq("id", id)
            .maybeSingle(),
          supabase
            .from("student_fees")
            .select("session, term, amount, amount_paid, balance, status, due_date, valid_until, board_registered, board_deadline, fee_types(name)")
            .eq("student_id", id),
          supabase
            .from("payments")
            .select("amount, payment_method, payment_date, receipt_number, notes")
            .eq("student_id", id)
            .is("deleted_at", null)
            .order("payment_date", { ascending: false })
            .limit(30),
          supabase
            .from("scholarships")
            .select("session, term, coverage, amount_covered, status, reason")
            .eq("student_id", id),
          supabase
            .from("student_bus_assignments")
            .select("pickup_point, status, school_buses(name, route_name)")
            .eq("student_id", id),
        ]);
        if (stu.error) return { error: stu.error.message };
        if (!stu.data) return { error: "Student not found" };
        return {
          as_of: today,
          student: { ...stu.data, campuses: undefined, campus: campusLabel((stu.data as any).campuses) },
          fees: fees.data || [],
          recent_payments: pays.data || [],
          scholarships: sch.data || [],
          bus: bus.error ? null : bus.data || [],
        };
      }

      case "get_staff_activity": {
        let pr: any = await supabase
          .from("profiles")
          .select("id, full_name, role, campus_id, last_seen_at, campuses(short_name, name)");
        let tracking = true;
        if (pr.error) {
          tracking = false;
          pr = await supabase
            .from("profiles")
            .select("id, full_name, role, campus_id, campuses(short_name, name)");
          if (pr.error) return { error: pr.error.message };
        }
        const { data: att } = await supabase
          .from("daily_attendance")
          .select("campus_id")
          .eq("attendance_date", today);
        const submitted = new Set((att || []).map((r: any) => r.campus_id));
        const now = Date.now();
        const secretaries = (pr.data || [])
          .filter(
            (p: any) =>
              !["admin", "director", "owner", "administrator"].includes(
                String(p.role || "").trim().toLowerCase()
              )
          )
          .map((p: any) => {
            const camp = one<any>(p.campuses);
            return {
              name: p.full_name || camp?.short_name || "Secretary",
              campus: camp?.short_name || camp?.name || null,
              status: tracking ? presenceOf(p.last_seen_at, now, today) : "unknown",
              last_seen_at: p.last_seen_at ?? null,
              minutes_since_seen:
                p.last_seen_at ? Math.round((now - new Date(p.last_seen_at).getTime()) / 60000) : null,
              attendance_submitted_today: p.campus_id ? submitted.has(p.campus_id) : null,
            };
          });
        return {
          as_of: new Date(now).toISOString(),
          online_means: `app opened/visible within the last ${ONLINE_WINDOW_MS / 60000} minutes`,
          tracking_enabled: tracking,
          note: tracking
            ? undefined
            : "Activity tracking is not set up yet (run migration-secretary-activity.sql). Online status is unknown.",
          online_now: secretaries.filter((s: any) => s.status === "online").length,
          active_today: secretaries.filter((s: any) => s.status === "online" || s.status === "today").length,
          secretaries,
        };
      }

      case "get_messages_overview": {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: "Not signed in" };
        const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 50);

        const probe = await supabase.from("chat_conversations").select("id").limit(1);
        if (probe.error) return { error: `Messaging not available: ${probe.error.message}` };

        const { data: convs } = await supabase
          .from("chat_conversations")
          .select("id, title, campus_id, updated_at")
          .order("updated_at", { ascending: false })
          .limit(100);
        const ids = (convs || []).map((c: any) => c.id);
        if (!ids.length) return { director_unread_total: 0, conversations: [] };

        const { data: parts } = await supabase
          .from("chat_participants")
          .select("conversation_id, user_id, last_read_at")
          .in("conversation_id", ids);
        const userIds = Array.from(new Set((parts || []).map((p: any) => p.user_id)));
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, role, campuses(short_name, name)")
          .in("id", userIds);
        const pmap = new Map((profs || []).map((p: any) => [p.id, p]));
        const nameOf = (uid: string) => {
          const p: any = pmap.get(uid);
          const c = one<any>(p?.campuses);
          return p?.full_name || c?.short_name || c?.name || "Unknown";
        };

        const rows: any[] = [];
        let totalUnread = 0;
        for (const c of convs || []) {
          const mine = (parts || []).find(
            (p: any) => p.conversation_id === c.id && p.user_id === user.id
          );
          const others = (parts || []).filter(
            (p: any) => p.conversation_id === c.id && p.user_id !== user.id
          );
          let unread = 0;
          if (mine) {
            let q = supabase
              .from("chat_messages")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", c.id)
              .neq("sender_id", user.id);
            if (mine.last_read_at) q = q.gt("created_at", mine.last_read_at);
            const { count } = await q;
            unread = count || 0;
            totalUnread += unread;
          }
          const { data: last } = await supabase
            .from("chat_messages")
            .select("body, voice_url, sender_id, created_at")
            .eq("conversation_id", c.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          rows.push({
            conversation_id: c.id,
            with: others.map((o: any) => nameOf(o.user_id)).join(", ") || c.title || "Chat",
            director_is_participant: !!mine,
            unread_for_director: unread,
            last_message_from: last ? nameOf((last as any).sender_id) : null,
            last_message_preview: last
              ? String((last as any).body || ((last as any).voice_url ? "Voice note" : "")).slice(0, 140)
              : null,
            last_message_at: (last as any)?.created_at ?? null,
          });
        }

        const out: any = {
          director_unread_total: totalUnread,
          conversations: rows.slice(0, limit),
        };

        const w = String(args.with_name || "").toLowerCase().trim();
        if (w) {
          const hit = rows.find((r) => r.with.toLowerCase().includes(w));
          if (!hit) {
            out.messages_error = `No conversation found with "${args.with_name}"`;
          } else {
            const { data: msgs } = await supabase
              .from("chat_messages")
              .select("body, voice_url, sender_id, created_at")
              .eq("conversation_id", hit.conversation_id)
              .order("created_at", { ascending: false })
              .limit(20);
            out.conversation_messages = {
              with: hit.with,
              latest_first: (msgs || []).map((m: any) => ({
                from: nameOf(m.sender_id),
                text: m.body || (m.voice_url ? "Voice note" : ""),
                at: m.created_at,
              })),
            };
          }
        }
        return out;
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Tool failed" };
  }
}

// ───────────────── keyword router (used when no LLM key is set) ─────────────────

export function detectToolsFromQuestion(q: string): { name: string; args: ToolArgs }[] {
  const L = q.toLowerCase();
  const tools: { name: string; args: ToolArgs }[] = [];
  let campus = "all";
  if (L.includes("arepo")) campus = "arepo";
  else if (L.includes("ofada") || L.includes("mowe")) campus = "ofada";
  else if (L.includes("main") && !L.includes("remain")) campus = "main";
  else if (L.includes("tutorial")) campus = "tutorial";

  const add = (name: string, args: ToolArgs = {}) => {
    if (!tools.some((t) => t.name === name)) tools.push({ name, args });
  };
  const table = (t: string, extra: ToolArgs = {}) =>
    tools.push({ name: "query_table", args: { table: t, limit: 50, ...extra } });

  if (/secretar|online|logged in|last seen|who is (active|working)/.test(L)) {
    add("get_staff_activity");
  }
  if (/message|unread|\bchat\b|inbox/.test(L)) {
    add("get_messages_overview");
  }
  if (/renew|\bcard|valid|expir/.test(L)) {
    add("get_card_renewals", { campus, include_students: /who|list|name|which/.test(L) });
  }
  if (/attend|present/.test(L)) add("get_attendance_today");
  if (/payment|\bpaid\b|income|money in|collected|revenue/.test(L)) {
    add("get_payments_summary", { campus });
  }
  if (/outstanding|debt|balance|\bowe/.test(L)) add("get_outstanding_summary", { campus });
  if (/exam|jamb|waec|neco/.test(L)) add("get_exam_registration", { campus });
  if (/expense|spend|money out/.test(L)) add("get_expenses_summary", { campus });
  if (/how many (active )?student|student count|enrol|active student/.test(L)) {
    add("get_student_counts", { campus });
  }

  const nameMatch = q.match(
    /(?:about|find|search(?: for)?|look ?up|details? (?:of|for|on)|info(?:rmation)? (?:on|about)|record of|status of)\s+(?:student\s+)?([A-Za-z][A-Za-z' .-]{2,})/i
  );
  if (nameMatch && !tools.some((t) => t.name === "get_card_renewals")) {
    add("search_students", { query: nameMatch[1].trim() });
  }

  if (/salary|salaries|payroll|\bstaff\b|teacher(?!.*pay)/.test(L) && !/secretar/.test(L)) {
    table("staff", { select: "full_name, role, salary, status, campuses(short_name)", filters: [{ column: "status", op: "eq", value: "active" }] });
  }
  if (/loan/.test(L)) table("staff_loans", { select: "principal, monthly_deduction, amount_remaining, status, staff(full_name)" });
  if (/inventory|stock/.test(L)) table("inventory_items", { select: "name, category, quantity, min_stock, selling_price" });
  if (/scholarship/.test(L)) table("scholarships", { select: "status, amount_covered, session, term, students(full_name)" });
  if (/\bbus\b|buses|driver/.test(L)) table("school_buses", { select: "name, plate_number, driver_name, route_name, capacity, bus_fee, is_active" });
  if (/private lesson/.test(L)) table("private_lessons", { select: "student_name, teacher_name, amount_paid, teacher_amount, lesson_date", order_by: { column: "lesson_date", ascending: false } });
  if (/teacher (daily )?pay/.test(L)) table("teacher_payments", { select: "teacher_name, amount, payment_date", order_by: { column: "payment_date", ascending: false } });
  if (/campus|branch(es)?\b.*(list|name)|how many (campus|branch)/.test(L)) add("get_campuses");

  return tools;
}

// ───────────────── plain-text answer (no LLM key) ─────────────────

const naira = (n: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(n || 0);

export function formatToolResultsForAnswer(
  question: string,
  results: { tool: string; data: unknown }[]
): string {
  const parts: string[] = [];
  for (const r of results) {
    const d = r.data as any;
    if (d?.error) {
      parts.push(`I could not read that data (${r.tool}): ${d.error}. I don't have accurate information on it right now.`);
      continue;
    }
    if (r.tool === "get_card_renewals") {
      const t = d.totals || {};
      parts.push(
        `Cards (${d.filter}, as of ${d.as_of}):\n` +
          `• Still valid (active): ${t.still_valid_cards} (expiring today: ${t.expires_today})\n` +
          `• Expiring in next 7 days: ${t.expiring_next_7_days}\n` +
          `• Expired in last 3 days: ${t.expired_last_3_days}\n` +
          `• Older expired: ${t.older_expired}`
      );
      const lines = Object.entries(d.by_branch || {}).map(
        ([n, v]: any) => `  – ${n}: valid ${v.valid}, expires today ${v.expires_today}, expired 3d ${v.expired_3d}`
      );
      if (lines.length) parts.push("By branch:\n" + lines.join("\n"));
      for (const key of ["expiring_today", "expired_recent", "expiring_next_7_days"]) {
        if (Array.isArray(d[key]) && d[key].length)
          parts.push(
            `${key.replace(/_/g, " ")}:\n` +
              d[key].map((s: any) => `  – ${s.student} (${s.campus}) ${s.valid_until}`).join("\n")
          );
      }
    } else if (r.tool === "get_student_counts") {
      parts.push(
        `Active students (${d.filter}):\n` +
          `• Tutorial centres (valid card): ${d.tutorial_active_valid_card?.total}` +
          Object.entries(d.tutorial_active_valid_card?.by_campus || {}).map(([k, v]) => `\n    – ${k}: ${v}`).join("") +
          `\n• Tutorial registered but card expired: ${d.tutorial_registered_but_card_expired?.total}` +
          `\n• Main school registered (status active): ${d.main_registered_active?.total}` +
          `\n• Main school paid fees/tuition: ${d.main_paid_fees_active}` +
          `\n• Dashboard "Active students" total: ${d.dashboard_active_students_total}`
      );
    } else if (r.tool === "get_attendance_today") {
      const lines = (d.branches || []).map((b: any) =>
        b.submitted
          ? `  – ${b.campus}: ${b.present} present${b.enrolled != null ? ` / ${b.enrolled} enrolled` : ""}`
          : `  – ${b.campus}: not submitted`
      );
      parts.push(`Attendance (${d.date}):\n` + lines.join("\n"));
    } else if (r.tool === "get_payments_summary") {
      parts.push(
        `Payments (${d.filter}):\n• Today: ${d.today?.count} payments, ${naira(d.today?.amount_ngn)}\n` +
          `• This month: ${d.this_month?.count} payments, ${naira(d.this_month?.amount_ngn)}` +
          (d.custom_range
            ? `\n• ${d.custom_range.from} → ${d.custom_range.to}: ${d.custom_range.count} payments, ${naira(d.custom_range.amount_ngn)}`
            : "")
      );
    } else if (r.tool === "get_outstanding_summary") {
      parts.push(
        `Outstanding (${d.filter}): ${d.fee_rows_with_balance} fee rows, total ${naira(d.total_outstanding_ngn)}` +
          (d.biggest_balances?.length
            ? "\nBiggest balances:\n" +
              d.biggest_balances.slice(0, 8).map((x: any) => `  – ${x.student} (${x.campus}) ${x.fee}: ${naira(x.balance_ngn)}`).join("\n")
            : "")
      );
    } else if (r.tool === "get_exam_registration") {
      parts.push(
        `Exam registration (${d.filter}): paid ${d.paid}, unpaid ${d.unpaid}, pending board ${d.pending_board_registration}, overdue ${d.overdue_deadlines}`
      );
    } else if (r.tool === "get_expenses_summary") {
      parts.push(`Expenses (${d.filter}): today ${naira(d.today_ngn)}, this month ${naira(d.this_month_ngn)}`);
    } else if (r.tool === "get_staff_activity") {
      const lines = (d.secretaries || []).map(
        (s: any) =>
          `  – ${s.name} (${s.campus || "no campus"}): ${s.status}` +
          (s.last_seen_at ? `, last seen ${s.minutes_since_seen} min ago` : "")
      );
      parts.push(
        (d.tracking_enabled
          ? `Secretaries: ${d.online_now} online now, ${d.active_today} active today.\n`
          : `${d.note}\n`) + lines.join("\n")
      );
    } else if (r.tool === "get_messages_overview") {
      parts.push(
        `Director unread messages: ${d.director_unread_total}\n` +
          (d.conversations || [])
            .slice(0, 10)
            .map((c: any) => `  – ${c.with}: ${c.unread_for_director} unread${c.last_message_preview ? ` · "${c.last_message_preview}"` : ""}`)
            .join("\n")
      );
    } else if (r.tool === "search_students") {
      if (!d.matches?.length) parts.push("No student matched that search.");
      else
        parts.push(
          d.matches
            .map(
              (s: any) =>
                `• ${s.name} — ${s.campus}, ${s.class || s.exam_preparing_for || "no class"}, ${s.status}` +
                (s.card_valid_until ? `, card ${s.card_active ? "active" : "expired"} (${s.card_valid_until})` : "") +
                `, balance ${naira(s.total_balance_ngn)}`
            )
            .join("\n")
        );
    } else if (r.tool === "query_table") {
      const rows = d.rows || [];
      parts.push(
        `${d.table}: ${d.total_matching ?? d.count ?? rows.length} record(s)` +
          (rows.length ? "\n" + rows.slice(0, 25).map((x: any) => "  – " + JSON.stringify(x)).join("\n") : "")
      );
    } else {
      parts.push(`${r.tool}: ${JSON.stringify(d)}`);
    }
  }
  if (!parts.length) return NO_ACCURATE_INFO;
  return parts.join("\n\n");
}
