"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Live unread message count for the current user (sidebar badge).
 */
export function MessagesUnreadBadge() {
  const [count, setCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: parts } = await supabase
        .from("chat_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", user.id);

      if (!parts?.length || cancelled) {
        if (!cancelled) setCount(0);
        return;
      }

      let total = 0;
      for (const p of parts) {
        let q = supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", p.conversation_id)
          .neq("sender_id", user.id);
        if (p.last_read_at) {
          q = q.gt("created_at", p.last_read_at);
        }
        const { count } = await q;
        total += count || 0;
      }
      if (!cancelled) setCount(total);
    }

    load();

    const channel = supabase
      .channel("sidebar-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => {
          load();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_participants" },
        () => {
          load();
        }
      )
      .subscribe();

    // Light poll as fallback when realtime is off
    const interval = setInterval(load, 45000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (count <= 0) return null;

  return (
    <span className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold shrink-0">
      {count > 99 ? "99+" : count}
    </span>
  );
}
