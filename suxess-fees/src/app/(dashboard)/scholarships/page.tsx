import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { GrantScholarshipForm } from "@/components/scholarships/grant-scholarship-form";
import { EndScholarshipButton } from "@/components/scholarships/scholarship-actions";
import { ApproveScholarshipButton } from "@/components/scholarships/approve-scholarship-button";

export default async function ScholarshipsPage() {
  const profile = await getCurrentProfile();
  if (!isAdmin(profile)) redirect("/");

  const supabase = await createClient();

  const [{ data: scholarships, error }, { data: students }] = await Promise.all([
    supabase
      .from("scholarships")
      .select(
        `id, session, term, coverage, amount_covered, prior_fees_paid, reason, status, created_at, campus_id, student_id,
         students(id, full_name, admission_number, class_name, parent_name, campuses(short_name, name))`
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("students")
      .select("id, full_name, admission_number, class_name, campus_id")
      .eq("status", "active")
      .order("full_name")
      .limit(3000),
  ]);

  const pending = (scholarships || []).filter(
    (s: any) => s.status === "pending_approval"
  );
  const active = (scholarships || []).filter((s: any) => s.status === "active");
  const ended = (scholarships || []).filter(
    (s: any) => s.status === "ended" || s.status === "cancelled"
  );

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scholarships</h1>
          <p className="text-gray-500 mt-1">
            Grant and manage student scholarships by session and term
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/fee-tracker"
            className="inline-flex items-center px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Fee tracker
          </Link>
          <GrantScholarshipForm students={(students as any) || []} />
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-3">
          {error.message}. Run{" "}
          <code className="text-xs">migration-scholarships.sql</code> in Supabase
          SQL Editor.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-5">
          <p className="text-sm text-gray-500">Pending your approval</p>
          <p className="text-3xl font-bold text-amber-800 mt-1">{pending.length}</p>
          <p className="text-xs text-gray-400 mt-1">
            Fees already paid — approve to subtract from school income
          </p>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">Active scholarships</p>
          <p className="text-3xl font-bold text-blue-800 mt-1">{active.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">Ended / cancelled</p>
          <p className="text-3xl font-bold text-gray-700 mt-1">{ended.length}</p>
        </div>
      </div>


      {pending.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-amber-300 shadow-sm overflow-hidden mb-8">
          <div className="px-5 py-3 border-b bg-amber-50">
            <h2 className="font-semibold text-amber-950">
              Awaiting director approval
            </h2>
            <p className="text-xs text-amber-800 mt-0.5">
              These students already paid school fees for the scholarship term.
              Approving subtracts that amount from school income.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Student</th>
                  <th className="text-left px-4 py-3 font-medium">Session / Term</th>
                  <th className="text-right px-4 py-3 font-medium">Already paid</th>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pending.map((s: any) => {
                  const st = Array.isArray(s.students) ? s.students[0] : s.students;
                  return (
                    <tr key={s.id} className="hover:bg-amber-50/40">
                      <td className="px-4 py-3">
                        <div className="font-medium">{st?.full_name}</div>
                        <div className="text-xs text-gray-400">
                          {st?.admission_number}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {s.session}
                        <div className="text-xs text-gray-400">{s.term}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-900">
                        {formatCurrency(Number(s.prior_fees_paid || 0))}
                      </td>
                      <td className="px-4 py-3">
                        <ApproveScholarshipButton
                          scholarship={{
                            id: s.id,
                            session: s.session,
                            term: s.term,
                            coverage: s.coverage,
                            amount_covered: s.amount_covered,
                            prior_fees_paid: s.prior_fees_paid,
                            campus_id: s.campus_id,
                            student_id: s.student_id,
                          }}
                          studentName={st?.full_name || "Student"}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="px-5 py-3 border-b bg-blue-50">
          <h2 className="font-semibold text-blue-950">Active</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Student</th>
                <th className="text-left px-4 py-3 font-medium">Session / Term</th>
                <th className="text-left px-4 py-3 font-medium">Coverage</th>
                <th className="text-left px-4 py-3 font-medium">Reason</th>
                <th className="text-left px-4 py-3 font-medium">Granted</th>
                <th className="text-left px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {active.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No active scholarships — grant one above
                  </td>
                </tr>
              ) : (
                active.map((s: any) => {
                  const st = Array.isArray(s.students)
                    ? s.students[0]
                    : s.students;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/students/${st?.id}`}
                          className="font-medium text-gray-900 hover:text-brand-green hover:underline"
                        >
                          {st?.full_name}
                        </Link>
                        <div className="text-xs text-gray-400">
                          {st?.admission_number}
                          {st?.class_name ? ` · ${st.class_name}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {s.session}
                        <div className="text-xs text-gray-400">{s.term}</div>
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {s.coverage}
                        {s.coverage === "partial" &&
                          Number(s.amount_covered || 0) > 0 && (
                            <div className="text-xs text-gray-500">
                              {formatCurrency(Number(s.amount_covered))}
                            </div>
                          )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-[12rem]">
                        {s.reason || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatDate(s.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <EndScholarshipButton id={s.id} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
