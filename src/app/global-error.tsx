"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: "40px", fontFamily: "sans-serif", textAlign: "center" }}>
          <h2>Something went wrong</h2>
          <p style={{ color: "#666" }}>An unexpected error occurred. Our team has been notified.</p>
          <button
            onClick={reset}
            style={{
              marginTop: "16px",
              padding: "10px 24px",
              backgroundColor: "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
