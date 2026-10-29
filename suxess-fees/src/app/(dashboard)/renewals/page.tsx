import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getCurrentProfile, campusFilter, isAdmin } from "@/lib/auth";
import Link from "next/link";
import { RenewCardButton } from "@/components/renewals/renew-card-button";

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function campusShort(r: any) {
  const st = Array.isArray(r.students) ? r.students[0] : r.students;
  const c = Array.isArray(st?.campuses) ? st?.campuses[0] : st?.campuses;
  return `${c?.short_name || ""} ${c?.name || ""}`.trim();
}

function isArepo(r: any) {
  return campusShort(r).toLowerCase().includes("arepo");
}
function isOfada(r: any) {
  const L = campusShort(r).toLowerCase();
  return L.includes("ofada") || L.includes("mowe");
}

export default async function RenewalsPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const campusLbl = `${profile?.campuses?.short_name || ""} ${
    profile?.campuses?.name || ""
  }`.toLowerCase();
  const isTut =
    campusLbl.includes("arepo") ||
    campusLbl.includes("ofada") ||
    campusLbl.includes("mowe");
  if (profile?.role === "secretary" && !isTut) {
    redirect("/");
  }
  const lockedCampus = campusFilter(profile);
  const admin = isAdmin(profile);
  const today = isoToday();
  // Cards stay on the "Expired card" urgent list for 3 days after expiry
  const expiredWindowStart = addDays(today, -2); // today-2, today-1, and any day before today that's within 3 calendar days: valid_until >= today-2 and < today means 1-2 days ago... 
  // 3 days: if expired on day D, show D, D+1, D+2 (3 days inclusive of expiry day as "due" was on D?).
  // User: "show for 3 day" after expired → valid_until < today AND valid_until >= today - 3
  const threeDaysAgo = addDays(today, -3);

  let query = supabase
    .from("student_fees")
    .select(
      `id, amount, amount_paid, balance, valid_until, session, term, status,
       fee_types(name),
       students!inner(
         id, full_name, admission_number, class_name, parent_name, parent_phone,
         campus_id, status, campuses(short_name, name)
       )`
    )
    .not("valid_until", "is", null)
    .eq("students.status", "active")
    .order("valid_until", { ascending: true });

  if (lockedCampus) {
    query = query.eq("students.campus_id", lockedCampus);
  }

  const { data: rows } = await query;
  const list = (rows || []).filter((r: any) => {
    const ft = Array.isArray(r.fee_types) ? r.fee_types[0] : r.fee_types;
    const n = String(ft?.name || "").toLowerCase();
    const isExam =
      n.includes("jamb") ||
      n.includes("waec") ||
      n.includes("neco") ||
      n.includes("gce") ||
      n.includes("bece") ||
      (n.includes("exam") &&
        (n.includes("regist") || n.includes("form") || n.includes("pin")));
    return !isExam;
  });

  function splitBranch(items: any[]) {
    const arepo = items.filter(isArepo);
    const ofada = items.filter(isOfada);
    const other = items.filter((r) => !isArepo(r) && !isOfada(r));
    return { arepo, ofada, other };
  }

  const stillValid = list.filter(
    (r: any) => r.valid_until && r.valid_until > today
  );
  const dueToday = list.filter(
    (r: any) => r.valid_until && r.valid_until === today
  );
  // Expired within last 3 days — main list secretaries must act on
  const expiredRecent = list.filter(
    (r: any) =>
      r.valid_until &&
      r.valid_until < today &&
      r.valid_until >= threeDaysAgo
  );
  // Older than 3 days — still listed, lower priority
  const expiredOlder = list.filter(
    (r: any) => r.valid_until && r.valid_until < threeDaysAgo
  );

  const validSplit = splitBranch(stillValid);
  const dueTodaySplit = splitBranch(dueToday);
  const expiredRecentSplit = splitBranch(expiredRecent);
  const expiredOlderSplit = splitBranch(expiredOlder);

  function SectionTable({
    items,
    badge,
    markExpiredCard,
  }: {
    items: any[];
    badge: string;
    markExpiredCard?: boolean;
  }) {
    if (items.length === 0) {
      return (
        <p className="text-sm text-gray-400 px-2 py-4">
          No students in this list.
        </p>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Student</th>
              <th className="text-left px-3 py-2 font-medium">Valid until</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Paid / Fee</th>
              <th className="text-left px-3 py-2 font-medium">Parent</th>
              <th className="text-left px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((r: any) => {
              const st = Array.isArray(r.students)
                ? r.students[0]
                : r.students;
              const partial =
                Number(r.amount_paid || 0) > 0 &&
                Number(r.amount_paid || 0) < Number(r.amount || 0);
              return (
                <tr
                  key={r.id}
                  className={`hover:bg-gray-50 ${
                    markExpiredCard ? "bg-red-50/50" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium">{st?.full_name}</div>
                    <div className="text-xs text-gray-400">
                      {st?.admission_number}
                    </div>
                    <Link
                      href={`/students/${st?.id}`}
                      className="text-xs text-brand-green hover:underline"
                    >
                      Profile
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge}`}
                    >
                      {r.valid_until}
                    </span>
                    {partial && (
                      <span className="block text-xs text-amber-700 mt-0.5">
                        Partial pay
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {markExpiredCard ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                        Expired card
                      </span>
                    ) : r.valid_until === today ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                        Due today
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Valid
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {formatCurrency(Number(r.amount_paid || 0))} /{" "}
                    {formatCurrency(Number(r.amount || 0))}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {st?.parent_phone || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {st?.id ? (
                      <RenewCardButton
                        feeId={r.id}
                        studentId={st.id}
                        studentName={st.full_name || "Student"}
                        feeAmount={Number(r.amount || 0)}
                        amountPaidSoFar={Number(r.amount_paid || 0)}
                      />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function BranchBlock({
    name,
    valid,
    dueTodayItems,
    expiredRecentItems,
    expiredOlderItems,
  }: {
    name: string;
    valid: any[];
    dueTodayItems: any[];
    expiredRecentItems: any[];
    expiredOlderItems: any[];
  }) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-brand-green text-white flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">{name}</h2>
            <p className="text-sm text-green-100">
              Tutorial centre · card status
            </p>
          </div>
          <div className="flex gap-2 sm:gap-3 text-center flex-wrap justify-end">
            <div className="bg-white/15 rounded-lg px-3 py-1.5">
              <p className="text-[10px] uppercase text-green-100">Still valid</p>
              <p className="text-xl font-bold">{valid.length}</p>
            </div>
            <div className="bg-amber-500 rounded-lg px-3 py-1.5">
              <p className="text-[10px] uppercase text-amber-100">Due today</p>
              <p className="text-xl font-bold">{dueTodayItems.length}</p>
            </div>
            <div className="bg-red-600 rounded-lg px-3 py-1.5">
              <p className="text-[10px] uppercase text-red-100">
                Expired (3 days)
              </p>
              <p className="text-xl font-bold">{expiredRecentItems.length}</p>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="rounded-xl border-2 border-red-200 bg-red-50/40 p-3">
            <h3 className="text-sm font-bold text-red-800 mb-1">
              Expired card — last 3 days ({expiredRecentItems.length})
            </h3>
            <p className="text-xs text-red-700 mb-2">
              These cards expired within the last 3 days. Contact parent to renew.
            </p>
            <SectionTable
              items={expiredRecentItems}
              badge="bg-red-100 text-red-800"
              markExpiredCard
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-800 mb-2">
              Due today ({dueTodayItems.length})
            </h3>
            <SectionTable
              items={dueTodayItems}
              badge="bg-amber-100 text-amber-900"
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-green-800 mb-2">
              Still valid ({valid.length})
            </h3>
            <SectionTable
              items={valid}
              badge="bg-green-100 text-green-800"
            />
          </div>
          {expiredOlderItems.length > 0 && (
            <div className="opacity-90">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">
                Older expired (over 3 days) ({expiredOlderItems.length})
              </h3>
              <p className="text-xs text-gray-500 mb-2">
                Still marked Expired card — follow up if needed.
              </p>
              <SectionTable
                items={expiredOlderItems}
                badge="bg-gray-200 text-gray-700"
                markExpiredCard
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Card renewals</h1>
        <p className="text-gray-500 mt-1">
          Full pay = months on card · partial = 2 weeks. Expired cards stay
          highlighted for <strong>3 days</strong> as{" "}
          <span className="text-red-700 font-medium">Expired card</span>.
          {admin ? " · Arepo and Ofada separated" : ""}
        </p>
      </div>

      {admin && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <BranchBlock
            name="Arepo"
            valid={validSplit.arepo}
            dueTodayItems={dueTodaySplit.arepo}
            expiredRecentItems={expiredRecentSplit.arepo}
            expiredOlderItems={expiredOlderSplit.arepo}
          />
          <BranchBlock
            name="Ofada Mowe"
            valid={validSplit.ofada}
            dueTodayItems={dueTodaySplit.ofada}
            expiredRecentItems={expiredRecentSplit.ofada}
            expiredOlderItems={expiredOlderSplit.ofada}
          />
        </div>
      )}

      {admin &&
        validSplit.other.length +
          dueTodaySplit.other.length +
          expiredRecentSplit.other.length +
          expiredOlderSplit.other.length >
          0 && (
          <div className="mb-8">
            <BranchBlock
              name="Other campuses"
              valid={validSplit.other}
              dueTodayItems={dueTodaySplit.other}
              expiredRecentItems={expiredRecentSplit.other}
              expiredOlderItems={expiredOlderSplit.other}
            />
          </div>
        )}

      {!admin && (
        <div className="mb-8">
          <BranchBlock
            name={
              campusLbl.includes("arepo")
                ? "Arepo"
                : campusLbl.includes("ofada") || campusLbl.includes("mowe")
                  ? "Ofada Mowe"
                  : profile?.campuses?.short_name || "Your campus"
            }
            valid={stillValid}
            dueTodayItems={dueToday}
            expiredRecentItems={expiredRecent}
            expiredOlderItems={expiredOlder}
          />
        </div>
      )}

      <p className="text-sm text-gray-500">
        <Link href="/payments" className="text-brand-green font-medium">
          Record Payment
        </Link>{" "}
        or open the student profile to renew after the parent pays.
      </p>
    </div>
  );
}
