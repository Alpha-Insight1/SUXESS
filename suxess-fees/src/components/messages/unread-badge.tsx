"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Live unread message count. Never throws — returns null if chat is not set up.
 */
export function MessagesUnreadBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null =
      null;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        if (
          !process.env.NEXT_PUBLIC_SUPABASE_URL ||
          !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ) {
          return;
        }
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const { data: parts, error } = await supabase
          .from("chat_participants")
          .select("conversation_id, last_read_at")
          .eq("user_id", user.id);

        // Table missing or RLS — treat as zero unread
        if (error || !parts?.length) {
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
          const { count: c, error: cErr } = await q;
          if (!cErr) total += c || 0;
        }
        if (!cancelled) setCount(total);
      } catch {
        if (!cancelled) setCount(0);
      }
    }

    load();

    try {
      const supabase = createClient();
      channel = supabase
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
      interval = setInterval(load, 60000);
    } catch {
      /* ignore */
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      try {
        if (channel) {
          const supabase = createClient();
          supabase.removeChannel(channel);
        }
      } catch {
        /* ignore */
      }
    };
  }, []);

  if (count <= 0) return null;

  return (
    <span className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold shrink-0">
      {count > 99 ? "99+" : count}
    </span>
  );
}
