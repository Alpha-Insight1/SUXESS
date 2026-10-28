import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getCurrentProfile, campusFilter, isAdmin } from "@/lib/auth";
import { TeacherPayForm } from "@/components/teacher-pay/teacher-pay-form";
import { TeacherPayActions } from "@/components/teacher-pay/teacher-pay-actions";

function campusLabel(p: any) {
  const c = Array.isArray(p.campuses) ? p.campuses[0] : p.campuses;
  return `${c?.short_name || ""} ${c?.name || ""}`.trim().toLowerCase();
}

function isArepo(p: any) {
  return campusLabel(p).includes("arepo");
}

function isOfada(p: any) {
  const L = campusLabel(p);
  return L.includes("ofada") || L.includes("mowe");
}

function sum(list: any[]) {
  return list.reduce((s, p) => s + Number(p.amount || 0), 0);
}

function PayTable({
  items,
  showCampus,
}: {
  items: any[];
  showCampus?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-400 px-2 py-6 text-center">
        No payments in this list.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Date</th>
            <th className="text-left px-4 py-2 font-medium">Teacher</th>
            <th className="text-left px-4 py-2 font-medium">Period taught</th>
            <th className="text-left px-4 py-2 font-medium">Amount</th>
            <th className="text-left px-4 py-2 font-medium">Method</th>
            {showCampus && (
              <th className="text-left px-4 py-2 font-medium">Campus</th>
            )}
            <th className="text-left px-4 py-2 font-medium">Notes</th>
            <th className="text-left px-4 py-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((p: any) => {
            const c = Array.isArray(p.campuses) ? p.campuses[0] : p.campuses;
            return (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">{p.payment_date}</td>
                <td className="px-4 py-2 font-medium">{p.teacher_name}</td>
                <td className="px-4 py-2">{p.period_taught}</td>
                <td className="px-4 py-2 font-semibold">
                  {formatCurrency(Number(p.amount || 0))}
                </td>
                <td className="px-4 py-2 capitalize">{p.payment_method}</td>
                {showCampus && (
                  <td className="px-4 py-2">
                    {c?.short_name || c?.name || "—"}
                  </td>
                )}
                <td className="px-4 py-2 text-gray-500">{p.notes || "—"}</td>
                <td className="px-4 py-2">
                  <TeacherPayActions
                    row={{
                      id: p.id,
                      teacher_name: p.teacher_name,
                      period_taught: p.period_taught,
                      amount: Number(p.amount || 0),
                      payment_method: p.payment_method || "cash",
                      payment_date: p.payment_date,
                      notes: p.notes,
                    }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BranchCard({
  name,
  todayItems,
  allItems,
}: {
  name: string;
  todayItems: any[];
  allItems: any[];
}) {
  const todayTotal = sum(todayItems);
  const allTotal = sum(allItems);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-brand-green text-white flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{name}</h2>
          <p className="text-sm text-green-100">Teacher daily pay</p>
        </div>
        <div className="flex gap-3 text-center">
          <div className="bg-white/15 rounded-lg px-3 py-1.5 min-w-[5.5rem]">
            <p className="text-[10px] uppercase text-green-100">Today</p>
            <p className="text-lg font-bold leading-tight">
              {formatCurrency(todayTotal)}
            </p>
            <p className="text-[10px] text-green-100">
              {todayItems.length} pay{todayItems.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="bg-white/15 rounded-lg px-3 py-1.5 min-w-[5.5rem]">
            <p className="text-[10px] uppercase text-green-100">All listed</p>
            <p className="text-lg font-bold leading-tight">
              {formatCurrency(allTotal)}
            </p>
            <p className="text-[10px] text-green-100">
              {allItems.length} record{allItems.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">
            Paid today ({todayItems.length}) · {formatCurrency(todayTotal)}
          </h3>
          <PayTable items={todayItems} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">
            Recent records
          </h3>
          <PayTable items={allItems.slice(0, 30)} />
        </div>
      </div>
    </div>
  );
}

export default async function TeacherPayPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const lockedCampus = campusFilter(profile);
  const admin = isAdmin(profile);

  let campusesQuery = supabase
    .from("campuses")
    .select("id, name, short_name")
    .eq("is_active", true);
  if (lockedCampus) campusesQuery = campusesQuery.eq("id", lockedCampus);

  let payQuery = supabase
    .from("teacher_payments")
    .select(
      "id, teacher_name, period_taught, amount, payment_method, payment_date, notes, campus_id, campuses(short_name, name)"
    )
    .order("payment_date", { ascending: false })
    .limit(300);
  if (lockedCampus) payQuery = payQuery.eq("campus_id", lockedCampus);

  const [{ data: campuses }, payRes] = await Promise.all([
    campusesQuery,
    payQuery,
  ]);

  const list = payRes.data || [];
  const today = new Date().toISOString().slice(0, 10);

  const todayAll = list.filter((p: any) => p.payment_date === today);
  const todayTotal = sum(todayAll);

  const arepoAll = list.filter(isArepo);
  const ofadaAll = list.filter(isOfada);
  const otherAll = list.filter((p: any) => !isArepo(p) && !isOfada(p));

  const arepoToday = arepoAll.filter((p: any) => p.payment_date === today);
  const ofadaToday = ofadaAll.filter((p: any) => p.payment_date === today);
  const otherToday = otherAll.filter((p: any) => p.payment_date === today);

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Teacher daily pay
          </h1>
          <p className="text-gray-500 mt-1">
            {admin
              ? "Arepo and Ofada separated · track daily totals"
              : `Record cash or transfer payments to teachers · ${
                  profile?.campuses?.short_name || "your campus"
                }`}
          </p>
        </div>
        <TeacherPayForm
          campuses={campuses || []}
          lockedCampusId={lockedCampus}
        />
      </div>

      {payRes.error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-3">
          {payRes.error.message}. Run{" "}
          <code className="text-xs">migration-teacher-daily-pay.sql</code> in
          Supabase if the table is missing.
        </div>
      )}

      {/* Director total today across branches */}
      {admin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Total paid to teachers today</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(todayTotal)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              All branches · {todayAll.length} payment
              {todayAll.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Arepo today</p>
            <p className="text-2xl font-bold text-brand-green mt-1">
              {formatCurrency(sum(arepoToday))}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {arepoToday.length} payment{arepoToday.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Ofada today</p>
            <p className="text-2xl font-bold text-brand-green mt-1">
              {formatCurrency(sum(ofadaToday))}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {ofadaToday.length} payment{ofadaToday.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      )}

      {!admin && (
        <div className="mb-6 bg-white border rounded-xl p-4 shadow-sm inline-block">
          <p className="text-sm text-gray-500">Paid to teachers today</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(todayTotal)}
          </p>
        </div>
      )}

      {admin ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <BranchCard
              name="Arepo"
              todayItems={arepoToday}
              allItems={arepoAll}
            />
            <BranchCard
              name="Ofada Mowe"
              todayItems={ofadaToday}
              allItems={ofadaAll}
            />
          </div>
          {otherAll.length > 0 && (
            <BranchCard
              name="Other campuses"
              todayItems={otherToday}
              allItems={otherAll}
            />
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <p className="text-sm font-medium text-gray-700">
              Today {formatCurrency(todayTotal)} · {todayAll.length} payment
              {todayAll.length === 1 ? "" : "s"}
            </p>
          </div>
          <PayTable items={list} />
        </div>
      )}
    </div>
  );
}
