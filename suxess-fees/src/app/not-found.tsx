import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm max-w-md w-full p-8 text-center">
        <p className="text-sm font-semibold text-brand-green">404</p>
        <h1 className="text-xl font-bold text-gray-900 mt-1">
          Page not found
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          This page may have moved, or the app is updating. Try the dashboard
          or refresh the page.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition"
          >
            Go to dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-5 py-2.5 border border-gray-200 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50 transition"
          >
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
