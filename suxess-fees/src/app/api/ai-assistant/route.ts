import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import {
  AI_TOOL_DEFINITIONS,
  runSchoolTool,
  detectToolsFromQuestion,
  formatToolResultsForAnswer,
  dataModelText,
  NO_ACCURATE_INFO,
} from "@/lib/ai/school-tools";
import { lagosToday } from "@/lib/active-students";

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

function buildSystemPrompt() {
  const now = new Date();
  const lagosNow = now.toLocaleString("en-NG", { timeZone: "Africa/Lagos" });
  return `You are Alpha, the AI assistant of Suxess Schools, built into the Suxess Fees app and used by the director/admin (the "operator").

TODAY: ${lagosToday()} (Lagos time now: ${lagosNow}). Currency: Naira (NGN).

ACCESS
You can READ every table in the app through your tools (students, fees, payments, expenses, staff, loans, attendance, inventory, scholarships, buses, private lessons, teacher pay, notifications, user accounts and secretary activity, and the director's messages). You cannot change anything.

HOW TO ANSWER
1. For every question about the school's data, call the tools FIRST. Never answer from memory or assumption. Use several tools if needed.
2. Use the specialised tools when one fits. For anything else use describe_data_model and query_table. For totals/averages/counts ALWAYS use query_table's aggregate option (do not add up rows yourself).
3. ACCURACY RULE: if the tools return an error, no data, truncated/partial data, or do not contain what is needed, or the question is about something that is not stored in the app, say plainly: "I don't have accurate information on that" and explain in one short line what is missing. Never guess, estimate, or invent names, numbers, dates or reasons. A partial answer is fine only if you clearly say which part you could not confirm.
4. If a name matches more than one student/person, list the matches and ask which one.
5. Be brief and direct. Use Naira with thousands separators. Mention the date/as-of when it matters. Short bullet points are fine for lists.

BUSINESS RULES (use these exactly)
• Branches: Main (Suxess School), Arepo tutorial, Ofada Mowe tutorial.
• TUTORIAL centres (Arepo, Ofada Mowe): a student is ACTIVE only while their membership card is still valid (latest card valid_until >= today, exam fees do not count as cards). A student whose card expired is NOT active even if students.status = active.
• MAIN school: registered active = students.status 'active'; the dashboard "Active students" KPI counts Main students who paid School Fees/Tuition at least once.
• "Card renewals" = tutorial monthly cards (valid_until), not exam forms. "Still valid / renewed" = still_valid_cards.
• Payments with deleted_at set are deleted — ignore them.
• Secretary "online" = app open within the last 3 minutes; "active today" = seen today; last_seen_at comes from the app's activity tracking.
• Unread message = sent by someone else after the reader's last_read_at.

TABLES AND COLUMNS
${dataModelText()}`;
}

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
      const answer = results.length
        ? formatToolResultsForAnswer(question, results)
        : NO_ACCURATE_INFO;
      return NextResponse.json({
        answer,
        mode: "local",
        tools_used: results.map((r) => r.tool),
        hint: "Add XAI_API_KEY or OPENAI_API_KEY to .env.local so Alpha can answer ANY question about the app in natural language. Without a key it only understands common keywords.",
      });
    }

    // ——— Path B: LLM + tools ———
    const messages: any[] = [
      { role: "system", content: buildSystemPrompt() },
      ...history
        .filter((m: any) => m?.role === "user" || m?.role === "assistant")
        .map((m: any) => ({ role: m.role, content: String(m.content || "") })),
      { role: "user", content: question },
    ];

    const toolsUsed: string[] = [];
    let finalText = "";
    let rounds = 0;
    const maxRounds = 8;

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
          let content = JSON.stringify(result);
          if (content.length > 24000) {
            content =
              content.slice(0, 24000) +
              '..."[TRUNCATED: result too large — narrow the query or use aggregate]"';
          }
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content,
          });
        }
        continue;
      }

      finalText = String(choice.content || "").trim();
      break;
    }

    if (!finalText) {
      // Tool budget used up: ask once more WITHOUT tools so the model must answer
      // from what it already collected (or say it lacks accurate info).
      try {
        messages.push({
          role: "user",
          content:
            "Answer now using only the tool results above. If they do not contain accurate information for the question, say \"I don't have accurate information on that\" and what is missing.",
        });
        const last = await callLlm(cfg, messages);
        finalText = String(last.choices?.[0]?.message?.content || "").trim();
      } catch {
        /* fall through */
      }
    }
    if (!finalText) finalText = NO_ACCURATE_INFO;

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
