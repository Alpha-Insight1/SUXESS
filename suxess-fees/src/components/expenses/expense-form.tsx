"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MoneyInput, parseMoneyInput } from "@/components/ui/money-input";

const CATEGORIES = [
  "Utilities",
  "Supplies",
  "Maintenance",
  "Transport",
  "Feeding",
  "Rent",
  "Security",
  "Marketing",
  "Miscellaneous",
  "Other",
];

type Campus = { id: string; name: string; short_name?: string | null };

export function ExpenseForm({
  campuses,
  lockedCampusId,
}: {
  campuses: Campus[];
  lockedCampusId?: string;
}) {
  const [campusId, setCampusId] = useState(lockedCampusId || campuses[0]?.id || "");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [category, setCategory] = useState("Utilities");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campusId || !description || !amount) return;
    setLoading(true);
    setSuccess(false);

    const { error } = await supabase.from("expenses").insert({
      campus_id: campusId,
      expense_date: expenseDate,
      category,
      description,
      amount: parseMoneyInput(amount),
      payment_method: method,
      notes: notes || null,
    });

    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }

    setSuccess(true);
    setDescription("");
    setAmount("");
    setNotes("");
    router.refresh();
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold text-gray-900">Record Expense</h2>
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg p-3">
          Expense recorded successfully.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Campus *</label>
          <select
            required
            value={campusId}
            onChange={(e) => setCampusId(e.target.value)}
            disabled={Boolean(lockedCampusId)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-green disabled:bg-gray-100"
          >
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.short_name || c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date *</label>
          <input
            type="date"
            required
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-green"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Category *</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-green"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Amount (₦) *</label>
          <MoneyInput
            value={amount}
            onValueChange={(display) => setAmount(display)}
            required
          />
          <p className="text-xs text-gray-400 mt-1">
            Use commas: 1,000 · 10,000 · 100,000
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description *</label>
        <input
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Diesel for generator, stationery"
          className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-green"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Paid via</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-green"
          >
            <option value="cash">Cash</option>
            <option value="transfer">Transfer</option>
            <option value="pos">POS</option>
            <option value="cheque">Cheque</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-green"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full sm:w-auto px-6 py-2.5 bg-brand-green hover:bg-brand-dark text-white font-medium rounded-lg transition disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save Expense"}
      </button>
    </form>
  );
}
