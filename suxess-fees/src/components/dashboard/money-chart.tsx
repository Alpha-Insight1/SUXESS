/** Pure CSS/SVG bar chart — no extra dependency */
export function MoneyChart({
  months,
}: {
  months: { label: string; moneyIn: number; moneyOut: number; profit: number }[];
}) {
  const max = Math.max(
    1,
    ...months.map((m) => Math.max(m.moneyIn, m.moneyOut, Math.abs(m.profit)))
  );

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
      <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
        Cashflow trend
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Money in vs out · last months
      </p>
      <div className="flex items-end gap-2 h-40">
        {months.map((m) => {
          const inH = Math.round((m.moneyIn / max) * 100);
          const outH = Math.round((m.moneyOut / max) * 100);
          return (
            <div
              key={m.label}
              className="flex-1 flex flex-col items-center gap-1 min-w-0"
            >
              <div className="w-full flex items-end justify-center gap-0.5 h-28">
                <div
                  className="w-[40%] rounded-t bg-emerald-500/90 min-h-[2px]"
                  style={{ height: `${Math.max(inH, 2)}%` }}
                  title={`In ${m.moneyIn}`}
                />
                <div
                  className="w-[40%] rounded-t bg-rose-500/80 min-h-[2px]"
                  style={{ height: `${Math.max(outH, 2)}%` }}
                  title={`Out ${m.moneyOut}`}
                />
              </div>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center">
                {m.label.replace(/ \d{4}/, "")}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-3 text-[10px] text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-emerald-500" /> In
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-rose-500" /> Out
        </span>
      </div>
    </div>
  );
}
