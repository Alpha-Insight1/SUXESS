"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

export function StudentSearch({
  initialQuery,
  campusId,
}: {
  initialQuery: string;
  campusId?: string;
}) {
  const [q, setQ] = useState(initialQuery);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (campusId) params.set("campus", campusId);
    const qs = params.toString();
    router.push(qs ? `/students?${qs}` : "/students");
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, admission no, or parent phone…"
          className="w-full pl-10 pr-24 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-brand-green text-white text-sm font-medium rounded-md hover:bg-brand-dark transition"
        >
          Search
        </button>
      </div>
    </form>
  );
}
