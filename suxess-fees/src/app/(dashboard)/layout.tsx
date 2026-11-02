import { Sidebar } from "@/components/layout/sidebar";
import {
  PrivacyModeButton,
  PrivacyModeInit,
} from "@/components/layout/privacy-mode";
import { getCurrentProfile, isAdmin } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  const admin = isAdmin(profile);

  const roleLabel = admin
    ? "Admin"
    : profile?.role === "secretary"
      ? "Secretary"
      : "Staff";
  const campusLabel =
    profile?.campuses?.short_name || profile?.campuses?.name || "School";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        roleLabel={roleLabel}
        campusLabel={campusLabel}
        isAdminUser={admin}
      />
      <main className="pt-14 lg:pt-0 lg:ml-64 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[100vw] overflow-x-hidden">
          {admin && (
            <div className="flex justify-end mb-3">
              <PrivacyModeButton />
            </div>
          )}
          <PrivacyModeInit />
          {children}
          <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 mt-10 pb-4">
            Built by{" "}
            <span className="font-medium text-gray-500 dark:text-gray-400">
              Alpha Insight
            </span>{" "}
            · Strategy & Business Analytics
          </p>
        </div>
      </main>
    </div>
  );
}
