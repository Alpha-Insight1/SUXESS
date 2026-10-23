import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Body = {
  phone: string;
  studentName: string;
  parentName?: string;
  receiptNumber: string;
  amountPaid: number;
  feeType?: string;
  feeAmount?: number;
  outstandingBalance?: number;
  session?: string;
  term?: string;
};

function formatNgn(n: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(n || 0);
}

/** Normalize to 234XXXXXXXXXX for Termii */
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

    const body = (await req.json()) as Body;
    const phone = toTermiiPhone(body.phone);
    if (!phone) {
      return NextResponse.json(
        { error: "Valid parent phone number is required (e.g. 0803…)" },
        { status: 400 }
      );
    }

    const outstanding = Number(body.outstandingBalance || 0);
    const text = [
      `Suxess Schools`,
      `Payment for ${body.studentName}`,
      `Paid: ${formatNgn(Number(body.amountPaid || 0))}`,
      `Receipt: ${body.receiptNumber}`,
      outstanding > 0
        ? `Balance: ${formatNgn(outstanding)}`
        : `Balance: Fully paid`,
      body.session && body.term ? `${body.session} ${body.term}` : null,
      `Thank you.`,
    ]
      .filter(Boolean)
      .join(". ");

    const apiKey = process.env.TERMII_API_KEY;
    const senderId = process.env.TERMII_SENDER_ID || "Suxess";

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "SMS is not configured. Add TERMII_API_KEY in Vercel environment variables.",
          configured: false,
        },
        { status: 503 }
      );
    }

    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: phone,
        from: senderId,
        sms: text,
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
      const errMsg =
        data.message ||
        data.error ||
        (typeof data === "string" ? data : null) ||
        "Failed to send SMS. Check Termii balance and sender ID.";
      return NextResponse.json(
        { error: String(errMsg), detail: data },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message_id: data.message_id,
      phone,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
