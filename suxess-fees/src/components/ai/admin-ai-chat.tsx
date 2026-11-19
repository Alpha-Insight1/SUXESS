"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "How many students renewed their card in Arepo?",
  "Card renewals status for Ofada Mowe",
  "How many students were present today in each branch?",
  "Payments collected today and this month",
  "How many active students at Main?",
  "Outstanding fees summary",
  "Exam registration pending board?",
];

export function AdminAiChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);
    try {
      const history = messages.slice(-6);
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.error || "Sorry, I could not answer that.",
          },
        ]);
        return;
      }
      setMode(data.mode || null);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer || "No answer returned." },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-[min(70vh,640px)]">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-brand-green to-emerald-700 text-white flex items-center gap-2">
        <Sparkles className="w-5 h-5" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">Alpha</p>
          <p className="text-[11px] text-green-100 truncate">
            Ask about renewals, attendance, payments, students…
          </p>
        </div>
        {mode && (
          <span className="text-[10px] uppercase tracking-wide bg-white/15 px-2 py-0.5 rounded-full">
            {mode === "llm" ? "AI" : "Data"}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="flex gap-2 items-start">
              <div className="p-2 rounded-full bg-brand-green/10 text-brand-green shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm text-gray-700 shadow-sm">
                Hi — I’m Alpha, your school assistant. Ask me anything about Suxess right now. For
                example:{" "}
                <em>
                  “How many students renewed their card in Arepo?”
                </em>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="text-left text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:border-brand-green hover:text-brand-green transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-2 items-start ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {m.role === "assistant" && (
              <div className="p-2 rounded-full bg-brand-green/10 text-brand-green shrink-0">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap shadow-sm ${
                m.role === "user"
                  ? "bg-brand-green text-white rounded-br-md"
                  : "bg-white border border-gray-200 text-gray-800 rounded-tl-md"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 items-center text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking school data…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="px-4 py-1.5 text-xs text-red-600 bg-red-50 border-t border-red-100">
          {error}
        </p>
      )}

      <form
        className="p-3 border-t flex gap-2 bg-white"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. How many card renewals in Arepo?"
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-green focus:border-brand-green"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-2.5 rounded-xl bg-brand-green text-white hover:bg-brand-dark disabled:opacity-50 shrink-0"
          aria-label="Send"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>
    </div>
  );
}
