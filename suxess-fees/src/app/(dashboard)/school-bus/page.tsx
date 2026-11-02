import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { BusForm } from "@/components/school-bus/bus-form";
import { AssignStudentForm } from "@/components/school-bus/assign-student-form";
import { Bus } from "lucide-react";

export default async function SchoolBusPage() {
  const supabase = await createClient();

  const [{ data: buses, error }, { data: assignments }, { data: students }] =
    await Promise.all([
      supabase
        .from("school_buses")
        .select("*")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("student_bus_assignments")
        .select(
          `id, pickup_point, status, assigned_at, bus_id,
           students(id, full_name, admission_number, class_name, parent_phone),
           school_buses(name)`
        )
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("students")
        .select("id, full_name, admission_number, class_name")
        .eq("status", "active")
        .order("full_name")
        .limit(2000),
    ]);

  const countByBus = new Map<string, number>();
  for (const a of assignments || []) {
    countByBus.set(a.bus_id, (countByBus.get(a.bus_id) || 0) + 1);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bus className="w-7 h-7 text-brand-blue" />
            School bus
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Buses, routes, drivers and student assignments
          </p>
        </div>
        <BusForm />
      </div>

      {error && (
        <div className="mb-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-900 dark:text-amber-100 text-sm rounded-lg p-3">
          {error.message}. Run{" "}
          <code className="text-xs">migration-school-bus.sql</code> in Supabase
          SQL Editor.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 space-y-3">
          {(buses || []).length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400">
              No buses yet — add your first bus
            </div>
          ) : (
            (buses || []).map((b: any) => (
              <div
                key={b.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {b.name}
                    {b.plate_number ? (
                      <span className="text-gray-400 font-normal text-sm ml-2">
                        {b.plate_number}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {b.route_name || "No route set"}
                    {b.driver_name ? ` · Driver: ${b.driver_name}` : ""}
                    {b.driver_phone ? ` (${b.driver_phone})` : ""}
                  </p>
                </div>
                <div className="text-sm text-right">
                  <p className="font-bold text-gray-900 dark:text-white">
                    {countByBus.get(b.id) || 0}
                    <span className="text-gray-400 font-normal">
                      {" "}
                      / {b.capacity || "—"} seats
                    </span>
                  </p>
                  {Number(b.bus_fee || 0) > 0 && (
                    <p className="text-xs text-gray-500">
                      Fee {formatCurrency(Number(b.bus_fee))}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <AssignStudentForm
          buses={(buses || []).map((b: any) => ({ id: b.id, name: b.name }))}
          students={(students as any) || []}
        />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
            Students on buses
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Student</th>
                <th className="text-left px-4 py-2 font-medium">Bus</th>
                <th className="text-left px-4 py-2 font-medium">Pickup</th>
                <th className="text-left px-4 py-2 font-medium">Parent phone</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800">
              {(assignments || []).length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-gray-400"
                  >
                    No assignments yet
                  </td>
                </tr>
              ) : (
                (assignments || []).map((a: any) => {
                  const st = Array.isArray(a.students)
                    ? a.students[0]
                    : a.students;
                  const bus = Array.isArray(a.school_buses)
                    ? a.school_buses[0]
                    : a.school_buses;
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {st?.full_name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {st?.admission_number}
                          {st?.class_name ? ` · ${st.class_name}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                        {bus?.name || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                        {a.pickup_point || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                        {st?.parent_phone || "—"}
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
