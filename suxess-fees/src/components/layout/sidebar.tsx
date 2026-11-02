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
  ListChecks,
  Award,
  Bus,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/theme-toggle";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  show?: "all" | "admin" | "secretary";
};

/** Single-school product: no branch filters — admin vs secretary only */
const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, show: "all" },
  { href: "/payments", label: "Record Payment", icon: CreditCard, show: "all" },
  { href: "/outstanding", label: "Outstanding", icon: AlertCircle, show: "all" },
  { href: "/fee-tracker", label: "Fees Tracker", icon: ListChecks, show: "all" },
  { href: "/students", label: "Students", icon: Users, show: "all" },
  { href: "/receipts", label: "Receipts", icon: Receipt, show: "all" },
  { href: "/school-bus", label: "School Bus", icon: Bus, show: "all" },
  { href: "/renewals", label: "Card Renewals", icon: CalendarClock, show: "all" },
  { href: "/exam-register", label: "Exam Register", icon: ClipboardCheck, show: "all" },
  { href: "/expenses", label: "Expenses", icon: Wallet, show: "all" },
  { href: "/teacher-pay", label: "Teacher Daily Pay", icon: BookOpen, show: "all" },
  { href: "/private-lessons", label: "Private Lessons", icon: GraduationCap, show: "all" },
  { href: "/inventory", label: "Inventory", icon: Package, show: "all" },
  { href: "/scholarships", label: "Scholarships", icon: Award, show: "admin" },
  { href: "/parents", label: "Parents · SMS", icon: Contact, show: "admin" },
  { href: "/loans", label: "Teacher Loans", icon: Banknote, show: "admin" },
  { href: "/staff", label: "Staff & Salaries", icon: UserCog, show: "admin" },
];

export function Sidebar({
  roleLabel,
  campusLabel,
  isAdminUser,
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

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const visible = navItems.filter((item) => {
    if (!item.show || item.show === "all") return true;
    if (item.show === "admin") return !!isAdminUser;
    if (item.show === "secretary") return !isAdminUser;
    return true;
  });

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const NavLinks = () => (
    <>
      <div className="px-4 pt-5 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Image
            src="/alpha-insight-logo.jpg"
            alt="Alpha Insight"
            width={44}
            height={44}
            className="rounded-lg object-contain bg-white p-0.5"
            priority
          />
          <div className="min-w-0">
            <p className="font-bold text-white text-sm leading-tight truncate">
              Alpha Insight
            </p>
            <p className="text-[10px] text-blue-200/90 uppercase tracking-wide truncate">
              Strategy & Analytics
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-blue-100/80 truncate">
          {roleLabel || "User"}
          {campusLabel ? ` · ${campusLabel}` : ""}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visible.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition",
                active
                  ? "bg-white/15 text-white"
                  : "text-blue-100/90 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10 space-y-2">
        <ThemeToggle className="w-full justify-center border-white/20 bg-white/10 text-white hover:bg-white/15" />
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-blue-100 hover:bg-white/10"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
        <p className="text-[10px] text-center text-blue-200/60">
          Alpha Insight
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 bg-brand-navy dark:bg-gray-950 border-b border-white/10 flex items-center px-3 gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg text-white hover:bg-white/10"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Image
          src="/alpha-insight-logo.jpg"
          alt="Alpha Insight"
          width={32}
          height={32}
          className="rounded object-contain bg-white p-0.5"
        />
        <span className="text-white font-semibold text-sm truncate">
          Alpha Insight
        </span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] h-full bg-brand-navy dark:bg-gray-900 flex flex-col shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 p-2 text-white/80 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <NavLinks />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-brand-navy dark:bg-gray-900 flex-col z-30">
        <NavLinks />
      </aside>
    </>
  );
}
