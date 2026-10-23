"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Props = {
  parentPhone?: string | null;
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

export function SmsReceiptButton(props: Props) {
  const [phone, setPhone] = useState(props.parentPhone || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const send = async () => {
    setMessage(null);
    if (!phone.trim()) {
      setMessage("Enter parent phone number (e.g. 0803xxxxxxx).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/send-sms-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          studentName: props.studentName,
          parentName: props.parentName,
          receiptNumber: props.receiptNumber,
          amountPaid: props.amountPaid,
          feeType: props.feeType,
          feeAmount: props.feeAmount,
          outstandingBalance: props.outstandingBalance,
          session: props.session,
          term: props.term,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Could not send SMS.");
      } else {
        setMessage(
          `SMS sent to ${phone.trim()}. Balance shown: ${formatCurrency(
            Number(props.outstandingBalance || 0)
          )}.`
        );
      }
    } catch {
      setMessage("Network error. Try again.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-2 print:hidden">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Parent phone e.g. 0803xxxxxxx"
          className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
        />
        <button
          type="button"
          onClick={send}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-700 text-white text-sm font-medium rounded-lg hover:bg-emerald-800 transition disabled:opacity-60"
        >
          <MessageSquare className="w-4 h-4" />
          {loading ? "Sending…" : "Send SMS"}
        </button>
      </div>
      {message && (
        <p
          className={`text-sm ${
            message.includes("SMS sent") ? "text-green-700" : "text-red-600"
          }`}
        >
          {message}
        </p>
      )}
      <p className="text-xs text-gray-400">
        SMS includes amount paid and balance remaining. Requires Termii credits.
      </p>
    </div>
  );
}
