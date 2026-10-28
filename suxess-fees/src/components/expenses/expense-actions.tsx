"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Trash2, X } from "lucide-react";
import { MoneyInput, formatMoneyInput } from "@/components/ui/money-input";

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

export function ExpenseActions({
  expense,
}: {
  expense: {
    id: string;
    expense_date: string;
    category: string;
    description: string;
    amount: number;
    payment_method?: string | null;
    notes?: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    expense_date: String(expense.expense_date || "").slice(0, 10),
    category: expense.category || "Other",
    description: expense.description || "",
    amountDisplay: formatMoneyInput(String(Math.round(Number(expense.amount || 0)))),
    payment_method: expense.payment_method || "cash",
    notes: expense.notes || "",
  });
  const router = useRouter();
  const supabase = createClient();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(String(form.amountDisplay).replace(/,/g, ""));
    if (!form.description.trim() || !amount || amount <= 0) {
      alert("Description and a valid amount are required.");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("expenses")
      .update({
        expense_date: form.expense_date,
        category: form.category,
        description: form.description.trim(),
        amount,
        payment_method: form.payment_method,
        notes: form.notes || null,
      })
      .eq("id", expense.id);
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    setOpen(false);
    router.refresh();
  };

  const remove = async () => {
    if (!confirm("Delete this expense? This cannot be undone.")) return;
    setLoading(true);
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expense.id);
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-brand-green hover:underline inline-flex items-center gap-0.5"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={loading}
          className="text-xs font-medium text-red-600 hover:underline inline-flex items-center gap-0.5 disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold">Edit expense</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={form.expense_date}
                  onChange={(e) =>
                    setForm({ ...form, expense_date: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Description *
                </label>
                <input
                  required
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Amount (₦) *
                </label>
                <MoneyInput
                  value={form.amountDisplay}
                  onValueChange={(display) =>
                    setForm({ ...form, amountDisplay: display })
                  }
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Use commas: 1,000 not 1000000 by mistake
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Method</label>
                <select
                  value={form.payment_method}
                  onChange={(e) =>
                    setForm({ ...form, payment_method: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="transfer">Transfer</option>
                  <option value="pos">POS</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <input
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-green text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {loading ? "Saving…" : "Save changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
