"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const offline =
    typeof navigator !== "undefined" && navigator.onLine === false;

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f9fafb" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              maxWidth: 400,
              padding: 32,
              textAlign: "center",
            }}
          >
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
              {offline ? "Offline" : "Something went wrong"}
            </h1>
            <p style={{ color: "#6b7280", fontSize: 14, marginTop: 12 }}>
              {offline
                ? "No internet connection. Check your network and try again."
                : "Please try again in a moment."}
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                marginTop: 24,
                background: "#0B5C2E",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
