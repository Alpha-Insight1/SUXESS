import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getCurrentProfile, campusFilter, isAdmin } from "@/lib/auth";
import { InventoryForm } from "@/components/inventory/inventory-form";
import { InventoryActions } from "@/components/inventory/inventory-actions";

export default async function InventoryPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const lockedCampus = campusFilter(profile);
  const admin = isAdmin(profile);

  // Main branch secretaries can edit; admin always can
  const campusLabel = `${profile?.campuses?.short_name || ""} ${
    profile?.campuses?.name || ""
  }`.toLowerCase();
  const isMainSec =
    campusLabel.includes("main") ||
    (profile?.role === "secretary" &&
      !campusLabel.includes("arepo") &&
      !campusLabel.includes("ofada") &&
      !campusLabel.includes("mowe") &&
      !!lockedCampus);
  const canEdit = admin || isMainSec;

  let itemsQuery = supabase
    .from("inventory_items")
    .select("*")
    .order("name");
  if (lockedCampus) {
    itemsQuery = itemsQuery.or(
      `campus_id.eq.${lockedCampus},campus_id.is.null`
    );
  }

  let salesQuery = supabase
    .from("inventory_sales")
    .select("id, item_name, quantity, total_price, total_cost, profit, sale_date, payment_method, buyer_name")
    .order("sale_date", { ascending: false })
    .limit(100);
  if (lockedCampus) {
    salesQuery = salesQuery.eq("campus_id", lockedCampus);
  }

  const [{ data: items }, { data: sales }] = await Promise.all([
    itemsQuery,
    salesQuery,
  ]);

  const list = items || [];
  const salesList = sales || [];

  const lowStock = list.filter(
    (i) => Number(i.quantity) > 0 && Number(i.quantity) <= Number(i.min_stock)
  );
  const outOfStock = list.filter((i) => Number(i.quantity) === 0);

  const stockValueCost = list.reduce(
    (s, i) => s + Number(i.quantity) * Number(i.cost_price || 0),
    0
  );
  const stockValueSell = list.reduce(
    (s, i) => s + Number(i.quantity) * Number(i.selling_price || 0),
    0
  );
  const potentialProfit = stockValueSell - stockValueCost;

  const salesProfit = salesList.reduce(
    (s, r) => s + Number(r.profit || 0),
    0
  );
  const salesRevenue = salesList.reduce(
    (s, r) => s + Number(r.total_price || 0),
    0
  );

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 mt-1">
            Textbooks & materials · cost, selling price and profit
            {profile?.campuses?.short_name
              ? ` · ${profile.campuses.short_name}`
              : admin
                ? " · All campuses"
                : ""}
          </p>
        </div>
        <InventoryForm campusId={lockedCampus} canEdit={canEdit} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Items</p>
          <p className="text-2xl font-bold">{list.length}</p>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Stock value (cost)</p>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(stockValueCost)}
          </p>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">If all sold (retail)</p>
          <p className="text-xl font-bold text-green-700">
            {formatCurrency(stockValueSell)}
          </p>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Potential profit in stock</p>
          <p
            className={`text-xl font-bold ${
              potentialProfit >= 0 ? "text-green-700" : "text-red-600"
            }`}
          >
            {formatCurrency(potentialProfit)}
          </p>
        </div>
      </div>

      {(admin || canEdit) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm text-green-800">Sales revenue (recent)</p>
            <p className="text-2xl font-bold text-green-900">
              {formatCurrency(salesRevenue)}
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm text-green-800">Profit from sales (recent)</p>
            <p className="text-2xl font-bold text-green-900">
              {formatCurrency(salesProfit)}
            </p>
          </div>
        </div>
      )}

      {(outOfStock.length > 0 || lowStock.length > 0) && (
        <div className="mb-6 space-y-2">
          {outOfStock.map((i) => (
            <div
              key={i.id}
              className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-4 py-2"
            >
              <strong>{i.name}</strong> — Out of stock
            </div>
          ))}
          {lowStock.map((i) => (
            <div
              key={i.id}
              className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-lg px-4 py-2"
            >
              <strong>{i.name}</strong> — Low stock ({i.quantity}{" "}
              {i.unit || "pcs"}; alert at {i.min_stock})
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-left px-4 py-3 font-medium">Qty</th>
                <th className="text-left px-4 py-3 font-medium">Cost</th>
                <th className="text-left px-4 py-3 font-medium">Sell</th>
                <th className="text-left px-4 py-3 font-medium">Profit/unit</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                {canEdit && (
                  <th className="text-left px-4 py-3 font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.length > 0 ? (
                list.map((i) => {
                  const qty = Number(i.quantity);
                  const min = Number(i.min_stock);
                  const cost = Number(i.cost_price || 0);
                  const sell = Number(i.selling_price || 0);
                  const unitProfit = sell - cost;
                  let status = "In stock";
                  let statusClass = "text-green-700";
                  if (qty === 0) {
                    status = "Out of stock";
                    statusClass = "text-red-600 font-semibold";
                  } else if (qty <= min) {
                    status = "Low stock";
                    statusClass = "text-amber-700 font-semibold";
                  }
                  return (
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{i.name}</div>
                        <div className="text-xs text-gray-400">{i.category}</div>
                      </td>
                      <td className="px-4 py-3">
                        {qty} {i.unit || "pcs"}
                      </td>
                      <td className="px-4 py-3">{formatCurrency(cost)}</td>
                      <td className="px-4 py-3">{formatCurrency(sell)}</td>
                      <td
                        className={`px-4 py-3 font-semibold ${
                          unitProfit >= 0 ? "text-green-700" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(unitProfit)}
                      </td>
                      <td className={`px-4 py-3 ${statusClass}`}>{status}</td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <InventoryActions
                            itemId={i.id}
                            quantity={qty}
                            canEdit={canEdit}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={canEdit ? 7 : 6}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    No inventory items yet. Add cost and selling price for each
                    product.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recent sales</h2>
          <p className="text-sm text-gray-500">
            Sales recorded from the Payment page
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-left px-4 py-3 font-medium">Qty</th>
                <th className="text-left px-4 py-3 font-medium">Revenue</th>
                <th className="text-left px-4 py-3 font-medium">Profit</th>
                <th className="text-left px-4 py-3 font-medium">Buyer</th>
                <th className="text-left px-4 py-3 font-medium">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {salesList.length > 0 ? (
                salesList.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{s.sale_date}</td>
                    <td className="px-4 py-3 font-medium">{s.item_name}</td>
                    <td className="px-4 py-3">{s.quantity}</td>
                    <td className="px-4 py-3 text-green-700">
                      {formatCurrency(Number(s.total_price || 0))}
                    </td>
                    <td className="px-4 py-3 font-semibold text-green-800">
                      {formatCurrency(Number(s.profit || 0))}
                    </td>
                    <td className="px-4 py-3">{s.buyer_name || "—"}</td>
                    <td className="px-4 py-3 capitalize">
                      {s.payment_method}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-gray-400"
                  >
                    No sales yet. Sell items from Record Payment → Inventory
                    sales.
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
