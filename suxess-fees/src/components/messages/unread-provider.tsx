"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type LatestUnread = {
  conversation_id: string;
  sender_name: string;
  preview: string;
  created_at: string;
};

type UnreadState = {
  count: number;
  latest: LatestUnread | null;
  refresh: () => void;
};

const UnreadContext = createContext<UnreadState>({
  count: 0,
  latest: null,
  refresh: () => {},
});

export function useUnreadMessages() {
  return useContext(UnreadContext);
}

/**
 * One shared live unread-message counter for the whole dashboard
 * (sidebar, mobile bar, floating button, dashboard banner, tab title).
 * Never throws — if chat tables are missing it simply reports 0.
 */
export function UnreadProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const [latest, setLatest] = useState<LatestUnread | null>(null);
  const loadRef = useRef<() => void>(() => {});
  const pathname = usePathname();
  const baseTitle = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let channel: any = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let busy = false;

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return;
    }
    const supabase = createClient();

    async function load() {
      if (busy) return;
      busy = true;
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const { data: parts, error } = await supabase
          .from("chat_participants")
          .select("conversation_id, last_read_at")
          .eq("user_id", user.id);

        if (error || !parts?.length) {
          if (!cancelled) {
            setCount(0);
            setLatest(null);
          }
          return;
        }

        let total = 0;
        let newest: {
          conversation_id: string;
          sender_id: string;
          body: string | null;
          voice_url: string | null;
          created_at: string;
        } | null = null;

        for (const p of parts) {
          let q = supabase
            .from("chat_messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", p.conversation_id)
            .neq("sender_id", user.id);
          if (p.last_read_at) q = q.gt("created_at", p.last_read_at);
          const { count: c, error: cErr } = await q;
          if (cErr || !c) continue;
          total += c;

          let lq = supabase
            .from("chat_messages")
            .select("conversation_id, sender_id, body, voice_url, created_at")
            .eq("conversation_id", p.conversation_id)
            .neq("sender_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1);
          if (p.last_read_at) lq = lq.gt("created_at", p.last_read_at);
          const { data: last } = await lq.maybeSingle();
          if (last && (!newest || last.created_at > newest.created_at)) {
            newest = last as any;
          }
        }

        if (cancelled) return;
        setCount(total);

        if (newest && total > 0) {
          let senderName = "Someone";
          const { data: prof } = await supabase
            .from("profiles")
            .select("full_name, role, campuses(short_name, name)")
            .eq("id", newest.sender_id)
            .maybeSingle();
          if (prof) {
            const camp: any = Array.isArray((prof as any).campuses)
              ? (prof as any).campuses[0]
              : (prof as any).campuses;
            const role = String((prof as any).role || "").toLowerCase();
            const isDirector = ["admin", "director", "owner", "administrator"].includes(role);
            senderName =
              (prof as any).full_name ||
              camp?.short_name ||
              camp?.name ||
              (isDirector ? "Director" : "Secretary");
          }
          if (!cancelled) {
            setLatest({
              conversation_id: newest.conversation_id,
              sender_name: senderName,
              preview:
                (newest.body || "").trim() ||
                (newest.voice_url ? "Voice note" : "New message"),
              created_at: newest.created_at,
            });
          }
        } else if (!cancelled) {
          setLatest(null);
        }
      } catch {
        if (!cancelled) {
          setCount(0);
          setLatest(null);
        }
      } finally {
        busy = false;
      }
    }

    loadRef.current = load;
    load();

    try {
      channel = supabase
        .channel(`unread-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          () => load()
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "chat_participants" },
          () => load()
        )
        .subscribe();
    } catch {
      /* realtime optional — polling below still works */
    }
    interval = setInterval(load, 30_000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      try {
        if (channel) supabase.removeChannel(channel);
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Re-check when leaving /messages (the chat marks messages as read there)
  useEffect(() => {
    loadRef.current();
  }, [pathname]);

  // "(3) Suxess Fees" in the browser tab so a new message is noticed even
  // when the app is in another tab.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const current = document.title.replace(/^\(\d+\+?\)\s*/, "");
    if (baseTitle.current === null || current) baseTitle.current = current;
    const base = baseTitle.current || "Suxess Fees";
    document.title = count > 0 ? `(${count > 99 ? "99+" : count}) ${base}` : base;
  }, [count, pathname]);

  const refresh = useCallback(() => loadRef.current(), []);
  const value = useMemo(() => ({ count, latest, refresh }), [count, latest, refresh]);

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}
