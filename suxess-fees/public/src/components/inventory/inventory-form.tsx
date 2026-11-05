"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, X } from "lucide-react";

const CATEGORIES = [
  "Textbook",
  "Workbook",
  "Stationery",
  "Uniform",
  "Lab equipment",
  "Other",
];

export function InventoryForm({
  campusId,
  canEdit,
}: {
  campusId?: string | null;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "Textbook",
    quantity: "0",
    min_stock: "5",
    unit: "pcs",
    cost_price: "",
    selling_price: "",
    notes: "",
  });
  const router = useRouter();
  const supabase = createClient();

  if (!canEdit) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("inventory_items").insert({
      name: form.name.trim(),
      category: form.category,
      quantity: Number(form.quantity) || 0,
      min_stock: Number(form.min_stock) || 0,
      unit: form.unit || "pcs",
      cost_price: Number(form.cost_price) || 0,
      selling_price: Number(form.selling_price) || 0,
      notes: form.notes || null,
      campus_id: campusId || null,
    });
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    setOpen(false);
    setForm({
      name: "",
      category: "Textbook",
      quantity: "0",
      min_stock: "5",
      unit: "pcs",
      cost_price: "",
      selling_price: "",
      notes: "",
    });
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-brand-green hover:bg-brand-dark text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
      >
        <Plus className="w-4 h-4" />
        Add item
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Add inventory item</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
                  placeholder="e.g. New General Mathematics SS1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Qty in stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm({ ...form, quantity: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Unit</label>
                  <input
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="pcs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Cost price (₦) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={form.cost_price}
                    onChange={(e) =>
                      setForm({ ...form, cost_price: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Bought for"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Selling price (₦) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={form.selling_price}
                    onChange={(e) =>
                      setForm({ ...form, selling_price: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Sell for"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Profit per item = Selling price − Cost price
              </p>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Low stock alert at
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.min_stock}
                  onChange={(e) =>
                    setForm({ ...form, min_stock: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-green text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {loading ? "Saving…" : "Save item"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
