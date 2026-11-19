"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
};

/**
 * Simple client collapsible so long lists (e.g. Card Renewals) stay neat.
 */
export function CollapsibleSection({
  title,
  subtitle,
  count,
  defaultOpen = false,
  children,
  className,
  headerClassName,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("border border-gray-200 rounded-xl overflow-hidden bg-white", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition",
          headerClassName
        )}
      >
        {open ? (
          <ChevronDown className="w-4 h-4 shrink-0 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0 text-gray-500" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-gray-900 flex items-center gap-2 flex-wrap">
            {title}
            {typeof count === "number" && (
              <span className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                {count}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      </button>
      {open && <div className="border-t border-gray-100">{children}</div>}
    </div>
  );
}
