import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getCurrentProfile, campusFilter, isAdmin } from "@/lib/auth";
import {
  Users,
  CreditCard,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Wallet,
  GraduationCap,
  CalendarDays,
  CalendarRange,
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

export default async function DashboardPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const campusId = campusFilter(profile);
  const admin = isAdmin(profile);

  const now = new Date();
  const today = isoDate(now);
  const monthStart = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const monthLabel = now.toLocaleString("en-NG", {
    month: "long",
    year: "numeric",
  });
  // Last 14 days for daily table
  const days14Start = isoDate(addDays(now, -13));
  // Last 6 calendar months for monthly trend
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const sixMonthsStart = isoDate(sixMonthsAgo);

  let studentsQuery = supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");
  if (campusId) studentsQuery = studentsQuery.eq("campus_id", campusId);

  let outstandingQuery = supabase
    .from("student_fees")
    .select("balance, students!inner(campus_id)")
    .gt("balance", 0);
  if (campusId) {
    outstandingQuery = outstandingQuery.eq("students.campus_id", campusId);
  }

  let campusesQuery = supabase
    .from("campuses")
    .select("id, name, short_name")
    .eq("is_active", true)
    .order("name");
  if (campusId) campusesQuery = campusesQuery.eq("id", campusId);

  // Month payments/expenses (current month cards + branch compare)
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
  if (campusId) expensesMonthQuery = expensesMonthQuery.eq("campus_id", campusId);

  let staffQuery = supabase
    .from("staff")
    .select("salary, campus_id, status")
    .eq("status", "active");
  if (campusId) staffQuery = staffQuery.eq("campus_id", campusId);

  let studentRowsQuery = supabase
    .from("students")
    .select("id, class_name, exam_preparing_for, campus_id, campuses(short_name, name)")
    .eq("status", "active");
  if (campusId) studentRowsQuery = studentRowsQuery.eq("campus_id", campusId);

  // Broader window for daily + multi-month trends
  let paymentsTrendQuery = supabase
    .from("payments")
    .select("amount, payment_date, students!inner(campus_id)")
    .is("deleted_at", null)
    .gte("payment_date", sixMonthsStart)
    .lte("payment_date", today);
  if (campusId)
    paymentsTrendQuery = paymentsTrendQuery.eq("students.campus_id", campusId);

  let expensesTrendQuery = supabase
    .from("expenses")
    .select("amount, campus_id, expense_date")
    .gte("expense_date", sixMonthsStart)
    .lte("expense_date", today);
  if (campusId) expensesTrendQuery = expensesTrendQuery.eq("campus_id", campusId);

  // Today's payments only (fast path)
  let paymentsTodayQuery = supabase
    .from("payments")
    .select("amount, students!inner(campus_id)")
    .is("deleted_at", null)
    .eq("payment_date", today);
  if (campusId)
    paymentsTodayQuery = paymentsTodayQuery.eq("students.campus_id", campusId);

  let expensesTodayQuery = supabase
    .from("expenses")
    .select("amount, campus_id")
    .eq("expense_date", today);
  if (campusId) expensesTodayQuery = expensesTodayQuery.eq("campus_id", campusId);

  const [
    { count: totalStudents },
    { data: outstanding },
    { data: campuses },
    { data: monthPayments },
    { data: monthExpenses },
    { data: activeStaff },
    { data: studentRows },
    { data: trendPayments },
    { data: trendExpenses },
    { data: todayPayments },
    { data: todayExpenses },
  ] = await Promise.all([
    studentsQuery,
    outstandingQuery,
    campusesQuery,
    paymentsMonthQuery,
    expensesMonthQuery,
    staffQuery,
    studentRowsQuery,
    paymentsTrendQuery,
    expensesTrendQuery,
    paymentsTodayQuery,
    expensesTodayQuery,
  ]);

  const totalOutstanding =
    outstanding?.reduce((sum, f) => sum + Number(f.balance || 0), 0) || 0;
  const debtorsCount = outstanding?.length || 0;

  const totalIncomeMonth =
    monthPayments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
  const totalExpensesMonth =
    monthExpenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
  const totalPayroll =
    activeStaff?.reduce((sum, s) => sum + Number(s.salary || 0), 0) || 0;

  const incomeToday =
    todayPayments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
  const expensesToday =
    todayExpenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
  // Daily operating result: fees in − expenses out (payroll is monthly)
  const profitToday = incomeToday - expensesToday;
  const profitMonth = totalIncomeMonth - totalExpensesMonth - totalPayroll;

  // --- Branch financials (current month) ---
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
    const cid = (p.students as any)?.campus_id as string | undefined;
    if (!cid || !branchMap.has(cid)) continue;
    branchMap.get(cid)!.income += Number(p.amount || 0);
  }
  for (const e of monthExpenses || []) {
    if (!branchMap.has(e.campus_id)) continue;
    branchMap.get(e.campus_id)!.expenses += Number(e.amount || 0);
  }
  for (const s of activeStaff || []) {
    if (!branchMap.has(s.campus_id)) continue;
    branchMap.get(s.campus_id)!.payroll += Number(s.salary || 0);
  }
  const branches = Array.from(branchMap.values()).map((b) => ({
    ...b,
    profit: b.income - b.expenses - b.payroll,
  }));

  // --- Students by campus & class ---
  type CampusStudentCount = {
    id: string;
    name: string;
    short_name: string;
    count: number;
  };
  const campusStudentMap = new Map<string, CampusStudentCount>();
  for (const c of campuses || []) {
    campusStudentMap.set(c.id, {
      id: c.id,
      name: c.name,
      short_name: c.short_name || c.name,
      count: 0,
    });
  }
  const classCountMap = new Map<string, number>();
  const examCountMap = new Map<string, number>();
  for (const s of studentRows || []) {
    const cid = s.campus_id as string | null;
    const camp = Array.isArray(s.campuses) ? s.campuses[0] : s.campuses;
    const campLabel = `${(camp as any)?.short_name || ""} ${(camp as any)?.name || ""}`.toLowerCase();
    const isTutorial =
      campLabel.includes("arepo") ||
      campLabel.includes("ofada") ||
      campLabel.includes("mowe");

    if (cid && campusStudentMap.has(cid)) {
      campusStudentMap.get(cid)!.count += 1;
    } else if (cid && !campusStudentMap.has(cid)) {
      campusStudentMap.set(cid, {
        id: cid,
        name: (camp as any)?.name || "Unknown",
        short_name: (camp as any)?.short_name || (camp as any)?.name || "—",
        count: 1,
      });
    }

    if (isTutorial) {
      const exam =
        ((s as any).exam_preparing_for as string | null)?.trim() || "Not set";
      examCountMap.set(exam, (examCountMap.get(exam) || 0) + 1);
    } else {
      const cls = (s.class_name || "Unassigned").trim() || "Unassigned";
      classCountMap.set(cls, (classCountMap.get(cls) || 0) + 1);
    }
  }
  const campusStudentTotals = Array.from(campusStudentMap.values()).sort(
    (a, b) => b.count - a.count
  );
  const classCounts = Array.from(classCountMap.entries())
    .map(([class_name, count]) => ({ class_name, count }))
    .sort((a, b) =>
      a.class_name.localeCompare(b.class_name, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  const examCounts = Array.from(examCountMap.entries())
    .map(([exam, count]) => ({ exam, count }))
    .sort((a, b) => a.exam.localeCompare(b.exam));
  const grandStudentTotal = campusStudentTotals.reduce((s, c) => s + c.count, 0);

  // Scope: main school shows classes; tutorial centres show exams
  const profileCampusLabel = `${profile?.campuses?.short_name || ""} ${profile?.campuses?.name || ""}`.toLowerCase();
  const userIsTutorial =
    !admin &&
    (profileCampusLabel.includes("arepo") ||
      profileCampusLabel.includes("ofada") ||
      profileCampusLabel.includes("mowe"));
  const showExamBreakdown = userIsTutorial || (admin && examCounts.length > 0);
  const showClassBreakdown = !userIsTutorial;

  // --- Daily profit last 14 days (income − expenses) ---
  const dailyMap = new Map<
    string,
    { date: string; income: number; expenses: number; profit: number }
  >();
  for (let i = 13; i >= 0; i--) {
    const d = isoDate(addDays(now, -i));
    dailyMap.set(d, { date: d, income: 0, expenses: 0, profit: 0 });
  }
  for (const p of trendPayments || []) {
    const d = p.payment_date as string;
    if (!dailyMap.has(d)) continue;
    dailyMap.get(d)!.income += Number(p.amount || 0);
  }
  for (const e of trendExpenses || []) {
    const d = e.expense_date as string;
    if (!dailyMap.has(d)) continue;
    dailyMap.get(d)!.expenses += Number(e.amount || 0);
  }
  const dailyRows = Array.from(dailyMap.values()).map((r) => ({
    ...r,
    profit: r.income - r.expenses,
  }));

  // --- Monthly profit last 6 months ---
  // Income − expenses per month; payroll counted only in current month fully
  // (historical months: income − expenses only, since we don't have month-end payroll snapshots)
  const monthlyMap = new Map<
    string,
    { key: string; label: string; income: number; expenses: number; payroll: number; profit: number }
  >();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-NG", { month: "short", year: "numeric" });
    monthlyMap.set(key, {
      key,
      label,
      income: 0,
      expenses: 0,
      payroll: key === monthStart.slice(0, 7) ? totalPayroll : 0,
      profit: 0,
    });
  }
  for (const p of trendPayments || []) {
    const key = String(p.payment_date).slice(0, 7);
    if (!monthlyMap.has(key)) continue;
    monthlyMap.get(key)!.income += Number(p.amount || 0);
  }
  for (const e of trendExpenses || []) {
    const key = String(e.expense_date).slice(0, 7);
    if (!monthlyMap.has(key)) continue;
    monthlyMap.get(key)!.expenses += Number(e.amount || 0);
  }
  const monthlyRows = Array.from(monthlyMap.values()).map((r) => ({
    ...r,
    profit: r.income - r.expenses - r.payroll,
  }));

  const scopeLabel = admin
    ? "All campuses"
    : profile?.campuses?.short_name || "Your campus";

  const cards = [
    {
      title: "Active Students",
      value: totalStudents ?? 0,
      icon: Users,
      color: "bg-blue-500",
    },
    {
      title: `Income (${monthLabel})`,
      value: formatCurrency(totalIncomeMonth),
      icon: CreditCard,
      color: "bg-green-600",
    },
    {
      title: "Outstanding Balance",
      value: formatCurrency(totalOutstanding),
      icon: AlertCircle,
      color: "bg-red-500",
    },
    {
      title: "Students with Debt",
      value: debtorsCount,
      icon: TrendingUp,
      color: "bg-amber-500",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          {scopeLabel} · Collections, expenses & profit — {monthLabel}
        </p>
      </div>

      {/* Core KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {cards.map((card) => (
          <div
            key={card.title}
            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">
                  {card.value}
                </p>
              </div>
              <div className={`${card.color} p-3 rounded-lg text-white`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Profit today + this month — core admin view */}
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
            Fees collected {formatCurrency(incomeToday)} − Expenses{" "}
            {formatCurrency(expensesToday)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Daily figure excludes monthly staff salaries
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
          <p className="text-xs text-gray-400 mt-1">
            Full monthly result including staff salaries
          </p>
        </div>
      </div>

      {/* Daily profit table (last 14 days) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Daily profit (last 14 days)
            </h2>
            <p className="text-sm text-gray-500">
              Fees collected − Expenses each day (salaries not included)
            </p>
          </div>
          <Banknote className="w-5 h-5 text-gray-400" />
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 sticky top-0">
              <tr>
                <th className="text-left px-6 py-3 font-medium">Date</th>
                <th className="text-right px-6 py-3 font-medium">Income</th>
                <th className="text-right px-6 py-3 font-medium">Expenses</th>
                <th className="text-right px-6 py-3 font-medium">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...dailyRows].reverse().map((r) => (
                <tr
                  key={r.date}
                  className={`hover:bg-gray-50 ${
                    r.date === today ? "bg-green-50/50" : ""
                  }`}
                >
                  <td className="px-6 py-2.5 font-medium text-gray-900">
                    {r.date}
                    {r.date === today && (
                      <span className="ml-2 text-xs text-brand-green font-semibold">
                        Today
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-2.5 text-right text-green-700">
                    {formatCurrency(r.income)}
                  </td>
                  <td className="px-6 py-2.5 text-right text-red-600">
                    {formatCurrency(r.expenses)}
                  </td>
                  <td
                    className={`px-6 py-2.5 text-right font-semibold ${
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

      {/* Monthly profit (last 6 months) — important for admin */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Monthly profit (last 6 months)
            </h2>
            <p className="text-sm text-gray-500">
              Income − Expenses
              {admin || !campusId
                ? " (− Payroll in current month)"
                : " (− Payroll in current month)"}
            </p>
          </div>
          <CalendarRange className="w-5 h-5 text-gray-400" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-6 py-3 font-medium">Month</th>
                <th className="text-right px-6 py-3 font-medium">Income</th>
                <th className="text-right px-6 py-3 font-medium">Expenses</th>
                <th className="text-right px-6 py-3 font-medium">Payroll</th>
                <th className="text-right px-6 py-3 font-medium">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...monthlyRows].reverse().map((r) => (
                <tr
                  key={r.key}
                  className={`hover:bg-gray-50 ${
                    r.key === monthStart.slice(0, 7) ? "bg-green-50/40" : ""
                  }`}
                >
                  <td className="px-6 py-3 font-medium text-gray-900">
                    {r.label}
                    {r.key === monthStart.slice(0, 7) && (
                      <span className="ml-2 text-xs text-brand-green font-semibold">
                        Current
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right text-green-700">
                    {formatCurrency(r.income)}
                  </td>
                  <td className="px-6 py-3 text-right text-red-600">
                    {formatCurrency(r.expenses)}
                  </td>
                  <td className="px-6 py-3 text-right text-gray-700">
                    {r.payroll > 0 ? formatCurrency(r.payroll) : "—"}
                  </td>
                  <td
                    className={`px-6 py-3 text-right font-bold ${
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
        <div className="px-6 py-3 bg-gray-50 text-xs text-gray-500 border-t">
          Past months show Income − Expenses only. Current month also subtracts
          active staff salaries.
        </div>
      </div>

      {/* Students by branch + by class */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Students by branch
              </h2>
              <p className="text-sm text-gray-500">
                Active students · Total {grandStudentTotal}
              </p>
            </div>
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <div className="divide-y divide-gray-100">
            {campusStudentTotals.length > 0 ? (
              campusStudentTotals.map((c) => (
                <div
                  key={c.id}
                  className="px-6 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">{c.short_name}</p>
                    <p className="text-xs text-gray-400">{c.name}</p>
                  </div>
                  <p className="text-xl font-bold text-brand-green">{c.count}</p>
                </div>
              ))
            ) : (
              <p className="px-6 py-8 text-center text-gray-400 text-sm">
                No active students yet
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {userIsTutorial
                  ? "Students by exam"
                  : admin
                    ? "Main: by class · Tutorial: by exam"
                    : "Students by class"}
              </h2>
              <p className="text-sm text-gray-500">
                {userIsTutorial
                  ? "Arepo / Ofada — exam preparing for"
                  : admin
                    ? "School classes (Main) and exam groups (Arepo/Ofada)"
                    : `${scopeLabel} · school classes`}
              </p>
            </div>
            <GraduationCap className="w-5 h-5 text-gray-400" />
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            {showClassBreakdown && (
              <>
                {admin && examCounts.length > 0 && (
                  <p className="px-6 pt-3 text-xs font-semibold text-gray-500 uppercase">
                    Main (by class)
                  </p>
                )}
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 sticky top-0">
                    <tr>
                      <th className="text-left px-6 py-3 font-medium">Class</th>
                      <th className="text-right px-6 py-3 font-medium">
                        Students
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {classCounts.length > 0 ? (
                      classCounts.map((row) => (
                        <tr key={row.class_name} className="hover:bg-gray-50">
                          <td className="px-6 py-2.5 font-medium text-gray-900">
                            {row.class_name}
                          </td>
                          <td className="px-6 py-2.5 text-right font-semibold text-gray-800">
                            {row.count}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-6 py-6 text-center text-gray-400"
                        >
                          No class data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </>
            )}
            {showExamBreakdown && (
              <>
                {admin && (
                  <p className="px-6 pt-3 text-xs font-semibold text-gray-500 uppercase border-t">
                    Arepo / Ofada (by exam)
                  </p>
                )}
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-6 py-3 font-medium">
                        Exam preparing for
                      </th>
                      <th className="text-right px-6 py-3 font-medium">
                        Students
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {examCounts.length > 0 ? (
                      examCounts.map((row) => (
                        <tr key={row.exam} className="hover:bg-gray-50">
                          <td className="px-6 py-2.5 font-medium text-gray-900">
                            {row.exam}
                          </td>
                          <td className="px-6 py-2.5 text-right font-semibold text-gray-800">
                            {row.count}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-6 py-6 text-center text-gray-400"
                        >
                          No exam data yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Branch comparison */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {admin ? "Branch comparison" : "Campus performance"} —{" "}
              {monthLabel}
            </h2>
            <p className="text-sm text-gray-500">
              Income (fees) − Expenses − Staff salaries
            </p>
          </div>
          <Wallet className="w-5 h-5 text-gray-400" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-6 py-3 font-medium">Campus</th>
                <th className="text-left px-6 py-3 font-medium">Income</th>
                <th className="text-left px-6 py-3 font-medium">Expenses</th>
                <th className="text-left px-6 py-3 font-medium">Payroll</th>
                <th className="text-left px-6 py-3 font-medium">
                  Profit / Loss
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {branches.length > 0 ? (
                branches.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {b.short_name}
                      </div>
                      <div className="text-xs text-gray-400">{b.name}</div>
                    </td>
                    <td className="px-6 py-4 text-green-700 font-medium">
                      {formatCurrency(b.income)}
                    </td>
                    <td className="px-6 py-4 text-red-600">
                      {formatCurrency(b.expenses)}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {formatCurrency(b.payroll)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${
                          b.profit >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {b.profit >= 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        {formatCurrency(b.profit)}
                        <span className="text-xs font-medium ml-1">
                          {b.profit >= 0 ? "Profit" : "Loss"}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-gray-400"
                  >
                    No campus data yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 bg-gray-50 text-xs text-gray-500 border-t">
          Payroll is monthly staff salary cost. Income and expenses are for the
          current calendar month only.
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/expenses"
          className="bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-green transition shadow-sm"
        >
          <p className="font-medium text-gray-900">Record expense</p>
          <p className="text-sm text-gray-500 mt-1">
            Log daily costs for your campus
          </p>
        </Link>
        <Link
          href="/staff"
          className="bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-green transition shadow-sm"
        >
          <p className="font-medium text-gray-900">Staff & salaries</p>
          <p className="text-sm text-gray-500 mt-1">
            Manage staff and monthly salaries
          </p>
        </Link>
        <Link
          href="/outstanding"
          className="bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-green transition shadow-sm"
        >
          <p className="font-medium text-gray-900">Outstanding fees</p>
          <p className="text-sm text-gray-500 mt-1">See who still owes</p>
        </Link>
      </div>
    </div>
  );
}
