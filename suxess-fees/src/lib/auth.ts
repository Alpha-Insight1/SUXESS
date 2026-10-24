import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type UserRole = "admin" | "secretary";

export type Profile = {
  id: string;
  full_name: string | null;
  role: UserRole;
  campus_id: string | null;
  campuses?: {
    id: string;
    name: string;
    short_name: string | null;
  } | null;
};

/**
 * Load the signed-in user's profile (role + campus).
 * Cached per request so layout + page don't double-fetch.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, campus_id, campuses(id, name, short_name)")
    .eq("id", user.id)
    .maybeSingle();

  // No profile row → treat as restricted secretary (never default to admin)
  if (error || !profile) {
    return {
      id: user.id,
      full_name: user.email || null,
      role: "secretary",
      campus_id: null,
      campuses: null,
    };
  }

  const role: UserRole =
    profile.role === "admin" ? "admin" : "secretary";

  return {
    id: profile.id,
    full_name: profile.full_name,
    role,
    campus_id: profile.campus_id,
    campuses: Array.isArray(profile.campuses)
      ? profile.campuses[0] || null
      : (profile.campuses as Profile["campuses"]) || null,
  };
});

export function isAdmin(profile: Profile | null): boolean {
  return profile?.role === "admin";
}

/**
 * Campus filter for queries.
 * - Admin → null (see all)
 * - Secretary with campus → that campus id
 * - Secretary without campus → sentinel so they see NO other campuses' rows
 */
export function campusFilter(profile: Profile | null): string | null {
  if (!profile) return "00000000-0000-0000-0000-000000000000";
  if (profile.role === "admin") return null;
  if (profile.campus_id) return profile.campus_id;
  // Secretary missing campus_id must not see all data
  return "00000000-0000-0000-0000-000000000000";
}
