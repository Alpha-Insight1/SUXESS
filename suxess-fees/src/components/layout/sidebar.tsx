"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  AlertCircle,
  Receipt,
  Wallet,
  UserCog,
  Package,
  CalendarClock,
  Contact,
  BookOpen,
  ClipboardCheck,
  Banknote,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** all | admin | main | tutorial */
  show?: "all" | "admin" | "main" | "tutorial";
};

/**
 * Secretaries (Main): Dashboard, Payment, Outstanding, Students, Receipts, Expenses
 * Secretaries (Arepo/Ofada): Dashboard, Payment, Students, Receipts, Card Renewals,
 *   Exam Register, Expenses, Teacher Daily Pay
 * Admin: everything
 */
const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, show: "all" },
  { href: "/payments", label: "Record Payment", icon: CreditCard, show: "all" },
  { href: "/outstanding", label: "Outstanding", icon: AlertCircle, show: "main" },
  { href: "/students", label: "Students", icon: Users, show: "all" },
  { href: "/receipts", label: "Receipts", icon: Receipt, show: "all" },
  { href: "/renewals", label: "Card Renewals", icon: CalendarClock, show: "tutorial" },
  { href: "/exam-register", label: "Exam Register", icon: ClipboardCheck, show: "all" },
  { href: "/expenses", label: "Expenses", icon: Wallet, show: "all" },
  { href: "/teacher-pay", label: "Teacher Daily Pay", icon: BookOpen, show: "tutorial" },
  { href: "/inventory", label: "Inventory", icon: Package, show: "main" },
  { href: "/parents", label: "Parents · SMS", icon: Contact, show: "admin" },
  { href: "/loans", label: "Teacher Loans", icon: Banknote, show: "admin" },
  { href: "/staff", label: "Staff & Salaries", icon: UserCog, show: "admin" },
];

export function Sidebar({
  roleLabel,
  campusLabel,
  isAdminUser,
  isMainCampus,
  isTutorialCampus,
}: {
  roleLabel?: string;
  campusLabel?: string;
  isAdminUser?: boolean;
  isMainCampus?: boolean;
  isTutorialCampus?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const visible = navItems.filter((item) => {
    const show = item.show || "all";
    if (show === "all") return true;
    if (isAdminUser) return true;
    if (show === "admin") return false;
    if (show === "main") return !!isMainCampus;
    if (show === "tutorial") return !!isTutorialCampus;
    return false;
  });

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-brand-green text-white flex flex-col">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
        <Image
          src="/logo.png"
          alt="Suxess Schools"
          width={48}
          height={48}
          className="rounded-full bg-white p-0.5 object-contain"
          priority
        />
        <div className="min-w-0">
          <p className="font-bold text-sm leading-tight truncate">Suxess Fees</p>
          <p className="text-xs text-green-200 truncate">
            {campusLabel
              ? campusLabel
              : isAdminUser
                ? "All campuses"
                : "Payment Tracker"}
          </p>
        </div>
      </div>

      {(roleLabel || campusLabel) && (
        <div className="px-4 py-2 border-b border-white/10">
          <p className="text-[11px] uppercase tracking-wide text-green-200">
            Signed in as
          </p>
          <p className="text-sm font-medium truncate">
            {roleLabel || "Staff"}
            {campusLabel ? ` · ${campusLabel}` : ""}
          </p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {visible.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition",
                active
                  ? "bg-white text-brand-green"
                  : "text-green-50 hover:bg-white/10"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-green-50 hover:bg-white/10 transition"
        >
          <LogOut className="w-5 h-5" />
          Log out
        </button>
      </div>
    </aside>
  );
}
