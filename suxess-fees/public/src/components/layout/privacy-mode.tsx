"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const STORAGE_KEY = "suxess_privacy_mode";

/**
 * Director privacy: hide money amounts when the app is open in public.
 * Toggle blurs amounts app-wide (local preference).
 */
export function PrivacyModeButton() {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) === "1";
      setOn(saved);
      document.body.classList.toggle("privacy-mode", saved);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    document.body.classList.toggle("privacy-mode", next);
  };

  if (!ready) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={on ? "Show amounts" : "Hide amounts (privacy)"}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border transition ${
        on
          ? "bg-gray-900 text-white border-gray-900"
          : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
      }`}
    >
      {on ? (
        <>
          <EyeOff className="w-4 h-4" />
          <span className="hidden sm:inline">Amounts hidden</span>
          <span className="sm:hidden">Hidden</span>
        </>
      ) : (
        <>
          <Eye className="w-4 h-4" />
          <span className="hidden sm:inline">Hide amounts</span>
          <span className="sm:hidden">Privacy</span>
        </>
      )}
    </button>
  );
}

/** Apply privacy class on load for SSR flash reduction on client navigations */
export function PrivacyModeInit() {
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        document.body.classList.add("privacy-mode");
      }
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
