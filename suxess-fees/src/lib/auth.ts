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

function normalizeRole(raw: unknown): UserRole {
  const r = String(raw || "")
    .trim()
    .toLowerCase();
  // Accept common variants
  if (
    r === "admin" ||
    r === "director" ||
    r === "owner" ||
    r === "administrator"
  ) {
    return "admin";
  }
  return "secretary";
}

/**
 * Load the signed-in user's profile (role + campus).
 * Uses a simple select first so a failed join cannot wipe admin role.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // 1) Plain profile — no join (avoids join/RLS failures wiping admin)
  const { data: row, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, campus_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[auth] profiles select error:", error.message, user.id);
  }

  if (!row) {
    // Try by email match is not possible without service role.
    // Return restricted profile — user must have profiles.id = auth.uid()
    console.error("[auth] no profile for user", user.id, user.email);
    return {
      id: user.id,
      full_name: user.email || null,
      role: "secretary",
      campus_id: null,
      campuses: null,
    };
  }

  const role = normalizeRole(row.role);
  let campuses: Profile["campuses"] = null;

  if (row.campus_id) {
    const { data: camp } = await supabase
      .from("campuses")
      .select("id, name, short_name")
      .eq("id", row.campus_id)
      .maybeSingle();
    if (camp) {
      campuses = {
        id: camp.id,
        name: camp.name,
        short_name: camp.short_name,
      };
    }
  }

  return {
    id: row.id,
    full_name: row.full_name,
    role,
    campus_id: row.campus_id,
    campuses,
  };
});

export function isAdmin(profile: Profile | null): boolean {
  return profile?.role === "admin";
}

export function campusFilter(profile: Profile | null): string | null {
  if (!profile) return "00000000-0000-0000-0000-000000000000";
  if (profile.role === "admin") return null;
  if (profile.campus_id) return profile.campus_id;
  return "00000000-0000-0000-0000-000000000000";
}
