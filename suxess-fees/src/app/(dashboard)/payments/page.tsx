import { createClient } from "@/lib/supabase/server";
import { RecordPaymentForm } from "@/components/payments/record-payment-form";
import { InventorySaleForm } from "@/components/inventory/inventory-sale-form";
import { getCurrentProfile, campusFilter } from "@/lib/auth";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const campusId = campusFilter(profile);

  let studentsQuery = supabase
    .from("students")
    .select(
      "id, full_name, admission_number, class_name, parent_name, parent_phone, parent_email, campuses(short_name, name)"
    )
    .eq("status", "active")
    .order("full_name");
  if (campusId) studentsQuery = studentsQuery.eq("campus_id", campusId);

  let inventoryQuery = supabase
    .from("inventory_items")
    .select(
      "id, name, quantity, unit, cost_price, selling_price, category"
    )
    .gt("quantity", 0)
    .order("name");
  if (campusId) {
    inventoryQuery = inventoryQuery.or(
      `campus_id.eq.${campusId},campus_id.is.null`
    );
  }

  const [{ data: students }, { data: feeTypes }, { data: studentFees }, { data: products }] =
    await Promise.all([
      studentsQuery,
      supabase.from("fee_types").select("id, name").order("name"),
      params.student
        ? supabase
            .from("student_fees")
            .select("*, fee_types(name)")
            .eq("student_id", params.student)
            .gt("balance", 0)
        : Promise.resolve({ data: [] as any[] }),
      inventoryQuery,
    ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Record Payment</h1>
        <p className="text-gray-500 mt-1">
          Fees and inventory sales
          {profile?.campuses?.short_name
            ? ` · ${profile.campuses.short_name}`
            : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Student fees
          </h2>
          <RecordPaymentForm
            students={students || []}
            feeTypes={feeTypes || []}
            preselectedStudentId={params.student}
            outstandingFees={studentFees || []}
          />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Inventory sales
          </h2>
          <InventorySaleForm
            products={(products as any) || []}
            students={(students || []).map((s) => ({
              id: s.id,
              full_name: s.full_name,
              admission_number: s.admission_number,
            }))}
            campusId={campusId}
          />
        </div>
      </div>
    </div>
  );
}
