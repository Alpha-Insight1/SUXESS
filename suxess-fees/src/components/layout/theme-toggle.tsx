"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/layout/theme-provider";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === "dark" ? "Day mode" : "Night mode"}
      className={
        className ||
        "inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
      }
    >
      {theme === "dark" ? (
        <>
          <Sun className="w-3.5 h-3.5" /> Day
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5" /> Night
        </>
      )}
    </button>
  );
}
