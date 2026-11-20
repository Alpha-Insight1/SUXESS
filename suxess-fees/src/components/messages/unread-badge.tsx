"use client";

import { useUnreadMessages } from "./unread-provider";

/**
 * Live unread message count pill (reads from the shared UnreadProvider).
 * Renders nothing when there are no unread messages.
 */
export function MessagesUnreadBadge({ className = "" }: { className?: string }) {
  const { count } = useUnreadMessages();
  if (count <= 0) return null;
  return (
    <span
      className={`ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold shrink-0 ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
