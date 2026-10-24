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
} from "lucide-react";
import Link from "next/link";

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

export default async function DashboardPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const campusId = campusFilter(profile);
  const admin = isAdmin(profile);
  const label = campusLabelOf(profile);
  const isTutorial =
    label.includes("arepo") ||
    label.includes("ofada") ||
    label.includes("mowe");
  const isMainSec =
    !admin &&
    (label.includes("main") || (!isTutorial && !!profile?.campus_id));

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
  const days14Start = isoDate(addDays(now, -13));
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const sixMonthsStart = isoDate(sixMonthsAgo);
  const in7 = isoDate(addDays(now, 7));

  let studentsQuery = supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");
  if (campusId) studentsQuery = studentsQuery.eq("campus_id", campusId);

  let outstandingQuery = supabase
    .from("student_fees")
    .select("balance, students!inner(campus_id, campuses(short_name, name))")
    .gt("balance", 0);
  if (campusId) {
    outstandingQuery = outstandingQuery.eq("students.campus_id", campusId);
  }

  let paymentsTodayQuery = supabase
    .from("payments")
    .select("amount, students!inner(campus_id)")
    .is("deleted_at", null)
    .eq("payment_date", today);
  if (campusId)
    paymentsTodayQuery = paymentsTodayQuery.eq("students.campus_id", campusId);

  let expensesTodayQuery = supabase
    .from("expenses")
    .select("amount")
    .eq("expense_date", today);
  if (campusId) expensesTodayQuery = expensesTodayQuery.eq("campus_id", campusId);

  let studentRowsQuery = supabase
    .from("students")
    .select(
      "id, class_name, exam_preparing_for, campus_id, campuses(short_name, name)"
    )
    .eq("status", "active");
  if (campusId) studentRowsQuery = studentRowsQuery.eq("campus_id", campusId);

  // Admin-only heavier queries
  let campusesQuery = supabase
    .from("campuses")
    .select("id, name, short_name")
    .eq("is_active", true)
    .order("name");

  let paymentsMonthQuery = supabase
    .from("payments")
    .select("amount, payment_date, students!inner(campus_id)")
    .is("deleted_at", null)
    .gte("payment_date", monthStart)
    .lte("payment_date", monthEnd);
  if (campusId)
    paymentsMonthQuery = paymentsMonthQuery.eq("students.campus_id", campusId);

  let expensesMonthQuery = supabase
    .from("expenses")
    .select("amount, campus_id, expense_date")
    .gte("expense_date", monthStart)
    .lte("expense_date", monthEnd);
  if (campusId)
    expensesMonthQuery = expensesMonthQuery.eq("campus_id", campusId);

  let staffQuery = supabase
    .from("staff")
    .select("salary, campus_id, status")
    .eq("status", "active");

  let paymentsTrendQuery = supabase
    .from("payments")
    .select("amount, payment_date, students!inner(campus_id)")
    .is("deleted_at", null)
    .gte("payment_date", sixMonthsStart);
  if (campusId)
    paymentsTrendQuery = paymentsTrendQuery.eq("students.campus_id", campusId);

  let expensesTrendQuery = supabase
    .from("expenses")
    .select("amount, expense_date")
    .gte("expense_date", days14Start);
  if (campusId)
    expensesTrendQuery = expensesTrendQuery.eq("campus_id", campusId);

  let inventorySalesMonthQuery = supabase
    .from("inventory_sales")
    .select("profit, total_price, sale_date, campus_id")
    .gte("sale_date", monthStart)
    .lte("sale_date", monthEnd);

  let inventorySalesTodayQuery = supabase
    .from("inventory_sales")
    .select("profit, total_price")
    .eq("sale_date", today);

  // Renewals (tutorial secretaries + admin)
  let renewalsQuery = supabase
    .from("student_fees")
    .select(
      "id, valid_until, amount, amount_paid, students!inner(full_name, campus_id, status)"
    )
    .not("valid_until", "is", null)
    .eq("students.status", "active")
    .lte("valid_until", in7)
    .order("valid_until")
    .limit(8);
  if (campusId)
    renewalsQuery = renewalsQuery.eq("students.campus_id", campusId);

  // Exam fees summary for all
  let examFeesQuery = supabase
    .from("student_fees")
    .select(
      "id, amount_paid, board_registered, fee_types(name), students!inner(campus_id, status)"
    )
    .eq("students.status", "active");
  if (campusId)
    examFeesQuery = examFeesQuery.eq("students.campus_id", campusId);

  const [
    { count: totalStudents },
    { data: outstandingRaw },
    { data: todayPayments },
    { data: todayExpenses },
    { data: studentRows },
    { data: campuses },
    { data: monthPayments },
    { data: monthExpenses },
    { data: activeStaff },
    { data: trendPayments },
    { data: trendExpenses },
    invMonthRes,
    invTodayRes,
    { data: renewals },
    { data: examFeesRaw },
  ] = await Promise.all([
    studentsQuery,
    outstandingQuery,
    paymentsTodayQuery,
    expensesTodayQuery,
    studentRowsQuery,
    campusesQuery,
    paymentsMonthQuery,
    expensesMonthQuery,
    staffQuery,
    paymentsTrendQuery,
    expensesTrendQuery,
    inventorySalesMonthQuery,
    inventorySalesTodayQuery,
    renewalsQuery,
    examFeesQuery,
  ]);

  // Outstanding: Main school only (filter out tutorial campuses)
  const outstanding = (outstandingRaw || []).filter((f: any) => {
    const st = Array.isArray(f.students) ? f.students[0] : f.students;
    const c = Array.isArray(st?.campuses) ? st?.campuses[0] : st?.campuses;
    const L = `${c?.short_name || ""} ${c?.name || ""}`.toLowerCase();
    return !(
      L.includes("arepo") ||
      L.includes("ofada") ||
      L.includes("mowe")
    );
  });

  function isExamName(name?: string | null) {
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

  const examFees = (examFeesRaw || []).filter((f: any) => {
    const ft = Array.isArray(f.fee_types) ? f.fee_types[0] : f.fee_types;
    return isExamName(ft?.name);
  });
  const examPendingBoard = examFees.filter(
    (f: any) => Number(f.amount_paid) > 0 && !f.board_registered
  ).length;
  const examUnpaid = examFees.filter(
    (f: any) => Number(f.amount_paid) <= 0
  ).length;

  const totalOutstanding = outstanding.reduce(
    (sum: number, f: any) => sum + Number(f.balance || 0),
    0
  );
  const debtorsCount = outstanding.length;

  const incomeToday =
    todayPayments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
  const expensesTodayAmt =
    todayExpenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;

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

  const totalIncomeMonth =
    monthPayments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
  const totalExpensesMonth =
    monthExpenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
  const totalPayroll =
    activeStaff?.reduce((sum, s) => sum + Number(s.salary || 0), 0) || 0;

  const profitToday = incomeToday - expensesTodayAmt + inventoryProfitToday;
  const profitMonth =
    totalIncomeMonth - totalExpensesMonth - totalPayroll + inventoryProfitMonth;

  // Class / exam breakdown for this campus (secretaries) or admin detail
  const classMap = new Map<string, number>();
  const examMap = new Map<string, number>();
  for (const s of studentRows || []) {
    const camp = Array.isArray(s.campuses) ? s.campuses[0] : s.campuses;
    const cl = `${camp?.short_name || ""} ${camp?.name || ""}`.toLowerCase();
    const tut =
      cl.includes("arepo") || cl.includes("ofada") || cl.includes("mowe");
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
  const examRows = Array.from(examMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Admin branch compare
  type BranchRow = {
    id: string;
    name: string;
    short_name: string;
    income: number;
    expenses: number;
    payroll: number;
    profit: number;
  };
  const branchMap = new Map<string, BranchRow>();
  for (const c of campuses || []) {
    branchMap.set(c.id, {
      id: c.id,
      name: c.name,
      short_name: c.short_name || c.name,
      income: 0,
      expenses: 0,
      payroll: 0,
      profit: 0,
    });
  }
  for (const p of monthPayments || []) {
    const cid = (p.students as any)?.campus_id;
    if (cid && branchMap.has(cid)) {
      branchMap.get(cid)!.income += Number(p.amount || 0);
    }
  }
  for (const e of monthExpenses || []) {
    const cid = e.campus_id as string;
    if (cid && branchMap.has(cid)) {
      branchMap.get(cid)!.expenses += Number(e.amount || 0);
    }
  }
  for (const s of activeStaff || []) {
    const cid = s.campus_id as string;
    if (cid && branchMap.has(cid)) {
      branchMap.get(cid)!.payroll += Number(s.salary || 0);
    }
  }
  const branches = Array.from(branchMap.values()).map((b) => ({
    ...b,
    profit: b.income - b.expenses - b.payroll,
  }));

  const campusStudentTotals = (campuses || []).map((c) => {
    const count = (studentRows || []).filter(
      (s: any) => s.campus_id === c.id
    ).length;
    return {
      id: c.id,
      name: c.name,
      short_name: c.short_name || c.name,
      count,
    };
  });
  const grandStudentTotal = campusStudentTotals.reduce(
    (s, c) => s + c.count,
    0
  );

  // Daily 14 days for admin
  const dailyMap = new Map<
    string,
    { date: string; income: number; expenses: number; profit: number }
  >();
  for (let i = 13; i >= 0; i--) {
    const d = isoDate(addDays(now, -i));
    dailyMap.set(d, { date: d, income: 0, expenses: 0, profit: 0 });
  }
  for (const p of trendPayments || []) {
    const d = String(p.payment_date || "").slice(0, 10);
    if (dailyMap.has(d)) {
      dailyMap.get(d)!.income += Number(p.amount || 0);
    }
  }
  for (const e of trendExpenses || []) {
    const d = String(e.expense_date || "").slice(0, 10);
    if (dailyMap.has(d)) {
      dailyMap.get(d)!.expenses += Number(e.amount || 0);
    }
  }
  const dailyRows = Array.from(dailyMap.values()).map((r) => ({
    ...r,
    profit: r.income - r.expenses,
  }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          {admin
            ? `All campuses · Collections & profit — ${monthLabel}`
            : `${scopeLabel} · Secretary view`}
        </p>
      </div>

      {/* Shared top cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {admin ? "Active students" : "Students (this campus)"}
              </p>
              <p className="text-2xl font-bold mt-1 text-gray-900">
                {totalStudents ?? 0}
              </p>
            </div>
            <div className="bg-blue-500 p-3 rounded-lg text-white">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Collected today</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">
                {formatCurrency(incomeToday)}
              </p>
            </div>
            <div className="bg-green-600 p-3 rounded-lg text-white">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Expenses today</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">
                {formatCurrency(expensesTodayAmt)}
              </p>
            </div>
            <div className="bg-amber-500 p-3 rounded-lg text-white">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>
        {(admin || isMainSec) && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Outstanding (Main)</p>
                <p className="text-2xl font-bold mt-1 text-red-700">
                  {formatCurrency(totalOutstanding)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {debtorsCount} fee line{debtorsCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="bg-red-500 p-3 rounded-lg text-white">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            <Link
              href="/outstanding"
              className="text-sm text-brand-green font-medium mt-2 inline-block hover:underline"
            >
              View outstanding →
            </Link>
          </div>
        )}
        {!admin && isTutorial && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Cards due (7 days)</p>
                <p className="text-2xl font-bold mt-1 text-amber-800">
                  {(renewals || []).length}
                </p>
              </div>
              <div className="bg-amber-600 p-3 rounded-lg text-white">
                <CalendarClock className="w-5 h-5" />
              </div>
            </div>
            <Link
              href="/renewals"
              className="text-sm text-brand-green font-medium mt-2 inline-block hover:underline"
            >
              Card renewals →
            </Link>
          </div>
        )}
      </div>

      {/* Exam section — all campuses */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-brand-green" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Exam registration
              </h2>
              <p className="text-sm text-gray-500">
                JAMB / WAEC / NECO fees · {scopeLabel}
              </p>
            </div>
          </div>
          <Link
            href="/exam-register"
            className="text-sm font-medium text-brand-green hover:underline"
          >
            Open Exam Register →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="text-sm text-blue-800">Exam fee records</p>
            <p className="text-2xl font-bold text-blue-900">{examFees.length}</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
            <p className="text-sm text-amber-800">Paid · pending board</p>
            <p className="text-2xl font-bold text-amber-900">
              {examPendingBoard}
            </p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-lg p-4">
            <p className="text-sm text-red-700">Not paid yet</p>
            <p className="text-2xl font-bold text-red-800">{examUnpaid}</p>
          </div>
        </div>
      </div>

      {/* Tutorial: card renewals list */}
      {!admin && isTutorial && (renewals || []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Card renewals (soon)</h2>
              <p className="text-sm text-gray-500">Expired or within 7 days</p>
            </div>
            <Link
              href="/renewals"
              className="text-sm text-brand-green font-medium hover:underline"
            >
              View all →
            </Link>
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
                  <span className="font-medium">{st?.full_name}</span>
                  <span className="text-amber-700 font-medium">
                    {r.valid_until}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Secretary: students by class or exam for THIS campus only */}
      {!admin && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              {isTutorial ? "Students by exam" : "Students by class"}
            </h2>
            <p className="text-sm text-gray-500">{scopeLabel} only</p>
          </div>
          <div className="divide-y max-h-80 overflow-y-auto">
            {(isTutorial ? examRows : classRows).length > 0 ? (
              (isTutorial ? examRows : classRows).map((r) => (
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
      )}

      {/* ========== ADMIN ONLY ========== */}
      {admin && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            <div
              className={`rounded-xl border p-6 shadow-sm ${
                profitToday >= 0
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <CalendarDays className="w-4 h-4" />
                Profit today
              </div>
              <p
                className={`text-3xl font-bold flex items-center gap-2 ${
                  profitToday >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {profitToday >= 0 ? (
                  <TrendingUp className="w-7 h-7" />
                ) : (
                  <TrendingDown className="w-7 h-7" />
                )}
                {formatCurrency(profitToday)}
              </p>
              <p className="text-sm text-gray-500 mt-3">
                Fees {formatCurrency(incomeToday)} − Expenses{" "}
                {formatCurrency(expensesTodayAmt)}
              </p>
            </div>
            <div
              className={`rounded-xl border p-6 shadow-sm ${
                profitMonth >= 0
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <CalendarRange className="w-4 h-4" />
                Profit this month ({monthLabel})
              </div>
              <p
                className={`text-3xl font-bold flex items-center gap-2 ${
                  profitMonth >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {profitMonth >= 0 ? (
                  <TrendingUp className="w-7 h-7" />
                ) : (
                  <TrendingDown className="w-7 h-7" />
                )}
                {formatCurrency(profitMonth)}
              </p>
              <p className="text-sm text-gray-500 mt-3">
                Income {formatCurrency(totalIncomeMonth)} − Expenses{" "}
                {formatCurrency(totalExpensesMonth)} − Payroll{" "}
                {formatCurrency(totalPayroll)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <Package className="w-4 h-4" />
                Inventory profit today
              </div>
              <p className="text-2xl font-bold text-green-700">
                {formatCurrency(inventoryProfitToday)}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Revenue {formatCurrency(inventoryRevenueToday)}
              </p>
            </div>
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <Package className="w-4 h-4" />
                Inventory profit this month
              </div>
              <p className="text-2xl font-bold text-green-700">
                {formatCurrency(inventoryProfitMonth)}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Revenue {formatCurrency(inventoryRevenueMonth)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Campus performance</h2>
              <p className="text-sm text-gray-500">
                Income − expenses − salaries · {monthLabel}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3">Campus</th>
                    <th className="text-left px-4 py-3">Income</th>
                    <th className="text-left px-4 py-3">Expenses</th>
                    <th className="text-left px-4 py-3">Payroll</th>
                    <th className="text-left px-4 py-3">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {branches.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-3 font-medium">{b.short_name}</td>
                      <td className="px-4 py-3">
                        {formatCurrency(b.income)}
                      </td>
                      <td className="px-4 py-3">
                        {formatCurrency(b.expenses)}
                      </td>
                      <td className="px-4 py-3">
                        {formatCurrency(b.payroll)}
                      </td>
                      <td
                        className={`px-4 py-3 font-semibold ${
                          b.profit >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {formatCurrency(b.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold">Students by branch</h2>
                <p className="text-sm text-gray-500">
                  Total {grandStudentTotal}
                </p>
              </div>
              <div className="divide-y">
                {campusStudentTotals.map((c) => (
                  <div
                    key={c.id}
                    className="px-6 py-3 flex justify-between"
                  >
                    <span className="font-medium">{c.short_name}</span>
                    <span className="font-bold text-brand-green">
                      {c.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center gap-2">
                <Banknote className="w-5 h-5 text-gray-400" />
                <div>
                  <h2 className="text-lg font-semibold">Staff salaries</h2>
                  <p className="text-sm text-gray-500">
                    Monthly payroll {formatCurrency(totalPayroll)}
                  </p>
                </div>
              </div>
              <div className="px-6 py-4">
                <Link
                  href="/staff"
                  className="text-sm text-brand-green font-medium hover:underline"
                >
                  Manage staff & loans →
                </Link>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                Daily profit (last 14 days)
              </h2>
            </div>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2">Date</th>
                    <th className="text-left px-4 py-2">Income</th>
                    <th className="text-left px-4 py-2">Expenses</th>
                    <th className="text-left px-4 py-2">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dailyRows.map((r) => (
                    <tr key={r.date}>
                      <td className="px-4 py-2">{r.date}</td>
                      <td className="px-4 py-2">
                        {formatCurrency(r.income)}
                      </td>
                      <td className="px-4 py-2">
                        {formatCurrency(r.expenses)}
                      </td>
                      <td
                        className={`px-4 py-2 font-medium ${
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
        </>
      )}
    </div>
  );
}
