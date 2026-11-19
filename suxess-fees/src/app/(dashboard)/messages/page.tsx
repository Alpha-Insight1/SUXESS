import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatPanel } from "@/components/messages/chat-panel";

export default async function MessagesPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const admin = isAdmin(profile);

  // Conversations this user is in
  const { data: parts } = await supabase
    .from("chat_participants")
    .select("conversation_id, last_read_at")
    .eq("user_id", profile.id);

  const convIds = (parts || []).map((p) => p.conversation_id);

  let conversations: {
    id: string;
    title: string | null;
    campus_id: string | null;
    other_name?: string;
    other_id?: string;
    unread?: number;
  }[] = [];

  if (convIds.length > 0) {
    const { data: convs } = await supabase
      .from("chat_conversations")
      .select("id, title, campus_id")
      .in("id", convIds)
      .order("updated_at", { ascending: false });

    // Load other participants
    const { data: allParts } = await supabase
      .from("chat_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", convIds);

    const otherIds = new Set<string>();
    for (const p of allParts || []) {
      if (p.user_id !== profile.id) otherIds.add(p.user_id);
    }
    const { data: otherProfiles } = otherIds.size
      ? await supabase
          .from("profiles")
          .select("id, full_name, campus_id, campuses(short_name, name)")
          .in("id", Array.from(otherIds))
      : { data: [] as any[] };

    const profileMap = new Map(
      (otherProfiles || []).map((p: any) => [p.id, p])
    );

    conversations = (convs || []).map((c) => {
      const others = (allParts || []).filter(
        (p) => p.conversation_id === c.id && p.user_id !== profile.id
      );
      const other = others[0] ? profileMap.get(others[0].user_id) : null;
      const camp = other?.campuses
        ? Array.isArray(other.campuses)
          ? other.campuses[0]
          : other.campuses
        : null;
      return {
        id: c.id,
        title: c.title,
        campus_id: c.campus_id,
        other_id: others[0]?.user_id,
        other_name:
          other?.full_name ||
          (camp ? camp.short_name || camp.name : null) ||
          c.title ||
          "Chat",
      };
    });
  }

  // Unread counts (messages from others after last_read_at)
  const partMap = new Map(
    (parts || []).map((p: any) => [
      p.conversation_id as string,
      p.last_read_at as string | null,
    ])
  );
  for (let i = 0; i < conversations.length; i++) {
    const c = conversations[i];
    const lastRead = partMap.get(c.id) || null;
    let q = supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", c.id)
      .neq("sender_id", profile.id);
    if (lastRead) q = q.gt("created_at", lastRead);
    const { count } = await q;
    conversations[i] = { ...c, unread: count || 0 };
  }

  // Secretaries list for admin to start chats
  let secretaries: {
    id: string;
    full_name: string | null;
    campus_label: string;
  }[] = [];
  if (admin) {
    const { data: secs } = await supabase
      .from("profiles")
      .select("id, full_name, campus_id, campuses(short_name, name)")
      .eq("role", "secretary");
    secretaries = (secs || []).map((s: any) => {
      const camp = Array.isArray(s.campuses) ? s.campuses[0] : s.campuses;
      return {
        id: s.id,
        full_name: s.full_name,
        campus_label: camp?.short_name || camp?.name || "",
      };
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="text-gray-500 mt-1">
          Chat between director and secretaries. Text and voice notes are
          supported. Available from every dashboard.
        </p>
      </div>
      <ChatPanel
        currentUserId={profile.id}
        currentUserName={profile.full_name || "You"}
        isAdmin={admin}
        initialConversations={conversations}
        secretaries={secretaries}
      />
      <p className="text-xs text-gray-400 mt-4">
        Voice notes need a Supabase Storage bucket named{" "}
        <code className="bg-gray-100 px-1 rounded">chat-voice</code> (public
        read + authenticated upload). Run the SQL migration for tables first.
      </p>
    </div>
  );
}
