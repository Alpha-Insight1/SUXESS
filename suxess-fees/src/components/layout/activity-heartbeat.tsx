"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const PING_EVERY_MS = 60_000;

/**
 * Tells the database "this user is here" every minute while the app is open
 * and visible. The director's dashboard reads profiles.last_seen_at to show
 * which secretaries are online / active.
 * Fails silently if the migration has not been run yet.
 */
export function ActivityHeartbeat() {
  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return;
    }
    const supabase = createClient();
    let stopped = false;

    async function ping() {
      if (stopped || document.visibilityState === "hidden") return;
      try {
        await supabase.rpc("touch_last_seen");
      } catch {
        /* ignore — never break the app for a presence ping */
      }
    }

    ping();
    const timer = setInterval(ping, PING_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", ping);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", ping);
    };
  }, []);

  return null;
}
