"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Sparkles } from "lucide-react";
import { useUnreadMessages } from "@/components/messages/unread-provider";

class SoftBoundary extends Component<
  { children: ReactNode },
  { broken: boolean }
> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  componentDidCatch() {}
  render() {
    if (this.state.broken) return null;
    return this.props.children;
  }
}

/**
 * Bottom-right pills: Messages (all) + Ask Alpha (admin only).
 * Matches the requested dashboard toggle style.
 */
function FloatingAssistInner({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const { count: unread } = useUnreadMessages();

  // Hide on the dedicated pages themselves
  if (pathname === "/ai" || pathname === "/messages") return null;

  return (
    <div className="fixed bottom-5 right-4 z-[60] flex flex-col items-end gap-2.5 pointer-events-none">
      {/* Messages — everyone */}
      <Link
        href="/messages"
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-[#5B5FC7] text-white pl-3.5 pr-5 py-2.5 shadow-lg shadow-indigo-900/20 hover:bg-[#4F52B8] active:scale-[0.98] transition"
      >
        <MessageCircle className="w-5 h-5 shrink-0" strokeWidth={2.25} />
        <span className="text-[15px] font-semibold tracking-tight">Messages</span>
        {unread > 0 && (
          <span className="ml-0.5 inline-flex items-center justify-center min-w-[1.4rem] h-[1.4rem] px-1.5 rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>

      {/* Ask Alpha — director / admin only */}
      {isAdmin && (
        <Link
          href="/ai"
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-[#1e293b] text-white pl-3.5 pr-5 py-2.5 shadow-lg shadow-slate-900/30 hover:bg-[#0f172a] active:scale-[0.98] transition"
        >
          <Sparkles className="w-5 h-5 shrink-0" strokeWidth={2.25} />
          <span className="text-[15px] font-semibold tracking-tight">Ask Alpha</span>
        </Link>
      )}
    </div>
  );
}

export function FloatingAssist({ isAdmin }: { isAdmin: boolean }) {
  return (
    <SoftBoundary>
      <FloatingAssistInner isAdmin={!!isAdmin} />
    </SoftBoundary>
  );
}
