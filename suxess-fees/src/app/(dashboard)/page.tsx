import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getCurrentProfile, campusFilter, isAdmin } from "@/lib/auth";
import {
  Users,
  CreditCard,
  AlertCircle,
  Wallet,
  CalendarClock,
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  CalendarRange,
  Package,
  Banknote,
  Building2,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { ExportAllData } from "@/components/admin/export-all-data";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function campusLabelOf(profile: Awaited<ReturnType<typeof getCurrentProfile>>) {
  return `${profile?.campuses?.short_name || ""} ${
    profile?.campuses?.name || ""
  }`.toLowerCase();
}

function isTutorialCampus(short?: string | null, name?: string | null) {
  const L = `${short || ""} ${name || ""}`.toLowerCase();
  return (
    L.includes("arepo") || L.includes("ofada") || L.includes("mowe")
  );
}

function isExamFeeName(name?: string | null) {
  if (!name) return false;
  const n = name.toLowerCase();
  return (
    n.includes("jamb") ||
    n.includes("waec") ||
    n.includes("ssce") ||
    n.includes("neco") ||
    n.includes("gce") ||
    n.includes("nabteb") ||
    (n.includes("exam") &&
      (n.includes("regist") || n.includes("form") || n.includes("pin")))
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const campusId = campusFilter(profile);
  const admin = isAdmin(profile);
  const label = campusLabelOf(profile);
  const campusText = `${profile?.campuses?.short_name || ""} ${
    profile?.campuses?.name || ""
  }`.toLowerCase();
  let isTutorial = isTutorialCampus(
    profile?.campuses?.short_name,
    profile?.campuses?.name
  );
  // Fallbacks: short codes / names used in the field
  if (
    !isTutorial &&
    (campusText.includes("arepo") ||
      campusText.includes("ofada") ||
      campusText.includes("mowe") ||
      campusText.includes("tutorial") ||
      campusText.split(/\s+/).includes("of") ||
      campusText.includes("suxessof") ||
      campusText.includes("suxessar"))
  ) {
    isTutorial = true;
  }
  // Secretary with a campus who is not Main → treat as tutorial desk
  const isMainSec =
    !admin &&
    !!profile?.campus_id &&
    !isTutorial &&
    (campusText.includes("main") || campusText.includes("school"));
  // If secretary has campus_id but not identified as main, show tutorial KPIs
  const isTutorialSec = !admin && !!profile?.campus_id && !isMainSec;

  const scopeLabel = admin
    ? "All campuses"
    : profile?.campuses?.short_name ||
      profile?.campuses?.name ||
      "Your campus";

  const now = new Date();
  const today = isoDate(now);
  const monthStart = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const monthLabel = now.toLocaleString("en-NG", {
    month: "long",
    year: "numeric",
  });
  const weekday = now.toLocaleString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const days5Start = isoDate(addDays(now, -4));
  const sixMonthsStart = isoDate(
    new Date(now.getFullYear(), now.getMonth() - 5, 1)
  );
  const in7 = isoDate(addDays(now, 7));

  let studentsCountQ = supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");
  if (campusId) studentsCountQ = studentsCountQ.eq("campus_id", campusId);

  // Active for KPI = paid School Fees or Tuition (Monthly) at least once
  let paidFeesQ = supabase
    .from("student_fees")
    .select(
      "student_id, amount_paid, students!inner(id, campus_id, status), fee_types(name)"
    )
    .gt("amount_paid", 0)
    .eq("students.status", "active");
  if (campusId) paidFeesQ = paidFeesQ.eq("students.campus_id", campusId);

  let outstandingQ = supabase
    .from("student_fees")
    .select(
      "balance, amount, amount_paid, students!inner(campus_id, full_name, campuses(short_name, name))"
    )
    .gt("balance", 0);
  if (campusId) outstandingQ = outstandingQ.eq("students.campus_id", campusId);

  let payTodayQ = supabase
    .from("payments")
    .select(
      "amount, payment_date, students!inner(campus_id, campuses(short_name, name))"
    )
    .is("deleted_at", null)
    .eq("payment_date", today);
  if (campusId) payTodayQ = payTodayQ.eq("students.campus_id", campusId);

  let expTodayQ = supabase
    .from("expenses")
    .select("amount, campus_id")
    .eq("expense_date", today);
  if (campusId) expTodayQ = expTodayQ.eq("campus_id", campusId);

  let teacherPayTodayQ = supabase
    .from("teacher_payments")
    .select("amount, campus_id")
    .eq("payment_date", today);
  if (campusId) teacherPayTodayQ = teacherPayTodayQ.eq("campus_id", campusId);

  let teacherPayMonthQ = supabase
    .from("teacher_payments")
    .select("amount, campus_id, payment_date")
    .gte("payment_date", monthStart)
    .lte("payment_date", monthEnd);
  if (campusId) teacherPayMonthQ = teacherPayMonthQ.eq("campus_id", campusId);



  let scholarshipsActiveQ = supabase
    .from("scholarships")
    .select("id, student_id, session, term, status", { count: "exact" })
    .eq("status", "active");

  let scholarshipsPendingQ = supabase
    .from("scholarships")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_approval");

  let notificationsQ = supabase
    .from("notifications")
    .select("id, title, body, link, created_at, read_at")
    .eq("target_role", "admin")
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  let privateLessonMonthQ = supabase
    .from("private_lessons")
    .select("amount_paid, teacher_amount, lesson_date, campus_id")
    .gte("lesson_date", monthStart)
    .lte("lesson_date", monthEnd);
  if (campusId) privateLessonMonthQ = privateLessonMonthQ.eq("campus_id", campusId);

  let privateLessonTrendQ = supabase
    .from("private_lessons")
    .select("amount_paid, teacher_amount, lesson_date, campus_id")
    .gte("lesson_date", sixMonthsStart);
  if (campusId) privateLessonTrendQ = privateLessonTrendQ.eq("campus_id", campusId);

  
  let privateLessonDueTodayQ = supabase
    .from("private_lessons")
    .select("id, parent_name, student_name, due_date, amount_paid")
    .eq("due_date", today);
  if (campusId) privateLessonDueTodayQ = privateLessonDueTodayQ.eq("campus_id", campusId);

  let privateLessonTodayQ = supabase
    .from("private_lessons")
    .select("amount_paid, teacher_amount, lesson_date, campus_id")
    .eq("lesson_date", today);
  if (campusId) privateLessonTodayQ = privateLessonTodayQ.eq("campus_id", campusId);

  let teacherPayTrendQ = supabase
    .from("teacher_payments")
    .select("amount, campus_id, payment_date")
    .gte("payment_date", sixMonthsStart);
  if (campusId) teacherPayTrendQ = teacherPayTrendQ.eq("campus_id", campusId);

  let studentRowsQ = supabase
    .from("students")
    .select(
      "id, class_name, exam_preparing_for, campus_id, status, campuses(short_name, name)"
    )
    .eq("status", "active");
  if (campusId) studentRowsQ = studentRowsQ.eq("campus_id", campusId);

  let campusesQ = supabase
    .from("campuses")
    .select("id, name, short_name")
    .eq("is_active", true)
    .order("name");

  let payMonthQ = supabase
    .from("payments")
    .select(
      "amount, payment_date, students!inner(campus_id, campuses(short_name, name))"
    )
    .is("deleted_at", null)
    .gte("payment_date", monthStart)
    .lte("payment_date", monthEnd);
  if (campusId) payMonthQ = payMonthQ.eq("students.campus_id", campusId);

  let expMonthQ = supabase
    .from("expenses")
    .select("amount, campus_id, expense_date")
    .gte("expense_date", monthStart)
    .lte("expense_date", monthEnd);
  if (campusId) expMonthQ = expMonthQ.eq("campus_id", campusId);

  let staffQ = supabase
    .from("staff")
    .select("id, full_name, salary, campus_id, status, campuses(short_name, name)")
    .eq("status", "active");

  let payTrendQ = supabase
    .from("payments")
    .select("amount, payment_date, students!inner(campus_id)")
    .is("deleted_at", null)
    .gte("payment_date", sixMonthsStart);
  if (campusId) payTrendQ = payTrendQ.eq("students.campus_id", campusId);

  let expTrendQ = supabase
    .from("expenses")
    .select("amount, expense_date, campus_id")
    .gte("expense_date", sixMonthsStart);
  if (campusId) expTrendQ = expTrendQ.eq("campus_id", campusId);

  let invMonthQ = supabase
    .from("inventory_sales")
    .select("profit, total_price, sale_date, campus_id")
    .gte("sale_date", monthStart)
    .lte("sale_date", monthEnd);

  let invTrendQ = supabase
    .from("inventory_sales")
    .select("profit, total_price, sale_date, campus_id")
    .gte("sale_date", sixMonthsStart);

  let invTodayQ = supabase
    .from("inventory_sales")
    .select("profit, total_price")
    .eq("sale_date", today);

  const threeDaysAgoDash = isoDate(addDays(now, -3));
  let renewalsQ = supabase
    .from("student_fees")
    .select(
      "id, valid_until, amount_paid, amount, fee_types(name), students!inner(full_name, campus_id, status, campuses(short_name, name))"
    )
    .gte("valid_until", threeDaysAgoDash)
    .lte("valid_until", today)
    .eq("students.status", "active")
    .order("valid_until")
    .limit(150);
  if (campusId) renewalsQ = renewalsQ.eq("students.campus_id", campusId);

  let examQ = supabase
    .from("student_fees")
    .select(
      "id, amount_paid, board_registered, board_deadline, fee_types(name), students!inner(full_name, campus_id, status, campuses(short_name, name))"
    )
    .eq("students.status", "active");
  if (campusId) examQ = examQ.eq("students.campus_id", campusId);

  let loansQ = supabase
    .from("staff_loans")
    .select("principal, monthly_deduction, amount_remaining, status, campus_id");

  let recentPayQ = supabase
    .from("payments")
    .select(
      "id, amount, payment_date, receipt_number, students!inner(full_name, campus_id, campuses(short_name, name))"
    )
    .is("deleted_at", null)
    .order("payment_date", { ascending: false })
    .limit(8);
  if (campusId) recentPayQ = recentPayQ.eq("students.campus_id", campusId);

  const [
    { count: registeredStudents },
    { data: paidFeesRows },
    { data: outstandingRaw },
    { data: todayPayments },
    { data: todayExpenses },
    teacherPayTodayRes,
    teacherPayMonthRes,
    scholarshipsActiveRes,
    scholarshipsPendingRes,
    notificationsRes,
    privateLessonMonthRes,
    privateLessonTrendRes,
    privateLessonTodayRes,
    privateLessonDueTodayRes,
    teacherPayTrendRes,
    { data: studentRows },
    { data: campuses },
    { data: monthPayments },
    { data: monthExpenses },
    { data: activeStaff },
    { data: trendPayments },
    { data: trendExpenses },
    invMonthRes,
    invTrendRes,
    invTodayRes,
    { data: renewals },
    { data: examFeesRaw },
    loansRes,
    { data: recentPayments },
  ] = await Promise.all([
    studentsCountQ,
    paidFeesQ,
    outstandingQ,
    payTodayQ,
    expTodayQ,
    teacherPayTodayQ,
    teacherPayMonthQ,
    scholarshipsActiveQ,
    scholarshipsPendingQ,
    notificationsQ,
    privateLessonMonthQ,
    privateLessonTrendQ,
    privateLessonTodayQ,
    privateLessonDueTodayQ,
    teacherPayTrendQ,
    studentRowsQ,
    campusesQ,
    payMonthQ,
    expMonthQ,
    staffQ,
    payTrendQ,
    expTrendQ,
    invMonthQ,
    invTrendQ,
    invTodayQ,
    renewalsQ,
    examQ,
    loansQ,
    recentPayQ,
  ]);

  const outstanding = (outstandingRaw || []).filter((f: any) => {
    const st = Array.isArray(f.students) ? f.students[0] : f.students;
    const c = Array.isArray(st?.campuses) ? st?.campuses[0] : st?.campuses;
    return !isTutorialCampus(c?.short_name, c?.name);
  });

  const examFees = (examFeesRaw || []).filter((f: any) => {
    const ft = Array.isArray(f.fee_types) ? f.fee_types[0] : f.fee_types;
    return isExamFeeName(ft?.name);
  });
  const examPendingBoard = examFees.filter(
    (f: any) => Number(f.amount_paid) > 0 && !f.board_registered
  ).length;
  const examUnpaid = examFees.filter(
    (f: any) => Number(f.amount_paid) <= 0
  ).length;
  const overdueExams = examFees.filter((f: any) => {
    if (f.board_registered) return false;
    if (!f.board_deadline) return false;
    return String(f.board_deadline) <= today;
  });

  const renewalsNonExam = (renewals || []).filter((r: any) => {
    const ft = Array.isArray(r.fee_types) ? r.fee_types[0] : r.fee_types;
    const n = String(ft?.name || "").toLowerCase();
    const isExam =
      n.includes("jamb") ||
      n.includes("waec") ||
      n.includes("neco") ||
      n.includes("gce") ||
      n.includes("bece");
    return !isExam;
  });
  const renewalsDueToday = renewalsNonExam.filter(
    (r: any) => r.valid_until === today
  );
  const expiredCardsRecent = renewalsNonExam.filter(
    (r: any) => r.valid_until && r.valid_until < today
  );
  let renewArepo = 0;
  let renewOfada = 0;
  let renewOther = 0;
  for (const r of renewalsDueToday) {
    const st = Array.isArray(r.students) ? r.students[0] : r.students;
    const c = Array.isArray(st?.campuses) ? st?.campuses[0] : st?.campuses;
    const L = `${c?.short_name || ""} ${c?.name || ""}`.toLowerCase();
    if (L.includes("arepo")) renewArepo += 1;
    else if (L.includes("ofada") || L.includes("mowe")) renewOfada += 1;
    else renewOther += 1;
  }
  let expArepo = 0;
  let expOfada = 0;
  for (const r of expiredCardsRecent) {
    const st = Array.isArray(r.students) ? r.students[0] : r.students;
    const c = Array.isArray(st?.campuses) ? st?.campuses[0] : st?.campuses;
    const L = `${c?.short_name || ""} ${c?.name || ""}`.toLowerCase();
    if (L.includes("arepo")) expArepo += 1;
    else if (L.includes("ofada") || L.includes("mowe")) expOfada += 1;
  }


  const payingStudentIds = new Set<string>();
  for (const row of (paidFeesRows || []) as any[]) {
    const ft = Array.isArray(row.fee_types) ? row.fee_types[0] : row.fee_types;
    const n = String(ft?.name || "").toLowerCase();
    const isSchoolOrTuition =
      n.includes("school fee") ||
      n === "school fees" ||
      n.includes("tuition");
    if (!isSchoolOrTuition) continue;
    const st = Array.isArray(row.students) ? row.students[0] : row.students;
    const sid = String(row.student_id || st?.id || "");
    if (sid) payingStudentIds.add(sid);
  }
  const totalStudents = payingStudentIds.size;
  const registeredTotal = registeredStudents ?? 0;
  const totalOutstanding = outstanding.reduce(
    (s: number, f: any) => s + Number(f.balance || 0),
    0
  );
  const debtorsCount = outstanding.length;
  const scholarshipCount =
    scholarshipsActiveRes?.count ??
    (scholarshipsActiveRes?.data || []).length;
  const scholarshipPendingCount = scholarshipsPendingRes?.count ?? 0;
  const adminNotifications = notificationsRes?.data || [];


  const incomeToday =
    todayPayments?.reduce((s, p) => s + Number(p.amount || 0), 0) || 0;
  const expensesTodayAmt =
    todayExpenses?.reduce((s, e) => s + Number(e.amount || 0), 0) || 0;
  const teacherPayTodayAmt = (teacherPayTodayRes?.data || []).reduce(
    (s: number, r: any) => s + Number(r.amount || 0),
    0
  );

  const privateLessonTodayProfit = (privateLessonTodayRes?.data || []).reduce(
    (s: number, r: any) =>
      s + (Number(r.amount_paid || 0) - Number(r.teacher_amount || 0)),
    0
  );
  const privateLessonDueTodayCount = (privateLessonDueTodayRes?.data || []).length;
  const privateLessonMonthProfit = (privateLessonMonthRes?.data || []).reduce(
    (s: number, r: any) =>
      s + (Number(r.amount_paid || 0) - Number(r.teacher_amount || 0)),
    0
  );

  const teacherPayMonthAmt = (teacherPayMonthRes?.data || []).reduce(
    (s: number, r: any) => s + Number(r.amount || 0),
    0
  );

  const monthInvSales = invMonthRes?.data || [];
  const todayInvSales = invTodayRes?.data || [];
  const inventoryProfitMonth = monthInvSales.reduce(
    (s: number, r: any) => s + Number(r.profit || 0),
    0
  );
  const inventoryRevenueMonth = monthInvSales.reduce(
    (s: number, r: any) => s + Number(r.total_price || 0),
    0
  );
  const inventoryProfitToday = todayInvSales.reduce(
    (s: number, r: any) => s + Number(r.profit || 0),
    0
  );
  const inventoryRevenueToday = todayInvSales.reduce(
    (s: number, r: any) => s + Number(r.total_price || 0),
    0
  );

  const privateLessonInToday = (privateLessonTodayRes?.data || []).reduce(
    (s: number, r: any) => s + Number(r.amount_paid || 0),
    0
  );
  const privateLessonOutToday = (privateLessonTodayRes?.data || []).reduce(
    (s: number, r: any) => s + Number(r.teacher_amount || 0),
    0
  );
  const privateLessonInMonth = (privateLessonMonthRes?.data || []).reduce(
    (s: number, r: any) => s + Number(r.amount_paid || 0),
    0
  );
  const privateLessonOutMonth = (privateLessonMonthRes?.data || []).reduce(
    (s: number, r: any) => s + Number(r.teacher_amount || 0),
    0
  );

  // Cashflow board: money in / money out / net
  const moneyInToday =
    incomeToday + inventoryRevenueToday + privateLessonInToday;
  const moneyOutToday =
    expensesTodayAmt + teacherPayTodayAmt + privateLessonOutToday;
  const netToday = moneyInToday - moneyOutToday;

  const totalIncomeMonth =
    monthPayments?.reduce((s, p) => s + Number(p.amount || 0), 0) || 0;
  const totalExpensesMonth =
    monthExpenses?.reduce((s, e) => s + Number(e.amount || 0), 0) || 0;

  const moneyInMonth =
    totalIncomeMonth + inventoryRevenueMonth + privateLessonInMonth;
  const moneyOutMonth =
    totalExpensesMonth + teacherPayMonthAmt + privateLessonOutMonth;
  // Operational net (cash movement) — staff salary line kept separate as planned cost
  const netMonthOps = moneyInMonth - moneyOutMonth;

  const totalPayroll =
    activeStaff?.reduce((s, x) => s + Number(x.salary || 0), 0) || 0;
  const allLoans = loansRes?.data || [];
  const activeLoans = allLoans.filter((l: any) => l.status === "active");
  const loanDeductionsMonth = activeLoans.reduce(
    (s: number, l: any) => s + Number(l.monthly_deduction || 0),
    0
  );
  // Still owed by staff (falls as "Apply this month" runs)
  const loanOutstanding = activeLoans.reduce(
    (s: number, l: any) => s + Number(l.amount_remaining || 0),
    0
  );
  // Original total given out (all loans ever recorded)
  const loanTotalGiven = allLoans.reduce(
    (s: number, l: any) => s + Number(l.principal || 0),
    0
  );
  // How much has been paid back so far
  const loanRecovered = allLoans.reduce((s: number, l: any) => {
    const principal = Number(l.principal || 0);
    const remaining =
      l.status === "cancelled"
        ? principal
        : Number(l.amount_remaining ?? principal);
    return s + Math.max(0, principal - remaining);
  }, 0);

  const profitToday =
    incomeToday - expensesTodayAmt - teacherPayTodayAmt + inventoryProfitToday + privateLessonTodayProfit;
  const profitMonth =
    totalIncomeMonth -
    totalExpensesMonth -
    totalPayroll -
    teacherPayMonthAmt +
    inventoryProfitMonth +
    privateLessonMonthProfit;

  // Per-campus snapshot
  type CampSnap = {
    id: string;
    name: string;
    short: string;
    tutorial: boolean;
    students: number;
    incomeToday: number;
    incomeMonth: number;
    expensesMonth: number;
    payroll: number;
    profitMonth: number;
    renewalsDue: number;
    examPending: number;
  };

  const snaps = new Map<string, CampSnap>();
  for (const c of campuses || []) {
    snaps.set(c.id, {
      id: c.id,
      name: c.name,
      short: c.short_name || c.name,
      tutorial: isTutorialCampus(c.short_name, c.name),
      students: 0,
      incomeToday: 0,
      incomeMonth: 0,
      expensesMonth: 0,
      payroll: 0,
      profitMonth: 0,
      renewalsDue: 0,
      examPending: 0,
    });
  }

  for (const s of studentRows || []) {
    const id = s.campus_id as string;
    if (id && snaps.has(id)) snaps.get(id)!.students += 1;
  }
  for (const p of todayPayments || []) {
    const id = (p.students as any)?.campus_id;
    if (id && snaps.has(id))
      snaps.get(id)!.incomeToday += Number(p.amount || 0);
  }
  for (const p of monthPayments || []) {
    const id = (p.students as any)?.campus_id;
    if (id && snaps.has(id))
      snaps.get(id)!.incomeMonth += Number(p.amount || 0);
  }
  for (const e of monthExpenses || []) {
    const id = e.campus_id as string;
    if (id && snaps.has(id))
      snaps.get(id)!.expensesMonth += Number(e.amount || 0);
  }
  for (const e of teacherPayMonthRes?.data || []) {
    const id = e.campus_id as string;
    if (id && snaps.has(id))
      snaps.get(id)!.expensesMonth += Number(e.amount || 0);
  }
  for (const s of activeStaff || []) {
    const id = s.campus_id as string;
    if (id && snaps.has(id))
      snaps.get(id)!.payroll += Number(s.salary || 0);
  }
  for (const r of renewals || []) {
    const st = Array.isArray(r.students) ? r.students[0] : r.students;
    const id = st?.campus_id as string;
    if (id && snaps.has(id)) snaps.get(id)!.renewalsDue += 1;
  }
  for (const f of examFees) {
    if (!(Number(f.amount_paid) > 0 && !f.board_registered)) continue;
    const st = Array.isArray(f.students) ? f.students[0] : f.students;
    const id = st?.campus_id as string;
    if (id && snaps.has(id)) snaps.get(id)!.examPending += 1;
  }
  const campusSnaps = Array.from(snaps.values()).map((c) => ({
    ...c,
    profitMonth: c.incomeMonth - c.expensesMonth - c.payroll,
  }));

  // Class / exam breakdown for secretary
  const classMap = new Map<string, number>();
  const examMap = new Map<string, number>();
  for (const s of studentRows || []) {
    const camp = Array.isArray(s.campuses) ? s.campuses[0] : s.campuses;
    const tut = isTutorialCampus(camp?.short_name, camp?.name);
    if (tut || isTutorial) {
      const ex = String(s.exam_preparing_for || "Not set").trim() || "Not set";
      examMap.set(ex, (examMap.get(ex) || 0) + 1);
    } else {
      const cn = String(s.class_name || "Unassigned").trim() || "Unassigned";
      classMap.set(cn, (classMap.get(cn) || 0) + 1);
    }
  }
  const classRows = Array.from(classMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const examPrepRows = Array.from(examMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Daily 14 days
  const dailyMap = new Map<
    string,
    { date: string; income: number; expenses: number; profit: number }
  >();
  for (let i = 4; i >= 0; i--) {
    const d = isoDate(addDays(now, -i));
    dailyMap.set(d, { date: d, income: 0, expenses: 0, profit: 0 });
  }
  for (const p of trendPayments || []) {
    const d = String(p.payment_date || "").slice(0, 10);
    if (dailyMap.has(d))
      dailyMap.get(d)!.income += Number(p.amount || 0);
  }
  for (const e of trendExpenses || []) {
    const d = String(e.expense_date || "").slice(0, 10);
    if (dailyMap.has(d))
      dailyMap.get(d)!.expenses += Number(e.amount || 0);
  }
  const dailyRows = Array.from(dailyMap.values()).map((r) => ({
    ...r,
    profit: r.income - r.expenses,
  }));

  // Monthly analysis (last 6 months) — uses payment_date / expense_date so
  // backdated entries land in the correct month for the director.
  const monthlyAnalysis: {
    key: string;
    label: string;
    isCurrent: boolean;
    isLast: boolean;
    moneyIn: number;
    feesIn: number;
    inventoryIn: number;
    privateIn: number;
    moneyOut: number;
    expensesOut: number;
    teacherOut: number;
    privateOut: number;
    profit: number;
  }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-NG", { month: "short", year: "numeric" });
    monthlyAnalysis.push({
      key,
      label,
      isCurrent: i === 0,
      isLast: i === 1,
      moneyIn: 0,
      feesIn: 0,
      inventoryIn: 0,
      privateIn: 0,
      moneyOut: 0,
      expensesOut: 0,
      teacherOut: 0,
      privateOut: 0,
      profit: 0,
    });
  }
  const monthMap = new Map(monthlyAnalysis.map((m) => [m.key, m]));
  for (const p of trendPayments || []) {
    const key = String(p.payment_date || "").slice(0, 7);
    const m = monthMap.get(key);
    if (m) {
      const a = Number(p.amount || 0);
      m.feesIn += a;
      m.moneyIn += a;
    }
  }
  for (const e of trendExpenses || []) {
    const key = String(e.expense_date || "").slice(0, 7);
    const m = monthMap.get(key);
    if (m) {
      const a = Number(e.amount || 0);
      m.expensesOut += a;
      m.moneyOut += a;
    }
  }
  for (const e of teacherPayTrendRes?.data || []) {
    const key = String(e.payment_date || "").slice(0, 7);
    const m = monthMap.get(key);
    if (m) {
      const a = Number(e.amount || 0);
      m.teacherOut += a;
      m.moneyOut += a;
    }
  }
  for (const e of invTrendRes?.data || []) {
    const key = String(e.sale_date || "").slice(0, 7);
    const m = monthMap.get(key);
    if (m) {
      const a = Number(e.total_price || 0);
      m.inventoryIn += a;
      m.moneyIn += a;
    }
  }
  for (const e of privateLessonTrendRes?.data || []) {
    const key = String(e.lesson_date || "").slice(0, 7);
    const m = monthMap.get(key);
    if (m) {
      const pin = Number(e.amount_paid || 0);
      const pout = Number(e.teacher_amount || 0);
      m.privateIn += pin;
      m.privateOut += pout;
      m.moneyIn += pin;
      m.moneyOut += pout;
    }
  }
  for (const m of monthlyAnalysis) {
    m.profit = m.moneyIn - m.moneyOut;
  }
  const lastMonthStats = monthlyAnalysis.find((m) => m.isLast);
  const thisMonthStats = monthlyAnalysis.find((m) => m.isCurrent);


  const paymentCountToday = todayPayments?.length || 0;

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-green">
            {admin ? "Executive overview" : "Campus desk"}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
            Dashboard
          </h1>
          <p className="text-gray-500 mt-1">
            {weekday}
            <span className="text-gray-300 mx-2">·</span>
            {admin ? "All three campuses" : scopeLabel}
          </p>
        </div>
        {admin && (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/payments"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-green text-white text-sm font-medium hover:bg-brand-dark"
            >
              Record payment <ArrowUpRight className="w-4 h-4" />
            </Link>
            <Link
              href="/outstanding"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Outstanding
            </Link>
          </div>
        )}
      </div>

      {/* Overdue exam deadlines — blink for admin + main */}
      {(admin || isMainSec) && overdueExams.length > 0 && (
        <div className="mb-6 rounded-2xl border-2 border-red-500 bg-red-50 p-4 animate-pulse">
          <p className="font-bold text-red-800 text-sm sm:text-base">
            URGENT: {overdueExams.length} exam registration deadline
            {overdueExams.length === 1 ? " has" : "s have"} passed — complete board registration as soon as possible
          </p>
          <ul className="mt-2 text-sm text-red-700 space-y-1">
            {overdueExams.slice(0, 8).map((f: any) => {
              const st = Array.isArray(f.students) ? f.students[0] : f.students;
              const ft = Array.isArray(f.fee_types) ? f.fee_types[0] : f.fee_types;
              return (
                <li key={f.id}>
                  {st?.full_name} · {ft?.name || "Exam"} · deadline{" "}
                  {f.board_deadline}
                </li>
              );
            })}
          </ul>
          <Link
            href="/exam-register"
            className="inline-block mt-3 text-sm font-semibold text-red-800 underline"
          >
            Open Exam Register →
          </Link>
        </div>
      )}

      {/* ========== ADMIN EXECUTIVE VIEW ========== */}
      {admin && (
        <div id="admin-privacy-root">
          {(scholarshipPendingCount > 0 || adminNotifications.length > 0) && (
            <div className="mb-6 bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
              <p className="font-bold text-amber-950 text-sm">
                Director notifications
              </p>
              {scholarshipPendingCount > 0 && (
                <p className="text-sm text-amber-900 mt-1">
                  {scholarshipPendingCount} scholarship
                  {scholarshipPendingCount === 1 ? "" : "s"} waiting for your
                  approval (fees already paid — approve to subtract from school
                  income).{" "}
                  <Link
                    href="/scholarships"
                    className="font-semibold text-brand-green underline"
                  >
                    Review now
                  </Link>
                </p>
              )}
              {adminNotifications.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-amber-900">
                  {adminNotifications.slice(0, 5).map((n: any) => (
                    <li key={n.id}>
                      <span className="font-medium">{n.title}</span>
                      {n.body ? ` — ${n.body}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {/* ===== MONEY IN / MONEY OUT ===== */}
          <div className="mb-2">
            <h2 className="text-lg font-bold text-gray-900">Cashflow</h2>
            <p className="text-sm text-gray-500">
              Money in, money out, and net — today and this month
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-800">
                Money in · today
              </p>
              <p className="text-3xl font-bold text-green-700 mt-2">
                {formatCurrency(moneyInToday)}
              </p>
              <ul className="mt-3 text-xs text-gray-600 space-y-1">
                <li className="flex justify-between gap-2">
                  <span>Student fees</span>
                  <span className="font-medium">{formatCurrency(incomeToday)}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>Inventory sales</span>
                  <span className="font-medium">
                    {formatCurrency(inventoryRevenueToday)}
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>Private lessons (parents)</span>
                  <span className="font-medium">
                    {formatCurrency(privateLessonInToday)}
                  </span>
                </li>
              </ul>
            </div>
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-800">
                Money out · today
              </p>
              <p className="text-3xl font-bold text-red-700 mt-2">
                {formatCurrency(moneyOutToday)}
              </p>
              <ul className="mt-3 text-xs text-gray-600 space-y-1">
                <li className="flex justify-between gap-2">
                  <span>Branch expenses</span>
                  <span className="font-medium">
                    {formatCurrency(expensesTodayAmt)}
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>Teacher daily pay</span>
                  <span className="font-medium">
                    {formatCurrency(teacherPayTodayAmt)}
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>Private lesson teachers</span>
                  <span className="font-medium">
                    {formatCurrency(privateLessonOutToday)}
                  </span>
                </li>
              </ul>
            </div>
            <div
              className={`rounded-2xl border shadow-sm p-5 ${
                netToday >= 0
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                Net · today
              </p>
              <p
                className={`text-3xl font-bold mt-2 flex items-center gap-2 ${
                  netToday >= 0 ? "text-green-800" : "text-red-800"
                }`}
              >
                {netToday >= 0 ? (
                  <TrendingUp className="w-6 h-6" />
                ) : (
                  <TrendingDown className="w-6 h-6" />
                )}
                {formatCurrency(netToday)}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Money in − money out
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {paymentCountToday} fee payment
                {paymentCountToday === 1 ? "" : "s"} today
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-800">
                Money in · {monthLabel}
              </p>
              <p className="text-3xl font-bold text-green-700 mt-2">
                {formatCurrency(moneyInMonth)}
              </p>
              <ul className="mt-3 text-xs text-gray-600 space-y-1">
                <li className="flex justify-between gap-2">
                  <span>Student fees</span>
                  <span className="font-medium">
                    {formatCurrency(totalIncomeMonth)}
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>Inventory sales</span>
                  <span className="font-medium">
                    {formatCurrency(inventoryRevenueMonth)}
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>Private lessons (parents)</span>
                  <span className="font-medium">
                    {formatCurrency(privateLessonInMonth)}
                  </span>
                </li>
              </ul>
            </div>
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-800">
                Money out · {monthLabel}
              </p>
              <p className="text-3xl font-bold text-red-700 mt-2">
                {formatCurrency(moneyOutMonth)}
              </p>
              <ul className="mt-3 text-xs text-gray-600 space-y-1">
                <li className="flex justify-between gap-2">
                  <span>Branch expenses</span>
                  <span className="font-medium">
                    {formatCurrency(totalExpensesMonth)}
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>Teacher daily pay</span>
                  <span className="font-medium">
                    {formatCurrency(teacherPayMonthAmt)}
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>Private lesson teachers</span>
                  <span className="font-medium">
                    {formatCurrency(privateLessonOutMonth)}
                  </span>
                </li>
              </ul>
            </div>
            <div
              className={`rounded-2xl border shadow-sm p-5 ${
                netMonthOps >= 0
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                Net · {monthLabel}
              </p>
              <p
                className={`text-3xl font-bold mt-2 ${
                  netMonthOps >= 0 ? "text-green-800" : "text-red-800"
                }`}
              >
                {formatCurrency(netMonthOps)}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Operational net (before full staff salary line)
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Staff salaries on books: {formatCurrency(totalPayroll)}
              </p>
            </div>
          </div>

          {/* Monthly stats — includes last month (backdated dates) */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Monthly statistics</h2>
                <p className="text-sm text-gray-500">
                  Based on the date on each payment/expense (not when it was typed).
                  Last month appears if secretaries entered past dates.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {thisMonthStats && (
                <div className="bg-white rounded-2xl border-2 border-brand-green/30 shadow-sm p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                    This month · {thisMonthStats.label}
                  </p>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div>
                      <p className="text-xs text-gray-500">Money in</p>
                      <p className="text-lg font-bold text-green-700">
                        {formatCurrency(thisMonthStats.moneyIn)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Expenses + pay out</p>
                      <p className="text-lg font-bold text-red-700">
                        {formatCurrency(thisMonthStats.moneyOut)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Profit</p>
                      <p
                        className={`text-lg font-bold ${
                          thisMonthStats.profit >= 0
                            ? "text-green-800"
                            : "text-red-800"
                        }`}
                      >
                        {formatCurrency(thisMonthStats.profit)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {lastMonthStats && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Last month · {lastMonthStats.label}
                  </p>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div>
                      <p className="text-xs text-gray-500">Money in</p>
                      <p className="text-lg font-bold text-green-700">
                        {formatCurrency(lastMonthStats.moneyIn)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Expenses + pay out</p>
                      <p className="text-lg font-bold text-red-700">
                        {formatCurrency(lastMonthStats.moneyOut)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Profit</p>
                      <p
                        className={`text-lg font-bold ${
                          lastMonthStats.profit >= 0
                            ? "text-green-800"
                            : "text-red-800"
                        }`}
                      >
                        {formatCurrency(lastMonthStats.profit)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b bg-gray-50">
                <h3 className="font-semibold text-gray-900 text-sm">
                  Last 6 months
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-gray-500 bg-white">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Month</th>
                      <th className="text-right px-4 py-2 font-medium">Money in</th>
                      <th className="text-right px-4 py-2 font-medium">Money out</th>
                      <th className="text-right px-4 py-2 font-medium">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[...monthlyAnalysis].reverse().map((m) => (
                      <tr
                        key={m.key}
                        className={
                          m.isCurrent
                            ? "bg-green-50/50"
                            : m.isLast
                              ? "bg-gray-50"
                              : "hover:bg-gray-50"
                        }
                      >
                        <td className="px-4 py-2.5 font-medium">
                          {m.label}
                          {m.isCurrent && (
                            <span className="ml-2 text-[10px] uppercase text-brand-green">
                              current
                            </span>
                          )}
                          {m.isLast && (
                            <span className="ml-2 text-[10px] uppercase text-gray-400">
                              last
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-green-700 font-medium">
                          {formatCurrency(m.moneyIn)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-red-700 font-medium">
                          {formatCurrency(m.moneyOut)}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-bold ${
                            m.profit >= 0 ? "text-green-800" : "text-red-800"
                          }`}
                        >
                          {formatCurrency(m.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Snapshot ops */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase tracking-wide">
                <Users className="w-3.5 h-3.5" /> Active students
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {totalStudents ?? 0}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {registeredTotal} registered
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" /> Outstanding (Main)
              </div>
              <p className="text-2xl font-bold text-red-700 mt-2">
                {formatCurrency(totalOutstanding)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {debtorsCount} open ·{" "}
                <Link href="/outstanding" className="text-brand-green font-medium">
                  View
                </Link>
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Package className="w-4 h-4" /> Inventory profit (month)
              </div>
              <p className="text-2xl font-bold text-green-700 mt-2">
                {formatCurrency(inventoryProfitMonth)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Sales {formatCurrency(inventoryRevenueMonth)}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5">
              <div className="flex items-center gap-2 text-blue-800 text-sm">
                Scholarships (active)
              </div>
              <p className="text-2xl font-bold text-blue-900 mt-2">
                {scholarshipCount}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Students on scholarship ·{" "}
                <Link href="/scholarships" className="text-brand-green font-medium">
                  Manage
                </Link>
                {" · "}
                <Link href="/fee-tracker" className="text-brand-green font-medium">
                  Tracker
                </Link>
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
              <div className="flex items-center gap-2 text-amber-800 text-sm">
                <Banknote className="w-4 h-4" /> Loans outstanding
              </div>
              <p className="text-2xl font-bold text-amber-900 mt-2">
                {formatCurrency(loanOutstanding)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                <Link href="/loans" className="text-brand-green font-medium">
                  Manage loans
                </Link>
              </p>
            </div>
          </div>

          {/* Teacher daily pay KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Banknote className="w-4 h-4" /> Teacher pay today
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(teacherPayTodayAmt)}
              </p>
              <p className="text-xs text-gray-400 mt-1">All tutorial branches</p>
              <Link
                href="/teacher-pay"
                className="text-sm text-brand-green font-medium mt-2 inline-block hover:underline"
              >
                View by campus →
              </Link>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Banknote className="w-4 h-4" /> Teacher pay this month
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(teacherPayMonthAmt)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Included in profit calculation</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Building2 className="w-4 h-4" /> Track teacher costs
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Arepo and Ofada are listed separately on the Teacher daily pay
                page with daily totals.
              </p>
              <Link
                href="/teacher-pay"
                className="text-sm text-brand-green font-medium mt-2 inline-block hover:underline"
              >
                Open Teacher daily pay →
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                Private lesson profit (month)
              </div>
              <p className="text-2xl font-bold text-green-700 mt-2">
                {formatCurrency(privateLessonMonthProfit)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Today {formatCurrency(privateLessonTodayProfit)}
                {privateLessonDueTodayCount > 0 && (
                  <span className="block text-amber-700 font-medium mt-0.5">
                    {privateLessonDueTodayCount} due today
                  </span>
                )}
              </p>
              <Link
                href="/private-lessons"
                className="text-sm text-brand-green font-medium mt-2 inline-block hover:underline"
              >
                Private lessons →
              </Link>
            </div>

          </div>

          {/* Three branch cards */}
          <div className="mb-2 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-green" />
            <h2 className="text-lg font-semibold text-gray-900">
              Branch performance
            </h2>
            <span className="text-sm text-gray-400">· {monthLabel}</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Income, costs and alerts for each campus at a glance
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
            {campusSnaps.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="px-5 py-4 bg-brand-green text-white">
                  <p className="text-xs uppercase tracking-wide text-green-100">
                    {c.tutorial ? "Tutorial centre" : "School"}
                  </p>
                  <p className="text-xl font-bold mt-0.5">{c.short}</p>
                  <p className="text-sm text-green-100 truncate">{c.name}</p>
                </div>
                <div className="p-5 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Students</span>
                    <span className="font-semibold">{c.students}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Collected today</span>
                    <span className="font-semibold">
                      {formatCurrency(c.incomeToday)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Income (month)</span>
                    <span className="font-semibold">
                      {formatCurrency(c.incomeMonth)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Expenses (month)</span>
                    <span className="font-semibold">
                      {formatCurrency(c.expensesMonth)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Staff payroll</span>
                    <span className="font-semibold">
                      {formatCurrency(c.payroll)}
                    </span>
                  </div>
                  <div className="pt-3 border-t flex justify-between items-center">
                    <span className="text-gray-600 font-medium">
                      Net this month
                    </span>
                    <span
                      className={`text-lg font-bold ${
                        c.profitMonth >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {formatCurrency(c.profitMonth)}
                    </span>
                  </div>
                  {(c.renewalsDue > 0 || c.examPending > 0) && (
                    <div className="pt-2 space-y-1 text-xs">
                      {c.renewalsDue > 0 && (
                        <p className="text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
                          {c.renewalsDue} card renewal
                          {c.renewalsDue === 1 ? "" : "s"} due today
                        </p>
                      )}
                      {c.examPending > 0 && (
                        <p className="text-blue-800 bg-blue-50 rounded-lg px-2 py-1">
                          {c.examPending} exam fee
                          {c.examPending === 1 ? "" : "s"} awaiting board reg.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {campusSnaps.length === 0 && (
              <p className="text-gray-400 text-sm col-span-3">
                No campuses found. Add Main, Arepo and Ofada in Supabase.
              </p>
            )}
          </div>

          {/* Comparison table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">
                Campus comparison
              </h2>
              <p className="text-sm text-gray-500">
                Side-by-side for {monthLabel}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">Campus</th>
                    <th className="text-right px-5 py-3 font-medium">Students</th>
                    <th className="text-right px-5 py-3 font-medium">Today</th>
                    <th className="text-right px-5 py-3 font-medium">Income</th>
                    <th className="text-right px-5 py-3 font-medium">Expenses</th>
                    <th className="text-right px-5 py-3 font-medium">Payroll</th>
                    <th className="text-right px-5 py-3 font-medium">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {campusSnaps.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/80">
                      <td className="px-5 py-3">
                        <span className="font-semibold text-gray-900">
                          {c.short}
                        </span>
                        <span className="block text-xs text-gray-400">
                          {c.tutorial ? "Tutorial" : "School"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">{c.students}</td>
                      <td className="px-5 py-3 text-right">
                        {formatCurrency(c.incomeToday)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {formatCurrency(c.incomeMonth)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {formatCurrency(c.expensesMonth)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {formatCurrency(c.payroll)}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-bold ${
                          c.profitMonth >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {formatCurrency(c.profitMonth)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operations alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardCheck className="w-5 h-5 text-brand-green" />
                <h3 className="font-semibold text-gray-900">Exam registration</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total exam fee records</span>
                  <span className="font-semibold">{examFees.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Paid · board pending</span>
                  <span className="font-semibold text-amber-700">
                    {examPendingBoard}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Not paid</span>
                  <span className="font-semibold text-red-600">{examUnpaid}</span>
                </div>
              </div>
              <Link
                href="/exam-register"
                className="inline-block mt-4 text-sm font-medium text-brand-green hover:underline"
              >
                Open Exam Register →
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <CalendarClock className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-gray-900">Cards due & expired</h3>
              </div>
              <p className="text-3xl font-bold text-amber-800">
                {renewalsDueToday.length}
                <span className="text-base font-medium text-gray-500"> due today</span>
              </p>
              <p className="text-2xl font-bold text-red-700 mt-1">
                {expiredCardsRecent.length}
                <span className="text-sm font-medium text-gray-500"> expired (3 days)</span>
              </p>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Arepo due / expired</span>
                  <span className="font-bold text-gray-900">
                    {renewArepo} / {expArepo}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ofada due / expired</span>
                  <span className="font-bold text-gray-900">
                    {renewOfada} / {expOfada}
                  </span>
                </div>
              </div>
              <Link
                href="/renewals"
                className="inline-block mt-4 text-sm font-medium text-brand-green hover:underline"
              >
                View renewals →
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Banknote className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Staff & loans</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Active staff</span>
                  <span className="font-semibold">
                    {activeStaff?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Monthly payroll</span>
                  <span className="font-semibold">
                    {formatCurrency(totalPayroll)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Loan deductions / mo</span>
                  <span className="font-semibold text-red-700">
                    −{formatCurrency(loanDeductionsMonth)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total given out</span>
                  <span className="font-semibold">
                    {formatCurrency(loanTotalGiven)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Recovered so far</span>
                  <span className="font-semibold text-green-700">
                    {formatCurrency(loanRecovered)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Still outstanding</span>
                  <span className="font-semibold text-amber-800">
                    {formatCurrency(loanOutstanding)}
                  </span>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Link
                  href="/staff"
                  className="text-sm font-medium text-brand-green hover:underline"
                >
                  Staff →
                </Link>
                <Link
                  href="/loans"
                  className="text-sm font-medium text-brand-green hover:underline"
                >
                  Loans →
                </Link>
              </div>
            </div>
          </div>

          {/* Recent payments + daily trend */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">Recent payments</h3>
                <Link
                  href="/receipts"
                  className="text-sm text-brand-green font-medium hover:underline"
                >
                  All receipts →
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {(recentPayments || []).length > 0 ? (
                  (recentPayments || []).map((p: any) => {
                    const st = Array.isArray(p.students)
                      ? p.students[0]
                      : p.students;
                    const c = Array.isArray(st?.campuses)
                      ? st?.campuses[0]
                      : st?.campuses;
                    return (
                      <div
                        key={p.id}
                        className="px-5 py-3 flex justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {st?.full_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {c?.short_name || c?.name || "—"} ·{" "}
                            {p.payment_date}
                            {p.receipt_number ? ` · ${p.receipt_number}` : ""}
                          </p>
                        </div>
                        <p className="font-semibold text-green-700 shrink-0">
                          {formatCurrency(Number(p.amount || 0))}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <p className="px-5 py-10 text-center text-gray-400 text-sm">
                    No payments yet
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h3 className="font-semibold text-gray-900">
                  Daily result (last 5 days)
                </h3>
                <p className="text-xs text-gray-500">Income − expenses</p>
              </div>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">
                        Date
                      </th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">
                        In
                      </th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">
                        Out
                      </th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">
                        Net
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[...dailyRows].reverse().map((r) => (
                      <tr key={r.date}>
                        <td className="px-4 py-2 text-gray-700">{r.date}</td>
                        <td className="px-4 py-2 text-right">
                          {formatCurrency(r.income)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {formatCurrency(r.expenses)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-medium ${
                            r.profit >= 0 ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          {formatCurrency(r.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="mb-8">
            <ExportAllData />
          </div>
        </div>
      )}

      {/* ========== SECRETARY VIEW ========== */}
      {!admin && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <p className="text-sm text-gray-500">Active students (paid fees/tuition)</p>
              <p className="text-2xl font-bold mt-1">{totalStudents ?? 0}</p>
              <p className="text-xs text-gray-400 mt-1">{registeredTotal} registered</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <p className="text-sm text-gray-500">Collected today</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(incomeToday)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <p className="text-sm text-gray-500">Expenses today</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(expensesTodayAmt)}
              </p>
            </div>
            {isMainSec && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <p className="text-sm text-gray-500">Outstanding</p>
                <p className="text-2xl font-bold mt-1 text-red-700">
                  {formatCurrency(totalOutstanding)}
                </p>
                <Link
                  href="/outstanding"
                  className="text-sm text-brand-green font-medium mt-1 inline-block"
                >
                  View →
                </Link>
              </div>
            )}
            {isTutorialSec && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <p className="text-sm text-gray-500">Cards due today</p>
                <p className="text-2xl font-bold mt-1 text-amber-800">
                  {renewalsDueToday.length}
                </p>
                <Link
                  href="/renewals"
                  className="text-sm text-brand-green font-medium mt-1 inline-block"
                >
                  Renewals →
                </Link>
              </div>
            )}
            {isTutorialSec && (
              <div className="bg-white rounded-xl border border-red-200 p-5 shadow-sm">
                <p className="text-sm text-gray-500">Expired cards (3 days)</p>
                <p className="text-2xl font-bold mt-1 text-red-700">
                  {expiredCardsRecent.length}
                </p>
                <p className="text-xs text-red-600 mt-1">Marked Expired card</p>
                <Link
                  href="/renewals"
                  className="text-sm text-brand-green font-medium mt-1 inline-block"
                >
                  View expired →
                </Link>
              </div>
            )}
            {isTutorialSec && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <p className="text-sm text-gray-500">Teacher pay today</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">
                  {formatCurrency(teacherPayTodayAmt)}
                </p>
                <Link
                  href="/teacher-pay"
                  className="text-sm text-brand-green font-medium mt-1 inline-block"
                >
                  Record teacher pay →
                </Link>
              </div>
            )}
            {isTutorialSec && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <p className="text-sm text-gray-500">Teacher pay this month</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">
                  {formatCurrency(teacherPayMonthAmt)}
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-semibold">Exam registration</h2>
                <p className="text-sm text-gray-500">{scopeLabel}</p>
              </div>
              <Link
                href="/exam-register"
                className="text-sm text-brand-green font-medium"
              >
                Open →
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-800">Records</p>
                <p className="text-xl font-bold text-blue-900">
                  {examFees.length}
                </p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3">
                <p className="text-xs text-amber-800">Board pending</p>
                <p className="text-xl font-bold text-amber-900">
                  {examPendingBoard}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-xs text-red-700">Unpaid</p>
                <p className="text-xl font-bold text-red-800">{examUnpaid}</p>
              </div>
            </div>
          </div>

          {isTutorialSec && (renewals || []).length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-8">
              <div className="px-6 py-4 border-b font-semibold">
                Card renewals soon
              </div>
              <div className="divide-y">
                {(renewals || []).map((r: any) => {
                  const st = Array.isArray(r.students)
                    ? r.students[0]
                    : r.students;
                  return (
                    <div
                      key={r.id}
                      className="px-6 py-3 flex justify-between text-sm"
                    >
                      <span>{st?.full_name}</span>
                      <span className="text-amber-700 font-medium">
                        {r.valid_until}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold">
                {isTutorialSec ? "Students by exam" : "Students by class"}
              </h2>
              <p className="text-sm text-gray-500">{scopeLabel} only</p>
            </div>
            <div className="divide-y max-h-72 overflow-y-auto">
              {(isTutorialSec ? examPrepRows : classRows).length > 0 ? (
                (isTutorialSec ? examPrepRows : classRows).map((r) => (
                  <div
                    key={r.name}
                    className="px-6 py-3 flex justify-between text-sm"
                  >
                    <span>{r.name}</span>
                    <span className="font-bold text-brand-green">{r.count}</span>
                  </div>
                ))
              ) : (
                <p className="px-6 py-8 text-center text-gray-400 text-sm">
                  No students yet
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
