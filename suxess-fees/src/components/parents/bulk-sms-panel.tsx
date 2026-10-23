"use client";

import { useMemo, useState } from "react";
import { Mail, MessageSquare } from "lucide-react";

export type ParentRow = {
  phone: string;
  email: string; // may be empty string
  parent_name: string;
  students: string;
  campus: string;
  campus_id: string;
};

export function BulkSmsPanel({
  parents,
  campuses,
  isAdmin,
}: {
  parents: ParentRow[];
  campuses: { id: string; name: string; short_name?: string | null }[];
  isAdmin: boolean;
}) {
  const [campusFilter, setCampusFilter] = useState<string>("");
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("Message from Suxess Schools");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!campusFilter) return parents;
    return parents.filter((p) => p.campus_id === campusFilter);
  }, [parents, campusFilter]);

  const withPhone = filtered.filter((p) => p.phone.trim());
  const withEmail = filtered.filter((p) => (p.email || "").trim().includes("@"));

  const allPhonesSelected =
    withPhone.length > 0 && withPhone.every((p) => selectedPhones.has(p.phone));
  const allEmailsSelected =
    withEmail.length > 0 &&
    withEmail.every((p) => selectedEmails.has(p.email.toLowerCase()));

  const toggleAllSms = () => {
    const next = new Set(selectedPhones);
    if (allPhonesSelected) withPhone.forEach((p) => next.delete(p.phone));
    else withPhone.forEach((p) => next.add(p.phone));
    setSelectedPhones(next);
  };

  const toggleAllEmail = () => {
    const next = new Set(selectedEmails);
    if (allEmailsSelected)
      withEmail.forEach((p) => next.delete(p.email.toLowerCase()));
    else withEmail.forEach((p) => next.add(p.email.toLowerCase()));
    setSelectedEmails(next);
  };

  const togglePhone = (phone: string) => {
    const next = new Set(selectedPhones);
    if (next.has(phone)) next.delete(phone);
    else next.add(phone);
    setSelectedPhones(next);
  };

  const toggleEmail = (email: string) => {
    const key = email.toLowerCase();
    const next = new Set(selectedEmails);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedEmails(next);
  };

  const smsCount = [...selectedPhones].filter((ph) =>
    withPhone.some((p) => p.phone === ph)
  ).length;
  const emailCount = [...selectedEmails].filter((em) =>
    withEmail.some((p) => p.email.toLowerCase() === em)
  ).length;

  const sendSms = async () => {
    setResult(null);
    if (!isAdmin) {
      setResult("Only admin can send bulk messages.");
      return;
    }
    const phones = [...selectedPhones].filter((ph) =>
      withPhone.some((p) => p.phone === ph)
    );
    if (!phones.length) {
      setResult("Select at least one parent with a phone number.");
      return;
    }
    if (!message.trim()) {
      setResult("Enter a message.");
      return;
    }
    if (
      !confirm(
        `Send SMS to ${phones.length} parent(s)? This uses Termii credits.`
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/send-bulk-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phones, message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) setResult(data.error || "Failed to send SMS.");
      else
        setResult(
          `SMS sent to ${data.sent} of ${data.total} number(s).` +
            (data.partial ? " Some may have failed." : "")
        );
    } catch {
      setResult("Network error. Try again.");
    }
    setLoading(false);
  };

  const sendEmail = async () => {
    setResult(null);
    if (!isAdmin) {
      setResult("Only admin can send bulk messages.");
      return;
    }
    const emails = [...selectedEmails].filter((em) =>
      withEmail.some((p) => p.email.toLowerCase() === em)
    );
    if (!emails.length) {
      setResult("Select at least one parent with an email address.");
      return;
    }
    if (!subject.trim() || !message.trim()) {
      setResult("Subject and message are required.");
      return;
    }
    if (!confirm(`Send email to ${emails.length} parent(s)?`)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/send-bulk-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) setResult(data.error || "Failed to send email.");
      else
        setResult(
          `Email sent to ${data.sent} of ${data.total} address(es).` +
            (data.partial ? " Some may have failed." : "")
        );
    } catch {
      setResult("Network error. Try again.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Campus</label>
        <select
          value={campusFilter}
          onChange={(e) => setCampusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm max-w-xs outline-none focus:ring-2 focus:ring-brand-green"
        >
          <option value="">All branches</option>
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.short_name || c.name}
            </option>
          ))}
        </select>
        <p className="text-sm text-gray-500">
          {withPhone.length} phones · {withEmail.length} emails
        </p>
      </div>

      {isAdmin && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setChannel("sms")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border ${
                channel === "sms"
                  ? "bg-brand-green text-white border-brand-green"
                  : "bg-white text-gray-700 border-gray-200"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Bulk SMS
            </button>
            <button
              type="button"
              onClick={() => setChannel("email")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border ${
                channel === "email"
                  ? "bg-brand-green text-white border-brand-green"
                  : "bg-white text-gray-700 border-gray-200"
              }`}
            >
              <Mail className="w-4 h-4" />
              Bulk Email
            </button>
          </div>

          {channel === "email" && (
            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={channel === "sms" ? 480 : 5000}
              placeholder={
                channel === "sms"
                  ? "SMS to parents… e.g. Suxess: Please pay outstanding fees. Thank you."
                  : "Email body to parents…"
              }
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
            />
            <p className="text-xs text-gray-400 mt-1">
              {channel === "sms"
                ? `${message.length}/480 · Uses Termii credits`
                : `${message.length} characters · Uses Resend`}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm text-gray-600">
              Selected:{" "}
              <strong>
                {channel === "sms" ? smsCount : emailCount}
              </strong>
            </span>
            <button
              type="button"
              onClick={channel === "sms" ? sendSms : sendEmail}
              disabled={
                loading ||
                (channel === "sms" ? smsCount === 0 : emailCount === 0)
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition disabled:opacity-50"
            >
              {loading
                ? "Sending…"
                : channel === "sms"
                  ? `Send SMS (${smsCount})`
                  : `Send Email (${emailCount})`}
            </button>
          </div>

          {result && (
            <p
              className={`text-sm ${
                result.includes("sent") ? "text-green-700" : "text-red-600"
              }`}
            >
              {result}
            </p>
          )}
        </div>
      )}

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-lg p-3">
          You can view parent contacts for your campus. Only admin can send bulk
          SMS or email.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {isAdmin && channel === "sms" && (
                  <th className="text-left px-4 py-3 font-medium">
                    <input
                      type="checkbox"
                      checked={allPhonesSelected}
                      onChange={toggleAllSms}
                      title="Select all with phone"
                    />
                  </th>
                )}
                {isAdmin && channel === "email" && (
                  <th className="text-left px-4 py-3 font-medium">
                    <input
                      type="checkbox"
                      checked={allEmailsSelected}
                      onChange={toggleAllEmail}
                      title="Select all with email"
                    />
                  </th>
                )}
                <th className="text-left px-4 py-3 font-medium">Parent</th>
                <th className="text-left px-4 py-3 font-medium">Phone</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Campus</th>
                <th className="text-left px-4 py-3 font-medium">Student(s)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length > 0 ? (
                filtered.map((p) => {
                  const key = p.phone + "|" + p.email + "|" + p.campus_id;
                  return (
                    <tr key={key} className="hover:bg-gray-50">
                      {isAdmin && channel === "sms" && (
                        <td className="px-4 py-3">
                          {p.phone ? (
                            <input
                              type="checkbox"
                              checked={selectedPhones.has(p.phone)}
                              onChange={() => togglePhone(p.phone)}
                            />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      )}
                      {isAdmin && channel === "email" && (
                        <td className="px-4 py-3">
                          {p.email.includes("@") ? (
                            <input
                              type="checkbox"
                              checked={selectedEmails.has(
                                p.email.toLowerCase()
                              )}
                              onChange={() => toggleEmail(p.email)}
                            />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {p.parent_name || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-800">
                        {p.phone || (
                          <span className="text-gray-400">No phone</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-800">
                        {p.email || (
                          <span className="text-gray-400">No email</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{p.campus}</td>
                      <td className="px-4 py-3 text-gray-600">{p.students}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={isAdmin ? 6 : 5}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    No parent contacts found. Add parent phone/email when
                    registering students.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
