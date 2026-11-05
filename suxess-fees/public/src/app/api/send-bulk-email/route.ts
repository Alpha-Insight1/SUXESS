import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getCurrentProfile();
    if (!isAdmin(profile)) {
      return NextResponse.json(
        { error: "Only admin can send bulk email" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();
    const emails: string[] = Array.isArray(body.emails) ? body.emails : [];

    if (!subject) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const unique = [
      ...new Set(
        emails
          .map((e) => String(e || "").trim().toLowerCase())
          .filter((e) => e.includes("@") && e.includes("."))
      ),
    ];
    if (!unique.length) {
      return NextResponse.json(
        { error: "No valid email addresses selected" },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from =
      process.env.EMAIL_FROM || "Suxess Fees <onboarding@resend.dev>";
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Email is not configured. Add RESEND_API_KEY in Vercel environment variables.",
        },
        { status: 503 }
      );
    }

    const html = `<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; color: #111; line-height: 1.5;">
  <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #166534; margin: 0 0 12px;">Suxess Schools</h2>
    <div style="white-space: pre-wrap; font-size: 15px;">${message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>")}</div>
    <p style="margin-top: 24px; font-size: 12px; color: #999;">
      Discipline today, success tomorrow.<br/>Suxess Schools · Main · Arepo · Ofada Mowe
    </p>
  </div>
</body></html>`;

    let sent = 0;
    const errors: string[] = [];
    const chunkSize = 40;

    for (let i = 0; i < unique.length; i += chunkSize) {
      const chunk = unique.slice(i, i + chunkSize);
      const payload = chunk.map((to) => ({
        from,
        to: [to],
        subject,
        html,
      }));

      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        if (Array.isArray(data)) {
          sent += data.filter((d: any) => d.id || d.messageId).length || chunk.length;
        } else if (Array.isArray(data?.data)) {
          sent += data.data.length;
        } else {
          sent += chunk.length;
        }
      } else {
        for (const to of chunk) {
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ from, to: [to], subject, html }),
          });
          const d = await r.json().catch(() => ({}));
          if (r.ok && (d.id || d.data?.id)) sent += 1;
          else errors.push(`${to}: ${d.message || d.error || "failed"}`);
        }
      }
    }

    if (sent === 0) {
      return NextResponse.json(
        {
          error:
            errors[0] ||
            "Failed to send emails. Check Resend domain and API key.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      sent,
      total: unique.length,
      partial: sent < unique.length,
      errors: errors.slice(0, 5),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
