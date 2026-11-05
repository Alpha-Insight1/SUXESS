import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Body = {
  to: string;
  studentName: string;
  parentName?: string;
  receiptNumber: string;
  amountPaid: number;
  feeType?: string;
  feeAmount?: number;
  outstandingBalance?: number;
  session?: string;
  term?: string;
  paymentDate?: string;
  paymentMethod?: string;
};

function formatNgn(n: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(n || 0);
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
    const to = (body.to || "").trim();
    if (!to || !to.includes("@")) {
      return NextResponse.json(
        { error: "Valid parent email is required" },
        { status: 400 }
      );
    }

    const outstanding = Number(body.outstandingBalance || 0);
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
  <div style="max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
    <h2 style="color: #166534; margin-top: 0;">Suxess Schools — Payment Receipt</h2>
    <p>Dear ${body.parentName || "Parent/Guardian"},</p>
    <p>Thank you. A payment has been recorded for <strong>${body.studentName}</strong>.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px 0; color: #666;">Receipt No</td><td style="padding: 8px 0; text-align: right;"><strong>${body.receiptNumber}</strong></td></tr>
      <tr><td style="padding: 8px 0; color: #666;">Date</td><td style="padding: 8px 0; text-align: right;">${body.paymentDate || "—"}</td></tr>
      <tr><td style="padding: 8px 0; color: #666;">Fee type</td><td style="padding: 8px 0; text-align: right;">${body.feeType || "—"}</td></tr>
      <tr><td style="padding: 8px 0; color: #666;">Session / Term</td><td style="padding: 8px 0; text-align: right;">${body.session || "—"} · ${body.term || "—"}</td></tr>
      <tr><td style="padding: 8px 0; color: #666;">Fee amount</td><td style="padding: 8px 0; text-align: right;">${formatNgn(Number(body.feeAmount || 0))}</td></tr>
      <tr><td style="padding: 8px 0; color: #666;">Amount paid</td><td style="padding: 8px 0; text-align: right; color: #166534;"><strong>${formatNgn(Number(body.amountPaid || 0))}</strong></td></tr>
      <tr><td style="padding: 8px 0; color: #666; border-top: 1px solid #e5e7eb;">Balance remaining</td><td style="padding: 8px 0; text-align: right; border-top: 1px solid #e5e7eb; color: ${outstanding > 0 ? "#b91c1c" : "#166534"};"><strong>${formatNgn(outstanding)}${outstanding === 0 ? " (Fully paid)" : ""}</strong></td></tr>
    </table>
    <p style="font-size: 13px; color: #666;">Payment method: ${body.paymentMethod || "—"}</p>
    <p style="font-size: 13px; color: #666;">Discipline today, success tomorrow.</p>
    <p style="font-size: 12px; color: #999;">Suxess Schools · Main · Arepo · Ofada Mowe</p>
  </div>
</body>
</html>`;

    const apiKey = process.env.RESEND_API_KEY;
    const from =
      process.env.EMAIL_FROM || "Suxess Fees <onboarding@resend.dev>";

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Email is not configured. Add RESEND_API_KEY in Vercel environment variables.",
          configured: false,
        },
        { status: 503 }
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Payment receipt ${body.receiptNumber} — ${body.studentName}`,
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.message || "Failed to send email" },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
