import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  ChatPanel,
  type ChatContact,
  type ChatConversation,
} from "@/components/messages/chat-panel";

function isAdminRole(role?: string | null) {
  const r = String(role || "")
    .trim()
    .toLowerCase();
  return ["admin", "director", "owner", "administrator"].includes(r);
}

function campusLabel(campuses: any): string {
  if (!campuses) return "";
  const c = Array.isArray(campuses) ? campuses[0] : campuses;
  return `${c?.short_name || c?.name || ""}`.trim();
}

export default async function MessagesPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const admin = isAdmin(profile);

  // Probe whether chat tables exist
  const probe = await supabase
    .from("chat_conversations")
    .select("id")
    .limit(1);
  const tablesReady = !probe.error;
  const loadError = probe.error
    ? `Database: ${probe.error.message}`
    : null;

  // ——— Staff directory ———
  // Admin sees secretaries; secretaries see directors/admins
  let contacts: ChatContact[] = [];
  const { data: allProfiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, role, campus_id, campuses(short_name, name)")
    .neq("id", profile.id);

  if (profilesError) {
    // Fallback: try without join
    const { data: plain } = await supabase
      .from("profiles")
      .select("id, full_name, role, campus_id")
      .neq("id", profile.id);
    const rows = plain || [];
    contacts = rows
      .filter((p) =>
        admin ? !isAdminRole(p.role) : isAdminRole(p.role)
      )
      .map((p) => ({
        id: p.id,
        full_name: p.full_name,
        role: p.role || "secretary",
        campus_label: "",
      }));
  } else {
    contacts = (allProfiles || [])
      .filter((p) =>
        admin ? !isAdminRole(p.role) : isAdminRole(p.role)
      )
      .map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        role: p.role || "secretary",
        campus_label: campusLabel(p.campuses),
      }))
      .sort((a, b) =>
        (a.full_name || a.campus_label).localeCompare(
          b.full_name || b.campus_label
        )
      );
  }

  // Online status (needs migration-secretary-activity.sql; ignored if missing)
  if (contacts.length) {
    const { data: seen, error: seenErr } = await supabase
      .from("profiles")
      .select("id, last_seen_at")
      .in("id", contacts.map((c) => c.id));
    if (!seenErr && seen) {
      const seenMap = new Map<string, string | null>(
        seen.map((r: any): [string, string | null] => [r.id, r.last_seen_at ?? null])
      );
      contacts = contacts.map((c) => ({ ...c, last_seen_at: seenMap.get(c.id) ?? null }));
    }
  }

  // ——— Existing conversations ———
  let conversations: ChatConversation[] = [];

  if (tablesReady) {
    const { data: parts } = await supabase
      .from("chat_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", profile.id);

    const convIds = (parts || []).map((p) => p.conversation_id);
    const partMap = new Map(
      (parts || []).map((p) => [p.conversation_id, p.last_read_at as string | null])
    );

    if (convIds.length > 0) {
      const { data: convs } = await supabase
        .from("chat_conversations")
        .select("id, title, campus_id, updated_at")
        .in("id", convIds)
        .order("updated_at", { ascending: false });

      const { data: allParts } = await supabase
        .from("chat_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", convIds);

      const otherIds = new Set<string>();
      for (const p of allParts || []) {
        if (p.user_id !== profile.id) otherIds.add(p.user_id);
      }

      const profileMap = new Map(
        (allProfiles || []).map((p: any) => [p.id, p])
      );
      // Ensure we have names for participants not in filtered contacts
      if (otherIds.size) {
        const missing = Array.from(otherIds).filter((id) => !profileMap.has(id));
        if (missing.length) {
          const { data: extra } = await supabase
            .from("profiles")
            .select("id, full_name, role, campuses(short_name, name)")
            .in("id", missing);
          for (const p of extra || []) {
            profileMap.set(p.id, p);
          }
        }
      }

      conversations = await Promise.all(
        (convs || []).map(async (c) => {
          const others = (allParts || []).filter(
            (p) => p.conversation_id === c.id && p.user_id !== profile.id
          );
          const otherId = others[0]?.user_id;
          const other = otherId ? profileMap.get(otherId) : null;
          const lastRead = partMap.get(c.id) || null;

          let unread = 0;
          let lastPreview: string | undefined;
          {
            let q = supabase
              .from("chat_messages")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", c.id)
              .neq("sender_id", profile.id);
            if (lastRead) q = q.gt("created_at", lastRead);
            const { count } = await q;
            unread = count || 0;
          }
          {
            const { data: lastMsg } = await supabase
              .from("chat_messages")
              .select("body, voice_url, created_at")
              .eq("conversation_id", c.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (lastMsg) {
              lastPreview = lastMsg.body || (lastMsg.voice_url ? "Voice note" : "");
            }
          }

          return {
            id: c.id,
            title: c.title,
            other_id: otherId,
            other_name:
              other?.full_name ||
              campusLabel(other?.campuses) ||
              c.title ||
              "Chat",
            other_campus: campusLabel(other?.campuses),
            unread,
            last_preview: lastPreview,
            updated_at: c.updated_at,
          } as ChatConversation;
        })
      );
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="text-gray-500 mt-1">
          {admin
            ? "Message any campus secretary. Unread badges and Seen status update when they open the chat."
            : "Message the director. You will see a Seen mark when your message is opened."}
        </p>
      </div>
      <ChatPanel
        currentUserId={profile.id}
        currentUserName={profile.full_name || "You"}
        isAdmin={admin}
        initialConversations={conversations}
        contacts={contacts}
        tablesReady={tablesReady}
        loadError={
          loadError ||
          (profilesError ? `Profiles: ${profilesError.message}` : null)
        }
      />
    </div>
  );
}
