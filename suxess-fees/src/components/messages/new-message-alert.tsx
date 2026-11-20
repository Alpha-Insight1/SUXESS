"use client";

import Link from "next/link";
import { MessageCircle, ArrowRight } from "lucide-react";
import { useUnreadMessages } from "./unread-provider";

/**
 * Dashboard banner: shown only when the signed-in user has unread messages.
 */
export function NewMessageAlert() {
  const { count, latest } = useUnreadMessages();
  if (count <= 0) return null;

  return (
    <Link
      href="/messages"
      className="mb-6 flex items-center gap-3 rounded-2xl border-2 border-[#5B5FC7]/40 bg-[#5B5FC7]/10 px-4 py-3.5 hover:bg-[#5B5FC7]/15 transition group"
    >
      <span className="relative shrink-0">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5B5FC7] text-white">
          <MessageCircle className="w-5 h-5" />
        </span>
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-red-500" />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-gray-900">
          You have {count} new message{count === 1 ? "" : "s"}
        </span>
        {latest && (
          <span className="block text-sm text-gray-600 truncate">
            <span className="font-medium">{latest.sender_name}:</span>{" "}
            {latest.preview}
          </span>
        )}
      </span>
      <span className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-[#4F52B8] group-hover:underline shrink-0">
        Open messages <ArrowRight className="w-4 h-4" />
      </span>
    </Link>
  );
}
