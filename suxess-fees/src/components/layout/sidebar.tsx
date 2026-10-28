"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
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
  GraduationCap,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  show?: "all" | "admin" | "main" | "tutorial";
};

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
  { href: "/private-lessons", label: "Private Lessons", icon: GraduationCap, show: "all" },
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
  const [open, setOpen] = useState(false);

  // Close drawer on route change (mobile)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

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

  const nav = (
    <>
      <div className="flex items-center gap-3 px-4 sm:px-5 py-4 border-b border-white/10">
        <Image
          src="/logo.png"
          alt="Suxess Schools"
          width={44}
          height={44}
          className="rounded-full bg-white p-0.5 object-contain shrink-0"
          priority
        />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm leading-tight truncate">Suxess Fees</p>
          <p className="text-xs text-green-200 truncate">
            {campusLabel
              ? campusLabel
              : isAdminUser
                ? "All campuses"
                : "Payment Tracker"}
          </p>
        </div>
        <button
          type="button"
          className="lg:hidden p-2 -mr-1 rounded-lg hover:bg-white/10"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {(roleLabel || campusLabel) && (
        <div className="px-4 py-2.5 border-b border-white/10">
          <p className="text-[10px] uppercase tracking-wide text-green-200">
            Signed in as
          </p>
          <p className="text-sm font-medium truncate">
            {roleLabel || "Staff"}
            {campusLabel ? ` · ${campusLabel}` : ""}
          </p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5 overscroll-contain">
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition active:scale-[0.98]",
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

      <div className="p-3 border-t border-white/10 safe-bottom space-y-2">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-green-50 hover:bg-white/10 transition"
        >
          <LogOut className="w-5 h-5" />
          Log out
        </button>
        <p className="text-center text-[10px] text-green-200/90 leading-tight px-1">
          Built by <span className="font-semibold text-white">Alpha Insight</span>
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-brand-green text-white flex items-center gap-3 px-3 shadow-md">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg hover:bg-white/10 active:bg-white/20"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <Image
          src="/logo.png"
          alt=""
          width={32}
          height={32}
          className="rounded-full bg-white p-0.5 object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">Suxess Fees</p>
          <p className="text-[10px] text-green-100 truncate">
            {roleLabel || "Staff"}
            {campusLabel ? ` · ${campusLabel}` : isAdminUser ? " · All" : ""}
          </p>
        </div>
      </header>

      {/* Mobile overlay */}
      {open && (
        <button
          type="button"
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer (mobile) + fixed sidebar (desktop) */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-[min(18rem,85vw)] max-w-xs bg-brand-green text-white flex flex-col shadow-xl transition-transform duration-200 ease-out",
          "lg:translate-x-0 lg:w-64 lg:max-w-none lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {nav}
      </aside>
    </>
  );
}
