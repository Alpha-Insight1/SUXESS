"use client";

/**
 * Naira amount input with thousand separators while typing.
 * Value stored/emitted as plain number string (no commas) via onValueChange.
 */
export function formatMoneyInput(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function parseMoneyInput(display: string): number {
  const n = Number(String(display).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function MoneyInput({
  value,
  onValueChange,
  required,
  min,
  placeholder,
  className,
  id,
}: {
  value: string; // display may include commas
  onValueChange: (display: string, numeric: number) => void;
  required?: boolean;
  min?: number;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
        ₦
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        required={required}
        value={value}
        placeholder={placeholder || "e.g. 1,000"}
        onChange={(e) => {
          const display = formatMoneyInput(e.target.value);
          onValueChange(display, parseMoneyInput(display));
        }}
        className={
          className ||
          "w-full border rounded-lg pl-7 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
        }
      />
    </div>
  );
}
