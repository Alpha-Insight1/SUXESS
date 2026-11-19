import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import {
  AI_TOOL_DEFINITIONS,
  runSchoolTool,
  detectToolsFromQuestion,
  formatToolResultsForAnswer,
} from "@/lib/ai/school-tools";

type ChatMessage = { role: "user" | "assistant" | "system" | "tool"; content: string; tool_call_id?: string; name?: string };

function llmConfig() {
  const xai = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  const openai = process.env.OPENAI_API_KEY;
  if (xai) {
    return {
      apiKey: xai,
      baseUrl: process.env.XAI_BASE_URL || "https://api.x.ai/v1",
      model: process.env.AI_MODEL || "grok-2-latest",
    };
  }
  if (openai) {
    return {
      apiKey: openai,
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      model: process.env.AI_MODEL || "gpt-4o-mini",
    };
  }
  return null;
}

const SYSTEM = `You are Alpha, the Suxess Schools AI assistant for the director, inside the fee management app.
Answer clearly and briefly using ONLY tool results about real school data.
Branches: Main (Suxess School), Arepo tutorial, Ofada Mowe tutorial.
"Card renewals" = tutorial monthly membership cards (valid_until), not exam forms.
When asked how many renewed / still valid, use still_valid_cards.
Format money in Naira. If data is missing, say so. Do not invent numbers.`;

async function callLlm(
  cfg: { apiKey: string; baseUrl: string; model: string },
  messages: any[],
  tools?: typeof AI_TOOL_DEFINITIONS
) {
  const body: any = {
    model: cfg.model,
    messages,
    temperature: 0.2,
  };
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM error ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getCurrentProfile();
    if (!profile || !isAdmin(profile)) {
      return NextResponse.json(
        { error: "Admin only. Sign in as director/admin." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const question = String(body.question || body.message || "").trim();
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    if (!question) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    const cfg = llmConfig();

    // ——— Path A: no API key → local tools + formatted answer ———
    if (!cfg) {
      const planned = detectToolsFromQuestion(question);
      const results: { tool: string; data: unknown }[] = [];
      for (const t of planned) {
        const data = await runSchoolTool(supabase, t.name, t.args);
        results.push({ tool: t.name, data });
      }
      const answer = formatToolResultsForAnswer(question, results);
      return NextResponse.json({
        answer,
        mode: "local",
        tools_used: results.map((r) => r.tool),
        hint: "Add XAI_API_KEY or OPENAI_API_KEY to .env.local for full AI answers in natural language.",
      });
    }

    // ——— Path B: LLM + tools ———
    const messages: any[] = [
      { role: "system", content: SYSTEM },
      ...history
        .filter((m: any) => m?.role === "user" || m?.role === "assistant")
        .map((m: any) => ({ role: m.role, content: String(m.content || "") })),
      { role: "user", content: question },
    ];

    const toolsUsed: string[] = [];
    let finalText = "";
    let rounds = 0;
    const maxRounds = 4;

    while (rounds < maxRounds) {
      rounds += 1;
      const completion = await callLlm(cfg, messages, AI_TOOL_DEFINITIONS);
      const choice = completion.choices?.[0]?.message;
      if (!choice) throw new Error("Empty LLM response");

      const toolCalls = choice.tool_calls;
      if (toolCalls?.length) {
        messages.push({
          role: "assistant",
          content: choice.content || null,
          tool_calls: toolCalls,
        });
        for (const tc of toolCalls) {
          const fname = tc.function?.name || "";
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function?.arguments || "{}");
          } catch {
            args = {};
          }
          toolsUsed.push(fname);
          const result = await runSchoolTool(supabase, fname, args);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      finalText = String(choice.content || "").trim();
      break;
    }

    if (!finalText) {
      // Fallback if model only called tools
      const planned = detectToolsFromQuestion(question);
      const results: { tool: string; data: unknown }[] = [];
      for (const t of planned) {
        const data = await runSchoolTool(supabase, t.name, t.args);
        results.push({ tool: t.name, data });
      }
      finalText = formatToolResultsForAnswer(question, results);
    }

    return NextResponse.json({
      answer: finalText,
      mode: "llm",
      tools_used: toolsUsed,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Assistant failed";
    console.error("[ai-assistant]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
