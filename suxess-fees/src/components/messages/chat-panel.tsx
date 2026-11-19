"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Send,
  Mic,
  Square,
  Loader2,
  MessageCircle,
  User,
  Check,
  CheckCheck,
} from "lucide-react";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  voice_url: string | null;
  voice_duration_sec: number | null;
  created_at: string;
};

type Conversation = {
  id: string;
  title: string | null;
  campus_id: string | null;
  other_name?: string;
  other_id?: string;
  unread?: number;
};

type Props = {
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
  initialConversations: Conversation[];
  secretaries: { id: string; full_name: string | null; campus_label: string }[];
};

export function ChatPanel({
  currentUserId,
  currentUserName,
  isAdmin,
  initialConversations,
  secretaries,
}: Props) {
  const supabase = createClient();
  const [conversations, setConversations] =
    useState<Conversation[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(
    initialConversations[0]?.id || null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  /** Other participant's last_read_at for the active conversation */
  const [otherLastRead, setOtherLastRead] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshUnreadCounts = useCallback(async () => {
    const { data: parts } = await supabase
      .from("chat_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", currentUserId);
    if (!parts?.length) return;

    const counts: Record<string, number> = {};
    await Promise.all(
      parts.map(async (p) => {
        let q = supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", p.conversation_id)
          .neq("sender_id", currentUserId);
        if (p.last_read_at) {
          q = q.gt("created_at", p.last_read_at);
        }
        const { count } = await q;
        counts[p.conversation_id] = count || 0;
      })
    );
    setConversations((prev) =>
      prev.map((c) => ({ ...c, unread: counts[c.id] ?? 0 }))
    );
  }, [supabase, currentUserId]);

  const loadMessages = useCallback(
    async (convId: string) => {
      setLoadingMsgs(true);
      const { data } = await supabase
        .from("chat_messages")
        .select(
          "id, conversation_id, sender_id, body, voice_url, voice_duration_sec, created_at"
        )
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .limit(200);
      setMessages((data as Message[]) || []);

      // Other participant's last_read_at (for "Seen" on our messages)
      const { data: others } = await supabase
        .from("chat_participants")
        .select("user_id, last_read_at")
        .eq("conversation_id", convId)
        .neq("user_id", currentUserId);
      setOtherLastRead(others?.[0]?.last_read_at || null);

      // Mark as read for me
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
    if (activeId) loadMessages(activeId);
  }, [activeId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    refreshUnreadCounts();
  }, [refreshUnreadCounts]);

  // Realtime: new messages + read receipts (participant updates)
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`chat:${activeId}`)
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
          // If someone else sent it while we're viewing, mark read
          if (row.sender_id !== currentUserId) {
            supabase
              .from("chat_participants")
              .update({ last_read_at: new Date().toISOString() })
              .eq("conversation_id", activeId)
              .eq("user_id", currentUserId)
              .then(() => {
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === activeId ? { ...c, unread: 0 } : c
                  )
                );
              });
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
  }, [activeId, supabase, currentUserId]);

  // Global unread listener for other conversations
  useEffect(() => {
    const channel = supabase
      .channel("chat-unread-global")
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
                ? { ...c, unread: (c.unread || 0) + 1 }
                : c
            )
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUserId, activeId]);

  async function ensureConversationWith(secretaryId: string, label: string) {
    const existing = conversations.find((c) => c.other_id === secretaryId);
    if (existing) {
      setActiveId(existing.id);
      return existing.id;
    }
    const { data: conv, error } = await supabase
      .from("chat_conversations")
      .insert({ title: label })
      .select("id")
      .single();
    if (error || !conv) {
      alert(error?.message || "Could not start chat");
      return null;
    }
    await supabase.from("chat_participants").insert([
      { conversation_id: conv.id, user_id: currentUserId },
      { conversation_id: conv.id, user_id: secretaryId },
    ]);
    const newConv: Conversation = {
      id: conv.id,
      title: label,
      campus_id: null,
      other_name: label,
      other_id: secretaryId,
      unread: 0,
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveId(conv.id);
    return conv.id;
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
    // bump conversation updated_at
    await supabase
      .from("chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", activeId);
    if (error) {
      alert(error.message);
      setText(body);
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
      alert("Microphone permission is required for voice notes.");
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
      alert(
        "Voice upload failed. Create a public Storage bucket named “chat-voice” in Supabase. " +
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
    if (m.sender_id !== currentUserId) return false;
    if (!otherLastRead) return false;
    return otherLastRead >= m.created_at;
  }

  const active = conversations.find((c) => c.id === activeId);
  const totalUnread = conversations.reduce((s, c) => s + (c.unread || 0), 0);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[min(70vh,640px)]">
      {/* Conversation list */}
      <div className="lg:w-64 shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
        <div className="px-3 py-2.5 border-b bg-gray-50 font-semibold text-sm text-gray-800 flex items-center justify-between">
          <span>Chats</span>
          {totalUnread > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </div>
        <div className="overflow-y-auto flex-1">
          {conversations.length === 0 && (
            <p className="text-xs text-gray-500 p-3">
              {isAdmin
                ? "Start a chat with a secretary below."
                : "Waiting for the director to message you."}
            </p>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-100 hover:bg-gray-50 ${
                activeId === c.id ? "bg-brand-green/10 font-semibold" : ""
              }`}
            >
              <span className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate flex-1">
                  {c.other_name || c.title || "Chat"}
                </span>
                {(c.unread || 0) > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold shrink-0">
                    {c.unread! > 99 ? "99+" : c.unread}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
        {isAdmin && secretaries.length > 0 && (
          <div className="border-t p-2 space-y-1 max-h-40 overflow-y-auto">
            <p className="text-[10px] uppercase text-gray-500 px-1">
              Message secretary
            </p>
            {secretaries.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  ensureConversationWith(
                    s.id,
                    s.full_name || s.campus_label || "Secretary"
                  )
                }
                className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-gray-100 truncate"
              >
                {s.full_name || "Secretary"}
                {s.campus_label ? ` · ${s.campus_label}` : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col min-h-[320px]">
        <div className="px-4 py-2.5 border-b bg-gray-50 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-brand-green" />
          <span className="font-semibold text-sm text-gray-900">
            {active?.other_name || active?.title || "Select a chat"}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loadingMsgs && (
            <div className="flex justify-center py-8 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}
          {!loadingMsgs && messages.length === 0 && activeId && (
            <p className="text-center text-sm text-gray-400 py-8">
              No messages yet. Say hello!
            </p>
          )}
          {!activeId && (
            <p className="text-center text-sm text-gray-400 py-8">
              Choose a conversation or start one with a secretary.
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
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? "bg-brand-green text-white rounded-br-md"
                      : "bg-gray-100 text-gray-900 rounded-bl-md"
                  }`}
                >
                  {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                  {m.voice_url && (
                    <div className="mt-1">
                      <audio
                        controls
                        src={m.voice_url}
                        className="max-w-full h-8"
                      />
                      {m.voice_duration_sec != null && (
                        <p
                          className={`text-[10px] mt-0.5 ${
                            mine ? "text-green-100" : "text-gray-500"
                          }`}
                        >
                          {Math.round(Number(m.voice_duration_sec))}s voice note
                        </p>
                      )}
                    </div>
                  )}
                  <div
                    className={`flex items-center gap-1 mt-1 ${
                      mine ? "justify-end" : "justify-start"
                    }`}
                  >
                    <p
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
                    </p>
                    {mine && (
                      <span
                        title={seen ? "Opened / seen" : "Sent — not opened yet"}
                        className="inline-flex"
                      >
                        {seen ? (
                          <CheckCheck className="w-3.5 h-3.5 text-sky-200" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-green-100/80" />
                        )}
                      </span>
                    )}
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
          <div className="p-3 border-t flex items-end gap-2">
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={sending}
              className={`p-2.5 rounded-full shrink-0 ${
                recording
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              title={recording ? "Stop recording" : "Voice note"}
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
              className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-green focus:border-brand-green max-h-24"
              disabled={recording}
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
    </div>
  );
}
