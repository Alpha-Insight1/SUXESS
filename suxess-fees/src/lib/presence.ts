/** A user counts as "online" if the app pinged within this window. */
export const ONLINE_WINDOW_MS = 3 * 60 * 1000;

export type PresenceState = "online" | "today" | "away" | "never";

export function presenceOf(
  lastSeenIso: string | null | undefined,
  now: number = Date.now(),
  todayLagos?: string
): PresenceState {
  if (!lastSeenIso) return "never";
  const t = new Date(lastSeenIso).getTime();
  if (Number.isNaN(t)) return "never";
  if (now - t <= ONLINE_WINDOW_MS) return "online";
  const today =
    todayLagos ||
    new Date(now).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const seenDay = new Date(t).toLocaleDateString("en-CA", {
    timeZone: "Africa/Lagos",
  });
  return seenDay === today ? "today" : "away";
}

export function timeAgo(
  iso: string | null | undefined,
  now: number = Date.now()
): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "never";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
