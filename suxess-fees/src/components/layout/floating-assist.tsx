"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageCircle,
  Sparkles,
  X,
  ChevronUp,
} from "lucide-react";
import { MessagesUnreadBadge } from "@/components/messages/unread-badge";
import { cn } from "@/lib/utils";

/**
 * Bottom-right floating toggles for Messages (everyone) and Alpha AI (admin only).
 */
export function FloatingAssist({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close menu on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Hide on the full AI / messages pages to avoid clutter (optional — keep visible)
  const hideOn = pathname === "/ai" || pathname === "/messages";

  if (hideOn) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2 safe-bottom">
      {/* Expanded panel */}
      {open && (
        <div className="mb-1 w-[min(16rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
          <div className="px-3 py-2 border-b bg-gray-50">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Quick access
            </p>
          </div>
          <div className="p-2 space-y-1">
            {/* Messages — all roles */}
            <Link
              href="/messages"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
            >
              <span className="p-2 rounded-lg bg-sky-50 text-sky-700">
                <MessageCircle className="w-4 h-4" />
              </span>
              <span className="flex-1 text-left">Messages</span>
              <MessagesUnreadBadge />
            </Link>

            {/* Alpha — admin only */}
            {isAdmin ? (
              <Link
                href="/ai"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
              >
                <span className="p-2 rounded-lg bg-brand-green/10 text-brand-green">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="flex-1 text-left">Alpha</span>
                <span className="text-[10px] font-semibold uppercase text-brand-green bg-brand-green/10 px-1.5 py-0.5 rounded-full">
                  AI
                </span>
              </Link>
            ) : (
              <div className="px-3 py-2 text-[11px] text-gray-400">
                Alpha AI is available to the director only.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close quick access" : "Open Messages and Alpha"}
        className={cn(
          "flex items-center justify-center gap-2 rounded-full shadow-lg transition active:scale-95",
          "h-14 min-w-[3.5rem] px-4",
          open
            ? "bg-gray-900 text-white hover:bg-gray-800"
            : "bg-brand-green text-white hover:bg-brand-dark"
        )}
      >
        {open ? (
          <X className="w-6 h-6" />
        ) : (
          <>
            <ChevronUp className="w-5 h-5 opacity-80" />
            <span className="relative flex items-center gap-1.5">
              {isAdmin && <Sparkles className="w-5 h-5" />}
              <MessageCircle className="w-5 h-5" />
              {/* Unread dot on closed FAB */}
              <span className="absolute -top-2 -right-3 scale-90">
                <MessagesUnreadBadge />
              </span>
            </span>
          </>
        )}
      </button>
    </div>
  );
}
