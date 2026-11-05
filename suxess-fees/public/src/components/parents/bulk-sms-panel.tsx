"use client";

import { useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";

export type ParentRow = {
  phone: string;
  email?: string;
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
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!campusFilter) return parents;
    return parents.filter((p) => p.campus_id === campusFilter);
  }, [parents, campusFilter]);

  const withPhone = filtered.filter((p) => (p.phone || "").trim());

  const allPhonesSelected =
    withPhone.length > 0 && withPhone.every((p) => selectedPhones.has(p.phone));

  const toggleAllSms = () => {
    const next = new Set(selectedPhones);
    if (allPhonesSelected) withPhone.forEach((p) => next.delete(p.phone));
    else withPhone.forEach((p) => next.add(p.phone));
    setSelectedPhones(next);
  };

  const togglePhone = (phone: string) => {
    const next = new Set(selectedPhones);
    if (next.has(phone)) next.delete(phone);
    else next.add(phone);
    setSelectedPhones(next);
  };

  const smsCount = [...selectedPhones].filter((ph) =>
    withPhone.some((p) => p.phone === ph)
  ).length;

  const SMS_AVAILABLE = false; // set true after Termii verifies Sender ID

  const sendSms = async () => {
    setResult(null);
    if (!SMS_AVAILABLE) {
      setResult("Not Available Now");
      return;
    }
    if (!isAdmin) {
      setResult("Only admin can send bulk SMS.");
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
        <p className="text-sm text-gray-500">{withPhone.length} phones</p>
      </div>

      {isAdmin && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <MessageSquare className="w-4 h-4 text-brand-green" />
            Bulk SMS
          </div>
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-lg px-3 py-2">
            Not Available Now — SMS will open after Termii Sender ID approval.
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={480}
              placeholder="SMS to parents… e.g. Suxess: Please pay outstanding fees. Thank you."
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
            />
            <p className="text-xs text-gray-400 mt-1">
              {message.length}/480 · Uses Termii credits
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm text-gray-600">
              Selected: <strong>{smsCount}</strong>
            </span>
            <button
              type="button"
              onClick={sendSms}
              disabled={true || loading || smsCount === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition disabled:opacity-50"
            >
              {SMS_AVAILABLE ? (loading ? "Sending…" : `Send SMS (${smsCount})`) : "Not Available Now"}
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
          You can view parent phones for your campus. Only admin can send bulk
          SMS.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {isAdmin && (
                  <th className="text-left px-4 py-3 font-medium">
                    <input
                      type="checkbox"
                      checked={allPhonesSelected}
                      onChange={toggleAllSms}
                      title="Select all with phone"
                    />
                  </th>
                )}
                <th className="text-left px-4 py-3 font-medium">Parent</th>
                <th className="text-left px-4 py-3 font-medium">Phone</th>
                <th className="text-left px-4 py-3 font-medium">Campus</th>
                <th className="text-left px-4 py-3 font-medium">Student(s)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length > 0 ? (
                filtered.map((p) => {
                  const key = p.phone + "|" + p.campus_id + "|" + p.parent_name;
                  return (
                    <tr key={key} className="hover:bg-gray-50">
                      {isAdmin && (
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
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {p.parent_name || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-800">
                        {p.phone || (
                          <span className="text-gray-400">No phone</span>
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
                    colSpan={isAdmin ? 5 : 4}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    No parent phones found. Add parent phone when registering
                    students.
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
