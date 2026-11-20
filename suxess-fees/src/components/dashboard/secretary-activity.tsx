"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserCheck, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { presenceOf, timeAgo, type PresenceState } from "@/lib/presence";

export type SecretaryRow = {
  id: string;
  name: string;
  campus: string;
  last_seen_at: string | null;
  /** Has this secretary's campus submitted today's attendance? */
  attendance_submitted: boolean | null;
};

const STYLE: Record<PresenceState, { dot: string; label: string; text: string }> = {
  online: { dot: "bg-green-500", label: "Online now", text: "text-green-700" },
  today: { dot: "bg-amber-400", label: "Active today", text: "text-amber-700" },
  away: { dot: "bg-gray-300", label: "Inactive", text: "text-gray-500" },
  never: { dot: "bg-gray-300", label: "Not seen yet", text: "text-gray-400" },
};

/**
 * Director-only card: which secretaries are online / active.
 * Refreshes itself every 30 seconds.
 */
export function SecretaryActivity({
  initial,
  migrationMissing,
}: {
  initial: SecretaryRow[];
  migrationMissing?: boolean;
}) {
  const [rows, setRows] = useState<SecretaryRow[]>(initial);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (migrationMissing) return;
    const supabase = createClient();
    let cancelled = false;

    async function refresh() {
      try {
        const ids = initial.map((r) => r.id);
        if (!ids.length) return;
        const { data, error } = await supabase
          .from("profiles")
          .select("id, last_seen_at")
          .in("id", ids);
        if (error || !data || cancelled) return;
        const map = new Map<string, string | null>(
          data.map((d: any): [string, string | null] => [d.id, d.last_seen_at ?? null])
        );
        setRows((prev) =>
          prev.map((r) => ({ ...r, last_seen_at: map.get(r.id) ?? r.last_seen_at }))
        );
      } catch {
        /* ignore */
      }
    }

    const poll = setInterval(refresh, 30_000);
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [initial, migrationMissing]);

  const withState = rows
    .map((r) => ({ ...r, state: presenceOf(r.last_seen_at, now) }))
    .sort((a, b) => {
      const order: Record<PresenceState, number> = { online: 0, today: 1, away: 2, never: 3 };
      return order[a.state] - order[b.state] || a.name.localeCompare(b.name);
    });
  const onlineCount = withState.filter((r) => r.state === "online").length;
  const activeTodayCount = withState.filter(
    (r) => r.state === "online" || r.state === "today"
  ).length;

  return (
    <div className="mb-6 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <UserCheck className="w-4 h-4 text-brand-green shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-gray-900">Secretary activity</h2>
            <p className="text-xs text-gray-500">
              {migrationMissing
                ? "Setup needed"
                : `${onlineCount} online now · ${activeTodayCount} active today · ${rows.length} total`}
            </p>
          </div>
        </div>
        <Link
          href="/messages"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#4F52B8] hover:underline"
        >
          <MessageCircle className="w-3.5 h-3.5" /> Message a secretary
        </Link>
      </div>

      {migrationMissing ? (
        <p className="px-5 py-4 text-sm text-amber-800 bg-amber-50">
          Run <code className="bg-white px-1 rounded">migration-secretary-activity.sql</code>{" "}
          in the Supabase SQL Editor to start tracking secretary activity.
        </p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-500">No secretary accounts found.</p>
      ) : (
        <ul className="divide-y">
          {withState.map((r) => {
            const st = STYLE[r.state];
            return (
              <li key={r.id} className="px-5 py-3 flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  {r.state === "online" && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                  )}
                  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${st.dot}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                  <p className="text-xs text-gray-500 truncate">{r.campus || "No campus"}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-semibold ${st.text}`}>{st.label}</p>
                  <p className="text-[11px] text-gray-400">
                    {r.state === "online"
                      ? "using the app"
                      : r.last_seen_at
                        ? `last seen ${timeAgo(r.last_seen_at, now)}`
                        : "has not opened the app yet"}
                  </p>
                  {r.attendance_submitted !== null && (
                    <p
                      className={`text-[11px] ${
                        r.attendance_submitted ? "text-green-600" : "text-gray-400"
                      }`}
                    >
                      Attendance {r.attendance_submitted ? "submitted" : "not yet submitted"}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
