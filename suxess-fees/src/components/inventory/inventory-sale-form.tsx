"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { ShoppingCart } from "lucide-react";

export type InventoryProduct = {
  id: string;
  name: string;
  quantity: number;
  unit?: string | null;
  cost_price?: number | null;
  selling_price?: number | null;
  category?: string | null;
};

type StudentOpt = {
  id: string;
  full_name: string;
  admission_number: string;
};

export function InventorySaleForm({
  products,
  students,
  campusId,
}: {
  products: InventoryProduct[];
  students: StudentOpt[];
  campusId?: string | null;
}) {
  const available = useMemo(
    () => products.filter((p) => Number(p.quantity) > 0),
    [products]
  );
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [method, setMethod] = useState("cash");
  const [studentId, setStudentId] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const selected = available.find((p) => p.id === itemId);
  const unitPrice = Number(selected?.selling_price || 0);
  const unitCost = Number(selected?.cost_price || 0);
  const q = Math.max(1, Number(qty) || 1);
  const total = unitPrice * q;
  const profit = (unitPrice - unitCost) * q;

  const handleSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!selected) {
      setMessage("Select a product in stock.");
      return;
    }
    if (q > Number(selected.quantity)) {
      setMessage(`Only ${selected.quantity} in stock.`);
      return;
    }
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const student = students.find((s) => s.id === studentId);
    const buyer =
      buyerName.trim() ||
      student?.full_name ||
      "Walk-in";

    const { error: saleErr } = await supabase.from("inventory_sales").insert({
      inventory_item_id: selected.id,
      item_name: selected.name,
      quantity: q,
      unit_cost: unitCost,
      unit_price: unitPrice,
      total_cost: unitCost * q,
      total_price: total,
      profit,
      payment_method: method,
      student_id: studentId || null,
      buyer_name: buyer,
      campus_id: campusId || null,
      notes: notes || null,
      sold_by: userData.user?.id || null,
      sale_date: new Date().toISOString().slice(0, 10),
    });

    if (saleErr) {
      setLoading(false);
      setMessage(saleErr.message);
      return;
    }

    const newQty = Number(selected.quantity) - q;
    const { error: stockErr } = await supabase
      .from("inventory_items")
      .update({
        quantity: newQty,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selected.id);

    setLoading(false);
    if (stockErr) {
      setMessage(
        `Sale saved but stock update failed: ${stockErr.message}. Adjust quantity on Inventory page.`
      );
    } else {
      setMessage(
        `Sold ${q} × ${selected.name} for ${formatCurrency(total)}. Profit ${formatCurrency(profit)}.`
      );
      setItemId("");
      setQty("1");
      setNotes("");
      setBuyerName("");
      setStudentId("");
      router.refresh();
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <ShoppingCart className="w-5 h-5 text-brand-green" />
        <h2 className="text-lg font-semibold text-gray-900">
          Sell inventory item
        </h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Products in stock from inventory. Recording a sale reduces quantity and
        tracks profit for admin.
      </p>

      {available.length === 0 ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          No products in stock. Add items under Inventory first.
        </p>
      ) : (
        <form onSubmit={handleSale} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Product *</label>
            <select
              required
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
            >
              <option value="">Select product…</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.quantity} {p.unit || "pcs"} ·{" "}
                  {formatCurrency(Number(p.selling_price || 0))}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Quantity *</label>
              <input
                type="number"
                min="1"
                max={selected ? Number(selected.quantity) : undefined}
                required
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Method *</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="cash">Cash</option>
                <option value="transfer">Transfer</option>
                <option value="pos">POS</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {selected && (
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm space-y-1">
              <p>
                Unit price:{" "}
                <strong>{formatCurrency(unitPrice)}</strong>
              </p>
              <p>
                Total: <strong className="text-green-700">{formatCurrency(total)}</strong>
              </p>
              <p className="text-xs text-gray-500">
                Profit on this sale: {formatCurrency(profit)} (admin view)
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Student (optional)
            </label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Walk-in / not linked</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.admission_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Buyer name (if not student)
            </label>
            <input
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !itemId}
            className="w-full bg-brand-green text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-60"
          >
            {loading ? "Saving…" : "Record sale"}
          </button>

          {message && (
            <p
              className={`text-sm ${
                message.startsWith("Sold") ? "text-green-700" : "text-red-600"
              }`}
            >
              {message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
