"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl font-bold text-red-500">!</span>
        </div>
        <h2 className="font-display text-2xl font-bold text-navy-900 mb-3">
          Something went wrong
        </h2>
        <p className="text-sm text-gray-500 mb-8">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-navy-900 text-white font-semibold text-sm transition-all hover:bg-navy-800"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
