"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function InventoryActions({
  itemId,
  quantity,
  canEdit,
}: {
  itemId: string;
  quantity: number;
  canEdit: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  if (!canEdit) return null;

  const adjust = async () => {
    const input = prompt("New quantity in stock", String(quantity));
    if (input === null) return;
    const qty = Number(input);
    if (isNaN(qty) || qty < 0) {
      alert("Enter a valid number (0 or more)");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("inventory_items")
      .update({ quantity: qty, updated_at: new Date().toISOString() })
      .eq("id", itemId);
    setLoading(false);
    if (error) alert(error.message);
    else router.refresh();
  };

  const remove = async () => {
    if (!confirm("Delete this inventory item?")) return;
    setLoading(true);
    const { error } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", itemId);
    setLoading(false);
    if (error) alert(error.message);
    else router.refresh();
  };

  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={adjust}
        disabled={loading}
        className="text-sm text-brand-green font-medium hover:underline disabled:opacity-50"
      >
        Update qty
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={loading}
        className="text-sm text-red-600 font-medium hover:underline disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
