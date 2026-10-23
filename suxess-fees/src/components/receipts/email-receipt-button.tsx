"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Props = {
  parentEmail?: string | null;
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

export function EmailReceiptButton(props: Props) {
  const [email, setEmail] = useState(props.parentEmail || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const send = async () => {
    setMessage(null);
    if (!email.trim() || !email.includes("@")) {
      setMessage("Enter a valid parent email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/send-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email.trim(),
          studentName: props.studentName,
          parentName: props.parentName,
          receiptNumber: props.receiptNumber,
          amountPaid: props.amountPaid,
          feeType: props.feeType,
          feeAmount: props.feeAmount,
          outstandingBalance: props.outstandingBalance,
          session: props.session,
          term: props.term,
          paymentDate: props.paymentDate,
          paymentMethod: props.paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Could not send email.");
      } else {
        setMessage(
          `Receipt emailed to ${email.trim()}. Balance shown: ${formatCurrency(
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
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Parent email"
          className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
        />
        <button
          type="button"
          onClick={send}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition disabled:opacity-60"
        >
          <Mail className="w-4 h-4" />
          {loading ? "Sending…" : "Email receipt"}
        </button>
      </div>
      {message && (
        <p
          className={`text-sm ${
            message.includes("emailed") ? "text-green-700" : "text-red-600"
          }`}
        >
          {message}
        </p>
      )}
      <p className="text-xs text-gray-400">
        The email includes amount paid and balance remaining.
      </p>
    </div>
  );
}
