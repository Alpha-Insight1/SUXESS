import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, campusFilter, isAdmin } from "@/lib/auth";
import {
  BulkSmsPanel,
  type ParentRow,
} from "@/components/parents/bulk-sms-panel";

export default async function ParentsPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const lockedCampus = campusFilter(profile);
  const admin = isAdmin(profile);

  let studentsQuery = supabase
    .from("students")
    .select(
      "id, full_name, parent_name, parent_phone, parent_email, campus_id, status, campuses(short_name, name)"
    )
    .eq("status", "active")
    .order("parent_name");
  if (lockedCampus) {
    studentsQuery = studentsQuery.eq("campus_id", lockedCampus);
  }

  let campusesQuery = supabase
    .from("campuses")
    .select("id, name, short_name")
    .eq("is_active", true)
    .order("name");
  if (lockedCampus) campusesQuery = campusesQuery.eq("id", lockedCampus);

  const [{ data: students }, { data: campuses }] = await Promise.all([
    studentsQuery,
    campusesQuery,
  ]);

  const map = new Map<string, ParentRow>();
  for (const s of students || []) {
    const phone = String(s.parent_phone || "").trim();
    const email = String(s.parent_email || "").trim();
    if (!phone && !email) continue;

    const camp = Array.isArray(s.campuses) ? s.campuses[0] : s.campuses;
    const campusLabel = camp?.short_name || camp?.name || "—";
    const key =
      (phone.replace(/\D/g, "") || email.toLowerCase()) +
      "|" +
      (s.campus_id || "");

    const existing = map.get(key);
    if (existing) {
      if (!existing.students.includes(s.full_name)) {
        existing.students = `${existing.students}, ${s.full_name}`;
      }
      if (!existing.email && email) existing.email = email;
      if (!existing.phone && phone) existing.phone = phone;
    } else {
      const row: ParentRow = {
        phone: phone || "",
        email: email || "",
        parent_name: s.parent_name || "—",
        students: s.full_name,
        campus: campusLabel,
        campus_id: s.campus_id || "",
      };
      map.set(key, row);
    }
  }

  const parents = Array.from(map.values()).sort((a, b) =>
    a.parent_name.localeCompare(b.parent_name)
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Parents · SMS & Email
        </h1>
        <p className="text-gray-500 mt-1">
          {admin
            ? "Parent contacts from all branches — send bulk SMS or email"
            : `Parent contacts at ${
                profile?.campuses?.short_name || "your campus"
              }`}
        </p>
      </div>

      <BulkSmsPanel
        parents={parents}
        campuses={campuses || []}
        isAdmin={admin}
      />
    </div>
  );
}
