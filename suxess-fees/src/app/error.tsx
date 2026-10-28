"use client";

import { useEffect } from "react";
import { WifiOff, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const offline =
    typeof navigator !== "undefined" && navigator.onLine === false;
  const msg = (error?.message || "").toLowerCase();
  const looksNetwork =
    offline ||
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("load failed");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm max-w-md w-full p-8 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
          <WifiOff className="w-6 h-6 text-amber-700" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">
          {looksNetwork ? "Offline" : "Something went wrong"}
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          {looksNetwork
            ? "No internet connection or the server could not be reached. Check your network and try again."
            : "The page could not load. Please try again. If it keeps happening, contact support."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
        <p className="text-xs text-gray-400 mt-4">
          <a href="/" className="text-brand-green hover:underline">
            Back to dashboard
          </a>
        </p>
      </div>
    </div>
  );
}
