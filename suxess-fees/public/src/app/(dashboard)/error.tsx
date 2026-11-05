"use client";

import { WifiOff, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const offline =
    typeof navigator !== "undefined" && navigator.onLine === false;
  const msg = (error?.message || "").toLowerCase();
  const looksNetwork =
    offline ||
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("failed to fetch");

  return (
    <div className="flex items-center justify-center min-h-[50vh] p-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm max-w-md w-full p-8 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
          <WifiOff className="w-6 h-6 text-amber-700" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">
          {looksNetwork ? "Offline" : "Could not load this page"}
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          {looksNetwork
            ? "No internet connection. Connect to Wi‑Fi or mobile data, then try again."
            : "A temporary error occurred. Your data is still saved — try again."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
