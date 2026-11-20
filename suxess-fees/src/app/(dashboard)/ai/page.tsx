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
          Alpha can read all of the school&apos;s data — students, cards, fees,
          payments, expenses, staff, attendance, messages, secretary activity
          and more. If Alpha cannot find an accurate answer, it will tell you
          instead of guessing.
        </p>
      </div>
      <AdminAiChat />
      <p className="text-xs text-gray-400 mt-4">
        To let Alpha answer any question in natural language, set{" "}
        <code className="bg-gray-100 px-1 rounded">XAI_API_KEY</code> or{" "}
        <code className="bg-gray-100 px-1 rounded">OPENAI_API_KEY</code> in the
        environment. Without a key, Alpha only understands common keywords and
        will say when it does not have accurate information.
      </p>
    </div>
  );
}
