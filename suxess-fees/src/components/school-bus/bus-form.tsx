"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MoneyInput, parseMoneyInput } from "@/components/ui/money-input";
import { MessageDialog } from "@/components/ui/confirm-dialog";

export function BusForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    plate_number: "",
    driver_name: "",
    driver_phone: "",
    route_name: "",
    capacity: "30",
    bus_fee: "",
    notes: "",
  });
  const router = useRouter();
  const supabase = createClient();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrorMsg("Bus name is required.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("school_buses").insert({
      name: form.name.trim(),
      plate_number: form.plate_number || null,
      driver_name: form.driver_name || null,
      driver_phone: form.driver_phone || null,
      route_name: form.route_name || null,
      capacity: Number(form.capacity) || 0,
      bus_fee: parseMoneyInput(form.bus_fee) || 0,
      notes: form.notes || null,
      is_active: true,
    });
    setLoading(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setOpen(false);
    setForm({
      name: "",
      plate_number: "",
      driver_name: "",
      driver_phone: "",
      route_name: "",
      capacity: "30",
      bus_fee: "",
      notes: "",
    });
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2.5 bg-brand-blue text-white text-sm font-medium rounded-lg hover:bg-brand-navy"
      >
        + Add bus
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={save}
            className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto border dark:border-gray-700"
          >
            <h2 className="text-lg font-semibold dark:text-white">Add school bus</h2>
            <input
              required
              placeholder="Bus name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
            <input
              placeholder="Plate number"
              value={form.plate_number}
              onChange={(e) =>
                setForm({ ...form, plate_number: e.target.value })
              }
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
            <input
              placeholder="Route (e.g. Magboro – School)"
              value={form.route_name}
              onChange={(e) => setForm({ ...form, route_name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Driver name"
                value={form.driver_name}
                onChange={(e) =>
                  setForm({ ...form, driver_name: e.target.value })
                }
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              />
              <input
                placeholder="Driver phone"
                value={form.driver_phone}
                onChange={(e) =>
                  setForm({ ...form, driver_phone: e.target.value })
                }
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Capacity"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              />
              <div>
                <MoneyInput
                  value={form.bus_fee}
                  onValueChange={(d) => setForm({ ...form, bus_fee: d })}
                  placeholder="Bus fee"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-brand-blue text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {loading ? "Saving…" : "Save bus"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      <MessageDialog
        open={!!errorMsg}
        title="Could not save bus"
        message={errorMsg || ""}
        onClose={() => setErrorMsg(null)}
      />
    </>
  );
}
