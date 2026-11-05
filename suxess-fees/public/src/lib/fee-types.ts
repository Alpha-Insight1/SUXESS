
/** Official fee types only (shown in Record Payment) */
export const ALLOWED_FEE_TYPE_NAMES = [
  "WAEC",
  "NECO",
  "GCE",
  "BECE",
  "Primary 6 Leaving Certificate",
  "WAEC Result",
  "Testimonial",
  "School Fees",
  "Tuition (Monthly)",
  "JAMB",
  "NECO GCE",
  "WAEC GCE",
  "Uniform",
] as const;

export function isAllowedFeeTypeName(name?: string | null): boolean {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  return ALLOWED_FEE_TYPE_NAMES.some((a) => a.toLowerCase() === n);
}
