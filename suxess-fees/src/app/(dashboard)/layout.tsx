import { Sidebar } from "@/components/layout/sidebar";
import { PrivacyModeButton, PrivacyModeInit } from "@/components/layout/privacy-mode";
import { getCurrentProfile, isAdmin } from "@/lib/auth";

function campusKind(profile: Awaited<ReturnType<typeof getCurrentProfile>>) {
  const label = `${profile?.campuses?.short_name || ""} ${
    profile?.campuses?.name || ""
  }`.toLowerCase();
  const isTutorial =
    label.includes("arepo") ||
    label.includes("ofada") ||
    label.includes("mowe") ||
    label.includes("tutorial") ||
    label.includes("suxessof") ||
    label.includes("suxessar");
  const isMain =
    label.includes("main") ||
    label.includes("school") ||
    (!isTutorial && profile?.role === "secretary" && !!profile?.campus_id);
  // Non-main secretary with a campus → tutorial menus
  const forceTutorial =
    profile?.role === "secretary" &&
    !!profile?.campus_id &&
    !isMain;
  return {
    isTutorial: isTutorial || forceTutorial,
    isMain: isMain && !isTutorial,
    label,
  };
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
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        roleLabel={roleLabel}
        campusLabel={campusLabel}
        isAdminUser={admin}
        isMainCampus={admin ? true : isMain}
        isTutorialCampus={admin ? true : isTutorial}
      />
      {/* pt-14 = mobile top bar; lg:ml-64 = desktop sidebar */}
      <main className="pt-14 lg:pt-0 lg:ml-64 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[100vw] overflow-x-hidden">
          {admin && (
            <div className="flex justify-end mb-3">
              <PrivacyModeButton />
            </div>
          )}
          <PrivacyModeInit />
          {children}
          <p className="text-center text-[11px] text-gray-400 mt-10 pb-4">
            Suxess Fees · Built by{" "}
            <span className="font-medium text-gray-500">Alpha Insight</span>
          </p>
        </div>
      </main>
    </div>
  );
}
