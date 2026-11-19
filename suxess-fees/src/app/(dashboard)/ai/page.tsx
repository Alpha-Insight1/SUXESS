import { redirect } from "next/navigation";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { AdminAiChat } from "@/components/ai/admin-ai-chat";
import Link from "next/link";

export default async function AiAssistantPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isAdmin(profile)) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900">Alpha</h1>
        <p className="text-gray-500 mt-2">
          Alpha is only available to the director / admin account.
        </p>
        <Link href="/" className="text-brand-green text-sm font-medium mt-4 inline-block">
          ← Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Alpha</h1>
        <p className="text-gray-500 mt-1">
          Alpha answers fast questions about the school — card renewals by branch,
          attendance, payments, outstanding fees, exam registration, and more.
          Answers use live data from Suxess Fees.
        </p>
      </div>
      <AdminAiChat />
      <p className="text-xs text-gray-400 mt-4">
        Optional: set <code className="bg-gray-100 px-1 rounded">XAI_API_KEY</code>{" "}
        or <code className="bg-gray-100 px-1 rounded">OPENAI_API_KEY</code> in
        environment for full natural-language AI. Without a key, the assistant
        still answers common questions from live database tools.
      </p>
    </div>
  );
}
