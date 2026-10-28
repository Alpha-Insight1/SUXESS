import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";

function toTermiiPhone(raw: string): string | null {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("234") && d.length >= 13) return d.slice(0, 13);
  if (d.startsWith("0") && d.length === 11) return "234" + d.slice(1);
  if (d.length === 10) return "234" + d;
  if (d.startsWith("234") && d.length === 13) return d;
  return d.length >= 10 ? d : null;
}

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
        { error: "Only admin can send bulk SMS" },
        { status: 403 }
      );
    }

    // SMS paused until Termii Sender ID is approved — set SMS_ENABLED=true on Vercel to turn on
    if (process.env.SMS_ENABLED !== "true") {
      return NextResponse.json(
        { error: "Not Available Now" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const message = String(body.message || "").trim();
    const phones: string[] = Array.isArray(body.phones) ? body.phones : [];

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (message.length > 480) {
      return NextResponse.json(
        { error: "Message too long (max about 480 characters)" },
        { status: 400 }
      );
    }
    if (!phones.length) {
      return NextResponse.json(
        { error: "Select at least one phone number" },
        { status: 400 }
      );
    }

    const normalized = [
      ...new Set(
        phones.map(toTermiiPhone).filter((p): p is string => Boolean(p))
      ),
    ];
    if (!normalized.length) {
      return NextResponse.json(
        { error: "No valid phone numbers" },
        { status: 400 }
      );
    }

    const apiKey = process.env.TERMII_API_KEY;
    const senderId = process.env.TERMII_SENDER_ID || "Suxess";
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "SMS is not configured. Add TERMII_API_KEY in Vercel environment variables.",
        },
        { status: 503 }
      );
    }

    // Termii bulk API
    const res = await fetch("https://api.ng.termii.com/api/sms/send/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: normalized,
        from: senderId,
        sms: message,
        type: "plain",
        channel: "generic",
        api_key: apiKey,
      }),
    });

    const data = await res.json().catch(() => ({}));
    const ok =
      res.ok &&
      (data.message_id ||
        data.code === "ok" ||
        String(data.message || "")
          .toLowerCase()
          .includes("success"));

    if (!ok) {
      // Fallback: send one-by-one if bulk endpoint fails
      let sent = 0;
      const errors: string[] = [];
      for (const to of normalized) {
        const r = await fetch("https://api.ng.termii.com/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to,
            from: senderId,
            sms: message,
            type: "plain",
            channel: "generic",
            api_key: apiKey,
          }),
        });
        const d = await r.json().catch(() => ({}));
        const oneOk =
          r.ok &&
          (d.message_id ||
            d.code === "ok" ||
            String(d.message || "")
              .toLowerCase()
              .includes("success"));
        if (oneOk) sent += 1;
        else errors.push(`${to}: ${d.message || d.error || "failed"}`);
      }
      if (sent === 0) {
        return NextResponse.json(
          {
            error:
              data.message ||
              data.error ||
              errors[0] ||
              "Failed to send bulk SMS. Check Termii balance.",
          },
          { status: 502 }
        );
      }
      return NextResponse.json({
        ok: true,
        sent,
        total: normalized.length,
        partial: sent < normalized.length,
        errors: errors.slice(0, 5),
      });
    }

    return NextResponse.json({
      ok: true,
      sent: normalized.length,
      total: normalized.length,
      message_id: data.message_id,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
