"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Shows a clear "Offline" banner when the device has no network,
 * instead of a raw browser/Vercel error when requests fail.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-0 inset-x-0 z-[100] px-3 pb-3 sm:pb-4 pointer-events-none"
    >
      <div className="max-w-lg mx-auto pointer-events-auto rounded-xl bg-gray-900 text-white shadow-lg px-4 py-3 flex items-start gap-3">
        <WifiOff className="w-5 h-5 shrink-0 mt-0.5 text-amber-300" />
        <div className="min-w-0">
          <p className="font-semibold text-sm">Offline</p>
          <p className="text-xs text-gray-300 mt-0.5">
            No internet connection. Check your network, then try again. Your
            data is safe on the server.
          </p>
        </div>
      </div>
    </div>
  );
}
