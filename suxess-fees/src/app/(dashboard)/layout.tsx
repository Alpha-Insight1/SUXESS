import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentProfile, isAdmin } from "@/lib/auth";

function campusKind(profile: Awaited<ReturnType<typeof getCurrentProfile>>) {
  const label = `${profile?.campuses?.short_name || ""} ${
    profile?.campuses?.name || ""
  }`.toLowerCase();
  const isTutorial =
    label.includes("arepo") ||
    label.includes("ofada") ||
    label.includes("mowe");
  const isMain =
    label.includes("main") ||
    (!isTutorial && profile?.role === "secretary" && !!profile?.campus_id);
  return { isTutorial, isMain, label };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  const admin = isAdmin(profile);
  const { isTutorial, isMain } = campusKind(profile);

  const roleLabel = admin
    ? "Admin"
    : profile?.role === "secretary"
      ? "Secretary"
      : "Staff";
  const campusLabel =
    profile?.campuses?.short_name || profile?.campuses?.name || undefined;

  return (
    <div className="min-h-screen">
      <Sidebar
        roleLabel={roleLabel}
        campusLabel={campusLabel}
        isAdminUser={admin}
        isMainCampus={admin ? true : isMain}
        isTutorialCampus={admin ? true : isTutorial}
      />
      <main className="ml-64 p-6 lg:p-8">{children}</main>
    </div>
  );
}
