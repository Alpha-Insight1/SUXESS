"use client";

import { useEffect, useState, Component, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Sparkles, X, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

class SoftBoundary extends Component<
  { children: ReactNode },
  { broken: boolean }
> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  componentDidCatch() {
    /* swallow — never take down the whole dashboard */
  }
  render() {
    if (this.state.broken) return null;
    return this.props.children;
  }
}

/**
 * Bottom-right floating toggles for Messages (everyone) and Alpha AI (admin only).
 * Isolated so a failure here cannot crash the app.
 */
function FloatingAssistInner({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (pathname === "/ai" || pathname === "/messages") return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
      {open && (
        <div className="mb-1 w-[min(16rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
          <div className="px-3 py-2 border-b bg-gray-50">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Quick access
            </p>
          </div>
          <div className="p-2 space-y-1">
            <Link
              href="/messages"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
            >
              <span className="p-2 rounded-lg bg-sky-50 text-sky-700">
                <MessageCircle className="w-4 h-4" />
              </span>
              <span className="flex-1 text-left">Messages</span>
            </Link>

            {isAdmin ? (
              <Link
                href="/ai"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
              >
                <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="flex-1 text-left">Alpha</span>
                <span className="text-[10px] font-semibold uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                  AI
                </span>
              </Link>
            ) : (
              <p className="px-3 py-2 text-[11px] text-gray-400">
                Alpha AI is for the director only.
              </p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open Messages and Alpha"}
        className={cn(
          "flex items-center justify-center gap-2 rounded-full shadow-lg transition active:scale-95",
          "h-14 min-w-[3.5rem] px-4",
          open
            ? "bg-gray-900 text-white hover:bg-gray-800"
            : "bg-emerald-700 text-white hover:bg-emerald-800"
        )}
      >
        {open ? (
          <X className="w-6 h-6" />
        ) : (
          <>
            <ChevronUp className="w-5 h-5 opacity-80" />
            {isAdmin && <Sparkles className="w-5 h-5" />}
            <MessageCircle className="w-5 h-5" />
          </>
        )}
      </button>
    </div>
  );
}

export function FloatingAssist({ isAdmin }: { isAdmin: boolean }) {
  return (
    <SoftBoundary>
      <FloatingAssistInner isAdmin={isAdmin} />
    </SoftBoundary>
  );
}
