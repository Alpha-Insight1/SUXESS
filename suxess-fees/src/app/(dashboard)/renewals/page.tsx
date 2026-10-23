import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getCurrentProfile, campusFilter, isAdmin } from "@/lib/auth";
import Link from "next/link";

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function RenewalsPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const campusLbl = `${profile?.campuses?.short_name || ""} ${profile?.campuses?.name || ""}`.toLowerCase();
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
  const in7 = addDays(today, 7);

  let query = supabase
    .from("student_fees")
    .select(
      `id, amount, amount_paid, balance, valid_until, session, term, status,
       fee_types(name),
       students!inner(
         id, full_name, admission_number, class_name, parent_name, parent_phone,
         campus_id, campuses(short_name, name)
       )`
    )
    .not("valid_until", "is", null)
    .order("valid_until", { ascending: true });

  if (lockedCampus) {
    query = query.eq("students.campus_id", lockedCampus);
  }

  const { data: rows } = await query;
  const list = rows || [];

  const expired = list.filter(
    (r: any) => r.valid_until && r.valid_until < today
  );
  const todayList = list.filter((r: any) => r.valid_until === today);
  const upcoming = list.filter(
    (r: any) => r.valid_until && r.valid_until > today && r.valid_until <= in7
  );
  const later = list.filter(
    (r: any) => r.valid_until && r.valid_until > in7
  );

  const sections = [
    {
      key: "expired",
      title: "Expired — renew now",
      hint: "Card validity date has passed",
      items: expired,
      tone: "border-red-200 bg-red-50",
      badge: "bg-red-100 text-red-800",
    },
    {
      key: "today",
      title: "Expiring today",
      hint: "Due for renewal today",
      items: todayList,
      tone: "border-amber-200 bg-amber-50",
      badge: "bg-amber-100 text-amber-900",
    },
    {
      key: "week",
      title: "Expiring in the next 7 days",
      hint: "Plan follow-up with parents",
      items: upcoming,
      tone: "border-orange-200 bg-orange-50",
      badge: "bg-orange-100 text-orange-900",
    },
    {
      key: "later",
      title: "Still valid (later dates)",
      hint: "Active cards",
      items: later,
      tone: "border-gray-200 bg-white",
      badge: "bg-gray-100 text-gray-700",
    },
  ];

  function campusLabel(s: any) {
    const c = Array.isArray(s?.campuses) ? s.campuses[0] : s?.campuses;
    return c?.short_name || c?.name || "—";
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Card renewals</h1>
        <p className="text-gray-500 mt-1">
          Tutorial centres (Arepo / Ofada): after payment, the card is valid for
          one month (e.g. paid 22 Oct → renew 22 Nov). This table shows who is
          expiring.
          {!admin && profile?.campuses?.short_name
            ? ` · ${profile.campuses.short_name}`
            : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Expired</p>
          <p className="text-3xl font-bold text-red-800">{expired.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">Expiring today</p>
          <p className="text-3xl font-bold text-amber-900">{todayList.length}</p>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm text-orange-800">Next 7 days</p>
          <p className="text-3xl font-bold text-orange-900">{upcoming.length}</p>
        </div>
      </div>

      {sections.map((sec) => (
        <div
          key={sec.key}
          className={`mb-8 rounded-xl border shadow-sm overflow-hidden ${sec.tone}`}
        >
          <div className="px-6 py-4 border-b border-black/5">
            <h2 className="text-lg font-semibold text-gray-900">{sec.title}</h2>
            <p className="text-sm text-gray-600">{sec.hint}</p>
          </div>
          <div className="overflow-x-auto bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Student</th>
                  <th className="text-left px-4 py-3 font-medium">Campus</th>
                  <th className="text-left px-4 py-3 font-medium">Fee</th>
                  <th className="text-left px-4 py-3 font-medium">Valid until</th>
                  <th className="text-left px-4 py-3 font-medium">Parent phone</th>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sec.items.length > 0 ? (
                  sec.items.map((r: any) => {
                    const st = Array.isArray(r.students)
                      ? r.students[0]
                      : r.students;
                    const ft = Array.isArray(r.fee_types)
                      ? r.fee_types[0]
                      : r.fee_types;
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {st?.full_name}
                          </div>
                          <div className="text-xs text-gray-400">
                            {st?.admission_number} · {st?.class_name}
                          </div>
                        </td>
                        <td className="px-4 py-3">{campusLabel(st)}</td>
                        <td className="px-4 py-3">
                          {ft?.name || "—"}
                          <div className="text-xs text-gray-400">
                            {formatCurrency(Number(r.amount || 0))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sec.badge}`}
                          >
                            {r.valid_until}
                          </span>
                        </td>
                        <td className="px-4 py-3">{st?.parent_phone || "—"}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/payments?student=${st?.id}`}
                            className="text-brand-green font-medium hover:underline"
                          >
                            Record renewal
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-gray-400"
                    >
                      None in this group
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="text-sm text-gray-500 bg-gray-50 border rounded-xl p-4">
        <p className="font-medium text-gray-700 mb-1">How it works</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            When you record a payment for an <strong>Arepo</strong> or{" "}
            <strong>Ofada Mowe</strong> student, the system sets{" "}
            <strong>valid until = payment date + 1 month</strong> (same day next
            month).
          </li>
          <li>
            Example: paid ₦30,000 on 22 Oct → appears here as renew on 22 Nov.
          </li>
          <li>
            Recording another payment moves the valid-until date forward by one
            month from the new payment date.
          </li>
        </ul>
      </div>
    </div>
  );
}
