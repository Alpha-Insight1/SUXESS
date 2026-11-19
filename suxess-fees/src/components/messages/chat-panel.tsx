"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Send,
  Mic,
  Square,
  Loader2,
  MessageCircle,
  Search,
  Check,
  CheckCheck,
  Users,
  ArrowLeft,
} from "lucide-react";

export type ChatContact = {
  id: string;
  full_name: string | null;
  role: string;
  campus_label: string;
};

export type ChatConversation = {
  id: string;
  title: string | null;
  other_id?: string;
  other_name?: string;
  other_campus?: string;
  unread?: number;
  last_preview?: string;
  updated_at?: string;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  voice_url: string | null;
  voice_duration_sec: number | null;
  created_at: string;
};

type Props = {
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
  initialConversations: ChatConversation[];
  contacts: ChatContact[];
  tablesReady: boolean;
  loadError?: string | null;
};

function initials(name?: string | null) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
}

function isAdminRole(role?: string) {
  const r = String(role || "").toLowerCase();
  return ["admin", "director", "owner", "administrator"].includes(r);
}

export function ChatPanel({
  currentUserId,
  currentUserName,
  isAdmin,
  initialConversations,
  contacts,
  tablesReady,
  loadError,
}: Props) {
  const supabase = createClient();
  const [conversations, setConversations] =
    useState<ChatConversation[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(
    initialConversations[0]?.id || null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherLastRead, setOtherLastRead] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [query, setQuery] = useState("");
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        (c.full_name || "").toLowerCase().includes(q) ||
        c.campus_label.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q)
    );
  }, [contacts, query]);

  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        (c.other_name || "").toLowerCase().includes(q) ||
        (c.other_campus || "").toLowerCase().includes(q) ||
        (c.title || "").toLowerCase().includes(q)
    );
  }, [conversations, query]);

  const loadMessages = useCallback(
    async (convId: string) => {
      setLoadingMsgs(true);
      const { data, error } = await supabase
        .from("chat_messages")
        .select(
          "id, conversation_id, sender_id, body, voice_url, voice_duration_sec, created_at"
        )
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) {
        setBanner(error.message);
        setMessages([]);
      } else {
        setMessages((data as Message[]) || []);
      }

      const { data: others } = await supabase
        .from("chat_participants")
        .select("user_id, last_read_at")
        .eq("conversation_id", convId)
        .neq("user_id", currentUserId);
      setOtherLastRead(others?.[0]?.last_read_at || null);

      await supabase
        .from("chat_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", convId)
        .eq("user_id", currentUserId);

      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unread: 0 } : c))
      );
      setLoadingMsgs(false);
    },
    [supabase, currentUserId]
  );

  useEffect(() => {
    if (activeId) {
      loadMessages(activeId);
      setMobileShowChat(true);
    }
  }, [activeId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime messages + read receipts
  useEffect(() => {
    if (!activeId || !tablesReady) return;
    const channel = supabase
      .channel(`chat-room:${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${activeId}`,
        },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row]
          );
          if (row.sender_id !== currentUserId) {
            supabase
              .from("chat_participants")
              .update({ last_read_at: new Date().toISOString() })
              .eq("conversation_id", activeId)
              .eq("user_id", currentUserId);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_participants",
          filter: `conversation_id=eq.${activeId}`,
        },
        (payload) => {
          const row = payload.new as {
            user_id: string;
            last_read_at: string | null;
          };
          if (row.user_id !== currentUserId) {
            setOtherLastRead(row.last_read_at);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, supabase, currentUserId, tablesReady]);

  // Unread for other chats
  useEffect(() => {
    if (!tablesReady) return;
    const channel = supabase
      .channel("chat-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const row = payload.new as Message;
          if (row.sender_id === currentUserId) return;
          if (row.conversation_id === activeId) return;
          setConversations((prev) =>
            prev.map((c) =>
              c.id === row.conversation_id
                ? {
                    ...c,
                    unread: (c.unread || 0) + 1,
                    last_preview: row.body || "Voice note",
                    updated_at: row.created_at,
                  }
                : c
            )
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUserId, activeId, tablesReady]);

  async function startChatWith(contact: ChatContact) {
    if (!tablesReady) {
      setBanner(
        "Chat tables are not ready. Run migration-chat-professional.sql in Supabase."
      );
      return;
    }
    const existing = conversations.find((c) => c.other_id === contact.id);
    if (existing) {
      setActiveId(existing.id);
      return;
    }
    setStarting(contact.id);
    setBanner(null);
    try {
      const title =
        contact.full_name ||
        contact.campus_label ||
        (isAdminRole(contact.role) ? "Director" : "Secretary");

      const { data: conv, error: cErr } = await supabase
        .from("chat_conversations")
        .insert({ title })
        .select("id, title, updated_at")
        .single();
      if (cErr || !conv) throw new Error(cErr?.message || "Could not create chat");

      const { error: pErr } = await supabase.from("chat_participants").insert([
        { conversation_id: conv.id, user_id: currentUserId },
        { conversation_id: conv.id, user_id: contact.id },
      ]);
      if (pErr) throw new Error(pErr.message);

      const newConv: ChatConversation = {
        id: conv.id,
        title: conv.title,
        other_id: contact.id,
        other_name: contact.full_name || title,
        other_campus: contact.campus_label,
        unread: 0,
        updated_at: conv.updated_at,
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveId(conv.id);
    } catch (e: unknown) {
      setBanner(e instanceof Error ? e.message : "Failed to start chat");
    } finally {
      setStarting(null);
    }
  }

  async function sendText() {
    if (!activeId || !text.trim()) return;
    setSending(true);
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: activeId,
      sender_id: currentUserId,
      body,
    });
    await supabase
      .from("chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", activeId);
    if (error) {
      setBanner(error.message);
      setText(body);
    } else {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, last_preview: body, updated_at: new Date().toISOString() }
            : c
        )
      );
    }
    setSending(false);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        await uploadVoice(blob, recSeconds);
        setRecSeconds(0);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      setBanner("Microphone permission is required for voice notes.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function uploadVoice(blob: Blob, duration: number) {
    if (!activeId) return;
    setSending(true);
    const ext = blob.type.includes("webm") ? "webm" : "m4a";
    const path = `${activeId}/${currentUserId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("chat-voice")
      .upload(path, blob, { contentType: blob.type, upsert: false });
    if (upErr) {
      setBanner(
        "Voice note needs a Storage bucket named “chat-voice”. Text chat still works. " +
          upErr.message
      );
      setSending(false);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("chat-voice").getPublicUrl(path);
    await supabase.from("chat_messages").insert({
      conversation_id: activeId,
      sender_id: currentUserId,
      body: null,
      voice_url: publicUrl,
      voice_duration_sec: duration || 1,
    });
    await supabase
      .from("chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", activeId);
    setSending(false);
  }

  function isSeen(m: Message) {
    if (m.sender_id !== currentUserId || !otherLastRead) return false;
    return otherLastRead >= m.created_at;
  }

  const active = conversations.find((c) => c.id === activeId);

  if (!tablesReady) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-semibold">Messaging is not set up in the database yet</p>
        <p className="mt-2">
          In Supabase → SQL Editor, run these files in order:
        </p>
        <ol className="list-decimal ml-5 mt-2 space-y-1">
          <li>
            <code className="bg-white/70 px-1 rounded">
              migration-daily-attendance-messages.sql
            </code>
          </li>
          <li>
            <code className="bg-white/70 px-1 rounded">
              migration-chat-professional.sql
            </code>
          </li>
        </ol>
        {loadError && (
          <p className="mt-3 text-xs text-amber-800">Detail: {loadError}</p>
        )}
      </div>
    );
  }

  const sidebar = (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-brand-green" />
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900">Messages</p>
            <p className="text-[11px] text-gray-500 truncate">
              {isAdmin ? "Chat with secretaries" : "Chat with the director"}
            </p>
          </div>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people or chats…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-brand-green focus:border-brand-green"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Contacts directory */}
        <div className="px-3 pt-3 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {isAdmin ? "Secretaries" : "Directors"}
            <span className="text-gray-300">({filteredContacts.length})</span>
          </p>
        </div>
        {filteredContacts.length === 0 ? (
          <p className="px-3 py-2 text-xs text-gray-500">
            {contacts.length === 0
              ? isAdmin
                ? "No secretary profiles found. Create users in Supabase Auth and insert rows into the profiles table with role = secretary."
                : "No director/admin profile found yet."
              : "No matches for your search."}
          </p>
        ) : (
          <ul className="px-2 space-y-0.5">
            {filteredContacts.map((c) => {
              const open = conversations.find((x) => x.other_id === c.id);
              const busy = starting === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => startChatWith(c)}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-50 text-left transition"
                  >
                    <span className="w-9 h-9 rounded-full bg-brand-green/15 text-brand-green flex items-center justify-center text-xs font-bold shrink-0">
                      {initials(c.full_name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900 truncate">
                        {c.full_name || "Staff"}
                      </span>
                      <span className="block text-[11px] text-gray-500 truncate">
                        {c.campus_label ||
                          (isAdminRole(c.role) ? "Director" : "Secretary")}
                        {open ? " · Open chat" : ""}
                      </span>
                    </span>
                    {busy ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Existing conversations */}
        <div className="px-3 pt-4 pb-1 border-t mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Chats ({filteredConversations.length})
          </p>
        </div>
        {filteredConversations.length === 0 ? (
          <p className="px-3 py-2 text-xs text-gray-500">
            No conversations yet. Tap a person above to start.
          </p>
        ) : (
          <ul className="px-2 pb-3 space-y-0.5">
            {filteredConversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={`w-full flex items-center gap-2.5 px-2 py-2.5 rounded-xl text-left transition ${
                    activeId === c.id
                      ? "bg-brand-green/10 ring-1 ring-brand-green/20"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <span className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {initials(c.other_name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {c.other_name || c.title || "Chat"}
                      </span>
                      {(c.unread || 0) > 0 && (
                        <span className="ml-auto inline-flex min-w-[1.25rem] h-5 px-1.5 items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold">
                          {c.unread}
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] text-gray-500 truncate">
                      {c.last_preview || c.other_campus || "Conversation"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const thread = (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <div className="px-3 sm:px-4 py-2.5 border-b flex items-center gap-2 bg-gray-50">
        <button
          type="button"
          className="lg:hidden p-1.5 rounded-lg hover:bg-gray-200"
          onClick={() => {
            setMobileShowChat(false);
            setActiveId(null);
          }}
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {active ? (
          <>
            <span className="w-9 h-9 rounded-full bg-brand-green/15 text-brand-green flex items-center justify-center text-xs font-bold">
              {initials(active.other_name)}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">
                {active.other_name || active.title || "Chat"}
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                {active.other_campus || "Suxess staff"}
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">Select a person to chat</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f7f8fa] min-h-0">
        {!activeId && (
          <div className="h-full flex items-center justify-center text-center p-6">
            <div>
              <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">
                {isAdmin
                  ? "Choose a secretary to message"
                  : "Choose the director to message"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Your chats stay inside Suxess Fees.
              </p>
            </div>
          </div>
        )}
        {activeId && loadingMsgs && (
          <div className="flex justify-center py-10 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}
        {activeId && !loadingMsgs && messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-10">
            No messages yet. Say hello.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          const seen = isSeen(m);
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                  mine
                    ? "bg-brand-green text-white rounded-br-md"
                    : "bg-white text-gray-900 border border-gray-100 rounded-bl-md"
                }`}
              >
                {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                {m.voice_url && (
                  <div className="mt-1">
                    <audio controls src={m.voice_url} className="max-w-full h-8" />
                  </div>
                )}
                <div
                  className={`flex items-center gap-1 mt-1 ${
                    mine ? "justify-end" : ""
                  }`}
                >
                  <span
                    className={`text-[10px] ${
                      mine ? "text-green-100" : "text-gray-400"
                    }`}
                  >
                    {new Date(m.created_at).toLocaleString("en-NG", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  {mine &&
                    (seen ? (
                      <CheckCheck className="w-3.5 h-3.5 text-sky-200" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-green-100/80" />
                    ))}
                </div>
                {mine && seen && (
                  <p className="text-[10px] text-sky-100 text-right">Seen</p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {activeId && (
        <div className="p-3 border-t bg-white flex items-end gap-2">
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={sending}
            className={`p-2.5 rounded-full shrink-0 ${
              recording
                ? "bg-red-600 text-white animate-pulse"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            title={recording ? "Stop" : "Voice note"}
          >
            {recording ? (
              <Square className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
          {recording && (
            <span className="text-xs text-red-600 font-medium self-center">
              {recSeconds}s
            </span>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendText();
              }
            }}
            rows={1}
            placeholder="Type a message…"
            disabled={recording}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-green focus:border-brand-green max-h-28"
          />
          <button
            type="button"
            onClick={sendText}
            disabled={sending || !text.trim() || recording}
            className="p-2.5 rounded-full bg-brand-green text-white hover:bg-brand-dark disabled:opacity-50 shrink-0"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      {(banner || loadError) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {banner || loadError}
          {banner && (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setBanner(null)}
            >
              Dismiss
            </button>
          )}
        </div>
      )}
      <div className="h-[min(72vh,680px)] rounded-2xl border border-gray-200 shadow-sm overflow-hidden grid lg:grid-cols-[20rem_1fr]">
        <div
          className={`border-r border-gray-100 min-h-0 ${
            mobileShowChat ? "hidden lg:flex" : "flex"
          } flex-col`}
        >
          {sidebar}
        </div>
        <div
          className={`min-h-0 ${
            mobileShowChat ? "flex" : "hidden lg:flex"
          } flex-col`}
        >
          {thread}
        </div>
      </div>
      <p className="text-[11px] text-gray-400">
        Signed in as {currentUserName}
        {isAdmin ? " · Director" : " · Secretary"}. Text works after the chat
        migrations; voice needs the <code>chat-voice</code> storage bucket.
      </p>
    </div>
  );
}
