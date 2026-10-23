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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, campus_id, campuses(id, name, short_name)")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return {
      id: user.id,
      full_name: user.email || null,
      role: "admin",
      campus_id: null,
      campuses: null,
    };
  }

  return {
    id: profile.id,
    full_name: profile.full_name,
    role: (profile.role as UserRole) || "secretary",
    campus_id: profile.campus_id,
    campuses: Array.isArray(profile.campuses)
      ? profile.campuses[0] || null
      : (profile.campuses as Profile["campuses"]) || null,
  };
});

export function isAdmin(profile: Profile | null): boolean {
  return profile?.role === "admin";
}

/** Campus filter for secretaries; null means no filter (admin). */
export function campusFilter(profile: Profile | null): string | null {
  if (!profile || profile.role === "admin") return null;
  return profile.campus_id;
}
